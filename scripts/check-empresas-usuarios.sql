-- Pruebas de la fase 2 de empresas (usuarios, invitaciones, permisos).
-- Contra la base LOCAL; todo en una transacción que se revierte.
--   docker exec -i supabase_db_hcmeoducjqudokfhhvyc psql -U postgres -d postgres -q < scripts/check-empresas-usuarios.sql
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  a uuid; ca uuid; r jsonb; tok text; n int; nuevo uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); dep uuid;
BEGIN
  SELECT created_by_id INTO a FROM risks GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  SELECT company_id INTO ca FROM company_members WHERE user_id = a;
  INSERT INTO company_modules (company_id, module_key) VALUES (ca, 'fin-analysis') ON CONFLICT DO NOTHING;
  SELECT id INTO dep FROM departments WHERE company_id = ca LIMIT 1;

  -- A (admin de su empresa) invita: riesgos solo ver, financiero editar, y un módulo que la empresa no tiene
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := company_invite('Nueva.Persona@Example.com', 'member', '{"risk":"view","fin-analysis":"edit","strategic":"edit"}');
  ASSERT (r->>'success')::boolean, r::text;
  tok := r->>'token';
  ASSERT (invitation_preview(tok)->>'valid')::boolean, 'la vista previa no reconoce la invitación';
  ASSERT jsonb_array_length(company_team()->'invitations') = 1, 'el admin no ve la invitación pendiente';
  ASSERT (my_access()->'modules'->>'fin-analysis') = 'edit', 'el admin de la empresa no tiene todos sus módulos';

  -- Registro con el enlace: entra a la empresa de A, sin empresa propia
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
  VALUES (nuevo, 'nueva.persona@example.com', jsonb_build_object('full_name', 'Nueva Persona', 'invite_token', tok), 'authenticated', 'authenticated', now());
  ASSERT (SELECT company_id FROM company_members WHERE user_id = nuevo) = ca, 'el invitado no entró a la empresa';
  ASSERT (SELECT count(*) FROM companies WHERE created_by = nuevo) = 0, 'el invitado recibió empresa propia';
  ASSERT (SELECT string_agg(module_key || '=' || level, ',' ORDER BY module_key) FROM user_module_access WHERE user_id = nuevo)
         = 'fin-analysis=edit,risk=view', 'permisos del invitado incorrectos';

  -- El invitado: ve riesgos, no puede editarlos; no ve el plan estratégico
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nuevo, 'role', 'authenticated')::text, true);
  ASSERT my_access()->'modules' = '{"risk":"view","fin-analysis":"edit"}'::jsonb, 'my_access del invitado: ' || my_access()::text;
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM risks) = (SELECT count(*) FROM risks WHERE company_id = ca) AND (SELECT count(*) FROM risks) > 0, 'el invitado no ve los riesgos';
  UPDATE risks SET description = 'x'; GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'el invitado con «ver» pudo editar riesgos';
  BEGIN
    INSERT INTO risks (department_id, description, created_by_id) VALUES (dep, 'x', nuevo);
    RAISE EXCEPTION 'el invitado con «ver» pudo crear un riesgo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO fin_analyses (owner_id, created_by_id) VALUES (nuevo, nuevo);  -- «editar» sí puede
  RESET ROLE;
  ASSERT (company_invite('x@example.com', 'member', '{}')->>'error') = 'UNAUTHORIZED', 'un miembro pudo invitar';
  ASSERT (company_remove_member(a)->>'error') = 'UNAUTHORIZED', 'un miembro pudo dar de baja';
  RAISE NOTICE 'OK invitación, permisos ver/editar y límites del miembro';

  -- A cambia permisos, protege al último admin, da de baja
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ASSERT (company_update_member(a, 'member', '{}')->>'error') = 'LAST_ADMIN', 'se pudo dejar a la empresa sin administrador';
  ASSERT (company_remove_member(a)->>'error') = 'SELF', 'el admin pudo darse de baja a sí mismo';
  ASSERT (company_invite('nueva.persona@example.com', 'member', '{}')->>'error') = 'EMAIL_EXISTS', 'se pudo invitar a quien ya es miembro';
  ASSERT (company_update_member(nuevo, 'member', '{"risk":"edit"}')->>'success')::boolean, 'no se pudo cambiar el permiso';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nuevo, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE risks SET description = description WHERE department_id = dep; GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n > 0, 'con «editar» no pudo editar';
  ASSERT (SELECT count(*) FROM fin_analyses) = 0, 'sigue viendo un módulo que se le quitó';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ASSERT (company_remove_member(nuevo)->>'success')::boolean, 'no se pudo dar de baja';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nuevo, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM risks) = 0, 'el dado de baja sigue viendo datos';
  RESET ROLE;
  ASSERT my_access()->'company' = 'null'::jsonb, 'el dado de baja sigue con empresa';
  RAISE NOTICE 'OK cambios de permiso, último administrador y baja';

  -- Reinvitar a quien ya tiene cuenta pero no empresa: entra al iniciar sesión
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := company_invite('nueva.persona@example.com', 'member', '{"risk":"view"}');
  ASSERT (r->>'success')::boolean AND (r->>'has_account')::boolean, r::text;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nuevo, 'role', 'authenticated')::text, true);
  ASSERT (my_access()->'company'->>'id')::uuid = ca, 'la reinvitación no se aplicó al entrar';

  -- Token correcto con otro correo: no entra, recibe empresa propia
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  tok := company_invite('tercero@example.com', 'admin', '{}')->>'token';
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (otro, 'intruso@example.com', jsonb_build_object('full_name', 'Intruso', 'invite_token', tok), 'authenticated', 'authenticated');
  ASSERT (SELECT company_id FROM company_members WHERE user_id = otro) <> ca, 'un correo distinto usó la invitación de otro';
  RAISE NOTICE 'OK reinvitación y enlace ligado al correo';

  -- La plataforma quita un módulo a la empresa: lo pierden todos sus miembros
  UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}' WHERE id = otro;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  ASSERT (set_user_modules(a, ARRAY['fin-analysis'])->>'success')::boolean, 'set_user_modules falló';
  ASSERT (SELECT count(*) FROM user_module_access WHERE user_id = nuevo AND module_key = 'risk') = 0, 'un miembro conservó un módulo que la empresa perdió';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM risks) = 0, 'la empresa sigue viendo un módulo que ya no tiene';
  RESET ROLE;
  RAISE NOTICE 'OK módulos por empresa';
END $$;
ROLLBACK;
