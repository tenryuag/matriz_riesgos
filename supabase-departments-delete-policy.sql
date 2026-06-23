-- ============================================================
-- Política RLS: permitir eliminar departamentos
-- ============================================================
-- Ejecuta este script en Supabase (SQL Editor) SOLO si al intentar
-- eliminar un departamento desde la app aparece el error
-- "No se pudo eliminar el departamento".
--
-- Eso indica que la tabla `departments` tiene RLS activado pero sin
-- una política de DELETE, por lo que la base de datos bloquea el
-- borrado silenciosamente.
--
-- Esta política permite que cualquier usuario autenticado elimine
-- departamentos, igual que ya pueden crearlos y editarlos. Si más
-- adelante quieres restringirlo solo a administradores, cambia la
-- condición USING (ver comentario al final).
-- ============================================================

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar departamentos" ON departments;

CREATE POLICY "Usuarios autenticados pueden eliminar departamentos"
  ON departments
  FOR DELETE
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- Alternativa: solo administradores pueden eliminar.
-- Reemplaza la política anterior por esta si lo prefieres así.
-- ------------------------------------------------------------
-- DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar departamentos" ON departments;
--
-- CREATE POLICY "Solo administradores pueden eliminar departamentos"
--   ON departments
--   FOR DELETE
--   TO authenticated
--   USING (
--     (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
--   );
