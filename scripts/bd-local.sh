#!/bin/zsh
# Base de datos local de pruebas, copiada de producción.
# Uso (desde la raíz del repo):
#   npm run db:local:copiar   → baja esquema y datos de producción (solo lectura)
#   npm run db:local:cargar   → borra la base LOCAL y le carga la última copia
# Guía completa: docs/BD-LOCAL.md
#
# Producción solo se LEE. `supabase db reset` sin --remote actúa sobre la base
# local; este script nunca pasa --remote a un comando que escriba.
set -e
cd "$(dirname "$0")/.."

DIR="supabase/local"            # ignorada por git: contiene datos reales
ENVFILE=".env.localdb.local"    # ignorado por git (*.local)

# Tablas de Auth con sesiones y tokens vivos de producción: no se copian.
SIN_DATOS="auth.sessions,auth.refresh_tokens,auth.one_time_tokens,auth.flow_state,auth.audit_log_entries,auth.mfa_amr_claims,auth.mfa_challenges,auth.mfa_factors,auth.oauth_authorizations,auth.oauth_consents,auth.oauth_client_states,storage.bucket_lifecycle_states,storage.lifecycle_abandoned_artifacts"

copiar() {
  mkdir -p "$DIR"
  echo "Copiando de producción (solo lectura)…"
  supabase db dump --remote --role-only -f "$PWD/$DIR/roles.sql" >/dev/null
  supabase db dump --remote -f "$PWD/$DIR/schema.sql" >/dev/null
  supabase db dump --remote --data-only --use-copy -x "$SIN_DATOS" -f "$PWD/$DIR/data.sql" >/dev/null
  # Los triggers sobre auth.users no entran en el volcado del esquema público.
  cat > "$DIR/auth-triggers.sql" <<'EOF'
DROP TRIGGER IF EXISTS grant_default_module_access ON auth.users;
CREATE TRIGGER grant_default_module_access AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_module_access();
DROP TRIGGER IF EXISTS strip_role_from_user_metadata ON auth.users;
CREATE TRIGGER strip_role_from_user_metadata BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.strip_role_from_user_metadata();
EOF
  echo "Copia guardada en $DIR/"
}

cargar() {
  for f in roles schema data auth-triggers; do
    [ -f "$DIR/$f.sql" ] || { echo "Falta $DIR/$f.sql — corre primero: npm run db:local:copiar"; exit 1; }
  done
  supabase status >/dev/null 2>&1 || supabase start -x logflare,vector,imgproxy,supavisor >/dev/null
  echo "Reiniciando la base LOCAL…"
  supabase db reset --no-seed >/dev/null
  DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_hcmeoducjqudokfhhvyc$')
  for f in roles schema data auth-triggers; do
    echo "Cargando $f…"
    docker exec -i -e PGPASSWORD=postgres "$DB" \
      psql -h 127.0.0.1 -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1 < "$DIR/$f.sql" >/dev/null
  done
  # Variables para `npm run dev:local` (las llaves locales no son secretas,
  # pero igual se quedan fuera del repo).
  supabase status -o env 2>/dev/null | awk -F= '
    /^API_URL=/  { gsub(/"/, "", $2); print "VITE_SUPABASE_URL=" $2 }
    /^ANON_KEY=/ { sub(/^ANON_KEY=/, ""); gsub(/"/, ""); print "VITE_SUPABASE_ANON_KEY=" $0 }
  ' > "$ENVFILE"
  docker exec -i "$DB" psql -U postgres -d postgres -At -c \
    "select 'Listo: ' || (select count(*) from auth.users) || ' usuarios, ' || (select count(*) from public.risks) || ' riesgos, ' || (select count(*) from public.fin_analyses) || ' análisis financieros'"
}

case "$1" in
  copiar) copiar ;;
  cargar) cargar ;;
  *) echo "Uso: $0 copiar | cargar"; exit 1 ;;
esac
