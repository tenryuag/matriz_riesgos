-- ============================================================
-- Accesos por módulo POR DEFECTO: solo Gestión del Riesgo
-- ============================================================
-- Regla acordada (oct-2026): todo usuario tiene por defecto únicamente el
-- módulo de la Matriz de Riesgos ('risk'); los demás módulos se conceden
-- uno a uno desde Admin → Accesos por módulo. Los administradores ven todo
-- sin necesidad de filas (is_admin()).
--
-- Qué hace:
--   1. Concede 'risk' a todo usuario que no lo tenga (hoy hay usuarios que
--      se registraron después del respaldo inicial y no tienen nada).
--   2. (Opcional, ver §2) retira los módulos distintos de 'risk' a los
--      usuarios NO administradores, para partir de la regla por defecto.
--   3. Disparador: cada usuario NUEVO recibe 'risk' al registrarse.
--
-- Ejecutar en Supabase → SQL Editor (idempotente).
-- ============================================================

-- ---------- 1. Todos con 'risk' ----------
INSERT INTO user_module_access (user_id, module_key)
SELECT u.id, 'risk'
FROM auth.users u
ON CONFLICT (user_id, module_key) DO NOTHING;

-- ---------- 2. Solo 'risk' por defecto para no administradores ----------
-- Retira strategic / fin-analysis / financial a quien no sea admin.
-- Los administradores no necesitan filas: is_admin() les da todo.
-- Si quieres conservar algún acceso concedido a propósito, vuelve a darlo
-- después desde Admin → Accesos por módulo.
DELETE FROM user_module_access a
USING auth.users u
WHERE u.id = a.user_id
  AND a.module_key <> 'risk'
  AND COALESCE(u.raw_app_meta_data->>'role', u.raw_user_meta_data->>'role', 'user') <> 'admin';

-- ---------- 3. Usuarios nuevos: 'risk' automático ----------
CREATE OR REPLACE FUNCTION public.grant_default_module_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_module_access (user_id, module_key)
  VALUES (NEW.id, 'risk')
  ON CONFLICT (user_id, module_key) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_default_module_access() FROM PUBLIC;

DROP TRIGGER IF EXISTS grant_default_module_access ON auth.users;
CREATE TRIGGER grant_default_module_access
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_module_access();

-- ---------- Verificación ----------
-- Debe dar 0:
--   SELECT count(*) FROM auth.users u
--   WHERE NOT EXISTS (SELECT 1 FROM user_module_access a WHERE a.user_id = u.id AND a.module_key = 'risk');
-- Distribución:
--   SELECT module_key, count(*) FROM user_module_access GROUP BY module_key;
