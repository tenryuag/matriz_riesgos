#!/bin/zsh
# Staging con su propia base de datos: una rama de Supabase del proyecto de
# producción, con una COPIA de los datos de producción. Guía: docs/STAGING.md
#
# Uso (desde la raíz del repo):
#   npm run db:staging:estado    → qué hay hoy en la rama (solo lee)
#   npm run db:staging:preparar  → copia producción a la rama y hace ahí el estreno de empresas
#   npm run db:staging:conectar  → apunta el sitio de staging (Netlify) a la rama
#
# Producción solo se LEE (un volcado de sus datos). Todo lo que se escribe va
# a la rama: sus credenciales las pide la CLI de Supabase en cada corrida
# (`supabase branches get`) y el script se detiene si el destino resulta ser
# el proyecto de producción.
set -e
cd "$(dirname "$0")/.."

PROD="hcmeoducjqudokfhhvyc"              # producción: se lee su lista de ramas y sus datos
RAMA="${RAMA:-staging}"                  # nombre de la rama en Supabase
SITIO="matrizriesgos"                    # sitio de Netlify
CONTEXTO="branch:staging"                # despliegue de la rama git `staging`
URL_STAGING="https://staging--matrizriesgos.netlify.app"
DB="supabase_db_hcmeoducjqudokfhhvyc"    # contenedor de la base local: se usa su psql
LOCAL="supabase/local"                   # ignorada por git: aquí quedan datos reales
COPIA="$LOCAL/staging-data.sql"          # volcado de producción que se carga en la rama
HUELLAS="$LOCAL/staging-huellas"         # qué veía cada usuario antes y después del estreno
ACCESOS="$LOCAL/staging-accesos.txt"     # códigos de invitación de staging
FASES=(supabase-empresas.sql supabase-empresas-usuarios.sql supabase-empresas-mentores.sql)
SECRETOS=(ANTHROPIC_API_KEY PUBLISHABLE_KEY PUBLIC_MCP_URL PUBLIC_APP_URL)
# Lo que no se copia: sesiones y tokens vivos, y las conexiones de Claude
# (clientes OAuth) registradas contra producción.
SIN_DATOS="auth.sessions,auth.refresh_tokens,auth.one_time_tokens,auth.flow_state,auth.audit_log_entries,auth.mfa_amr_claims,auth.mfa_challenges,auth.mfa_factors,auth.oauth_authorizations,auth.oauth_consents,auth.oauth_client_states,auth.oauth_clients,storage.bucket_lifecycle_states,storage.lifecycle_abandoned_artifacts"
# Tablas con datos de los módulos: de ellas se toma la huella por usuario.
TABLAS=(risks departments strategic_plans plan_answers competitors strategic_initiatives fin_analyses fin_lines fin_years fin_values ia_resultados)
QA_CORREOS="qa.staging.%@example.com"    # cuentas temporales de la prueba por la API

necesita_local() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB" || {
    echo "La base local no está encendida (se usa su psql). Enciéndela con: supabase start"; exit 1; }
}

# Lee de la CLI la dirección y las llaves de la rama. No imprime nada de eso.
rama() {
  local out
  out=$(supabase branches get "$RAMA" --remote="$PROD" -o env 2>/dev/null) || true
  val() { print -r -- "$out" | sed -n "s/^$1=//p" | head -1 | sed -e 's/^"//' -e 's/"$//' }
  R_URL=$(val SUPABASE_URL)
  R_PG=$(val POSTGRES_URL)
  R_PG2=$(val POSTGRES_URL_NON_POOLING)
  R_KEY=$(val SUPABASE_PUBLISHABLE_KEY)
  [ -n "$R_KEY" ] || R_KEY=$(val SUPABASE_ANON_KEY)
  R_REF=${${R_URL#https://}%%.*}
  if [ -z "$R_URL" ] || [ -z "$R_PG" ]; then
    echo "No encuentro la rama «$RAMA» en Supabase (o todavía se está creando)."
    echo "Ramas que existen:"
    supabase branches list --remote="$PROD" 2>/dev/null | grep -o '"name":"[^"]*"' | sed 's/"name":/  ·/' || true
    exit 1
  fi
  if [ "$R_REF" = "$PROD" ] || [[ "$R_PG" == *"$PROD"* ]]; then
    echo "ALTO: «$RAMA» apunta a producción ($PROD). Este script solo escribe en una rama."; exit 1
  fi
}

# psql de la base local, conectado a la rama. El SQL entra por la entrada estándar.
psql_rama() {
  PGURL="$R_CONN" docker exec -i -e PGURL -e PGCONNECT_TIMEOUT=20 "$DB" \
    sh -c 'exec psql "$PGURL" -q -At -v ON_ERROR_STOP=1 "$@"' sh "$@"
}
uno() { print -r -- "$1" | psql_rama; }   # una consulta, un resultado

conectar_bd() {
  necesita_local
  local c
  for c in "${R_PG/:6543\//:5432/}" "$R_PG" "$R_PG2"; do
    [ -n "$c" ] || continue
    R_CONN="$c"
    if print 'select 1' | psql_rama >/dev/null 2>&1; then return 0; fi
  done
  echo "No pude conectar con la base de la rama «$RAMA» ($R_REF). ¿Sigue creándose o está en pausa?"; exit 1
}

# Corre un archivo SQL en la rama y se detiene con el error si falla.
aplicar() {
  local out
  out=$(psql_rama < "$1" 2>&1) || { print -r -- "$out" | grep -v 'NOTICE' | tail -15; echo "Falló $1"; exit 1; }
}

# Corre un archivo de pruebas (una transacción que se revierte) y muestra sus «OK».
prueba_sql() {
  local out
  out=$(psql_rama < "$1" 2>&1) || { print -r -- "$out" | grep -E 'ERROR|ASSERT' | tail -5; echo "Falló $1"; exit 1; }
  print -r -- "$out" | sed -n 's/^.*NOTICE: *\(OK.*\)$/    \1/p'
}

# ── Copia de producción ──────────────────────────────────────────────────────

# Tablas del volcado que traen filas: «"esquema"."tabla"<tab>N».
filas_copia() {
  awk '!d && /^COPY /{t=$2; n=0; d=1; next} d && /^\\\.$/{if (n) print t "\t" n; d=0; next} d{n++}' "$COPIA"
}
# El volcado sin las tablas vacías: así no se tocan tablas internas de
# Supabase (Storage, SSO…) en las que la rama no deja escribir.
copia_con_datos() {
  awk '!d && /^COPY /{h=$0; d=1; p=1; next}
       d && p {p=0; if ($0 == "\\.") {d=0; next} print h}
       d && /^\\\.$/{print; d=0; next}
       {print}' "$COPIA"
}
# Arma una consulta por tabla del volcado («&» es la tabla) y las une.
por_tabla() { filas_copia | cut -f1 | sed "s/.*/$1/" | awk 'NR > 1 {printf " union all "} {printf "%s", $0} END {print ""}'; }

copiar_produccion() {
  local out edad
  if [ -f "$COPIA" ]; then
    edad=$(( ($(date +%s) - $(stat -f %m "$COPIA")) / 60 ))
    if [ "$edad" -lt 120 ]; then echo "    Se usa la copia de hace $edad min ($COPIA)."; return 0; fi
  fi
  mkdir -p "$LOCAL"
  out=$(supabase db dump --remote="$PROD" --data-only --use-copy -x "$SIN_DATOS" -f "$PWD/$COPIA" 2>&1) \
    || { print -r -- "$out" | tail -5; echo "No pude copiar los datos de producción."; exit 1; }
  chmod 600 "$COPIA"
  echo "    $(filas_copia | awk -F'\t' '{t++; n += $2} END {print n " filas en " t " tablas"}')"
}

cargar_copia() {
  local faltan llenas out
  faltan=$(por_tabla "select '&' where to_regclass('&') is null" | psql_rama)
  [ -z "$faltan" ] || { echo "La rama no tiene estas tablas de producción:"; print -r -- "$faltan" | sed 's/^/  /'; exit 1; }
  llenas=$(por_tabla "select '&' where exists (select 1 from &)" | psql_rama)
  [ -z "$llenas" ] || { echo "La rama ya tiene datos en estas tablas; no cargo encima:"; print -r -- "$llenas" | sed 's/^/  /'; exit 1; }
  # Todo o nada: si algo falla, la rama queda como estaba.
  out=$({ print 'BEGIN;'; copia_con_datos; print 'COMMIT;'; } | psql_rama 2>&1) \
    || { print -r -- "$out" | grep '^ERROR' | tail -5; echo "Falló la carga de la copia; la rama no cambió."; exit 1; }
  verificar_copia
}

# La rama tiene, tabla por tabla, las mismas filas que la copia.
verificar_copia() {
  local esperado real
  esperado=$(filas_copia | sort)
  real=$(por_tabla "select '&' || chr(9) || count(*) from &" | psql_rama | sort)
  if [ "$esperado" != "$real" ]; then
    echo "ALTO: la rama no tiene las mismas filas que la copia (< copia, > rama):"
    diff <(print -r -- "$esperado") <(print -r -- "$real") | grep '^[<>]' | head -20; exit 1
  fi
  echo "    $(uno "select count(*) || ' usuarios, ' || (select count(*) from public.risks) || ' riesgos, ' || (select count(*) from public.strategic_plans) || ' planes y ' || (select count(*) from public.fin_analyses) || ' análisis financieros' from auth.users"): las mismas filas que la copia, tabla por tabla"
}

# ── Huella: qué ve cada usuario ──────────────────────────────────────────────

# Una línea por usuario con, para cada tabla, cuántas filas ve bajo las reglas
# de seguridad y un resumen de su contenido.
huella() {
  local cols="" t
  for t in $TABLAS; do
    cols+=", (select count(*) || ':' || md5(coalesce(string_agg(h, ',' order by h), '')) from (select md5((to_jsonb(x) - 'company_id')::text) h from public.$t x) q)"
  done
  uno "select id from auth.users order by id" | while read -r uid; do
    print -r -- "begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', true); select '$uid'$cols; commit;"
  done | psql_rama | grep -E '^[0-9a-f-]{36}\|'
}

# Módulo al que pertenece cada tabla de TABLAS, en el mismo orden («-» = ninguno).
MODULOS=(risk risk strategic strategic strategic strategic fin-analysis fin-analysis fin-analysis fin-analysis -)

# $1 = huella de antes, $2 = huella de después. Con $3 (módulos que tiene cada
# usuario, «id|a,b») se acepta una sola diferencia: dejar de recibir las filas
# de un módulo que la cuenta no tiene asignado. Antes eso lo ocultaba solo la
# app; con las fases de empresas lo aplica también la base.
comparar() {
  local n dif
  n=$(wc -l < "$1" | tr -d ' ')
  [ "$n" -gt 0 ] || { echo "    FALLA: la huella de antes está vacía."; return 1; }
  dif=$(awk -F'|' -v tablas="${TABLAS[*]}" -v modulos="${MODULOS[*]}" -v antes="$1" -v acc="${3:-}" '
    BEGIN { split(tablas, T, " "); split(modulos, M, " ")
            while ((getline l < antes) > 0) { split(l, p, "|"); a[p[1]] = l }
            if (acc != "") while ((getline l < acc) > 0) { split(l, p, "|"); tiene[p[1]] = "," p[2] "," } }
    { split(a[$1], A, "|"); esp = ""; mal = ""
      for (i = 2; i <= NF; i++) if ($i != A[i]) {
        split(A[i], x, ":"); split($i, y, ":"); d = "  " T[i-1] ": " x[1] " → " y[1]
        if (acc != "" && y[1] == 0 && M[i-1] != "-" && index(tiene[$1], "," M[i-1] ",") == 0) esp = esp d; else mal = mal d }
      if (mal != "") print "F\t" substr($1, 1, 8) "…" mal esp; else if (esp != "") print "E\t" substr($1, 1, 8) "…" esp }' "$2")
  if print -r -- "$dif" | grep -q '^F'; then
    echo "    FALLA: cambia lo que ven estos usuarios (tabla: filas antes → después):"
    print -r -- "$dif" | sed -n 's/^F\t/      /p' | head -20
    return 1
  fi
  local e; e=$(print -r -- "$dif" | grep -c '^E' || true)
  echo "    OK: $(( n - e )) de $n usuarios ven exactamente las mismas filas que antes."
  if [ "$e" -gt 0 ]; then
    echo "    Cuentas que dejan de recibir datos de un módulo que no tienen asignado (la app ya no se los mostraba; no se borra nada): $e"
    print -r -- "$dif" | sed -n 's/^E\t/      /p'
  fi
}

# ── Prueba por la API, con dos cuentas temporales ────────────────────────────

quitar_qa() {
  psql_rama -v "correos=$QA_CORREOS" <<'EOF' >/dev/null
begin;
create temp table _qa_u on commit drop as select id from auth.users where email like :'correos';
create temp table _qa_c on commit drop as select id from public.companies where created_by in (select id from _qa_u);
delete from public.risks           where company_id in (select id from _qa_c);
delete from public.departments     where company_id in (select id from _qa_c);
delete from public.strategic_plans where company_id in (select id from _qa_c);
delete from public.fin_analyses    where company_id in (select id from _qa_c);
delete from public.ia_resultados   where user_id in (select id from _qa_u);
delete from public.ia_usage        where user_id in (select id from _qa_u);
delete from public.user_module_access where user_id in (select id from _qa_u);
delete from public.companies       where id in (select id from _qa_c);
delete from auth.users             where id in (select id from _qa_u);
commit;
EOF
}

# Crea una empresa cliente con un análisis financiero mínimo y una mentora
# asignada a ese módulo; prueba con ellas la API de la rama y las borra.
prueba_api() {
  local pass otra antes despues falla=0
  pass=$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-24)
  quitar_qa   # por si quedó algo de una corrida interrumpida
  antes=$(uno "select (select count(*) from auth.users) || ' usuarios, ' || (select count(*) from public.companies) || ' empresas'")
  otra=$(uno "select company_id from public.risks where company_id is not null group by 1 order by count(*) desc, 1 limit 1")
  psql_rama -v "pass=$pass" <<'EOF' >/dev/null
begin;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', x.email,
       extensions.crypt(:'pass', extensions.gen_salt('bf', 10)), now(), x.app, x.meta, now(), now(), '', '', '', ''
  from (values
    ('qa.staging.cliente@example.com', '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"QA Cliente","company_name":"QA Cliente, S.A."}'::jsonb),
    ('qa.staging.mentora@example.com', '{"provider":"email","providers":["email"],"role":"mentor"}'::jsonb,
     '{"full_name":"QA Mentora","company_name":"QA Mentoría"}'::jsonb)) as x(email, app, meta);
insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
  from auth.users u where u.email like 'qa.staging.%@example.com';
-- La empresa del cliente (se la abrió el alta) recibe Análisis Financiero y un análisis mínimo.
insert into public.company_modules (company_id, module_key)
select m.company_id, 'fin-analysis' from public.company_members m join auth.users u on u.id = m.user_id
 where u.email = 'qa.staging.cliente@example.com' on conflict do nothing;
with a as (
  insert into public.fin_analyses (owner_id, created_by_id, company_name)
  select id, id, 'QA Cliente' from auth.users where email = 'qa.staging.cliente@example.com' returning id
), y as (
  insert into public.fin_years (analysis_id, year, months) select id, 2025, 12 from a returning id, analysis_id
)
insert into public.fin_values (analysis_id, year_id, section, concept_key, amount)
select analysis_id, id, 'income', 'ventas', 1000 from y;
insert into public.company_mentors (company_id, mentor_id, modules)
select m.company_id, (select id from auth.users where email = 'qa.staging.mentora@example.com'), array['fin-analysis']
  from public.company_members m join auth.users u on u.id = m.user_id
 where u.email = 'qa.staging.cliente@example.com';
commit;
EOF
  STAGING_URL="$R_URL" STAGING_KEY="$R_KEY" QA_PASSWORD="$pass" OTRA_EMPRESA="$otra" ORIGEN="$URL_STAGING" \
    node scripts/check-staging.mjs || falla=1
  quitar_qa
  despues=$(uno "select (select count(*) from auth.users) || ' usuarios, ' || (select count(*) from public.companies) || ' empresas'")
  [ "$antes" = "$despues" ] || { echo "ALTO: las cuentas de prueba no se borraron bien (antes: $antes; ahora: $despues)."; exit 1; }
  echo "    Cuentas de prueba borradas: la rama quedó con $despues."
  return $falla
}

# ── Comandos ─────────────────────────────────────────────────────────────────

estado() {
  rama; conectar_bd
  echo "Rama «$RAMA» de Supabase: $R_REF  ·  $R_URL"
  psql_rama <<'EOF'
select 'Estructura de producción: ' || case when to_regclass('public.risks') is null then 'NO está' else 'sí' end;
select 'Fases de empresas: ' || case when to_regclass('public.companies') is null then 'sin aplicar'
       when to_regclass('public.company_mentors') is null
         or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'industry')
       then 'incompletas' else 'aplicadas' end;
select 'Datos: ' || (select count(*) from auth.users) || ' usuarios · ' || (select count(*) from public.risks) || ' riesgos · '
    || (select count(*) from public.strategic_plans) || ' planes · ' || (select count(*) from public.fin_analyses) || ' análisis financieros';
EOF
  if [ "$(uno "select to_regclass('public.companies') is not null")" = "t" ]; then
    uno "select 'Empresas: ' || (select count(*) from public.companies) || ' · mentores asignados: ' || (select count(*) from public.company_mentors)"
  fi
  [ -f "$ACCESOS" ] && sed -n 's/^Datos: copia/Copia/p' "$ACCESOS"
  echo "Funciones desplegadas en la rama:"
  supabase functions list --remote="$R_REF" 2>/dev/null | grep -oE '"slug":"(ia|mcp)"[^}]*"version":[0-9]+' \
    | sed -E 's/"slug":"([a-z]+)".*"version":([0-9]+)/  \1 (despliegue \2)/' || echo "  (ninguna)"
  local tiene falta=()
  tiene=$(supabase secrets list --remote="$R_REF" 2>/dev/null || true)
  for s in $SECRETOS; do print -r -- "$tiene" | grep -q "$s" || falta+=($s); done
  if (( ${#falta} )); then echo "Secretos que faltan en la rama: ${falta[*]}"; else echo "Secretos de las funciones: completos"; fi
  local net
  net=$(netlify env:get VITE_SUPABASE_URL --context "$CONTEXTO" --site "$SITIO" 2>/dev/null || true)
  if [ "$net" = "$R_URL" ]; then echo "Netlify: staging apunta a esta rama"
  else echo "Netlify: staging todavía NO apunta a esta rama (npm run db:staging:conectar)"; fi
}

preparar() {
  rama; conectar_bd
  echo "Destino: rama «$RAMA» ($R_REF). Producción ($PROD) solo se lee."
  if [ "$(uno "select to_regclass('public.risks') is not null")" != "t" ]; then
    echo "La rama no trae la estructura de producción (falta public.risks). Revisa cómo se creó antes de seguir."; exit 1
  fi
  local usuarios fases f
  usuarios=$(uno "select count(*) from auth.users")
  fases=$(uno "select to_regclass('public.companies') is not null")

  if [ "$usuarios" = "0" ]; then
    echo "1/6 Copia de los datos de producción (solo lectura)…"
    copiar_produccion
    echo "2/6 Carga de la copia en la rama…"
    cargar_copia
  else
    echo "1/6 y 2/6 La rama ya tiene datos ($usuarios usuarios): no se vuelven a copiar."
    # Si el estreno aún no se hizo, la rama debe seguir idéntica a la copia.
    if [ "$fases" != "t" ] && [ -f "$COPIA" ]; then verificar_copia; fi
  fi

  echo "3/6 Triggers de alta de usuarios (como en producción)…"
  psql_rama <<'EOF'
DO $$
BEGIN
  IF to_regprocedure('public.grant_default_module_access()') IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'grant_default_module_access') THEN
    CREATE TRIGGER grant_default_module_access AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.grant_default_module_access();
  END IF;
  IF to_regprocedure('public.strip_role_from_user_metadata()') IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'strip_role_from_user_metadata') THEN
    CREATE TRIGGER strip_role_from_user_metadata BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.strip_role_from_user_metadata();
  END IF;
END $$;
EOF

  local H="$HUELLAS/$R_REF"
  if [ "$fases" != "t" ]; then
    echo "4/6 Estreno de empresas, igual que se hará en producción…"
    mkdir -p "$H"; rm -f "$H/ensayo-ok"
    echo "    Huella de lo que ve cada usuario antes de migrar…"
    huella > "$H/antes.txt"
    echo "    ${FASES[1]}"; aplicar "${FASES[1]}"
    huella > "$H/fase1.txt"; comparar "$H/antes.txt" "$H/fase1.txt"
    prueba_sql scripts/check-empresas.sql
    for f in ${FASES[2,-1]}; do echo "    $f"; aplicar "$f"; done
    huella > "$H/despues.txt"
  elif [ -f "$H/despues.txt" ] && [ ! -f "$H/ensayo-ok" ]; then
    echo "4/6 Las fases de empresas ya están aplicadas: se retoma la comprobación del estreno…"
  else
    echo "4/6 Las fases de empresas ya estaban: se aplican otra vez (no cambian nada)…"
    for f in $FASES; do echo "    $f"; aplicar "$f"; done
  fi
  # Comprobación del estreno completo. Solo vale con la rama recién migrada:
  # las pruebas suponen que nadie la ha usado todavía.
  if [ -f "$H/despues.txt" ] && [ ! -f "$H/ensayo-ok" ]; then
    uno "select user_id || '|' || string_agg(module_key, ',') from public.user_module_access group by user_id" > "$H/modulos.txt"
    comparar "$H/antes.txt" "$H/despues.txt" "$H/modulos.txt"
    prueba_sql scripts/check-empresas-usuarios.sql
    prueba_sql scripts/check-empresas-mentores.sql
    touch "$H/ensayo-ok"
  fi

  echo "5/6 Códigos de invitación para registrar empresas en staging…"
  psql_rama <<'EOF'
insert into public.invitation_codes (code, notes)
select upper(substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4)), 'Staging: código de prueba'
  from (select md5(gen_random_uuid()::text) as h
          from generate_series(1, greatest(0, 5 - (select count(*)::int from public.invitation_codes
                                                    where not coalesce(used, false) and notes like 'Staging:%')))) s;
notify pgrst, 'reload schema';
EOF
  local codigos fecha="fecha desconocida"
  codigos=$(uno "select code from public.invitation_codes where not coalesce(used, false) and notes like 'Staging:%' order by created_at, code")
  [ -f "$COPIA" ] && fecha=$(date -r "$COPIA" '+%Y-%m-%d %H:%M')
  {
    echo "Staging: rama «$RAMA» de Supabase ($R_REF)"
    echo "Sitio: $URL_STAGING"
    echo "Datos: copia de producción del $fecha"
    echo
    echo "Se entra con el mismo correo y la misma contraseña que en producción."
    echo "Lo que se haga aquí no llega a producción."
    echo
    echo "Códigos de invitación para registrar empresas nuevas en staging (un uso cada uno):"
    print -r -- "$codigos" | sed 's/^/  /'
  } > "$ACCESOS"
  chmod 600 "$ACCESOS"

  echo "6/6 Prueba por la API de la rama, con dos cuentas temporales…"
  sleep 3   # da tiempo a que la API recargue la estructura
  prueba_api

  echo
  echo "Rama lista. Códigos de invitación de staging: $ACCESOS"
  echo "Falta lo que solo hace Tenryu (las funciones de la rama son copia de las de producción):"
  echo "  supabase functions deploy ia  --no-verify-jwt --remote=$R_REF"
  echo "  supabase functions deploy mcp --no-verify-jwt --remote=$R_REF"
  echo "  supabase secrets set ANTHROPIC_API_KEY=… --remote=$R_REF      # para probar la IA"
  echo "Y conectar el sitio: npm run db:staging:conectar"
}

# Apunta el despliegue de la rama git `staging` a la rama de Supabase. Los
# valores de producción no cambian: se comprueba antes de terminar.
conectar() {
  rama
  local antes despues ahora
  # Huella de los dos valores de producción (dirección + llave), sin mostrarlos.
  huella_prod() {
    { netlify env:get VITE_SUPABASE_URL --context production --site "$SITIO" 2>/dev/null
      netlify env:get VITE_SUPABASE_ANON_KEY --context production --site "$SITIO" 2>/dev/null; } | shasum | cut -c1-16
  }
  [[ "$(netlify env:get VITE_SUPABASE_URL --context production --site "$SITIO" 2>/dev/null)" == *"$PROD"* ]] \
    || { echo "No pude leer el valor de producción en Netlify; no cambio nada."; exit 1; }
  antes=$(huella_prod)
  netlify env:set VITE_SUPABASE_URL "$R_URL" --context "$CONTEXTO" --site "$SITIO" --force >/dev/null
  netlify env:set VITE_SUPABASE_ANON_KEY "$R_KEY" --context "$CONTEXTO" --site "$SITIO" --force >/dev/null
  despues=$(huella_prod)
  ahora=$(netlify env:get VITE_SUPABASE_URL --context "$CONTEXTO" --site "$SITIO" 2>/dev/null)
  if [ "$despues" != "$antes" ]; then
    echo "ALTO: cambiaron los valores de PRODUCCIÓN en Netlify. Restáuralos antes del siguiente despliegue de main"
    echo "(son los de tu archivo .env):"
    echo "  netlify env:set VITE_SUPABASE_URL https://$PROD.supabase.co --context production --site $SITIO"
    echo "  netlify env:set VITE_SUPABASE_ANON_KEY <llave de .env> --context production --site $SITIO"; exit 1
  fi
  [ "$ahora" = "$R_URL" ] || { echo "Netlify no guardó el valor de staging. Revisa en el panel de Netlify."; exit 1; }
  echo "Netlify: el despliegue de «staging» usará la rama $R_REF. Producción sigue en $PROD."
  echo "Surte efecto en el siguiente despliegue de staging (al subir código o con «Trigger deploy»)."
}

case "$1" in
  estado) estado ;;
  preparar) preparar ;;
  conectar) conectar ;;
  *) echo "Uso: $0 estado | preparar | conectar   (RAMA=nombre para otra rama)"; exit 1 ;;
esac
