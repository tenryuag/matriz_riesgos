-- =============================================================================
-- EMPRESAS — deshacer las reglas de seguridad de supabase-empresas.sql
-- =============================================================================
-- Devuelve las políticas «solo el dueño» tal como estaban y quita los triggers
-- nuevos. NO borra las tablas de empresas ni las columnas company_id: no
-- estorban y así no se pierde nada si se vuelve a aplicar la migración.
-- (No restaura la regla de departments que dejaba borrar a cualquier usuario.)
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
  END LOOP;
  FOREACH t IN ARRAY ARRAY['risks','departments','strategic_plans','fin_analyses']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_company_id ON public.%I', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS create_company_for_new_user ON auth.users;

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
