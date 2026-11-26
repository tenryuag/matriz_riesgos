#!/bin/zsh
# Staging con su propia base de datos: una rama de Supabase del proyecto de
# producción, con datos de ejemplo. Guía completa: docs/STAGING.md
#
# Uso (desde la raíz del repo):
#   npm run db:staging:exportar  → regenera supabase-seed-staging.sql desde la base LOCAL
#   npm run db:staging:estado    → qué hay hoy en la rama (solo lee)
#   npm run db:staging:preparar  → deja la rama lista: empresas + datos de ejemplo
#   npm run db:staging:conectar  → apunta el sitio de staging (Netlify) a la rama
#
# Producción nunca se escribe desde aquí. Las credenciales de la rama las pide
# la CLI de Supabase en cada corrida (`supabase branches get`), que no las
# entrega para producción; además, el script se detiene si el destino resulta
# ser el proyecto de producción.
set -e
cd "$(dirname "$0")/.."

PROD="hcmeoducjqudokfhhvyc"              # producción: solo se consulta su lista de ramas
RAMA="${RAMA:-staging}"                  # nombre de la rama en Supabase
SITIO="matrizriesgos"                    # sitio de Netlify
CONTEXTO="branch:staging"                # despliegue de la rama git `staging`
URL_STAGING="https://staging--matrizriesgos.netlify.app"
DB="supabase_db_hcmeoducjqudokfhhvyc"    # contenedor de la base local: se usa su psql
SEMILLA="supabase-seed-staging.sql"
ACCESOS="supabase/local/staging-accesos.txt"   # ignorado por git: contraseña y códigos
FASES=(supabase-empresas.sql supabase-empresas-usuarios.sql supabase-empresas-mentores.sql)
SECRETOS=(ANTHROPIC_API_KEY PUBLISHABLE_KEY PUBLIC_MCP_URL PUBLIC_APP_URL)

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
    echo "ALTO: «$RAMA» apunta a producción ($PROD). Este script solo trabaja sobre una rama."; exit 1
  fi
}

# psql de la base local, conectado a la rama. El SQL entra por la entrada estándar.
psql_rama() {
  PGURL="$R_CONN" docker exec -i -e PGURL -e PGCONNECT_TIMEOUT=20 "$DB" \
    sh -c 'exec psql "$PGURL" -q -At -v ON_ERROR_STOP=1 "$@"' sh "$@"
}

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

exportar() {
  necesita_local
  local tmp; tmp=$(mktemp)
  docker exec -i -e PGPASSWORD=postgres "$DB" psql -h 127.0.0.1 -U supabase_admin -d postgres -q \
    -v ON_ERROR_STOP=1 < scripts/staging-exportar.sql > "$tmp"
  mv "$tmp" "$SEMILLA"
  echo "Generado $SEMILLA:"
  grep -E '^-- [a-z_]+: [0-9]+ filas' "$SEMILLA" | sed 's/^-- /  /'
}

estado() {
  rama; conectar_bd
  echo "Rama «$RAMA» de Supabase: $R_REF  ·  $R_URL"
  psql_rama <<'EOF'
select 'Estructura de producción: ' || case when to_regclass('public.risks') is null then 'NO está' else 'sí' end;
select 'Fases de empresas: ' || case when to_regclass('public.companies') is null then 'sin aplicar'
       when to_regclass('public.company_mentors') is null
         or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'industry')
       then 'incompletas' else 'aplicadas' end;
select 'Usuarios: ' || count(*) || ' (' || count(*) filter (where email like 'demo.%@example.com') || ' de demostración)' from auth.users;
EOF
  if [ "$(print "select to_regclass('public.companies') is not null" | psql_rama)" = "t" ]; then
    psql_rama <<'EOF'
select 'Empresas: ' || (select count(*) from public.companies) || ' · riesgos: ' || (select count(*) from public.risks)
    || ' · análisis financieros: ' || (select count(*) from public.fin_analyses)
    || ' · códigos de invitación libres: ' || (select count(*) from public.invitation_codes where not coalesce(used, false));
EOF
  fi
  echo "Funciones desplegadas en la rama:"
  supabase functions list --remote="$R_REF" 2>/dev/null | grep -E '\b(ia|mcp)\b' | sed 's/^/  /' || echo "  (ninguna)"
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
  [ -f "$SEMILLA" ] || { echo "Falta $SEMILLA. Genéralo con: npm run db:staging:exportar"; exit 1; }
  rama; conectar_bd
  echo "Destino: rama «$RAMA» ($R_REF). Producción ($PROD) no se toca."

  local reales
  reales=$(print "select count(*) from auth.users where email not like 'demo.%@example.com'" | psql_rama)
  if [ "$reales" -gt 25 ]; then
    echo "ALTO: esa base tiene $reales usuarios que no son de demostración. No cargo datos de ejemplo ahí."; exit 1
  fi
  if [ "$(print "select to_regclass('public.risks') is not null" | psql_rama)" != "t" ]; then
    echo "La rama no trae la estructura de producción (falta public.risks). Revisa cómo se creó antes de seguir."; exit 1
  fi

  echo "1/5 Triggers de acceso (como en producción)…"
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

  echo "2/5 Empresas, usuarios y mentores (los tres SQL del estreno)…"
  local f
  for f in $FASES; do echo "    $f"; aplicar "$f"; done

  echo "3/5 Datos de ejemplo…"
  aplicar "$SEMILLA"

  echo "4/5 Contraseña de las cuentas demo y códigos de invitación…"
  local pass="${DEMO_PASSWORD:-}"
  if [ -z "$pass" ] && [ -f "$ACCESOS" ]; then pass=$(sed -n 's/^Contraseña (la misma para todas): //p' "$ACCESOS" | head -1); fi
  [ -n "$pass" ] || pass=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-16)
  psql_rama -v "pass=$pass" <<'EOF'
update auth.users set encrypted_password = extensions.crypt(:'pass', extensions.gen_salt('bf', 10)), updated_at = now()
 where email like 'demo.%@example.com';
insert into public.invitation_codes (code, notes)
select upper(substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4)), 'Staging: código de prueba'
  from (select md5(gen_random_uuid()::text) as h
          from generate_series(1, greatest(0, 5 - (select count(*)::int from public.invitation_codes
                                                    where not coalesce(used, false) and notes like 'Staging:%')))) s;
notify pgrst, 'reload schema';
EOF
  local codigos
  codigos=$(print "select code from public.invitation_codes where not coalesce(used, false) and notes like 'Staging:%' order by created_at, code" | psql_rama)

  mkdir -p "$(dirname "$ACCESOS")"
  {
    echo "Accesos de STAGING (rama «$RAMA» de Supabase, $R_REF) — datos de ejemplo, no reales"
    echo "Sitio: $URL_STAGING"
    echo
    echo "Contraseña (la misma para todas): $pass"
    echo
    echo "demo.admin@example.com       Carlos Méndez · administrador de «Metalmecánica del Bajío» (los tres módulos)"
    echo "demo.ana@example.com         Ana López · miembro con «solo ver» en los tres módulos"
    echo "demo.invitacion@example.com  miembro sin módulos asignados"
    echo "demo.mentora@example.com     Marta Ruiz · mentora de «Metalmecánica del Bajío» en Análisis Financiero"
    echo "demo.plataforma@example.com  Paula Admin · administradora de la plataforma (panel «Empresas»)"
    echo
    echo "Códigos de invitación para registrar empresas nuevas (un uso cada uno):"
    print -r -- "$codigos" | sed 's/^/  /'
  } > "$ACCESOS"
  chmod 600 "$ACCESOS"

  echo "5/5 Comprobación con las cuentas demo, por la API de la rama…"
  sleep 3   # da tiempo a que la API recargue la estructura
  STAGING_URL="$R_URL" STAGING_KEY="$R_KEY" DEMO_PASSWORD="$pass" node scripts/check-staging.mjs

  echo
  echo "Rama lista. Cuentas, contraseña y códigos: $ACCESOS"
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
  exportar) exportar ;;
  estado) estado ;;
  preparar) preparar ;;
  conectar) conectar ;;
  *) echo "Uso: $0 exportar | estado | preparar | conectar   (RAMA=nombre para otra rama)"; exit 1 ;;
esac
