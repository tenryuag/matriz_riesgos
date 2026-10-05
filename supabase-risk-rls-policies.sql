-- ============================================================
-- REFERENCIA: políticas RLS de la Matriz de Riesgos (ya existen en la BD)
-- ============================================================
-- Estas políticas se crearon originalmente desde el panel de Supabase, por
-- eso no estaban en el repositorio. Se documentan aquí tal como están en
-- producción (consultadas con pg_policies el 18-sep-2026).
--
-- MODELO: la matriz es POR USUARIO y estricta — cada cuenta ve, edita y
-- borra únicamente los departamentos y riesgos que creó (created_by_id).
-- Los administradores NO tienen excepción: tampoco ven los de otros.
-- Planeación Estratégica y Análisis Financiero siguen este mismo criterio
-- (ver supabase-per-user-plans.sql).
--
-- El modelo de PERSPECTIVAS (supabase-perspectivas.sql) no cambia estas
-- políticas: solo agrega columnas a departments y risks (ver la sección de
-- risks más abajo). El filtro sigue siendo created_by_id = auth.uid().
--
-- NO HACE FALTA CORRERLO. Es idempotente (DROP IF EXISTS + CREATE) por si
-- algún día hay que recrear la base desde cero.
-- ============================================================

-- ---------- departments ----------
-- Con el modelo de perspectivas, cada departamento lleva una perspective_key
-- sugerida (financiera | cliente | competitiva | equipo) que usa el
-- asistente de migración departamento → perspectiva. No afecta las políticas.
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON departments;
CREATE POLICY "Enable insert for users based on user_id" ON departments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by_id);

DROP POLICY IF EXISTS "Enable users to view their own data only" ON departments;
CREATE POLICY "Enable users to view their own data only" ON departments
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = created_by_id);

DROP POLICY IF EXISTS "update" ON departments;
CREATE POLICY "update" ON departments
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by_id);

DROP POLICY IF EXISTS "delete" ON departments;
CREATE POLICY "delete" ON departments
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by_id);

-- Redundante (agregada por supabase-departments-delete-policy.sql cuando
-- se creyó que faltaba la política de borrado). Inofensiva porque la
-- política de lectura ya limita las filas alcanzables, pero puede retirarse:
--   DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar departamentos" ON departments;

-- ---------- risks ----------
-- Columnas del modelo de perspectivas (supabase-perspectivas.sql):
--   perspective_key   TEXT   financiera | cliente | competitiva | equipo.
--                            Organiza la matriz; department_id pasa a ser
--                            opcional (los riesgos viejos lo conservan).
--   inherent_score, inherent_level_key, residual_level_key
--                            Las calcula un TRIGGER a partir de
--                            probabilidad × impacto (puntaje 1-25 y nivel
--                            normalizado independiente del idioma). La app
--                            NO las escribe; cualquier valor enviado se
--                            sobreescribe en la misma fila.
-- Ninguna de ellas altera las políticas: el trigger corre dentro del INSERT
-- o UPDATE del dueño y las políticas siguen filtrando por
-- created_by_id = auth.uid().
DROP POLICY IF EXISTS "delete" ON risks;
CREATE POLICY "delete" ON risks
  FOR DELETE TO authenticated
  USING (created_by_id = auth.uid());

-- Las políticas de SELECT / INSERT / UPDATE de risks siguen el mismo patrón
-- (created_by_id = auth.uid()); no alcanzaron a verse en la captura de
-- pg_policies. Para completarlas aquí:
--   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'risks';
