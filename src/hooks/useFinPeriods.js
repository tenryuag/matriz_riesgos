import { useState, useMemo, useCallback } from "react";
import { sortPeriods, latestCuts, hasMultipleCuts } from "@/config/finCalc";

// Periodos que muestran las tablas del Análisis Financiero. Un año puede
// tener varios cortes (jun 2026, oct 2026, cierre 2026). Por defecto se ve
// un periodo por año, el corte más reciente, que es la vista de siempre; con
// "Ver cortes anteriores" se muestran todos. La preferencia se recuerda en
// este navegador y es la misma en todas las pantallas del módulo.
const STORAGE_KEY = "fin-show-cuts";

const readPref = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export function useFinPeriods(allYears) {
  const [pref, setPref] = useState(readPref);
  const sorted = useMemo(() => sortPeriods(allYears), [allYears]);
  const multiple = useMemo(() => hasMultipleCuts(sorted), [sorted]);
  const showCuts = pref && multiple;
  const years = useMemo(() => (showCuts || !multiple ? sorted : latestCuts(sorted)), [sorted, showCuts, multiple]);

  const setShowCuts = useCallback((value) => {
    setPref(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Sin almacenamiento local la preferencia dura lo que la pantalla.
    }
  }, []);

  return { years, allYears: sorted, multiple, showCuts, setShowCuts, hiddenCount: sorted.length - latestCuts(sorted).length };
}
