import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { ArrowLeft, FileText, Info, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  SALES_SECTION,
  EXPENSES_SECTION,
  INCOME_SECTION,
  INCOME_INPUTS,
  costSection,
  yearLabel,
  annualizeFactor,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeIncome, scaleIncome, pctChange } from "@/config/finCalc";

// Estado de Resultados: ventas, costo y gastos llegan solos desde sus
// pantallas; aquí solo se capturan depreciación, otros conceptos,
// financiamiento e impuestos. Utilidades, EBITDA, márgenes y variaciones
// se calculan en vivo. Los periodos parciales muestran además una columna
// anualizada para poder compararlos.

// Filas de la tabla, en el orden del estado financiero.
const ROWS = [
  { type: "auto", key: "ventas", label: "Ventas o ingresos netos", strong: true },
  { type: "auto", key: "costo", label: "Costo de ventas" },
  { type: "total", key: "utilidadBruta", label: "Utilidad bruta", margin: "Margen bruto" },
  { type: "header", label: "Gastos de operación" },
  { type: "auto", key: "admVentas", label: "Administración y ventas" },
  { type: "input", key: "depreciacion" },
  { type: "input", key: "otros_operacion" },
  { type: "total", key: "resultadoOp", label: "Resultado de operación", margin: "Margen operativo" },
  { type: "total", key: "ebitda", label: "EBITDA", margin: "Margen EBITDA", soft: true },
  { type: "header", label: "Costo integral de financiamiento" },
  { type: "input", key: "productos_financieros" },
  { type: "input", key: "gastos_financieros" },
  { type: "input", key: "utilidad_cambiaria" },
  { type: "input", key: "otros_productos" },
  { type: "total", key: "rai", label: "Resultado antes de impuestos" },
  { type: "header", label: "Impuestos" },
  { type: "input", key: "isr" },
  { type: "input", key: "ptu" },
  { type: "total", key: "utilidadNeta", label: "Utilidad neta", margin: "Margen neto", strong: true },
];

const INPUT_BY_KEY = Object.fromEntries(INCOME_INPUTS.map((i) => [i.key, i]));

export default function FinAnalysisIncome() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [lines, setLines] = useState([]);
  const [sections, setSections] = useState({});
  const [values, setValues] = useState({}); // { [inputKey]: { [yearId]: "" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, ls] = await Promise.all([FinYear.list(a.id), FinLine.list(a.id)]);
      const stored = await FinValue.getSections(a.id, [
        SALES_SECTION,
        EXPENSES_SECTION,
        INCOME_SECTION,
        ...ls.map((l) => costSection(l.id)),
      ]);
      const inc = stored[INCOME_SECTION] || {};
      const map = {};
      INCOME_INPUTS.forEach((i) => {
        map[i.key] = {};
        ys.forEach((y) => {
          const v = inc[i.key]?.[y.id];
          map[i.key][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setLines(ls);
      setSections(stored);
      setValues(map);
    } catch (err) {
      console.error("Error al cargar el estado de resultados:", err);
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
          rows.push({ year_id: yearId, section: INCOME_SECTION, concept_key: key, amount: toNumber(amount) });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (key, yearId, value) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [yearId]: value } }));
  };

  // Cifras calculadas: mezcla lo cargado con lo que se está capturando.
  const computed = useMemo(() => {
    const live = { ...sections, [INCOME_SECTION]: values };
    return computeIncome({ sections: live, years, lines });
  }, [sections, values, years, lines]);

  // Columnas: una por año; los parciales agregan su versión anualizada.
  const cols = useMemo(() => {
    const out = [];
    years.forEach((y) => {
      out.push({ id: y.id, yearId: y.id, label: yearLabel(y), factor: 1, partial: y.months < 12 });
      if (y.months < 12) {
        out.push({ id: `${y.id}:anual`, yearId: y.id, label: `${y.year} anualizado`, factor: annualizeFactor(y), annualized: true });
      }
    });
    return out;
  }, [years]);

  // Valores por columna y referencia "año anterior" para las variaciones
  // (para un parcial se compara su versión anualizada).
  const colValues = useMemo(() => {
    const map = {};
    cols.forEach((c) => {
      map[c.id] = scaleIncome(computed[c.yearId], c.factor);
    });
    return map;
  }, [cols, computed]);

  const prevOf = (colIndex) => {
    const c = cols[colIndex];
    if (c.partial) return null; // el parcial real no se compara
    // Busca la columna comparable anterior: el año previo (anualizado si era parcial).
    for (let i = colIndex - 1; i >= 0; i--) {
      if (cols[i].yearId !== c.yearId && !cols[i].partial) return colValues[cols[i].id];
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  const lastCol = cols.length ? cols[cols.length - 1] : null;
  const last = lastCol ? colValues[lastCol.id] : null;

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
            <FileText className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Estado de Resultados</h1>
            <p className="text-muted">Cuánto ganas realmente después de costos, gastos e impuestos.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Las <strong>ventas, el costo de ventas y los gastos de operación</strong> llegan
            solos desde sus pantallas. Aquí solo capturas depreciación, otros conceptos,
            financiamiento e impuestos (en miles). Los renglones sombreados se calculan
            en vivo; debajo de cada uno verás su margen sobre ventas y la variación
            contra el año anterior.
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
          {/* Lectura rápida del último periodo */}
          {last && last.ventas > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Margen bruto", v: last.utilidadBruta / last.ventas },
                { label: "Margen operativo", v: last.resultadoOp / last.ventas },
                { label: "Margen EBITDA", v: last.ebitda / last.ventas },
                { label: "Margen neto", v: last.utilidadNeta / last.ventas },
              ].map((k) => (
                <div key={k.label} className="glass rounded-2xl p-4">
                  <p className="text-xs text-muted">{k.label} · {lastCol.label}</p>
                  <p className={`text-2xl font-title ${k.v < 0 ? "text-red-500" : ""}`}>{fmtPct(k.v)}</p>
                </div>
              ))}
            </div>
          )}

          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {cols.map((c) => (
                      <th key={c.id} className="text-right p-2 font-subtitle whitespace-nowrap">
                        {c.label}
                        {c.partial && <span className="block text-[10px] font-normal text-muted">parcial</span>}
                        {c.annualized && <span className="block text-[10px] font-normal text-muted">estimado</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, ri) => {
                    if (row.type === "header") {
                      return (
                        <tr key={`h${ri}`}>
                          <td colSpan={cols.length + 1} className="pt-4 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">
                            {row.label}
                          </td>
                        </tr>
                      );
                    }
                    if (row.type === "input") {
                      const def = INPUT_BY_KEY[row.key];
                      return (
                        <tr key={row.key} className="border-b border-card-border/50">
                          <td className="p-2 min-w-[220px]">
                            {def.label}
                            {def.hint && <span className="block text-[11px] text-muted">{def.hint}</span>}
                          </td>
                          {cols.map((c) => (
                            <td key={c.id} className="p-1.5 text-right">
                              {c.annualized ? (
                                <span className="text-muted">
                                  {fmtMiles.format((toNumber(values[row.key]?.[c.yearId]) ?? 0) * c.factor)}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={values[row.key]?.[c.yearId] ?? ""}
                                  onChange={(e) => handleCell(row.key, c.yearId, e.target.value)}
                                  placeholder="0"
                                  className="w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right"
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    }
                    const isTotal = row.type === "total";
                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-card-border/50 ${isTotal && !row.soft ? "bg-accent/5" : ""} ${row.strong ? "font-subtitle" : ""}`}
                      >
                        <td className="p-2">{row.label}</td>
                        {cols.map((c, ci) => {
                          const v = colValues[c.id]?.[row.key] ?? 0;
                          const ventas = colValues[c.id]?.ventas || 0;
                          const prev = prevOf(ci);
                          const delta = prev ? pctChange(v, prev[row.key]) : null;
                          return (
                            <td key={c.id} className="p-2 text-right whitespace-nowrap align-top">
                              <span className={v < 0 ? "text-red-500" : ""}>{fmtMiles.format(v)}</span>
                              {isTotal && (
                                <span className="block text-[11px] text-muted">
                                  {row.margin && ventas ? `${fmtPct(v / ventas)}` : ""}
                                  {row.margin && ventas && delta != null ? " · " : ""}
                                  {delta != null && (
                                    <span className={delta >= 0 ? "text-green-600 dark:text-green-500" : "text-red-500"}>
                                      {delta >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(delta))}
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            EBITDA = Resultado de operación + Depreciación y amortización. Las columnas
            "anualizado" estiman el año completo a partir del periodo parcial.
          </p>
        </>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisExpenses")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Gastos de operación
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisBalance")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Balance General →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
