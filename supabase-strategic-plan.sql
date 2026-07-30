-- ============================================================
-- Modelo de datos: Plan Estratégico (Fase 0.3)
-- ============================================================
-- Guarda el plan estratégico de la organización y las respuestas de los
-- cuestionarios guiados (análisis del cliente, oportunidades, etc.).
--
-- Alcance: al igual que el módulo de riesgos, el plan es a nivel organización
-- (cualquier usuario autenticado puede verlo/editarlo). El acceso a las
-- pantallas ya está limitado por el control de acceso por módulo.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

-- 1. Encabezado del plan (visión, misión, valores, año)
CREATE TABLE IF NOT EXISTS strategic_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT 'Plan estratégico',
  vision        TEXT,
  mission       TEXT,
  core_values   TEXT,
  year          INT,
  created_by_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE strategic_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read strategic_plans" ON strategic_plans;
CREATE POLICY "auth read strategic_plans"
  ON strategic_plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert strategic_plans" ON strategic_plans;
CREATE POLICY "auth insert strategic_plans"
  ON strategic_plans FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth update strategic_plans" ON strategic_plans;
CREATE POLICY "auth update strategic_plans"
  ON strategic_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. Respuestas de los cuestionarios guiados.
--    Una fila por (plan, sección, pregunta). Sirve para el análisis del
--    cliente, el de oportunidades y cualquier otra pantalla tipo cuestionario.
CREATE TABLE IF NOT EXISTS plan_answers (
  plan_id      UUID NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  section      TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer       TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, section, question_key)
);

ALTER TABLE plan_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read plan_answers" ON plan_answers;
CREATE POLICY "auth read plan_answers"
  ON plan_answers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth write plan_answers" ON plan_answers;
CREATE POLICY "auth write plan_answers"
  ON plan_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);
