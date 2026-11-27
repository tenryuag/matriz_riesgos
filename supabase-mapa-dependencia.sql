-- =============================================================================
-- MAPA DE DEPENDENCIA (módulo «dependency») — VIA · Modo Director · Semana 1
-- =============================================================================
-- El empresario registra cinco días laborables en dos listas (bitácora de
-- actividades y decisiones que toma). La app calcula la línea base y el
-- asistente de IA clasifica las actividades y redacta el mapa.
--
--   dep_measurements  una medición (una semana de una persona)
--   dep_activities    bitácora: una fila por actividad o bloque de trabajo
--   dep_decisions     decisiones, autorizaciones o problemas que le llegaron
--   dep_diagnoses     resultado del análisis (lo escribe solo la función `ia`)
--
-- Requiere las tres fases de empresas (supabase-empresas*.sql): los datos son
-- de la EMPRESA y el acceso pasa por accessible_companies('dependency', …),
-- igual que en los demás módulos (permiso ver / editar y modo mentor).
-- Se puede correr más de una vez. Todo va en una transacción.
-- Ensayo en la base local: npm run db:local:mapa   (docs/MAPA-DEPENDENCIA.md)
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.accessible_companies(text, boolean)') IS NULL
     OR to_regprocedure('public.active_company_id()') IS NULL
     OR to_regprocedure('public.log_change()') IS NULL THEN
    RAISE EXCEPTION 'Faltan las migraciones de empresas (supabase-empresas*.sql). Aplícalas antes de este archivo.';
  END IF;
END $$;

-- ── 1. Tablas ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dep_measurements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id),
  owner_id      uuid DEFAULT auth.uid(),
  created_by_id uuid DEFAULT auth.uid(),
  title         text CHECK (title IS NULL OR char_length(title) <= 200),             -- «Semana»
  person_name   text CHECK (person_name IS NULL OR char_length(person_name) <= 200), -- «Nombre»
  job_title     text CHECK (job_title IS NULL OR char_length(job_title) <= 200),     -- «Puesto»
  -- Aclaraciones que acompañan la entrega (p. ej. actividades simultáneas).
  notes         text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  simultaneous  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dep_measurements_company_idx ON public.dep_measurements (company_id, created_at);

-- Bitácora. `minutes` vacío NO es cero: es un dato que falta.
CREATE TABLE IF NOT EXISTS public.dep_activities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.dep_measurements(id) ON DELETE CASCADE,
  activity_date  date,
  description    text CHECK (description IS NULL OR char_length(description) <= 2000),  -- «Actividad específica»
  purpose        text CHECK (purpose IS NULL OR char_length(purpose) <= 2000),          -- «Propósito / resultado buscado»
  minutes        integer CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 1440)),
  position       integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dep_activities_measurement_idx ON public.dep_activities (measurement_id, position);

-- Decisiones que tomas. Los catálogos (tipo de intervención y motivo) viven
-- en src/config/dependencyCalc.js; aquí se guardan sus claves.
CREATE TABLE IF NOT EXISTS public.dep_decisions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.dep_measurements(id) ON DELETE CASCADE,
  decision_date  date,
  requester      text CHECK (requester IS NULL OR char_length(requester) <= 300),       -- «Área / persona que solicita ayuda»
  description    text CHECK (description IS NULL OR char_length(description) <= 2000),  -- «Situación o decisión solicitada»
  intervention   text CHECK (intervention IS NULL OR intervention IN
                   ('autorizar', 'decidir', 'resolver', 'indicar', 'validar', 'desbloquear')),
  reason         text CHECK (reason IS NULL OR reason IN
                   ('conocimiento', 'autoridad', 'proceso', 'temor', 'habito', 'informacion', 'riesgo', 'otro')),
  minutes        integer CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 1440)),
  position       integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dep_decisions_measurement_idx ON public.dep_decisions (measurement_id, position);

-- Diagnóstico de la medición: uno vigente por medición. Lo escribe la función
-- `ia` (service_role) después de comprobar que quien lo pide puede editar el
-- módulo; la app solo lo lee.
--   status          'preguntas'   clasificó y espera las respuestas de validación
--                   'clasificado' listo para redactar
--                   'listo'       mapa terminado
--   input_hash      huella de los registros analizados (si cambian, se avisa)
--   classification  { "<id de la actividad>": "direccion" | "gestion" | "supervision" | "operacion" }
--   questions       [ { pregunta, contexto, respuesta } ]   (máximo tres)
--   result          { linea_base, interpretaciones, mapa }
CREATE TABLE IF NOT EXISTS public.dep_diagnoses (
  measurement_id uuid PRIMARY KEY REFERENCES public.dep_measurements(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('preguntas', 'clasificado', 'listo')),
  input_hash     text NOT NULL,
  classification jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions      jsonb NOT NULL DEFAULT '[]'::jsonb,
  result         jsonb,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_version text,
  model          text,
  cost_usd       numeric(12, 6) NOT NULL DEFAULT 0,
  generated_by   uuid,
  generated_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.dep_measurements, public.dep_activities, public.dep_decisions, public.dep_diagnoses
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dep_measurements, public.dep_activities, public.dep_decisions
  TO authenticated, service_role;
REVOKE ALL ON public.dep_diagnoses FROM authenticated;
GRANT SELECT ON public.dep_diagnoses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dep_diagnoses TO service_role;

-- ── 2. Empresa de cada medición e historial de cambios ───────────────────────

DROP TRIGGER IF EXISTS set_company_id ON public.dep_measurements;
CREATE TRIGGER set_company_id BEFORE INSERT ON public.dep_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('dep_measurements', '', ''),
    ('dep_activities', 'dep_measurements', 'measurement_id'),
    ('dep_decisions', 'dep_measurements', 'measurement_id')
  ) AS x(tbl, parent, fk)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_log_change ON public.%I', t.tbl);
    EXECUTE format('CREATE TRIGGER zz_log_change AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.log_change(%L, %L, %L)',
                   t.tbl, 'dependency', t.parent, t.fk);
  END LOOP;
END $$;

-- Historial de la empresa activa, solo de los módulos que el usuario puede
-- ver. Misma función que en supabase-empresas-mentores.sql, sin la lista fija
-- de módulos: toma los que aparecen en el historial de esa empresa, así un
-- módulo nuevo no obliga a tocarla otra vez.
CREATE OR REPLACE FUNCTION public.company_changes(p_limit integer DEFAULT 200, p_only_mentor boolean DEFAULT false)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cid uuid := public.active_company_id();
BEGIN
  IF cid IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC), '[]'::jsonb)
      FROM (
        SELECT l.id, l.module_key, l.table_name, l.action, l.row_key, l.changes,
               l.actor_role, l.created_at,
               COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), u.email, 'Usuario eliminado') AS actor_name
          FROM public.change_log l
          LEFT JOIN auth.users u ON u.id = l.actor_id
         WHERE l.company_id = cid
           AND (NOT p_only_mentor OR l.actor_role = 'mentor')
           AND l.module_key IN (SELECT m.k
                                  FROM (SELECT DISTINCT c.module_key AS k FROM public.change_log c
                                         WHERE c.company_id = cid) m
                                 WHERE cid = ANY (public.accessible_companies(m.k, false)))
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000)
      ) x);
END;
$$;

-- ── 3. Reglas de seguridad ───────────────────────────────────────────────────

ALTER TABLE public.dep_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dep_activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dep_decisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dep_diagnoses    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa: leer" ON public.dep_measurements;
CREATE POLICY "empresa: leer" ON public.dep_measurements FOR SELECT TO authenticated
  USING (company_id = ANY ((SELECT public.accessible_companies('dependency', false))::uuid[]));
DROP POLICY IF EXISTS "empresa: escribir" ON public.dep_measurements;
CREATE POLICY "empresa: escribir" ON public.dep_measurements TO authenticated
  USING (company_id = ANY ((SELECT public.accessible_companies('dependency', true))::uuid[]))
  WITH CHECK (company_id = ANY ((SELECT public.accessible_companies('dependency', true))::uuid[]));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dep_activities', 'dep_decisions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "empresa: leer" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "empresa: escribir" ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY "empresa: leer" ON public.%1$I FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.dep_measurements p WHERE p.id = %1$I.measurement_id
          AND p.company_id = ANY ((SELECT public.accessible_companies('dependency', false))::uuid[])))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "empresa: escribir" ON public.%1$I TO authenticated
        USING (EXISTS (SELECT 1 FROM public.dep_measurements p WHERE p.id = %1$I.measurement_id
          AND p.company_id = ANY ((SELECT public.accessible_companies('dependency', true))::uuid[])))
        WITH CHECK (EXISTS (SELECT 1 FROM public.dep_measurements p WHERE p.id = %1$I.measurement_id
          AND p.company_id = ANY ((SELECT public.accessible_companies('dependency', true))::uuid[])))
    $f$, t);
  END LOOP;
END $$;

-- El diagnóstico solo se lee (lo escribe la función `ia`).
DROP POLICY IF EXISTS "empresa: leer" ON public.dep_diagnoses;
CREATE POLICY "empresa: leer" ON public.dep_diagnoses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dep_measurements p WHERE p.id = dep_diagnoses.measurement_id
    AND p.company_id = ANY ((SELECT public.accessible_companies('dependency', false))::uuid[])));

COMMIT;

NOTIFY pgrst, 'reload schema';
