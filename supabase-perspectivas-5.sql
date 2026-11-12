-- ============================================================
-- Perspectivas: de 4 a 5 (se separa "Procesos y competitividad")
-- ============================================================
-- Decisión del dueño del producto (20-oct-2026): la perspectiva
-- "Procesos y competitividad" (clave 'competitiva') se divide en dos:
--   procesos    → "Procesos"        (cómo haces las cosas por dentro)
--   competitiva → "Competitividad"  (lo que te hace mejor o peor que la competencia)
-- La clave 'competitiva' se conserva (con el nuevo nombre) y se agrega
-- 'procesos'. El catálogo vive en src/config/perspectives.js.
--
-- Este script solo amplía las restricciones CHECK (cambio aditivo: no
-- afecta a filas existentes ni al código anterior). La reasignación de
-- riesgos/departamentos ya marcados como 'competitiva' la decide cada
-- usuario desde la app (o se hace por cuenta, como con los datos demo).
--
-- Aplicado en la base compartida el 20-oct-2026. Idempotente.
-- ============================================================

ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_perspective_key_check;
ALTER TABLE public.risks ADD CONSTRAINT risks_perspective_key_check
  CHECK (perspective_key IS NULL
         OR perspective_key IN ('financiera', 'cliente', 'competitiva', 'procesos', 'equipo'));

ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_perspective_key_check;
ALTER TABLE public.departments ADD CONSTRAINT departments_perspective_key_check
  CHECK (perspective_key IS NULL
         OR perspective_key IN ('financiera', 'cliente', 'competitiva', 'procesos', 'equipo'));

-- Verificación: ambas restricciones deben listar las 5 claves.
SELECT conrelid::regclass AS tabla, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conname IN ('risks_perspective_key_check', 'departments_perspective_key_check');
