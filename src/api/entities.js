import { supabase } from "./supabaseClient";
import { handleQueryError, forceLogout } from "./authHelpers";

export const Department = {
  // 🔹 Obtener lista de departamentos
  async list(order = "created_at") {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order(order.replace("-", ""), { ascending: !order.startsWith("-") });

    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Crear nuevo departamento
  async create(departmentData) {
    const { data, error } = await supabase
      .from("departments")
      .insert([departmentData])
      .select(); // opcional: para obtener el resultado insertado
    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Filtrar departamentos por condiciones
  async filter(filters) {
    let query = supabase.from("departments").select("*");
    for (const key in filters) {
      query = query.eq(key, filters[key]);
    }
    const { data, error } = await query;
    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Eliminar departamento (solo si no tiene riesgos asociados)
  async delete(id) {
    // 1. Verificar que no haya riesgos enlazados a este departamento.
    const { count, error: countError } = await supabase
      .from("risks")
      .select("id", { count: "exact", head: true })
      .eq("department_id", id);
    if (countError) handleQueryError(countError);

    if ((count ?? 0) > 0) {
      const err = new Error("DEPARTMENT_HAS_RISKS");
      err.code = "DEPARTMENT_HAS_RISKS";
      err.riskCount = count;
      throw err;
    }

    // 2. Eliminar. Pedimos las filas borradas para confirmar que sí se borró.
    const { data, error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id)
      .select();
    if (error) handleQueryError(error);

    // Si no se borró ninguna fila, suele ser por permisos (RLS) o porque ya
    // no existe. Lo reportamos para no "fingir" un borrado exitoso.
    if (!data || data.length === 0) {
      const err = new Error("DEPARTMENT_DELETE_FAILED");
      err.code = "DEPARTMENT_DELETE_FAILED";
      throw err;
    }

    return true;
  },
};

export const Risk = {
  async list(order = "created_at") {
    const { data, error } = await supabase
      .from("risks")
      .select("*")
      .order(order.replace("-", ""), { ascending: !order.startsWith("-") });

    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Filtrar riesgos por condiciones
  async filter(filters) {
    let query = supabase.from("risks").select("*");
    for (const key in filters) {
      query = query.eq(key, filters[key]);
    }
    const { data, error } = await query;
    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Crear nuevo riesgo
  async create(riskData) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError) handleQueryError(authError);

    const userId = userData?.user?.id;
    // Sin usuario válido = sesión expirada: enviar al login en vez de
    // intentar un insert que fallaría por RLS.
    if (!userId) {
      forceLogout();
      throw new Error("Sesión expirada");
    }

    const { data, error } = await supabase
      .from("risks")
      .insert([{ ...riskData, created_by_id: userId }])
      .select();

    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Actualizar riesgo por ID
  async update(id, riskData) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError) handleQueryError(authError);

    const userId = userData?.user?.id;
    if (!userId) {
      forceLogout();
      throw new Error("Sesión expirada");
    }

    const { data, error } = await supabase
      .from("risks")
      .update({ ...riskData, created_by_id: userId })
      .eq("id", id)
      .select();

    if (error) handleQueryError(error);
    return data;
  },

  // 🔹 Eliminar riesgo por ID
  async delete(id) {
    const { data, error } = await supabase.from("risks").delete().eq("id", id);
    if (error) handleQueryError(error);
    return data;
  },
};

// auth
export const User = {
  // 🔹 Listar todos los usuarios (solo admin)
  async list() {
    try {
      const { data, error } = await supabase.rpc('list_users')
      if (error) throw error
      return data
    } catch (err) {
      console.error('Error al listar usuarios:', err.message)
      throw err
    }
  },

  // 🔹 Iniciar sesión
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data.user;
    } catch (err) {
      console.error("Error al iniciar sesión:", err.message);
      throw err;
    }
  },

  // 🔹 Cerrar sesión
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error al cerrar sesión:", err.message);
      throw err;
    }
  },

  // 🔹 Obtener usuario actual
  async me() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Cualquier error aquí (sesión faltante, token de refresco inválido,
      // sesión expirada) significa "no autenticado". Limpiamos cualquier
      // sesión rota guardada en el navegador para que la próxima recarga no
      // vuelva a fallar, y devolvemos null para que la app muestre el login.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (_) {
        // ignorar
      }
      return null;
    }
    return data?.user ?? null;
  },

  // 🔹 Registrar nuevo usuario con código de invitación
  async register(email, password, fullName, invitationCode) {
    try {
      // 1. Validar el código de invitación primero
      const validationResult = await InvitationCode.validate(
        invitationCode,
        email,
      );

      if (!validationResult.valid) {
        throw new Error(
          validationResult.message || "Código de invitación inválido",
        );
      }

      // 2. Crear el usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "user",
          },
        },
      });

      if (error) throw error;

      // 3. Marcar el código como usado
      if (data.user) {
        await InvitationCode.markAsUsed(invitationCode, data.user.id);
      }

      return data.user;
    } catch (err) {
      console.error("Error al registrar usuario:", err.message);
      throw err;
    }
  },
  // 🔹 Recuperar contraseña (enviar correo)
  async recoverPassword(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/update-password",
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al recuperar contraseña:", err.message);
      throw err;
    }
  },

  // 🔹 Actualizar contraseña (usuario autenticado)
  async updatePassword(newPassword) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al actualizar contraseña:", err.message);
      throw err;
    }
  },

  // 🔹 Suspender cuenta de usuario (solo admin)
  async suspend(userId) {
    try {
      const { data, error } = await supabase.rpc("suspend_user", {
        target_user_id: userId,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al suspender usuario:", err.message);
      throw err;
    }
  },

  // 🔹 Reactivar cuenta de usuario (solo admin)
  async reactivate(userId) {
    try {
      const { data, error } = await supabase.rpc("reactivate_user", {
        target_user_id: userId,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al reactivar usuario:", err.message);
      throw err;
    }
  },
};

// 🔹 Gestión de códigos de invitación
export const InvitationCode = {
  // Validar un código de invitación
  async validate(code, email = null) {
    try {
      const { data, error } = await supabase.rpc(
        "validate_and_use_invitation_code",
        {
          code_to_validate: code,
          user_email: email,
        },
      );

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al validar código:", err.message);
      return {
        valid: false,
        error: "VALIDATION_ERROR",
        message: "Error al validar el código de invitación",
      };
    }
  },

  // Marcar código como usado
  async markAsUsed(code, userId) {
    try {
      const { data, error } = await supabase.rpc("mark_invitation_code_used", {
        code_to_mark: code,
        user_id: userId,
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al marcar código como usado:", err.message);
      throw err;
    }
  },

  // Listar todos los códigos (para admin)
  async list(order = "-created_at") {
    try {
      const { data, error } = await supabase
        .from("invitation_codes")
        .select("*")
        .order(order.replace("-", ""), { ascending: !order.startsWith("-") });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al listar códigos:", err.message);
      throw err;
    }
  },

  // Crear nuevo código de invitación
  async create(codeData) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // Generar código aleatorio si no se proporciona
      let code = codeData.code;
      if (!code) {
        const { data: generatedCode, error: genError } = await supabase.rpc(
          "generate_random_code",
          { length: 12 },
        );
        if (genError) throw genError;
        code = generatedCode;
      }

      const { data, error } = await supabase
        .from("invitation_codes")
        .insert([
          {
            code,
            email: codeData.email || null,
            expires_at: codeData.expires_at || null,
            notes: codeData.notes || null,
            created_by_id: userId,
          },
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error("Error al crear código:", err.message);
      throw err;
    }
  },

  // Eliminar código de invitación
  async delete(id) {
    try {
      const { data, error } = await supabase
        .from("invitation_codes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al eliminar código:", err.message);
      throw err;
    }
  },

  // Obtener estadísticas de códigos
  async stats() {
    try {
      const { data, error } = await supabase
        .from("invitation_codes")
        .select("used");

      if (error) throw error;

      const total = data.length;
      const used = data.filter((c) => c.used).length;
      const available = total - used;

      return { total, used, available };
    } catch (err) {
      console.error("Error al obtener estadísticas:", err.message);
      throw err;
    }
  },
};

// 🔹 Acceso por módulo (Fase 2)
export const ModuleAccess = {
  // Módulos concedidos al usuario actual (arreglo de keys). RLS: solo lee lo suyo.
  async myModules() {
    const { data, error } = await supabase
      .from("user_module_access")
      .select("module_key");
    if (error) handleQueryError(error);
    return (data || []).map((r) => r.module_key);
  },

  // Todos los accesos (para admin). RLS: la política de admin permite ver todo.
  async listAll() {
    const { data, error } = await supabase
      .from("user_module_access")
      .select("user_id, module_key");
    if (error) handleQueryError(error);
    return data || [];
  },

  // Reemplaza el conjunto de módulos de un usuario (admin). Usa el RPC.
  async setUserModules(userId, moduleKeys) {
    const { data, error } = await supabase.rpc("set_user_modules", {
      target_user_id: userId,
      module_keys: moduleKeys,
    });
    if (error) handleQueryError(error);
    if (data && data.success === false) {
      throw new Error(data.message || "No se pudieron asignar los módulos");
    }
    return true;
  },
};

// 🔹 Plan Estratégico (Fase 0.3 en adelante)
export const StrategicPlan = {
  // Devuelve el plan de la organización; si no existe, lo crea.
  async getOrCreate() {
    const { data, error } = await supabase
      .from("strategic_plans")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) handleQueryError(error);
    if (data && data.length > 0) return data[0];

    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error: createError } = await supabase
      .from("strategic_plans")
      .insert([{ created_by_id: userData?.user?.id }])
      .select();
    if (createError) handleQueryError(createError);
    return created?.[0] || null;
  },

  // Actualiza campos del plan (visión, misión, valores, año, nombre).
  async update(planId, fields) {
    const { error } = await supabase
      .from("strategic_plans")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", planId);
    if (error) handleQueryError(error);
    return true;
  },

  // Respuestas de una sección (cuestionario) como mapa { question_key: answer }.
  async getAnswers(planId, section) {
    const { data, error } = await supabase
      .from("plan_answers")
      .select("question_key, answer")
      .eq("plan_id", planId)
      .eq("section", section);
    if (error) handleQueryError(error);
    const map = {};
    (data || []).forEach((r) => {
      map[r.question_key] = r.answer || "";
    });
    return map;
  },

  // Guarda (upsert) todas las respuestas de una sección.
  async saveAnswers(planId, section, answers) {
    const rows = Object.entries(answers).map(([question_key, answer]) => ({
      plan_id: planId,
      section,
      question_key,
      answer,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return true;
    const { error } = await supabase
      .from("plan_answers")
      .upsert(rows, { onConflict: "plan_id,section,question_key" });
    if (error) handleQueryError(error);
    return true;
  },

  // Respuestas de varias secciones en una sola consulta.
  // Devuelve { [section]: { question_key: answer } }.
  async getAnswersForSections(planId, sections) {
    if (!sections || sections.length === 0) return {};
    const { data, error } = await supabase
      .from("plan_answers")
      .select("section, question_key, answer")
      .eq("plan_id", planId)
      .in("section", sections);
    if (error) handleQueryError(error);
    const map = {};
    (data || []).forEach((r) => {
      if (!map[r.section]) map[r.section] = {};
      map[r.section][r.question_key] = r.answer || "";
    });
    return map;
  },

  // Guarda (upsert) varias secciones de una sola vez.
  // `sectionsMap` tiene la forma { [section]: { question_key: answer } }.
  async saveSections(planId, sectionsMap) {
    const now = new Date().toISOString();
    const rows = [];
    Object.entries(sectionsMap).forEach(([section, answers]) => {
      Object.entries(answers).forEach(([question_key, answer]) => {
        rows.push({ plan_id: planId, section, question_key, answer, updated_at: now });
      });
    });
    if (rows.length === 0) return true;
    const { error } = await supabase
      .from("plan_answers")
      .upsert(rows, { onConflict: "plan_id,section,question_key" });
    if (error) handleQueryError(error);
    return true;
  },
};

// 🔹 Competidores del análisis del mercado (Fase 1.2)
export const Competitor = {
  async list(planId) {
    const { data, error } = await supabase
      .from("competitors")
      .select("*")
      .eq("plan_id", planId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) handleQueryError(error);
    return data || [];
  },

  async create(planId, name, position = 0) {
    const { data, error } = await supabase
      .from("competitors")
      .insert([{ plan_id: planId, name, position }])
      .select();
    if (error) handleQueryError(error);
    return data?.[0] || null;
  },

  async rename(id, name) {
    const { error } = await supabase
      .from("competitors")
      .update({ name })
      .eq("id", id);
    if (error) handleQueryError(error);
    return true;
  },

  // Elimina el competidor y sus respuestas asociadas en plan_answers.
  async remove(planId, id) {
    const { error: answersError } = await supabase
      .from("plan_answers")
      .delete()
      .eq("plan_id", planId)
      .eq("section", `market-comp:${id}`);
    if (answersError) handleQueryError(answersError);

    const { error } = await supabase.from("competitors").delete().eq("id", id);
    if (error) handleQueryError(error);
    return true;
  },
};

// 🔹 Iniciativas estratégicas (Fase 3.4)
export const Initiative = {
  async list(planId) {
    const { data, error } = await supabase
      .from("strategic_initiatives")
      .select("*")
      .eq("plan_id", planId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) handleQueryError(error);
    return data || [];
  },

  // Inserta/actualiza varias iniciativas de una vez (autoguardado).
  async upsertMany(planId, rows) {
    if (!rows || rows.length === 0) return true;
    const clean = rows.map((r, i) => ({
      id: r.id,
      plan_id: planId,
      strategy_id: r.strategy_id,
      title: r.title || "",
      expected_result: r.expected_result || null,
      area: r.area || null,
      owner: r.owner || null,
      start_date: r.start_date || null,
      end_date: r.end_date || null,
      budget: r.budget === "" || r.budget == null ? null : Number(r.budget),
      kpi: r.kpi || null,
      steps: r.steps || null,
      position: i,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("strategic_initiatives")
      .upsert(clean, { onConflict: "id" });
    if (error) handleQueryError(error);
    return true;
  },

  async remove(id) {
    const { error } = await supabase
      .from("strategic_initiatives")
      .delete()
      .eq("id", id);
    if (error) handleQueryError(error);
    return true;
  },
};
