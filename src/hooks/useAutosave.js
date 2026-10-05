import { useEffect, useRef, useState, useCallback } from "react";

// Autoguardado con retraso tras el último cambio (debounce).
//
// - `data`: el estado a vigilar; se compara serializado, así que cualquier
//   cambio real dispara un guardado ~`delay` ms después del último cambio.
// - `onSave`: función async que persiste el estado actual.
// - `enabled`: actívalo cuando los datos ya cargaron. Al activarse se toma la
//   "línea base" para NO guardar lo que se acaba de cargar de la BD.
//
// Devuelve { status, flush }:
// - status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
// - flush(): guarda inmediatamente lo pendiente (para el botón "Guardar ahora"
//   y para el desmontaje de la página).
export function useAutosave({ data, onSave, enabled = true, delay = 1500 }) {
  const [status, setStatus] = useState("idle");
  const serialized = JSON.stringify(data ?? null);

  const baselineRef = useRef(null);
  const armedRef = useRef(false);
  const latestRef = useRef(serialized);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const onSaveRef = useRef(onSave);

  latestRef.current = serialized;
  onSaveRef.current = onSave;

  // Al habilitarse (datos cargados), fija la línea base.
  useEffect(() => {
    if (enabled && !armedRef.current) {
      armedRef.current = true;
      baselineRef.current = serialized;
    } else if (!enabled) {
      armedRef.current = false;
    }
  }, [enabled, serialized]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!armedRef.current || savingRef.current) return;
    if (latestRef.current === baselineRef.current) return;

    const snapshot = latestRef.current;
    savingRef.current = true;
    setStatus("saving");
    try {
      await onSaveRef.current();
      baselineRef.current = snapshot;
      savingRef.current = false;
      if (latestRef.current !== snapshot) {
        // Hubo más cambios mientras guardábamos: reprograma otro guardado.
        setStatus("pending");
        timerRef.current = setTimeout(flush, delay);
      } else {
        setStatus("saved");
      }
    } catch (err) {
      savingRef.current = false;
      console.error("Error de autoguardado:", err);
      setStatus("error");
    }
  }, [delay]);

  // Programa el guardado tras cada cambio real.
  useEffect(() => {
    if (!enabled || !armedRef.current) return;
    if (serialized === baselineRef.current) return;
    setStatus("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [serialized, enabled, delay, flush]);

  // Al salir de la página, intenta guardar lo pendiente (mejor esfuerzo).
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return { status, flush };
}
