// ============================================================
// Carga de los insumos de la Planeación Estratégica para una pantalla
// (Fase 2). Envuelve loadStrategyInputs y resuelve dos detalles que las
// páginas no deben repetir:
//
// 1. Acceso al módulo de riesgos: los riesgos solo se consultan si el
//    usuario tiene el módulo `risk` (o es admin). Mientras el contexto de
//    módulos carga, grantedModules = [] e isAdmin = false, así que la
//    PRIMERA carga espera a que termine (si no, un usuario con el módulo
//    vería la planeación sin sus riesgos tras un F5).
// 2. Refoco de pestaña: supabase-js emite SIGNED_IN cada vez que la pestaña
//    vuelve a ser visible y el contexto de módulos vuelve a `loading: true`.
//    Después de la primera carga eso se ignora: `loading` nunca regresa a
//    true una vez que hay datos, y solo se vuelve a consultar (en silencio)
//    si el acceso al módulo de riesgos cambió de valor.
// ============================================================
import { useState, useEffect, useCallback, useRef } from "react";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { MODULES, canAccessModule } from "@/config/modules";
import { loadStrategyInputs } from "@/api/strategyInputs";

const RISK_MODULE = MODULES.find((m) => m.key === "risk");
export const LOAD_ERROR_TEXT = "No pudimos cargar la información. Intenta recargar la página.";

// Devuelve { inputs, loading, error, reload, risksEnabled }.
// - inputs: forma de loadStrategyInputs (plan, sections, ratings, competitors,
//   initiatives, risks, decisions); null antes de la primera carga.
// - loading: true solo antes de tener datos (y nunca si la primera carga falló).
// - error: '' o LOAD_ERROR_TEXT (cuando la primera carga falla).
// - reload(): repite la carga completa (en silencio si ya hay inputs).
// - risksEnabled: si el usuario puede consultar riesgos.
export function useStrategyInputs({ extraSections = [] } = {}) {
  const { user, isAdmin, grantedModules, loading: accessLoading } = useModuleAccess();
  const risksEnabled = canAccessModule(RISK_MODULE, { isAdmin, grantedModules });
  // Las páginas suelen pasar un arreglo literal; se estabiliza por contenido.
  const extraKey = JSON.stringify(extraSections || []);

  const [inputs, setInputs] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const activeRef = useRef(true);
  const seqRef = useRef(0);
  const inputsRef = useRef(null);
  const loadedOnceRef = useRef(false);
  const lastRisksEnabledRef = useRef(null);
  const lastExtraKeyRef = useRef(extraKey);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (includeRisks) => {
      const seq = ++seqRef.current;
      setFetching(true);
      try {
        const data = await loadStrategyInputs({
          includeRisks,
          extraSections: JSON.parse(extraKey),
        });
        if (!activeRef.current || seq !== seqRef.current) return;
        inputsRef.current = data;
        setInputs(data);
        setError("");
      } catch (err) {
        if (!activeRef.current || seq !== seqRef.current) return;
        console.error("Error al cargar la planeación:", err);
        // Solo la carga inicial muestra el error; una recarga silenciosa que
        // falla conserva los datos que ya se tenían.
        if (!inputsRef.current) setError(LOAD_ERROR_TEXT);
      } finally {
        if (activeRef.current && seq === seqRef.current) setFetching(false);
      }
    },
    [extraKey]
  );

  useEffect(() => {
    if (!loadedOnceRef.current) {
      // Primera carga: esperar a conocer el acceso por módulo.
      if (accessLoading) return;
      loadedOnceRef.current = true;
      lastRisksEnabledRef.current = risksEnabled;
      lastExtraKeyRef.current = extraKey;
      load(risksEnabled);
      return;
    }
    // Después de la primera carga, accessLoading se ignora (refoco de
    // pestaña). Solo un cambio real de acceso a riesgos (o de las secciones
    // pedidas) vuelve a consultar, en silencio.
    // Sin sesión (SIGNED_OUT deja grantedModules = []) no se consulta nada:
    // la app está redirigiendo al login y la consulta solo produciría ruido.
    if (!user) return;
    if (risksEnabled !== lastRisksEnabledRef.current || extraKey !== lastExtraKeyRef.current) {
      lastRisksEnabledRef.current = risksEnabled;
      lastExtraKeyRef.current = extraKey;
      load(risksEnabled);
    }
  }, [accessLoading, risksEnabled, extraKey, load, user]);

  const reload = useCallback(() => {
    lastRisksEnabledRef.current = risksEnabled;
    lastExtraKeyRef.current = extraKey;
    return load(risksEnabled);
  }, [load, risksEnabled, extraKey]);

  // Solo antes de tener datos y mientras no haya fallado la primera carga: si
  // falló, el refoco de pestaña (accessLoading vuelve a true) no debe sustituir
  // el bloque de error por el esqueleto.
  const loading = !inputs && !error && (accessLoading || fetching);

  return { inputs, loading, error, reload, risksEnabled };
}
