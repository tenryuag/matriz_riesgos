-- ============================================================
-- Limpieza del seed sandbox (borra SOLO los datos de prueba)
-- ============================================================
-- Elimina todo lo sembrado por supabase-seed-sandbox.sql para el usuario
-- indicado. Los datos reales (sandbox_owner_id IS NULL) no se tocan.
--
-- El plan estratégico demo arrastra en cascada sus respuestas,
-- competidores e iniciativas (FK ON DELETE CASCADE).
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

DO $$
DECLARE
  v_email TEXT := 'tenryu@mara-perez.online';  -- ⚠️ el mismo correo del seed
  v_uid   UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %.', v_email;
  END IF;

  DELETE FROM risks           WHERE sandbox_owner_id = v_uid;
  DELETE FROM departments     WHERE sandbox_owner_id = v_uid;
  DELETE FROM strategic_plans WHERE sandbox_owner_id = v_uid;  -- cascada: answers, competidores, iniciativas

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'fin_analyses') THEN
    DELETE FROM fin_analyses WHERE sandbox_owner_id = v_uid;   -- cascada: años, líneas, cifras
  END IF;

  RAISE NOTICE 'Datos sandbox de % eliminados.', v_email;
END $$;

-- Opcional: si ya no piensas volver a sembrar, puedes retirar también la
-- infraestructura sandbox (no es necesario; no estorba dejarla):
-- DROP POLICY IF EXISTS "sandbox visibility" ON departments;
-- DROP POLICY IF EXISTS "sandbox visibility" ON risks;
-- DROP POLICY IF EXISTS "sandbox visibility" ON strategic_plans;
-- DROP POLICY IF EXISTS "sandbox visibility" ON fin_analyses;
-- ALTER TABLE departments     DROP COLUMN IF EXISTS sandbox_owner_id;
-- ALTER TABLE risks           DROP COLUMN IF EXISTS sandbox_owner_id;
-- ALTER TABLE strategic_plans DROP COLUMN IF EXISTS sandbox_owner_id;
-- ALTER TABLE fin_analyses    DROP COLUMN IF EXISTS sandbox_owner_id;
