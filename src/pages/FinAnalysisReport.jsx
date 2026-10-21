import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, BarChart3, Sparkles, Printer, Info } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  yearLabel,
  fmtMiles,
  toNumber,
  RATIO_BY_KEY,
  formatRatio,
} from "@/config/finConfig";
import { computeRatios, computeIncome } from "@/config/finCalc";
import { SemaforoDot } from "@/components/fin/Semaforo";

// Informe del Análisis Financiero (hoja "Cuadros Informe" del Excel
// MP-AFH1): diez cuadros, cada uno con una gráfica pequeña y una tabla
// compacta por año, listos para imprimir. Todo sale de las razones
// financieras ya calculadas (computeRatios) más dos cifras que el catálogo no
// trae: el gasto operativo como % de ventas (Estado de Resultados) y el
// efectivo al cierre (Balance). Aquí no se captura nada.
// Impresión: `window.print()`; las utilidades `print:hidden` (una regla
// @media print de Tailwind) ocultan cabecera, intro y navegación, y
// `break-inside-avoid` evita que un cuadro se parta entre dos hojas.

const isPartial = (y) => y && y.months < 12;

// Colores de las series (los mismos del Inicio).
const CYAN = "#06b6d4";
const GOLD = "#DDBF5A";
const VIOLET = "#a78bfa";
const GREEN = "#22c55e";

// Cifras del informe que no están en el catálogo de razones.
const EXTRA_DEFS = {
  gasto_operativo_pct: {
    key: "gasto_operativo_pct",
    label: "Gasto operativo (% de ventas)",
    format: "pct",
    semaforo: false,
  },
  efectivo_final: {
    key: "efectivo_final",
    label: "Efectivo y equivalentes al final",
    format: "miles",
    semaforo: false,
  },
};
const defOf = (key) => RATIO_BY_KEY[key] || EXTRA_DEFS[key];

// Los diez cuadros del informe (§8 del modelo). `rows` son las filas de la
// tabla; `chart` la gráfica: `bar` o `line` con sus series, o `split` con dos
// gráficas pequeñas lado a lado cuando las escalas no se pueden mezclar.
const CUADROS = [
  {
    key: "crecimiento",
    title: "Crecimiento y cobranza",
    hint: "Crecimiento anualizado en periodos parciales; días con saldos al cierre.",
    rows: ["crecimiento_ventas", "dias_clientes"],
    chart: {
      type: "split",
      parts: [
        { type: "bar", caption: "Crecimiento en ventas", series: [{ key: "crecimiento_ventas", color: CYAN }] },
        { type: "line", caption: "Días clientes", series: [{ key: "dias_clientes", color: GOLD }] },
      ],
    },
  },
  {
    key: "margenes",
    title: "Márgenes",
    hint: "Porcentaje sobre ventas.",
    rows: ["margen_bruto", "gasto_operativo_pct", "margen_operativo"],
    chart: {
      type: "line",
      series: [
        { key: "margen_bruto", color: CYAN },
        { key: "gasto_operativo_pct", name: "Gasto operativo", color: GOLD },
        { key: "margen_operativo", color: VIOLET },
      ],
    },
  },
  {
    key: "cobertura_rif",
    title: "Cobertura del costo financiero",
    hint: "Veces que el EBIT y el EBITDA cubren el resultado integral de financiamiento.",
    rows: ["cobertura_rif_ebit", "cobertura_rif_ebitda"],
    chart: {
      type: "bar",
      series: [
        { key: "cobertura_rif_ebit", name: "Con EBIT", color: CYAN },
        { key: "cobertura_rif_ebitda", name: "Con EBITDA", color: GOLD },
      ],
    },
  },
  {
    key: "deuda",
    title: "Deuda con costo y apalancamiento financiero",
    hint: "Deuda bancaria de corto y largo plazo, en miles, y cuántas veces representa el capital.",
    rows: ["deuda_total", "apalancamiento_financiero"],
    chart: { type: "bar", series: [{ key: "deuda_total", color: CYAN }] },
  },
  {
    key: "flujo",
    title: "Flujo de efectivo",
    hint: "Cifras en miles. El EBITDA se calcula en todos los periodos y el efectivo final sale del Balance; las demás filas salen del Estado de cambios y por eso no aplican en el primer periodo.",
    rows: [
      "ebitda",
      "inversion_capital_trabajo",
      "efectivo_operacion",
      "efectivo_inversion",
      "efectivo_fin_externo",
      "accionistas",
      "efectivo_periodo",
      "efectivo_final",
    ],
    chart: {
      type: "bar",
      series: [
        { key: "efectivo_operacion", name: "Operación", color: CYAN },
        { key: "efectivo_inversion", name: "Inversión", color: VIOLET },
        { key: "efectivo_fin_externo", name: "Fin. externo", color: GOLD },
        { key: "accionistas", name: "Accionistas", color: GREEN },
      ],
    },
  },
  {
    key: "ciclo",
    title: "Ciclo financiero",
    hint: "Días con saldos al cierre sobre meses × 30 (360 en un año completo).",
    rows: [
      "dias_clientes",
      "dias_inventario",
      "dias_proveedores",
      "dias_anticipos",
      "ciclo_economico",
      "dias_otras_cxc",
      "ciclo_con_ocxc",
      "dias_cxc_inter",
      "dias_cxp_inter",
      "ciclo_con_inter",
    ],
    chart: { type: "bar", series: [{ key: "ciclo_economico", color: CYAN }] },
  },
  {
    key: "liquidez",
    title: "Liquidez",
    hint: "Capital de trabajo en miles.",
    rows: ["liquidez", "acido", "capital_trabajo"],
    chart: {
      type: "line",
      series: [
        { key: "liquidez", color: CYAN },
        { key: "acido", color: GOLD },
      ],
    },
  },
  {
    key: "cobertura_int",
    title: "Cobertura de intereses",
    hint: "Veces que el EBIT y el EBITDA cubren los intereses netos.",
    rows: ["cobertura_int_ebit", "cobertura_int_ebitda"],
    chart: {
      type: "bar",
      series: [
        { key: "cobertura_int_ebit", name: "Con EBIT", color: CYAN },
        { key: "cobertura_int_ebitda", name: "Con EBITDA", color: GOLD },
      ],
    },
  },
  {
    key: "solvencia",
    title: "Solvencia",
    hint: "Veces que el pasivo (total y con costo) representa el capital; capital como % del activo.",
    rows: ["apalancamiento", "apalancamiento_financiero", "capital_activo"],
    chart: {
      type: "bar",
      series: [
        { key: "apalancamiento", name: "Apalancamiento", color: CYAN },
        { key: "apalancamiento_financiero", name: "Apalancamiento financiero", color: GOLD },
      ],
    },
  },
  {
    key: "rentabilidad",
    title: "Rentabilidad",
    hint: "ROA y ROE anualizados en periodos parciales.",
    rows: ["margen_neto", "roa", "roe"],
    chart: {
      type: "line",
      series: [
        { key: "margen_neto", color: CYAN },
        { key: "roa", color: GOLD },
        { key: "roe", color: VIOLET },
      ],
    },
  },
];

// ¿Hay algún valor capturado en la sección? ({ [concepto]: { [yearId]: v } })
const hasAny = (section) =>
  Object.values(section || {}).some((byYear) => Object.values(byYear || {}).some((v) => toNumber(v) != null));

// Formato corto de los ejes según el tipo de cifra.
const axisFormatter = (format) => (v) => {
  switch (format) {
    case "pct":
      return `${Math.round(v * 100)}%`;
    case "days":
      return String(Math.round(v));
    case "miles":
      return fmtMiles.format(v);
    default:
      return Number(v).toFixed(1);
  }
};

const yearShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  year: PropTypes.number,
  months: PropTypes.number,
});

const seriesShape = PropTypes.shape({
  key: PropTypes.string.isRequired,
  name: PropTypes.string,
  color: PropTypes.string.isRequired,
});

// `model`: lectura de las cifras por indicador y año (ver buildModel).
const modelShape = PropTypes.shape({
  value: PropTypes.func.isRequired,
  status: PropTypes.func.isRequired,
  reason: PropTypes.func.isRequired,
  chartData: PropTypes.func.isRequired,
});

// Tooltip de las gráficas, con el mismo "glass" que el Inicio. Cada serie
// se formatea con su propio tipo de cifra (%, días, veces o miles).
function ChartTooltip({ active, payload, label, series }) {
  if (!active || !payload || payload.length === 0) return null;
  const formatOf = Object.fromEntries((series || []).map((s) => [s.key, defOf(s.key)?.format]));
  const partial = payload[0]?.payload?.partial;
  return (
    <div className="glass rounded-xl p-3 text-sm border border-[var(--card-border)]">
      <p className="font-subtitle mb-1">
        {label}
        {partial ? <span className="text-xs text-muted font-normal"> · parcial, {partial}</span> : null}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-foreground">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: {formatRatio({ format: formatOf[p.dataKey] }, p.value)}
        </p>
      ))}
    </div>
  );
}

ChartTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.node,
  series: PropTypes.arrayOf(seriesShape),
};

// Gráfica pequeña de barras o líneas con las series indicadas. El eje Y toma
// el formato de la primera serie (todas las series de una gráfica comparten
// tipo de cifra). Las barras llevan una línea en cero porque varias cifras
// (ciclo, flujos, coberturas) pueden ser negativas.
function MiniChart({ type, data, series, className = "h-48", compact = false }) {
  const format = defOf(series[0].key)?.format;
  const named = series.map((s) => ({ ...s, name: s.name ?? defOf(s.key)?.label ?? s.key }));
  const axis = {
    tick: { fill: "var(--foreground-muted)", fontSize: compact ? 10 : 11 },
    axisLine: false,
    tickLine: false,
  };
  // Margen derecho para que el último rótulo del eje ("jun 2026") no se corte.
  const margin = { top: 4, right: 28, left: 0, bottom: 0 };
  // En las minigráficas divididas solo cabe el año ("2026"); el periodo parcial
  // ya lo aclara la nota del informe.
  const xAxisExtra = compact ? { tickFormatter: (v) => String(v).slice(-4) } : {};
  return (
    <div>
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={data} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="name" interval={0} {...axis} {...xAxisExtra} />
              <YAxis {...axis} tickFormatter={axisFormatter(format)} width={48} />
              <Tooltip content={<ChartTooltip series={named} />} cursor={{ stroke: "var(--card-border)" }} />
              {named.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="name" interval={0} {...axis} {...xAxisExtra} />
              <YAxis {...axis} tickFormatter={axisFormatter(format)} width={48} />
              <ReferenceLine y={0} stroke="var(--foreground-muted)" strokeOpacity={0.4} />
              <Tooltip content={<ChartTooltip series={named} />} cursor={{ fill: "var(--card-border)" }} />
              {named.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {named.length > 1 && (
        <div className="flex justify-center gap-4 flex-wrap mt-1">
          {named.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[11px] text-muted">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

MiniChart.propTypes = {
  type: PropTypes.oneOf(["bar", "line"]).isRequired,
  data: PropTypes.array.isRequired,
  series: PropTypes.arrayOf(seriesShape).isRequired,
  className: PropTypes.string,
  compact: PropTypes.bool,
};

// La gráfica de un cuadro: una sola, o dos pequeñas lado a lado (`split`)
// cuando las cifras no comparten escala (porcentaje y días, por ejemplo).
function CuadroChart({ chart, model }) {
  if (chart.type === "split") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {chart.parts.map((part) => (
          <div key={part.caption}>
            <p className="text-[11px] text-muted text-center mb-1">{part.caption}</p>
            <MiniChart type={part.type} data={model.chartData(part.series)} series={part.series} className="h-40" compact />
          </div>
        ))}
      </div>
    );
  }
  return <MiniChart type={chart.type} data={model.chartData(chart.series)} series={chart.series} />;
}

CuadroChart.propTypes = {
  chart: PropTypes.shape({
    type: PropTypes.oneOf(["bar", "line", "split"]).isRequired,
    series: PropTypes.arrayOf(seriesShape),
    parts: PropTypes.array,
  }).isRequired,
  model: modelShape.isRequired,
};

// Tabla compacta de un cuadro: una fila por indicador y una columna por año.
// Los indicadores con semáforo llevan su punto; los informativos solo la cifra.
function CuadroTable({ rows, years, model }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-card-border">
            <th className="text-left py-1.5 px-2 font-subtitle">Concepto</th>
            {years.map((y) => (
              <th key={y.id} className="text-right py-1.5 px-1.5 font-subtitle whitespace-nowrap">
                {yearLabel(y)}
                {isPartial(y) && <span className="block text-[10px] font-normal text-muted">parcial</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((key) => {
            const def = defOf(key);
            if (!def) return null;
            return (
              <tr key={key} className="border-b border-card-border/50 last:border-0">
                <td className="py-1.5 px-2 min-w-[120px]">{def.label}</td>
                {years.map((y) => {
                  const v = model.value(key, y);
                  const reason = model.reason(key, y);
                  return (
                    <td key={y.id} className="py-1.5 px-1.5 text-right align-top tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {def.semaforo && <SemaforoDot status={model.status(key, y)} />}
                        <span>{formatRatio(def, v)}</span>
                      </span>
                      {/* El motivo del N/A se parte en líneas para no ensanchar la columna. */}
                      {v == null && reason && <span className="block text-[10px] text-muted leading-tight max-w-[88px] ml-auto">{reason}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

CuadroTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.string).isRequired,
  years: PropTypes.arrayOf(yearShape).isRequired,
  model: modelShape.isRequired,
};

// Un cuadro del informe: título, pista, gráfica y tabla.
function CuadroCard({ index, cuadro, years, model }) {
  return (
    <Card className="glass break-inside-avoid">
      <CardContent className="p-4 space-y-3">
        <div>
          <h2 className="font-subtitle text-base">
            <span className="text-muted mr-1.5">{index}.</span>
            {cuadro.title}
          </h2>
          {cuadro.hint && <p className="text-[11px] text-muted">{cuadro.hint}</p>}
        </div>
        <CuadroChart chart={cuadro.chart} model={model} />
        <CuadroTable rows={cuadro.rows} years={years} model={model} />
      </CardContent>
    </Card>
  );
}

CuadroCard.propTypes = {
  index: PropTypes.number.isRequired,
  cuadro: PropTypes.shape({
    key: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    hint: PropTypes.string,
    rows: PropTypes.arrayOf(PropTypes.string).isRequired,
    chart: PropTypes.object.isRequired,
  }).isRequired,
  years: PropTypes.arrayOf(yearShape).isRequired,
  model: modelShape.isRequired,
};

// Lectura unificada de las cifras del informe por indicador y año.
function buildModel({ sections, years }) {
  const ratios = computeRatios({ sections, years });
  const income = computeIncome({ sections, years });
  const value = (key, y) => {
    if (key === "gasto_operativo_pct") return income[y.id]?.pct?.gastoOperativo ?? null;
    if (key === "efectivo_final") return ratios[y.id]?.aux?.efectivo ?? null;
    return ratios[y.id]?.values?.[key] ?? null;
  };
  const status = (key, y) => ratios[y.id]?.status?.[key] ?? null;
  const reason = (key, y) => ratios[y.id]?.na?.[key] ?? null;
  // Filas para recharts: una por año, con las series pedidas. El rótulo del
  // eje es solo "jun 2026"; que es parcial se dice en el tooltip.
  const chartData = (series) =>
    years.map((y) => ({
      name: yearLabel(y),
      partial: isPartial(y) ? `${y.months} meses` : null,
      ...Object.fromEntries(series.map((s) => [s.key, value(s.key, y)])),
    }));
  // Sin Balance ni Estado de Resultados en ningún año no hay nada que mostrar.
  const noData =
    years.length > 0 &&
    years.every((y) => {
      const aux = ratios[y.id]?.aux;
      return !aux || ((aux.totalActivo ?? 0) === 0 && (aux.ventas ?? 0) === 0);
    });
  return { ratios, value, status, reason, chartData, noData };
}

export default function FinAnalysisReport() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await FinAnalysis.getOrCreate();
        const [ys, stored] = await Promise.all([
          FinYear.list(a.id),
          FinValue.getSections(a.id, [INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION]),
        ]);
        if (active) {
          setAnalysis(a);
          setYears(ys);
          setSections(stored);
        }
      } catch (err) {
        console.error("Error al cargar el informe financiero:", err);
        if (active) setError("No pudimos cargar la información. Intenta recargar la página.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const model = useMemo(() => buildModel({ sections, years }), [sections, years]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6 animate-pulse h-80" />
          <div className="glass rounded-3xl p-6 animate-pulse h-80" />
        </div>
      </div>
    );
  }

  const last = years.length ? years[years.length - 1] : null;
  const first = years.length ? years[0] : null;
  const hasIncome = hasAny(sections[INCOME_SECTION]);
  const hasBalance = hasAny(sections[BALANCE_SECTION]);
  const ready = years.length > 0 && !model.noData;
  const period =
    years.length > 1 ? `${yearLabel(first)} – ${yearLabel(last)}` : last ? yearLabel(last) : "";

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24 print:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-6 h-6 text-cyan-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-title">Informe</h1>
            <p className="text-muted">
              {analysis?.company_name
                ? `${analysis.company_name} · los diez cuadros del análisis, listos para presentar.`
                : "Los diez cuadros del análisis, listos para presentar."}
            </p>
          </div>
        </div>
        {/* En móvil pasa a su propia línea (la fila envuelve) para no desbordar la página. */}
        {ready && (
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="glass hover:border-accent font-subtitle flex-shrink-0 w-full sm:w-auto"
          >
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        )}
      </div>

      {/* Título para impresión */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-title">{analysis?.company_name || "Análisis Financiero"}</h1>
        <p className="text-sm text-muted">
          Informe financiero{period ? ` · ${period}` : ""} · cifras en miles
        </p>
      </div>

      {/* Intro */}
      <Card className="glass print:hidden">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Este informe <strong>se arma solo</strong> con las razones financieras ya calculadas: cada
            cuadro trae una gráfica y su tabla por año, en el mismo orden que el modelo original.
            Las cifras en miles son montos; los porcentajes, días y veces son indicadores. Usa el botón{" "}
            <strong>Imprimir</strong> para llevarlo a PDF o papel.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
      )}

      {!error && years.length === 0 && (
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
      )}

      {!error && years.length > 0 && model.noData && (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              Para armar el informe necesitamos el Estado de Resultados y el Balance General.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              {!hasIncome && (
                <Link to={createPageUrl("FinAnalysisIncome")}>
                  <Button variant="outline" className="glass hover:border-accent font-subtitle">
                    Ir al Estado de Resultados →
                  </Button>
                </Link>
              )}
              {!hasBalance && (
                <Link to={createPageUrl("FinAnalysisBalance")}>
                  <Button variant="outline" className="glass hover:border-accent font-subtitle">
                    Ir al Balance General →
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!error && ready && (
        <>
          {isPartial(last) && (
            <p className="text-xs text-muted flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {yearLabel(last)} es un periodo parcial de {last.months} meses: el crecimiento en ventas, el ROA
                y el ROE están anualizados; los días se calculan sobre {last.months * 30} días; el resto son
                cifras reales del periodo.
              </span>
            </p>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {CUADROS.map((c, i) => (
              <CuadroCard key={c.key} index={i + 1} cuadro={c} years={years} model={model} />
            ))}
          </div>

          <p className="text-xs text-muted flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Cifras en miles. Días con saldos al cierre (sin promedios) sobre meses × 30. Los puntos de
              color siguen el semáforo de las Razones financieras, con umbrales de referencia general; las
              cifras sin punto son informativas.
            </span>
          </p>
        </>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap print:hidden">
        <Link to={createPageUrl("FinAnalysisRatios")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Razones financieras
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Volver al Inicio →
          </Button>
        </Link>
      </div>
    </div>
  );
}
