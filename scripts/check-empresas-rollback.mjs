#!/usr/bin/env node
// Ensayo de supabase-empresas-rollback.sql en la base LOCAL (docs/BD-LOCAL.md),
// con las tres fases de empresas ya aplicadas (npm run db:local:empresas).
//
// Todo corre dentro de UNA transacción que al final se revierte: la base
// local queda exactamente como estaba, pase lo que pase.
//
//   1. Huella de lo que ve cada usuario con la migración aplicada.
//   2. Aplica el rollback y comprueba que:
//        · no quedan los triggers nuevos;
//        · cada usuario ve únicamente lo suyo (regla «solo el dueño»);
//        · la versión anterior de la app puede dar de alta, cambiar y borrar;
//        · el asistente de IA vuelve a guardar un resultado por usuario;
//        · las reglas de seguridad son idénticas a las de producción
//          (supabase/local/schema.sql, la copia que baja db:local:copiar),
//          salvo la de NO_RESTAURADA, que se deja fuera a propósito.
//   3. Deja las reglas exactamente como en producción, vuelve a aplicar las
//      tres fases encima y comprueba que cada usuario ve lo mismo que en el
//      paso 1 y que las reglas quedan iguales a las del paso 1.
//
//   Uso: npm run db:local:ensayar-rollback
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB = "supabase_db_hcmeoducjqudokfhhvyc";
const read = (file) => readFileSync(join(root, file), "utf8");

// Los archivos traen su propio BEGIN/COMMIT; aquí van dentro de la transacción
// del ensayo, así que se les quita (solo los de primer nivel: los BEGIN de las
// funciones no llevan punto y coma).
const body = (file) =>
  read(file)
    .split("\n")
    .filter((line) => !/^(BEGIN|COMMIT);\s*$/.test(line))
    .join("\n");

// Tablas de datos: raíz (columna del dueño) o hija (tabla padre y su llave).
const TABLES = [
  { name: "risks", owner: "created_by_id" },
  { name: "departments", owner: "created_by_id" },
  { name: "strategic_plans", owner: "owner_id" },
  { name: "fin_analyses", owner: "owner_id" },
  { name: "plan_answers", parent: "strategic_plans", fk: "plan_id" },
  { name: "competitors", parent: "strategic_plans", fk: "plan_id" },
  { name: "strategic_initiatives", parent: "strategic_plans", fk: "plan_id" },
  { name: "fin_lines", parent: "fin_analyses", fk: "analysis_id" },
  { name: "fin_years", parent: "fin_analyses", fk: "analysis_id" },
  { name: "fin_values", parent: "fin_analyses", fk: "analysis_id" },
];
const POLICY_TABLES = [...TABLES.map((t) => t.name), "ia_resultados"];
// Regla de producción que el rollback NO restaura a propósito: dejaba que
// cualquier usuario con sesión borrara departamentos de otros.
const NO_RESTAURADA = { table: "departments", name: "Usuarios autenticados pueden eliminar departamentos" };
const sqlList = (items) => items.map((i) => `'${i}'`).join(", ");

const fingerprint = (table, where = "") =>
  `(select count(*) || ':' || md5(coalesce(string_agg(h, ',' order by h), '')) ` +
  `from (select md5((to_jsonb(x) - 'company_id')::text) h from public.${table} x ${where}) q)`;

// Lo que ve el usuario en sesión (pasa por las reglas de seguridad).
const seenQuery = `select concat_ws('|', ${TABLES.map((t) => fingerprint(t.name)).join(", ")})`;

// Lo que le pertenece a un usuario según «solo el dueño» (sin reglas).
const ownedQuery = `select concat_ws('|', ${TABLES.map((t) => {
  if (t.owner) return fingerprint(t.name, `where x.${t.owner} = $1`);
  const parentOwner = TABLES.find((p) => p.name === t.parent).owner;
  return fingerprint(
    t.name,
    `where exists (select 1 from public.${t.parent} p where p.id = x.${t.fk} and p.${parentOwner} = $1)`,
  );
}).join(", ")})`;

// Reglas de seguridad de producción para esas tablas, tal como las volcó
// `supabase db dump` (cada CREATE POLICY termina en «;» al final de línea).
function productionPolicies() {
  const file = "supabase/local/schema.sql";
  if (!existsSync(join(root, file))) return null;
  const statements = read(file).match(/^CREATE POLICY [\s\S]*?;$/gm) || [];
  const wanted = new RegExp(`ON "public"\\."(${POLICY_TABLES.join("|")})"`);
  return statements.filter((s) => wanted.test(s.split("\n")[0]));
}
const prod = productionPolicies();

const sql = `
\\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _fp  (step text, uid uuid, fp text) ON COMMIT DROP;
CREATE TEMP TABLE _pol (step text, tbl text, name text, cmd text, roles text, qual text, chk text, permissive text) ON COMMIT DROP;
CREATE TEMP TABLE _res (n int GENERATED ALWAYS AS IDENTITY, ok boolean, msg text) ON COMMIT DROP;

-- Huella de lo que ve cada usuario bajo las reglas vigentes.
CREATE FUNCTION pg_temp.snapshot(p_step text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE u record; v text;
BEGIN
  FOR u IN SELECT id FROM auth.users ORDER BY id LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE $q$${seenQuery}$q$ INTO v;
    EXECUTE 'RESET ROLE';
    INSERT INTO _fp VALUES (p_step, u.id, v);
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', true);
END $f$;

CREATE FUNCTION pg_temp.policies(p_step text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _pol
  SELECT p_step, tablename, policyname, cmd, array_to_string(roles, ','), qual, with_check, permissive
    FROM pg_policies WHERE schemaname = 'public' AND tablename IN (${sqlList(POLICY_TABLES)});
$f$;

CREATE FUNCTION pg_temp.new_triggers() RETURNS int LANGUAGE sql AS $f$
  SELECT count(*)::int FROM pg_trigger
   WHERE NOT tgisinternal AND tgname IN ('set_company_id', 'zz_log_change', 'create_company_for_new_user');
$f$;

DO $$ BEGIN
  IF to_regclass('public.company_mentors') IS NULL THEN
    RAISE EXCEPTION 'La base local no tiene las tres fases aplicadas. Corre antes: npm run db:local:empresas';
  END IF;
  PERFORM pg_temp.snapshot('migrado');
  PERFORM pg_temp.policies('migrado');
END $$;
INSERT INTO _res (ok, msg) SELECT pg_temp.new_triggers() = 15, 'punto de partida: las tres fases aplicadas (' || pg_temp.new_triggers() || ' triggers nuevos)';

-- ═══ 2. Rollback ═════════════════════════════════════════════════════════════
${body("supabase-empresas-rollback.sql")}

DO $$ BEGIN PERFORM pg_temp.snapshot('deshecho'); PERFORM pg_temp.policies('deshecho'); END $$;

INSERT INTO _res (ok, msg) SELECT pg_temp.new_triggers() = 0, 'rollback: no quedan triggers nuevos (' || pg_temp.new_triggers() || ')';

-- Cada usuario ve exactamente lo que le pertenece.
DO $$
DECLARE u record; v text; bad int := 0; total int := 0;
BEGIN
  FOR u IN SELECT uid, fp FROM _fp WHERE step = 'deshecho' LOOP
    EXECUTE $q$${ownedQuery}$q$ INTO v USING u.uid;
    total := total + 1;
    IF v IS DISTINCT FROM u.fp THEN bad := bad + 1; END IF;
  END LOOP;
  INSERT INTO _res (ok, msg) VALUES (bad = 0, format('rollback: los %s usuarios ven únicamente lo suyo (%s con diferencias)', total, bad));
END $$;

-- La app anterior (no manda company_id) da de alta, cambia y borra.
DO $$
DECLARE
  uid uuid := (SELECT created_by_id FROM public.departments WHERE created_by_id IS NOT NULL
                GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1);
  d uuid; r uuid; p uuid; a uuid; seen int; cids int; err text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.departments (name, created_by_id) VALUES ('zz ensayo rollback', uid) RETURNING id INTO d;
    INSERT INTO public.risks (department_id, created_by_id, description) VALUES (d, uid, 'zz ensayo') RETURNING id INTO r;
    INSERT INTO public.strategic_plans (owner_id, name) VALUES (uid, 'zz ensayo') RETURNING id INTO p;
    INSERT INTO public.fin_analyses (owner_id, company_name) VALUES (uid, 'zz ensayo') RETURNING id INTO a;
    UPDATE public.risks SET description = 'zz ensayo 2' WHERE id = r;
    SELECT count(*) INTO seen FROM public.risks WHERE id = r AND description = 'zz ensayo 2';
    SELECT (SELECT count(*) FROM public.departments WHERE id = d AND company_id IS NULL)
         + (SELECT count(*) FROM public.risks WHERE id = r AND company_id IS NULL)
         + (SELECT count(*) FROM public.strategic_plans WHERE id = p AND company_id IS NULL)
         + (SELECT count(*) FROM public.fin_analyses WHERE id = a AND company_id IS NULL) INTO cids;
    DELETE FROM public.risks WHERE id = r;
    DELETE FROM public.departments WHERE id = d;
    DELETE FROM public.strategic_plans WHERE id = p;
    DELETE FROM public.fin_analyses WHERE id = a;
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO _res (ok, msg) VALUES (
    err IS NULL AND seen = 1 AND cids = 4
      AND NOT EXISTS (SELECT 1 FROM public.departments WHERE id = d)
      AND NOT EXISTS (SELECT 1 FROM public.risks WHERE id = r),
    'rollback: la app anterior da de alta, cambia y borra como antes' || COALESCE(' — ' || err, ''));
END $$;

INSERT INTO _res (ok, msg)
SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ia_resultados_user_id_kind_key')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ia_resultados_user_company_kind_key'),
       'rollback: el asistente de IA vuelve a un resultado por usuario y tipo';

${
  prod
    ? `-- Reglas idénticas a las de producción: se sustituyen por las del volcado y
-- se comparan una por una (mismo texto normalizado por Postgres).
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN (${sqlList(POLICY_TABLES)}) LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;
${prod.join("\n")}
DO $$ BEGIN PERFORM pg_temp.policies('produccion'); END $$;
INSERT INTO _res (ok, msg)
SELECT count(*) FILTER (WHERE a.name IS NULL OR b.name IS NULL) = 0 AND count(*) > 0,
       format('rollback: las %s reglas de seguridad son idénticas a las de producción, sin contar la que dejaba borrar departamentos ajenos (%s distintas%s)',
              count(*) FILTER (WHERE b.name IS NOT NULL),
              count(*) FILTER (WHERE a.name IS NULL OR b.name IS NULL),
              COALESCE(': ' || string_agg(COALESCE(a.tbl, b.tbl) || '/' || COALESCE(a.name, b.name), ', ')
                                 FILTER (WHERE a.name IS NULL OR b.name IS NULL), ''))
  FROM (SELECT * FROM _pol WHERE step = 'deshecho') a
  FULL JOIN (SELECT * FROM _pol WHERE step = 'produccion'
                AND (tbl, name) <> ('${NO_RESTAURADA.table}', '${NO_RESTAURADA.name}')) b
    ON (a.tbl, a.name, a.cmd, a.roles, a.permissive) = (b.tbl, b.name, b.cmd, b.roles, b.permissive)
   AND a.qual IS NOT DISTINCT FROM b.qual AND a.chk IS NOT DISTINCT FROM b.chk;`
    : `INSERT INTO _res (ok, msg) VALUES (true, 'AVISO: sin supabase/local/schema.sql no se compararon las reglas con producción (npm run db:local:copiar)');`
}

-- ═══ 3. Volver a aplicar las tres fases encima ═══════════════════════════════
${body("supabase-empresas.sql")}
${body("supabase-empresas-usuarios.sql")}
${body("supabase-empresas-mentores.sql")}

DO $$ BEGIN PERFORM pg_temp.snapshot('reaplicado'); PERFORM pg_temp.policies('reaplicado'); END $$;
INSERT INTO _res (ok, msg)
SELECT count(*) FILTER (WHERE a.fp IS DISTINCT FROM b.fp) = 0 AND count(*) > 0,
       format('reaplicar: los %s usuarios ven lo mismo que antes de deshacer (%s con diferencias)',
              count(*), count(*) FILTER (WHERE a.fp IS DISTINCT FROM b.fp))
  FROM (SELECT * FROM _fp WHERE step = 'migrado') a
  FULL JOIN (SELECT * FROM _fp WHERE step = 'reaplicado') b USING (uid);
INSERT INTO _res (ok, msg)
SELECT count(*) FILTER (WHERE a.name IS NULL OR b.name IS NULL) = 0 AND count(*) > 0,
       format('reaplicar: las %s reglas de seguridad quedan iguales que antes de deshacer (%s distintas%s)',
              count(*) FILTER (WHERE a.name IS NOT NULL),
              count(*) FILTER (WHERE a.name IS NULL OR b.name IS NULL),
              COALESCE(': ' || string_agg(COALESCE(a.tbl, b.tbl) || '/' || COALESCE(a.name, b.name), ', ')
                                 FILTER (WHERE a.name IS NULL OR b.name IS NULL), ''))
  FROM (SELECT * FROM _pol WHERE step = 'migrado') a
  FULL JOIN (SELECT * FROM _pol WHERE step = 'reaplicado') b
    ON (a.tbl, a.name, a.cmd, a.roles, a.permissive) = (b.tbl, b.name, b.cmd, b.roles, b.permissive)
   AND a.qual IS NOT DISTINCT FROM b.qual AND a.chk IS NOT DISTINCT FROM b.chk;
INSERT INTO _res (ok, msg) SELECT pg_temp.new_triggers() = 15, 'reaplicar: vuelven los 15 triggers (' || pg_temp.new_triggers() || ')';
INSERT INTO _res (ok, msg)
SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ia_resultados_user_company_kind_key'),
       'reaplicar: el asistente de IA vuelve a guardar por empresa';

SELECT '@@RESULTADOS';
SELECT CASE WHEN ok THEN '  OK     ' ELSE '  FALLA  ' END || msg FROM _res ORDER BY n;
SELECT '@@FALLAS=' || count(*) FILTER (WHERE NOT ok) FROM _res;
ROLLBACK;
`;

console.log("Ensayo de rollback en la base local (transacción que se revierte al final)…");
const run = spawnSync(
  "docker",
  ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-At", "-q", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
const out = run.stdout || "";
const results = out.includes("@@RESULTADOS") ? out.slice(out.indexOf("@@RESULTADOS")).split("\n").slice(1) : [];
const failures = /@@FALLAS=(\d+)/.exec(out)?.[1];
console.log(results.filter((l) => l && !l.startsWith("@@")).join("\n"));
if (run.status !== 0 || failures === undefined) {
  const errors = (run.stderr || "").split("\n").filter((l) => /ERROR|FATAL|DETAIL|CONTEXT|LINE/.test(l));
  console.error("\nEl ensayo no terminó (la base local no cambió):\n" + errors.slice(0, 12).join("\n"));
  process.exit(1);
}
console.log(failures === "0" ? "\nTodo en orden. La base local quedó como estaba." : `\n${failures} comprobaciones fallaron. La base local quedó como estaba.`);
process.exit(failures === "0" ? 0 : 1);
