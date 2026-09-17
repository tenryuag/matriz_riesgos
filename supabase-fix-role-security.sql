-- ============================================================
-- CORRECCIÓN DE SEGURIDAD: el rol de administrador NO puede vivir en
-- user_metadata
-- ============================================================
-- Problema (reportado por el Security Advisor de Supabase): políticas RLS
-- y funciones verificaban el rol leyendo auth.jwt()->'user_metadata'.
-- user_metadata lo puede editar el propio usuario con
-- supabase.auth.updateUser({ data: { role: 'admin' } }), así que cualquier
-- cuenta podía autopromoverse a administrador.
--
-- Solución:
--   1. El rol se guarda en app_metadata (solo el servidor/SQL lo escribe).
--   2. Función public.is_admin() que consulta el rol en la base de datos
--      (efecto inmediato al cambiar un rol, sin esperar a que caduque el JWT).
--   3. Todas las políticas y funciones de administrador usan is_admin().
--   4. Nueva RPC set_user_role para que un admin dé o quite el rol desde
--      la app (editar user_metadata en el panel ya no tiene efecto).
--
-- ⚠️ ANTES DE CORRER: revisa quiénes tienen rol admin hoy. La migración
-- copia ese rol a app_metadata tal cual está:
--
--   SELECT email, raw_user_meta_data->>'role' AS rol
--   FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin';
--
-- Si aparece alguien que NO debería ser admin, después de correr el script
-- quítale el rol desde Gestión de usuarios (o con set_user_role).
--
-- Es seguro correrlo ANTES de desplegar la nueva versión de la app: la
-- app actual sigue mostrando los menús de admin por user_metadata (solo
-- interfaz), pero la base de datos ya solo obedece a app_metadata.
-- No borra user_metadata.role; eso se hace en un segundo paso
-- (supabase-fix-role-security-cleanup.sql) cuando la app nueva ya esté
-- en producción.
--
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- ============================================================

-- ---------- 1. Rol en app_metadata ----------
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', COALESCE(raw_user_meta_data->>'role', 'user'));

-- ---------- 2. is_admin(): consulta el rol real en la BD ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.raw_app_meta_data->>'role' = 'admin'
       FROM auth.users u
      WHERE u.id = auth.uid()),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------- 3. Políticas: user_module_access ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'user_module_access') THEN
    DROP POLICY IF EXISTS "admin read all module access" ON user_module_access;
    CREATE POLICY "admin read all module access" ON user_module_access
      FOR SELECT TO authenticated
      USING ((SELECT public.is_admin()));

    DROP POLICY IF EXISTS "admin manage module access" ON user_module_access;
    CREATE POLICY "admin manage module access" ON user_module_access
      FOR ALL TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
END $$;

-- ---------- 4. Políticas: invitation_codes ----------
DROP POLICY IF EXISTS "Solo administradores pueden leer códigos" ON invitation_codes;
CREATE POLICY "Solo administradores pueden leer códigos" ON invitation_codes
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Solo administradores pueden crear códigos" ON invitation_codes;
CREATE POLICY "Solo administradores pueden crear códigos" ON invitation_codes
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Solo administradores pueden actualizar códigos" ON invitation_codes;
CREATE POLICY "Solo administradores pueden actualizar códigos" ON invitation_codes
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Solo administradores pueden eliminar códigos" ON invitation_codes;
CREATE POLICY "Solo administradores pueden eliminar códigos" ON invitation_codes
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- ---------- 5. Funciones de administración ----------
CREATE OR REPLACE FUNCTION suspend_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden suspender usuarios');
  END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND',
      'message', 'El usuario no fue encontrado');
  END IF;

  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_SUSPEND',
      'message', 'No puedes suspender tu propia cuenta');
  END IF;

  -- Fecha lejana en lugar de 'infinity' (el servicio Auth no lo parsea).
  UPDATE auth.users SET banned_until = (now() + interval '100 years') WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario suspendido exitosamente', 'email', target_email);
END;
$$;

CREATE OR REPLACE FUNCTION reactivate_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden reactivar usuarios');
  END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND',
      'message', 'El usuario no fue encontrado');
  END IF;

  UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario reactivado exitosamente', 'email', target_email);
END;
$$;

CREATE OR REPLACE FUNCTION list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden listar usuarios');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'users', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'full_name', COALESCE(u.raw_user_meta_data->>'full_name', ''),
        'role', COALESCE(u.raw_app_meta_data->>'role', 'user'),
        'banned_until', u.banned_until,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at
      ) ORDER BY u.created_at DESC
    ), '[]'::jsonb)
  ) INTO result
  FROM auth.users u;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION set_user_modules(target_user_id UUID, module_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden asignar módulos');
  END IF;

  DELETE FROM user_module_access WHERE user_id = target_user_id;

  IF module_keys IS NOT NULL AND array_length(module_keys, 1) > 0 THEN
    INSERT INTO user_module_access (user_id, module_key, granted_by)
    SELECT target_user_id, k, auth.uid()
    FROM unnest(module_keys) AS k;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------- 6. Nueva RPC: dar / quitar rol de administrador ----------
CREATE OR REPLACE FUNCTION set_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden cambiar roles');
  END IF;

  IF new_role NOT IN ('admin', 'user') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ROLE',
      'message', 'El rol debe ser admin o user');
  END IF;

  IF target_user_id = auth.uid() AND new_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_DEMOTE',
      'message', 'No puedes quitarte tu propio rol de administrador');
  END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND',
      'message', 'El usuario no fue encontrado');
  END IF;

  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
   WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'email', target_email, 'role', new_role);
END;
$$;
