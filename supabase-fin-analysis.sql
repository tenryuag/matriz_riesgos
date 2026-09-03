-- ============================================================
-- Modelo de datos: Análisis Financiero (sección histórica)
-- ============================================================
-- Basado en docs/Modelo_Simplificado_con_Tableros_Estrategicos.xlsx.
-- Guarda los datos generales de la empresa, los ejercicios (años) a analizar,
-- las líneas de negocio y todas las cifras capturadas (ventas, costos,
-- gastos, estado de resultados, balance y flujos).
--
-- Alcance: a nivel organización, igual que el plan estratégico (cualquier
-- usuario autenticado puede verlo/editarlo). El acceso a las pantallas ya
-- está limitado por el control de acceso por módulo.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

-- 1. Encabezado del análisis (datos generales de la empresa)
CREATE TABLE IF NOT EXISTS fin_analyses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name         TEXT,
  country              TEXT,
  main_activity        TEXT,
  secondary_activities TEXT,
  currency             TEXT NOT NULL DEFAULT 'MXN',
  created_by_id        UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fin_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all fin_analyses" ON fin_analyses;
CREATE POLICY "auth all fin_analyses"
  ON fin_analyses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Ejercicios (años) del análisis. `months` permite periodos parciales
--    (ej. 6 = cifras a junio); las pantallas anualizan con 12/months.
CREATE TABLE IF NOT EXISTS fin_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES fin_analyses(id) ON DELETE CASCADE,
  year        INT NOT NULL,
  months      INT NOT NULL DEFAULT 12 CHECK (months BETWEEN 1 AND 12),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, year)
);

ALTER TABLE fin_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all fin_years" ON fin_years;
CREATE POLICY "auth all fin_years"
  ON fin_years FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Líneas de negocio (dinámicas, como los competidores en Estratégica)
CREATE TABLE IF NOT EXISTS fin_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES fin_analyses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fin_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all fin_lines" ON fin_lines;
CREATE POLICY "auth all fin_lines"
  ON fin_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Cifras capturadas. Una fila por (año, sección, concepto), en miles.
--    Secciones: 'sales' (concepto = id de la línea), 'cost:<line_id>',
--    'expenses', 'income', 'balance', 'cashflow-annex', 'cashflow-direct'.
CREATE TABLE IF NOT EXISTS fin_values (
  analysis_id UUID NOT NULL REFERENCES fin_analyses(id) ON DELETE CASCADE,
  year_id     UUID NOT NULL REFERENCES fin_years(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  concept_key TEXT NOT NULL,
  amount      NUMERIC,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_id, year_id, section, concept_key)
);

ALTER TABLE fin_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all fin_values" ON fin_values;
CREATE POLICY "auth all fin_values"
  ON fin_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
