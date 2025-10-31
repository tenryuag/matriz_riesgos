-- =====================================================
-- TABLA DE CÓDIGOS DE INVITACIÓN
-- =====================================================
-- Esta tabla almacena los códigos de invitación que se
-- generan manualmente después de confirmar pagos.
-- Los usuarios necesitan un código válido para registrarse.

CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email TEXT,  -- opcional: vincular código a un email específico
  used BOOLEAN DEFAULT FALSE,
  used_by_id UUID,  -- ID del usuario que usó el código (sin foreign key para evitar problemas de timing)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by_id UUID,  -- ID del admin que creó el código (sin foreign key)
  notes TEXT  -- para guardar notas sobre el cliente/pago
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_used ON invitation_codes(used);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_email ON invitation_codes(email);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_used_by_id ON invitation_codes(used_by_id);

-- =====================================================
-- INSTRUCCIONES DE INSTALACIÓN
-- =====================================================
--
-- 1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
-- 2. Selecciona tu proyecto "matriz_riesgos"
-- 3. Ve a la sección "SQL Editor" en el menú lateral
-- 4. Crea una nueva query
-- 5. Copia y pega todo este contenido
-- 6. Haz clic en "Run" para ejecutar
--
-- =====================================================
-- CONFIGURACIÓN DE POLÍTICAS RLS (Row Level Security)
-- =====================================================
-- Habilitar RLS en la tabla
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden leer todos los códigos (para admin)
CREATE POLICY "Usuarios autenticados pueden leer códigos"
  ON invitation_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Solo usuarios autenticados pueden crear códigos (admin)
CREATE POLICY "Usuarios autenticados pueden crear códigos"
  ON invitation_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Usuarios autenticados pueden actualizar códigos
CREATE POLICY "Usuarios autenticados pueden actualizar códigos"
  ON invitation_codes
  FOR UPDATE
  TO authenticated
  USING (true);

-- Política: Usuarios NO autenticados pueden validar códigos (para registro)
-- Esto es necesario para que el formulario de registro pueda verificar el código
CREATE POLICY "Permitir validación de códigos para registro"
  ON invitation_codes
  FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- FUNCIÓN PARA VALIDAR Y USAR UN CÓDIGO
-- =====================================================
CREATE OR REPLACE FUNCTION validate_and_use_invitation_code(
  code_to_validate TEXT,
  user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record RECORD;
  result JSONB;
BEGIN
  -- Buscar el código
  SELECT * INTO code_record
  FROM invitation_codes
  WHERE code = code_to_validate
  LIMIT 1;

  -- Verificar si existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'INVALID_CODE',
      'message', 'El código de invitación no existe'
    );
  END IF;

  -- Verificar si ya fue usado
  IF code_record.used THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'CODE_ALREADY_USED',
      'message', 'Este código ya fue utilizado'
    );
  END IF;

  -- Verificar si está expirado
  IF code_record.expires_at IS NOT NULL AND code_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'CODE_EXPIRED',
      'message', 'Este código ha expirado'
    );
  END IF;

  -- Verificar si está vinculado a un email específico
  IF code_record.email IS NOT NULL AND user_email IS NOT NULL AND code_record.email != user_email THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'EMAIL_MISMATCH',
      'message', 'Este código está reservado para otro usuario'
    );
  END IF;

  -- Todo válido
  RETURN jsonb_build_object(
    'valid', true,
    'code_id', code_record.id,
    'message', 'Código válido'
  );
END;
$$;

-- =====================================================
-- FUNCIÓN PARA MARCAR UN CÓDIGO COMO USADO
-- =====================================================
CREATE OR REPLACE FUNCTION mark_invitation_code_used(
  code_to_mark TEXT,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE invitation_codes
  SET used = true,
      used_by_id = user_id
  WHERE code = code_to_mark
    AND used = false;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- FUNCIÓN PARA GENERAR UN CÓDIGO ALEATORIO
-- =====================================================
CREATE OR REPLACE FUNCTION generate_random_code(length INT DEFAULT 12)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin O, 0, I, 1 para evitar confusión
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;

  -- Formatear como XXXX-XXXX-XXXX
  IF length = 12 THEN
    result := substr(result, 1, 4) || '-' || substr(result, 5, 4) || '-' || substr(result, 9, 4);
  END IF;

  RETURN result;
END;
$$;

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL - COMENTADO)
-- =====================================================
-- Descomenta las siguientes líneas si quieres crear códigos de prueba

-- INSERT INTO invitation_codes (code, notes)
-- VALUES
--   (generate_random_code(), 'Código de prueba 1'),
--   (generate_random_code(), 'Código de prueba 2'),
--   (generate_random_code(), 'Código de prueba 3');

-- Crear un código específico para pruebas (descomenta para usar)
-- INSERT INTO invitation_codes (code, notes)
-- VALUES ('TEST-CODE-2024', 'Código de prueba para desarrollo');
