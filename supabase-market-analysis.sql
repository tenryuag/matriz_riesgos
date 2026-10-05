-- ============================================================
-- Análisis del mercado: competidores (Fase 1.2)
-- ============================================================
-- Tabla de competidores del plan estratégico. Las respuestas de la
-- comparación por competidor se guardan en plan_answers usando la sección
-- "market-comp:<competitor_id>", y las preguntas globales del mercado
-- (Blue Ocean, responsabilidad social propia) en la sección "market".
--
-- Requiere haber corrido antes supabase-strategic-plan.sql.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS competitors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    UUID NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_plan ON competitors(plan_id);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read competitors" ON competitors;
CREATE POLICY "auth read competitors"
  ON competitors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth write competitors" ON competitors;
CREATE POLICY "auth write competitors"
  ON competitors FOR ALL TO authenticated USING (true) WITH CHECK (true);
