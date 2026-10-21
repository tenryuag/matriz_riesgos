import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, Waves, Sparkles, Info, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  CASHFLOW_INPUTS,
  ALL_CASHFLOW_KEYS,
  INCOME_MEMO,
  yearLabel,
  fmtMiles,
  toNumber,
} from "@/config/finConfig";
import { computeIncome, computeBalance, computeCashflow } from "@/config/finCalc";

// Estado de cambios en la situación financiera "(+) fuentes (−) aplicaciones",
// réplica de la hoja "Conciliaciones" del Excel MP-AFH1. Se calcula del
// Estado de Resultados y del Balance de cada año contra el anterior; solo se
// capturan cinco datos complementarios (venta de activo fijo, efectos
// cambiarios que no fueron efectivo y ajuste por revaluación). Las partidas
// que no son efectivo (depreciación y reservas) se leen del Estado de
// Resultados, donde se capturan una sola vez.

// Diferencias menores a medio millar se consideran cero (las cifras van en miles).
const isZero = (v) => Math.abs(v ?? 0) <= 0.5;

// ¿Hay algún valor capturado en la sección para ese año?
const hasAny = (section, yearId) =>
  Object.values(section || {}).some((byYear) => toNumber(byYear?.[yearId]) != null);

// Filas del estado en el orden de la hoja "Conciliaciones". `kind`:
// section (encabezado de bloque), line (renglón), detail (desglose con
// sangría de la fila que lo precede: sus importes SUMAN esa fila),
// subtotal, total (resaltado) y grand (flujo del periodo). `get` lee el
// valor del resultado de computeCashflow de un año. `toggle` marca la fila
// cuyo detalle se pliega (CAPEX) y `capexDetail` las filas que pliega.
const ROWS = [
  { id: "resultadoOp", kind: "line", label: "Resultado operativo", get: (f) => f.resultadoOp },
  { id: "depAmort", kind: "subtotal", label: "(+) Depreciación y amortización", get: (f) => f.depAmort },
  { id: "depreciacion", kind: "detail", label: "Depreciación (del Estado de Resultados)", get: (f) => f.depreciacion },
  { id: "amortDiferidos", kind: "detail", label: "Amortización de activos diferidos", get: (f) => f.amortActivosDiferidos },
  { id: "credDiferidos", kind: "detail", label: "Creación de créditos diferidos", get: (f) => f.creacionCreditosDiferidos },
  { id: "reservas", kind: "subtotal", label: "(±) Reservas de cartera e inventarios", get: (f) => f.reservas },
  { id: "reservaCxc", kind: "detail", label: "Reserva de cuentas por cobrar", get: (f) => f.reservaCxc },
  { id: "reservaInv", kind: "detail", label: "Reserva de inventarios", get: (f) => f.reservaInventarios },
  { id: "ebitda", kind: "total", label: "UAFIRDA / EBITDA", get: (f) => f.ebitda },

  { id: "secWc", kind: "section", label: "Capital de trabajo" },
  { id: "wcClientes", kind: "line", label: "Clientes", get: (f) => f.workingCapital.clientes },
  { id: "wcInventarios", kind: "line", label: "Inventarios", get: (f) => f.workingCapital.inventarios },
  { id: "wcProveedores", kind: "line", label: "Proveedores", get: (f) => f.workingCapital.proveedores },
  { id: "wcPagosAnt", kind: "line", label: "Pagos anticipados", get: (f) => f.workingCapital.pagosAnticipados },
  { id: "wcCxcRel", kind: "line", label: "Cuentas por cobrar a compañías relacionadas", get: (f) => f.workingCapital.cxcRelacionadas },
  { id: "wcCxpRel", kind: "line", label: "Cuentas por pagar a compañías relacionadas", get: (f) => f.workingCapital.cxpRelacionadas },
  { id: "wcAnticipos", kind: "line", label: "Anticipos de clientes", get: (f) => f.workingCapital.anticipos },
  { id: "wcGastosAcum", kind: "line", label: "Gastos acumulados", get: (f) => f.workingCapital.gastosAcumulados },
  { id: "wcTotal", kind: "subtotal", label: "Inversión neta en capital de trabajo", get: (f) => f.wcTotal },
  { id: "flujoOperacion", kind: "total", label: "Flujo de operación", get: (f) => f.flujoOperacion },

  { id: "impuestos", kind: "subtotal", label: "Impuestos causados", get: (f) => f.impuestos },
  { id: "impRecuperar", kind: "detail", label: "(Aumento) disminución en impuestos por recuperar", get: (f) => f.impRecuperar },
  { id: "impPagar", kind: "detail", label: "Aumento (disminución) en impuestos por pagar", get: (f) => f.impPagar },
  { id: "isrPtu", kind: "detail", label: "(−) ISR y PTU del Estado de Resultados", get: (f) => f.isrPtu },
  { id: "flujoOpNeto", kind: "total", label: "Flujo operativo neto de impuestos", get: (f) => f.flujoOperativoNetoImpuestos },

  { id: "cif", kind: "subtotal", label: "Costo integral de financiamiento pagado", get: (f) => f.cif },
  { id: "gastoFinNeto", kind: "detail", label: "Gasto financiero neto (productos − gastos financieros)", get: (f) => f.gastoFinNeto },
  { id: "cambiario", kind: "detail", label: "Resultado cambiario devengado", get: (f) => f.cambiarioDevengado },
  { id: "fxDeudaCP", kind: "detail", label: "(−) Utilidad (pérdida) cambiaria en deuda bancaria a corto plazo", get: (f) => -f.fxDeudaCP },
  { id: "fxDeudaLP", kind: "detail", label: "(−) Utilidad (pérdida) cambiaria en deuda bancaria a largo plazo", get: (f) => -f.fxDeudaLP },
  { id: "fxClientes", kind: "detail", label: "(−) Utilidad (pérdida) cambiaria en clientes", get: (f) => -f.fxClientes },
  { id: "efectivoOperacion", kind: "total", label: "Efectivo generado por la operación", get: (f) => f.efectivoOperacion },

  { id: "secInv", kind: "section", label: "Inversión" },
  { id: "capex", kind: "line", label: "Adquisición de activo fijo (CAPEX)", get: (f) => f.capex, toggle: true },
  { id: "capexInicial", kind: "detail", capexDetail: true, label: "(+) Activo fijo inicial", get: (f) => f.capexDetalle.activoFijoInicial },
  { id: "capexDep", kind: "detail", capexDetail: true, label: "(−) Depreciación", get: (f) => -f.capexDetalle.depreciacion },
  { id: "capexVenta", kind: "detail", capexDetail: true, label: "(−) Venta de activo fijo", get: (f) => -f.capexDetalle.ventaActivoFijo },
  { id: "capexAjuste", kind: "detail", capexDetail: true, label: "(+) Ajuste por revaluación capitalizada", get: (f) => f.capexDetalle.ajusteRevaluacion },
  { id: "capexRev", kind: "detail", capexDetail: true, label: "(+) Variación de la revaluación de activos en el capital", get: (f) => f.capexDetalle.variacionRevaluacion },
  { id: "capexFinal", kind: "detail", capexDetail: true, label: "(−) Activo fijo final", get: (f) => -f.capexDetalle.activoFijoFinal },
  { id: "otrosActivos", kind: "line", label: "Compra de otros activos / inversiones", get: (f) => f.otrosActivos },
  { id: "flujoInversion", kind: "subtotal", label: "Flujo generado por actividades de inversión", get: (f) => f.flujoInversion },
  { id: "flujoNetoInversion", kind: "total", label: "Flujo de efectivo neto de inversión", get: (f) => f.flujoNetoInversion },

  { id: "secFin", kind: "section", label: "Financiamiento externo" },
  { id: "finPorcion", kind: "line", label: "Porción circulante de la deuda de largo plazo", get: (f) => f.financing.porcionCirculante },
  { id: "finDeudaCP", kind: "line", label: "Deuda bancaria a corto plazo", get: (f) => f.financing.deudaCP },
  { id: "finDeudaLP", kind: "line", label: "Deuda bancaria a largo plazo", get: (f) => f.financing.deudaLP },
  { id: "finOtrosCirc", kind: "line", label: "Otros activos circulantes", get: (f) => f.financing.otrosCirculantes },
  { id: "finOtrasCxc", kind: "line", label: "Otras cuentas por cobrar", get: (f) => f.financing.otrasCxc },
  { id: "finOtrasCxp", kind: "line", label: "Otras cuentas por pagar", get: (f) => f.financing.otrasCxp },
  { id: "finAcreedores", kind: "line", label: "Acreedores diversos", get: (f) => f.financing.acreedores },
  { id: "finOtrosIng", kind: "line", label: "Otros ingresos", get: (f) => f.financing.otrosIngresos },
  { id: "finCargosDif", kind: "line", label: "Cargos diferidos", get: (f) => f.financing.cargosDiferidos },
  { id: "finCreditosDif", kind: "line", label: "Créditos diferidos", get: (f) => f.financing.creditosDiferidos },
  { id: "flujoFinExterno", kind: "subtotal", label: "Flujo generado por financiamiento externo", get: (f) => f.flujoFinExterno },

  { id: "secAcc", kind: "section", label: "Accionistas" },
  { id: "aportaciones", kind: "line", label: "Aportaciones de capital en efectivo", get: (f) => f.aportaciones },
  { id: "dividendos", kind: "line", label: "Dividendos pagados en efectivo", get: (f) => f.dividendos },
  { id: "accionistas", kind: "subtotal", label: "Aportaciones (retiros) de los accionistas", get: (f) => f.accionistas },
  { id: "flujoFinanciamiento", kind: "total", label: "Flujo generado por actividades de financiamiento", get: (f) => f.flujoFinanciamiento },

  { id: "flujoPeriodo", kind: "grand", label: "Flujo de efectivo del periodo", get: (f) => f.flujoPeriodo },
  { id: "cajaInicial", kind: "line", label: "(+) Caja inicial (efectivo del Balance del año anterior)", get: (f) => f.cajaInicial },
  { id: "cajaFinal", kind: "subtotal", label: "(=) Caja final", get: (f) => f.cajaFinal },
  { id: "cajaBalance", kind: "line", label: "Caja final según Balance General (verificación)", get: (f) => f.cajaBalance },
];

// Clases de cada tipo de fila (etiqueta y celdas de cifras).
const ROW_STYLE = {
  line: { tr: "border-b border-card-border/50", td: "p-2", cell: "" },
  detail: { tr: "border-b border-card-border/50 text-muted", td: "p-2 pl-8 text-xs", cell: "text-xs" },
  subtotal: { tr: "border-b border-card-border/50 font-subtitle", td: "p-2", cell: "" },
  total: { tr: "bg-accent/5 border-b border-card-border/50 font-subtitle", td: "p-2", cell: "" },
  grand: { tr: "bg-accent/10 border-b border-card-border font-subtitle", td: "p-2 pt-4", cell: "pt-4" },
};

const CELL = "p-2 text-right whitespace-nowrap tabular-nums";

// Evita que un cero calculado se muestre como "-0": el cero negativo (sale de
// negar un cero, p. ej. `-f.fxClientes` sin captura o `-max(x, 0)`) y los
// restos menores a medio decimal, que fmtMiles redondea a cero, se muestran
// como 0. Mismo criterio que `clean` en el Estado de Resultados.
const clean = (v) => (Number.isFinite(v) && Math.abs(v) >= 0.05 ? v : 0);

// Cifra en miles. Aquí un negativo es una aplicación de efectivo, no una
// alarma, así que no se pinta de rojo (la nota del pie lo explica).
function Amount({ v, strong = false }) {
  return <span className={strong ? "font-subtitle" : ""}>{fmtMiles.format(clean(v))}</span>;
}
Amount.propTypes = { v: PropTypes.number, strong: PropTypes.bool };

// Encabezado de columna: el periodo y contra cuál se compara.
function YearHead({ year, prev }) {
  return (
    <th className="text-right p-2 font-subtitle whitespace-nowrap align-bottom">
      <div>{yearLabel(year)}{year.months < 12 ? " parcial" : ""}</div>
      {prev && <div className="text-[10px] text-muted font-normal">vs {yearLabel(prev)}</div>}
    </th>
  );
}
const yearShape = PropTypes.shape({ id: PropTypes.string.isRequired, year: PropTypes.number, months: PropTypes.number });
YearHead.propTypes = { year: yearShape.isRequired, prev: yearShape };

export default function FinAnalysisCashflow() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [sections, setSections] = useState({}); // income y balance tal como están guardados
  const [values, setValues] = useState({}); // capturas de cashflow: { [key]: { [yearId]: "" } }
  const [showCapex, setShowCapex] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const ys = await FinYear.list(a.id);
      const stored = await FinValue.getSections(a.id, [INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION]);
      const cf = stored[CASHFLOW_SECTION] || {};
      // Solo se captura en los años que tienen año anterior.
      const map = {};
      ALL_CASHFLOW_KEYS.forEach((k) => {
        map[k] = {};
        ys.slice(1).forEach((y) => {
          const v = cf[k]?.[y.id];
          map[k][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
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
          rows.push({ year_id: yearId, section: CASHFLOW_SECTION, concept_key: key, amount: toNumber(amount) });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (key, yearId, value) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [yearId]: value } }));
  };

  // Cálculo en vivo: las capturas de esta pantalla entran como sección cashflow.
  const income = useMemo(() => computeIncome({ sections, years }), [sections, years]);
  const balances = useMemo(() => computeBalance({ sections, years }), [sections, years]);
  const flows = useMemo(
    () => computeCashflow({ sections: { ...sections, [CASHFLOW_SECTION]: values }, years }),
    [sections, values, years]
  );

  // Solo los años con año anterior tienen estado de cambios.
  const flowYears = years.slice(1);
  const prevOf = (y) => years[years.indexOf(y) - 1];

  // Años sin Estado de Resultados o sin Balance: el estado se calcula con ceros.
  const missing = useMemo(
    () =>
      years
        .filter((y) => !hasAny(sections[INCOME_SECTION], y.id) || !hasAny(sections[BALANCE_SECTION], y.id))
        .map((y) => yearLabel(y)),
    [years, sections]
  );

  // Si la caja no cuadra, casi siempre es porque el Balance de ese año o del
  // anterior no cuadra (Activo ≠ Pasivo + Capital): se señala cuál.
  const unbalancedFor = (y) =>
    [prevOf(y), y].filter((yy) => yy && !isZero(balances[yy.id]?.diferencia)).map((yy) => yearLabel(yy));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  const inputCls =
    "w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right";

  const visibleRows = ROWS.filter((r) => !r.capexDetail || showCapex);

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
            <p className="text-muted">De dónde salió y a dónde se fue el efectivo en cada periodo.</p>
          </div>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Esta pantalla <strong>se calcula sola</strong> comparando cada periodo con el anterior: parte del
            resultado de operación, suma lo que no fue efectivo y recoge los cambios del Balance. Tú solo capturas
            los <strong>cinco datos complementarios</strong> de abajo cuando apliquen (venta de activo fijo, efectos
            cambiarios que no fueron efectivo y ajuste por revaluación). Las cifras positivas son{" "}
            <strong>fuentes</strong> de efectivo y las negativas <strong>aplicaciones</strong>. Necesita al menos dos periodos.
          </p>
        </CardContent>
      </Card>

      {years.length < 2 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              El estado de cambios compara un periodo contra el anterior. Define al menos dos años en Datos generales.
            </p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">Ir a Datos generales →</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {missing.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Falta el Estado de Resultados o el Balance de {missing.join(", ")}: mientras tanto el estado se calcula con ceros en ese periodo.
              </span>
            </div>
          )}

          {/* Capturas complementarias */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <h2 className="font-subtitle text-lg px-2 pt-1 mb-1">Datos complementarios</h2>
              <p className="text-xs text-muted px-2 mb-2">
                Movimientos que el Balance no deja ver por sí solo. Lo que no aplique, déjalo en blanco.
              </p>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {flowYears.map((y) => <YearHead key={y.id} year={y} prev={prevOf(y)} />)}
                  </tr>
                </thead>
                <tbody>
                  {CASHFLOW_INPUTS.map((it) => (
                    <tr key={it.key} className="border-b border-card-border/50">
                      <td className="p-2 min-w-[260px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{it.label}</span>
                          <span
                            className={`text-[10px] font-subtitle px-1.5 py-0.5 rounded-full glass whitespace-nowrap ${
                              it.signed ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-500"
                            }`}
                          >
                            {it.signed ? "± con signo" : "+ en positivo"}
                          </span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">{it.hint}</div>
                      </td>
                      {flowYears.map((y) => (
                        <td key={y.id} className="p-1.5 align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={values[it.key]?.[y.id] ?? ""}
                            onChange={(e) => handleCell(it.key, y.id, e.target.value)}
                            placeholder="0"
                            aria-label={`${it.label}, ${yearLabel(y)}`}
                            className={inputCls}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Partidas que no son efectivo (solo lectura) */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <div className="flex items-start justify-between gap-3 flex-wrap px-2 pt-1 mb-1">
                <h2 className="font-subtitle text-lg">Partidas que no son efectivo</h2>
                <Link to={createPageUrl("FinAnalysisIncome")} className="text-xs text-accent hover:underline font-subtitle whitespace-nowrap">
                  Se capturan en el Estado de Resultados →
                </Link>
              </div>
              <p className="text-xs text-muted px-2 mb-2">
                Depreciación y reservas del periodo. Se leen del Estado de Resultados y aquí se suman al resultado
                operativo para llegar al EBITDA.
              </p>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {flowYears.map((y) => <YearHead key={y.id} year={y} />)}
                  </tr>
                </thead>
                <tbody>
                  {INCOME_MEMO.map((m) => (
                    <tr key={m.key} className="border-b border-card-border/50">
                      <td className="p-2">{m.label}</td>
                      {flowYears.map((y) => (
                        <td key={y.id} className={`${CELL} text-muted`}>
                          <Amount v={income[y.id]?.[m.calc]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Estado de cambios (calculado) */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <div className="flex items-baseline justify-between gap-3 flex-wrap px-2 pt-1 mb-1">
                <h2 className="font-subtitle text-lg">Estado de cambios en la situación financiera</h2>
                <span className="text-xs text-muted whitespace-nowrap">(+) fuentes (−) aplicaciones · cifras en miles</span>
              </div>
              <p className="text-xs text-muted px-2 mb-2">
                Las filas con sangría son el detalle de la fila que las precede y suman su importe.
              </p>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {flowYears.map((y) => <YearHead key={y.id} year={y} prev={prevOf(y)} />)}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    if (r.kind === "section") {
                      return (
                        <tr key={r.id}>
                          <td colSpan={flowYears.length + 1} className="pt-4 pb-1 px-2 text-xs font-subtitle uppercase tracking-wide text-muted">
                            {r.label}
                          </td>
                        </tr>
                      );
                    }
                    const s = ROW_STYLE[r.kind];
                    const strong = r.kind === "total" || r.kind === "grand";
                    return (
                      <tr key={r.id} className={s.tr}>
                        <td className={s.td}>
                          {r.toggle ? (
                            <button
                              type="button"
                              onClick={() => setShowCapex((v) => !v)}
                              aria-expanded={showCapex}
                              className="inline-flex items-center gap-1 hover:text-accent transition-colors text-left"
                            >
                              {showCapex ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                              {r.label}
                              <span className="text-[10px] text-muted font-normal ml-1">{showCapex ? "ocultar detalle" : "ver detalle"}</span>
                            </button>
                          ) : (
                            r.label
                          )}
                        </td>
                        {flowYears.map((y) => (
                          <td key={y.id} className={`${CELL} ${s.cell}`}>
                            {flows[y.id] ? <Amount v={r.get(flows[y.id])} strong={strong} /> : "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Diferencia caja calculada vs Balance */}
                  <tr className="font-subtitle">
                    <td className="p-2">Diferencia (debe ser cero)</td>
                    {flowYears.map((y) => {
                      const d = flows[y.id]?.diferencia ?? 0;
                      const ok = isZero(d);
                      return (
                        <td key={y.id} className={`${CELL} ${ok ? "text-green-600 dark:text-green-500" : "text-red-500"}`}>
                          {ok ? "✓ 0" : `✗ ${fmtMiles.format(d)}`}
                        </td>
                      );
                    })}
                  </tr>
                  {flowYears.some((y) => !isZero(flows[y.id]?.diferencia)) && (
                    <tr className="text-xs text-muted">
                      <td className="p-2 pl-6">Balance que no cuadra</td>
                      {flowYears.map((y) => {
                        if (isZero(flows[y.id]?.diferencia)) return <td key={y.id} className={CELL} />;
                        const bad = unbalancedFor(y);
                        return (
                          <td key={y.id} className={`${CELL} text-amber-600 dark:text-amber-400`}>
                            {bad.length > 0 ? bad.join(" y ") : "revisa ambos años"}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="text-xs text-muted space-y-1.5">
            <p className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                <strong>(+) fuentes (−) aplicaciones:</strong> una cifra positiva es efectivo que entró (una utilidad, una baja de
                activos o un alza de pasivos y capital); una negativa es efectivo que salió (una pérdida, compras de activos o pagos
                de pasivos y a accionistas).
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Si la diferencia no es cero, casi siempre el <strong>Balance de ese año o del anterior no cuadra</strong> (Activo ≠
                Pasivo + Capital): revisa ahí la fila &ldquo;Diferencia&rdquo;. El estado toma cada cuenta del Balance una sola vez, así que con
                ambos Balances cuadrados la caja calculada coincide con la del Balance. Si cuadran y aun así hay diferencia, revisa que
                la utilidad neta del año anterior sea la del Estado de Resultados de ese año.
              </span>
            </p>
          </div>
        </>
      )}

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}

      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisBalance")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Balance General
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisRatios")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Razones financieras →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
