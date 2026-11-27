-- =============================================================================
-- MAPA DE DEPENDENCIA — semana de ejemplo (datos inventados)
-- =============================================================================
-- Carga una medición completa (37 actividades en cinco días y 9 decisiones) en
-- la empresa de una cuenta, para probar el módulo sin teclear una semana. Las
-- personas, la empresa y las situaciones son inventadas.
--
-- También le da el módulo «dependency» a esa empresa. Se puede correr más de
-- una vez: sustituye la medición de ejemplo anterior de esa empresa (y su
-- diagnóstico), sin tocar las demás.
--
--   psql -v email=demo.admin@example.com -f supabase-seed-mapa-demo.sql
--   Base local: npm run db:local:mapa:demo
-- =============================================================================
\set ON_ERROR_STOP on
\if :{?email}
\else
  \set email demo.admin@example.com
\endif

BEGIN;

SELECT set_config('seed.email', :'email', true);

DO $$
DECLARE
  v_email text := current_setting('seed.email');
  uid uuid;
  cid uuid;
  m   uuid;
  k_title constant text := '9 al 13 de noviembre de 2026 (ejemplo)';
BEGIN
  SELECT u.id, cm.company_id INTO uid, cid
    FROM auth.users u JOIN public.company_members cm ON cm.user_id = u.id
   WHERE lower(u.email) = lower(v_email);
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No existe la cuenta % (o no tiene empresa)', v_email;
  END IF;

  INSERT INTO public.company_modules (company_id, module_key) VALUES (cid, 'dependency') ON CONFLICT DO NOTHING;
  DELETE FROM public.dep_measurements WHERE company_id = cid AND title = k_title;

  INSERT INTO public.dep_measurements (company_id, owner_id, created_by_id, title, person_name, job_title)
  VALUES (cid, uid, uid, k_title, 'Laura Méndez (ejemplo)', 'Directora general')
  RETURNING id INTO m;

  INSERT INTO public.dep_activities (measurement_id, activity_date, description, purpose, minutes, position)
  SELECT m, x.d::date, x.a, NULLIF(x.p, ''), x.min, (row_number() OVER ())::int - 1
    FROM (VALUES
    ('2026-11-09', 'Coticé personalmente el pedido de rodamientos de un cliente de Querétaro porque el vendedor no tenía la lista de precios vigente', 'Enviar la cotización el mismo día', 50),
    ('2026-11-09', 'Revisé con la encargada de almacén las entregas atrasadas de la semana pasada y reprogramé tres rutas', 'Recuperar el programa de entregas', 45),
    ('2026-11-09', 'Autoricé en el portal del banco los pagos a proveedores de la semana', 'Liberar los pagos vencidos', 35),
    ('2026-11-09', 'Reunión one to one con el jefe de ventas para revisar su avance contra la cuota del mes y los prospectos detenidos', 'Darle retroalimentación sobre su desempeño', 40),
    ('2026-11-09', 'Atendí por teléfono la queja de un cliente por una pieza equivocada y coordiné el cambio con almacén', 'Conservar al cliente', 30),
    ('2026-11-09', 'Capturé en el sistema las facturas de compra que faltaban', 'Cerrar el corte semanal de compras', 60),
    ('2026-11-09', 'Trabajé en el borrador del organigrama con las responsabilidades de cada puesto', 'Definir quién responde por cada área', 75),
    ('2026-11-09', 'Respondí correos y mensajes de proveedores sobre fechas de entrega', 'Confirmar las llegadas de mercancía', 40),
    ('2026-11-10', 'Visité a un cliente corporativo junto con el vendedor para cerrar el contrato anual de suministro', 'Cerrar el contrato', 120),
    ('2026-11-10', 'Preparé yo misma la propuesta económica del contrato anual', 'Entregar la propuesta al cliente', 70),
    ('2026-11-10', 'Organicé con compras y almacén el calendario de recepción de mercancía del mes', 'Evitar que el almacén se sature', 45),
    ('2026-11-10', 'Revisé el reporte de ventas de la semana y pedí al jefe de ventas explicar la caída en una línea de producto', 'Detectar desviaciones contra la meta', 30),
    ('2026-11-10', 'Resolví la descompostura de la camioneta de reparto: busqué taller y renté una unidad', 'No detener las entregas del día', 80),
    ('2026-11-10', 'Di seguimiento por mensaje a los pendientes de cada área', 'Que los pendientes avancen', 35),
    ('2026-11-10', 'Hice la conciliación bancaria de la cuenta principal', 'Conocer el saldo real', 55),
    ('2026-11-11', 'Sesión con el consultor para definir los indicadores que revisará la dirección cada mes', 'Diseñar el tablero de indicadores de la empresa', 90),
    ('2026-11-11', 'Entrevisté a dos candidatos para auxiliar de almacén', 'Cubrir la vacante', 60),
    ('2026-11-11', 'Corregí la lista de precios en el sistema después del aumento del proveedor', 'Tener los precios actualizados', 50),
    ('2026-11-11', 'Junta semanal con los responsables de ventas, compras y almacén para repartir pendientes y fechas', 'Coordinar el trabajo de la semana', 60),
    ('2026-11-11', 'Revisé con la contadora los estados financieros de octubre', 'Entender el resultado del mes', 45),
    ('2026-11-11', 'Surtí y revisé un pedido urgente porque faltó personal en almacén', 'Entregar el pedido a tiempo', 70),
    ('2026-11-11', 'Llamé a tres clientes con facturas vencidas', 'Cobrar la cartera vencida', 40),
    ('2026-11-12', 'Negocié con el proveedor principal el descuento por volumen del siguiente trimestre', 'Mejorar el margen', 60),
    ('2026-11-12', 'Observé cómo el vendedor nuevo atiende el mostrador y le di retroalimentación', 'Verificar que sigue el proceso de venta', 35),
    ('2026-11-12', 'Elaboré la nómina quincenal', 'Pagar a tiempo', 65),
    ('2026-11-12', 'Definí con el jefe de ventas hasta qué monto puede autorizar descuentos sin consultarme', 'Establecer niveles de autorización', 45),
    ('2026-11-12', 'Reasigné las rutas de entrega por la ausencia de un chofer', 'Cumplir las entregas del día', 30),
    ('2026-11-12', 'Hice cotizaciones de mostrador que me pasaron porque el cliente pidió hablar conmigo', 'Atender al cliente', 45),
    ('2026-11-12', 'Revisé las devoluciones del mes con la encargada de almacén y pedí corregir el registro de dos', 'Verificar que se cumpla el procedimiento', 30),
    ('2026-11-12', 'Respondí correos de clientes y proveedores', '', 35),
    ('2026-11-13', 'Trabajé en el plan para abrir una segunda sucursal: mercado, inversión y calendario', 'Decidir si se abre la sucursal el próximo año', 100),
    ('2026-11-13', 'Revisé con cada responsable el avance de sus pendientes de la semana y ajusté fechas', 'Mantener la ejecución al día', 50),
    ('2026-11-13', 'Hice el pedido semanal al proveedor principal', 'Reabastecer el inventario', 40),
    ('2026-11-13', 'Documenté el procedimiento de devoluciones para que almacén lo aplique sin consultarme', 'Institucionalizar el proceso', 60),
    ('2026-11-13', 'Atendí al auditor de un cliente corporativo y le entregué los documentos que pidió', 'Mantener la certificación como proveedor', 55),
    ('2026-11-13', 'Hice el cierre de caja y el depósito bancario', 'Resguardar el efectivo', 30),
    ('2026-11-13', 'Llamada con el banco para renovar la línea de crédito', 'Asegurar el capital de trabajo', 35)
    ) AS x(d, a, p, min);

  INSERT INTO public.dep_decisions (measurement_id, decision_date, requester, description, intervention, reason, minutes, position)
  SELECT m, x.d::date, x.who, x.what, x.kind, NULLIF(x.why, ''), x.min, (row_number() OVER ())::int - 1
    FROM (VALUES
    ('2026-11-09', 'Almacén', 'Preguntó si podía recibir mercancía que llegó sin orden de compra', 'validar', 'proceso', 15),
    ('2026-11-09', 'Jefe de ventas', 'Pidió autorizar un descuento mayor al habitual para un cliente frecuente', 'autorizar', 'autoridad', 10),
    ('2026-11-10', 'Chofer de reparto', 'La camioneta no arrancó y no sabía a quién llamar', 'resolver', 'proceso', 80),
    ('2026-11-10', 'Compras', 'No sabía si aceptar el aumento de precio de un proveedor', 'decidir', 'autoridad', 20),
    ('2026-11-11', 'Vendedor de mostrador', 'Preguntó cómo cotizar una pieza que no está en la lista de precios', 'indicar', 'conocimiento', 15),
    ('2026-11-12', 'Contadora', 'Pidió que aprobara la nómina antes de dispersarla', 'validar', 'riesgo', 20),
    ('2026-11-12', 'Almacén', 'Un cliente quería devolver una pieza usada y no sabían si aceptarla', 'decidir', 'temor', 25),
    ('2026-11-13', 'Jefe de ventas', 'Pidió que yo llamara a un cliente molesto por un retraso', 'resolver', 'habito', 30),
    ('2026-11-13', 'Compras', 'Esperaba mi visto bueno para enviar el pedido semanal', 'desbloquear', '', 10)
    ) AS x(d, who, what, kind, why, min);

  RAISE NOTICE 'Semana de ejemplo cargada para % (37 actividades, 9 decisiones)', v_email;
END $$;

COMMIT;
