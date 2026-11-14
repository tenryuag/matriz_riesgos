#!/bin/zsh
# Ensayo de supabase-empresas.sql en la base LOCAL (docs/BD-LOCAL.md).
# Compara, usuario por usuario, qué filas ve cada quien antes y después de la
# migración, y luego prueba el aislamiento entre empresas.
#   Uso: npm run db:local:cargar && scripts/check-empresas.sh
set -e
cd "$(dirname "$0")/.."
DB=supabase_db_hcmeoducjqudokfhhvyc
TMP=$(mktemp -d)
psqlq() { docker exec -i "$DB" psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 "$@"; }

TABLES=(risks departments strategic_plans plan_answers competitors strategic_initiatives fin_analyses fin_lines fin_years fin_values)

# Huella de lo que ve cada usuario bajo RLS (contenido de todas las tablas).
snapshot() {
  local cols=""
  for t in $TABLES; do
    cols+=", (select count(*) || ':' || md5(coalesce(string_agg(h, ',' order by h), '')) from (select md5((to_jsonb(x) - 'company_id')::text) h from public.$t x) q)"
  done
  psqlq -c "select id from auth.users order by id" | while read -r uid; do
    echo "begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', true); select '$uid'$cols; commit;"
  done | psqlq -q | grep -E '^[0-9a-f-]{36}\|'
}

if psqlq -c "select to_regclass('public.companies') is not null" | grep -q t; then
  echo "La base local ya tiene empresas. Corre antes: npm run db:local:cargar"; exit 1
fi

echo "1. Huella antes de migrar…";  snapshot > "$TMP/antes.txt"
echo "2. Aplicando supabase-empresas.sql…"; psqlq -q < supabase-empresas.sql
echo "3. Huella después de migrar…"; snapshot > "$TMP/despues.txt"
if diff -q "$TMP/antes.txt" "$TMP/despues.txt" >/dev/null; then
  echo "   OK: los $(wc -l < "$TMP/antes.txt" | tr -d ' ') usuarios ven exactamente las mismas filas."
else
  echo "   FALLA: cambia lo que ven estos usuarios:"; diff "$TMP/antes.txt" "$TMP/despues.txt" | head -20; exit 1
fi
echo "4. Segunda corrida (debe ser inofensiva)…"; psqlq -q < supabase-empresas.sql
snapshot > "$TMP/despues2.txt"; diff -q "$TMP/antes.txt" "$TMP/despues2.txt" >/dev/null && echo "   OK"

echo "5. Conteos y aislamiento…"
psqlq -q < scripts/check-empresas.sql
