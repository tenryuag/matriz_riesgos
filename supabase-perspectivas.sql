-- ============================================================
-- PERSPECTIVAS — Fase 0: cimientos en la base de datos
-- ============================================================
-- Proyecto "Perspectivas" (aprobado): la Matriz de Riesgos se organizará
-- por 4 PERSPECTIVAS fijas (Balanced Scorecard) en lugar de departamentos
-- libres; todo riesgo con nivel INHERENTE Alto/Intolerable (puntaje
-- probabilidad × impacto >= 13) entrará a la Planeación Estratégica como
-- objetivo de prioridad alta con sus mitigantes; y el módulo financiero
-- podrá leer riesgos por perspectiva.
--
-- Esta Fase 0 NO cambia nada visible en la app: solo deja los cimientos.
--   §0  Verificación, diagnóstico y RESPALDO. Solo lectura, salvo el
--       respaldo y 4 funciones puras de puntaje que el diagnóstico usa.
--   §1  risks.perspective_key (NULL = sin asignar) + CHECK + índice.
--   §2  departments.perspective_key (mapa de migración; departments se queda).
--   §3  risks.department_id deja de ser obligatorio (columna y FK se quedan).
--   §4  Puntajes independientes del idioma (inherent_score, residual_score,
--       inherent_level_key, residual_level_key) mantenidos por un disparador
--       que NUNCA aborta el guardado, + backfill de las filas existentes.
--   §5  strategic_initiatives.source_key / strategy_label + índice único
--       (plan_id, source_key) para el upsert de iniciativas derivadas.
--   §6  Verificación final.
--
-- Catálogo de perspectivas (mismas claves que los carriles LANES del mapa
-- estratégico en src/pages/StrategicMap.jsx). Orden Balanced Scorecard:
--   financiera  → Finanzas
--   cliente     → Clientes
--   competitiva → Procesos y competitividad
--   equipo      → Equipo y talento
--
-- ⚠️ PRERREQUISITOS Y ORDEN
--   - Staging y producción comparten la MISMA base: esto se corre UNA sola
--     vez y aplica a ambos. Todo es ADITIVO: columnas nuevas (admiten NULL),
--     ningún DROP de datos, ninguna política RLS cambia. La app actual sigue
--     funcionando sin tocarla: al editar manda la fila completa (incluidas
--     las columnas nuevas, tal como las leyó) y el disparador las recalcula.
--   - Requiere haber corrido antes: supabase-per-user-plans.sql,
--     supabase-fix-role-security.sql, supabase-module-access-defaults.sql
--     y supabase-fin-analysis.sql (§0(a) lo comprueba).
--   - Orden recomendado:
--       1. Corre §0 completo (a, b y c). Revisa el diagnóstico de §0(b):
--          valores no reconocidos, riesgos que quedarían sin puntaje, etc.
--       2. Fuera de hora pico, corre §1–§6 (el backfill de §4 reescribe
--          TODAS las filas de risks).
--     También puede correrse el archivo completo de una vez. Es idempotente:
--     correrlo dos veces no produce efectos adicionales.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================



-- ============================================================
-- §0. VERIFICACIÓN, DIAGNÓSTICO Y RESPALDO
-- ============================================================

-- ---------- §0(a) Verificación de la base compartida (solo lectura) ----------
-- Cada consulta lleva en comentario el resultado esperado. Si alguna no
-- coincide, falta correr alguno de los scripts previos: NO sigas.

-- 1) Las 9 tablas de Estratégica, Financiero y accesos existen.   Esperado: 9
SELECT count(*) AS tablas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('strategic_plans', 'plan_answers', 'competitors',
                     'strategic_initiatives', 'user_module_access',
                     'fin_analyses', 'fin_years', 'fin_lines', 'fin_values');

-- 2) owner_id existe en strategic_plans y fin_analyses.             Esperado: 2
SELECT count(*) AS columnas_owner_id
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'owner_id'
  AND table_name IN ('strategic_plans', 'fin_analyses');

-- 3) Funciones de administración (app_metadata, suspensión, módulos). Esperado: 6
SELECT count(DISTINCT p.proname) AS funciones_admin
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'set_user_modules', 'set_user_role',
                    'list_users', 'suspend_user', 'reactivate_user');

-- 4) Políticas "solo el dueño" de Estratégica y Financiero.         Esperado: 8
SELECT count(*) AS politicas_owner
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'owner all%';

-- 5) Todo usuario tiene el módulo 'risk'.                           Esperado: 0
SELECT count(*) AS usuarios_sin_risk
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_module_access a
                  WHERE a.user_id = u.id AND a.module_key = 'risk');


-- ---------- §0(b).0 Funciones puras de puntaje (adelantadas de §4) ----------
-- El diagnóstico de abajo necesita las mismas funciones que usará el
-- disparador de §4, por eso se crean aquí. Son IMMUTABLE y PURAS: no leen
-- ni escriben ninguna tabla; crearlas no cambia ningún dato. Quedan
-- expuestas como RPC a usuarios autenticados, lo cual es inofensivo.
--
-- Contrato (igual que calculateRiskLevel en src/pages/AddRisk.jsx y
-- normalizeRiskLevel en src/lib/utils.js, pero independiente del idioma):
--   probabilidad 1..5 × impacto 1..5 = puntaje 1..25
--   <= 4 TOLERABLE · <= 8 LOW · <= 12 MEDIUM · <= 16 HIGH · > 16 INTOLERABLE
-- Cualquier texto no reconocido (vacío, legado, otro idioma) → NULL, nunca
-- error. Tolerantes a mayúsculas/minúsculas y espacios en los extremos.

-- Probabilidad: por prefijo (el catálogo lleva el rango entre paréntesis).
CREATE OR REPLACE FUNCTION public.risk_prob_idx(p text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT (CASE
    WHEN s.v ILIKE 'Remoto%'     OR s.v ILIKE 'Remote%'     THEN 1
    WHEN s.v ILIKE 'Improbable%' OR s.v ILIKE 'Unlikely%'   THEN 2
    WHEN s.v ILIKE 'Ocasional%'  OR s.v ILIKE 'Occasional%' THEN 3
    WHEN s.v ILIKE 'Probable%'   OR s.v ILIKE 'Likely%'     THEN 4
    WHEN s.v ILIKE 'Frecuente%'  OR s.v ILIKE 'Frequent%'   THEN 5
  END)::smallint
  FROM (SELECT btrim(p) AS v) AS s;
$$;

-- Impacto: por palabra completa ('Insignificant%' cubre Insignificante e
-- Insignificant; se aceptan también las variantes sin acento).
CREATE OR REPLACE FUNCTION public.risk_impact_idx(i text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT (CASE
    WHEN s.v ILIKE 'Insignificant%'                                              THEN 1
    WHEN s.v ILIKE 'Menor%'        OR s.v ILIKE 'Minor%'                           THEN 2
    WHEN s.v ILIKE 'Crítico%'      OR s.v ILIKE 'Critico%'      OR s.v ILIKE 'Critical%'     THEN 3
    WHEN s.v ILIKE 'Mayor%'        OR s.v ILIKE 'Major%'                           THEN 4
    WHEN s.v ILIKE 'Catastrófico%' OR s.v ILIKE 'Catastrofico%' OR s.v ILIKE 'Catastrophic%' THEN 5
  END)::smallint
  FROM (SELECT btrim(i) AS v) AS s;
$$;

-- Puntaje = probabilidad × impacto. NULL si alguno de los dos no se reconoce.
CREATE OR REPLACE FUNCTION public.risk_score(p text, i text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT (public.risk_prob_idx(p) * public.risk_impact_idx(i))::smallint;
$$;

-- Clave de nivel (mismas constantes que normalizeRiskLevel en la app).
CREATE OR REPLACE FUNCTION public.risk_level_key(score smallint)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT CASE
    WHEN score <= 4  THEN 'TOLERABLE'
    WHEN score <= 8  THEN 'LOW'
    WHEN score <= 12 THEN 'MEDIUM'
    WHEN score <= 16 THEN 'HIGH'
    ELSE 'INTOLERABLE'
  END;
$$;

-- Mismo criterio que is_admin(): sin acceso para PUBLIC ni anon (los privilegios por defecto de Supabase se los darían), sí para autenticados
-- (el disparador de §4 corre como el usuario que guarda y las invoca).
REVOKE ALL ON FUNCTION public.risk_prob_idx(text)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.risk_impact_idx(text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.risk_score(text, text)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.risk_level_key(smallint)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.risk_prob_idx(text)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.risk_impact_idx(text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.risk_score(text, text)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.risk_level_key(smallint)  TO authenticated, service_role;


-- ---------- §0(b) Diagnóstico de la matriz de riesgos (solo lectura) ----------
-- Nada de esto modifica datos. Sirve para saber con qué nos vamos a
-- encontrar en §3, §4 y en la Fase 1 (asignación de perspectivas).

-- 1) Riesgos por usuario, con y sin departamento.
--    Esperado: sin_departamento = 0 en todas las filas (hoy el formulario
--    lo exige). Las filas demo del sandbox cuentan bajo su dueño.
SELECT r.created_by_id, u.email,
       count(*)                          AS riesgos,
       count(r.department_id)            AS con_departamento,
       count(*) - count(r.department_id) AS sin_departamento
FROM public.risks r
LEFT JOIN auth.users u ON u.id = r.created_by_id
GROUP BY r.created_by_id, u.email
ORDER BY riesgos DESC;

-- 2) Valores DISTINTOS de probabilidad e impacto (inherente y residual) y
--    el índice 1..5 que les asigna el puntaje. indice NULL = valor que NO
--    se reconoce (inglés inesperado, legado, vacío). Esperado: solo los
--    5 textos del catálogo en español por columna (más «vacío» o «NULL»
--    en los residuales no capturados; el formulario manda '' si el campo
--    quedó sin llenar).
SELECT 'inherent_probability' AS columna,
       CASE WHEN inherent_probability IS NULL THEN '«NULL»'
            WHEN btrim(inherent_probability) = '' THEN '«vacío»'
            ELSE inherent_probability END AS valor,
       public.risk_prob_idx(inherent_probability) AS indice, count(*) AS filas
FROM public.risks GROUP BY inherent_probability
UNION ALL
SELECT 'inherent_impact',
       CASE WHEN inherent_impact IS NULL THEN '«NULL»'
            WHEN btrim(inherent_impact) = '' THEN '«vacío»'
            ELSE inherent_impact END,
       public.risk_impact_idx(inherent_impact), count(*)
FROM public.risks GROUP BY inherent_impact
UNION ALL
SELECT 'residual_probability',
       CASE WHEN residual_probability IS NULL THEN '«NULL»'
            WHEN btrim(residual_probability) = '' THEN '«vacío»'
            ELSE residual_probability END,
       public.risk_prob_idx(residual_probability), count(*)
FROM public.risks GROUP BY residual_probability
UNION ALL
SELECT 'residual_impact',
       CASE WHEN residual_impact IS NULL THEN '«NULL»'
            WHEN btrim(residual_impact) = '' THEN '«vacío»'
            ELSE residual_impact END,
       public.risk_impact_idx(residual_impact), count(*)
FROM public.risks GROUP BY residual_impact
ORDER BY columna, indice NULLS FIRST, valor;

-- 3) Valores DISTINTOS del nivel guardado como texto (traducido al idioma
--    de la UI al guardar). Solo informativo: §4 no depende de este texto.
SELECT 'inherent_level' AS columna,
       CASE WHEN inherent_level IS NULL THEN '«NULL»'
            WHEN btrim(inherent_level) = '' THEN '«vacío»'
            ELSE inherent_level END AS valor,
       count(*) AS filas
FROM public.risks GROUP BY inherent_level
UNION ALL
SELECT 'residual_level',
       CASE WHEN residual_level IS NULL THEN '«NULL»'
            WHEN btrim(residual_level) = '' THEN '«vacío»'
            ELSE residual_level END,
       count(*)
FROM public.risks GROUP BY residual_level
ORDER BY columna, valor;

-- 4) Cuántas filas quedarían SIN puntaje tras el disparador de §4.
--    inherente_null importa: ese riesgo no podrá priorizarse ni entrar a
--    Estratégica hasta que el usuario lo corrija desde la app.
--    residual_null es normal cuando no se capturó la evaluación residual.
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE public.risk_score(inherent_probability, inherent_impact) IS NULL) AS inherente_null,
  count(*) FILTER (WHERE public.risk_score(residual_probability, residual_impact) IS NULL) AS residual_null
FROM public.risks;

--    Detalle por usuario e id de los que quedarían sin puntaje INHERENTE.
--    Esperado: 0 filas. Si hay, anota los id: el backfill las dejará con
--    inherent_score NULL (no falla) y se corrigen después desde la app.
SELECT r.created_by_id, r.id, r.inherent_probability, r.inherent_impact, r.inherent_level
FROM public.risks r
WHERE public.risk_score(r.inherent_probability, r.inherent_impact) IS NULL
ORDER BY r.created_by_id, r.id;

-- 5) Distribución que daría la HEURÍSTICA por nombre de departamento que
--    la Fase 1 propondrá al usuario (él confirma; aquí NO se aplica nada):
--      ventas / comercial / marketing / atención (a clientes)   → cliente
--      finanzas / contabilidad / tesorería / cobranza           → financiera
--      operaciones / producción / TI / tecnología / sistemas /
--      calidad / compras / logística / legal                    → competitiva
--      RH / recursos humanos / capital humano / talento         → equipo
--      cualquier otro                                           → NULL
--    Resumen por perspectiva sugerida:
WITH mapa AS (
  SELECT d.id, d.name, d.created_by_id,
    CASE
      WHEN lower(d.name) ~ '(venta|comercial|marketing|mercadotecnia|atenci|cliente)'                        THEN 'cliente'
      WHEN lower(d.name) ~ '(finan|contab|tesorer|cobranza)'                                                 THEN 'financiera'
      WHEN lower(d.name) ~ '(operaci|producci|\mti\M|tecnolog|sistemas|calidad|compras|log[ií]stica|legal)'  THEN 'competitiva'
      WHEN lower(d.name) ~ '(recursos humanos|capital humano|talento|\mrh\M|\mrrhh\M)'                       THEN 'equipo'
    END AS perspectiva_sugerida
  FROM public.departments d
)
SELECT m.perspectiva_sugerida,
       count(DISTINCT m.id) AS departamentos,
       count(r.id)          AS riesgos
FROM mapa m
LEFT JOIN public.risks r ON r.department_id = m.id
GROUP BY m.perspectiva_sugerida
ORDER BY m.perspectiva_sugerida NULLS LAST;

--    Detalle por departamento (los NULL son los que la heurística no sabe
--    ubicar; revisa sus nombres para afinar la lista antes de la Fase 1):
WITH mapa AS (
  SELECT d.id, d.name, d.created_by_id,
    CASE
      WHEN lower(d.name) ~ '(venta|comercial|marketing|mercadotecnia|atenci|cliente)'                        THEN 'cliente'
      WHEN lower(d.name) ~ '(finan|contab|tesorer|cobranza)'                                                 THEN 'financiera'
      WHEN lower(d.name) ~ '(operaci|producci|\mti\M|tecnolog|sistemas|calidad|compras|log[ií]stica|legal)'  THEN 'competitiva'
      WHEN lower(d.name) ~ '(recursos humanos|capital humano|talento|\mrh\M|\mrrhh\M)'                       THEN 'equipo'
    END AS perspectiva_sugerida
  FROM public.departments d
)
SELECT m.created_by_id, m.name, m.perspectiva_sugerida, count(r.id) AS riesgos
FROM mapa m
LEFT JOIN public.risks r ON r.department_id = m.id
GROUP BY m.created_by_id, m.name, m.perspectiva_sugerida
ORDER BY m.perspectiva_sugerida NULLS FIRST, m.name;


-- ---------- §0(c) RESPALDO SEGURO (único paso de §0 que escribe) ----------
-- Copia íntegra de risks, departments y strategic_initiatives ANTES de
-- tocar nada. Ningún paso de este archivo borra datos, pero el backfill de
-- §4 reescribe todas las filas de risks y conviene tener la foto previa.
--
-- ¿POR QUÉ EN UN ESQUEMA APARTE Y NO EN public?
--   PostgREST expone TODO lo que hay en public. Una copia hecha con
--   CREATE TABLE AS no hereda las políticas RLS (ni siquiera tiene RLS
--   activado) y, como la hace el rol postgres desde el SQL Editor, trae las
--   filas de TODOS los usuarios. En public, cualquier usuario autenticado
--   podría leer la matriz de riesgos completa de los demás con una sola
--   petición. El esquema backup no está en la lista de esquemas expuestos
--   por PostgREST y además se le retira todo permiso a anon/authenticated.
--
-- La fecha va FIJA en el nombre (foto del 2026-10-05). Si quieres otra
-- foto otro día, cambia el sufijo _20261005 en las TRES tablas de abajo
-- (buscar y reemplazar). IF NOT EXISTS hace que correr dos veces el mismo
-- nombre sea inofensivo: NO refresca la copia, la deja como estaba.
--
-- Para restaurar algo: consulta backup.risks_20261005 (misma estructura
-- que tenía risks en ese momento) y copia lo que haga falta a mano.
-- Al restaurar con INSERT ... SELECT, lista las columnas: la copia NO tiene
-- las columnas nuevas de §1 y §4 (perspective_key, *_score, *_level_key).
-- supabase-perspectivas-cleanup.sql borra este esquema al final del proyecto.

CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS backup.risks_20261005                 AS SELECT * FROM public.risks;
CREATE TABLE IF NOT EXISTS backup.departments_20261005           AS SELECT * FROM public.departments;
CREATE TABLE IF NOT EXISTS backup.strategic_initiatives_20261005 AS SELECT * FROM public.strategic_initiatives;

REVOKE ALL ON ALL TABLES IN SCHEMA backup FROM anon, authenticated;

-- Comprobación rápida (deben coincidir con los conteos de public):
SELECT (SELECT count(*) FROM backup.risks_20261005)                 AS risks_respaldados,
       (SELECT count(*) FROM backup.departments_20261005)           AS departments_respaldados,
       (SELECT count(*) FROM backup.strategic_initiatives_20261005) AS iniciativas_respaldadas;



-- ============================================================
-- §1. risks.perspective_key — la perspectiva del riesgo
-- ============================================================
-- NULL = sin asignar (todo lo existente queda así hasta la Fase 1, donde
-- el usuario confirma la propuesta por departamento). Este campo es la
-- fuente de verdad; departments.perspective_key (§2) es solo el mapa para
-- proponer valores.
--
-- El CHECK se recrea con DROP IF EXISTS + ADD para que correr dos veces
-- sea seguro. Admite NULL o una de las 4 claves del catálogo.

ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS perspective_key TEXT;

ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_perspective_key_check;
ALTER TABLE public.risks ADD CONSTRAINT risks_perspective_key_check
  CHECK (perspective_key IS NULL
         OR perspective_key IN ('financiera', 'cliente', 'competitiva', 'equipo'));

-- Las pantallas listan "mis riesgos por perspectiva" (RLS filtra por dueño).
CREATE INDEX IF NOT EXISTS risks_owner_perspective_idx
  ON public.risks (created_by_id, perspective_key);



-- ============================================================
-- §2. departments.perspective_key — mapa de migración
-- ============================================================
-- Cada departamento podrá apuntar a UNA perspectiva; con eso la Fase 1
-- propone la perspectiva de cada riesgo a partir de su departamento y el
-- usuario confirma. La tabla departments SE CONSERVA (no se borra nada).

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS perspective_key TEXT;

ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_perspective_key_check;
ALTER TABLE public.departments ADD CONSTRAINT departments_perspective_key_check
  CHECK (perspective_key IS NULL
         OR perspective_key IN ('financiera', 'cliente', 'competitiva', 'equipo'));



-- ============================================================
-- §3. risks.department_id deja de ser obligatorio
-- ============================================================
-- Los riesgos nuevos se organizarán por perspectiva, así que el
-- departamento pasa a ser opcional. La columna y su FK a departments se
-- QUEDAN: los riesgos existentes conservan su departamento como referencia.
-- Solo se retira el NOT NULL si lo tiene (DROP NOT NULL ya es inofensivo
-- si no lo tiene, pero así queda explícito en el aviso).

DO $$
BEGIN
  IF EXISTS (SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'risks'
               AND column_name = 'department_id' AND is_nullable = 'NO') THEN
    ALTER TABLE public.risks ALTER COLUMN department_id DROP NOT NULL;
    RAISE NOTICE 'risks.department_id: NOT NULL retirado.';
  ELSE
    RAISE NOTICE 'risks.department_id ya admitía NULL; sin cambios.';
  END IF;
END $$;



-- ============================================================
-- §4. Puntajes independientes del idioma, mantenidos por disparador
-- ============================================================
-- Problema: inherent_level / residual_level se guardan como TEXTO en el
-- idioma de la UI ('Alto' o 'High'), así que la base no puede filtrar
-- "riesgos Alto/Intolerable" de forma confiable. Solución: columnas
-- numéricas y claves fijas calculadas SIEMPRE en la base a partir de la
-- probabilidad y el impacto, con las funciones puras de §0(b).0:
--   inherent_score / residual_score          1..25 (NULL si no se reconoce)
--   inherent_level_key / residual_level_key  TOLERABLE|LOW|MEDIUM|HIGH|INTOLERABLE
-- Riesgo "Alto/Intolerable" para la Fase 1 = inherent_score >= 13.
--
-- ¿POR QUÉ DISPARADOR Y NO COLUMNAS GENERATED?
--   La app, al editar, manda la fila COMPLETA tal como la leyó (select *),
--   incluidas estas 4 columnas. Postgres rechaza cualquier UPDATE que
--   asigne un valor a una columna GENERATED ("can only be updated to
--   DEFAULT"), así que la app actual dejaría de poder editar riesgos.
--   El disparador ignora lo que venga en esas columnas y las recalcula.
--
-- CONTRATO: el disparador NUNCA aborta el guardado del usuario. Las
-- funciones son puras y devuelven NULL ante cualquier texto raro; y por si
-- algo inesperado ocurriera, el bloque EXCEPTION deja los puntajes en NULL
-- y devuelve la fila. Sin RAISE jamás.

-- ---------- 4.1 Funciones ----------
-- Ya creadas en §0(b).0 (risk_prob_idx, risk_impact_idx, risk_score,
-- risk_level_key). Si saltaste §0, créalas antes de seguir.

-- ---------- 4.1b Guarda de migración (no es el disparador) ----------
-- Si alguien corre §1-§6 sin haber corrido §0 (donde se crean las funciones
-- de puntaje), el CREATE del disparador fallaría a medias. Mejor detenerse
-- aquí con un mensaje claro. Esta guarda NO afecta el contrato del
-- disparador: solo corre durante la migración.
DO $$
BEGIN
  IF to_regprocedure('public.risk_score(text,text)') IS NULL
     OR to_regprocedure('public.risk_level_key(smallint)') IS NULL THEN
    RAISE EXCEPTION 'Faltan las funciones de puntaje: corre primero la sección §0(b).0 de este mismo archivo.';
  END IF;
END $$;

-- ---------- 4.2 Columnas ----------
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS inherent_score     SMALLINT,
  ADD COLUMN IF NOT EXISTS residual_score     SMALLINT,
  ADD COLUMN IF NOT EXISTS inherent_level_key TEXT,
  ADD COLUMN IF NOT EXISTS residual_level_key TEXT;

-- ---------- 4.3 Disparador ----------
-- SECURITY INVOKER: corre como el usuario que guarda; no lee tablas, así
-- que RLS no interviene. Sin lista de columnas en el trigger: recalcula
-- SIEMPRE, porque la app manda la fila completa al editar.
CREATE OR REPLACE FUNCTION public.risks_set_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.inherent_score     := public.risk_score(NEW.inherent_probability, NEW.inherent_impact);
    NEW.residual_score     := public.risk_score(NEW.residual_probability, NEW.residual_impact);
    NEW.inherent_level_key := public.risk_level_key(NEW.inherent_score);
    NEW.residual_level_key := public.risk_level_key(NEW.residual_score);
  EXCEPTION WHEN OTHERS THEN
    -- Contrato "nunca abortar": ante cualquier imprevisto, sin puntaje,
    -- pero dejando rastro en los logs de Postgres (WARNING no interrumpe).
    RAISE WARNING 'risks_set_scores: no se pudo calcular el puntaje (% %)', SQLSTATE, SQLERRM;
    NEW.inherent_score     := NULL;
    NEW.residual_score     := NULL;
    NEW.inherent_level_key := NULL;
    NEW.residual_level_key := NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.risks_set_scores() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS risks_set_scores ON public.risks;
CREATE TRIGGER risks_set_scores
  BEFORE INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.risks_set_scores();

-- ---------- 4.4 Backfill de las filas existentes ----------
-- ⚠️ Reescribe TODAS las filas de risks (dispara el trigger en cada una).
-- Correr FUERA DE HORA PICO y DESPUÉS del respaldo de §0(c). Idempotente:
-- volver a correrlo recalcula lo mismo. Si risks tuviera un disparador de
-- updated_at, esa marca también se actualizará.
UPDATE public.risks SET inherent_probability = inherent_probability;

-- ---------- 4.5 Índice ----------
-- "Mis riesgos Alto/Intolerable" (inherent_score >= 13) por usuario.
CREATE INDEX IF NOT EXISTS risks_owner_inherent_score_idx
  ON public.risks (created_by_id, inherent_score);



-- ============================================================
-- §5. strategic_initiatives: origen externo e índice único para upsert
-- ============================================================
-- Para que un riesgo Alto/Intolerable entre a Estratégica con sus
-- mitigantes como iniciativas, hace falta:
--   source_key     identificador estable del origen externo (convención
--                  prevista: 'risk:<id del riesgo>:<n>' para el mitigante
--                  n). NULL en las iniciativas capturadas a mano.
--   strategy_label texto del objetivo cuando no viene del catálogo de
--                  debilidades (p. ej. la descripción del riesgo).
-- strategy_id sigue siendo TEXT libre (ej. 'opp:liquidez' o 'risk:<id>').
--
-- ¿POR QUÉ UN ÍNDICE ÚNICO NORMAL Y NO PARCIAL (WHERE source_key IS NOT NULL)?
--   1. No hace falta: en un índice único los NULL no chocan entre sí, así
--      que las iniciativas manuales (source_key NULL) nunca lo violan.
--   2. Un índice parcial NO sirve como árbitro de ON CONFLICT desde
--      PostgREST: el upsert de la app genera ON CONFLICT (plan_id,
--      source_key) sin el predicado WHERE, y Postgres solo elige un índice
--      parcial si la cláusula repite ese predicado. Fallaría con "no unique
--      or exclusion constraint matching the ON CONFLICT specification".

ALTER TABLE public.strategic_initiatives
  ADD COLUMN IF NOT EXISTS source_key     TEXT,
  ADD COLUMN IF NOT EXISTS strategy_label TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS strategic_initiatives_plan_source_uidx
  ON public.strategic_initiatives (plan_id, source_key);



-- ============================================================
-- §6. VERIFICACIÓN FINAL
-- ============================================================

-- 1) Las 8 columnas nuevas existen.                                 Esperado: 8
SELECT count(*) AS columnas_nuevas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (   (table_name = 'risks' AND column_name IN ('perspective_key', 'inherent_score', 'residual_score',
                                                     'inherent_level_key', 'residual_level_key'))
       OR (table_name = 'departments' AND column_name = 'perspective_key')
       OR (table_name = 'strategic_initiatives' AND column_name IN ('source_key', 'strategy_label')));

-- 2) Los dos CHECK de perspectiva existen.                           Esperado: 2
SELECT count(*) AS checks_perspectiva
FROM pg_constraint
WHERE conname IN ('risks_perspective_key_check', 'departments_perspective_key_check');

-- 3) risks.department_id admite NULL.                                Esperado: YES
SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'department_id';

-- 4) Funciones de puntaje + función del disparador.                  Esperado: 5
SELECT count(DISTINCT p.proname) AS funciones_puntaje
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('risk_prob_idx', 'risk_impact_idx', 'risk_score', 'risk_level_key', 'risks_set_scores');

-- 5) El disparador está puesto en risks.                             Esperado: 1
SELECT count(*) AS trigger_puesto
FROM pg_trigger
WHERE tgrelid = 'public.risks'::regclass AND tgname = 'risks_set_scores' AND NOT tgisinternal;

-- 6) Los 3 índices nuevos existen.                                   Esperado: 3
SELECT count(*) AS indices_nuevos
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('risks_owner_perspective_idx', 'risks_owner_inherent_score_idx',
                    'strategic_initiatives_plan_source_uidx');

-- 7) Autoprueba de las fórmulas (sin tocar datos).
--    Esperado: 20 INTOLERABLE · 12 MEDIUM · 4 TOLERABLE · NULL NULL
SELECT
  public.risk_score('Frecuente (81-100%)', 'Mayor')                              AS t1_puntaje,  -- 20
  public.risk_level_key(public.risk_score('Frecuente (81-100%)', 'Mayor'))       AS t1_nivel,    -- INTOLERABLE
  public.risk_score('Likely (61-80%)', 'Critical')                               AS t2_puntaje,  -- 12 (inglés)
  public.risk_level_key(public.risk_score('Likely (61-80%)', 'Critical'))        AS t2_nivel,    -- MEDIUM
  public.risk_score('  improbable (21-40%) ', ' MENOR ')                         AS t3_puntaje,  -- 4 (mayúsculas/espacios)
  public.risk_level_key(public.risk_score('  improbable (21-40%) ', ' MENOR '))  AS t3_nivel,    -- TOLERABLE
  public.risk_score('', 'Mayor')                                                 AS t4_puntaje,  -- NULL (vacío)
  public.risk_level_key(public.risk_score(NULL, NULL))                           AS t4_nivel;    -- NULL

-- 8) Backfill aplicado: distribución de niveles por clave fija.
--    inherente_null debe coincidir con el diagnóstico §0(b).4.
SELECT inherent_level_key, count(*) AS riesgos
FROM public.risks
GROUP BY inherent_level_key
ORDER BY inherent_level_key NULLS FIRST;

-- 9) Coherencia entre el texto que guardó la app y la clave nueva.
--    Esperado: 0. Si no es 0, el texto guardado no coincide con la fórmula
--    (dato legado); la clave nueva es la correcta y la app la usará.
SELECT count(*) AS desacuerdos
FROM public.risks
WHERE inherent_level_key IS NOT NULL
  AND inherent_level_key IS DISTINCT FROM CASE lower(btrim(inherent_level))
        WHEN 'tolerable'   THEN 'TOLERABLE'
        WHEN 'bajo'        THEN 'LOW'       WHEN 'low'    THEN 'LOW'
        WHEN 'medio'       THEN 'MEDIUM'    WHEN 'medium' THEN 'MEDIUM'
        WHEN 'alto'        THEN 'HIGH'      WHEN 'high'   THEN 'HIGH'
        WHEN 'intolerable' THEN 'INTOLERABLE'
      END;

-- 10) Candidatos de la Fase 1 (inherente Alto/Intolerable) por usuario.
--     Informativo: son los riesgos que entrarán a Estratégica.
SELECT r.created_by_id, u.email, count(*) AS riesgos_alto_intolerable
FROM public.risks r
LEFT JOIN auth.users u ON u.id = r.created_by_id
WHERE r.inherent_score >= 13
GROUP BY r.created_by_id, u.email
ORDER BY riesgos_alto_intolerable DESC;

-- 11) Nada asignado todavía (eso es la Fase 1).                      Esperado: 0 y 0
SELECT (SELECT count(*) FROM public.risks       WHERE perspective_key IS NOT NULL) AS riesgos_con_perspectiva,
       (SELECT count(*) FROM public.departments WHERE perspective_key IS NOT NULL) AS departamentos_con_perspectiva;
