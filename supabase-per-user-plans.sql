-- ============================================================
-- Migración: Planeación Estratégica y Análisis Financiero POR USUARIO
-- ============================================================
-- Antes: una sola planeación / un solo análisis compartido por toda la
-- organización (cualquier usuario autenticado veía y editaba lo mismo).
-- Ahora: cada cuenta tiene SU propio plan estratégico y SU propio análisis
-- financiero; nadie más los ve. Los administradores tampoco ven los de otros.
--
-- Qué hace:
--   1. Agrega owner_id (con DEFAULT auth.uid()) a strategic_plans y
--      fin_analyses, y asigna los registros existentes a quien los creó.
--   2. Reemplaza las políticas RLS "cualquier autenticado" por políticas
--      "solo el dueño", tanto en las tablas raíz como en sus tablas hijas
--      (respuestas, competidores, iniciativas, años, líneas y cifras).
--
-- La matriz de riesgos NO cambia: sigue siendo compartida por la organización.
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- ============================================================

-- ---------- 1. Columna owner_id + asignación de lo existente ----------
ALTER TABLE strategic_plans ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid();
ALTER TABLE fin_analyses    ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid();

-- Lo que ya existe se queda con quien lo creó (los planes demo del seed
-- sandbox, con su dueño sandbox).
UPDATE strategic_plans SET owner_id = created_by_id WHERE owner_id IS NULL;
UPDATE fin_analyses    SET owner_id = created_by_id WHERE owner_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'strategic_plans' AND column_name = 'sandbox_owner_id') THEN
    UPDATE strategic_plans SET owner_id = sandbox_owner_id WHERE sandbox_owner_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'fin_analyses' AND column_name = 'sandbox_owner_id') THEN
    UPDATE fin_analyses SET owner_id = sandbox_owner_id WHERE sandbox_owner_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS strategic_plans_owner_idx ON strategic_plans (owner_id, created_at);
CREATE INDEX IF NOT EXISTS fin_analyses_owner_idx    ON fin_analyses (owner_id, created_at);

-- ---------- 2. Políticas: solo el dueño ----------

-- strategic_plans
DROP POLICY IF EXISTS "auth read strategic_plans"   ON strategic_plans;
DROP POLICY IF EXISTS "auth insert strategic_plans" ON strategic_plans;
DROP POLICY IF EXISTS "auth update strategic_plans" ON strategic_plans;
DROP POLICY IF EXISTS "owner all strategic_plans"   ON strategic_plans;
CREATE POLICY "owner all strategic_plans" ON strategic_plans
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Tablas hijas del plan: la fila es visible si el plan es del usuario.
DROP POLICY IF EXISTS "auth read plan_answers"  ON plan_answers;
DROP POLICY IF EXISTS "auth write plan_answers" ON plan_answers;
DROP POLICY IF EXISTS "owner all plan_answers"  ON plan_answers;
CREATE POLICY "owner all plan_answers" ON plan_answers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM strategic_plans p WHERE p.id = plan_answers.plan_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM strategic_plans p WHERE p.id = plan_answers.plan_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS "auth read competitors"  ON competitors;
DROP POLICY IF EXISTS "auth write competitors" ON competitors;
DROP POLICY IF EXISTS "owner all competitors"  ON competitors;
CREATE POLICY "owner all competitors" ON competitors
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM strategic_plans p WHERE p.id = competitors.plan_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM strategic_plans p WHERE p.id = competitors.plan_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS "auth read strategic_initiatives"  ON strategic_initiatives;
DROP POLICY IF EXISTS "auth write strategic_initiatives" ON strategic_initiatives;
DROP POLICY IF EXISTS "owner all strategic_initiatives"  ON strategic_initiatives;
CREATE POLICY "owner all strategic_initiatives" ON strategic_initiatives
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM strategic_plans p WHERE p.id = strategic_initiatives.plan_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM strategic_plans p WHERE p.id = strategic_initiatives.plan_id AND p.owner_id = auth.uid()));

-- fin_analyses
DROP POLICY IF EXISTS "auth all fin_analyses"  ON fin_analyses;
DROP POLICY IF EXISTS "owner all fin_analyses" ON fin_analyses;
CREATE POLICY "owner all fin_analyses" ON fin_analyses
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "auth all fin_years"  ON fin_years;
DROP POLICY IF EXISTS "owner all fin_years" ON fin_years;
CREATE POLICY "owner all fin_years" ON fin_years
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fin_analyses a WHERE a.id = fin_years.analysis_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM fin_analyses a WHERE a.id = fin_years.analysis_id AND a.owner_id = auth.uid()));

DROP POLICY IF EXISTS "auth all fin_lines"  ON fin_lines;
DROP POLICY IF EXISTS "owner all fin_lines" ON fin_lines;
CREATE POLICY "owner all fin_lines" ON fin_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fin_analyses a WHERE a.id = fin_lines.analysis_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM fin_analyses a WHERE a.id = fin_lines.analysis_id AND a.owner_id = auth.uid()));

DROP POLICY IF EXISTS "auth all fin_values"  ON fin_values;
DROP POLICY IF EXISTS "owner all fin_values" ON fin_values;
CREATE POLICY "owner all fin_values" ON fin_values
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fin_analyses a WHERE a.id = fin_values.analysis_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM fin_analyses a WHERE a.id = fin_values.analysis_id AND a.owner_id = auth.uid()));

-- Nota: las políticas restrictivas "sandbox visibility" (si corriste el seed)
-- pueden quedarse; en estas dos tablas ya son redundantes y no estorban.
