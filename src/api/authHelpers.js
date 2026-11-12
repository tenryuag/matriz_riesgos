import { supabase } from "./supabaseClient";

// Bandera que la pantalla de login lee para avisar "tu sesión expiró".
export const SESSION_EXPIRED_KEY = "session_expired";

// ¿El error proviene de una sesión expirada / token inválido / sin autenticar?
// Cubre tanto errores de Supabase Auth como de PostgREST (consultas a tablas).
export function isAuthError(error) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const status = Number(error.status);
  const code = error.code || "";

  return (
    status === 401 ||
    code === "PGRST301" ||                 // JWT expirado (PostgREST)
    code === "PGRST302" ||                 // JWT inválido (PostgREST)
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("invalid refresh token") ||
    msg.includes("refresh token not found") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("token is expired") ||
    msg.includes("not authenticated") ||
    (msg.includes("session") && msg.includes("missing"))
  );
}

let loggingOut = false;

// Cierra la sesión local y manda al login. Es idempotente: si ya se está
// ejecutando, no hace nada (evita bucles de redirección).
export async function forceLogout() {
  if (loggingOut) return;
  loggingOut = true;

  try {
    // scope 'local' solo limpia el almacenamiento del navegador; no intenta
    // una llamada de red que de todos modos fallaría con la sesión rota.
    await supabase.auth.signOut({ scope: "local" });
  } catch (_) {
    // Si signOut falla, igual continuamos a limpiar y redirigir.
  }

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
      // Limpia la marca de inactividad para que el próximo login arranque limpio.
      window.localStorage.removeItem("last_activity");
    } catch (_) {
      // storage puede no estar disponible en modo privado; ignorar.
    }
    window.location.assign("/");
  }
}

// Mensajes amigables para errores de restricciones de la BD que el usuario
// puede llegar a ver (PostgreSQL devuelve el código SQLSTATE en error.code).
const CONSTRAINT_MESSAGES = {
  // CHECK violado: p. ej. una perspective_key fuera del catálogo.
  "23514":
    "Valor no permitido (por ejemplo, una perspectiva que no existe). Recarga la página e inténtalo de nuevo.",
  // UNIQUE violado.
  "23505": "Ya existe un registro igual.",
};

// Para usar en el `catch`/manejo de error de las consultas:
// - si el error es de sesión, cierra sesión, redirige y relanza el error
//   original (las páginas lo reconocen con isAuthError);
// - si es una restricción conocida de la BD (CHECK, UNIQUE), relanza un Error
//   con mensaje en español, conservando `code`, `details` y `hint` del
//   original (y el original en `cause`) para quien quiera inspeccionarlo;
// - en cualquier otro caso, relanza el error tal cual para que la página lo
//   maneje como siempre (validaciones, etc.).
export function handleQueryError(error) {
  if (isAuthError(error)) {
    forceLogout();
    throw error;
  }

  const friendly = CONSTRAINT_MESSAGES[error?.code];
  if (friendly) {
    const err = new Error(friendly);
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    err.cause = error;
    throw err;
  }

  throw error;
}
