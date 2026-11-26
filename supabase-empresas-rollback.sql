-- =============================================================================
-- EMPRESAS — deshacer las reglas de seguridad de las tres fases
-- (supabase-empresas.sql, -usuarios.sql y -mentores.sql)
-- =============================================================================
-- Devuelve las políticas «solo el dueño» tal como estaban y quita los triggers
-- nuevos (empresa de cada registro, alta de empresa al registrarse, historial
-- de cambios). El asistente de IA vuelve a guardar un resultado por usuario.
--
-- NO borra las tablas de empresas, invitaciones, mentores ni el historial, ni
-- las columnas company_id: no estorban a la versión anterior de la app y así
-- no se pierde nada si se vuelve a aplicar la migración (las tres fases se
-- pueden correr de nuevo encima). Las funciones que ya existían y cambiaron
-- (set_user_role, set_user_modules, grant_default_module_access) se quedan en
-- su versión nueva: aceptan las mismas llamadas que la anterior.
-- (No restaura la regla de departments que dejaba borrar a cualquier usuario.)
--
-- Ensayo en la base local, sin dejar cambios: scripts/check-empresas-rollback.sh
-- =============================================================================

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['risks','departments','strategic_plans','fin_analyses','plan_answers',
                           'competitors','strategic_initiatives','fin_lines','fin_years','fin_values']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "empresa: leer" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "empresa: escribir" ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS zz_log_change ON public.%I', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['risks','departments','strategic_plans','fin_analyses']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_company_id ON public.%I', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS create_company_for_new_user ON auth.users;

-- Asistente de IA: vuelve a un resultado guardado por usuario y tipo. Lo que
-- un mentor generó sobre la empresa de un cliente se borra (es un caché: se
-- vuelve a generar cuando haga falta).
DO $$
BEGIN
  IF to_regclass('public.ia_resultados') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'ia_resultados'
                       AND column_name = 'company_id') THEN
    RETURN;
  END IF;

  DELETE FROM public.ia_resultados r
   WHERE r.company_id IS DISTINCT FROM
         (SELECT m.company_id FROM public.company_members m WHERE m.user_id = r.user_id);
  -- Por si quedara más de uno por usuario y tipo: se conserva el más reciente.
  DELETE FROM public.ia_resultados r USING public.ia_resultados n
   WHERE n.user_id = r.user_id AND n.kind = r.kind AND (n.created_at, n.id) > (r.created_at, r.id);

  ALTER TABLE public.ia_resultados DROP CONSTRAINT IF EXISTS ia_resultados_user_company_kind_key;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ia_resultados_user_id_kind_key') THEN
    ALTER TABLE public.ia_resultados ADD CONSTRAINT ia_resultados_user_id_kind_key UNIQUE (user_id, kind);
  END IF;

  DROP POLICY IF EXISTS "read own ia results" ON public.ia_resultados;
  CREATE POLICY "read own ia results" ON public.ia_resultados FOR SELECT TO authenticated
    USING (user_id = auth.uid());
END $$;

CREATE POLICY "Enable insert for users based on user_id" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by_id"));

CREATE POLICY "Enable users to view their own data only" ON "public"."departments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by_id"));

CREATE POLICY "delete" ON "public"."departments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by_id"));

CREATE POLICY "delete" ON "public"."risks" FOR DELETE TO "authenticated" USING (("created_by_id" = "auth"."uid"()));

CREATE POLICY "insert" ON "public"."risks" FOR INSERT TO "authenticated" WITH CHECK (("created_by_id" = "auth"."uid"()));

CREATE POLICY "owner all competitors" ON "public"."competitors" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."strategic_plans" "p"
  WHERE (("p"."id" = "competitors"."plan_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."strategic_plans" "p"
  WHERE (("p"."id" = "competitors"."plan_id") AND ("p"."owner_id" = "auth"."uid"())))));

CREATE POLICY "owner all fin_analyses" ON "public"."fin_analyses" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));

CREATE POLICY "owner all fin_lines" ON "public"."fin_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fin_analyses" "a"
  WHERE (("a"."id" = "fin_lines"."analysis_id") AND ("a"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fin_analyses" "a"
  WHERE (("a"."id" = "fin_lines"."analysis_id") AND ("a"."owner_id" = "auth"."uid"())))));

CREATE POLICY "owner all fin_values" ON "public"."fin_values" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fin_analyses" "a"
  WHERE (("a"."id" = "fin_values"."analysis_id") AND ("a"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fin_analyses" "a"
  WHERE (("a"."id" = "fin_values"."analysis_id") AND ("a"."owner_id" = "auth"."uid"())))));

CREATE POLICY "owner all fin_years" ON "public"."fin_years" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fin_analyses" "a"
  WHERE (("a"."id" = "fin_years"."analysis_id") AND ("a"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fin_analyses" "a"
  WHERE (("a"."id" = "fin_years"."analysis_id") AND ("a"."owner_id" = "auth"."uid"())))));

CREATE POLICY "owner all plan_answers" ON "public"."plan_answers" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."strategic_plans" "p"
  WHERE (("p"."id" = "plan_answers"."plan_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."strategic_plans" "p"
  WHERE (("p"."id" = "plan_answers"."plan_id") AND ("p"."owner_id" = "auth"."uid"())))));

CREATE POLICY "owner all strategic_initiatives" ON "public"."strategic_initiatives" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."strategic_plans" "p"
  WHERE (("p"."id" = "strategic_initiatives"."plan_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."strategic_plans" "p"
  WHERE (("p"."id" = "strategic_initiatives"."plan_id") AND ("p"."owner_id" = "auth"."uid"())))));

CREATE POLICY "owner all strategic_plans" ON "public"."strategic_plans" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));

CREATE POLICY "select" ON "public"."risks" FOR SELECT TO "authenticated" USING (("created_by_id" = "auth"."uid"()));

CREATE POLICY "update" ON "public"."departments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by_id"));

CREATE POLICY "update" ON "public"."risks" FOR UPDATE TO "authenticated" USING (("created_by_id" = "auth"."uid"()));

COMMIT;
