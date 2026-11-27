-- =============================================================================
-- EMPRESAS — Fase 3: mentores, administración por empresa e historial de cambios
-- =============================================================================
-- Requiere las fases 1 y 2. Se puede correr más de una vez.
--
--   · Un administrador de la plataforma asigna un mentor a una empresa y elige
--     qué módulos puede ver y editar. Pueden ser mentores los usuarios con rol
--     «mentor» y los administradores.
--   · El acceso nace activo; el administrador de la empresa puede retirarlo y
--     devolverlo cuando quiera.
--   · El mentor trabaja sobre UNA empresa a la vez: la app manda el encabezado
--     `x-company-id` y las reglas de seguridad solo le muestran esa empresa.
--     Sin encabezado, cada quien ve únicamente su propia empresa.
--   · Historial de cambios: quién cambió qué dato y cuándo (miembro o mentor).
-- =============================================================================

BEGIN;

-- ── 1. Asignación de mentores ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_mentors (
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mentor_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modules            text[] NOT NULL DEFAULT '{}',
  active             boolean NOT NULL DEFAULT true,   -- lo controla la empresa
  assigned_by        uuid,
  assigned_at        timestamptz NOT NULL DEFAULT now(),
  access_changed_by  uuid,
  access_changed_at  timestamptz,
  PRIMARY KEY (company_id, mentor_id)
);
CREATE INDEX IF NOT EXISTS company_mentors_mentor_idx ON public.company_mentors (mentor_id);
ALTER TABLE public.company_mentors ENABLE ROW LEVEL SECURITY;   -- solo por funciones
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_mentors TO service_role;

-- ── 2. Empresa activa de la petición ─────────────────────────────────────────

-- Empresa que pide la app en el encabezado x-company-id (o null).
CREATE OR REPLACE FUNCTION public.request_company_id() RETURNS uuid
  LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $$
DECLARE v text;
BEGIN
  v := NULLIF(current_setting('request.headers', true), '')::json->>'x-company-id';
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Módulos que el usuario en sesión puede trabajar como mentor de una empresa
-- (asignación activa, y solo módulos que la empresa tiene).
CREATE OR REPLACE FUNCTION public.mentor_modules(p_company uuid) RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT array_agg(k) FROM public.company_mentors cm, unnest(cm.modules) k
      WHERE cm.company_id = p_company AND cm.mentor_id = auth.uid() AND cm.active
        AND EXISTS (SELECT 1 FROM public.company_modules x
                     WHERE x.company_id = p_company AND x.module_key = k)),
    '{}'::text[]);
$$;

-- Empresa sobre la que se trabaja: la del encabezado si el usuario es su
-- mentor activo; si no, la propia.
CREATE OR REPLACE FUNCTION public.active_company_id() RETURNS uuid
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  own uuid := public.my_company_id();
  req uuid := public.request_company_id();
BEGIN
  IF req IS NOT NULL AND req IS DISTINCT FROM own
     AND cardinality(public.mentor_modules(req)) > 0 THEN
    RETURN req;
  END IF;
  RETURN own;
END;
$$;

-- Único punto de decisión de acceso a datos (ver fases 1 y 2). Ahora:
--   · Con x-company-id de una empresa ajena: solo esa empresa, y solo si el
--     usuario es su mentor activo con ese módulo (ve y edita).
--   · En cualquier otro caso: su propia empresa, según su permiso.
CREATE OR REPLACE FUNCTION public.accessible_companies(p_module text, p_write boolean)
  RETURNS uuid[]
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  own uuid := public.my_company_id();
  req uuid := public.request_company_id();
BEGIN
  IF req IS NOT NULL AND req IS DISTINCT FROM own THEN
    IF p_module = ANY (public.mentor_modules(req)) THEN
      RETURN ARRAY[req];
    END IF;
    RETURN '{}'::uuid[];
  END IF;

  RETURN (
    SELECT COALESCE(array_agg(m.company_id), '{}'::uuid[])
      FROM public.company_members m
     WHERE m.user_id = auth.uid()
       AND (
         public.is_admin()
         OR (
           EXISTS (SELECT 1 FROM public.company_modules cm
                    WHERE cm.company_id = m.company_id AND cm.module_key = p_module)
           AND (
             m.role = 'admin'
             OR EXISTS (SELECT 1 FROM public.user_module_access a
                         WHERE a.user_id = m.user_id AND a.module_key = p_module
                           AND (NOT p_write OR a.level = 'edit'))
           )
         )
       )
  );
END;
$$;

-- Los registros nuevos se guardan en la empresa activa (la del cliente cuando
-- quien captura es su mentor).
CREATE OR REPLACE FUNCTION public.set_company_id() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  j   jsonb;
  uid uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.company_id := public.active_company_id();
    ELSE
      j := to_jsonb(NEW);
      uid := COALESCE(NULLIF(j->>'owner_id', '')::uuid, NULLIF(j->>'created_by_id', '')::uuid);
      SELECT company_id INTO NEW.company_id FROM public.company_members WHERE user_id = uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.request_company_id(), public.mentor_modules(uuid), public.active_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_company_id(), public.mentor_modules(uuid), public.active_company_id()
  TO authenticated, service_role;

-- ── 3. Historial de cambios ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.change_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key  text NOT NULL,
  table_name  text NOT NULL,
  action      text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  row_key     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- qué registro (sección, concepto, año, nombre…)
  changes     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- update: { campo: {old, new} }; alta/baja: los valores
  actor_id    uuid,
  actor_role  text NOT NULL DEFAULT 'member' CHECK (actor_role IN ('member', 'mentor')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS change_log_company_idx ON public.change_log (company_id, created_at DESC);
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;   -- se lee con company_changes()
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_log TO service_role;

-- Trigger genérico. Argumentos: módulo, tabla padre y columna que apunta a
-- ella (vacíos en las tablas raíz). Nunca bloquea el guardado: si el registro
-- del cambio falla, el dato se guarda igual.
CREATE OR REPLACE FUNCTION public.log_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  uid   uuid := auth.uid();
  o     jsonb;
  n     jsonb;
  r     jsonb;
  cid   uuid;
  diff  jsonb;
  rk    jsonb;
  yr    record;
  skip  text[] := ARRAY['updated_at', 'updated_date', 'created_at', 'created_date', 'company_id',
                        'created_by_id', 'owner_id', 'id', 'analysis_id', 'plan_id', 'year_id', 'department_id'];
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;   -- cargas por SQL o del servidor
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  r := COALESCE(n, o);

  IF COALESCE(TG_ARGV[1], '') = '' THEN
    cid := NULLIF(r->>'company_id', '')::uuid;
  ELSE
    EXECUTE format('SELECT company_id FROM public.%I WHERE id = $1', TG_ARGV[1])
       INTO cid USING (r->>TG_ARGV[2])::uuid;
  END IF;
  IF cid IS NULL THEN RETURN NULL; END IF;   -- p. ej. borrado en cascada del padre

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(k, jsonb_build_object('old', o->k, 'new', n->k)) INTO diff
      FROM jsonb_object_keys(n) k
     WHERE NULLIF(o->>k, '') IS DISTINCT FROM NULLIF(n->>k, '') AND NOT (k = ANY (skip));
    IF diff IS NULL THEN RETURN NULL; END IF;   -- guardado sin cambios reales
  ELSE
    -- Las pantallas guardan también las celdas vacías: una cifra o respuesta
    -- en blanco que se crea o se borra no es un cambio que valga registrar.
    IF (TG_TABLE_NAME = 'fin_values' AND r->>'amount' IS NULL)
       OR (TG_TABLE_NAME = 'plan_answers' AND NULLIF(trim(r->>'answer'), '') IS NULL) THEN
      RETURN NULL;
    END IF;
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) INTO diff
      FROM jsonb_each(jsonb_strip_nulls(r)) e WHERE NOT (e.key = ANY (skip));
  END IF;

  rk := jsonb_strip_nulls(jsonb_build_object(
    'id', r->'id', 'section', r->'section',
    'concept_key', r->'concept_key', 'question_key', r->'question_key',
    'label', COALESCE(r->>'name', NULLIF(r->>'title', ''), left(r->>'description', 90)),
    'year', r->'year', 'months', r->'months'));
  IF r ? 'year_id' THEN
    SELECT year, months INTO yr FROM public.fin_years WHERE id = (r->>'year_id')::uuid;
    IF FOUND THEN rk := rk || jsonb_build_object('year', yr.year, 'months', yr.months); END IF;
  END IF;

  INSERT INTO public.change_log (company_id, module_key, table_name, action, row_key, changes, actor_id, actor_role)
  VALUES (cid, TG_ARGV[0], TG_TABLE_NAME, lower(TG_OP), rk, diff, uid,
          CASE WHEN EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id = uid AND m.company_id = cid)
               THEN 'member' ELSE 'mentor' END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_change(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('risks', 'risk', '', ''), ('departments', 'risk', '', ''),
    ('strategic_plans', 'strategic', '', ''), ('fin_analyses', 'fin-analysis', '', ''),
    ('plan_answers', 'strategic', 'strategic_plans', 'plan_id'),
    ('competitors', 'strategic', 'strategic_plans', 'plan_id'),
    ('strategic_initiatives', 'strategic', 'strategic_plans', 'plan_id'),
    ('fin_lines', 'fin-analysis', 'fin_analyses', 'analysis_id'),
    ('fin_years', 'fin-analysis', 'fin_analyses', 'analysis_id'),
    ('fin_values', 'fin-analysis', 'fin_analyses', 'analysis_id')
  ) AS x(tbl, module, parent, fk)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_log_change ON public.%I', t.tbl);
    EXECUTE format('CREATE TRIGGER zz_log_change AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.log_change(%L, %L, %L)',
                   t.tbl, t.module, t.parent, t.fk);
  END LOOP;
END $$;

-- Historial de la empresa activa, solo de los módulos que el usuario puede ver.
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
           -- Módulos que aparecen en el historial de la empresa (sin lista fija:
           -- un módulo nuevo no obliga a tocar esta función).
           AND l.module_key IN (SELECT m.k
                                  FROM (SELECT DISTINCT c.module_key AS k FROM public.change_log c
                                         WHERE c.company_id = cid) m
                                 WHERE cid = ANY (public.accessible_companies(m.k, false)))
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000)
      ) x);
END;
$$;

-- ── 4. Lo que usa el mentor y la empresa ─────────────────────────────────────

-- Empresas que acompaño como mentor.
CREATE OR REPLACE FUNCTION public.mentor_companies() RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', c.id, 'name', c.name, 'active', cm.active,
           'modules', (SELECT COALESCE(jsonb_agg(k), '[]'::jsonb) FROM unnest(cm.modules) k
                        WHERE EXISTS (SELECT 1 FROM public.company_modules x
                                       WHERE x.company_id = c.id AND x.module_key = k))
         ) ORDER BY c.name), '[]'::jsonb)
    FROM public.company_mentors cm JOIN public.companies c ON c.id = cm.company_id
   WHERE cm.mentor_id = auth.uid();
$$;

-- El administrador de la empresa retira o devuelve el acceso a su mentor.
CREATE OR REPLACE FUNCTION public.company_set_mentor_access(p_mentor uuid, p_active boolean) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cid uuid := public.my_company_id();
BEGIN
  IF cid IS NULL OR NOT public.is_company_admin(cid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo el administrador de la empresa puede cambiar el acceso del mentor');
  END IF;
  UPDATE public.company_mentors
     SET active = COALESCE(p_active, false), access_changed_by = auth.uid(), access_changed_at = now()
   WHERE company_id = cid AND mentor_id = p_mentor;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Ese mentor no está asignado a tu empresa');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- company_team(): ahora también devuelve los mentores de la empresa.
CREATE OR REPLACE FUNCTION public.company_team() RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid := public.my_company_id();
  adm boolean;
BEGIN
  IF cid IS NULL THEN RETURN jsonb_build_object('company', NULL); END IF;
  adm := public.is_company_admin(cid);
  RETURN jsonb_build_object(
    'company', (SELECT to_jsonb(c) - 'created_by' - 'created_at' FROM public.companies c WHERE c.id = cid),
    'is_admin', adm,
    'modules', (SELECT COALESCE(jsonb_agg(module_key ORDER BY module_key), '[]'::jsonb)
                  FROM public.company_modules WHERE company_id = cid),
    'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'user_id', m.user_id,
                    'email', u.email,
                    'full_name', COALESCE(u.raw_user_meta_data->>'full_name', ''),
                    'role', m.role,
                    'is_me', m.user_id = auth.uid(),
                    'last_sign_in_at', u.last_sign_in_at,
                    'modules', (SELECT COALESCE(jsonb_object_agg(a.module_key, a.level), '{}'::jsonb)
                                  FROM public.user_module_access a
                                  JOIN public.company_modules cm ON cm.company_id = cid AND cm.module_key = a.module_key
                                 WHERE a.user_id = m.user_id)
                  ) ORDER BY (m.role = 'admin') DESC, m.created_at), '[]'::jsonb)
                  FROM public.company_members m JOIN auth.users u ON u.id = m.user_id
                 WHERE m.company_id = cid),
    'mentors', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'mentor_id', cm.mentor_id,
                    'email', u.email,
                    'full_name', COALESCE(u.raw_user_meta_data->>'full_name', ''),
                    'active', cm.active,
                    'modules', (SELECT COALESCE(jsonb_agg(k), '[]'::jsonb) FROM unnest(cm.modules) k
                                 WHERE EXISTS (SELECT 1 FROM public.company_modules x
                                                WHERE x.company_id = cid AND x.module_key = k))
                  ) ORDER BY cm.assigned_at), '[]'::jsonb)
                  FROM public.company_mentors cm JOIN auth.users u ON u.id = cm.mentor_id
                 WHERE cm.company_id = cid),
    'invitations', CASE WHEN adm THEN
                  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'id', i.id, 'email', i.email, 'role', i.role, 'modules', i.modules,
                      'token', i.token, 'expires_at', i.expires_at, 'expired', i.expires_at <= now()
                    ) ORDER BY i.created_at DESC), '[]'::jsonb)
                    FROM public.company_invitations i
                   WHERE i.company_id = cid AND i.accepted_at IS NULL)
                ELSE '[]'::jsonb END);
END;
$$;

-- Registro raíz del módulo (plan estratégico / análisis financiero) de la
-- empresa activa: lo devuelve y, si la empresa aún no lo tiene, lo crea vacío.
-- Basta con poder VER el módulo: así quien tiene «solo ver» encuentra el
-- módulo vacío en lugar de un error. Crear el contenedor no es editar datos.
CREATE OR REPLACE FUNCTION public.ensure_module_root(p_module text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid := public.active_company_id();
  rid uuid;
BEGIN
  IF cid IS NULL OR NOT (cid = ANY (public.accessible_companies(p_module, false))) THEN
    RETURN NULL;
  END IF;
  IF p_module = 'strategic' THEN
    SELECT id INTO rid FROM public.strategic_plans WHERE company_id = cid ORDER BY created_at LIMIT 1;
    IF rid IS NULL THEN
      INSERT INTO public.strategic_plans (company_id, owner_id, created_by_id)
      VALUES (cid, auth.uid(), auth.uid()) RETURNING id INTO rid;
    END IF;
  ELSIF p_module = 'fin-analysis' THEN
    SELECT id INTO rid FROM public.fin_analyses WHERE company_id = cid ORDER BY created_at LIMIT 1;
    IF rid IS NULL THEN
      INSERT INTO public.fin_analyses (company_id, owner_id, created_by_id)
      VALUES (cid, auth.uid(), auth.uid()) RETURNING id INTO rid;
    END IF;
  END IF;
  RETURN rid;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_module_root(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_module_root(text) TO authenticated;

-- ── 5. Administración de la plataforma ───────────────────────────────────────

-- Roles: se agrega «mentor».
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden cambiar roles');
  END IF;
  IF new_role NOT IN ('admin', 'mentor', 'user') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ROLE',
      'message', 'El rol debe ser admin, mentor o user');
  END IF;
  IF target_user_id = auth.uid() AND new_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_DEMOTE',
      'message', 'No puedes quitarte tu propio rol de administrador');
  END IF;
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND',
      'message', 'El usuario no fue encontrado');
  END IF;

  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
   WHERE id = target_user_id;
  -- Quien deja de ser mentor o admin pierde sus empresas asignadas.
  IF new_role = 'user' THEN
    DELETE FROM public.company_mentors WHERE mentor_id = target_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'email', target_email, 'role', new_role);
END;
$$;

-- Empresas con su gente, módulos y mentores; y quiénes pueden ser mentores.
CREATE OR REPLACE FUNCTION public.admin_companies() RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Solo administradores');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'companies', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'created_at', c.created_at,
        'industry', c.industry, 'size', c.size,
        'contact_name', c.contact_name, 'contact_title', c.contact_title,
        'contact_phone', c.contact_phone, 'contact_email', c.contact_email,
        'modules', (SELECT COALESCE(jsonb_agg(module_key ORDER BY module_key), '[]'::jsonb)
                      FROM public.company_modules WHERE company_id = c.id),
        'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'user_id', m.user_id, 'email', u.email, 'role', m.role,
                        'full_name', COALESCE(u.raw_user_meta_data->>'full_name', '')
                      ) ORDER BY (m.role = 'admin') DESC, m.created_at), '[]'::jsonb)
                      FROM public.company_members m JOIN auth.users u ON u.id = m.user_id
                     WHERE m.company_id = c.id),
        'mentors', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'mentor_id', cm.mentor_id, 'email', u.email, 'active', cm.active,
                        'full_name', COALESCE(u.raw_user_meta_data->>'full_name', ''),
                        'modules', to_jsonb(cm.modules)
                      ) ORDER BY cm.assigned_at), '[]'::jsonb)
                      FROM public.company_mentors cm JOIN auth.users u ON u.id = cm.mentor_id
                     WHERE cm.company_id = c.id)
      ) ORDER BY lower(c.name)), '[]'::jsonb) FROM public.companies c),
    'mentors', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email, 'role', u.raw_app_meta_data->>'role',
        'full_name', COALESCE(u.raw_user_meta_data->>'full_name', '')
      ) ORDER BY lower(COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), u.email))), '[]'::jsonb)
      FROM auth.users u WHERE u.raw_app_meta_data->>'role' IN ('admin', 'mentor')));
END;
$$;

-- Módulos contratados por la empresa. Lo que se quita lo pierden sus miembros
-- y sus mentores.
CREATE OR REPLACE FUNCTION public.admin_set_company_modules(p_company uuid, p_modules text[]) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE keys text[] := COALESCE(p_modules, '{}'::text[]);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Solo administradores');
  END IF;
  DELETE FROM public.company_modules WHERE company_id = p_company AND NOT (module_key = ANY (keys));
  INSERT INTO public.company_modules (company_id, module_key, granted_by)
  SELECT p_company, k, auth.uid() FROM unnest(keys) k ON CONFLICT DO NOTHING;
  DELETE FROM public.user_module_access a USING public.company_members m
   WHERE m.company_id = p_company AND a.user_id = m.user_id AND NOT (a.module_key = ANY (keys));
  -- Compatibilidad con la app anterior, que lee el acceso por usuario: los
  -- administradores de la empresa conservan su fila por módulo.
  INSERT INTO public.user_module_access (user_id, module_key, granted_by)
  SELECT m.user_id, k, auth.uid() FROM public.company_members m, unnest(keys) k
   WHERE m.company_id = p_company AND m.role = 'admin'
  ON CONFLICT (user_id, module_key) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Asigna (o actualiza) un mentor en una empresa con los módulos indicados.
-- Sin módulos, quita la asignación.
CREATE OR REPLACE FUNCTION public.admin_set_company_mentor(p_company uuid, p_mentor uuid, p_modules text[]) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE keys text[] := COALESCE(p_modules, '{}'::text[]);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Solo administradores');
  END IF;
  IF cardinality(keys) = 0 THEN
    DELETE FROM public.company_mentors WHERE company_id = p_company AND mentor_id = p_mentor;
    RETURN jsonb_build_object('success', true, 'removed', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_mentor
                    AND u.raw_app_meta_data->>'role' IN ('admin', 'mentor')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_MENTOR',
      'message', 'Esa persona no tiene rol de mentor ni de administrador');
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = p_company AND user_id = p_mentor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'IS_MEMBER',
      'message', 'Esa persona ya es parte de la empresa; no necesita ser su mentor');
  END IF;
  INSERT INTO public.company_mentors (company_id, mentor_id, modules, assigned_by)
  VALUES (p_company, p_mentor, keys, auth.uid())
  ON CONFLICT (company_id, mentor_id) DO UPDATE SET modules = EXCLUDED.modules;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.company_changes(integer, boolean), public.mentor_companies(),
  public.company_set_mentor_access(uuid, boolean), public.admin_companies(),
  public.admin_set_company_modules(uuid, text[]), public.admin_set_company_mentor(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_changes(integer, boolean), public.mentor_companies(),
  public.company_set_mentor_access(uuid, boolean), public.admin_companies(),
  public.admin_set_company_modules(uuid, text[]), public.admin_set_company_mentor(uuid, uuid, text[]) TO authenticated;

-- ── 7. Asistente de IA por empresa ───────────────────────────────────────────
-- Los resultados guardados del asistente eran uno por usuario y tipo. Un
-- mentor trabaja sobre varias empresas, así que pasan a ser uno por usuario,
-- EMPRESA y tipo, y cada quien solo lee el de la empresa en la que está
-- trabajando (la suya o, en modo mentor, la del cliente).
--
-- La función `ia` nueva entiende la tabla de antes y la de ahora; la anterior
-- no puede guardar con la restricción nueva. Por eso la función se despliega
-- ANTES de correr este archivo.
DO $$
BEGIN
  IF to_regclass('public.ia_resultados') IS NULL THEN RETURN; END IF;

  ALTER TABLE public.ia_resultados
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

  UPDATE public.ia_resultados r SET company_id = m.company_id
    FROM public.company_members m
   WHERE m.user_id = r.user_id AND r.company_id IS NULL;

  ALTER TABLE public.ia_resultados DROP CONSTRAINT IF EXISTS ia_resultados_user_id_kind_key;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ia_resultados_user_company_kind_key') THEN
    ALTER TABLE public.ia_resultados
      ADD CONSTRAINT ia_resultados_user_company_kind_key UNIQUE NULLS NOT DISTINCT (user_id, company_id, kind);
  END IF;

  DROP POLICY IF EXISTS "read own ia results" ON public.ia_resultados;
  CREATE POLICY "read own ia results" ON public.ia_resultados FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid())
           AND company_id IS NOT DISTINCT FROM (SELECT public.active_company_id()));
END $$;

COMMIT;
