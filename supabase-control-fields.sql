-- ============================================
-- Migración: Agregar campos de Tipo de Control y Grado de Control
-- Fecha: 2026-03-09
-- Descripción: Agrega 7 columnas por cada mitigante (×3 = 21 columnas)
--   - control_type_N: Tipo de Control (Preventivo/Correctivo/Detectivo)
--   - control_documented_N: ¿Control documentado? (Sí/No)
--   - process_type_N: Tipo de procesos (Manual/Automatizado/Combinado)
--   - control_evidence_N: ¿Genera evidencia auditable? (Sí/No)
--   - control_responsible_N: ¿Tiene responsable? (Sí/No)
--   - control_frequency_N: ¿Se ejecuta con frecuencia? (Sí/No)
--   - control_grade_N: Grado de Control (Fuerte/Medio/Débil) — calculado en frontend
-- ============================================

-- Mitigante 1
ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_type_1 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_documented_1 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS process_type_1 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_evidence_1 TEXT;

ALTER TABLE risks
ADD COLUMN IF NOT EXISTS control_responsible_1 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_frequency_1 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_grade_1 TEXT;

-- Mitigante 2
ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_type_2 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_documented_2 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS process_type_2 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_evidence_2 TEXT;

ALTER TABLE risks
ADD COLUMN IF NOT EXISTS control_responsible_2 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_frequency_2 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_grade_2 TEXT;

-- Mitigante 3
ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_type_3 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_documented_3 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS process_type_3 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_evidence_3 TEXT;

ALTER TABLE risks
ADD COLUMN IF NOT EXISTS control_responsible_3 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_frequency_3 TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS control_grade_3 TEXT;