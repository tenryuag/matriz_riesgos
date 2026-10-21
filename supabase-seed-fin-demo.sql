-- ============================================================
-- Seed demo del Análisis Financiero (modelo MP-AFH1)
-- ============================================================
-- Empresa ficticia "Metalmecánica del Bajío, S.A. de C.V.": 2023, 2024, 2025, jun 2026
-- (cifras en miles de MXN). Tiene historia: crece 12–17 % al año, margen
-- bruto 33–35 %, margen operativo 8–11 %, liquidez entre 1.2 y 1.6 y deuda
-- bancaria moderada; en el último periodo el capital de trabajo se estira
-- y el semáforo mezcla verde, ámbar y rojo.
--
-- GENERADO por scripts/seed-fin-demo.mjs (no editar a mano; para cambiar
-- cifras edita el script y corre `node scripts/seed-fin-demo.mjs`).
-- Validado con el motor de la app (src/config/finCalc.js): el Balance
-- cuadra los 4 años, el Estado de cambios concilia con la caja y los
-- segmentos, el desglose del gasto y la estacionalidad suman exactamente lo
-- del Estado de Resultados.
--
-- Qué hace:
--   1. Localiza al usuario por v_email (⚠️ cámbialo para sembrar otra cuenta).
--   2. Toma su análisis financiero (el más antiguo, igual que la app) o lo
--      crea con owner_id y created_by_id = el usuario.
--   3. Borra SOLO fin_values, fin_lines y fin_years de ESE análisis. No toca
--      riesgos, plan estratégico, otros análisis ni otros usuarios.
--   4. Siembra datos generales, 4 periodos, 3 segmentos y 333 cifras.
-- Los UUID de años y segmentos son deterministas por análisis (md5 del id
-- del análisis + etiqueta): el seed es repetible y no choca entre cuentas.
-- Prerrequisitos: supabase-fin-analysis.sql y supabase-per-user-plans.sql
-- (columna owner_id). Ejecutar completo en Supabase → SQL Editor.
-- ============================================================
BEGIN;

DO $$
DECLARE
  v_email TEXT := 'tenryu@mara-perez.online';  -- ⚠️ cambia el correo para sembrar otra cuenta
  v_uid   UUID;
  v_fin   UUID;
  v_y2023 UUID;
  v_y2024 UUID;
  v_y2025 UUID;
  v_y2026 UUID;
  v_seg_auto UUID;
  v_seg_electro UUID;
  v_seg_mant UUID;
  v_n_years  INT;
  v_n_lines  INT;
  v_n_values INT;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %.', v_email;
  END IF;

  -- Análisis del usuario: el más antiguo (mismo criterio que FinAnalysis.getOrCreate).
  SELECT id INTO v_fin
    FROM fin_analyses
   WHERE owner_id = v_uid
   ORDER BY created_at ASC
   LIMIT 1;
  IF v_fin IS NULL THEN
    INSERT INTO fin_analyses (owner_id, created_by_id)
    VALUES (v_uid, v_uid)
    RETURNING id INTO v_fin;
    RAISE NOTICE 'Análisis financiero creado para %: %', v_email, v_fin;
  END IF;

  v_y2023 := md5(v_fin::text || ':year:2023')::uuid;
  v_y2024 := md5(v_fin::text || ':year:2024')::uuid;
  v_y2025 := md5(v_fin::text || ':year:2025')::uuid;
  v_y2026 := md5(v_fin::text || ':year:2026')::uuid;
  v_seg_auto := md5(v_fin::text || ':segment:seg_auto')::uuid;
  v_seg_electro := md5(v_fin::text || ':segment:seg_electro')::uuid;
  v_seg_mant := md5(v_fin::text || ':segment:seg_mant')::uuid;

  -- Limpieza: SOLO las cifras, segmentos y años de este análisis.
  DELETE FROM fin_values WHERE analysis_id = v_fin;
  DELETE FROM fin_lines  WHERE analysis_id = v_fin;
  DELETE FROM fin_years  WHERE analysis_id = v_fin;

  -- Datos generales
  UPDATE fin_analyses
     SET company_name         = 'Metalmecánica del Bajío, S.A. de C.V.',
         country              = 'México',
         main_activity        = 'Fabricación de piezas metálicas de precisión para la industria automotriz y de electrodomésticos',
         secondary_activities = 'Mantenimiento industrial en planta y venta de refacciones',
         currency             = 'MXN',
         updated_at           = now()
   WHERE id = v_fin;

  -- Periodos
  INSERT INTO fin_years (id, analysis_id, year, months) VALUES
    (v_y2023, v_fin, 2023, 12),
    (v_y2024, v_fin, 2024, 12),
    (v_y2025, v_fin, 2025, 12),
    (v_y2026, v_fin, 2026, 6);

  -- Segmentos de negocio
  INSERT INTO fin_lines (id, analysis_id, name, position) VALUES
    (v_seg_auto, v_fin, 'Piezas automotrices', 0),
    (v_seg_electro, v_fin, 'Electrodomésticos', 1),
    (v_seg_mant, v_fin, 'Mantenimiento y refacciones', 2);

  -- Estado de Resultados (capturas en positivo; memo: depreciacion, reserva_cxc, reserva_inventarios)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2023, 'income', 'ventas', 41200),
    (v_fin, v_y2023, 'income', 'costo', 27600),
    (v_fin, v_y2023, 'income', 'gasto_venta', 3400),
    (v_fin, v_y2023, 'income', 'gasto_admin', 5300),
    (v_fin, v_y2023, 'income', 'gasto_general', 1650),
    (v_fin, v_y2023, 'income', 'productos_financieros', 120),
    (v_fin, v_y2023, 'income', 'gastos_financieros', 980),
    (v_fin, v_y2023, 'income', 'utilidad_cambiaria', -140),
    (v_fin, v_y2023, 'income', 'otros_productos', 60),
    (v_fin, v_y2023, 'income', 'isr', 690),
    (v_fin, v_y2023, 'income', 'ptu', 230),
    (v_fin, v_y2023, 'income', 'depreciacion', 1150),
    (v_fin, v_y2023, 'income', 'reserva_cxc', 80),
    (v_fin, v_y2023, 'income', 'reserva_inventarios', 60),
    (v_fin, v_y2024, 'income', 'ventas', 47400),
    (v_fin, v_y2024, 'income', 'costo', 31500),
    (v_fin, v_y2024, 'income', 'gasto_venta', 3900),
    (v_fin, v_y2024, 'income', 'gasto_admin', 5900),
    (v_fin, v_y2024, 'income', 'gasto_general', 1900),
    (v_fin, v_y2024, 'income', 'productos_financieros', 150),
    (v_fin, v_y2024, 'income', 'gastos_financieros', 1100),
    (v_fin, v_y2024, 'income', 'utilidad_cambiaria', 210),
    (v_fin, v_y2024, 'income', 'otros_productos', -45),
    (v_fin, v_y2024, 'income', 'isr', 1020),
    (v_fin, v_y2024, 'income', 'ptu', 340),
    (v_fin, v_y2024, 'income', 'depreciacion', 1300),
    (v_fin, v_y2024, 'income', 'reserva_cxc', 120),
    (v_fin, v_y2024, 'income', 'reserva_inventarios', 90),
    (v_fin, v_y2025, 'income', 'ventas', 55300),
    (v_fin, v_y2025, 'income', 'costo', 35900),
    (v_fin, v_y2025, 'income', 'gasto_venta', 4500),
    (v_fin, v_y2025, 'income', 'gasto_admin', 6600),
    (v_fin, v_y2025, 'income', 'gasto_general', 2150),
    (v_fin, v_y2025, 'income', 'productos_financieros', 180),
    (v_fin, v_y2025, 'income', 'gastos_financieros', 1350),
    (v_fin, v_y2025, 'income', 'utilidad_cambiaria', -380),
    (v_fin, v_y2025, 'income', 'otros_productos', 180),
    (v_fin, v_y2025, 'income', 'isr', 1430),
    (v_fin, v_y2025, 'income', 'ptu', 480),
    (v_fin, v_y2025, 'income', 'depreciacion', 1480),
    (v_fin, v_y2025, 'income', 'reserva_cxc', 150),
    (v_fin, v_y2025, 'income', 'reserva_inventarios', 110),
    (v_fin, v_y2026, 'income', 'ventas', 31000),
    (v_fin, v_y2026, 'income', 'costo', 20500),
    (v_fin, v_y2026, 'income', 'gasto_venta', 2650),
    (v_fin, v_y2026, 'income', 'gasto_admin', 3700),
    (v_fin, v_y2026, 'income', 'gasto_general', 1250),
    (v_fin, v_y2026, 'income', 'productos_financieros', 90),
    (v_fin, v_y2026, 'income', 'gastos_financieros', 820),
    (v_fin, v_y2026, 'income', 'utilidad_cambiaria', 95),
    (v_fin, v_y2026, 'income', 'otros_productos', 30),
    (v_fin, v_y2026, 'income', 'isr', 690),
    (v_fin, v_y2026, 'income', 'ptu', 230),
    (v_fin, v_y2026, 'income', 'depreciacion', 820),
    (v_fin, v_y2026, 'income', 'reserva_cxc', 90),
    (v_fin, v_y2026, 'income', 'reserva_inventarios', 70);

  -- Balance General (27 cuentas; el resultado del periodo lo calcula la app)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2023, 'balance', 'efectivo', 1800),
    (v_fin, v_y2023, 'balance', 'clientes', 5950),
    (v_fin, v_y2023, 'balance', 'otras_cxc', 420),
    (v_fin, v_y2023, 'balance', 'cxc_relacionadas', 0),
    (v_fin, v_y2023, 'balance', 'inventarios', 5200),
    (v_fin, v_y2023, 'balance', 'pagos_anticipados', 380),
    (v_fin, v_y2023, 'balance', 'impuestos_recuperar', 610),
    (v_fin, v_y2023, 'balance', 'otros_circulantes', 250),
    (v_fin, v_y2023, 'balance', 'activos_fijos', 11800),
    (v_fin, v_y2023, 'balance', 'otros_activos', 540),
    (v_fin, v_y2023, 'balance', 'activos_diferidos', 320),
    (v_fin, v_y2023, 'balance', 'anticipos', 450),
    (v_fin, v_y2023, 'balance', 'proveedores', 4220),
    (v_fin, v_y2023, 'balance', 'cias_relacionadas', 0),
    (v_fin, v_y2023, 'balance', 'gastos_acumulados', 680),
    (v_fin, v_y2023, 'balance', 'impuestos_pagar', 920),
    (v_fin, v_y2023, 'balance', 'bancario_cp', 1500),
    (v_fin, v_y2023, 'balance', 'porcion_circulante_lp', 1200),
    (v_fin, v_y2023, 'balance', 'acreedores', 860),
    (v_fin, v_y2023, 'balance', 'otras_cxp', 390),
    (v_fin, v_y2023, 'balance', 'bancario_lp', 4800),
    (v_fin, v_y2023, 'balance', 'pasivos_diferidos', 210),
    (v_fin, v_y2023, 'balance', 'capital_social', 6000),
    (v_fin, v_y2023, 'balance', 'aportaciones_futuras', 0),
    (v_fin, v_y2023, 'balance', 'reservas', 300),
    (v_fin, v_y2023, 'balance', 'revaluacion', 0),
    (v_fin, v_y2023, 'balance', 'resultados_acumulados', 4350),
    (v_fin, v_y2024, 'balance', 'efectivo', 1435),
    (v_fin, v_y2024, 'balance', 'clientes', 7100),
    (v_fin, v_y2024, 'balance', 'otras_cxc', 510),
    (v_fin, v_y2024, 'balance', 'cxc_relacionadas', 0),
    (v_fin, v_y2024, 'balance', 'inventarios', 6000),
    (v_fin, v_y2024, 'balance', 'pagos_anticipados', 450),
    (v_fin, v_y2024, 'balance', 'impuestos_recuperar', 720),
    (v_fin, v_y2024, 'balance', 'otros_circulantes', 300),
    (v_fin, v_y2024, 'balance', 'activos_fijos', 13400),
    (v_fin, v_y2024, 'balance', 'otros_activos', 600),
    (v_fin, v_y2024, 'balance', 'activos_diferidos', 260),
    (v_fin, v_y2024, 'balance', 'anticipos', 520),
    (v_fin, v_y2024, 'balance', 'proveedores', 5250),
    (v_fin, v_y2024, 'balance', 'cias_relacionadas', 0),
    (v_fin, v_y2024, 'balance', 'gastos_acumulados', 760),
    (v_fin, v_y2024, 'balance', 'impuestos_pagar', 1150),
    (v_fin, v_y2024, 'balance', 'bancario_cp', 2600),
    (v_fin, v_y2024, 'balance', 'porcion_circulante_lp', 1200),
    (v_fin, v_y2024, 'balance', 'acreedores', 940),
    (v_fin, v_y2024, 'balance', 'otras_cxp', 430),
    (v_fin, v_y2024, 'balance', 'bancario_lp', 3600),
    (v_fin, v_y2024, 'balance', 'pasivos_diferidos', 230),
    (v_fin, v_y2024, 'balance', 'capital_social', 6000),
    (v_fin, v_y2024, 'balance', 'aportaciones_futuras', 0),
    (v_fin, v_y2024, 'balance', 'reservas', 300),
    (v_fin, v_y2024, 'balance', 'revaluacion', 0),
    (v_fin, v_y2024, 'balance', 'resultados_acumulados', 5740),
    (v_fin, v_y2025, 'balance', 'efectivo', 4215),
    (v_fin, v_y2025, 'balance', 'clientes', 7370),
    (v_fin, v_y2025, 'balance', 'otras_cxc', 480),
    (v_fin, v_y2025, 'balance', 'cxc_relacionadas', 0),
    (v_fin, v_y2025, 'balance', 'inventarios', 6180),
    (v_fin, v_y2025, 'balance', 'pagos_anticipados', 520),
    (v_fin, v_y2025, 'balance', 'impuestos_recuperar', 650),
    (v_fin, v_y2025, 'balance', 'otros_circulantes', 340),
    (v_fin, v_y2025, 'balance', 'activos_fijos', 15610),
    (v_fin, v_y2025, 'balance', 'otros_activos', 650),
    (v_fin, v_y2025, 'balance', 'activos_diferidos', 200),
    (v_fin, v_y2025, 'balance', 'anticipos', 900),
    (v_fin, v_y2025, 'balance', 'proveedores', 5780),
    (v_fin, v_y2025, 'balance', 'cias_relacionadas', 0),
    (v_fin, v_y2025, 'balance', 'gastos_acumulados', 850),
    (v_fin, v_y2025, 'balance', 'impuestos_pagar', 1480),
    (v_fin, v_y2025, 'balance', 'bancario_cp', 900),
    (v_fin, v_y2025, 'balance', 'porcion_circulante_lp', 1500),
    (v_fin, v_y2025, 'balance', 'acreedores', 1020),
    (v_fin, v_y2025, 'balance', 'otras_cxp', 470),
    (v_fin, v_y2025, 'balance', 'bancario_lp', 6900),
    (v_fin, v_y2025, 'balance', 'pasivos_diferidos', 250),
    (v_fin, v_y2025, 'balance', 'capital_social', 6000),
    (v_fin, v_y2025, 'balance', 'aportaciones_futuras', 0),
    (v_fin, v_y2025, 'balance', 'reservas', 300),
    (v_fin, v_y2025, 'balance', 'revaluacion', 0),
    (v_fin, v_y2025, 'balance', 'resultados_acumulados', 6995),
    (v_fin, v_y2026, 'balance', 'efectivo', 1340),
    (v_fin, v_y2026, 'balance', 'clientes', 10330),
    (v_fin, v_y2026, 'balance', 'otras_cxc', 560),
    (v_fin, v_y2026, 'balance', 'cxc_relacionadas', 0),
    (v_fin, v_y2026, 'balance', 'inventarios', 10480),
    (v_fin, v_y2026, 'balance', 'pagos_anticipados', 610),
    (v_fin, v_y2026, 'balance', 'impuestos_recuperar', 720),
    (v_fin, v_y2026, 'balance', 'otros_circulantes', 380),
    (v_fin, v_y2026, 'balance', 'activos_fijos', 16890),
    (v_fin, v_y2026, 'balance', 'otros_activos', 700),
    (v_fin, v_y2026, 'balance', 'activos_diferidos', 170),
    (v_fin, v_y2026, 'balance', 'anticipos', 1150),
    (v_fin, v_y2026, 'balance', 'proveedores', 7060),
    (v_fin, v_y2026, 'balance', 'cias_relacionadas', 0),
    (v_fin, v_y2026, 'balance', 'gastos_acumulados', 910),
    (v_fin, v_y2026, 'balance', 'impuestos_pagar', 1120),
    (v_fin, v_y2026, 'balance', 'bancario_cp', 4800),
    (v_fin, v_y2026, 'balance', 'porcion_circulante_lp', 1500),
    (v_fin, v_y2026, 'balance', 'acreedores', 1180),
    (v_fin, v_y2026, 'balance', 'otras_cxp', 510),
    (v_fin, v_y2026, 'balance', 'bancario_lp', 6150),
    (v_fin, v_y2026, 'balance', 'pasivos_diferidos', 260),
    (v_fin, v_y2026, 'balance', 'capital_social', 6000),
    (v_fin, v_y2026, 'balance', 'aportaciones_futuras', 0),
    (v_fin, v_y2026, 'balance', 'reservas', 300),
    (v_fin, v_y2026, 'balance', 'revaluacion', 0),
    (v_fin, v_y2026, 'balance', 'resultados_acumulados', 9865);

  -- Estado de cambios: capturas complementarias (solo años con año anterior)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2024, 'cashflow', 'venta_activo_fijo', 0),
    (v_fin, v_y2024, 'cashflow', 'cambiaria_deuda_cp', 0),
    (v_fin, v_y2024, 'cashflow', 'cambiaria_deuda_lp', 0),
    (v_fin, v_y2024, 'cashflow', 'cambiaria_clientes', 0),
    (v_fin, v_y2024, 'cashflow', 'ajuste_revaluacion', 0),
    (v_fin, v_y2025, 'cashflow', 'venta_activo_fijo', 150),
    (v_fin, v_y2025, 'cashflow', 'cambiaria_deuda_cp', 0),
    (v_fin, v_y2025, 'cashflow', 'cambiaria_deuda_lp', 0),
    (v_fin, v_y2025, 'cashflow', 'cambiaria_clientes', 0),
    (v_fin, v_y2025, 'cashflow', 'ajuste_revaluacion', 0),
    (v_fin, v_y2026, 'cashflow', 'venta_activo_fijo', 0),
    (v_fin, v_y2026, 'cashflow', 'cambiaria_deuda_cp', 0),
    (v_fin, v_y2026, 'cashflow', 'cambiaria_deuda_lp', 0),
    (v_fin, v_y2026, 'cashflow', 'cambiaria_clientes', 0),
    (v_fin, v_y2026, 'cashflow', 'ajuste_revaluacion', 0);

  -- Segmentos: ventas (suman exactamente income.ventas)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2023, 'sales', v_seg_auto::text, 23500),
    (v_fin, v_y2023, 'sales', v_seg_electro::text, 11200),
    (v_fin, v_y2023, 'sales', v_seg_mant::text, 6500),
    (v_fin, v_y2024, 'sales', v_seg_auto::text, 27100),
    (v_fin, v_y2024, 'sales', v_seg_electro::text, 12800),
    (v_fin, v_y2024, 'sales', v_seg_mant::text, 7500),
    (v_fin, v_y2025, 'sales', v_seg_auto::text, 31400),
    (v_fin, v_y2025, 'sales', v_seg_electro::text, 15000),
    (v_fin, v_y2025, 'sales', v_seg_mant::text, 8900),
    (v_fin, v_y2026, 'sales', v_seg_auto::text, 17700),
    (v_fin, v_y2026, 'sales', v_seg_electro::text, 8300),
    (v_fin, v_y2026, 'sales', v_seg_mant::text, 5000);

  -- Segmentos: costo (suma exactamente income.costo)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2023, 'segcost', v_seg_auto::text, 16450),
    (v_fin, v_y2023, 'segcost', v_seg_electro::text, 7400),
    (v_fin, v_y2023, 'segcost', v_seg_mant::text, 3750),
    (v_fin, v_y2024, 'segcost', v_seg_auto::text, 18900),
    (v_fin, v_y2024, 'segcost', v_seg_electro::text, 8400),
    (v_fin, v_y2024, 'segcost', v_seg_mant::text, 4200),
    (v_fin, v_y2025, 'segcost', v_seg_auto::text, 21400),
    (v_fin, v_y2025, 'segcost', v_seg_electro::text, 9600),
    (v_fin, v_y2025, 'segcost', v_seg_mant::text, 4900),
    (v_fin, v_y2026, 'segcost', v_seg_auto::text, 12300),
    (v_fin, v_y2026, 'segcost', v_seg_electro::text, 5400),
    (v_fin, v_y2026, 'segcost', v_seg_mant::text, 2800);

  -- Desglose del gasto (20 conceptos + amortizaciones y otras_virtuales; con el memo suma el gasto operativo)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2023, 'expenses', 'sueldos', 2741),
    (v_fin, v_y2023, 'expenses', 'prestaciones', 822),
    (v_fin, v_y2023, 'expenses', 'bonos', 274),
    (v_fin, v_y2023, 'expenses', 'honorarios', 411),
    (v_fin, v_y2023, 'expenses', 'tecnologia', 219),
    (v_fin, v_y2023, 'expenses', 'suministros', 73),
    (v_fin, v_y2023, 'expenses', 'viajes', 183),
    (v_fin, v_y2023, 'expenses', 'mantenimiento', 457),
    (v_fin, v_y2023, 'expenses', 'marketing', 288),
    (v_fin, v_y2023, 'expenses', 'capacitacion', 110),
    (v_fin, v_y2023, 'expenses', 'seguros', 274),
    (v_fin, v_y2023, 'expenses', 'representacion', 91),
    (v_fin, v_y2023, 'expenses', 'servicios_basicos', 548),
    (v_fin, v_y2023, 'expenses', 'renta', 731),
    (v_fin, v_y2023, 'expenses', 'comunicaciones', 110),
    (v_fin, v_y2023, 'expenses', 'outsourcing', 411),
    (v_fin, v_y2023, 'expenses', 'innovacion', 183),
    (v_fin, v_y2023, 'expenses', 'logistica', 640),
    (v_fin, v_y2023, 'expenses', 'legales', 91),
    (v_fin, v_y2023, 'expenses', 'menores', 303),
    (v_fin, v_y2023, 'expenses', 'amortizaciones', 60),
    (v_fin, v_y2023, 'expenses', 'otras_virtuales', 40),
    (v_fin, v_y2024, 'expenses', 'sueldos', 3033),
    (v_fin, v_y2024, 'expenses', 'prestaciones', 910),
    (v_fin, v_y2024, 'expenses', 'bonos', 303),
    (v_fin, v_y2024, 'expenses', 'honorarios', 455),
    (v_fin, v_y2024, 'expenses', 'tecnologia', 303),
    (v_fin, v_y2024, 'expenses', 'suministros', 81),
    (v_fin, v_y2024, 'expenses', 'viajes', 243),
    (v_fin, v_y2024, 'expenses', 'mantenimiento', 505),
    (v_fin, v_y2024, 'expenses', 'marketing', 354),
    (v_fin, v_y2024, 'expenses', 'capacitacion', 158),
    (v_fin, v_y2024, 'expenses', 'seguros', 303),
    (v_fin, v_y2024, 'expenses', 'representacion', 101),
    (v_fin, v_y2024, 'expenses', 'servicios_basicos', 607),
    (v_fin, v_y2024, 'expenses', 'renta', 809),
    (v_fin, v_y2024, 'expenses', 'comunicaciones', 121),
    (v_fin, v_y2024, 'expenses', 'outsourcing', 455),
    (v_fin, v_y2024, 'expenses', 'innovacion', 202),
    (v_fin, v_y2024, 'expenses', 'logistica', 708),
    (v_fin, v_y2024, 'expenses', 'legales', 101),
    (v_fin, v_y2024, 'expenses', 'menores', 333),
    (v_fin, v_y2024, 'expenses', 'amortizaciones', 60),
    (v_fin, v_y2024, 'expenses', 'otras_virtuales', 45),
    (v_fin, v_y2025, 'expenses', 'sueldos', 3381),
    (v_fin, v_y2025, 'expenses', 'prestaciones', 1014),
    (v_fin, v_y2025, 'expenses', 'bonos', 338),
    (v_fin, v_y2025, 'expenses', 'honorarios', 583),
    (v_fin, v_y2025, 'expenses', 'tecnologia', 338),
    (v_fin, v_y2025, 'expenses', 'suministros', 90),
    (v_fin, v_y2025, 'expenses', 'viajes', 225),
    (v_fin, v_y2025, 'expenses', 'mantenimiento', 564),
    (v_fin, v_y2025, 'expenses', 'marketing', 493),
    (v_fin, v_y2025, 'expenses', 'capacitacion', 135),
    (v_fin, v_y2025, 'expenses', 'seguros', 338),
    (v_fin, v_y2025, 'expenses', 'representacion', 113),
    (v_fin, v_y2025, 'expenses', 'servicios_basicos', 676),
    (v_fin, v_y2025, 'expenses', 'renta', 902),
    (v_fin, v_y2025, 'expenses', 'comunicaciones', 135),
    (v_fin, v_y2025, 'expenses', 'outsourcing', 507),
    (v_fin, v_y2025, 'expenses', 'innovacion', 293),
    (v_fin, v_y2025, 'expenses', 'logistica', 789),
    (v_fin, v_y2025, 'expenses', 'legales', 113),
    (v_fin, v_y2025, 'expenses', 'menores', 373),
    (v_fin, v_y2025, 'expenses', 'amortizaciones', 60),
    (v_fin, v_y2025, 'expenses', 'otras_virtuales', 50),
    (v_fin, v_y2026, 'expenses', 'sueldos', 1926),
    (v_fin, v_y2026, 'expenses', 'prestaciones', 578),
    (v_fin, v_y2026, 'expenses', 'bonos', 193),
    (v_fin, v_y2026, 'expenses', 'honorarios', 376),
    (v_fin, v_y2026, 'expenses', 'tecnologia', 193),
    (v_fin, v_y2026, 'expenses', 'suministros', 51),
    (v_fin, v_y2026, 'expenses', 'viajes', 128),
    (v_fin, v_y2026, 'expenses', 'mantenimiento', 321),
    (v_fin, v_y2026, 'expenses', 'marketing', 225),
    (v_fin, v_y2026, 'expenses', 'capacitacion', 77),
    (v_fin, v_y2026, 'expenses', 'seguros', 193),
    (v_fin, v_y2026, 'expenses', 'representacion', 64),
    (v_fin, v_y2026, 'expenses', 'servicios_basicos', 385),
    (v_fin, v_y2026, 'expenses', 'renta', 514),
    (v_fin, v_y2026, 'expenses', 'comunicaciones', 77),
    (v_fin, v_y2026, 'expenses', 'outsourcing', 289),
    (v_fin, v_y2026, 'expenses', 'innovacion', 128),
    (v_fin, v_y2026, 'expenses', 'logistica', 539),
    (v_fin, v_y2026, 'expenses', 'legales', 96),
    (v_fin, v_y2026, 'expenses', 'menores', 212),
    (v_fin, v_y2026, 'expenses', 'amortizaciones', 30),
    (v_fin, v_y2026, 'expenses', 'otras_virtuales', 25);

  -- Estacionalidad en ventas (suma income.ventas; en 2026 solo los 6 meses del periodo)
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES
    (v_fin, v_y2023, 'seasonality', 'm01', 2920),
    (v_fin, v_y2023, 'seasonality', 'm02', 3138),
    (v_fin, v_y2023, 'seasonality', 'm03', 3709),
    (v_fin, v_y2023, 'seasonality', 'm04', 3461),
    (v_fin, v_y2023, 'seasonality', 'm05', 3583),
    (v_fin, v_y2023, 'seasonality', 'm06', 3545),
    (v_fin, v_y2023, 'seasonality', 'm07', 3138),
    (v_fin, v_y2023, 'seasonality', 'm08', 3627),
    (v_fin, v_y2023, 'seasonality', 'm09', 3798),
    (v_fin, v_y2023, 'seasonality', 'm10', 3869),
    (v_fin, v_y2023, 'seasonality', 'm11', 3837),
    (v_fin, v_y2023, 'seasonality', 'm12', 2575),
    (v_fin, v_y2024, 'seasonality', 'm01', 3393),
    (v_fin, v_y2024, 'seasonality', 'm02', 3648),
    (v_fin, v_y2024, 'seasonality', 'm03', 4312),
    (v_fin, v_y2024, 'seasonality', 'm04', 3789),
    (v_fin, v_y2024, 'seasonality', 'm05', 4166),
    (v_fin, v_y2024, 'seasonality', 'm06', 4120),
    (v_fin, v_y2024, 'seasonality', 'm07', 3648),
    (v_fin, v_y2024, 'seasonality', 'm08', 4216),
    (v_fin, v_y2024, 'seasonality', 'm09', 4158),
    (v_fin, v_y2024, 'seasonality', 'm10', 4497),
    (v_fin, v_y2024, 'seasonality', 'm11', 4460),
    (v_fin, v_y2024, 'seasonality', 'm12', 2993),
    (v_fin, v_y2025, 'seasonality', 'm01', 3784),
    (v_fin, v_y2025, 'seasonality', 'm02', 4320),
    (v_fin, v_y2025, 'seasonality', 'm03', 5104),
    (v_fin, v_y2025, 'seasonality', 'm04', 4487),
    (v_fin, v_y2025, 'seasonality', 'm05', 4932),
    (v_fin, v_y2025, 'seasonality', 'm06', 4595),
    (v_fin, v_y2025, 'seasonality', 'm07', 4320),
    (v_fin, v_y2025, 'seasonality', 'm08', 4991),
    (v_fin, v_y2025, 'seasonality', 'm09', 4925),
    (v_fin, v_y2025, 'seasonality', 'm10', 5325),
    (v_fin, v_y2025, 'seasonality', 'm11', 4973),
    (v_fin, v_y2025, 'seasonality', 'm12', 3544),
    (v_fin, v_y2026, 'seasonality', 'm01', 4357),
    (v_fin, v_y2026, 'seasonality', 'm02', 4973),
    (v_fin, v_y2026, 'seasonality', 'm03', 5534),
    (v_fin, v_y2026, 'seasonality', 'm04', 5166),
    (v_fin, v_y2026, 'seasonality', 'm05', 5677),
    (v_fin, v_y2026, 'seasonality', 'm06', 5293);

  SELECT count(*) INTO v_n_years  FROM fin_years  WHERE analysis_id = v_fin;
  SELECT count(*) INTO v_n_lines  FROM fin_lines  WHERE analysis_id = v_fin;
  SELECT count(*) INTO v_n_values FROM fin_values WHERE analysis_id = v_fin;
  IF v_n_values <> 333 THEN
    RAISE EXCEPTION 'Se esperaban 333 cifras y quedaron %; se revierte.', v_n_values;
  END IF;
  RAISE NOTICE 'Seed demo MP-AFH1 listo para % (análisis %): % periodos, % segmentos, % cifras.',
    v_email, v_fin, v_n_years, v_n_lines, v_n_values;
END $$;

COMMIT;
