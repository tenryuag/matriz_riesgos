import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, ArrowLeftRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  CASHFLOW_DIRECT_SECTION,
  DIRECT_GROUPS,
  DIRECT_INITIAL_KEY,
  ALL_DIRECT_KEYS,
  yearLabel,
  fmtMiles,
  toNumber,
} from "@/config/finConfig";
import { computeDirectCashflow } from "@/config/finCalc";

// Flujo de efectivo directo: entradas y salidas reales de caja por
// operación, inversión y financiamiento. Totales y acumulado en vivo.

const Amount = ({ v, strong }) => (
  <span className={`${v < 0 ? "text-red-500" : ""} ${strong ? "font-subtitle" : ""}`}>
    {fmtMiles.format(v ?? 0)}
  </span>
);

export default function FinAnalysisCashflowDirect() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [values, setValues] = useState({}); // { [key]: { [yearId]: "" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, stored] = await Promise.all([
        FinYear.list(a.id),
        FinValue.getSections(a.id, [CASHFLOW_DIRECT_SECTION]),
      ]);
      const sec = stored[CASHFLOW_DIRECT_SECTION] || {};
      const map = {};
      ALL_DIRECT_KEYS.forEach((k) => {
        map[k] = {};
        ys.forEach((y) => {
          const v = sec[k]?.[y.id];
          map[k][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setValues(map);
    } catch (err) {
      console.error("Error al cargar el flujo directo:", err);
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
          rows.push({ year_id: yearId, section: CASHFLOW_DIRECT_SECTION, concept_key: key, amount: toNumber(amount) });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (key, yearId, value) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [yearId]: value } }));
  };

  const flows = useMemo(
    () => computeDirectCashflow({ sections: { [CASHFLOW_DIRECT_SECTION]: values }, years }),
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

  const cellCls = "p-2 text-right whitespace-nowrap";
  const inputCls = "w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right";

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
            <ArrowLeftRight className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Flujo de efectivo directo</h1>
            <p className="text-muted">Lo que realmente entró y salió de caja y bancos.</p>
          </div>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Registra los <strong>movimientos reales de efectivo</strong> de cada año (en miles),
            con respaldo en los movimientos de bancos y caja. No confundas utilidad contable con
            efectivo: aquí solo cuenta lo cobrado y lo pagado. Captura el saldo inicial del primer
            año; en los siguientes se toma solo del acumulado anterior.
          </p>
        </CardContent>
      </Card>

      {years.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">Primero define los años a analizar en Datos generales.</p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">Ir a Datos generales →</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left p-2 font-subtitle">Concepto</th>
                  {years.map((y) => (
                    <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">{yearLabel(y)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Saldo inicial */}
                <tr className="border-b border-card-border/50">
                  <td className="p-2 min-w-[240px]">
                    Saldo inicial
                    <span className="block text-[11px] text-muted">Lo que había en caja al cerrar el periodo anterior</span>
                  </td>
                  {years.map((y, i) => (
                    <td key={y.id} className="p-1.5 text-right">
                      {i === 0 ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={values[DIRECT_INITIAL_KEY]?.[y.id] ?? ""}
                          onChange={(e) => handleCell(DIRECT_INITIAL_KEY, y.id, e.target.value)}
                          placeholder="0"
                          className={inputCls}
                        />
                      ) : (
                        <span className="text-muted"><Amount v={flows[y.id]?.saldoInicial} /></span>
                      )}
                    </td>
                  ))}
                </tr>

                {DIRECT_GROUPS.map((g) => (
                  <React.Fragment key={g.key}>
                    <tr>
                      <td colSpan={years.length + 1} className="pt-4 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">
                        {g.title}
                        {g.hint && <span className="normal-case tracking-normal font-normal ml-2">· {g.hint}</span>}
                      </td>
                    </tr>
                    {g.items.map((it) => (
                      <tr key={it.key} className="border-b border-card-border/50">
                        <td className="p-2">{it.label}</td>
                        {years.map((y) => (
                          <td key={y.id} className="p-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={values[it.key]?.[y.id] ?? ""}
                              onChange={(e) => handleCell(it.key, y.id, e.target.value)}
                              placeholder="0"
                              className={inputCls}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                      <td className="p-2">{g.total}</td>
                      {years.map((y) => (
                        <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.groups[g.key]} strong /></td>
                      ))}
                    </tr>
                    {g.key === "salidas" && (
                      <tr className="bg-accent/10 border-b border-card-border font-subtitle">
                        <td className="p-2">Flujo de operación (entradas − salidas)</td>
                        {years.map((y) => (
                          <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.flujoOperacion} strong /></td>
                        ))}
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                <tr className="bg-accent/10 border-b border-card-border font-subtitle">
                  <td className="p-2 pt-4">Flujo neto del periodo</td>
                  {years.map((y) => (
                    <td key={y.id} className={`${cellCls} pt-4`}><Amount v={flows[y.id]?.flujoNeto} strong /></td>
                  ))}
                </tr>
                <tr className="font-subtitle">
                  <td className="p-2">Flujo neto acumulado (saldo final)</td>
                  {years.map((y) => (
                    <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.acumulado} strong /></td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}

      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisCashflow")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Estado de cambios
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
