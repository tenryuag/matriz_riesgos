-- =====================================================
-- POLÍTICAS RLS PARA CONTROL DE ADMINISTRADORES
-- =====================================================
-- Este script actualiza las políticas de Row Level Security (RLS)
-- para que solo los administradores puedan gestionar códigos de invitación

-- =====================================================
-- PASO 1: Eliminar políticas antiguas
-- =====================================================

DROP POLICY IF EXISTS "Usuarios autenticados pueden leer códigos" ON invitation_codes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear códigos" ON invitation_codes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar códigos" ON invitation_codes;
DROP POLICY IF EXISTS "Permitir validación de códigos para registro" ON invitation_codes;

-- =====================================================
-- PASO 2: Crear políticas solo para ADMINISTRADORES
-- =====================================================

-- Política: Solo administradores pueden leer códigos
CREATE POLICY "Solo administradores pueden leer códigos"
  ON invitation_codes
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'raw_user_meta_data' ->> 'role') = 'admin'
  );

-- Política: Solo administradores pueden crear códigos
CREATE POLICY "Solo administradores pueden crear códigos"
  ON invitation_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'raw_user_meta_data' ->> 'role') = 'admin'
  );

-- Política: Solo administradores pueden actualizar códigos
CREATE POLICY "Solo administradores pueden actualizar códigos"
  ON invitation_codes
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'raw_user_meta_data' ->> 'role') = 'admin'
  );

-- Política: Solo administradores pueden eliminar códigos
CREATE POLICY "Solo administradores pueden eliminar códigos"
  ON invitation_codes
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'raw_user_meta_data' ->> 'role') = 'admin'
  );

-- Política: Usuarios anónimos pueden validar códigos (para registro)
-- IMPORTANTE: Esto es necesario para que el formulario de registro pueda verificar códigos
CREATE POLICY "Permitir validación de códigos para registro"
  ON invitation_codes
  FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- INSTRUCCIONES
-- =====================================================
--
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Copia y pega este script
-- 3. Haz clic en "Run"
--
-- Esto protegerá la tabla invitation_codes para que solo
-- los administradores puedan ver, crear, actualizar y eliminar códigos.
--
-- Los usuarios anónimos aún podrán validar códigos durante el registro.
--
-- =====================================================
-- VERIFICAR POLÍTICAS
-- =====================================================
--
-- Para verificar que las políticas se aplicaron correctamente:
--
-- SELECT * FROM pg_policies WHERE tablename = 'invitation_codes';
--
-- Deberías ver 5 políticas:
-- 1. Solo administradores pueden leer códigos
-- 2. Solo administradores pueden crear códigos
-- 3. Solo administradores pueden actualizar códigos
-- 4. Solo administradores pueden eliminar códigos
-- 5. Permitir validación de códigos para registro (anon)
--
