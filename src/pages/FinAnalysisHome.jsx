import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Calculator,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Building,
  FileText,
  Scale,
  Waves,
  Gauge,
  BarChart3,
  PieChart,
  Receipt,
  CalendarRange,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  SALES_SECTION,
  EXPENSES_SECTION,
  SEASONALITY_SECTION,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
  RATIO_BY_KEY,
  RATIO_DEFS,
  formatRatio,
} from "@/config/finConfig";
import { computeIncome, computeRatios, summarizeRatios } from "@/config/finCalc";
import { SemaforoDot, SemaforoBadge } from "@/components/fin/Semaforo";

// Inicio del módulo de Análisis Financiero (modelo MP-AFH1), como tablero:
// lectura rápida del último periodo (KPI, semáforo financiero, ventas y
// resultado de operación por año, ciclo financiero en días) y el recorrido
// con sus pasos obligatorios y los análisis opcionales. Todo se calcula de
// las cifras ya capturadas en las demás pantallas; aquí no se captura nada.

// Pasos obligatorios, en el orden del recorrido.
const REQUIRED_STEPS = [
  {
    key: "FinAnalysisData",
    name: "Datos generales",
    desc: "Tu empresa y los años a analizar.",
    icon: Building,
  },
  {
    key: "FinAnalysisIncome",
    name: "Estado de Resultados",
    desc: "Ventas, costos, gastos e impuestos de cada periodo; los totales se calculan solos.",
    icon: FileText,
  },
  {
    key: "FinAnalysisBalance",
    name: "Balance General",
    desc: "Activo, pasivo y capital; el resultado del periodo entra solo y se valida que cuadre.",
    icon: Scale,
  },
  {
    key: "FinAnalysisCashflow",
    name: "Estado de cambios",
    desc: "De dónde salió y a dónde se fue el efectivo entre un año y otro — se calcula solo.",
    icon: Waves,
  },
  {
    key: "FinAnalysisRatios",
    name: "Razones financieras",
    desc: "Indicadores con semáforo y explicación simple, más las cifras del flujo de efectivo.",
    icon: Gauge,
  },
  {
    key: "FinAnalysisReport",
    name: "Informe",
    desc: "Los diez cuadros del análisis en gráficas y tablas, listos para imprimir.",
    icon: BarChart3,
  },
];

// Análisis opcionales: complementan, pero no hacen falta para el semáforo
// ni para el informe.
const OPTIONAL_STEPS = [
  {
    key: "FinAnalysisSegments",
    name: "Segmentos",
    desc: "Ventas y costo por segmento de negocio, con su margen.",
    icon: PieChart,
  },
  {
    key: "FinAnalysisExpenses",
    name: "Desglose del gasto",
    desc: "En qué se va el gasto operativo, concepto por concepto.",
    icon: Receipt,
  },
  {
    key: "FinAnalysisSeasonality",
    name: "Estacionalidad",
    desc: "Ventas por mes de cada año.",
    icon: CalendarRange,
  },
];

// Cuántas razones llevan semáforo (las demás son informativas).
const SEMAFORO_COUNT = RATIO_DEFS.filter((d) => d.semaforo).length;

const GREEN = "text-green-600 dark:text-green-500";
const RED = "text-red-500";
// Colores de series (los mismos del Informe).
const CYAN = "#06b6d4";
const GOLD = "#DDBF5A";
const VIOLET = "#a78bfa";
const LINE = "#22c55e";

const fmtDays = (v) => `${Math.round(v)} días`;

// ¿Hay algún valor capturado en la sección? ({ [concepto]: { [yearId]: v } })
const hasAny = (section) =>
  Object.values(section || {}).some((byYear) =>
    Object.values(byYear || {}).some((v) => toNumber(v) != null)
  );

// ¿Hay algún valor capturado en la sección para ese año en particular?
const hasAnyForYear = (section, yearId) =>
  Object.values(section || {}).some((byYear) => toNumber(byYear?.[yearId]) != null);

const EMPTY = { analysis: null, years: [], lines: [], sections: {} };

// Deriva todo lo que pinta el tablero a partir de lo cargado.
function buildModel({ analysis, years, lines, sections }) {
  const income = computeIncome({ sections, years });
  const incomeSection = sections[INCOME_SECTION];
  const balanceSection = sections[BALANCE_SECTION];
  const hasIncome = hasAny(incomeSection);
  const hasBalance = hasAny(balanceSection);

  const last = years.length ? years[years.length - 1] : null;
  const prev = years.length > 1 ? years[years.length - 2] : null;
  // Años con Estado de Resultados y Balance: son los que el Estado de
  // cambios puede comparar entre sí.
  const completeYears = years.filter(
    (y) => hasAnyForYear(incomeSection, y.id) && hasAnyForYear(balanceSection, y.id)
  );
  // El Balance se decide por periodo, no por módulo: el semáforo y los KPI
  // de razones hablan del último periodo, y con su Balance sin capturar el
  // motor devolvería N/A con semáforo por saldos en cero que no son reales
  // ("Capital contable negativo o cero", "Sin deuda con costo").
  const lastHasBalance = !!last && hasAnyForYear(balanceSection, last.id);
  const lastComplete = lastHasBalance && hasAnyForYear(incomeSection, last.id);

  // Completitud por paso.
  const done = {
    FinAnalysisData: years.length > 0,
    FinAnalysisIncome: hasIncome,
    FinAnalysisBalance: hasBalance,
    FinAnalysisCashflow: completeYears.length >= 2,
    FinAnalysisRatios: lastComplete,
    FinAnalysisReport: lastComplete,
    FinAnalysisSegments: hasAny(sections[SALES_SECTION]),
    FinAnalysisExpenses: hasAny(sections[EXPENSES_SECTION]),
    FinAnalysisSeasonality: hasAny(sections[SEASONALITY_SECTION]),
  };

  // "Continuar" lleva al primer paso obligatorio pendiente; con todos
  // hechos, al Informe.
  const anyDone = Object.values(done).some(Boolean);
  const pending = REQUIRED_STEPS.find((s) => !done[s.key]);
  const continueTarget = pending
    ? { key: pending.key, label: anyDone ? "Continuar" : "Empezar" }
    : { key: "FinAnalysisReport", label: "Ver informe" };

  // El tablero aparece cuando hay algún estado financiero capturado.
  const showDashboard = years.length > 0 && (hasIncome || hasBalance);

  const ratios = showDashboard ? computeRatios({ sections, years }) : {};
  const lastIncome = last ? income[last.id] ?? null : null;
  const lastRatios = last ? ratios[last.id] ?? null : null;
  const summary = lastRatios ? summarizeRatios(lastRatios) : null;

  // Las gráficas usan las cifras reales del periodo (sin anualizar) y los
  // días con saldos al cierre sobre meses × 30. El rótulo del eje es solo
  // "jun 2026": que es parcial se dice en la nota y en el tooltip, así caben
  // todos los años en pantallas angostas.
  const resultsChart = years.map((y) => ({
    name: yearLabel(y),
    partial: y.months < 12 ? `${y.months} meses` : null,
    Ventas: income[y.id]?.ventas ?? 0,
    "Resultado de operación": income[y.id]?.resultadoOp ?? 0,
  }));
  // Sin Balance de un año no hay días que mostrar (serían ceros falsos).
  const cycleChart = years.map((y) => {
    const v = hasAnyForYear(balanceSection, y.id) ? ratios[y.id]?.values ?? {} : {};
    return {
      name: yearLabel(y),
      partial: y.months < 12 ? `${y.months} meses` : null,
      "Días clientes": v.dias_clientes ?? null,
      "Días inventario": v.dias_inventario ?? null,
      "Días proveedores": v.dias_proveedores ?? null,
      "Ciclo económico": v.ciclo_economico ?? null,
    };
  });
  const cycleHasData = cycleChart.some((d) => d["Ciclo económico"] != null);

  return {
    analysis,
    years,
    lines,
    done,
    continueTarget,
    showDashboard,
    last,
    prev,
    lastIncome,
    lastRatios,
    summary,
    resultsChart,
    cycleChart,
    cycleHasData,
    lastHasBalance,
  };
}

// Tarjeta KPI: etiqueta, cifra grande y una línea de apoyo debajo.
function Kpi({ label, value, negative, children }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-title ${negative ? RED : ""}`}>{value}</p>
      {children && (
        <div className="text-xs text-muted mt-1 flex items-center gap-2 flex-wrap">{children}</div>
      )}
    </div>
  );
}
Kpi.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  negative: PropTypes.bool,
  children: PropTypes.node,
};

const ratioShape = PropTypes.shape({
  def: PropTypes.object,
  value: PropTypes.number,
  status: PropTypes.oneOf(["verde", "ambar", "rojo"]),
  na: PropTypes.string,
});

// KPI de una razón del último periodo con su badge. Sin Balance de ese
// periodo no hay nada que semaforizar: se muestra "—" y el aviso, sin badge.
function RatioKpi({ label, ratio, hasBalance }) {
  if (!hasBalance) {
    return (
      <Kpi label={label} value="—">
        <span>Sin Balance General</span>
      </Kpi>
    );
  }
  return (
    <Kpi label={label} value={formatRatio(ratio.def, ratio.value)}>
      <SemaforoBadge status={ratio.status} />
      {ratio.value == null && ratio.na && <span>{ratio.na}</span>}
    </Kpi>
  );
}
RatioKpi.propTypes = {
  label: PropTypes.node.isRequired,
  ratio: ratioShape.isRequired,
  hasBalance: PropTypes.bool.isRequired,
};

// Contador del semáforo: punto de color, cantidad y etiqueta.
function StatusCounter({ status, count, label }) {
  return (
    <div className="flex items-center gap-2">
      <SemaforoDot status={status} />
      <span className="text-2xl font-title">{count}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
StatusCounter.propTypes = {
  status: PropTypes.oneOf(["verde", "ambar", "rojo"]).isRequired,
  count: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
};

// Tooltip de las gráficas, con el mismo "glass" que el Dashboard. Las
// series sin valor en ese año (por ejemplo, días sin Balance) no se listan.
function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (v) => fmtMiles.format(v),
  footnote = "cifras en miles",
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.value != null);
  if (rows.length === 0) return null;
  return (
    <div className="glass rounded-xl p-3 text-sm border border-[var(--card-border)]">
      <p className="font-subtitle mb-1">
        {label}
        {payload[0]?.payload?.partial ? (
          <span className="text-xs text-muted font-normal"> · parcial, {payload[0].payload.partial}</span>
        ) : null}
      </p>
      {rows.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-foreground">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: {formatValue(p.value)}
        </p>
      ))}
      <p className="text-[10px] text-muted mt-1">{footnote}</p>
    </div>
  );
}
ChartTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.node,
  formatValue: PropTypes.func,
  footnote: PropTypes.string,
};

// Leyenda manual de una gráfica: cuadrito (o raya, para líneas) y etiqueta.
function ChartLegend({ items }) {
  return (
    <div className="flex justify-center gap-x-5 gap-y-1 mt-2 flex-wrap">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <div
            className={it.line ? "w-4 h-0.5 rounded-full" : "w-3 h-3 rounded-sm"}
            style={{ backgroundColor: it.color }}
          />
          <span className="text-xs text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
ChartLegend.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      line: PropTypes.bool,
    })
  ).isRequired,
};

// Fila del recorrido: número, icono, nombre (con chips), descripción y
// palomita cuando está hecho. Los opcionales llevan el chip "opcional".
function StepRow({ step, index, isDone, meta, optional }) {
  const Icon = step.icon;
  return (
    <Link to={createPageUrl(step.key)} className="block">
      <div className="flex items-center gap-4 p-4 glass rounded-2xl transition-all hover:border-accent">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center font-title text-sm flex-shrink-0 ${
            optional ? "bg-muted-foreground/10 text-muted" : "bg-cyan-500/15 text-cyan-500"
          }`}
        >
          {index}
        </span>
        <Icon className="w-5 h-5 text-muted flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-subtitle">{step.name}</span>
            {optional && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle glass text-muted">
                opcional
              </span>
            )}
            {meta && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                {meta}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">{step.desc}</p>
        </div>
        {isDone ? (
          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${GREEN}`} aria-label="Paso completado" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
        )}
      </div>
    </Link>
  );
}
StepRow.propTypes = {
  step: PropTypes.shape({
    key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    desc: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
  isDone: PropTypes.bool.isRequired,
  meta: PropTypes.string,
  optional: PropTypes.bool,
};

const AXIS_TICK = { fill: "var(--foreground-muted)", fontSize: 11 };

export default function FinAnalysisHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await FinAnalysis.getOrCreate();
        const [years, lines] = await Promise.all([FinYear.list(a.id), FinLine.list(a.id)]);
        // Una sola consulta con las secciones que el tablero necesita.
        const sections = await FinValue.getSections(a.id, [
          INCOME_SECTION,
          BALANCE_SECTION,
          SALES_SECTION,
          EXPENSES_SECTION,
          SEASONALITY_SECTION,
        ]);
        if (active) setData({ analysis: a, years, lines, sections });
      } catch (err) {
        console.error("Error al cargar el inicio del análisis financiero:", err);
        if (active) setError("No pudimos cargar la información. Intenta recargar la página.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const m = useMemo(() => buildModel(data || EMPTY), [data]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="glass rounded-3xl p-8 animate-pulse h-28" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

  const {
    analysis,
    years,
    lines,
    done,
    continueTarget,
    showDashboard,
    last,
    prev,
    lastIncome,
    lastRatios,
    summary,
    resultsChart,
    cycleChart,
    cycleHasData,
    lastHasBalance,
  } = m;

  const partial = !!last && last.months < 12;
  const ratioOf = (key) => ({
    def: RATIO_BY_KEY[key],
    value: lastRatios?.values?.[key] ?? null,
    status: lastRatios?.status?.[key] ?? null,
    na: lastRatios?.na?.[key] ?? null,
  });
  const crecimiento = ratioOf("crecimiento_ventas");
  const margenOp = ratioOf("margen_operativo");
  const liquidez = ratioOf("liquidez");
  const pasivoFinEbitda = ratioOf("pasivo_fin_ebitda");

  const stepMeta = (key) => {
    switch (key) {
      case "FinAnalysisData":
        return years.length > 0 ? `${years.length} año(s)` : "Empieza aquí";
      case "FinAnalysisSegments":
        return lines.length > 0 ? `${lines.length} segmento(s)` : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calculator className="w-7 h-7 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-3xl font-title mb-1">Análisis Financiero</h1>
              <p className="text-lg text-muted">
                {analysis?.company_name ||
                  "Entiende los números históricos de tu empresa antes de planear."}
              </p>
              {last && (
                <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-subtitle bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Clock className="w-3 h-3" />
                  Último periodo: {yearLabel(last)}
                  {partial ? ` · parcial, ${last.months} meses` : ""}
                </span>
              )}
            </div>
          </div>
          <Link to={createPageUrl(continueTarget.key)}>
            <button className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-subtitle text-sm flex-shrink-0">
              {continueTarget.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {!showDashboard ? (
        /* Qué es (solo mientras no hay estados financieros) */
        <Card className="glass">
          <CardContent className="p-6">
            <h2 className="font-subtitle text-lg mb-2">¿Qué es esto?</h2>
            <p className="text-sm text-muted leading-relaxed">
              Aquí capturas los estados financieros históricos de tu empresa — el
              Estado de Resultados y el Balance General de cada año, más el último
              periodo parcial que haya emitido tu contador — y el módulo calcula por
              ti los totales, el Estado de cambios, el EBITDA y las razones
              financieras: {SEMAFORO_COUNT} indicadores con semáforo y explicación
              simple, más las cifras del flujo de efectivo. Si quieres ir más a
              fondo, puedes desglosar las ventas por segmento, el gasto por concepto
              y las ventas por mes. Es la fotografía de dónde estás parado, y será la
              base de la Planeación Financiera. Todo se guarda automáticamente y las
              cifras se capturan <strong>en miles</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI del último periodo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label={`Ventas · ${yearLabel(last)}`} value={fmtMiles.format(lastIncome?.ventas ?? 0)}>
              <span>miles{partial ? ` · ${last.months} meses` : ""}</span>
              {crecimiento.value != null ? (
                <span className={`whitespace-nowrap ${crecimiento.value >= 0 ? GREEN : RED}`}>
                  {crecimiento.value >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(crecimiento.value))} vs.{" "}
                  {yearLabel(prev)}
                  {partial ? " · anualizado" : ""}
                </span>
              ) : (
                crecimiento.na && <span>{crecimiento.na}</span>
              )}
            </Kpi>
            <Kpi
              label="Margen operativo"
              value={formatRatio(margenOp.def, margenOp.value)}
              negative={(margenOp.value ?? 0) < 0}
            >
              <span>
                Resultado de operación {fmtMiles.format(lastIncome?.resultadoOp ?? 0)}
              </span>
              {margenOp.value == null && margenOp.na && <span>{margenOp.na}</span>}
            </Kpi>
            <RatioKpi label="Índice de liquidez" ratio={liquidez} hasBalance={lastHasBalance} />
            <RatioKpi
              label="Pasivo financiero / EBITDA"
              ratio={pasivoFinEbitda}
              hasBalance={lastHasBalance}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Semáforo financiero */}
            <Card className="glass">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                    <h2 className="font-subtitle text-lg">
                      Semáforo financiero · {yearLabel(last)}
                    </h2>
                  </div>
                  <Link
                    to={createPageUrl("FinAnalysisRatios")}
                    className="text-sm font-subtitle text-accent hover:underline whitespace-nowrap"
                  >
                    Ver las razones →
                  </Link>
                </div>

                {!lastHasBalance || !summary ? (
                  <p className="text-sm text-muted">
                    Captura el{" "}
                    <Link
                      to={createPageUrl("FinAnalysisBalance")}
                      className="text-accent hover:underline font-subtitle"
                    >
                      Balance General
                    </Link>{" "}
                    de {yearLabel(last)} para ver el semáforo.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-6 flex-wrap">
                      <StatusCounter status="verde" count={summary.verde} label="Sanos" />
                      <StatusCounter status="ambar" count={summary.ambar} label="Por vigilar" />
                      <StatusCounter status="rojo" count={summary.rojo} label="Por atender" />
                      {summary.na > 0 && (
                        <span className="text-xs text-muted">
                          {summary.na} no aplica{summary.na === 1 ? "" : "n"} en este periodo
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-subtitle uppercase tracking-wide text-muted mb-1">
                        Lo que más llama la atención
                      </p>
                      {summary.atencion.length === 0 ? (
                        <p className="text-sm text-muted">
                          Ningún indicador en rojo o ámbar en este periodo.
                        </p>
                      ) : (
                        <ul>
                          {summary.atencion.slice(0, 3).map((a) => {
                            const def = RATIO_BY_KEY[a.key];
                            return (
                              <li
                                key={a.key}
                                className="flex items-center justify-between gap-3 py-2 border-b border-card-border/50 last:border-0"
                              >
                                <span className="text-sm">{def?.label ?? a.key}</span>
                                <span className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-sm font-subtitle whitespace-nowrap">
                                    {a.value == null
                                      ? lastRatios?.na?.[a.key] ?? "—"
                                      : formatRatio(def, a.value)}
                                  </span>
                                  <SemaforoBadge status={a.status} />
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Ventas y resultado de operación por año */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                  <h2 className="font-subtitle text-lg">Ventas y resultado de operación</h2>
                </div>
                <p className="text-xs text-muted mb-3">
                  Cifras en miles, reales de cada periodo (sin anualizar).
                  {partial ? ` ${yearLabel(last)} es un periodo parcial de ${last.months} meses.` : ""}
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resultsChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => fmtMiles.format(v)}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--card-border)" }} />
                      <Bar dataKey="Ventas" fill={CYAN} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Resultado de operación" fill={GOLD} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend
                  items={[
                    { label: "Ventas", color: CYAN },
                    { label: "Resultado de operación", color: GOLD },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {/* Ciclo financiero en días por año */}
          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                <h2 className="font-subtitle text-lg">Ciclo financiero en días</h2>
              </div>
              <p className="text-xs text-muted mb-3">
                Cuántos días tardas en cobrar, cuántos días de venta guardas en el almacén y
                cuántos tardas en pagar, con los saldos al cierre de cada periodo. La línea es
                el ciclo económico (clientes + inventario − anticipos − proveedores): negativo
                significa que tus proveedores financian la operación.
              </p>
              {!cycleHasData ? (
                <p className="text-sm text-muted">
                  Captura el{" "}
                  <Link
                    to={createPageUrl("FinAnalysisBalance")}
                    className="text-accent hover:underline font-subtitle"
                  >
                    Balance General
                  </Link>{" "}
                  de algún año con ventas para ver el ciclo.
                </p>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={cycleChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          tick={AXIS_TICK}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={AXIS_TICK}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => String(Math.round(v))}
                        />
                        <ReferenceLine y={0} stroke="var(--foreground-muted)" />
                        <Tooltip
                          content={<ChartTooltip formatValue={fmtDays} footnote="días, con saldos al cierre" />}
                          cursor={{ fill: "var(--card-border)" }}
                        />
                        <Bar dataKey="Días clientes" fill={CYAN} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Días inventario" fill={GOLD} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Días proveedores" fill={VIOLET} radius={[4, 4, 0, 0]} />
                        <Line
                          type="monotone"
                          dataKey="Ciclo económico"
                          stroke={LINE}
                          strokeWidth={2}
                          dot={{ r: 3, fill: LINE, strokeWidth: 0 }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartLegend
                    items={[
                      { label: "Días clientes", color: CYAN },
                      { label: "Días inventario", color: GOLD },
                      { label: "Días proveedores", color: VIOLET },
                      { label: "Ciclo económico", color: LINE, line: true },
                    ]}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Recorrido */}
      <div>
        <h2 className="text-xl font-title mb-4">El recorrido</h2>
        <div className="space-y-2">
          {REQUIRED_STEPS.map((s, i) => (
            <StepRow
              key={s.key}
              step={s}
              index={i + 1}
              isDone={!!done[s.key]}
              meta={stepMeta(s.key)}
            />
          ))}
        </div>

        <h3 className="font-subtitle text-lg mt-8 mb-1">Análisis opcionales</h3>
        <p className="text-sm text-muted mb-4">
          Complementan el análisis cuando tienes el detalle a la mano; no hacen falta para el
          semáforo ni para el informe.
        </p>
        <div className="space-y-2">
          {OPTIONAL_STEPS.map((s, i) => (
            <StepRow
              key={s.key}
              step={s}
              index={REQUIRED_STEPS.length + i + 1}
              isDone={!!done[s.key]}
              meta={stepMeta(s.key)}
              optional
            />
          ))}
        </div>
      </div>
    </div>
  );
}
