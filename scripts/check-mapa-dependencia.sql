-- Pruebas del módulo Mapa de dependencia (supabase-mapa-dependencia.sql):
-- acceso por empresa y por módulo, «solo ver», mentor, diagnóstico de solo
-- lectura, historial de cambios y borrado en cascada.
-- Todo en una transacción que se revierte: no deja nada en la base.
--   docker exec -i supabase_db_hcmeoducjqudokfhhvyc psql -U postgres -d postgres -q < scripts/check-mapa-dependencia.sql
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  a uuid; ca uuid; b uuid; cb uuid; adm uuid;
  men uuid := gen_random_uuid(); viewer uuid := gen_random_uuid();
  m uuid; act uuid; dec uuid; n int; r jsonb; hdr text; denied boolean;
BEGIN
  -- Dos empresas distintas, cada una con su administrador (que no sea
  -- administrador de la plataforma: esos entran a todos los módulos).
  SELECT cm.user_id, cm.company_id INTO a, ca
    FROM company_members cm JOIN auth.users u ON u.id = cm.user_id
   WHERE cm.role = 'admin' AND COALESCE(u.raw_app_meta_data->>'role', 'user') = 'user'
   ORDER BY cm.created_at, cm.user_id LIMIT 1;
  SELECT cm.user_id, cm.company_id INTO b, cb
    FROM company_members cm JOIN auth.users u ON u.id = cm.user_id
   WHERE cm.role = 'admin' AND COALESCE(u.raw_app_meta_data->>'role', 'user') = 'user' AND cm.company_id <> ca
   ORDER BY cm.created_at, cm.user_id LIMIT 1;
  SELECT id INTO adm FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' AND id NOT IN (a, b) LIMIT 1;
  ASSERT a IS NOT NULL AND b IS NOT NULL AND adm IS NOT NULL, 'faltan cuentas para la prueba';
  hdr := json_build_object('x-company-id', ca)::text;
  DELETE FROM company_modules WHERE module_key = 'dependency' AND company_id IN (ca, cb);

  -- Sin el módulo: no se ve ni se guarda nada
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM dep_measurements) = 0, 'sin el módulo se ven mediciones';
  denied := false;
  BEGIN
    INSERT INTO dep_measurements (title) VALUES ('QA sin módulo');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'una empresa sin el módulo pudo crear una medición';
  RESET ROLE;
  RAISE NOTICE 'OK sin el módulo no hay acceso';

  -- La plataforma asigna el módulo a las dos empresas
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  ASSERT (admin_set_company_modules(ca, (SELECT array_agg(module_key) || 'dependency'::text FROM company_modules WHERE company_id = ca))->>'success')::boolean,
         'no se pudo asignar el módulo';
  ASSERT (admin_set_company_modules(cb, (SELECT array_agg(module_key) || 'dependency'::text FROM company_modules WHERE company_id = cb))->>'success')::boolean,
         'no se pudo asignar el módulo a la segunda empresa';

  -- El empresario captura su semana
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO dep_measurements (title, person_name, job_title) VALUES ('QA semana', 'QA Persona', 'Dirección general') RETURNING id INTO m;
  INSERT INTO dep_activities (measurement_id, activity_date, description, purpose, minutes, position)
  VALUES (m, '2026-11-16', 'QA revisar el programa de entregas', 'Recuperar el atraso', 45, 0) RETURNING id INTO act;
  INSERT INTO dep_activities (measurement_id, activity_date, description, minutes, position)
  VALUES (m, '2026-11-16', 'QA cotizar un pedido', 30, 1);
  INSERT INTO dep_decisions (measurement_id, decision_date, requester, description, intervention, reason, minutes)
  VALUES (m, '2026-11-16', 'Almacén', 'QA autorizar una compra urgente', 'autorizar', 'autoridad', 15) RETURNING id INTO dec;
  ASSERT (SELECT company_id FROM dep_measurements WHERE id = m) = ca, 'la medición no quedó en la empresa de quien la creó';
  ASSERT (SELECT count(*) FROM dep_activities WHERE measurement_id = m) = 2, 'no se guardaron las actividades';
  denied := false;
  BEGIN
    INSERT INTO dep_decisions (measurement_id, intervention) VALUES (m, 'inventada');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  ASSERT denied, 'se aceptó un tipo de intervención que no existe';
  -- El diagnóstico no se puede escribir desde la app
  denied := false;
  BEGIN
    INSERT INTO dep_diagnoses (measurement_id, status, input_hash) VALUES (m, 'listo', 'x');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'un usuario pudo escribir un diagnóstico';
  RESET ROLE;
  INSERT INTO dep_diagnoses (measurement_id, status, input_hash, result) VALUES (m, 'listo', 'x', '{"mapa":{}}');   -- como la función `ia`
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM dep_diagnoses WHERE measurement_id = m) = 1, 'el empresario no puede leer su diagnóstico';
  denied := false;
  BEGIN
    UPDATE dep_diagnoses SET status = 'preguntas' WHERE measurement_id = m;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'un usuario pudo cambiar un diagnóstico';
  denied := false;
  BEGIN
    DELETE FROM dep_diagnoses WHERE measurement_id = m;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'un usuario pudo borrar un diagnóstico';
  RESET ROLE;
  RAISE NOTICE 'OK el empresario captura y solo lee su diagnóstico';
END $$;
ROLLBACK;

-- Segunda parte: otras empresas, «solo ver», mentor, historial y borrado.
BEGIN;
DO $$
DECLARE
  a uuid; ca uuid; b uuid; cb uuid; adm uuid;
  men uuid := gen_random_uuid(); viewer uuid := gen_random_uuid();
  m uuid; act uuid; n int; r jsonb; hdr text; denied boolean;
BEGIN
  SELECT cm.user_id, cm.company_id INTO a, ca
    FROM company_members cm JOIN auth.users u ON u.id = cm.user_id
   WHERE cm.role = 'admin' AND COALESCE(u.raw_app_meta_data->>'role', 'user') = 'user'
   ORDER BY cm.created_at, cm.user_id LIMIT 1;
  SELECT cm.user_id, cm.company_id INTO b, cb
    FROM company_members cm JOIN auth.users u ON u.id = cm.user_id
   WHERE cm.role = 'admin' AND COALESCE(u.raw_app_meta_data->>'role', 'user') = 'user' AND cm.company_id <> ca
   ORDER BY cm.created_at, cm.user_id LIMIT 1;
  SELECT id INTO adm FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' AND id NOT IN (a, b) LIMIT 1;
  hdr := json_build_object('x-company-id', ca)::text;
  INSERT INTO company_modules (company_id, module_key) VALUES (ca, 'dependency'), (cb, 'dependency') ON CONFLICT DO NOTHING;
  DELETE FROM change_log WHERE company_id = ca;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO dep_measurements (title) VALUES ('QA semana') RETURNING id INTO m;
  INSERT INTO dep_activities (measurement_id, activity_date, description, minutes)
  VALUES (m, '2026-11-16', 'QA revisar el programa de entregas', 45) RETURNING id INTO act;
  INSERT INTO dep_decisions (measurement_id, description, intervention, minutes) VALUES (m, 'QA autorizar una compra', 'autorizar', 15);
  RESET ROLE;
  INSERT INTO dep_diagnoses (measurement_id, status, input_hash) VALUES (m, 'listo', 'x');

  -- Otra empresa con el mismo módulo: no ve ni toca nada de la primera
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM dep_measurements WHERE id = m) = 0
     AND (SELECT count(*) FROM dep_activities WHERE measurement_id = m) = 0
     AND (SELECT count(*) FROM dep_decisions WHERE measurement_id = m) = 0
     AND (SELECT count(*) FROM dep_diagnoses WHERE measurement_id = m) = 0, 'otra empresa ve la medición';
  UPDATE dep_activities SET minutes = 1 WHERE id = act;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'otra empresa cambió una actividad';
  denied := false;
  BEGIN
    INSERT INTO dep_activities (measurement_id, description) VALUES (m, 'QA intruso');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'otra empresa agregó una actividad';
  RESET ROLE;
  RAISE NOTICE 'OK aislamiento entre empresas';

  -- Miembro con «solo ver»: lee, no escribe
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (viewer, 'qa-mapa-ver@example.com', '{"full_name":"QA Solo Ver"}', 'authenticated', 'authenticated');
  DELETE FROM company_members WHERE user_id = viewer;
  INSERT INTO company_members (company_id, user_id, role) VALUES (ca, viewer, 'member');
  DELETE FROM user_module_access WHERE user_id = viewer;
  INSERT INTO user_module_access (user_id, module_key, level) VALUES (viewer, 'dependency', 'view');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM dep_activities WHERE measurement_id = m) = 1
     AND (SELECT count(*) FROM dep_diagnoses WHERE measurement_id = m) = 1, 'quien tiene «solo ver» no ve la medición';
  UPDATE dep_activities SET minutes = 1 WHERE id = act;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'quien tiene «solo ver» cambió una actividad';
  ASSERT NOT (ca = ANY (accessible_companies('dependency', true))), 'quien tiene «solo ver» figura con permiso de edición';
  RESET ROLE;
  RAISE NOTICE 'OK «solo ver» lee y no escribe';

  -- Mentor: solo con el encabezado de la empresa que acompaña y con el módulo
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (men, 'qa-mapa-mentor@example.com', '{"full_name":"QA Mentora"}', 'authenticated', 'authenticated');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  ASSERT (set_user_role(men, 'mentor')->>'success')::boolean, 'no se pudo dar rol de mentor';
  ASSERT (admin_set_company_mentor(ca, men, ARRAY['dependency'])->>'success')::boolean, 'no se pudo asignar mentor';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', men, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM dep_measurements WHERE id = m) = 0, 'sin elegir empresa la mentora ve la medición';
  PERFORM set_config('request.headers', hdr, true);
  ASSERT (SELECT count(*) FROM dep_activities WHERE measurement_id = m) = 1, 'la mentora no ve la bitácora del cliente';
  ASSERT ca = ANY (accessible_companies('dependency', true)), 'la mentora no figura con permiso de edición';
  UPDATE dep_activities SET minutes = 50 WHERE id = act;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 1, 'la mentora no pudo corregir una actividad';
  PERFORM set_config('request.headers', json_build_object('x-company-id', cb)::text, true);
  ASSERT (SELECT count(*) FROM dep_measurements) = 0, 'el encabezado dio acceso a una empresa ajena';
  RESET ROLE;
  PERFORM set_config('request.headers', '', true);
  RAISE NOTICE 'OK la mentora ve y corrige solo la empresa asignada';

  -- Historial de cambios del módulo
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := company_changes(50, false);
  ASSERT r @> '[{"module_key":"dependency","table_name":"dep_activities","action":"insert","row_key":{"label":"QA revisar el programa de entregas"}}]'::jsonb,
         'el historial no registra la actividad: ' || r::text;
  ASSERT r @> '[{"module_key":"dependency","table_name":"dep_measurements","action":"insert","row_key":{"label":"QA semana"}}]'::jsonb,
         'el historial no registra la medición: ' || r::text;
  r := company_changes(50, true);
  ASSERT r @> '[{"table_name":"dep_activities","action":"update","actor_role":"mentor","changes":{"minutes":{"old":45,"new":50}}}]'::jsonb,
         'el historial no describe la corrección de la mentora: ' || r::text;
  -- Sin el módulo, su historial deja de verse
  DELETE FROM company_modules WHERE company_id = ca AND module_key = 'dependency';
  ASSERT NOT (company_changes(50, false) @> '[{"module_key":"dependency"}]'::jsonb), 'se ve el historial de un módulo sin acceso';
  INSERT INTO company_modules (company_id, module_key) VALUES (ca, 'dependency');
  RAISE NOTICE 'OK historial de cambios';

  -- Borrar la medición se lleva sus registros y su diagnóstico
  SET LOCAL ROLE authenticated;
  DELETE FROM dep_measurements WHERE id = m;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM dep_activities WHERE measurement_id = m) = 0
     AND (SELECT count(*) FROM dep_decisions WHERE measurement_id = m) = 0
     AND (SELECT count(*) FROM dep_diagnoses WHERE measurement_id = m) = 0, 'quedaron registros de una medición borrada';
  RAISE NOTICE 'OK borrado en cascada';
END $$;
ROLLBACK;
