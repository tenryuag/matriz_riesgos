-- ============================================================================
-- Genera supabase-seed-staging.sql a partir de la base LOCAL.
-- Lo corre `npm run db:staging:exportar` (scripts/bd-staging.sh); no se
-- ejecuta a mano ni contra una base hospedada. Solo lee: todo lo que crea son
-- tablas temporales de la sesión.
--
-- Qué arma:
--   · Las cuentas demo (demo.*@example.com) con sus empresas, permisos,
--     invitaciones y mentores, tal como están en la base local.
--   · El contenido de ejemplo de los tres módulos: se toma de la empresa
--     :origen (la que tiene los datos de «Metalmecánica del Bajío») y se
--     reasigna a la empresa de demo.admin@example.com.
-- Ningún identificador de usuarios o empresas reales llega al archivo: al
-- final se revisa y, si aparece alguno, la exportación se cancela.
-- ============================================================================
\set ON_ERROR_STOP on
\if :{?origen}
\else
  \set origen 'Metalmecánica del Bajío, S.A. de C.V.'
\endif

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Quiénes y qué empresas forman la demostración
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _u ON COMMIT DROP AS
  SELECT id, email, created_at,
         raw_app_meta_data AS app,
         raw_user_meta_data - 'invite_token' AS meta
    FROM auth.users WHERE email LIKE 'demo.%@example.com';

CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT DISTINCT company_id AS id FROM public.company_members WHERE user_id IN (SELECT id FROM _u);

CREATE TEMP TABLE _dst ON COMMIT DROP AS
  SELECT u.id AS uid, m.company_id AS cid
    FROM auth.users u JOIN public.company_members m ON m.user_id = u.id
   WHERE u.email = 'demo.admin@example.com';

CREATE TEMP TABLE _src ON COMMIT DROP AS
  SELECT c.id AS cid, c.name, c.created_by AS uid FROM public.companies c WHERE c.name = :'origen';

DO $$
BEGIN
  IF (SELECT count(*) FROM _u) = 0 THEN RAISE EXCEPTION 'No hay cuentas demo.*@example.com en la base local'; END IF;
  IF (SELECT count(*) FROM _dst) <> 1 THEN RAISE EXCEPTION 'Falta demo.admin@example.com o no tiene empresa'; END IF;
  IF (SELECT count(*) FROM _src) <> 1 THEN RAISE EXCEPTION 'No hay exactamente una empresa de origen con ese nombre'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_members
              WHERE company_id IN (SELECT id FROM _c) AND user_id NOT IN (SELECT id FROM _u)) THEN
    RAISE EXCEPTION 'Una empresa demo tiene miembros que no son cuentas demo';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Copias de trabajo (lo que se escribirá en el archivo)
-- ---------------------------------------------------------------------------
-- Empresas, equipo y permisos: de las cuentas demo.
CREATE TEMP TABLE _companies ON COMMIT DROP AS
  SELECT * FROM public.companies WHERE id IN (SELECT id FROM _c);
UPDATE _companies SET name = (SELECT name FROM _src), industry = 'Manufactura metalmecánica', size = '51-250',
       contact_title = 'Director General', contact_phone = '477 555 0142'
 WHERE id = (SELECT cid FROM _dst);
UPDATE _companies SET industry = 'Consultoría de negocios', size = '1-10', contact_title = 'Consultora'
 WHERE name = 'Consultoría Marta Ruiz';

CREATE TEMP TABLE _company_members ON COMMIT DROP AS
  SELECT * FROM public.company_members WHERE company_id IN (SELECT id FROM _c);
CREATE TEMP TABLE _company_modules ON COMMIT DROP AS
  SELECT * FROM public.company_modules WHERE company_id IN (SELECT id FROM _c);
CREATE TEMP TABLE _company_invitations ON COMMIT DROP AS
  SELECT * FROM public.company_invitations WHERE company_id IN (SELECT id FROM _c);
CREATE TEMP TABLE _company_mentors ON COMMIT DROP AS
  SELECT * FROM public.company_mentors
   WHERE company_id IN (SELECT id FROM _c) AND mentor_id IN (SELECT id FROM _u);
CREATE TEMP TABLE _user_module_access ON COMMIT DROP AS
  SELECT * FROM public.user_module_access WHERE user_id IN (SELECT id FROM _u);

-- Quién concedió o asignó: si no es una cuenta demo, se deja vacío.
UPDATE _company_modules     SET granted_by = NULL WHERE granted_by NOT IN (SELECT id FROM _u);
UPDATE _user_module_access  SET granted_by = NULL WHERE granted_by NOT IN (SELECT id FROM _u);
UPDATE _company_invitations SET invited_by = NULL WHERE invited_by NOT IN (SELECT id FROM _u);
UPDATE _company_invitations SET accepted_by = NULL WHERE accepted_by NOT IN (SELECT id FROM _u);
UPDATE _company_mentors     SET assigned_by = NULL WHERE assigned_by NOT IN (SELECT id FROM _u);
UPDATE _company_mentors     SET access_changed_by = NULL WHERE access_changed_by NOT IN (SELECT id FROM _u);

-- Contenido de los módulos: de la empresa de origen, reasignado a la demo.
CREATE TEMP TABLE _departments ON COMMIT DROP AS
  SELECT * FROM public.departments WHERE company_id = (SELECT cid FROM _src);
UPDATE _departments SET company_id = (SELECT cid FROM _dst), created_by_id = (SELECT uid FROM _dst);

CREATE TEMP TABLE _risks ON COMMIT DROP AS
  SELECT * FROM public.risks WHERE company_id = (SELECT cid FROM _src);
UPDATE _risks SET company_id = (SELECT cid FROM _dst), created_by_id = (SELECT uid FROM _dst);

CREATE TEMP TABLE _strategic_plans ON COMMIT DROP AS
  SELECT * FROM public.strategic_plans WHERE company_id = (SELECT cid FROM _src);
UPDATE _strategic_plans SET company_id = (SELECT cid FROM _dst), owner_id = (SELECT uid FROM _dst),
       created_by_id = (SELECT uid FROM _dst);
CREATE TEMP TABLE _competitors ON COMMIT DROP AS
  SELECT * FROM public.competitors WHERE plan_id IN (SELECT id FROM _strategic_plans);
CREATE TEMP TABLE _plan_answers ON COMMIT DROP AS
  SELECT * FROM public.plan_answers WHERE plan_id IN (SELECT id FROM _strategic_plans);
CREATE TEMP TABLE _strategic_initiatives ON COMMIT DROP AS
  SELECT * FROM public.strategic_initiatives WHERE plan_id IN (SELECT id FROM _strategic_plans);

CREATE TEMP TABLE _fin_analyses ON COMMIT DROP AS
  SELECT * FROM public.fin_analyses WHERE company_id = (SELECT cid FROM _src);
UPDATE _fin_analyses SET company_id = (SELECT cid FROM _dst), owner_id = (SELECT uid FROM _dst),
       created_by_id = (SELECT uid FROM _dst);
CREATE TEMP TABLE _fin_years ON COMMIT DROP AS
  SELECT * FROM public.fin_years WHERE analysis_id IN (SELECT id FROM _fin_analyses);
CREATE TEMP TABLE _fin_lines ON COMMIT DROP AS
  SELECT * FROM public.fin_lines WHERE analysis_id IN (SELECT id FROM _fin_analyses);
CREATE TEMP TABLE _fin_values ON COMMIT DROP AS
  SELECT * FROM public.fin_values WHERE analysis_id IN (SELECT id FROM _fin_analyses);

-- Resultados guardados del asistente de IA (informe y resumen ejecutivo).
CREATE TEMP TABLE _ia_resultados ON COMMIT DROP AS
  SELECT * FROM public.ia_resultados WHERE company_id = (SELECT cid FROM _src);
UPDATE _ia_resultados SET company_id = (SELECT cid FROM _dst), user_id = (SELECT uid FROM _dst);

-- ---------------------------------------------------------------------------
-- 3. Texto del archivo
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _out (n serial PRIMARY KEY, txt text NOT NULL) ON COMMIT DROP;

-- Un bloque «INSERT … jsonb_populate_recordset» por tabla, una fila por línea.
CREATE FUNCTION pg_temp.bloque(src regclass, dst text, orden text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE cols text; filas text; n int;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols
    FROM pg_attribute
   WHERE attrelid = ('public.' || quote_ident(dst))::regclass AND attnum > 0
     AND NOT attisdropped AND attgenerated = '' AND attidentity <> 'a';
  EXECUTE format('SELECT string_agg(to_jsonb(t)::text, E'',\n'' ORDER BY %s), count(*) FROM %s t', orden, src)
     INTO filas, n;
  IF n = 0 THEN RETURN format('-- %s: sin filas', dst); END IF;
  IF position('$staging$' IN filas) > 0 THEN RAISE EXCEPTION 'Los datos de % contienen la etiqueta $staging$', dst; END IF;
  RETURN format(E'-- %s: %s filas\nINSERT INTO public.%I (%s)\nSELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $staging$[\n%s\n]$staging$::jsonb);\n',
                dst, n, dst, cols, cols, dst, filas);
END $f$;

INSERT INTO _out (txt) VALUES ($h$-- ============================================================================
-- Datos de ejemplo para STAGING (la rama de Supabase, nunca producción)
-- ============================================================================
-- GENERADO por `npm run db:staging:exportar` desde la base local. No se edita
-- a mano: se cambia la base local y se vuelve a generar.
--
-- Contiene:
--   · Cinco cuentas de demostración (demo.*@example.com) SIN contraseña: la
--     pone `npm run db:staging:preparar` al cargar este archivo.
--   · Tres empresas: «Metalmecánica del Bajío» (cliente, con los tres
--     módulos), «Consultoría Marta Ruiz» (la mentora) y «Paula Admin»
--     (administradora de la plataforma).
--   · El ejemplo completo de Gestión del Riesgo, Planeación Estratégica y
--     Análisis Financiero de «Metalmecánica del Bajío», con el informe y el
--     resumen ejecutivo del asistente de IA ya guardados.
--
-- Es repetible: borra la demostración anterior y la vuelve a crear. Lo que se
-- haya capturado en esas tres empresas se pierde; las demás no se tocan.
-- Requiere las tres fases de empresas (supabase-empresas*.sql) ya aplicadas.
-- ============================================================================
BEGIN;

-- Protección: esta semilla no se carga donde hay usuarios reales.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE email NOT LIKE 'demo.%@example.com';
  IF n > 25 AND current_setting('semilla.forzar', true) IS DISTINCT FROM 'si' THEN
    RAISE EXCEPTION 'Esta base tiene % usuarios que no son de demostración: parece producción. La semilla de staging no se carga aquí.', n;
  END IF;
  IF to_regclass('public.company_mentors') IS NULL THEN
    RAISE EXCEPTION 'Faltan las fases de empresas (supabase-empresas*.sql). Aplícalas antes de cargar la semilla.';
  END IF;
END $$;
$h$);

-- Identificadores fijos de la demostración.
INSERT INTO _out (txt)
SELECT format($f$-- ---------------------------------------------------------------------------
-- 1. Quitar la demostración anterior, si existe
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _demo_u ON COMMIT DROP AS
  SELECT id FROM auth.users WHERE email LIKE 'demo.%%@example.com'
  UNION SELECT unnest(ARRAY[%s]::uuid[]);
CREATE TEMP TABLE _demo_c ON COMMIT DROP AS
  SELECT unnest(ARRAY[%s]::uuid[]) AS id
  UNION SELECT company_id FROM public.company_members WHERE user_id IN (SELECT id FROM _demo_u)
  UNION SELECT id FROM public.companies WHERE created_by IN (SELECT id FROM _demo_u);

DELETE FROM public.risks           WHERE company_id IN (SELECT id FROM _demo_c);
DELETE FROM public.departments     WHERE company_id IN (SELECT id FROM _demo_c);
DELETE FROM public.strategic_plans WHERE company_id IN (SELECT id FROM _demo_c);  -- arrastra respuestas, competidores e iniciativas
DELETE FROM public.fin_analyses    WHERE company_id IN (SELECT id FROM _demo_c);  -- arrastra periodos, segmentos y cifras
DELETE FROM public.ia_resultados   WHERE user_id IN (SELECT id FROM _demo_u);
DELETE FROM public.ia_usage        WHERE user_id IN (SELECT id FROM _demo_u);
DELETE FROM public.user_module_access WHERE user_id IN (SELECT id FROM _demo_u);
DELETE FROM public.companies       WHERE id IN (SELECT id FROM _demo_c);          -- arrastra equipo, módulos, invitaciones, mentores e historial
DELETE FROM auth.users             WHERE id IN (SELECT id FROM _demo_u);

-- ---------------------------------------------------------------------------
-- 2. Cuentas (sin contraseña; la pone el script de carga)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.email, '', now(),
       x.app, x.meta, x.created_at, now(), '', '', '', ''
  FROM jsonb_to_recordset($staging$[
%s
]$staging$::jsonb) AS x(id uuid, email text, app jsonb, meta jsonb, created_at timestamptz);

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), u.created_at, now()
  FROM auth.users u WHERE u.id IN (SELECT id FROM _demo_u);

-- Al crear cada cuenta, la base le abre sola una empresa y le da acceso por
-- defecto. Aquí las empresas y los permisos vienen escritos, así que eso se quita.
DELETE FROM public.companies WHERE created_by IN (SELECT id FROM _demo_u);
DELETE FROM public.user_module_access WHERE user_id IN (SELECT id FROM _demo_u);

-- ---------------------------------------------------------------------------
-- 3. Empresas, equipo y permisos
-- ---------------------------------------------------------------------------
$f$,
  (SELECT string_agg(quote_literal(id), ', ' ORDER BY email) FROM _u),
  (SELECT string_agg(quote_literal(id), ', ' ORDER BY id) FROM _c),
  (SELECT string_agg(jsonb_build_object('id', id, 'email', email, 'app', app, 'meta', meta, 'created_at', created_at)::text, E',\n' ORDER BY email) FROM _u));

INSERT INTO _out (txt) VALUES
  (pg_temp.bloque('_companies', 'companies', 't.created_at, t.id')),
  (pg_temp.bloque('_company_members', 'company_members', 't.company_id, t.created_at, t.user_id')),
  (pg_temp.bloque('_company_modules', 'company_modules', 't.company_id, t.module_key')),
  (pg_temp.bloque('_company_invitations', 'company_invitations', 't.created_at, t.id')),
  (pg_temp.bloque('_company_mentors', 'company_mentors', 't.company_id, t.mentor_id')),
  (pg_temp.bloque('_user_module_access', 'user_module_access', 't.user_id, t.module_key')),
  (E'-- ---------------------------------------------------------------------------\n-- 4. Gestión del Riesgo\n-- ---------------------------------------------------------------------------'),
  (pg_temp.bloque('_departments', 'departments', 't.name, t.id')),
  (pg_temp.bloque('_risks', 'risks', 't.created_at, t.id')),
  (E'-- ---------------------------------------------------------------------------\n-- 5. Planeación Estratégica\n-- ---------------------------------------------------------------------------'),
  (pg_temp.bloque('_strategic_plans', 'strategic_plans', 't.id')),
  (pg_temp.bloque('_competitors', 'competitors', 't.position, t.id')),
  (pg_temp.bloque('_plan_answers', 'plan_answers', 't.section, t.question_key')),
  (pg_temp.bloque('_strategic_initiatives', 'strategic_initiatives', 't.position, t.id')),
  (E'-- ---------------------------------------------------------------------------\n-- 6. Análisis Financiero\n-- ---------------------------------------------------------------------------'),
  (pg_temp.bloque('_fin_analyses', 'fin_analyses', 't.id')),
  (pg_temp.bloque('_fin_years', 'fin_years', 't.year, t.months')),
  (pg_temp.bloque('_fin_lines', 'fin_lines', 't.position, t.id')),
  (pg_temp.bloque('_fin_values', 'fin_values', 't.year_id, t.section, t.concept_key')),
  (E'-- ---------------------------------------------------------------------------\n-- 7. Asistente de IA: resultados ya guardados\n-- ---------------------------------------------------------------------------'),
  (pg_temp.bloque('_ia_resultados', 'ia_resultados', 't.kind')),
  (E'COMMIT;');

-- ---------------------------------------------------------------------------
-- 4. Revisión: nada de usuarios ni empresas reales en el archivo
-- ---------------------------------------------------------------------------
DO $$
DECLARE todo text; n int;
BEGIN
  SELECT string_agg(txt, E'\n') INTO todo FROM _out;
  SELECT count(*) INTO n FROM (
    SELECT id::text AS id FROM auth.users WHERE id NOT IN (SELECT id FROM _u)
    UNION SELECT id::text FROM public.companies WHERE id NOT IN (SELECT id FROM _c)
  ) x WHERE position(x.id IN todo) > 0;
  IF n > 0 THEN RAISE EXCEPTION 'El archivo incluiría % identificadores de usuarios o empresas reales', n; END IF;
  SELECT count(*) INTO n FROM auth.users u
   WHERE u.id NOT IN (SELECT id FROM _u) AND position(lower(u.email) IN lower(todo)) > 0;
  IF n > 0 THEN RAISE EXCEPTION 'El archivo incluiría % correos de usuarios reales', n; END IF;
END $$;

\pset format unaligned
\pset tuples_only on
SELECT txt FROM _out ORDER BY n;

ROLLBACK;
