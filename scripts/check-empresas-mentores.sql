-- Pruebas de la fase 3 de empresas (mentores, historial, administración).
-- Contra la base LOCAL; todo en una transacción que se revierte.
--   docker exec -i supabase_db_hcmeoducjqudokfhhvyc psql -U postgres -d postgres -q < scripts/check-empresas-mentores.sql
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  a uuid; ca uuid; b uuid; cb uuid; adm uuid; men uuid := gen_random_uuid();
  r jsonb; n int; dep uuid; fa uuid; fy uuid;
  hdr text;
BEGIN
  SELECT created_by_id INTO a FROM risks GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  SELECT created_by_id INTO b FROM risks WHERE created_by_id <> a GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  SELECT company_id INTO ca FROM company_members WHERE user_id = a;
  SELECT company_id INTO cb FROM company_members WHERE user_id = b;
  SELECT id INTO adm FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' AND id NOT IN (a, b) LIMIT 1;
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (men, 'qa-mentor@example.com', '{"full_name":"QA Mentora"}', 'authenticated', 'authenticated');
  hdr := json_build_object('x-company-id', ca)::text;
  DELETE FROM fin_analyses WHERE company_id = ca;

  -- Administración: módulos de la empresa, rol de mentor y asignación
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  ASSERT (admin_set_company_modules(ca, ARRAY['risk', 'fin-analysis'])->>'success')::boolean, 'no se pudieron fijar módulos';
  ASSERT (admin_set_company_mentor(ca, men, ARRAY['fin-analysis'])->>'error') = 'NOT_MENTOR', 'se asignó a alguien sin rol de mentor';
  ASSERT (set_user_role(men, 'mentor')->>'success')::boolean, 'no se pudo dar rol de mentor';
  ASSERT (admin_set_company_mentor(ca, a, ARRAY['risk'])->>'error') IN ('IS_MEMBER', 'NOT_MENTOR'), 'se asignó como mentor a un miembro';
  ASSERT (admin_set_company_mentor(ca, men, ARRAY['fin-analysis', 'strategic'])->>'success')::boolean, 'no se pudo asignar mentor';
  ASSERT jsonb_array_length(admin_companies()->'companies') = (SELECT count(*) FROM companies), 'admin_companies incompleto';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ASSERT (admin_companies()->>'error') = 'UNAUTHORIZED', 'un cliente pudo listar empresas';
  ASSERT (admin_set_company_mentor(cb, a, ARRAY['risk'])->>'error') = 'UNAUTHORIZED', 'un cliente pudo asignar mentores';
  RAISE NOTICE 'OK administración por empresa';

  -- El cliente crea su análisis; después entra la mentora
  SET LOCAL ROLE authenticated;
  INSERT INTO fin_analyses (owner_id, created_by_id, company_name) VALUES (a, a, 'Cliente QA') RETURNING id INTO fa;
  INSERT INTO fin_years (analysis_id, year, months) VALUES (fa, 2025, 12) RETURNING id INTO fy;
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES (fa, fy, 'income', 'ventas', 1000);
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', men, 'role', 'authenticated')::text, true);
  ASSERT mentor_companies() @> jsonb_build_array(jsonb_build_object('id', ca, 'modules', '["fin-analysis"]'::jsonb)),
         'mentor_companies: ' || mentor_companies()::text;   -- strategic no: la empresa no lo tiene
  SET LOCAL ROLE authenticated;
  -- Sin encabezado: solo lo suyo
  ASSERT (SELECT count(*) FROM fin_analyses) = 0 AND (SELECT count(*) FROM risks) = 0, 'sin elegir empresa la mentora ve datos del cliente';
  -- Con encabezado: solo esa empresa y solo el módulo asignado
  PERFORM set_config('request.headers', hdr, true);
  ASSERT (SELECT count(*) FROM fin_analyses) = 1, 'la mentora no ve el análisis del cliente';
  ASSERT (SELECT count(*) FROM risks) = 0, 'la mentora ve un módulo que no se le asignó';
  UPDATE fin_values SET amount = 1250 WHERE analysis_id = fa AND concept_key = 'ventas';
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 1, 'la mentora no pudo corregir un valor';
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES (fa, fy, 'income', 'costo_ventas', 400);
  UPDATE fin_values SET amount = 1250 WHERE analysis_id = fa AND concept_key = 'ventas';   -- sin cambio real
  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES (fa, fy, 'income', 'gasto_venta', NULL);   -- celda vacía: no se registra
  -- Encabezado de una empresa que no acompaña: nada
  PERFORM set_config('request.headers', json_build_object('x-company-id', cb)::text, true);
  ASSERT (SELECT count(*) FROM fin_analyses) = 0 AND (SELECT count(*) FROM risks) = 0, 'el encabezado dio acceso a una empresa ajena';
  RESET ROLE;
  PERFORM set_config('request.headers', '', true);
  RAISE NOTICE 'OK la mentora ve y corrige solo la empresa y el módulo asignados';

  -- Historial: lo ve el cliente, con quién hizo qué
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := company_changes(50, true);
  ASSERT jsonb_array_length(r) = 2, 'cambios de mentor esperados 2, hay ' || jsonb_array_length(r) || ': ' || r::text;
  ASSERT r @> '[{"action":"update","actor_role":"mentor","actor_name":"QA Mentora","table_name":"fin_values","row_key":{"section":"income","concept_key":"ventas","year":2025},"changes":{"amount":{"old":1000,"new":1250}}}]'::jsonb,
         'el historial no describe la corrección: ' || r::text;
  ASSERT jsonb_array_length(company_changes(50, false)) = 5, 'historial completo esperado 5: ' || company_changes(50, false)::text;
  RAISE NOTICE 'OK historial de cambios';

  -- El cliente retira el acceso y lo devuelve
  ASSERT (company_set_mentor_access(men, false)->>'success')::boolean, 'no se pudo retirar el acceso';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', men, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', hdr, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM fin_analyses) = 0, 'la mentora conserva acceso después de que el cliente lo retiró';
  UPDATE fin_values SET amount = 1 WHERE analysis_id = fa; GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'la mentora pudo editar sin acceso';
  RESET ROLE;
  PERFORM company_set_mentor_access(men, true);   -- actúa sobre SU empresa, no la del cliente
  ASSERT NOT (SELECT active FROM company_mentors WHERE company_id = ca AND mentor_id = men), 'la mentora pudo devolverse el acceso';
  PERFORM set_config('request.headers', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ASSERT (company_set_mentor_access(men, true)->>'success')::boolean, 'no se pudo devolver el acceso';
  ASSERT (company_team()->'mentors'->0->>'active')::boolean, 'company_team no refleja el acceso';
  RAISE NOTICE 'OK el cliente retira y devuelve el acceso';

  -- Lo que crea la mentora queda en la empresa del cliente
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  PERFORM admin_set_company_mentor(ca, men, ARRAY['fin-analysis', 'risk']);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', men, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', hdr, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO departments (name, created_by_id) VALUES ('QA depto de mentora', men) RETURNING id INTO dep;
  RESET ROLE;
  ASSERT (SELECT company_id FROM departments WHERE id = dep) = ca, 'lo que creó la mentora no quedó en la empresa del cliente';
  PERFORM set_config('request.headers', '', true);

  -- Quitar el rol borra sus asignaciones
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  PERFORM set_user_role(men, 'user');
  ASSERT (SELECT count(*) FROM company_mentors WHERE mentor_id = men) = 0, 'quedaron asignaciones de quien ya no es mentor';
  RAISE NOTICE 'OK altas en la empresa del cliente y baja de mentor';
END $$;
ROLLBACK;
