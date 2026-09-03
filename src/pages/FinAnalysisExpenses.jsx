import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { ArrowLeft, Receipt, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  EXPENSE_CONCEPTS,
  EXPENSES_SECTION,
  SALES_SECTION,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
  sumValues,
} from "@/config/finConfig";

// Gastos de operación por año, con el catálogo sugerido por el modelo.
// El total y el % gastos/ventas se calculan solos.

export default function FinAnalysisExpenses() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [totalSales, setTotalSales] = useState({}); // { [yearId]: total }
  const [values, setValues] = useState({}); // { [conceptKey]: { [yearId]: "" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, ls, stored] = await Promise.all([
        FinYear.list(a.id),
        FinLine.list(a.id),
        FinValue.getSections(a.id, [EXPENSES_SECTION, SALES_SECTION]),
      ]);
      const section = stored[EXPENSES_SECTION] || {};
      const map = {};
      EXPENSE_CONCEPTS.forEach((c) => {
        map[c.key] = {};
        ys.forEach((y) => {
          const v = section[c.key]?.[y.id];
          map[c.key][y.id] = v == null ? "" : String(v);
        });
      });
      const sales = stored[SALES_SECTION] || {};
      const byYear = {};
      ys.forEach((y) => {
        byYear[y.id] = sumValues(ls.map((l) => sales[l.id]?.[y.id]));
      });
      setAnalysis(a);
      setYears(ys);
      setTotalSales(byYear);
      setValues(map);
    } catch (err) {
      console.error("Error al cargar los gastos:", err);
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
      Object.entries(values).forEach(([conceptKey, byYear]) => {
        Object.entries(byYear).forEach(([yearId, amount]) => {
          rows.push({
            year_id: yearId,
            section: EXPENSES_SECTION,
            concept_key: conceptKey,
            amount: toNumber(amount),
          });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (conceptKey, yearId, value) => {
    setValues((prev) => ({
      ...prev,
      [conceptKey]: { ...prev[conceptKey], [yearId]: value },
    }));
  };

  const totals = years.map((y) =>
    sumValues(EXPENSE_CONCEPTS.map((c) => values[c.key]?.[y.id]))
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

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
            <Receipt className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Gastos de operación</h1>
            <p className="text-muted">Lo que gastas para operar el negocio, en miles.</p>
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
            Captura el gasto real de cada concepto por año. Se sugiere respetar esta
            agrupación para poder comparar entre años; si un concepto no aplica,
            déjalo en blanco. Abajo verás el total y qué porcentaje de tus ventas se
            va en gastos de operación.
          </p>
        </CardContent>
      </Card>

      {years.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              Primero define los años a analizar en Datos generales.
            </p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">
                Ir a Datos generales →
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-4 overflow-x-auto">
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
                {EXPENSE_CONCEPTS.map((c) => (
                  <tr key={c.key} className="border-b border-card-border/50">
                    <td className="p-2 min-w-[200px]">{c.label}</td>
                    {years.map((y) => (
                      <td key={y.id} className="p-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={values[c.key]?.[y.id] ?? ""}
                          onChange={(e) => handleCell(c.key, y.id, e.target.value)}
                          placeholder="0"
                          className="w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="font-subtitle">
                  <td className="p-2">Total gastos de operación</td>
                  {years.map((y, i) => (
                    <td key={y.id} className="p-2 text-right whitespace-nowrap">
                      {fmtMiles.format(totals[i])}
                    </td>
                  ))}
                </tr>
                <tr className="text-xs text-muted">
                  <td className="p-2">Gastos / Ventas</td>
                  {years.map((y, i) => {
                    const ratio = totalSales[y.id] ? totals[i] / totalSales[y.id] : null;
                    return (
                      <td key={y.id} className="p-2 text-right">
                        {ratio == null ? "—" : fmtPct(ratio)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisCosts")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Costo de ventas
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
