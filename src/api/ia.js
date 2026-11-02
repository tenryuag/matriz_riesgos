import { supabase } from "./supabaseClient";
import { handleQueryError } from "./authHelpers";

// ============================================================
// Cliente del asistente de IA (Edge Function `ia`).
// ------------------------------------------------------------
// La app NUNCA habla con la API de Claude directamente: la llave vive como
// secreto en Supabase y la Edge Function `ia` hace la llamada con la sesión
// del usuario (mismas políticas RLS que la app). Cada acción devuelve JSON
// con la forma documentada en docs/IA.md.
//
//   const { result, usage, cached } = await callIa("interpretar_informe");
//
// Errores: se lanzan como IaError con `code` (ver IA_ERROR_MESSAGES) y un
// mensaje en español listo para mostrar.
// ============================================================

export const IA_FUNCTION = "ia";

export const IA_ERROR_MESSAGES = {
  no_configurado:
    "El asistente de IA aún no está configurado en el servidor. Pide al administrador que registre la llave de la API.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión para usar el asistente.",
  sin_acceso: "No tienes acceso al módulo que necesita esta función.",
  sin_datos: "Aún no hay información suficiente para generar esto. Captura tus datos primero.",
  limite_diario:
    "Alcanzaste el límite diario de uso del asistente. Podrás volver a usarlo mañana.",
  limite_global:
    "El asistente llegó al tope de gasto de este mes. Avisa al administrador.",
  peticion_invalida: "La petición no es válida. Recarga la página e inténtalo de nuevo.",
  archivo_grande: "Los archivos pesan demasiado. Sube archivos de hasta 8 MB en total.",
  rechazado: "El asistente no pudo procesar esta petición. Revisa el contenido e inténtalo de nuevo.",
  incompleto: "La respuesta quedó incompleta. Inténtalo de nuevo.",
  proveedor: "El servicio de IA no respondió. Inténtalo en unos minutos.",
  saturado: "El servicio de IA está saturado en este momento. Inténtalo en unos minutos.",
  desconocido: "No pudimos completar la petición. Inténtalo de nuevo.",
};

export class IaError extends Error {
  constructor(code, message, status) {
    super(message || IA_ERROR_MESSAGES[code] || IA_ERROR_MESSAGES.desconocido);
    this.name = "IaError";
    this.code = code || "desconocido";
    this.status = status;
  }
}

// Códigos cuyo mensaje del servidor es apto para mostrarse tal cual (trae el
// detalle concreto: módulo que falta, acción desconocida, etc.).
const USER_FACING = new Set([
  "sin_datos",
  "archivo_grande",
  "peticion_invalida",
  "sin_acceso",
  "limite_diario",
  "limite_global",
  "no_configurado",
]);

// Convierte la respuesta cruda de la función en IaError.
async function toIaError(error, data) {
  // supabase-js envuelve los códigos HTTP ≠ 2xx en FunctionsHttpError con la
  // respuesta en `context`; el cuerpo trae { ok:false, error:{code,message} }.
  let body = data;
  if (!body && error?.context && typeof error.context.json === "function") {
    try {
      body = await error.context.json();
    } catch {
      body = null;
    }
  }
  const code = body?.error?.code;
  const message = body?.error?.message;
  const status = error?.context?.status;
  if (code) {
    const text = USER_FACING.has(code) && message ? message : IA_ERROR_MESSAGES[code] || message;
    return new IaError(code, text, status);
  }
  if (status === 401) return new IaError("sin_sesion", null, status);
  if (status === 429) return new IaError("saturado", null, status);
  if (status === 413) return new IaError("archivo_grande", null, status);
  return new IaError("desconocido", null, status);
}

// Llama una acción del asistente. `params` es el cuerpo específico de la
// acción. Devuelve { result, usage, cached, generated_at }.
export async function callIa(action, params = {}, { signal } = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new IaError("sin_sesion");
  const { data, error } = await supabase.functions.invoke(IA_FUNCTION, {
    body: { action, ...params },
    ...(signal ? { signal } : {}),
  });
  if (error || !data || data.ok === false) throw await toIaError(error, data);
  return data;
}

// Estado del asistente (¿está configurado?, modelo, límites). Para el panel
// de administración y para esconder botones si no hay llave.
export async function iaStatus() {
  try {
    return await callIa("estado");
  } catch (err) {
    if (err instanceof IaError) return { ok: false, error: err.code, configurado: false };
    throw err;
  }
}

// Último resultado guardado de un tipo ('informe' | 'resumen_ejecutivo') del
// usuario, o null. Lo leen las pantallas al abrir, sin llamar a la IA.
export async function iaSavedResult(kind) {
  const { data, error } = await supabase
    .from("ia_resultados")
    .select("result, input_hash, model, cost_usd, created_at")
    .eq("kind", kind)
    .maybeSingle();
  if (error) handleQueryError(error);
  return data || null;
}

// Bitácora de uso (RLS: el usuario ve lo suyo; el admin, todo).
export const IaUsage = {
  async recent(limit = 50) {
    const { data, error } = await supabase
      .from("ia_usage")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) handleQueryError(error);
    return data || [];
  },
  // Agregado por usuario (solo administradores; a los demás les devuelve vacío).
  async byUser() {
    const { data, error } = await supabase.rpc("ia_usage_by_user");
    if (error) handleQueryError(error);
    return data || [];
  },
};

// Formato de costo en dólares (centavos cuando es chico).
export function fmtUsd(v) {
  const n = Number(v) || 0;
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)} USD`;
  return `$${n.toFixed(2)} USD`;
}

// Lee un archivo del navegador como base64 (sin el prefijo data:).
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
