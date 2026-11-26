-- =============================================================================
-- EMPRESAS — Fase 2: usuarios de la empresa, invitaciones y permisos por módulo
-- =============================================================================
-- Requiere supabase-empresas.sql (fase 1). Se puede correr más de una vez.
--
--   · La plataforma decide qué módulos tiene la EMPRESA (company_modules).
--   · El administrador de la empresa reparte esos módulos entre su gente, con
--     nivel «ver» o «editar» (user_module_access.level). El administrador de
--     la empresa siempre tiene todos los módulos de su empresa, con edición.
--   · Las reglas de seguridad ya exigen ese permiso: accessible_companies()
--     deja de mirar solo la membresía.
--   · Invitaciones por enlace: quien se registra con el enlace entra a la
--     empresa que lo invitó en vez de crear una propia.
-- =============================================================================

BEGIN;

-- ── 1. Permiso por miembro: nivel ver / editar ───────────────────────────────

ALTER TABLE public.user_module_access
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'edit';
DO $$ BEGIN
  ALTER TABLE public.user_module_access
    ADD CONSTRAINT user_module_access_level_check CHECK (level IN ('view', 'edit'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Invitaciones ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  modules      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "risk": "edit", "strategic": "view" }
  token        text NOT NULL UNIQUE
                 DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS company_invitations_pending_uidx
  ON public.company_invitations (company_id, lower(email)) WHERE accepted_at IS NULL;

-- Sin acceso directo: todo pasa por las funciones de abajo.
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invitations TO service_role;

-- ── 2b. Datos de la empresa y de la persona a cargo ──────────────────────────
-- Se capturan en el registro y se corrigen desde «Mi empresa».

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry      text CHECK (char_length(industry) <= 120),
  ADD COLUMN IF NOT EXISTS size          text CHECK (size IN ('1-10', '11-50', '51-250', '251+')),
  ADD COLUMN IF NOT EXISTS contact_name  text CHECK (char_length(contact_name) <= 120),
  ADD COLUMN IF NOT EXISTS contact_title text CHECK (char_length(contact_title) <= 120),
  ADD COLUMN IF NOT EXISTS contact_phone text CHECK (char_length(contact_phone) <= 40),
  ADD COLUMN IF NOT EXISTS contact_email text CHECK (char_length(contact_email) <= 200);

-- Empresas que ya existían: la persona a cargo es quien abrió la cuenta.
UPDATE public.companies c
   SET contact_name  = NULLIF(left(trim(u.raw_user_meta_data->>'full_name'), 120), ''),
       contact_email = left(u.email, 200)
  FROM auth.users u
 WHERE u.id = c.created_by AND c.contact_name IS NULL AND c.contact_email IS NULL;

-- ── 3. Acceso efectivo ───────────────────────────────────────────────────────

-- Empresas a las que el usuario en sesión tiene acceso para un módulo.
--   · Administrador de la plataforma: su empresa, todos los módulos.
--   · La empresa debe tener el módulo.
--   · Administrador de la empresa: todo. Miembro: según su permiso; para
--     escribir necesita nivel «edit».
CREATE OR REPLACE FUNCTION public.accessible_companies(p_module text, p_write boolean)
  RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(m.company_id), '{}'::uuid[])
    FROM public.company_members m
   WHERE m.user_id = auth.uid()
     AND (
       public.is_admin()
       OR (
         EXISTS (SELECT 1 FROM public.company_modules cm
                  WHERE cm.company_id = m.company_id AND cm.module_key = p_module)
         AND (
           m.role = 'admin'
           OR EXISTS (SELECT 1 FROM public.user_module_access a
                       WHERE a.user_id = m.user_id AND a.module_key = p_module
                         AND (NOT p_write OR a.level = 'edit'))
         )
       )
     );
$$;

-- Aplica una invitación: mete al usuario en la empresa con sus permisos.
CREATE OR REPLACE FUNCTION public._apply_invitation(p_inv public.company_invitations, p_user uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (p_inv.company_id, p_user, p_inv.role);

  DELETE FROM public.user_module_access WHERE user_id = p_user;
  INSERT INTO public.user_module_access (user_id, module_key, level, granted_by)
  SELECT p_user, e.key, e.value, p_inv.invited_by
    FROM jsonb_each_text(p_inv.modules) e
   WHERE e.value IN ('view', 'edit')
     AND EXISTS (SELECT 1 FROM public.company_modules cm
                  WHERE cm.company_id = p_inv.company_id AND cm.module_key = e.key);

  UPDATE public.company_invitations
     SET accepted_at = now(), accepted_by = p_user WHERE id = p_inv.id;
END;
$$;
REVOKE ALL ON FUNCTION public._apply_invitation(public.company_invitations, uuid) FROM PUBLIC, anon, authenticated;

-- Alta de usuario: con enlace de invitación válido entra a esa empresa; sin
-- él, recibe su propia empresa con los datos que dio en el registro (empresa
-- y persona a cargo). Esos datos llegan en los metadatos del usuario, que él
-- mismo escribe: por eso se recortan y el tamaño solo acepta valores conocidos.
CREATE OR REPLACE FUNCTION public.create_company_for_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid;
  inv public.company_invitations;
  md  jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO inv FROM public.company_invitations
   WHERE token = NEW.raw_user_meta_data->>'invite_token'
     AND lower(email) = lower(NEW.email)
     AND accepted_at IS NULL AND expires_at > now();
  IF FOUND THEN
    PERFORM public._apply_invitation(inv, NEW.id);
    RETURN NEW;
  END IF;

  INSERT INTO public.companies
    (name, created_by, industry, size, contact_name, contact_title, contact_phone, contact_email)
  VALUES (
    COALESCE(NULLIF(left(trim(md->>'company_name'), 120), ''),
             NULLIF(left(trim(md->>'full_name'), 120), ''), NEW.email, 'Empresa'),
    NEW.id,
    NULLIF(left(trim(md->>'company_industry'), 120), ''),
    CASE WHEN md->>'company_size' IN ('1-10', '11-50', '51-250', '251+') THEN md->>'company_size' END,
    NULLIF(left(trim(md->>'full_name'), 120), ''),
    NULLIF(left(trim(md->>'job_title'), 120), ''),
    NULLIF(left(trim(md->>'phone'), 40), ''),
    left(NEW.email, 200))
  RETURNING id INTO cid;
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (cid, NEW.id, 'admin');
  INSERT INTO public.company_modules (company_id, module_key) VALUES (cid, 'risk');
  RETURN NEW;
END;
$$;

-- grant_default_module_access corre después (orden alfabético de triggers) y
-- daba «risk» a todos; un invitado solo debe tener lo que le asignó su empresa.
CREATE OR REPLACE FUNCTION public.grant_default_module_access() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_invitations WHERE accepted_by = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.user_module_access (user_id, module_key)
  VALUES (NEW.id, 'risk')
  ON CONFLICT (user_id, module_key) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 4. Funciones que usa la app ──────────────────────────────────────────────

-- Mi acceso: empresa, papel y módulos efectivos con su nivel. Si el usuario
-- no tiene empresa y hay una invitación pendiente para su correo, la acepta.
CREATE OR REPLACE FUNCTION public.my_access() RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  mem public.company_members;
  inv public.company_invitations;
  mods jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('company', NULL); END IF;

  SELECT * INTO mem FROM public.company_members WHERE user_id = uid;
  IF NOT FOUND THEN
    SELECT i.* INTO inv FROM public.company_invitations i
      JOIN auth.users u ON lower(u.email) = lower(i.email)
     WHERE u.id = uid AND u.email_confirmed_at IS NOT NULL
       AND i.accepted_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at DESC LIMIT 1;
    IF FOUND THEN
      PERFORM public._apply_invitation(inv, uid);
      SELECT * INTO mem FROM public.company_members WHERE user_id = uid;
    END IF;
  END IF;
  IF mem.company_id IS NULL THEN
    RETURN jsonb_build_object('company', NULL, 'role', NULL, 'modules', '{}'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_object_agg(cm.module_key,
           CASE WHEN mem.role = 'admin' THEN 'edit' ELSE a.level END), '{}'::jsonb)
    INTO mods
    FROM public.company_modules cm
    LEFT JOIN public.user_module_access a ON a.user_id = uid AND a.module_key = cm.module_key
   WHERE cm.company_id = mem.company_id AND (mem.role = 'admin' OR a.user_id IS NOT NULL);

  RETURN jsonb_build_object(
    'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name) FROM public.companies c WHERE c.id = mem.company_id),
    'role', mem.role,
    'modules', mods);
END;
$$;

-- Equipo de mi empresa. Las invitaciones (con su enlace) solo las ve el admin.
CREATE OR REPLACE FUNCTION public.company_team() RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid := public.my_company_id();
  adm boolean;
BEGIN
  IF cid IS NULL THEN RETURN jsonb_build_object('company', NULL); END IF;
  adm := public.is_company_admin(cid);
  RETURN jsonb_build_object(
    'company', (SELECT to_jsonb(c) - 'created_by' - 'created_at' FROM public.companies c WHERE c.id = cid),
    'is_admin', adm,
    'modules', (SELECT COALESCE(jsonb_agg(module_key ORDER BY module_key), '[]'::jsonb)
                  FROM public.company_modules WHERE company_id = cid),
    'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'user_id', m.user_id,
                    'email', u.email,
                    'full_name', COALESCE(u.raw_user_meta_data->>'full_name', ''),
                    'role', m.role,
                    'is_me', m.user_id = auth.uid(),
                    'last_sign_in_at', u.last_sign_in_at,
                    'modules', (SELECT COALESCE(jsonb_object_agg(a.module_key, a.level), '{}'::jsonb)
                                  FROM public.user_module_access a
                                  JOIN public.company_modules cm ON cm.company_id = cid AND cm.module_key = a.module_key
                                 WHERE a.user_id = m.user_id)
                  ) ORDER BY (m.role = 'admin') DESC, m.created_at), '[]'::jsonb)
                  FROM public.company_members m JOIN auth.users u ON u.id = m.user_id
                 WHERE m.company_id = cid),
    'invitations', CASE WHEN adm THEN
                  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'id', i.id, 'email', i.email, 'role', i.role, 'modules', i.modules,
                      'token', i.token, 'expires_at', i.expires_at, 'expired', i.expires_at <= now()
                    ) ORDER BY i.created_at DESC), '[]'::jsonb)
                    FROM public.company_invitations i
                   WHERE i.company_id = cid AND i.accepted_at IS NULL)
                ELSE '[]'::jsonb END);
END;
$$;

-- Deja solo permisos válidos: módulos que la empresa tiene, nivel view/edit.
CREATE OR REPLACE FUNCTION public._clean_modules(p_company uuid, p_modules jsonb) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each_text(COALESCE(p_modules, '{}'::jsonb)) e
   WHERE e.value IN ('view', 'edit')
     AND EXISTS (SELECT 1 FROM public.company_modules cm
                  WHERE cm.company_id = p_company AND cm.module_key = e.key);
$$;
REVOKE ALL ON FUNCTION public._clean_modules(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Invitar a alguien a mi empresa. Devuelve el token del enlace.
CREATE OR REPLACE FUNCTION public.company_invite(p_email text, p_role text, p_modules jsonb) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid := public.my_company_id();
  v_email text := lower(trim(p_email));
  v_role text := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'member' END;
  existing uuid;
  tok text;
BEGIN
  IF cid IS NULL OR NOT public.is_company_admin(cid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo el administrador de la empresa puede invitar');
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EMAIL', 'message', 'El correo no es válido');
  END IF;

  SELECT u.id INTO existing FROM auth.users u WHERE lower(u.email) = v_email;
  IF existing IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_members WHERE user_id = existing) THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_EXISTS',
      'message', CASE WHEN EXISTS (SELECT 1 FROM public.company_members WHERE user_id = existing AND company_id = cid)
                      THEN 'Esa persona ya es parte de tu empresa'
                      ELSE 'Ese correo ya tiene una cuenta en otra empresa' END);
  END IF;

  DELETE FROM public.company_invitations
   WHERE company_id = cid AND lower(email) = v_email AND accepted_at IS NULL;
  INSERT INTO public.company_invitations (company_id, email, role, modules, invited_by)
  VALUES (cid, v_email, v_role, public._clean_modules(cid, p_modules), auth.uid())
  RETURNING token INTO tok;

  RETURN jsonb_build_object('success', true, 'token', tok, 'has_account', existing IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.company_cancel_invitation(p_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cid uuid := public.my_company_id();
BEGIN
  IF cid IS NULL OR NOT public.is_company_admin(cid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Sin permiso');
  END IF;
  DELETE FROM public.company_invitations WHERE id = p_id AND company_id = cid AND accepted_at IS NULL;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Cambiar papel y permisos de un miembro de mi empresa.
CREATE OR REPLACE FUNCTION public.company_update_member(p_user uuid, p_role text, p_modules jsonb) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid := public.my_company_id();
  v_role text := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'member' END;
  cur text;
BEGIN
  IF cid IS NULL OR NOT public.is_company_admin(cid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Sin permiso');
  END IF;
  SELECT role INTO cur FROM public.company_members WHERE user_id = p_user AND company_id = cid;
  IF cur IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Esa persona no es parte de tu empresa');
  END IF;
  IF cur = 'admin' AND v_role <> 'admin'
     AND (SELECT count(*) FROM public.company_members WHERE company_id = cid AND role = 'admin') <= 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'LAST_ADMIN',
      'message', 'La empresa debe conservar al menos un administrador');
  END IF;

  UPDATE public.company_members SET role = v_role WHERE user_id = p_user AND company_id = cid;
  DELETE FROM public.user_module_access WHERE user_id = p_user;
  INSERT INTO public.user_module_access (user_id, module_key, level, granted_by)
  SELECT p_user, e.key, e.value, auth.uid()
    FROM jsonb_each_text(public._clean_modules(cid, p_modules)) e;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Dar de baja a un miembro. Sus datos se quedan en la empresa; la persona
-- conserva su cuenta, pero sin empresa no ve nada.
CREATE OR REPLACE FUNCTION public.company_remove_member(p_user uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cid uuid := public.my_company_id();
BEGIN
  IF cid IS NULL OR NOT public.is_company_admin(cid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Sin permiso');
  END IF;
  IF p_user = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF', 'message', 'No puedes darte de baja a ti mismo');
  END IF;
  DELETE FROM public.company_members WHERE user_id = p_user AND company_id = cid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Esa persona no es parte de tu empresa');
  END IF;
  DELETE FROM public.user_module_access WHERE user_id = p_user;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Lo que ve quien abre un enlace de invitación (aún sin sesión).
CREATE OR REPLACE FUNCTION public.invitation_preview(p_token text) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('valid', true, 'email', i.email, 'company_name', c.name)
       FROM public.company_invitations i JOIN public.companies c ON c.id = i.company_id
      WHERE i.token = p_token AND i.accepted_at IS NULL AND i.expires_at > now()),
    jsonb_build_object('valid', false));
$$;

-- Administración de la plataforma: asignar módulos a un usuario ahora asigna
-- los módulos de SU EMPRESA (y, por compatibilidad, los del propio usuario).
-- Los demás miembros pierden lo que la empresa ya no tiene.
CREATE OR REPLACE FUNCTION public.set_user_modules(target_user_id uuid, module_keys text[]) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cid uuid;
  keys text[] := COALESCE(module_keys, '{}'::text[]);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED',
      'message', 'Solo los administradores pueden asignar módulos');
  END IF;
  SELECT company_id INTO cid FROM public.company_members WHERE user_id = target_user_id;

  IF cid IS NOT NULL THEN
    DELETE FROM public.company_modules WHERE company_id = cid AND NOT (module_key = ANY (keys));
    INSERT INTO public.company_modules (company_id, module_key, granted_by)
    SELECT cid, k, auth.uid() FROM unnest(keys) AS k ON CONFLICT DO NOTHING;
    DELETE FROM public.user_module_access a
     USING public.company_members m
     WHERE m.company_id = cid AND a.user_id = m.user_id AND NOT (a.module_key = ANY (keys));
  END IF;

  DELETE FROM public.user_module_access WHERE user_id = target_user_id AND NOT (module_key = ANY (keys));
  INSERT INTO public.user_module_access (user_id, module_key, granted_by)
  SELECT target_user_id, k, auth.uid() FROM unnest(keys) AS k
  ON CONFLICT (user_id, module_key) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.my_access(), public.company_team(),
  public.company_invite(text, text, jsonb), public.company_cancel_invitation(uuid),
  public.company_update_member(uuid, text, jsonb), public.company_remove_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access(), public.company_team(),
  public.company_invite(text, text, jsonb), public.company_cancel_invitation(uuid),
  public.company_update_member(uuid, text, jsonb), public.company_remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO anon, authenticated;

COMMIT;
