import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, Scale, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  INCOME_SECTION,
  INCOME_INPUT_KEYS,
  BALANCE_SECTION,
  BALANCE_GROUPS,
  ALL_BALANCE_KEYS,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeBalance } from "@/config/finCalc";

// Balance General por periodo (modelo MP-AFH1): 27 cuentas capturadas en
// cinco grupos, subtotales en vivo, la fila automática "Resultado neto del
// periodo" (utilidad neta del Estado de Resultados, no se captura), el % de
// cada cifra sobre el total activo y la validación Activo = Pasivo + Capital.
// Las cuentas se capturan con su signo contable: casi todas en positivo, pero
// Reservas y Resultados acumulados (marcadas `signed` en el catálogo) van en
// negativo cuando hay déficit o pérdidas acumuladas; la pantalla lo avisa con
// el chip "± con signo" y una pista bajo la etiqueta.

// Totales que se resaltan (los demás son subtotales intermedios).
const STRONG_TOTALS = new Set(["totalActivo", "totalPasivo", "totalCapital", "totalPasivoCapital"]);

// Tolerancia para dar por cuadrado un año (cifras en miles).
const TOLERANCE = 0.5;

// Porcentaje sobre el total activo, bajo cada cifra (como en el Excel).
// `blank`: deja la línea vacía (celda sin captura) en vez de "—".
function PctLine({ value, blank = false, className = "" }) {
  let text = "—";
  if (value != null) text = fmtPct(value);
  else if (blank) text = "\u00a0";
  return <span className={`block text-[10px] text-right mt-0.5 text-muted ${className}`}>{text}</span>;
}
PctLine.propTypes = {
  value: PropTypes.number,
  blank: PropTypes.bool,
  className: PropTypes.string,
};

export default function FinAnalysisBalance() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [incomeStored, setIncomeStored] = useState({}); // sección income tal cual está guardada
  const [values, setValues] = useState({}); // { [cuenta]: { [yearId]: "" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const ys = await FinYear.list(a.id);
      const stored = await FinValue.getSections(a.id, [BALANCE_SECTION, INCOME_SECTION]);
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
      setIncomeStored(stored[INCOME_SECTION] || {});
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

  // Totales en vivo. El resultado del periodo sale del Estado de Resultados
  // guardado; por eso la sección income viaja junto con la captura del balance.
  const totals = useMemo(
    () => computeBalance({ sections: { [BALANCE_SECTION]: values, [INCOME_SECTION]: incomeStored }, years }),
    [values, incomeStored, years]
  );

  // Años con alguna cuenta del balance capturada / con Estado de Resultados.
  const hasBalance = (yearId) => ALL_BALANCE_KEYS.some((k) => toNumber(values[k]?.[yearId]) != null);
  const hasIncome = (yearId) => INCOME_INPUT_KEYS.some((k) => toNumber(incomeStored[k]?.[yearId]) != null);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  const capturedYears = years.filter((y) => hasBalance(y.id));
  const unbalanced = capturedYears.filter((y) => Math.abs(totals[y.id]?.diferencia ?? 0) > TOLERANCE);
  const missingIncome = capturedYears.filter((y) => !hasIncome(y.id));

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
            <p className="text-muted">Lo que tienes, lo que debes y lo que es tuyo, al cierre de cada periodo.</p>
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
            Captura los saldos al cierre de cada periodo tal como vienen en tu Balance (en
            miles), manteniendo la misma clasificación entre periodos. Casi todos son
            positivos; <strong>Resultados acumulados</strong> y <strong>Reservas</strong> van
            en negativo cuando son pérdidas acumuladas o un déficit. Los subtotales se calculan
            solos, bajo cada cifra verás su peso sobre el total activo y la app verifica en
            cada periodo que <strong>Activo = Pasivo + Capital</strong>. El{" "}
            <strong>Resultado neto del periodo</strong> no se captura: se toma de la utilidad
            neta del Estado de Resultados. Si una cuenta no aplica, déjala en blanco.
          </p>
        </CardContent>
      </Card>

      {years.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">Primero define los periodos a analizar en Datos generales.</p>
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
          {capturedYears.length > 0 && (
            unbalanced.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/10 px-5 py-3.5">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                <p className="text-sm">El balance cuadra en todos los periodos capturados.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3.5 space-y-1">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm font-subtitle">
                    El balance no cuadra en: {unbalanced.map((y) => yearLabel(y)).join(", ")}
                  </p>
                </div>
                <p className="text-xs text-muted pl-8">
                  Activo menos (Pasivo + Capital) debe ser cero. Revisa la diferencia en la última
                  fila de la tabla y recuerda que el resultado del periodo viene del Estado de Resultados.
                </p>
              </div>
            )
          )}

          {missingIncome.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3.5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm">
                Falta el Estado de Resultados de {missingIncome.map((y) => yearLabel(y)).join(", ")}:
                sin él, el resultado neto del periodo vale 0 y el capital no cuadrará.{" "}
                <Link to={createPageUrl("FinAnalysisIncome")} className="text-accent hover:underline font-subtitle">
                  Capturarlo →
                </Link>
              </p>
            </div>
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
                        {y.months < 12 && <span className="block text-[10px] font-normal text-muted">parcial</span>}
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

                      {/* Cuentas capturadas */}
                      {g.items.map((item) => {
                        const isAcumulados = item.key === "resultados_acumulados";
                        return (
                          <tr key={item.key} className="border-b border-card-border/50">
                            <td className="p-2 min-w-[220px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{item.label}</span>
                                {item.signed && (
                                  <span className="text-[10px] font-subtitle px-1.5 py-0.5 rounded-full glass whitespace-nowrap text-amber-600 dark:text-amber-400">
                                    ± con signo
                                  </span>
                                )}
                              </div>
                              {item.hint && (
                                <span className="block text-[11px] text-muted">{item.hint}</span>
                              )}
                            </td>
                            {years.map((y, i) => {
                              const t = totals[y.id];
                              const raw = values[item.key]?.[y.id] ?? "";
                              const cur = toNumber(raw);
                              const suggested = isAcumulados && i > 0 ? t?.acumuladosSugerido : null;
                              const differs = suggested != null && cur != null && Math.abs(cur - suggested) > TOLERANCE;
                              return (
                                <td key={y.id} className="p-1.5 align-top">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={raw}
                                    onChange={(e) => handleCell(item.key, y.id, e.target.value)}
                                    placeholder="0"
                                    aria-label={`${item.label} ${yearLabel(y)}`}
                                    className={`w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right ${differs ? "border-amber-400/60" : ""}`}
                                  />
                                  {suggested != null && (
                                    <button
                                      type="button"
                                      onClick={() => handleCell(item.key, y.id, String(suggested))}
                                      title="Usar este valor"
                                      className={`block w-full text-[10px] text-right mt-0.5 hover:underline ${differs ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}
                                    >
                                      Sugerido: {fmtMiles.format(suggested)}
                                    </button>
                                  )}
                                  <PctLine value={cur == null ? null : t?.pct?.[item.key]} blank={cur == null} />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Filas automáticas (resultado neto del periodo) */}
                      {(g.auto || []).map((row) => (
                        <tr key={row.key} className="border-b border-card-border/50">
                          <td className="p-2 min-w-[220px]">
                            {row.label}
                            <span className="block text-[11px] text-muted">
                              Se toma de la utilidad neta del{" "}
                              <Link to={createPageUrl("FinAnalysisIncome")} className="text-accent hover:underline">
                                Estado de Resultados
                              </Link>
                              ; no se captura aquí.
                            </span>
                          </td>
                          {years.map((y) => {
                            const t = totals[y.id];
                            const v = t?.[row.key] ?? 0;
                            const withIncome = hasIncome(y.id);
                            return (
                              <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                                <span className={`block ${withIncome ? "" : "text-muted"} ${v < 0 ? "text-red-500" : ""}`}>
                                  {withIncome ? fmtMiles.format(v) : "—"}
                                </span>
                                {withIncome ? (
                                  <PctLine value={t?.pct?.[row.key]} />
                                ) : (
                                  <span className="block text-[10px] text-right mt-0.5 text-amber-600 dark:text-amber-400">
                                    Sin Estado de Resultados
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Total del grupo y, en capital, el gran total */}
                      {[{ key: g.totalKey, label: g.total }, g.grandTotal].filter(Boolean).map((t) => (
                        <tr
                          key={t.key}
                          className={`bg-accent/5 border-b border-card-border/50 ${STRONG_TOTALS.has(t.key) ? "font-subtitle" : ""}`}
                        >
                          <td className="p-2">{t.label}</td>
                          {years.map((y) => {
                            const v = totals[y.id]?.[t.key] ?? 0;
                            return (
                              <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                                <span className={`block ${v < 0 ? "text-red-500" : ""}`}>{fmtMiles.format(v)}</span>
                                <PctLine value={totals[y.id]?.pct?.[t.key]} className="font-normal" />
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
                      const ok = Math.abs(d) <= TOLERANCE;
                      return (
                        <td key={y.id} className={`p-2 pt-4 text-right whitespace-nowrap ${ok ? "text-green-600 dark:text-green-500" : "text-red-500"}`}>
                          {ok ? "✓ 0" : fmtMiles.format(d)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-muted px-2 pt-3">
                Los porcentajes son sobre el total activo del mismo periodo.
              </p>
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
