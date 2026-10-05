-- ============================================================
-- PERSPECTIVAS — Limpieza final (para MUCHO después de la Fase 0)
-- ============================================================
-- Cierra el proyecto "Perspectivas" cuando TODO lo demás ya está hecho.
-- Hace exactamente tres cosas:
--   1. risks.perspective_key pasa a NOT NULL (toda la matriz ya está
--      organizada por perspectiva).
--   2. Retira la política redundante de borrado de departments que dejó
--      supabase-departments-delete-policy.sql (ver nota en
--      supabase-risk-rls-policies.sql).
--   3. Borra el esquema backup con las fotos previas (§0(c) de
--      supabase-perspectivas.sql).
--
-- NO BORRA: la tabla departments, la columna risks.department_id (ni su
-- FK), ni las columnas de texto inherent_level / residual_level. Siguen
-- como referencia histórica; si algún día se retiran será en otro script.
--
-- ⚠️ CONDICIONES — las CUATRO deben cumplirse antes de correrlo:
--   1. Producción ya desplegó la versión de la app que trabaja con
--      perspectivas (captura y edición exigen perspective_key).
--   2. Corre antes supabase-seed-cleanup.sql: el seed siembra A PROPÓSITO un
--      riesgo demo SIN perspectiva (para probar el asistente de migración) y
--      el SET NOT NULL fallaría con él. Si después quieres volver a sembrar,
--      actualiza ese riesgo en supabase-seed-sandbox.sql con perspective_key.
--   3. SELECT count(*) FROM risks WHERE perspective_key IS NULL  = 0 en las
--      cuentas activas. Ojo: SET NOT NULL exige que TODAS las filas tengan
--      valor, también las de cuentas suspendidas que ya no entran a la app;
--      para esas, el paso 1 de abajo rellena con el mapa por departamento.
--   4. Fuera de horario laboral: en cuanto perspective_key sea NOT NULL,
--      una pestaña abierta con la versión ANTERIOR de la app ya no podrá
--      guardar riesgos (manda la fila sin perspectiva) hasta recargar.
--
-- Idempotente: SET NOT NULL sobre una columna que ya lo es no hace nada;
-- DROP POLICY / DROP SCHEMA llevan IF EXISTS. Si algo falla, el SQL Editor
-- revierte todo el lote (es una sola transacción).
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

-- ---------- 0. Diagnóstico previo (solo lectura) ----------
-- Riesgos sin perspectiva por cuenta y si la cuenta está suspendida.
-- Esperado: 0 filas. Si aparecen cuentas ACTIVAS, pídeles que asignen la
-- perspectiva desde la app antes de seguir.
SELECT r.created_by_id, u.email,
       (u.banned_until IS NOT NULL AND u.banned_until > now()) AS suspendida,
       count(*) AS riesgos_sin_perspectiva
FROM public.risks r
LEFT JOIN auth.users u ON u.id = r.created_by_id
WHERE r.perspective_key IS NULL
GROUP BY r.created_by_id, u.email, u.banned_until
ORDER BY riesgos_sin_perspectiva DESC;

-- ---------- 1. Relleno con el mapa por departamento (no destructivo) ----------
-- Solo toca filas con perspective_key NULL cuyo departamento sí tenga
-- perspectiva asignada (departments.perspective_key, §2 de la Fase 0).
-- Pensado para cuentas suspendidas que no pueden asignarla desde la app.
-- No sobreescribe nada que el usuario ya haya elegido.
UPDATE public.risks r
SET perspective_key = d.perspective_key
FROM public.departments d
WHERE d.id = r.department_id
  AND r.perspective_key IS NULL
  AND d.perspective_key IS NOT NULL;

-- ---------- 2. Guarda: si queda algún NULL, se detiene TODO el lote ----------
-- SET NOT NULL fallaría de todos modos; esto da un mensaje claro con el
-- conteo y evita llegar a los DROP de abajo con la columna a medias.
DO $$
DECLARE
  v_sin_perspectiva integer;
BEGIN
  SELECT count(*) INTO v_sin_perspectiva
  FROM public.risks
  WHERE perspective_key IS NULL;

  IF v_sin_perspectiva > 0 THEN
    RAISE EXCEPTION 'Hay % riesgo(s) sin perspective_key. Asigna la perspectiva (desde la app o con el mapa por departamento del paso 1) y vuelve a correr este script.',
      v_sin_perspectiva;
  END IF;

  RAISE NOTICE 'Todos los riesgos tienen perspectiva; se aplica NOT NULL.';
END $$;

-- ---------- 3. perspective_key obligatoria ----------
ALTER TABLE public.risks ALTER COLUMN perspective_key SET NOT NULL;

-- ---------- 4. Política redundante de departments ----------
-- La política "delete" (auth.uid() = created_by_id) ya cubre el borrado
-- por dueño; esta otra (USING true) sobraba. Quitarla no cambia el
-- comportamiento porque la política de lectura ya limita las filas
-- alcanzables.
DO $$
BEGIN
  -- Solo si existe otra política de DELETE (la de dueño); si no, conservarla.
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'departments'
                AND cmd = 'DELETE'
                AND policyname <> 'Usuarios autenticados pueden eliminar departamentos') THEN
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar departamentos" ON public.departments;
  ELSE
    RAISE NOTICE 'departments no tiene otra política de DELETE: se conserva la existente.';
  END IF;
END $$;

-- ---------- 5. Respaldo de la Fase 0 ----------
-- Borra backup.risks_20261005, backup.departments_20261005 y
-- backup.strategic_initiatives_20261005 (y cualquier otra foto que hayas
-- dejado ahí). Si prefieres conservarlas un tiempo más, comenta esta línea.
DROP SCHEMA IF EXISTS backup CASCADE;

-- ---------- Verificación ----------
-- Esperado: NO · 0 · 0
SELECT
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'perspective_key') AS perspective_key_nullable,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'departments'
      AND policyname = 'Usuarios autenticados pueden eliminar departamentos')                  AS politica_redundante,
  (SELECT count(*) FROM pg_namespace WHERE nspname = 'backup')                                  AS esquema_backup;
