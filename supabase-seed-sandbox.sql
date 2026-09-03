-- ============================================================
-- Seed de datos de prueba VISIBLES SOLO PARA UNA CUENTA (sandbox)
-- ============================================================
-- Cómo funciona:
--   1. Agrega la columna sandbox_owner_id a las tablas "raíz" de cada
--      módulo (departments, risks, strategic_plans, fin_analyses).
--   2. Crea políticas RLS RESTRICTIVAS: una fila con sandbox_owner_id
--      solo la ve ese usuario; las filas normales (NULL) las ven todos.
--      No se toca el código de la app.
--   3. Siembra datos demo de Matriz de Riesgos y Planeación Estratégica
--      ligados a tu usuario. (Análisis Financiero se sembrará cuando el
--      módulo esté terminado.)
--
-- ⚠️ IMPORTANTE:
--   - Cambia v_email abajo si tu cuenta de la app usa otro correo.
--   - Mientras exista el plan estratégico sandbox, TU cuenta verá SOLO
--     los datos de prueba en Planeación Estratégica (el plan real de la
--     organización queda oculto para ti, intacto para los demás).
--     Al correr supabase-seed-cleanup.sql vuelves a ver el plan real.
--   - En Matriz de Riesgos verás los departamentos/riesgos demo MEZCLADOS
--     con los reales (los demás usuarios no ven los demo).
--   - Lo que captures NUEVO desde la app (ej. un riesgo nuevo) NO es
--     sandbox: lo verán todos, como siempre.
--
-- Ejecutar en Supabase → SQL Editor. Para borrar todo el seed:
-- supabase-seed-cleanup.sql
-- ============================================================

-- ---------- 1. Columnas sandbox ----------
ALTER TABLE departments     ADD COLUMN IF NOT EXISTS sandbox_owner_id UUID;
ALTER TABLE risks           ADD COLUMN IF NOT EXISTS sandbox_owner_id UUID;
ALTER TABLE strategic_plans ADD COLUMN IF NOT EXISTS sandbox_owner_id UUID;

-- ---------- 2. Políticas restrictivas (se suman con AND a las existentes) ----------
DROP POLICY IF EXISTS "sandbox visibility" ON departments;
CREATE POLICY "sandbox visibility" ON departments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (sandbox_owner_id IS NULL OR sandbox_owner_id = auth.uid());

DROP POLICY IF EXISTS "sandbox visibility" ON risks;
CREATE POLICY "sandbox visibility" ON risks
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (sandbox_owner_id IS NULL OR sandbox_owner_id = auth.uid());

DROP POLICY IF EXISTS "sandbox visibility" ON strategic_plans;
CREATE POLICY "sandbox visibility" ON strategic_plans
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (sandbox_owner_id IS NULL OR sandbox_owner_id = auth.uid());

-- fin_analyses solo si ya corriste supabase-fin-analysis.sql (si no, se
-- prepara sola cuando vuelvas a correr este script tras crear la tabla).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'fin_analyses') THEN
    ALTER TABLE fin_analyses ADD COLUMN IF NOT EXISTS sandbox_owner_id UUID;
    DROP POLICY IF EXISTS "sandbox visibility" ON fin_analyses;
    CREATE POLICY "sandbox visibility" ON fin_analyses
      AS RESTRICTIVE FOR SELECT TO authenticated
      USING (sandbox_owner_id IS NULL OR sandbox_owner_id = auth.uid());
  END IF;
END $$;

-- ---------- 3. Datos demo ----------
DO $$
DECLARE
  v_email TEXT := 'tenryu@mara-perez.online';  -- ⚠️ tu correo en la app
  v_uid   UUID;
  v_dep_ventas UUID; v_dep_ops UUID; v_dep_ti UUID;
  v_plan  UUID;
  v_comp1 UUID; v_comp2 UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %. Edita v_email en el script.', v_email;
  END IF;

  IF EXISTS (SELECT 1 FROM strategic_plans WHERE sandbox_owner_id = v_uid)
     OR EXISTS (SELECT 1 FROM departments WHERE sandbox_owner_id = v_uid) THEN
    RAISE EXCEPTION 'Ya hay datos sandbox para este usuario. Corre primero supabase-seed-cleanup.sql.';
  END IF;

  -- ===== Matriz de Riesgos =====
  INSERT INTO departments (name, description, sandbox_owner_id)
    VALUES ('Ventas (demo)', 'Departamento de prueba — solo visible para tu cuenta', v_uid)
    RETURNING id INTO v_dep_ventas;
  INSERT INTO departments (name, description, sandbox_owner_id)
    VALUES ('Operaciones (demo)', 'Departamento de prueba — solo visible para tu cuenta', v_uid)
    RETURNING id INTO v_dep_ops;
  INSERT INTO departments (name, description, sandbox_owner_id)
    VALUES ('Tecnología (demo)', 'Departamento de prueba — solo visible para tu cuenta', v_uid)
    RETURNING id INTO v_dep_ti;

  INSERT INTO risks (
    department_id, threat_type, description,
    inherent_probability, inherent_impact, inherent_level,
    risk_strategy, mitigant_1, mitigant_impact_1,
    control_type_1, control_documented_1, process_type_1,
    control_evidence_1, control_responsible_1, control_frequency_1, control_grade_1,
    residual_probability, residual_impact, residual_level,
    created_by_id, sandbox_owner_id
  ) VALUES
  -- Ventas: intolerable → medio (mitigado)
  (v_dep_ventas, 'Externa', 'Pérdida del cliente principal, que concentra el 40% de los ingresos',
   'Frecuente (81-100%)', 'Mayor', 'Intolerable',
   'Reducir', 'Plan de diversificación de cartera y contratos anuales con clientes clave', 'Mitiga la probabilidad',
   'Control Preventivo', 'Sí', 'Combinado', 'Sí', 'Sí', 'Sí', 'Fuerte',
   'Ocasional (41-60%)', 'Mayor', 'Medio',
   v_uid, v_uid),
  -- Ventas: alto → bajo (mitigado)
  (v_dep_ventas, 'Interna', 'Errores en cotizaciones por captura manual de precios',
   'Probable (61-80%)', 'Mayor', 'Alto',
   'Reducir', 'Catálogo de precios centralizado con aprobación automática', 'Mitiga la probabilidad e impacto',
   'Control Preventivo', 'Sí', 'Automatizado', 'Sí', 'Sí', 'Sí', 'Fuerte',
   'Improbable (21-40%)', 'Crítico', 'Bajo',
   v_uid, v_uid),
  -- Operaciones: alto → alto (NO mitigado, dispara alertas del dashboard)
  (v_dep_ops, 'Externa', 'Interrupción de la cadena de suministro por dependencia de un solo proveedor',
   'Probable (61-80%)', 'Mayor', 'Alto',
   'Reducir', 'Búsqueda de proveedores alternos (en proceso)', 'Mitiga la probabilidad',
   'Control Correctivo', 'No', 'Manual', 'No', 'Sí', 'No', 'Débil',
   'Probable (61-80%)', 'Mayor', 'Alto',
   v_uid, v_uid),
  -- Operaciones: medio → tolerable
  (v_dep_ops, 'Interna', 'Retrasos en entregas por falta de planeación de rutas',
   'Ocasional (41-60%)', 'Crítico', 'Medio',
   'Reducir', 'Software de optimización de rutas y monitoreo diario', 'Mitiga la probabilidad',
   'Control Detectivo', 'Sí', 'Automatizado', 'Sí', 'Sí', 'Sí', 'Fuerte',
   'Improbable (21-40%)', 'Menor', 'Tolerable',
   v_uid, v_uid),
  -- TI: intolerable → medio
  (v_dep_ti, 'Externa', 'Ataque de ransomware que detenga la operación',
   'Probable (61-80%)', 'Catastrófico', 'Intolerable',
   'Transferir', 'Respaldo diario cifrado, antivirus corporativo y póliza de ciberseguridad', 'Mitiga el impacto',
   'Control Preventivo', 'Sí', 'Automatizado', 'Sí', 'Sí', 'Sí', 'Fuerte',
   'Improbable (21-40%)', 'Mayor', 'Bajo',
   v_uid, v_uid),
  -- TI: tolerable (aceptado, sin mitigante)
  (v_dep_ti, 'Interna', 'Indisponibilidad breve del sitio web por mantenimientos',
   'Improbable (21-40%)', 'Menor', 'Tolerable',
   'Aceptar', NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   'Improbable (21-40%)', 'Menor', 'Tolerable',
   v_uid, v_uid);

  -- ===== Planeación Estratégica =====
  -- created_at antiguo para que getOrCreate (ordena por created_at) le dé
  -- a TU cuenta este plan sandbox; los demás no lo ven por RLS.
  INSERT INTO strategic_plans (id, name, vision, mission, core_values, year, created_by_id, sandbox_owner_id, created_at)
  VALUES (
    gen_random_uuid(), 'Plan estratégico (demo)',
    'Ser la empresa de referencia en soluciones industriales del Bajío para 2029.',
    'Ayudamos a plantas manufactureras a producir más con menos, con tecnología accesible y servicio cercano.',
    'Compromiso · Honestidad · Mejora continua',
    2026, v_uid, v_uid, '2000-01-01'
  )
  RETURNING id INTO v_plan;

  -- Análisis del cliente
  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  (v_plan, 'customer', 'dolores', 'Paros de línea no programados y refacciones que tardan semanas en llegar.'),
  (v_plan, 'customer', 'deseos', 'Producir sin interrupciones y cumplir sus entregas a tiempo.'),
  (v_plan, 'customer', 'metas_funcionales', 'Reducir el tiempo muerto de sus máquinas a menos del 2%.'),
  (v_plan, 'customer', 'metas_emocionales', 'Tranquilidad de que la planta no se detendrá en temporada alta.'),
  (v_plan, 'customer', 'deseos_basicos', 'Seguridad, ahorrar y crecer.'),
  (v_plan, 'customer', 'objeciones_exterior', 'Incertidumbre económica y tipo de cambio.'),
  (v_plan, 'customer', 'objeciones_producto', 'Perciben el precio alto frente a proveedores informales.'),
  (v_plan, 'customer', 'promesa', 'Tu línea nunca se detiene: refacciones y servicio en menos de 24 horas.'),
  (v_plan, 'customer', 'comunicacion', 'Parcialmente; el sitio web aún habla de productos y no de la promesa.');

  -- Análisis del mercado (Blue Ocean)
  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  (v_plan, 'market', 'bo_eliminar', 'Catálogos impresos que nadie consulta'),
  (v_plan, 'market', 'bo_reducir', 'Visitas presenciales de cortesía sin agenda técnica'),
  (v_plan, 'market', 'bo_crear', E'Monitoreo remoto de máquinas con alertas tempranas\nPrograma de refacciones en consignación en planta del cliente'),
  (v_plan, 'market', 'bo_incrementar', E'Capacitación técnica gratuita a operadores del cliente\nTiempos de respuesta garantizados por contrato');

  -- Competidores y su comparación
  INSERT INTO competitors (plan_id, name, position) VALUES (v_plan, 'Competidor Alfa', 0) RETURNING id INTO v_comp1;
  INSERT INTO competitors (plan_id, name, position) VALUES (v_plan, 'Competidor Beta', 1) RETURNING id INTO v_comp2;

  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  (v_plan, 'market-comp:' || v_comp1, 'precio', 'Menor'),
  (v_plan, 'market-comp:' || v_comp1, 'servicio', 'Peor'),
  (v_plan, 'market-comp:' || v_comp1, 'postventa_mejor', 'No'),
  (v_plan, 'market-comp:' || v_comp1, 'entrega_simple', 'Sí'),
  (v_plan, 'market-comp:' || v_comp1, 'entrega_comoda', 'No'),
  (v_plan, 'market-comp:' || v_comp1, 'imagen', 'No'),
  (v_plan, 'market-comp:' || v_comp1, 'mercado', 'Más'),
  (v_plan, 'market-comp:' || v_comp1, 'redes', 'Sí'),
  (v_plan, 'market-comp:' || v_comp1, 'publicidad', 'No'),
  (v_plan, 'market-comp:' || v_comp1, 'ventajas', 'Precio bajo y cobertura nacional'),
  (v_plan, 'market-comp:' || v_comp1, 'desventajas', 'Servicio lento y sin soporte técnico'),
  (v_plan, 'market-comp:' || v_comp2, 'precio', 'Mayor'),
  (v_plan, 'market-comp:' || v_comp2, 'servicio', 'Mejor'),
  (v_plan, 'market-comp:' || v_comp2, 'servicio_detalle', 'Tiene ingenieros de servicio dedicados por cliente'),
  (v_plan, 'market-comp:' || v_comp2, 'postventa_mejor', 'Sí'),
  (v_plan, 'market-comp:' || v_comp2, 'entrega_simple', 'No'),
  (v_plan, 'market-comp:' || v_comp2, 'entrega_comoda', 'No'),
  (v_plan, 'market-comp:' || v_comp2, 'imagen', 'Sí'),
  (v_plan, 'market-comp:' || v_comp2, 'mercado', 'Menos'),
  (v_plan, 'market-comp:' || v_comp2, 'redes', 'Sí'),
  (v_plan, 'market-comp:' || v_comp2, 'publicidad', 'Sí');

  -- Conclusiones del mercado (F = mantener, D = cambiar)
  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  (v_plan, 'market-conclusions', 'precio_valor', 'F'),
  (v_plan, 'market-conclusions', 'servicio_calidad', 'F'),
  (v_plan, 'market-conclusions', 'entrega_tiempo', 'F'),
  (v_plan, 'market-conclusions', 'entrega_imagen', 'F'),
  (v_plan, 'market-conclusions', 'servicio_encuestas', 'D'),
  (v_plan, 'market-conclusions', 'servicio_resenas', 'D'),
  (v_plan, 'market-conclusions', 'postventa_retencion', 'D'),
  (v_plan, 'market-conclusions', 'entrega_simple', 'D'),
  (v_plan, 'market-conclusions', 'audiencia_incrementar', 'D'),
  (v_plan, 'market-conclusions', 'audiencia_leads', 'D');

  -- Análisis de oportunidades (Sí → fortaleza, No → debilidad)
  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  (v_plan, 'opportunities', 'precios', 'Sí'),
  (v_plan, 'opportunities', 'recompra', 'Sí'),
  (v_plan, 'opportunities', 'contenido', 'Sí'),
  (v_plan, 'opportunities', 'clientes_clave', 'Sí'),
  (v_plan, 'opportunities', 'talento', 'Sí'),
  (v_plan, 'opportunities', 'compromiso', 'Sí'),
  (v_plan, 'opportunities', 'percepcion', 'No'),
  (v_plan, 'opportunities', 'influencers', 'No'),
  (v_plan, 'opportunities', 'atraccion', 'No'),
  (v_plan, 'opportunities', 'conversion', 'No'),
  (v_plan, 'opportunities', 'liquidez', 'No'),
  (v_plan, 'opportunities', 'cartera', 'No'),
  (v_plan, 'opportunities', 'info_mercado', 'No'),
  (v_plan, 'opportunities', 'ia', 'No'),
  (v_plan, 'opportunities', 'formacion', 'No');

  -- Estrategias financieras (F = ya lo haces, D = por implementar)
  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  (v_plan, 'financial-strategies', 'ventas_volumen', 'F'),
  (v_plan, 'financial-strategies', 'costo_volumen', 'F'),
  (v_plan, 'financial-strategies', 'ventas_utilidad_linea', 'D'),
  (v_plan, 'financial-strategies', 'ventas_dependencia', 'D'),
  (v_plan, 'financial-strategies', 'gastos_eficientar', 'D'),
  (v_plan, 'financial-strategies', 'imp_ahorro_mensual', 'D'),
  (v_plan, 'financial-strategies', 'reserva_crecimiento', 'D');

  -- Calificaciones del resumen (algunas quedan sin calificar a propósito,
  -- para que el dashboard muestre la alerta correspondiente)
  INSERT INTO plan_answers (plan_id, section, question_key, answer) VALUES
  -- Prioridad ALTA (puntaje 1.0 – 1.3)
  (v_plan, 'summary-ratings', 'opp:atraccion:costo', 'Bajo'),
  (v_plan, 'summary-ratings', 'opp:atraccion:riesgo', 'Bajo'),
  (v_plan, 'summary-ratings', 'opp:atraccion:complejidad', 'Baja'),
  (v_plan, 'summary-ratings', 'opp:atraccion:beneficio', 'Ingresos'),
  (v_plan, 'summary-ratings', 'opp:conversion:costo', 'Bajo'),
  (v_plan, 'summary-ratings', 'opp:conversion:riesgo', 'Bajo'),
  (v_plan, 'summary-ratings', 'opp:conversion:complejidad', 'Baja'),
  (v_plan, 'summary-ratings', 'opp:conversion:beneficio', 'Ingresos'),
  (v_plan, 'summary-ratings', 'mkt:postventa_retencion:costo', 'Bajo'),
  (v_plan, 'summary-ratings', 'mkt:postventa_retencion:riesgo', 'Bajo'),
  (v_plan, 'summary-ratings', 'mkt:postventa_retencion:complejidad', 'Baja'),
  (v_plan, 'summary-ratings', 'mkt:postventa_retencion:beneficio', 'Ingresos'),
  (v_plan, 'summary-ratings', 'fin:ventas_utilidad_linea:costo', 'Bajo'),
  (v_plan, 'summary-ratings', 'fin:ventas_utilidad_linea:riesgo', 'Bajo'),
  (v_plan, 'summary-ratings', 'fin:ventas_utilidad_linea:complejidad', 'Media'),
  (v_plan, 'summary-ratings', 'fin:ventas_utilidad_linea:beneficio', 'Ahorros'),
  -- Prioridad MEDIA (puntaje ~1.7 – 2.0)
  (v_plan, 'summary-ratings', 'mkt:servicio_encuestas:costo', 'Medio'),
  (v_plan, 'summary-ratings', 'mkt:servicio_encuestas:riesgo', 'Medio'),
  (v_plan, 'summary-ratings', 'mkt:servicio_encuestas:complejidad', 'Media'),
  (v_plan, 'summary-ratings', 'mkt:servicio_encuestas:beneficio', 'Ahorros'),
  (v_plan, 'summary-ratings', 'opp:percepcion:costo', 'Medio'),
  (v_plan, 'summary-ratings', 'opp:percepcion:riesgo', 'Medio'),
  (v_plan, 'summary-ratings', 'opp:percepcion:complejidad', 'Media'),
  (v_plan, 'summary-ratings', 'opp:percepcion:beneficio', 'Ingresos'),
  (v_plan, 'summary-ratings', 'opp:liquidez:costo', 'Medio'),
  (v_plan, 'summary-ratings', 'opp:liquidez:riesgo', 'Medio'),
  (v_plan, 'summary-ratings', 'opp:liquidez:complejidad', 'Baja'),
  (v_plan, 'summary-ratings', 'opp:liquidez:beneficio', 'Ingresos'),
  (v_plan, 'summary-ratings', 'fin:gastos_eficientar:costo', 'Medio'),
  (v_plan, 'summary-ratings', 'fin:gastos_eficientar:riesgo', 'Medio'),
  (v_plan, 'summary-ratings', 'fin:gastos_eficientar:complejidad', 'Media'),
  (v_plan, 'summary-ratings', 'fin:gastos_eficientar:beneficio', 'Ahorros'),
  -- Prioridad BAJA (puntaje ~2.85)
  (v_plan, 'summary-ratings', 'mkt:entrega_simple:costo', 'Alto'),
  (v_plan, 'summary-ratings', 'mkt:entrega_simple:riesgo', 'Alto'),
  (v_plan, 'summary-ratings', 'mkt:entrega_simple:complejidad', 'Alta'),
  (v_plan, 'summary-ratings', 'mkt:entrega_simple:beneficio', 'Ahorros'),
  (v_plan, 'summary-ratings', 'opp:influencers:costo', 'Alto'),
  (v_plan, 'summary-ratings', 'opp:influencers:riesgo', 'Alto'),
  (v_plan, 'summary-ratings', 'opp:influencers:complejidad', 'Alta'),
  (v_plan, 'summary-ratings', 'opp:influencers:beneficio', 'Ahorros');

  -- Iniciativas estratégicas (una vencida y una por vencer, para ver las
  -- alertas del dashboard; dos objetivos Alta quedan sin plan a propósito)
  INSERT INTO strategic_initiatives
    (plan_id, strategy_id, title, expected_result, area, owner, start_date, end_date, budget, kpi, steps, position)
  VALUES
  (v_plan, 'opp:atraccion', 'Campaña de contenido técnico en LinkedIn',
   'Generar 50 prospectos calificados por trimestre', 'Marketing', 'Laura M.',
   CURRENT_DATE - 120, CURRENT_DATE - 10, 80, 'Prospectos calificados / trimestre',
   E'1. Definir calendario editorial\n2. Producir 2 piezas por semana\n3. Medir y ajustar mensualmente', 0),
  (v_plan, 'opp:atraccion', 'Webinars mensuales con clientes actuales',
   'Posicionar la marca como experta del sector', 'Marketing', 'Laura M.',
   CURRENT_DATE - 30, CURRENT_DATE + 150, 45, 'Asistentes por webinar',
   E'1. Agendar 6 webinars\n2. Invitar a la base de clientes\n3. Dar seguimiento a asistentes', 1),
  (v_plan, 'opp:conversion', 'Implementar CRM con seguimiento de embudo',
   'Convertir el 15% de los prospectos en clientes', 'Comercial', 'Ricardo T.',
   CURRENT_DATE - 60, CURRENT_DATE + 20, 120, '% de conversión de prospectos',
   E'1. Elegir CRM\n2. Migrar cartera\n3. Capacitar al equipo comercial', 2);

  RAISE NOTICE 'Seed sandbox creado para % (usuario %)', v_email, v_uid;
END $$;
