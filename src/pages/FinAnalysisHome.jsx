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
  TrendingUp,
  Layers,
  Receipt,
  FileText,
  Scale,
  Waves,
  ArrowLeftRight,
  Gauge,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import {
  SALES_SECTION,
  EXPENSES_SECTION,
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_ANNEX_SECTION,
  CASHFLOW_DIRECT_SECTION,
  costSection,
  yearLabel,
  annualizeFactor,
  fmtMiles,
  fmtPct,
  toNumber,
  RATIO_BY_KEY,
  formatRatio,
} from "@/config/finConfig";
import {
  computeIncome,
  scaleIncome,
  computeRatios,
  summarizeRatios,
  pctChange,
} from "@/config/finCalc";
import { SemaforoDot, SemaforoBadge } from "@/components/fin/Semaforo";

// Inicio del módulo de Análisis Financiero, como tablero: lectura rápida del
// último periodo (KPI, semáforo financiero y gráfica de ventas vs. utilidad)
// y el recorrido de 9 pasos con su avance. Todo se calcula de las cifras ya
// capturadas en las demás pantallas; aquí no se captura nada.

const STEPS = [
  {
    key: "FinAnalysisData",
    name: "Datos generales",
    desc: "Tu empresa y los años a analizar.",
    icon: Building,
  },
  {
    key: "FinAnalysisSales",
    name: "Ventas",
    desc: "Ventas históricas por línea de negocio.",
    icon: TrendingUp,
  },
  {
    key: "FinAnalysisCosts",
    name: "Costo de ventas",
    desc: "Lo que cuesta producir o entregar cada línea.",
    icon: Layers,
  },
  {
    key: "FinAnalysisExpenses",
    name: "Gastos de operación",
    desc: "Los gastos para operar el negocio.",
    icon: Receipt,
  },
  {
    key: "FinAnalysisIncome",
    name: "Estado de Resultados",
    desc: "Utilidades, EBITDA y márgenes — se calcula solo.",
    icon: FileText,
  },
  {
    key: "FinAnalysisBalance",
    name: "Balance General",
    desc: "Activo, pasivo y capital con validación automática.",
    icon: Scale,
  },
  {
    key: "FinAnalysisCashflow",
    name: "Estado de cambios",
    desc: "De dónde salió y a dónde se fue el efectivo — se calcula solo.",
    icon: Waves,
  },
  {
    key: "FinAnalysisCashflowDirect",
    name: "Flujo de efectivo directo",
    desc: "Entradas y salidas reales de caja.",
    icon: ArrowLeftRight,
  },
  {
    key: "FinAnalysisRatios",
    name: "Razones financieras",
    desc: "18 indicadores con semáforo y explicación simple.",
    icon: Gauge,
  },
];

const GREEN = "text-green-600 dark:text-green-500";
const RED = "text-red-500";
const SALES_COLOR = "#06b6d4";
const PROFIT_COLOR = "#DDBF5A";

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
  const income = computeIncome({ sections, years, lines });
  const hasIncome = hasAny(sections[INCOME_SECTION]);
  const hasBalance = hasAny(sections[BALANCE_SECTION]);
  const anyVentas = years.some((y) => (income[y.id]?.ventas ?? 0) > 0);

  // Completitud por paso.
  const done = {
    FinAnalysisData: years.length > 0,
    FinAnalysisSales: hasAny(sections[SALES_SECTION]),
    FinAnalysisCosts: lines.some((l) => hasAny(sections[costSection(l.id)])),
    FinAnalysisExpenses: hasAny(sections[EXPENSES_SECTION]),
    FinAnalysisIncome: hasIncome,
    FinAnalysisBalance: hasBalance,
    FinAnalysisCashflow: hasAny(sections[CASHFLOW_ANNEX_SECTION]),
    FinAnalysisCashflowDirect: hasAny(sections[CASHFLOW_DIRECT_SECTION]),
    FinAnalysisRatios: (hasIncome || anyVentas) && hasBalance,
  };

  const anyDone = STEPS.some((s) => done[s.key]);
  const pending = STEPS.find((s) => !done[s.key]);
  const continueTarget = pending
    ? { key: pending.key, label: anyDone ? "Continuar" : "Empezar" }
    : { key: "FinAnalysisRatios", label: "Ver razones financieras" };

  // El tablero aparece cuando hay algo capturado además de los años.
  const showDashboard = years.length > 0 && STEPS.slice(1).some((s) => done[s.key]);

  const last = years.length ? years[years.length - 1] : null;
  const prev = years.length > 1 ? years[years.length - 2] : null;
  // El Balance se decide por periodo, no por módulo: el semáforo y los KPI de
  // razones hablan del último periodo, y con su Balance sin capturar el motor
  // devolvería N/A con semáforo por saldos en cero que no son reales
  // ("Capital contable negativo o cero", "La caja cubre toda la deuda").
  const lastHasBalance = !!last && hasAnyForYear(sections[BALANCE_SECTION], last.id);
  const lastAnnual = last ? scaleIncome(income[last.id], annualizeFactor(last)) : null;
  const prevAnnual = prev ? scaleIncome(income[prev.id], annualizeFactor(prev)) : null;

  const ratios = showDashboard ? computeRatios({ sections, years, lines }) : {};
  const lastRatios = last ? ratios[last.id] ?? null : null;
  const summary = lastRatios ? summarizeRatios(lastRatios) : null;

  // La gráfica usa las cifras reales del periodo (sin anualizar).
  // El rótulo del eje es solo "jun 2026": que es parcial se dice en la nota
  // y en el tooltip, así caben todos los años en pantallas angostas.
  const chartData = years.map((y) => ({
    name: yearLabel(y),
    partial: y.months < 12 ? `${y.months} meses` : null,
    Ventas: income[y.id]?.ventas ?? 0,
    "Utilidad neta": income[y.id]?.utilidadNeta ?? 0,
  }));

  return {
    analysis,
    years,
    lines,
    done,
    continueTarget,
    showDashboard,
    last,
    prev,
    lastAnnual,
    prevAnnual,
    lastRatios,
    summary,
    chartData,
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

// KPI de una razón del último periodo. Sin Balance de ese periodo no hay nada
// que semaforizar: se muestra "—" y el aviso, sin badge.
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
  ratio: PropTypes.shape({
    def: PropTypes.object,
    value: PropTypes.number,
    status: PropTypes.oneOf(["verde", "ambar", "rojo"]),
    na: PropTypes.string,
  }).isRequired,
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

// Tooltip de la gráfica, con el mismo "glass" que el Dashboard.
function BarTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass rounded-xl p-3 text-sm border border-[var(--card-border)]">
      <p className="font-subtitle mb-1">
        {label}
        {payload[0]?.payload?.partial ? <span className="text-xs text-muted font-normal"> · parcial, {payload[0].payload.partial}</span> : null}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-foreground">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: {fmtMiles.format(p.value)}
        </p>
      ))}
      <p className="text-[10px] text-muted mt-1">cifras en miles</p>
    </div>
  );
}
BarTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.node,
};

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
        // Una sola consulta con todas las secciones del módulo.
        const sections = await FinValue.getSections(a.id, [
          SALES_SECTION,
          EXPENSES_SECTION,
          INCOME_SECTION,
          BALANCE_SECTION,
          CASHFLOW_ANNEX_SECTION,
          CASHFLOW_DIRECT_SECTION,
          ...lines.map((l) => costSection(l.id)),
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
    lastAnnual,
    prevAnnual,
    lastRatios,
    summary,
    chartData,
    lastHasBalance,
  } = m;

  const partial = !!last && last.months < 12;
  const ventasDelta =
    lastAnnual && prevAnnual ? pctChange(lastAnnual.ventas, prevAnnual.ventas) : null;
  const ratioOf = (key) => ({
    def: RATIO_BY_KEY[key],
    value: lastRatios?.values?.[key] ?? null,
    status: lastRatios?.status?.[key] ?? null,
    na: lastRatios?.na?.[key] ?? null,
  });
  const liquidez = ratioOf("liquidez");
  const deudaEbitda = ratioOf("deuda_ebitda");

  const stepMeta = (key) => {
    switch (key) {
      case "FinAnalysisData":
        return years.length > 0 ? `${years.length} año(s) definidos` : "Empieza aquí";
      case "FinAnalysisSales":
        return lines.length > 0 ? `${lines.length} línea(s) de negocio` : null;
      case "FinAnalysisExpenses":
        return done.FinAnalysisExpenses ? "Con captura" : null;
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
                <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full text-xs font-subtitle bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  Último periodo: {yearLabel(last)}
                  {partial ? " · parcial, anualizado en los indicadores" : ""}
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
        /* Qué es (solo mientras no hay cifras) */
        <Card className="glass">
          <CardContent className="p-6">
            <h2 className="font-subtitle text-lg mb-2">¿Qué es esto?</h2>
            <p className="text-sm text-muted leading-relaxed">
              Aquí capturas la información financiera histórica de tu empresa —
              ventas, costos, gastos, el estado de resultados y el balance — y el
              módulo calcula por ti los totales, márgenes y flujos de efectivo. Al
              final, las razones financieras resumen la salud de la empresa en 18
              indicadores con semáforo y explicación simple. Es la fotografía de
              dónde estás parado, y será la base de la Planeación Financiera. Todo
              se guarda automáticamente y las cifras se capturan{" "}
              <strong>en miles</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI del último periodo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Ventas" value={fmtMiles.format(lastAnnual?.ventas ?? 0)}>
              <span>miles{partial ? " · anualizado" : ""}</span>
              {ventasDelta != null && (
                <span className={`whitespace-nowrap ${ventasDelta >= 0 ? GREEN : RED}`}>
                  {ventasDelta >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(ventasDelta))} vs. {yearLabel(prev)}
                </span>
              )}
            </Kpi>
            <Kpi
              label="Utilidad neta"
              value={fmtMiles.format(lastAnnual?.utilidadNeta ?? 0)}
              negative={(lastAnnual?.utilidadNeta ?? 0) < 0}
            >
              <span>
                Margen neto {fmtPct((lastAnnual?.utilidadNeta ?? 0) / (lastAnnual?.ventas ?? 0))}
                {partial ? " · anualizado" : ""}
              </span>
            </Kpi>
            <RatioKpi label="Liquidez" ratio={liquidez} hasBalance={lastHasBalance} />
            <RatioKpi label="Deuda / EBITDA" ratio={deudaEbitda} hasBalance={lastHasBalance} />
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
                    Ver las 18 razones →
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

            {/* Ventas y utilidad neta por año */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                  <h2 className="font-subtitle text-lg">Ventas y utilidad neta por año</h2>
                </div>
                <p className="text-xs text-muted mb-3">
                  Cifras en miles, reales del periodo (sin anualizar).
                  {partial ? ` ${yearLabel(last)} es un periodo parcial de ${last.months} meses.` : ""}
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => fmtMiles.format(v)}
                      />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--card-border)" }} />
                      <Bar dataKey="Ventas" fill={SALES_COLOR} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Utilidad neta" fill={PROFIT_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SALES_COLOR }} />
                    <span className="text-xs text-muted">Ventas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PROFIT_COLOR }} />
                    <span className="text-xs text-muted">Utilidad neta</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Recorrido */}
      <div>
        <h2 className="text-xl font-title mb-4">El recorrido</h2>
        <div className="space-y-2">
          {STEPS.map((s, i) => {
            const extra = stepMeta(s.key);
            const isDone = !!done[s.key];
            return (
              <Link key={s.key} to={createPageUrl(s.key)} className="block">
                <div className="flex items-center gap-4 p-4 glass rounded-2xl transition-all hover:border-accent">
                  <span className="w-8 h-8 rounded-full bg-cyan-500/15 text-cyan-500 flex items-center justify-center font-title text-sm flex-shrink-0">
                    {i + 1}
                  </span>
                  <s.icon className="w-5 h-5 text-muted flex-shrink-0" />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-subtitle">{s.name}</span>
                      {extra && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                          {extra}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{s.desc}</p>
                  </div>
                  {isDone ? (
                    <CheckCircle2
                      className={`w-5 h-5 flex-shrink-0 ${GREEN}`}
                      aria-label="Paso completado"
                    />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
