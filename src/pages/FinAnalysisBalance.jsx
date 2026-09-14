import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { ArrowLeft, Scale, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  SALES_SECTION,
  EXPENSES_SECTION,
  INCOME_SECTION,
  BALANCE_SECTION,
  BALANCE_GROUPS,
  ALL_BALANCE_KEYS,
  costSection,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeIncome, computeBalance, pctChange } from "@/config/finCalc";

// Balance General por año, con subtotales en vivo y la validación
// Activo = Pasivo + Capital en pantalla.

// Qué subtotal mostrar después de cada grupo.
const TOTAL_AFTER = {
  activo_circulante: [{ key: "activoCirculante", label: "Total activo circulante" }],
  activo_no_circulante: [{ key: "totalActivo", label: "Total activo", strong: true }],
  pasivo_circulante: [{ key: "pasivoCirculante", label: "Total pasivo circulante" }],
  pasivo_largo_plazo: [{ key: "totalPasivo", label: "Total pasivo", strong: true }],
  capital: [
    { key: "totalCapital", label: "Total capital contable", strong: true },
    { key: "totalPasivoCapital", label: "Total pasivo + capital", strong: true },
  ],
};

export default function FinAnalysisBalance() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [income, setIncome] = useState({}); // utilidad neta por año (referencia)
  const [values, setValues] = useState({}); // { [key]: { [yearId]: "" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, ls] = await Promise.all([FinYear.list(a.id), FinLine.list(a.id)]);
      const stored = await FinValue.getSections(a.id, [
        BALANCE_SECTION,
        SALES_SECTION,
        EXPENSES_SECTION,
        INCOME_SECTION,
        ...ls.map((l) => costSection(l.id)),
      ]);
      const bal = stored[BALANCE_SECTION] || {};
      const map = {};
      ALL_BALANCE_KEYS.forEach((k) => {
        map[k] = {};
        ys.forEach((y) => {
          const v = bal[k]?.[y.id];
          map[k][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setIncome(computeIncome({ sections: stored, years: ys, lines: ls }));
      setValues(map);
    } catch (err) {
      console.error("Error al cargar el balance:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: saveStatus, flush } = useAutosave({
    data: values,
    enabled: !loading && !!analysis,
    onSave: async () => {
      const rows = [];
      Object.entries(values).forEach(([key, byYear]) => {
        Object.entries(byYear).forEach(([yearId, amount]) => {
          rows.push({ year_id: yearId, section: BALANCE_SECTION, concept_key: key, amount: toNumber(amount) });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (key, yearId, value) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [yearId]: value } }));
  };

  const totals = useMemo(
    () => computeBalance({ sections: { [BALANCE_SECTION]: values }, years }),
    [values, years]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  // Años cuyo balance no cuadra (solo los que ya tienen captura).
  const unbalanced = years.filter((y) => {
    const t = totals[y.id];
    return t && (t.totalActivo !== 0 || t.totalPasivoCapital !== 0) && Math.abs(t.diferencia) > 0.5;
  });
  const captured = years.some((y) => totals[y.id]?.totalActivo || totals[y.id]?.totalPasivoCapital);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Scale className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Balance General</h1>
            <p className="text-muted">Lo que tienes, lo que debes y lo que es tuyo, al cierre de cada año.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Captura los saldos al cierre de cada año (en miles) manteniendo la misma
            clasificación entre periodos. Los subtotales se calculan solos y la app
            verifica en cada año que <strong>Activo = Pasivo + Capital</strong>. Si un
            concepto no aplica, déjalo en blanco.
          </p>
        </CardContent>
      </Card>

      {years.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">Primero define los años a analizar en Datos generales.</p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">
                Ir a Datos generales →
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Validación */}
          {captured && (
            unbalanced.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/10 px-5 py-3.5">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                <p className="text-sm">El balance cuadra en todos los años capturados.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3.5 space-y-1">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm font-subtitle">El balance no cuadra en: {unbalanced.map((y) => yearLabel(y)).join(", ")}</p>
                </div>
                <p className="text-xs text-muted pl-8">
                  Activo menos (Pasivo + Capital) debe ser cero. Revisa la diferencia en la última fila de la tabla.
                </p>
              </div>
            )
          )}

          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {years.map((y) => (
                      <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">
                        {yearLabel(y)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BALANCE_GROUPS.map((g) => (
                    <React.Fragment key={g.key}>
                      <tr>
                        <td colSpan={years.length + 1} className="pt-4 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">
                          {g.title}
                        </td>
                      </tr>
                      {g.items.map((item) => (
                        <tr key={item.key} className="border-b border-card-border/50">
                          <td className="p-2 min-w-[220px]">
                            {item.label}
                            {item.key === "resultado_periodo" && (
                              <span className="block text-[11px] text-muted">
                                Debe coincidir con la utilidad neta del Estado de Resultados
                              </span>
                            )}
                          </td>
                          {years.map((y) => {
                            const ref = item.key === "resultado_periodo" ? income[y.id]?.utilidadNeta : null;
                            const cur = toNumber(values[item.key]?.[y.id]);
                            const mismatch = ref != null && cur != null && Math.abs(ref - cur) > 0.5;
                            return (
                              <td key={y.id} className="p-1.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={values[item.key]?.[y.id] ?? ""}
                                  onChange={(e) => handleCell(item.key, y.id, e.target.value)}
                                  placeholder="0"
                                  className={`w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right ${mismatch ? "border-amber-400/60" : ""}`}
                                />
                                {ref != null && ref !== 0 && (
                                  <span className={`block text-[10px] text-right mt-0.5 ${mismatch ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
                                    Edo. Res.: {fmtMiles.format(ref)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {TOTAL_AFTER[g.key].map((t) => (
                        <tr key={t.key} className={`bg-accent/5 border-b border-card-border/50 ${t.strong ? "font-subtitle" : ""}`}>
                          <td className="p-2">{t.label}</td>
                          {years.map((y, i) => {
                            const v = totals[y.id]?.[t.key] ?? 0;
                            const prev = i > 0 ? totals[years[i - 1].id]?.[t.key] : null;
                            const delta = pctChange(v, prev);
                            return (
                              <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                                {fmtMiles.format(v)}
                                {delta != null && (
                                  <span className={`block text-[11px] ${delta >= 0 ? "text-green-600 dark:text-green-500" : "text-red-500"}`}>
                                    {delta >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(delta))}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Diferencia */}
                  <tr className="font-subtitle">
                    <td className="p-2 pt-4">Diferencia (Activo − Pasivo − Capital)</td>
                    {years.map((y) => {
                      const d = totals[y.id]?.diferencia ?? 0;
                      const ok = Math.abs(d) <= 0.5;
                      return (
                        <td key={y.id} className={`p-2 pt-4 text-right whitespace-nowrap ${ok ? "text-green-600 dark:text-green-500" : "text-red-500"}`}>
                          {ok ? "✓ 0" : fmtMiles.format(d)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisIncome")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Estado de Resultados
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisCashflow")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Estado de cambios →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
