import { useEffect, useRef } from "react";
import { forceLogout } from "@/api/authHelpers";

// Marca de tiempo de la última actividad del usuario (en localStorage para que
// funcione entre pestañas y sobreviva a recargas).
export const IDLE_ACTIVITY_KEY = "last_activity";

// Tiempo de inactividad tras el cual se cierra la sesión: 8 horas.
export const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];
// No escribir en localStorage más de una vez cada 30s (evita saturar en cada
// movimiento del mouse).
const WRITE_THROTTLE_MS = 30 * 1000;
// Cada cuánto se revisa si ya venció el tiempo de inactividad.
const CHECK_INTERVAL_MS = 60 * 1000;

// Reinicia el contador de inactividad. Llamar al iniciar sesión para empezar
// la ventana de tiempo desde cero.
export function resetIdleTimer() {
  try {
    window.localStorage.setItem(IDLE_ACTIVITY_KEY, String(Date.now()));
  } catch (_) {
    // localStorage no disponible (modo privado); ignorar.
  }
}

// Hook que cierra la sesión tras `timeoutMs` de inactividad y redirige al login.
// `enabled` debe ser true solo cuando hay una sesión activa.
export function useIdleTimeout(enabled, timeoutMs = IDLE_TIMEOUT_MS) {
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const getLastActivity = () => {
      const value = Number(window.localStorage.getItem(IDLE_ACTIVITY_KEY));
      return Number.isFinite(value) && value > 0 ? value : Date.now();
    };

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current >= WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        try {
          window.localStorage.setItem(IDLE_ACTIVITY_KEY, String(now));
        } catch (_) {
          // ignorar
        }
      }
    };

    const checkExpiration = () => {
      if (Date.now() - getLastActivity() >= timeoutMs) {
        try {
          window.localStorage.removeItem(IDLE_ACTIVITY_KEY);
        } catch (_) {
          // ignorar
        }
        // Cierra sesión local y redirige al login con el aviso de expiración.
        forceLogout();
      }
    };

    // Si no hay marca previa, inicializa con el momento actual.
    if (!window.localStorage.getItem(IDLE_ACTIVITY_KEY)) {
      resetIdleTimer();
    }
    // Revisa de inmediato por si reabrieron la pestaña tras el tiempo límite.
    checkExpiration();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true }),
    );
    const interval = setInterval(checkExpiration, CHECK_INTERVAL_MS);
    // Revisa también al volver a la pestaña.
    const onVisibility = () => {
      if (!document.hidden) checkExpiration();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, markActivity),
      );
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, timeoutMs]);
}
