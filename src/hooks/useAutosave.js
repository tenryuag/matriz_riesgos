import { useEffect, useRef, useState, useCallback } from "react";

// Autoguardado con retraso tras el último cambio (debounce).
//
// - `data`: el estado a vigilar; se compara serializado, así que cualquier
//   cambio real dispara un guardado ~`delay` ms después del último cambio.
// - `onSave`: función async que persiste el estado actual.
// - `enabled`: actívalo cuando los datos ya cargaron. Al activarse se toma la
//   "línea base" para NO guardar lo que se acaba de cargar de la BD.
//
// Devuelve { status, flush, rebase }:
// - status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
// - flush(): guarda inmediatamente lo pendiente (para el botón "Guardar ahora"
//   y para el desmontaje de la página).
// - rebase(nextData): fija `nextData` como nueva línea base SIN guardar. Para
//   cuando la página recarga datos de la BD por su cuenta (por ejemplo tras
//   Initiative.createFromSource) y los pone en el estado: así ese cambio no
//   se interpreta como "pendiente" ni dispara un guardado completo.
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
    const baselineAtStart = baselineRef.current;
    savingRef.current = true;
    setStatus("saving");
    try {
      await onSaveRef.current();
      // Si rebase() cambió la línea base mientras guardábamos, respétala.
      if (baselineRef.current === baselineAtStart) baselineRef.current = snapshot;
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

  // Nueva línea base sin guardar (ver cabecera). Debe llamarse junto con el
  // setState que pone `nextData` en el estado; en el siguiente render la
  // serialización coincide con la línea base y no se programa nada. Si
  // pudiera haber cambios sin guardar, llama a flush() antes: lo que no se
  // guardó deja de considerarse pendiente.
  const rebase = useCallback((nextData) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    baselineRef.current = JSON.stringify(nextData ?? null);
    setStatus("idle");
  }, []);

  return { status, flush, rebase };
}
