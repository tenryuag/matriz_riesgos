-- ============================================================
-- Paso 2 de la corrección de roles: limpiar user_metadata.role
-- ============================================================
-- Correr SOLO cuando la nueva versión de la app (la que lee
-- app_metadata.role) ya esté en producción. Si se corre antes, los
-- administradores dejan de ver sus menús hasta el despliegue.
--
-- 1. Quita el rol de user_metadata (ya no se usa para nada).
-- 2. Trigger que impide que vuelva a entrar un 'role' por user_metadata
--    (por ejemplo, un cliente malicioso mandándolo en signUp/updateUser).
-- ============================================================

UPDATE auth.users
   SET raw_user_meta_data = raw_user_meta_data - 'role'
 WHERE raw_user_meta_data ? 'role';

CREATE OR REPLACE FUNCTION public.strip_role_from_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'role' THEN
    NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strip_role_from_user_metadata ON auth.users;
CREATE TRIGGER strip_role_from_user_metadata
  BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.strip_role_from_user_metadata();
