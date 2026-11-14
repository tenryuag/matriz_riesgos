-- Pruebas de la migración de empresas. Lo corre scripts/check-empresas.sh
-- contra la base LOCAL. Todo ocurre en una transacción que se revierte.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  n int; a uuid; b uuid; ca uuid; cb uuid; dep uuid; c uuid; nuevo uuid := gen_random_uuid();
BEGIN
  -- Estructura
  SELECT count(*) INTO n FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM company_members m WHERE m.user_id = u.id);
  ASSERT n = 0, 'hay usuarios sin empresa: ' || n;
  SELECT count(*) INTO n FROM companies c2 WHERE (SELECT count(*) FROM company_members m WHERE m.company_id = c2.id) <> 1;
  ASSERT n = 0, 'hay empresas que no tienen exactamente un miembro: ' || n;
  SELECT count(*) INTO n FROM user_module_access a JOIN company_members m ON m.user_id = a.user_id
   WHERE NOT EXISTS (SELECT 1 FROM company_modules cm WHERE cm.company_id = m.company_id AND cm.module_key = a.module_key);
  ASSERT n = 0, 'módulos de usuario que no pasaron a la empresa: ' || n;
  SELECT count(*) INTO n FROM risks r JOIN departments d ON d.id = r.department_id WHERE r.company_id IS DISTINCT FROM d.company_id;
  ASSERT n = 0, 'riesgos en empresa distinta a la de su departamento: ' || n;
  SELECT (SELECT count(*) FROM risks WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = created_by_id))
       + (SELECT count(*) FROM departments WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = created_by_id))
       + (SELECT count(*) FROM strategic_plans WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = owner_id))
       + (SELECT count(*) FROM fin_analyses WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = owner_id)) INTO n;
  ASSERT n = 0, 'registros con dueño vigente que quedaron sin empresa: ' || n;
  RAISE NOTICE 'OK estructura: % empresas, % miembros', (SELECT count(*) FROM companies), (SELECT count(*) FROM company_members);

  -- Dos usuarios con datos, de empresas distintas
  SELECT created_by_id INTO a FROM risks GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  SELECT created_by_id INTO b FROM risks WHERE created_by_id <> a GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  SELECT company_id INTO ca FROM company_members WHERE user_id = a;
  SELECT company_id INTO cb FROM company_members WHERE user_id = b;

  -- A, con el código actual (no manda company_id), crea departamento y riesgo
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO departments (name, created_by_id) VALUES ('QA depto', a) RETURNING id, company_id INTO dep, c;
  ASSERT c = ca, 'el departamento nuevo no tomó la empresa de quien lo creó';
  INSERT INTO risks (department_id, description, created_by_id) VALUES (dep, 'QA riesgo', a) RETURNING company_id INTO c;
  ASSERT c = ca, 'el riesgo nuevo no tomó la empresa de quien lo creó';
  SELECT count(*) INTO n FROM risks WHERE company_id <> ca;
  ASSERT n = 0, 'A ve riesgos de otra empresa';
  SELECT count(*) INTO n FROM companies;
  ASSERT n = 1, 'A ve empresas ajenas: ' || n;

  -- A no puede escribir en la empresa de B
  BEGIN
    INSERT INTO departments (name, created_by_id, company_id) VALUES ('QA intruso', a, cb);
    RAISE EXCEPTION 'A pudo insertar en la empresa de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE risks SET description = 'hackeado' WHERE company_id = cb;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'A pudo editar riesgos de B';
  DELETE FROM departments WHERE company_id = cb;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'A pudo borrar departamentos de B';
  BEGIN
    UPDATE risks SET company_id = cb WHERE department_id = dep;
    RAISE EXCEPTION 'A pudo mover un riesgo a la empresa de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  RAISE NOTICE 'OK aislamiento entre empresas';

  -- Multiempresa de verdad: B pasa a ser miembro de la empresa de A
  SELECT count(*) INTO n FROM risks WHERE company_id = ca;
  UPDATE company_members SET company_id = ca, role = 'member' WHERE user_id = b;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM risks) = n, 'el segundo miembro no ve los riesgos de su empresa';
  UPDATE risks SET description = 'editado por B' WHERE department_id = dep;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 1, 'el segundo miembro no pudo editar';
  RESET ROLE;
  RAISE NOTICE 'OK un segundo miembro ve y edita los datos de su empresa';

  -- Alta nueva: recibe empresa propia, admin, módulo de riesgos
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (nuevo, 'qa-empresa@example.com', '{"full_name":"QA Nueva"}', 'authenticated', 'authenticated');
  SELECT count(*) INTO n FROM company_members m JOIN companies c3 ON c3.id = m.company_id
    JOIN company_modules cm ON cm.company_id = c3.id AND cm.module_key = 'risk'
   WHERE m.user_id = nuevo AND m.role = 'admin' AND c3.name = 'QA Nueva';
  ASSERT n = 1, 'el alta nueva no recibió su empresa';
  ASSERT (SELECT count(*) FROM user_module_access WHERE user_id = nuevo AND module_key = 'risk') = 1, 'el alta nueva perdió el módulo de riesgos';
  RAISE NOTICE 'OK alta nueva con empresa propia';
END $$;

ROLLBACK;
