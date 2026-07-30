-- ============================================================
-- Control de acceso por MÓDULO (Fase 2)
-- ============================================================
-- Permite que un administrador elija qué usuarios tienen acceso a qué
-- módulos de la app (gestión del riesgo, planeación estratégica,
-- planeación financiera, etc.).
--
-- Modelo: por cada acceso concedido hay una fila (user_id, module_key).
-- Los administradores ven y usan todos los módulos siempre; los usuarios
-- normales solo ven los módulos que se les concedieron aquí.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

-- 1. Tabla de accesos
CREATE TABLE IF NOT EXISTS user_module_access (
  user_id     UUID NOT NULL,
  module_key  TEXT NOT NULL,
  granted_by  UUID,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_user_module_access_user ON user_module_access(user_id);

-- 2. Seguridad por fila (RLS)
ALTER TABLE user_module_access ENABLE ROW LEVEL SECURITY;

-- Helper: rol del que llama (admin o no) desde el JWT.
-- (Se evalúa inline en cada política para no depender de una función extra.)

DROP POLICY IF EXISTS "read own module access" ON user_module_access;
CREATE POLICY "read own module access"
  ON user_module_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin read all module access" ON user_module_access;
CREATE POLICY "admin read all module access"
  ON user_module_access
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'role',
      auth.jwt() -> 'raw_user_meta_data' ->> 'role'
    ) = 'admin'
  );

DROP POLICY IF EXISTS "admin manage module access" ON user_module_access;
CREATE POLICY "admin manage module access"
  ON user_module_access
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'role',
      auth.jwt() -> 'raw_user_meta_data' ->> 'role'
    ) = 'admin'
  )
  WITH CHECK (
    COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'role',
      auth.jwt() -> 'raw_user_meta_data' ->> 'role'
    ) = 'admin'
  );

-- 3. RPC: reemplazar de una vez el conjunto de módulos de un usuario.
--    La usa la pantalla de admin al guardar. Solo administradores.
CREATE OR REPLACE FUNCTION set_user_modules(target_user_id UUID, module_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  caller_role := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'raw_user_meta_data' ->> 'role'
  );

  IF caller_role IS NULL OR caller_role <> 'admin' THEN
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

-- 4. (Opcional pero recomendado) Sembrar el acceso actual para no dejar sin
--    módulos a los usuarios existentes. Concede 'risk' y 'strategic' a todos.
--    Los admins ven todo de cualquier forma; estas filas extra no estorban.
INSERT INTO user_module_access (user_id, module_key)
SELECT u.id, m.key
FROM auth.users u
CROSS JOIN (VALUES ('risk'), ('strategic')) AS m(key)
ON CONFLICT (user_id, module_key) DO NOTHING;
