import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { ArrowLeft, Layers, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  COST_CONCEPTS,
  SALES_SECTION,
  costSection,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
  sumValues,
} from "@/config/finConfig";

// Costo de ventas por línea de negocio: los 5 conceptos del modelo por año.
// El total por línea y el % costo/ventas se calculan solos.

export default function FinAnalysisCosts() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [lines, setLines] = useState([]);
  const [sales, setSales] = useState({}); // { [lineId]: { [yearId]: amount } }
  const [values, setValues] = useState({}); // { [lineId]: { [conceptKey]: { [yearId]: "" } } }
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
        ...ls.map((l) => costSection(l.id)),
      ]);
      const map = {};
      ls.forEach((l) => {
        map[l.id] = {};
        const section = stored[costSection(l.id)] || {};
        COST_CONCEPTS.forEach((c) => {
          map[l.id][c.key] = {};
          ys.forEach((y) => {
            const v = section[c.key]?.[y.id];
            map[l.id][c.key][y.id] = v == null ? "" : String(v);
          });
        });
      });
      setAnalysis(a);
      setYears(ys);
      setLines(ls);
      setSales(stored[SALES_SECTION] || {});
      setValues(map);
    } catch (err) {
      console.error("Error al cargar los costos:", err);
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
      Object.entries(values).forEach(([lineId, byConcept]) => {
        Object.entries(byConcept).forEach(([conceptKey, byYear]) => {
          Object.entries(byYear).forEach(([yearId, amount]) => {
            rows.push({
              year_id: yearId,
              section: costSection(lineId),
              concept_key: conceptKey,
              amount: toNumber(amount),
            });
          });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (lineId, conceptKey, yearId, value) => {
    setValues((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [conceptKey]: { ...prev[lineId]?.[conceptKey], [yearId]: value },
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

  const missingSetup = years.length === 0 || lines.length === 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Layers className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Costo de ventas</h1>
            <p className="text-muted">Lo que te cuesta producir o entregar cada línea, en miles.</p>
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
            Captura por cada línea de negocio los conceptos que componen su costo.
            Si un concepto no aplica, déjalo en blanco. Abajo de cada tabla verás el{" "}
            <strong>costo entre ventas</strong>: qué porcentaje de lo que vendes se
            va en producirlo — entre más bajo, mejor tu margen.
          </p>
        </CardContent>
      </Card>

      {missingSetup ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              {years.length === 0
                ? "Primero define los años a analizar en Datos generales."
                : "Primero crea tus líneas de negocio en la pantalla de Ventas."}
            </p>
            <Link to={createPageUrl(years.length === 0 ? "FinAnalysisData" : "FinAnalysisSales")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">
                {years.length === 0 ? "Ir a Datos generales →" : "Ir a Ventas →"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        lines.map((line) => {
          const totals = years.map((y) =>
            sumValues(COST_CONCEPTS.map((c) => values[line.id]?.[c.key]?.[y.id]))
          );
          return (
            <Card key={line.id} className="glass">
              <CardContent className="p-4 space-y-1">
                <h2 className="font-subtitle text-lg px-2 pt-1">{line.name}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
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
                      {COST_CONCEPTS.map((c) => (
                        <tr key={c.key} className="border-b border-card-border/50">
                          <td className="p-2 min-w-[200px]">{c.label}</td>
                          {years.map((y) => (
                            <td key={y.id} className="p-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={values[line.id]?.[c.key]?.[y.id] ?? ""}
                                onChange={(e) => handleCell(line.id, c.key, y.id, e.target.value)}
                                placeholder="0"
                                className="w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="font-subtitle">
                        <td className="p-2">Total costo de ventas</td>
                        {years.map((y, i) => (
                          <td key={y.id} className="p-2 text-right whitespace-nowrap">
                            {fmtMiles.format(totals[i])}
                          </td>
                        ))}
                      </tr>
                      <tr className="text-xs text-muted">
                        <td className="p-2">Costo / Ventas de la línea</td>
                        {years.map((y, i) => {
                          const lineSales = toNumber(sales[line.id]?.[y.id]);
                          const ratio = lineSales ? totals[i] / lineSales : null;
                          return (
                            <td key={y.id} className="p-2 text-right">
                              {ratio == null ? (
                                "—"
                              ) : (
                                <span
                                  className={
                                    ratio > 1
                                      ? "text-red-500"
                                      : "text-muted"
                                  }
                                >
                                  {fmtPct(ratio)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisSales")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Ventas
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisExpenses")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Gastos de operación →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
