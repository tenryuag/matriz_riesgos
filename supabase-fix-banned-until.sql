-- ============================================================
-- FIX: banned_until = 'infinity' rompe el login (error 500)
-- ============================================================
-- Problema:
--   La función suspend_user marcaba a los usuarios suspendidos con
--   banned_until = 'infinity'. PostgreSQL lo acepta, pero el servicio de
--   Auth de Supabase (Go) no puede convertir 'infinity' a una fecha y
--   devuelve "500: Database error querying schema" cuando ese usuario
--   intenta iniciar sesión.
--
-- Solución:
--   Usar una fecha futura real (~100 años) en lugar de 'infinity'.
--
-- Ejecuta este script en Supabase → SQL Editor.
-- ============================================================

-- 1. Arreglar las cuentas que ya quedaron con 'infinity'.
--    Las convierte a una fecha futura lejana (siguen suspendidas, pero ya
--    no rompen el login: ahora devuelven un error limpio de "baneado").
UPDATE auth.users
SET banned_until = (now() + interval '100 years')
WHERE banned_until = 'infinity';

-- 2. Verifica el resultado (no debería quedar ninguna fila con 'infinity').
--    Esta consulta lista las cuentas actualmente suspendidas.
SELECT id, email, banned_until
FROM auth.users
WHERE banned_until IS NOT NULL
  AND banned_until > now();

-- 3. IMPORTANTE: vuelve a ejecutar el archivo supabase-suspend-user.sql
--    completo para actualizar la función suspend_user (ya corregida para
--    usar la fecha futura en vez de 'infinity'). Sin este paso, las
--    suspensiones NUEVAS volverían a guardar 'infinity'.
