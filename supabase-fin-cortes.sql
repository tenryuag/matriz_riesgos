-- ============================================================
-- Análisis Financiero: varios CORTES por año (nov-2026).
-- Antes cada año admitía un solo periodo (UNIQUE analysis_id, year), así que
-- al actualizar un parcial (jun → oct) el anterior se perdía. Ahora un año
-- puede tener varios cortes acumulados (jun, oct, cierre de 12 meses) y cada
-- uno conserva sus cifras: la unicidad pasa a (analysis_id, year, months).
-- Es un cambio aditivo: todos los datos existentes siguen siendo válidos y el
-- código anterior sigue funcionando. Idempotente.
-- ============================================================
ALTER TABLE fin_years DROP CONSTRAINT IF EXISTS fin_years_analysis_id_year_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fin_years'::regclass AND conname = 'fin_years_analysis_id_year_months_key'
  ) THEN
    ALTER TABLE fin_years ADD CONSTRAINT fin_years_analysis_id_year_months_key UNIQUE (analysis_id, year, months);
  END IF;
END $$;

-- Verificación: debe listar la nueva restricción y ya no la anterior.
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.fin_years'::regclass AND contype = 'u';
