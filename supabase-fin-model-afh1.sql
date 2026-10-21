-- ============================================================
-- Migración de datos: Análisis Financiero → modelo MP-AFH1
-- ============================================================
-- Convierte las cifras guardadas con el modelo anterior (ventas por línea,
-- costo de ventas por concepto, anexo de movimientos y flujo de efectivo
-- directo) a las secciones y claves del modelo nuevo (catálogo en
-- src/config/finConfig.js; tablas en supabase-fin-analysis.sql).
--
-- Idempotente y en UNA transacción: se puede correr varias veces. Solo crea
-- las claves nuevas donde aún no existen (ON CONFLICT DO NOTHING: no pisa
-- datos ya migrados ni capturados con el modelo nuevo), borra lo obsoleto y
-- al final verifica que no quede ninguna fila con sección o clave vieja; si
-- quedara alguna, lanza una excepción y TODO se revierte. Si no hay nada
-- del modelo viejo, no toca nada.
--
-- Qué hace, por (análisis, año):
--   1. balance:  efectivo = caja + inversiones;
--                activos_diferidos ← impuesto_diferido_activo;
--                pasivos_diferidos = provisiones + impuesto_diferido_pasivo;
--                se borra resultado_periodo (ahora es la utilidad neta del
--                Estado de Resultados y no se guarda).
--   2. income:   ventas = Σ sales (todas las líneas);
--                costo = Σ de todas las secciones cost:<línea>;
--                gasto_general = Σ expenses (los 20 conceptos) + depreciacion.
--                  ⚠️ En el modelo viejo la depreciación se restaba APARTE
--                  del gasto; en el nuevo va DENTRO del gasto operativo y se
--                  informa como partida memo. Sumarla conserva el resultado
--                  de operación y deja en 0 la "Diferencia" del Desglose del
--                  gasto. Si se prefiere la suma pura de los 20 conceptos,
--                  quitar la línea de 'depreciacion' del paso 2c.
--                se borra otros_operacion (no existe en el modelo nuevo).
--   3. segcost:  por cada cost:<línea>, costo del segmento = Σ conceptos,
--                con concept_key = id de la línea; después se borran las
--                secciones cost:*.
--   4. Se borran las secciones cashflow-annex y cashflow-direct.
--   5. Verificación final (ninguna fila obsoleta) y conteo por sección.
--
-- Qué se pierde a propósito (decisión del 21-oct-2026): el detalle del costo
-- por concepto, el anexo de movimientos, el flujo directo y
-- income.otros_operacion. Los datos demo de las cuentas de prueba se
-- reconstruyen después con supabase-seed-fin-demo.sql.
--
-- Los RAISE NOTICE con conteos se ven en el panel de mensajes del SQL Editor.
-- Ejecutar completo en Supabase → SQL Editor.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_n        INT;
  v_inicio   INT;
  v_legacy   INT;
  v_pares    INT;
  r          RECORD;
BEGIN
  SELECT count(*) INTO v_inicio FROM fin_values;

  -- Filas del modelo viejo (sección o clave que ya no existe).
  SELECT count(*) INTO v_legacy
    FROM fin_values
   WHERE section IN ('cashflow-annex', 'cashflow-direct')
      OR section LIKE 'cost:%'
      OR (section = 'balance' AND concept_key IN
            ('caja', 'inversiones', 'impuesto_diferido_activo',
             'provisiones', 'impuesto_diferido_pasivo', 'resultado_periodo'))
      OR (section = 'income' AND concept_key = 'otros_operacion');

  RAISE NOTICE 'fin_values al inicio: % filas, % del modelo viejo.', v_inicio, v_legacy;

  IF v_legacy = 0 THEN
    RAISE NOTICE 'No hay datos del modelo viejo: nada que migrar.';
  ELSE
    SELECT count(*) INTO v_pares
      FROM (SELECT DISTINCT analysis_id, year_id
              FROM fin_values
             WHERE section IN ('cashflow-annex', 'cashflow-direct')
                OR section LIKE 'cost:%'
                OR (section = 'balance' AND concept_key IN
                      ('caja', 'inversiones', 'impuesto_diferido_activo',
                       'provisiones', 'impuesto_diferido_pasivo', 'resultado_periodo'))
                OR (section = 'income' AND concept_key = 'otros_operacion')) p;
    RAISE NOTICE 'Pares (análisis, año) con datos viejos: %.', v_pares;

    -- 1. Balance ------------------------------------------------------------
    -- 1a. efectivo = caja + inversiones (solo donde aún no existe efectivo)
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'balance', 'efectivo', SUM(amount), now()
      FROM fin_values
     WHERE section = 'balance' AND concept_key IN ('caja', 'inversiones')
     GROUP BY analysis_id, year_id
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '1a. balance.efectivo creado: % filas.', v_n;

    DELETE FROM fin_values
     WHERE section = 'balance' AND concept_key IN ('caja', 'inversiones');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '    balance.caja / inversiones borradas: % filas.', v_n;

    -- 1b. activos_diferidos ← impuesto_diferido_activo
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'balance', 'activos_diferidos', amount, now()
      FROM fin_values
     WHERE section = 'balance' AND concept_key = 'impuesto_diferido_activo'
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '1b. balance.activos_diferidos creado: % filas.', v_n;

    DELETE FROM fin_values
     WHERE section = 'balance' AND concept_key = 'impuesto_diferido_activo';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '    balance.impuesto_diferido_activo borradas: % filas.', v_n;

    -- 1c. pasivos_diferidos = provisiones + impuesto_diferido_pasivo
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'balance', 'pasivos_diferidos', SUM(amount), now()
      FROM fin_values
     WHERE section = 'balance' AND concept_key IN ('provisiones', 'impuesto_diferido_pasivo')
     GROUP BY analysis_id, year_id
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '1c. balance.pasivos_diferidos creado: % filas.', v_n;

    DELETE FROM fin_values
     WHERE section = 'balance' AND concept_key IN ('provisiones', 'impuesto_diferido_pasivo');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '    balance.provisiones / impuesto_diferido_pasivo borradas: % filas.', v_n;

    -- 1d. resultado_periodo ya no se guarda (es la utilidad neta calculada)
    DELETE FROM fin_values
     WHERE section = 'balance' AND concept_key = 'resultado_periodo';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '1d. balance.resultado_periodo borradas: % filas.', v_n;

    -- 2. Estado de Resultados ------------------------------------------------
    -- 2a. ventas = Σ sales (solo donde aún no existe income.ventas)
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'income', 'ventas', SUM(amount), now()
      FROM fin_values
     WHERE section = 'sales'
     GROUP BY analysis_id, year_id
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '2a. income.ventas creado: % filas.', v_n;

    -- 2b. costo = Σ de todas las secciones cost:<línea>
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'income', 'costo', SUM(amount), now()
      FROM fin_values
     WHERE section LIKE 'cost:%'
     GROUP BY analysis_id, year_id
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '2b. income.costo creado: % filas.', v_n;

    -- 2c. gasto_general = Σ expenses (20 conceptos) + depreciacion (ver nota arriba)
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'income', 'gasto_general', SUM(amount), now()
      FROM fin_values
     WHERE (section = 'expenses' AND concept_key IN
              ('sueldos', 'prestaciones', 'bonos', 'honorarios', 'tecnologia',
               'suministros', 'viajes', 'mantenimiento', 'marketing', 'capacitacion',
               'seguros', 'representacion', 'servicios_basicos', 'renta', 'comunicaciones',
               'outsourcing', 'innovacion', 'logistica', 'legales', 'menores'))
        OR (section = 'income' AND concept_key = 'depreciacion')
     GROUP BY analysis_id, year_id
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '2c. income.gasto_general creado: % filas.', v_n;

    -- 2d. otros_operacion no existe en el modelo nuevo
    DELETE FROM fin_values
     WHERE section = 'income' AND concept_key = 'otros_operacion';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '2d. income.otros_operacion borradas: % filas.', v_n;

    -- 3. Costo por segmento ---------------------------------------------------
    -- segcost.<línea> = Σ conceptos de cost:<línea> ('cost:' son 5 caracteres)
    INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount, updated_at)
    SELECT analysis_id, year_id, 'segcost', substr(section, 6), SUM(amount), now()
      FROM fin_values
     WHERE section LIKE 'cost:%' AND length(section) > 5
     GROUP BY analysis_id, year_id, section
    ON CONFLICT (analysis_id, year_id, section, concept_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '3.  segcost creado: % filas.', v_n;

    DELETE FROM fin_values WHERE section LIKE 'cost:%';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '    secciones cost:* borradas: % filas.', v_n;

    -- 4. Anexo y flujo directo desaparecen ------------------------------------
    DELETE FROM fin_values WHERE section IN ('cashflow-annex', 'cashflow-direct');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '4.  cashflow-annex / cashflow-direct borradas: % filas.', v_n;
  END IF;

  -- 5. Verificación final -----------------------------------------------------
  SELECT count(*) INTO v_n
    FROM fin_values
   WHERE section IN ('cashflow-annex', 'cashflow-direct')
      OR section LIKE 'cost:%'
      OR (section = 'balance' AND concept_key IN
            ('caja', 'inversiones', 'impuesto_diferido_activo',
             'provisiones', 'impuesto_diferido_pasivo', 'resultado_periodo'))
      OR (section = 'income' AND concept_key = 'otros_operacion');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Quedan % filas con secciones o claves obsoletas; se revierte la migración.', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM fin_values
   WHERE section NOT IN ('income', 'balance', 'cashflow', 'sales', 'segcost', 'expenses', 'seasonality');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Hay % filas con una sección desconocida; se revierte la migración.', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM fin_values;
  RAISE NOTICE '5.  Verificación: sin filas obsoletas. fin_values ahora: % filas (antes %).', v_n, v_inicio;
  FOR r IN
    SELECT section, count(*) AS n
      FROM fin_values
     GROUP BY section
     ORDER BY section
  LOOP
    RAISE NOTICE '    %: % filas', r.section, r.n;
  END LOOP;
END $$;

COMMIT;
