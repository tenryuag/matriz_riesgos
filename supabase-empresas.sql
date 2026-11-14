-- =============================================================================
-- EMPRESAS (multiempresa) — Fase 1: estructura, sin cambios visibles
-- =============================================================================
-- Los datos dejan de pertenecer a un usuario y pasan a pertenecer a su empresa.
--
--   · Cada usuario actual recibe su propia empresa (de una sola persona) y sus
--     datos se le asignan. Nadie ve nada distinto.
--   · Las reglas de seguridad (RLS) pasan de «solo el dueño» a «quien tiene
--     acceso a la empresa». Hoy eso es solo su único miembro; el mentor y los
--     permisos por módulo se agregan después cambiando UNA función
--     (accessible_companies), sin volver a tocar las políticas.
--   · Es compatible con el código que hoy está en producción: un trigger
--     rellena company_id en los registros nuevos.
--
-- Se puede correr más de una vez. Todo va en una transacción: o entra completo
-- o no entra nada. Para deshacer las reglas: supabase-empresas-rollback.sql
-- Ensayar primero en la base local (docs/BD-LOCAL.md).
-- =============================================================================

BEGIN;

-- ── 1. Tablas ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Un usuario pertenece a UNA sola empresa (UNIQUE user_id).
CREATE TABLE IF NOT EXISTS public.company_members (
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id),
  CONSTRAINT company_members_user_id_key UNIQUE (user_id)
);

-- Módulos contratados por la empresa.
CREATE TABLE IF NOT EXISTS public.company_modules (
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key  text NOT NULL,
  granted_by  uuid,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, module_key)
);

ALTER TABLE public.risks           ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.departments     ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.strategic_plans ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.fin_analyses    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS risks_company_id_idx           ON public.risks (company_id);
CREATE INDEX IF NOT EXISTS departments_company_id_idx     ON public.departments (company_id);
CREATE INDEX IF NOT EXISTS strategic_plans_company_id_idx ON public.strategic_plans (company_id);
CREATE INDEX IF NOT EXISTS fin_analyses_company_id_idx    ON public.fin_analyses (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies, public.company_members, public.company_modules
  TO authenticated, service_role;

-- ── 2. Funciones ─────────────────────────────────────────────────────────────

-- Empresa del usuario en sesión.
CREATE OR REPLACE FUNCTION public.my_company_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$;

-- ¿Es administrador de su empresa?
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
     WHERE user_id = auth.uid() AND company_id = p_company AND role = 'admin'
  );
$$;

-- Empresas a las que el usuario en sesión tiene acceso para un módulo.
-- ÚNICO punto de decisión de acceso a datos: todas las políticas pasan por
-- aquí. Hoy: la empresa de la que es miembro. Después se agregan aquí los
-- permisos por módulo (ver / editar) y las empresas asignadas a un mentor.
CREATE OR REPLACE FUNCTION public.accessible_companies(p_module text, p_write boolean)
  RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(company_id), '{}'::uuid[])
    FROM public.company_members
   WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_company_id(), public.is_company_admin(uuid),
  public.accessible_companies(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_company_id(), public.is_company_admin(uuid),
  public.accessible_companies(text, boolean) TO authenticated, service_role;

-- Rellena company_id al insertar cuando no viene (el código actual no lo
-- manda). Toma la empresa de quien inserta; en cargas por SQL (sin sesión),
-- la del dueño del registro.
CREATE OR REPLACE FUNCTION public.set_company_id() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  j   jsonb;
  uid uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    j := to_jsonb(NEW);
    uid := COALESCE(auth.uid(),
                    NULLIF(j->>'owner_id', '')::uuid,
                    NULLIF(j->>'created_by_id', '')::uuid);
    SELECT company_id INTO NEW.company_id
      FROM public.company_members WHERE user_id = uid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_id ON public.risks;
CREATE TRIGGER set_company_id BEFORE INSERT ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
DROP TRIGGER IF EXISTS set_company_id ON public.departments;
CREATE TRIGGER set_company_id BEFORE INSERT ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
DROP TRIGGER IF EXISTS set_company_id ON public.strategic_plans;
CREATE TRIGGER set_company_id BEFORE INSERT ON public.strategic_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
DROP TRIGGER IF EXISTS set_company_id ON public.fin_analyses;
CREATE TRIGGER set_company_id BEFORE INSERT ON public.fin_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- Cada registro nuevo crea su propia empresa, con el usuario como
-- administrador y el módulo de riesgos (igual que hoy). Cuando exista la
-- invitación a una empresa ya creada, aquí se distinguirá ese caso.
CREATE OR REPLACE FUNCTION public.create_company_for_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.companies (name, created_by)
  VALUES (COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email, 'Empresa'), NEW.id)
  RETURNING id INTO cid;
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (cid, NEW.id, 'admin');
  INSERT INTO public.company_modules (company_id, module_key) VALUES (cid, 'risk');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_company_for_new_user ON auth.users;
CREATE TRIGGER create_company_for_new_user AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_company_for_new_user();

-- ── 3. Datos existentes: una empresa por usuario ─────────────────────────────

DO $$
DECLARE
  u   record;
  cid uuid;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data->>'full_name' AS full_name,
           (SELECT NULLIF(trim(f.company_name), '') FROM public.fin_analyses f
             WHERE f.owner_id = au.id ORDER BY f.created_at LIMIT 1) AS fin_name
      FROM auth.users au
     WHERE NOT EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id = au.id)
  LOOP
    INSERT INTO public.companies (name, created_by)
    VALUES (COALESCE(u.fin_name, NULLIF(trim(u.full_name), ''), u.email, 'Empresa'), u.id)
    RETURNING id INTO cid;
    INSERT INTO public.company_members (company_id, user_id, role) VALUES (cid, u.id, 'admin');
  END LOOP;
END $$;

-- Módulos de la empresa = los que hoy tiene su usuario.
INSERT INTO public.company_modules (company_id, module_key, granted_by, granted_at)
SELECT m.company_id, a.module_key, a.granted_by, a.granted_at
  FROM public.user_module_access a
  JOIN public.company_members m ON m.user_id = a.user_id
ON CONFLICT DO NOTHING;

-- Los datos pasan a la empresa de su dueño. (Los registros cuyo dueño ya no
-- existe quedan sin empresa: siguen sin ser visibles para nadie, como hoy.)
UPDATE public.departments d SET company_id = m.company_id
  FROM public.company_members m WHERE m.user_id = d.created_by_id AND d.company_id IS NULL;
UPDATE public.risks r SET company_id = m.company_id
  FROM public.company_members m WHERE m.user_id = r.created_by_id AND r.company_id IS NULL;
UPDATE public.strategic_plans p SET company_id = m.company_id
  FROM public.company_members m WHERE m.user_id = p.owner_id AND p.company_id IS NULL;
UPDATE public.fin_analyses f SET company_id = m.company_id
  FROM public.company_members m WHERE m.user_id = f.owner_id AND f.company_id IS NULL;

-- ── 4. Reglas de seguridad ───────────────────────────────────────────────────

ALTER TABLE public.companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

-- Empresas: las ve quien pertenece a ellas y los administradores de la
-- plataforma. La edita el administrador de la empresa.
DROP POLICY IF EXISTS "empresa: ver" ON public.companies;
CREATE POLICY "empresa: ver" ON public.companies FOR SELECT TO authenticated
  USING (id = (SELECT public.my_company_id()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS "empresa: editar" ON public.companies;
CREATE POLICY "empresa: editar" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_company_admin(id) OR (SELECT public.is_admin()))
  WITH CHECK (public.is_company_admin(id) OR (SELECT public.is_admin()));

-- Miembros y módulos: por ahora solo lectura (propia empresa o admin de la
-- plataforma). Las altas y bajas llegarán con la gestión de usuarios.
DROP POLICY IF EXISTS "miembros: ver" ON public.company_members;
CREATE POLICY "miembros: ver" ON public.company_members FOR SELECT TO authenticated
  USING (company_id = (SELECT public.my_company_id()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS "modulos: ver" ON public.company_modules;
CREATE POLICY "modulos: ver" ON public.company_modules FOR SELECT TO authenticated
  USING (company_id = (SELECT public.my_company_id()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS "modulos: admin plataforma" ON public.company_modules;
CREATE POLICY "modulos: admin plataforma" ON public.company_modules TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- Se retiran las reglas «solo el dueño». Incluye una regla de departments que
-- permitía borrar a cualquier usuario autenticado (USING true).
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.departments;
DROP POLICY IF EXISTS "Enable users to view their own data only" ON public.departments;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar departamentos" ON public.departments;
DROP POLICY IF EXISTS "delete" ON public.departments;
DROP POLICY IF EXISTS "update" ON public.departments;
DROP POLICY IF EXISTS "select" ON public.risks;
DROP POLICY IF EXISTS "insert" ON public.risks;
DROP POLICY IF EXISTS "update" ON public.risks;
DROP POLICY IF EXISTS "delete" ON public.risks;
DROP POLICY IF EXISTS "owner all strategic_plans" ON public.strategic_plans;
DROP POLICY IF EXISTS "owner all plan_answers" ON public.plan_answers;
DROP POLICY IF EXISTS "owner all competitors" ON public.competitors;
DROP POLICY IF EXISTS "owner all strategic_initiatives" ON public.strategic_initiatives;
DROP POLICY IF EXISTS "owner all fin_analyses" ON public.fin_analyses;
DROP POLICY IF EXISTS "owner all fin_lines" ON public.fin_lines;
DROP POLICY IF EXISTS "owner all fin_values" ON public.fin_values;
DROP POLICY IF EXISTS "owner all fin_years" ON public.fin_years;

-- Tablas raíz: leer con acceso de lectura, escribir con acceso de escritura.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('risks', 'risk'), ('departments', 'risk'),
    ('strategic_plans', 'strategic'), ('fin_analyses', 'fin-analysis')
  ) AS x(tbl, module)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "empresa: leer" ON public.%I', t.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "empresa: escribir" ON public.%I', t.tbl);
    EXECUTE format($f$
      CREATE POLICY "empresa: leer" ON public.%I FOR SELECT TO authenticated
        USING (company_id = ANY ((SELECT public.accessible_companies(%L, false))::uuid[]))
    $f$, t.tbl, t.module);
    EXECUTE format($f$
      CREATE POLICY "empresa: escribir" ON public.%I TO authenticated
        USING (company_id = ANY ((SELECT public.accessible_companies(%L, true))::uuid[]))
        WITH CHECK (company_id = ANY ((SELECT public.accessible_companies(%L, true))::uuid[]))
    $f$, t.tbl, t.module, t.module);
  END LOOP;

  -- Tablas hijas: heredan el acceso de su plan o análisis.
  FOR t IN SELECT * FROM (VALUES
    ('plan_answers', 'strategic_plans', 'plan_id', 'strategic'),
    ('competitors', 'strategic_plans', 'plan_id', 'strategic'),
    ('strategic_initiatives', 'strategic_plans', 'plan_id', 'strategic'),
    ('fin_lines', 'fin_analyses', 'analysis_id', 'fin-analysis'),
    ('fin_years', 'fin_analyses', 'analysis_id', 'fin-analysis'),
    ('fin_values', 'fin_analyses', 'analysis_id', 'fin-analysis')
  ) AS x(tbl, parent, fk, module)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "empresa: leer" ON public.%I', t.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "empresa: escribir" ON public.%I', t.tbl);
    EXECUTE format($f$
      CREATE POLICY "empresa: leer" ON public.%1$I FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.%2$I p WHERE p.id = %1$I.%3$I
          AND p.company_id = ANY ((SELECT public.accessible_companies(%4$L, false))::uuid[])))
    $f$, t.tbl, t.parent, t.fk, t.module);
    EXECUTE format($f$
      CREATE POLICY "empresa: escribir" ON public.%1$I TO authenticated
        USING (EXISTS (SELECT 1 FROM public.%2$I p WHERE p.id = %1$I.%3$I
          AND p.company_id = ANY ((SELECT public.accessible_companies(%4$L, true))::uuid[])))
        WITH CHECK (EXISTS (SELECT 1 FROM public.%2$I p WHERE p.id = %1$I.%3$I
          AND p.company_id = ANY ((SELECT public.accessible_companies(%4$L, true))::uuid[])))
    $f$, t.tbl, t.parent, t.fk, t.module);
  END LOOP;
END $$;

COMMIT;
