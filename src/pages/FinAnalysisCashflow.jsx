import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { ArrowLeft, Waves, Sparkles, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  SALES_SECTION,
  EXPENSES_SECTION,
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_ANNEX_SECTION,
  ANNEX_GROUPS,
  ALL_ANNEX_KEYS,
  costSection,
  yearLabel,
  fmtMiles,
  toNumber,
} from "@/config/finConfig";
import { computeCashflow, WORKING_CAPITAL } from "@/config/finCalc";

// Estado de cambios en la situación financiera (método indirecto).
// Se calcula solo del Estado de Resultados y del Balance; únicamente se
// captura el anexo de movimientos reales de inversión y financiamiento.

const Amount = ({ v, strong }) => (
  <span className={`${v < 0 ? "text-red-500" : ""} ${strong ? "font-subtitle" : ""}`}>
    {fmtMiles.format(v ?? 0)}
  </span>
);

export default function FinAnalysisCashflow() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [lines, setLines] = useState([]);
  const [sections, setSections] = useState({});
  const [values, setValues] = useState({}); // anexo: { [key]: { [yearId]: "" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, ls] = await Promise.all([FinYear.list(a.id), FinLine.list(a.id)]);
      const stored = await FinValue.getSections(a.id, [
        SALES_SECTION, EXPENSES_SECTION, INCOME_SECTION, BALANCE_SECTION, CASHFLOW_ANNEX_SECTION,
        ...ls.map((l) => costSection(l.id)),
      ]);
      const annex = stored[CASHFLOW_ANNEX_SECTION] || {};
      const map = {};
      ALL_ANNEX_KEYS.forEach((k) => {
        map[k] = {};
        ys.forEach((y) => {
          const v = annex[k]?.[y.id];
          map[k][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setLines(ls);
      setSections(stored);
      setValues(map);
    } catch (err) {
      console.error("Error al cargar el estado de cambios:", err);
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
          rows.push({ year_id: yearId, section: CASHFLOW_ANNEX_SECTION, concept_key: key, amount: toNumber(amount) });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (key, yearId, value) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [yearId]: value } }));
  };

  const flows = useMemo(
    () => computeCashflow({ sections: { ...sections, [CASHFLOW_ANNEX_SECTION]: values }, years, lines }),
    [sections, values, years, lines]
  );

  // Solo los años con año anterior tienen flujo.
  const flowYears = years.slice(1);

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
            <Waves className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Estado de cambios</h1>
            <p className="text-muted">De dónde salió y a dónde se fue el efectivo cada año.</p>
          </div>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Esta pantalla <strong>se calcula sola</strong> a partir del Estado de Resultados y
            del Balance (método indirecto): la utilidad, las partidas que no son efectivo y
            los cambios en el capital de trabajo. Tú solo capturas el <strong>anexo</strong>
            de abajo con los movimientos reales de inversión y financiamiento, en positivo —
            la app ya sabe cuáles entran y cuáles salen. Necesita al menos dos años.
          </p>
        </CardContent>
      </Card>

      {years.length < 2 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              El flujo compara un año contra el anterior. Define al menos dos años en Datos generales.
            </p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">Ir a Datos generales →</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Anexo (captura) */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <h2 className="font-subtitle text-lg px-2 pt-1 mb-1">Anexo: movimientos reales de efectivo</h2>
              <p className="text-xs text-muted px-2 mb-2">Captura montos en positivo. Lo que no aplique, déjalo en blanco.</p>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {flowYears.map((y) => (
                      <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">{yearLabel(y)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ANNEX_GROUPS.map((g) => (
                    <React.Fragment key={g.key}>
                      <tr>
                        <td colSpan={flowYears.length + 1} className="pt-3 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">{g.title}</td>
                      </tr>
                      {g.items.map((it) => (
                        <tr key={it.key} className="border-b border-card-border/50">
                          <td className="p-2 min-w-[240px]">
                            {it.label}
                            <span className={`ml-2 text-[10px] font-subtitle ${it.sign > 0 ? "text-green-600 dark:text-green-500" : "text-red-500"}`}>
                              {it.sign > 0 ? "entra" : "sale"}
                            </span>
                          </td>
                          {flowYears.map((y) => (
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
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Conciliación del anexo */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <h2 className="font-subtitle text-lg px-2 pt-1 mb-1">Conciliación con el Balance</h2>
              <p className="text-xs text-muted px-2 mb-2">
                Compara lo capturado contra la variación del Balance. Una diferencia distinta de cero
                señala partidas no monetarias (revaluaciones, utilidad en venta de activos) que conviene revisar.
              </p>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {flowYears.map((y) => (
                      <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">{yearLabel(y)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2].map((ri) => (
                    <React.Fragment key={ri}>
                      <tr className="border-b border-card-border/50">
                        <td className="p-2">{flows[flowYears[0].id]?.reconciliation[ri].label} · capturado</td>
                        {flowYears.map((y) => (
                          <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.reconciliation[ri].captured} /></td>
                        ))}
                      </tr>
                      <tr className="border-b border-card-border/50 text-muted">
                        <td className="p-2 pl-6 text-xs">{flows[flowYears[0].id]?.reconciliation[ri].balanceLabel}</td>
                        {flowYears.map((y) => (
                          <td key={y.id} className={`${cellCls} text-xs`}>{fmtMiles.format(flows[y.id]?.reconciliation[ri].balance ?? 0)}</td>
                        ))}
                      </tr>
                      <tr className="border-b border-card-border">
                        <td className="p-2 pl-6 text-xs font-subtitle">Diferencia a revisar</td>
                        {flowYears.map((y) => {
                          const r = flows[y.id]?.reconciliation[ri];
                          const diff = (r?.captured ?? 0) - (r?.balance ?? 0);
                          const ok = Math.abs(diff) <= 0.5;
                          return (
                            <td key={y.id} className={`${cellCls} text-xs font-subtitle ${ok ? "text-green-600 dark:text-green-500" : "text-amber-600 dark:text-amber-400"}`}>
                              {ok ? "✓ 0" : fmtMiles.format(diff)}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Estado de cambios (calculado) */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <h2 className="font-subtitle text-lg px-2 pt-1 mb-2">Estado de cambios en la situación financiera</h2>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {flowYears.map((y) => (
                      <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">{yearLabel(y)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={flowYears.length + 1} className="pt-3 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">Actividades de operación</td></tr>
                  {[
                    { k: "utilidadNeta", label: "Utilidad neta" },
                    { k: "depreciacion", label: "(+) Depreciación y amortización" },
                    { k: "provisiones", label: "(±) Variación en provisiones de largo plazo" },
                    { k: "impuestoDiferido", label: "(±) Variación en impuesto diferido (neto)" },
                  ].map((r) => (
                    <tr key={r.k} className="border-b border-card-border/50">
                      <td className="p-2">{r.label}</td>
                      {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.[r.k]} /></td>)}
                    </tr>
                  ))}
                  <tr><td colSpan={flowYears.length + 1} className="pt-2 pb-1 px-2 text-xs text-muted italic">Variación en capital de trabajo</td></tr>
                  {WORKING_CAPITAL.map((w) => (
                    <tr key={w.key} className="border-b border-card-border/50">
                      <td className="p-2 pl-6 text-xs">
                        {w.kind === "asset" ? "(Aumento) disminución en " : "Aumento (disminución) en "}{w.label}
                      </td>
                      {flowYears.map((y) => <td key={y.id} className={`${cellCls} text-xs`}><Amount v={flows[y.id]?.workingCapital[w.key]} /></td>)}
                    </tr>
                  ))}
                  <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                    <td className="p-2">Flujo neto de operación</td>
                    {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.flujoOperacion} strong /></td>)}
                  </tr>

                  <tr><td colSpan={flowYears.length + 1} className="pt-3 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">Actividades de inversión</td></tr>
                  {ANNEX_GROUPS[0].items.map((it) => (
                    <tr key={it.key} className="border-b border-card-border/50">
                      <td className="p-2 pl-6 text-xs">{it.label}</td>
                      {flowYears.map((y) => <td key={y.id} className={`${cellCls} text-xs`}><Amount v={flows[y.id]?.signed[it.key]} /></td>)}
                    </tr>
                  ))}
                  <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                    <td className="p-2">Flujo neto de inversión</td>
                    {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.flujoInversion} strong /></td>)}
                  </tr>

                  <tr><td colSpan={flowYears.length + 1} className="pt-3 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">Actividades de financiamiento</td></tr>
                  {ANNEX_GROUPS[1].items.map((it) => (
                    <tr key={it.key} className="border-b border-card-border/50">
                      <td className="p-2 pl-6 text-xs">{it.label}</td>
                      {flowYears.map((y) => <td key={y.id} className={`${cellCls} text-xs`}><Amount v={flows[y.id]?.signed[it.key]} /></td>)}
                    </tr>
                  ))}
                  <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                    <td className="p-2">Flujo neto de financiamiento</td>
                    {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.flujoFinanciamiento} strong /></td>)}
                  </tr>

                  <tr className="bg-accent/10 border-b border-card-border font-subtitle">
                    <td className="p-2 pt-4">Flujo neto de efectivo del periodo</td>
                    {flowYears.map((y) => <td key={y.id} className={`${cellCls} pt-4`}><Amount v={flows[y.id]?.flujoNeto} strong /></td>)}
                  </tr>
                  <tr className="border-b border-card-border/50">
                    <td className="p-2">(+) Caja inicial (según Balance del año anterior)</td>
                    {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.cajaInicial} /></td>)}
                  </tr>
                  <tr className="border-b border-card-border/50 font-subtitle">
                    <td className="p-2">(=) Caja final calculada</td>
                    {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.cajaFinalCalculada} strong /></td>)}
                  </tr>
                  <tr className="border-b border-card-border/50">
                    <td className="p-2">Caja final según Balance</td>
                    {flowYears.map((y) => <td key={y.id} className={cellCls}><Amount v={flows[y.id]?.cajaFinalBalance} /></td>)}
                  </tr>
                  <tr className="font-subtitle">
                    <td className="p-2">Diferencia (debe ser cero)</td>
                    {flowYears.map((y) => {
                      const d = flows[y.id]?.diferencia ?? 0;
                      const ok = Math.abs(d) <= 0.5;
                      return (
                        <td key={y.id} className={`${cellCls} ${ok ? "text-green-600 dark:text-green-500" : "text-red-500"}`}>
                          {ok ? "✓ 0" : fmtMiles.format(d)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Si la diferencia no es cero, normalmente falta capturar en el anexo algún movimiento real
            (compras de activo, deuda, dividendos) o hay cambios en el Balance que no fueron en efectivo.
          </p>
        </>
      )}

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}

      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisBalance")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Balance General
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisCashflowDirect")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Flujo de efectivo directo →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
