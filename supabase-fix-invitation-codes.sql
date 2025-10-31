-- =====================================================
-- SCRIPT DE CORRECCIÓN PARA INVITATION_CODES
-- =====================================================
-- Este script corrige el problema de foreign key constraint
-- Ejecuta este script en Supabase SQL Editor

-- 1. Eliminar la foreign key constraint problemática
ALTER TABLE invitation_codes
DROP CONSTRAINT IF EXISTS invitation_codes_used_by_id_fkey;

-- 2. Eliminar la foreign key constraint de created_by_id también para evitar problemas
ALTER TABLE invitation_codes
DROP CONSTRAINT IF EXISTS invitation_codes_created_by_id_fkey;

-- Ahora los campos used_by_id y created_by_id son simples UUID sin constraint
-- Esto evita el problema de timing con auth.users

-- =====================================================
-- INSTRUCCIONES
-- =====================================================
-- 1. Ve a Supabase SQL Editor
-- 2. Ejecuta este script
-- 3. Intenta registrarte nuevamente
