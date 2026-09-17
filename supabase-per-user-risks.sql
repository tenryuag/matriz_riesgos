-- ============================================================
-- Migración: Matriz de Riesgos POR USUARIO
-- ============================================================
-- Antes: una sola matriz compartida por toda la organización (todos veían
-- los mismos departamentos y riesgos). Ahora: cada cuenta ve y edita
-- únicamente SUS departamentos y SUS riesgos. Los administradores tampoco
-- ven los de otros.
--
-- ⚠️ ESTA MIGRACIÓN CAMBIA LO QUE VEN LOS USUARIOS EN PRODUCCIÓN al momento
-- de correrla (staging y producción comparten la base de datos).
--
-- Reparto de lo que ya existe:
--   - Cada riesgo va con quien lo registró (created_by_id).
--   - Cada departamento va con el dueño del primer riesgo registrado en él.
--   - Si un departamento tiene riesgos de varias personas, se crea una copia
--     del departamento para cada una y sus riesgos se mueven ahí (nadie
--     pierde nada).
--   - Departamentos sin riesgos y riesgos sin autor quedan a nombre de
--     v_fallback_email (edítalo si hace falta).
--
-- Seguridad: políticas RLS RESTRICTIVAS "solo el dueño" que se suman (AND)
-- a las políticas existentes, sin necesidad de conocer sus nombres.
--
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- ============================================================

-- ---------- 1. Columna owner_id ----------
ALTER TABLE departments ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid();
ALTER TABLE risks       ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid();

-- ---------- 2. Reparto de lo existente ----------
DO $$
DECLARE
  v_fallback_email TEXT := 'tenryu@mara-perez.online';  -- ⚠️ dueño de lo no atribuible
  v_fallback UUID;
  r RECORD;
  v_new_dep UUID;
  v_has_sandbox BOOLEAN;
BEGIN
  SELECT id INTO v_fallback FROM auth.users WHERE email = v_fallback_email;
  IF v_fallback IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %. Edita v_fallback_email.', v_fallback_email;
  END IF;

  -- Riesgos: quien lo creó, o el fallback.
  UPDATE risks SET owner_id = COALESCE(created_by_id, v_fallback) WHERE owner_id IS NULL;

  -- Filas del seed sandbox conservan su dueño sandbox.
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'risks' AND column_name = 'sandbox_owner_id') INTO v_has_sandbox;
  IF v_has_sandbox THEN
    UPDATE risks       SET owner_id = sandbox_owner_id WHERE sandbox_owner_id IS NOT NULL;
    UPDATE departments SET owner_id = sandbox_owner_id WHERE sandbox_owner_id IS NOT NULL;
  END IF;

  -- Departamentos: dueño del primer riesgo registrado en ellos.
  UPDATE departments d
     SET owner_id = sub.owner_id
    FROM (SELECT DISTINCT ON (department_id) department_id, owner_id
            FROM risks
           ORDER BY department_id, created_at) sub
   WHERE sub.department_id = d.id AND d.owner_id IS NULL;

  -- Departamentos sin riesgos: fallback.
  UPDATE departments SET owner_id = v_fallback WHERE owner_id IS NULL;

  -- Departamentos con riesgos de otros dueños: copia por dueño.
  FOR r IN
    SELECT DISTINCT rk.department_id, rk.owner_id
      FROM risks rk
      JOIN departments d ON d.id = rk.department_id
     WHERE rk.owner_id <> d.owner_id
  LOOP
    INSERT INTO departments (name, description, owner_id)
    SELECT name, description, r.owner_id FROM departments WHERE id = r.department_id
    RETURNING id INTO v_new_dep;

    UPDATE risks SET department_id = v_new_dep
     WHERE department_id = r.department_id AND owner_id = r.owner_id;
  END LOOP;

  RAISE NOTICE 'Matriz repartida por usuario. Fallback: % (%)', v_fallback_email, v_fallback;
END $$;

CREATE INDEX IF NOT EXISTS departments_owner_idx ON departments (owner_id);
CREATE INDEX IF NOT EXISTS risks_owner_idx       ON risks (owner_id);

-- ---------- 3. Políticas: solo el dueño ----------
DROP POLICY IF EXISTS "owner only departments" ON departments;
CREATE POLICY "owner only departments" ON departments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner only risks" ON risks;
CREATE POLICY "owner only risks" ON risks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
