-- ============================================================
-- Iniciativas estratégicas (Fase 3.4)
-- ============================================================
-- Cada iniciativa pertenece a un objetivo estratégico (una debilidad del
-- mapa calibrado, referida por su id de texto, ej. "opp:liquidez") y lleva
-- su plan de trabajo: área, responsable, fechas, KPI y presupuesto.
--
-- La visión/misión/valores se guardan en strategic_plans (columnas que ya
-- existen desde supabase-strategic-plan.sql).
--
-- Requiere haber corrido antes supabase-strategic-plan.sql.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS strategic_initiatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  strategy_id     TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT '',
  expected_result TEXT,
  area            TEXT,
  owner           TEXT,
  start_date      DATE,
  end_date        DATE,
  budget          NUMERIC,
  kpi             TEXT,
  steps           TEXT,
  position        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategic_initiatives_plan ON strategic_initiatives(plan_id);

ALTER TABLE strategic_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read strategic_initiatives" ON strategic_initiatives;
CREATE POLICY "auth read strategic_initiatives"
  ON strategic_initiatives FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth write strategic_initiatives" ON strategic_initiatives;
CREATE POLICY "auth write strategic_initiatives"
  ON strategic_initiatives FOR ALL TO authenticated USING (true) WITH CHECK (true);
