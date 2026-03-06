-- =====================================================
-- FUNCIONES RPC PARA SUSPENSIÓN DE CUENTAS
-- =====================================================
-- Este script crea funciones para suspender y reactivar
-- cuentas de usuario sin eliminar sus datos.
-- Usa el campo nativo `banned_until` de Supabase Auth.
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Copia y pega este script
-- 3. Haz clic en "Run"
-- =====================================================

-- =====================================================
-- FUNCIÓN 1: Suspender usuario
-- =====================================================
-- Establece banned_until = 'infinity' para bloquear
-- el login del usuario de forma indefinida.
-- Solo puede ser ejecutada por administradores.

CREATE OR REPLACE FUNCTION suspend_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_email TEXT;
BEGIN
  -- Verificar que quien llama es admin
  caller_role := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'raw_user_meta_data' ->> 'role'
  );

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden suspender usuarios'
    );
  END IF;

  -- Verificar que el usuario objetivo existe
  SELECT email INTO target_email
  FROM auth.users
  WHERE id = target_user_id;

  IF target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_FOUND',
      'message', 'El usuario no fue encontrado'
    );
  END IF;

  -- Verificar que no se está suspendiendo a sí mismo
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SELF_SUSPEND',
      'message', 'No puedes suspender tu propia cuenta'
    );
  END IF;

  -- Suspender al usuario (banned_until = infinity = suspensión indefinida)
  UPDATE auth.users
  SET banned_until = 'infinity'
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Usuario suspendido exitosamente',
    'email', target_email
  );
END;
$$;

-- =====================================================
-- FUNCIÓN 2: Reactivar usuario
-- =====================================================
-- Establece banned_until = NULL para permitir
-- que el usuario vuelva a iniciar sesión.
-- Solo puede ser ejecutada por administradores.

CREATE OR REPLACE FUNCTION reactivate_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_email TEXT;
BEGIN
  -- Verificar que quien llama es admin
  caller_role := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'raw_user_meta_data' ->> 'role'
  );

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden reactivar usuarios'
    );
  END IF;

  -- Verificar que el usuario objetivo existe
  SELECT email INTO target_email
  FROM auth.users
  WHERE id = target_user_id;

  IF target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_FOUND',
      'message', 'El usuario no fue encontrado'
    );
  END IF;

  -- Reactivar al usuario (quitar la suspensión)
  UPDATE auth.users
  SET banned_until = NULL
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Usuario reactivado exitosamente',
    'email', target_email
  );
END;
$$;

-- =====================================================
-- FUNCIÓN 3: Listar usuarios (para panel de admin)
-- =====================================================
-- Retorna la lista de usuarios con su estado de suspensión.
-- Solo puede ser ejecutada por administradores.

CREATE OR REPLACE FUNCTION list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  result JSONB;
BEGIN
  -- Verificar que quien llama es admin
  caller_role := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'raw_user_meta_data' ->> 'role'
  );

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden listar usuarios'
    );
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'users', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'full_name', COALESCE(u.raw_user_meta_data->>'full_name', ''),
        'role', COALESCE(u.raw_user_meta_data->>'role', 'user'),
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

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que las funciones se crearon correctamente:
--
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE proname IN ('suspend_user', 'reactivate_user');
--
-- Deberías ver ambas funciones con prosecdef = true
-- (indicando SECURITY DEFINER).
--
-- =====================================================
-- USO
-- =====================================================
--
-- Suspender un usuario:
--   SELECT suspend_user('uuid-del-usuario');
--
-- Reactivar un usuario:
--   SELECT reactivate_user('uuid-del-usuario');
--
-- Verificar estado de un usuario:
--   SELECT email, banned_until
--   FROM auth.users
--   WHERE email = 'usuario@ejemplo.com';
--
-- Si banned_until es NULL → cuenta activa
-- Si banned_until tiene fecha → cuenta suspendida
-- =====================================================