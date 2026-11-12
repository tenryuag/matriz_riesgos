-- ============================================================
-- Asistente de IA (Claude) dentro de la app
-- ============================================================
-- Dos tablas de apoyo para la Edge Function `ia`, que llama a la API de
-- Claude con la llave guardada como secreto en el servidor:
--
--   ia_usage       bitácora de cada llamada (tokens, costo en USD, acción,
--                  usuario). Alimenta los topes de gasto y el panel "Uso de IA"
--                  del módulo de administración.
--   ia_resultados  resultados que vale la pena guardar (interpretación del
--                  informe, resumen ejecutivo) con la huella de los datos con
--                  que se generaron: si los datos no cambiaron, la app muestra
--                  el resultado guardado sin volver a gastar.
--
-- Escritura: SOLO la Edge Function (rol service_role). Lectura: cada usuario
-- lee lo suyo; los administradores (public.is_admin()) leen todo el uso.
--
-- Topes de gasto atómicos: antes de llamar a Claude la Edge Function llama a
-- ia_reserve(), que bajo un candado por usuario comprueba los topes e inserta
-- en ia_usage una fila con error_code = 'en_curso' (ok = false) y el costo
-- estimado de la acción. Esas filas 'en_curso' CUENTAN para los topes (gasto
-- y número de llamadas) mientras la llamada está en marcha, y al terminar la
-- Edge Function las completa con los tokens y el costo reales (ok = true) o
-- las borra si al final no hubo llamada a la IA (resultado guardado, error
-- sin costo).
--
-- Requiere public.is_admin() (supabase-fix-role-security.sql).
-- Ejecutar en Supabase → SQL Editor (idempotente).
-- ============================================================

-- 1. Bitácora de llamadas
CREATE TABLE IF NOT EXISTS ia_usage (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  action             TEXT NOT NULL,
  model              TEXT,
  input_tokens       INT NOT NULL DEFAULT 0,
  output_tokens      INT NOT NULL DEFAULT 0,
  cache_read_tokens  INT NOT NULL DEFAULT 0,
  cache_write_tokens INT NOT NULL DEFAULT 0,
  cost_usd           NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms        INT,
  ok                 BOOLEAN NOT NULL DEFAULT true,
  error_code         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_usage_user_created ON ia_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_usage_created ON ia_usage(created_at DESC);

ALTER TABLE ia_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own ia usage" ON ia_usage;
CREATE POLICY "read own ia usage"
  ON ia_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin read all ia usage" ON ia_usage;
CREATE POLICY "admin read all ia usage"
  ON ia_usage FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));
-- Sin política de INSERT/UPDATE/DELETE para authenticated: solo service_role escribe.

-- 2. Resultados guardados (uno por usuario y tipo)
CREATE TABLE IF NOT EXISTS ia_resultados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  kind        TEXT NOT NULL,          -- 'informe' | 'resumen_ejecutivo'
  input_hash  TEXT NOT NULL,          -- huella de los datos de entrada
  model       TEXT,
  result      JSONB NOT NULL,
  cost_usd    NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

ALTER TABLE ia_resultados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own ia results" ON ia_resultados;
CREATE POLICY "read own ia results"
  ON ia_resultados FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- Escritura solo desde la Edge Function (service_role).

-- 3. Totales para los topes de gasto. La llama la Edge Function (service_role)
--    antes de cada petición: gasto y llamadas del usuario en las últimas 24 h
--    y gasto global de los últimos 30 días.
CREATE OR REPLACE FUNCTION public.ia_usage_window(p_user UUID)
RETURNS TABLE (user_24h_usd NUMERIC, user_24h_calls BIGINT, global_30d_usd NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(cost_usd) FROM ia_usage
               WHERE user_id = p_user AND created_at > now() - interval '24 hours'), 0),
    COALESCE((SELECT COUNT(*) FROM ia_usage
               WHERE user_id = p_user AND created_at > now() - interval '24 hours'), 0),
    COALESCE((SELECT SUM(cost_usd) FROM ia_usage
               WHERE created_at > now() - interval '30 days'), 0);
$$;
REVOKE ALL ON FUNCTION public.ia_usage_window(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia_usage_window(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ia_usage_window(UUID) TO service_role;

-- 4. Resumen para el panel de administración: gasto por usuario (correo
--    incluido, que vive en auth.users y la app no puede leer directamente).
CREATE OR REPLACE FUNCTION public.ia_usage_by_user()
RETURNS TABLE (
  user_id UUID, email TEXT, full_name TEXT,
  calls BIGINT, calls_30d BIGINT, cost_usd NUMERIC, cost_30d_usd NUMERIC, last_call TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.user_id,
    au.email::TEXT,
    (au.raw_user_meta_data->>'full_name')::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE u.created_at > now() - interval '30 days')::BIGINT,
    COALESCE(SUM(u.cost_usd), 0),
    COALESCE(SUM(u.cost_usd) FILTER (WHERE u.created_at > now() - interval '30 days'), 0),
    MAX(u.created_at)
  FROM ia_usage u
  LEFT JOIN auth.users au ON au.id = u.user_id
  WHERE public.is_admin()
  GROUP BY u.user_id, au.email, au.raw_user_meta_data->>'full_name'
  ORDER BY 7 DESC;
$$;
REVOKE ALL ON FUNCTION public.ia_usage_by_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ia_usage_by_user() TO authenticated;

-- 5. Reserva atómica de una llamada. La llama la Edge Function (service_role)
--    ANTES de cada petición a Claude, en lugar de leer ia_usage_window() y
--    escribir la bitácora al final (lo que dejaba pasar peticiones en paralelo
--    del mismo usuario). Bajo un candado de transacción por usuario:
--      - si gasto_24h + estimado > tope diario, o llamadas_24h >= tope de
--        llamadas → (NULL, 'limite_diario');
--      - si gasto_global_30d + estimado > tope mensual → (NULL, 'limite_global');
--      - si no, inserta en ia_usage la fila 'en_curso' con el costo estimado y
--        devuelve (id, NULL). La Edge Function completa o borra esa fila al
--        terminar.
CREATE OR REPLACE FUNCTION public.ia_reserve(
  p_user UUID,
  p_action TEXT,
  p_est NUMERIC,
  p_daily_usd NUMERIC,
  p_daily_calls INT,
  p_monthly_usd NUMERIC
)
RETURNS TABLE (id UUID, motivo TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
  new_id UUID;
BEGIN
  -- Candado por usuario hasta el fin de la transacción: serializa las
  -- reservas concurrentes del mismo usuario.
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT * INTO w FROM public.ia_usage_window(p_user);

  IF w.user_24h_usd + p_est > p_daily_usd OR w.user_24h_calls >= p_daily_calls THEN
    RETURN QUERY SELECT NULL::UUID, 'limite_diario'::TEXT;
    RETURN;
  END IF;

  IF w.global_30d_usd + p_est > p_monthly_usd THEN
    RETURN QUERY SELECT NULL::UUID, 'limite_global'::TEXT;
    RETURN;
  END IF;

  INSERT INTO ia_usage (user_id, action, cost_usd, ok, error_code)
    VALUES (p_user, p_action, p_est, false, 'en_curso')
    RETURNING ia_usage.id INTO new_id;

  RETURN QUERY SELECT new_id, NULL::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.ia_reserve(UUID, TEXT, NUMERIC, NUMERIC, INT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia_reserve(UUID, TEXT, NUMERIC, NUMERIC, INT, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ia_reserve(UUID, TEXT, NUMERIC, NUMERIC, INT, NUMERIC) TO service_role;
