import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, Gauge, Sparkles, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  yearLabel,
  RATIO_GROUPS,
  RATIO_DEFS,
  RATIO_BY_KEY,
  formatRatio,
  toNumber,
} from "@/config/finConfig";
import { computeRatios, summarizeRatios, ratioTrend } from "@/config/finCalc";
import { SemaforoDot, SemaforoBadge, STATUS_STYLES } from "@/components/fin/Semaforo";

// Razones financieras del modelo MP-AFH1: seis grupos de indicadores
// calculados en vivo a partir del Estado de Resultados, del Balance General
// y del Estado de cambios. Aquí no se captura nada; la pantalla solo lee y
// explica. Los indicadores con semáforo llevan punto de color y tendencia
// coloreada; los informativos (`semaforo: false`, p. ej. todo el bloque
// "Flujo de efectivo", en miles) muestran la cifra sin punto y con una
// flecha neutra, y no cuentan en la lectura rápida.
// Días: saldos al cierre sobre `meses × 30`; crecimiento, ROA y ROE se
// anualizan en periodos parciales; lo demás usa las cifras reales.

const isPartial = (y) => y && y.months < 12;
const isNum = (v) => typeof v === "number" && isFinite(v);

// Indicadores que se anualizan cuando el periodo es parcial.
const ANNUALIZED_KEYS = new Set(["crecimiento_ventas", "roa", "roe"]);

const N_TOTAL = RATIO_DEFS.length;
const N_SEMAFORO = RATIO_DEFS.filter((d) => d.semaforo).length;

// ¿Hay algún valor capturado en la sección para ese año? ({ [concepto]: { [yearId]: v } })
const hasAnyForYear = (section, yearId) =>
  Object.values(section || {}).some((byYear) => toNumber(byYear?.[yearId]) != null);

const yearShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  year: PropTypes.number,
  months: PropTypes.number,
});

const defShape = PropTypes.shape({
  key: PropTypes.string.isRequired,
  label: PropTypes.string,
  format: PropTypes.string,
  semaforo: PropTypes.bool,
  what: PropTypes.string,
  how: PropTypes.string,
  formula: PropTypes.string,
});

// Celda de un indicador en un año: punto de semáforo (solo si el indicador
// lo lleva) + valor formateado. Si no se puede calcular muestra "—" y el
// motivo debajo.
function RatioCell({ def, value, status, reason }) {
  return (
    <td className="p-2 text-right whitespace-nowrap align-top">
      <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
        {def.semaforo && <SemaforoDot status={status} />}
        <span>{formatRatio(def, value)}</span>
      </span>
      {value == null && reason && <span className="block text-[10px] text-muted">{reason}</span>}
    </td>
  );
}

RatioCell.propTypes = {
  def: defShape.isRequired,
  value: PropTypes.number,
  status: PropTypes.oneOf(["verde", "ambar", "rojo"]),
  reason: PropTypes.string,
};

// Tendencia del último periodo contra el anterior. La flecha indica hacia
// dónde se movió el valor; en los indicadores con semáforo el color dice si
// eso es bueno o malo; en los informativos la flecha va en gris, porque
// "más" no es necesariamente mejor. Como el glifo solo no lo transmite, un
// texto solo para lectores de pantalla lo dice en palabras (el glifo va
// aria-hidden).
function TrendCell({ def, trend, curr, prev }) {
  let glyph = "—";
  let cls = "text-muted";
  let title = "Sin tendencia";
  const both = isNum(curr) && isNum(prev);
  // Si el valor formateado no cambia (6.6% → 6.6%), una flecha confundiría:
  // se muestra como "sin cambio apreciable".
  const sameText = both && formatRatio(def, curr) === formatRatio(def, prev);
  if (!def.semaforo) {
    // Informativo: solo dirección, sin color.
    if (both && (sameText || Math.abs(curr - prev) < 1e-9)) {
      glyph = "=";
      title = "Sin cambio apreciable";
    } else if (both) {
      glyph = curr > prev ? "▲" : "▼";
      title = curr > prev ? "Subió respecto al periodo anterior" : "Bajó respecto al periodo anterior";
    }
  } else if (trend === "igual" || (trend != null && sameText)) {
    glyph = "=";
    title = trend === "igual" ? "Sin cambio" : "Sin cambio apreciable";
  } else if (trend === "mejora" || trend === "empeora") {
    const up = (curr ?? 0) >= (prev ?? 0);
    glyph = up ? "▲" : "▼";
    cls = `${trend === "mejora" ? STATUS_STYLES.verde.text : STATUS_STYLES.rojo.text} font-subtitle`;
    title = trend === "mejora" ? "Mejora respecto al periodo anterior" : "Empeora respecto al periodo anterior";
  }
  return (
    // `relative`: el texto sr-only es absoluto y sin ancestro posicionado se
    // salía del contenedor con scroll, provocando scroll horizontal en móvil.
    <td className="relative p-2 text-center whitespace-nowrap align-top" title={title}>
      <span className={cls} aria-hidden="true">
        {glyph}
      </span>
      <span className="sr-only">{title}</span>
    </td>
  );
}

TrendCell.propTypes = {
  def: defShape.isRequired,
  trend: PropTypes.oneOf(["mejora", "empeora", "igual"]),
  curr: PropTypes.number,
  prev: PropTypes.number,
};

// Nota corta bajo el título del grupo cuando tiene filas informativas.
function groupNote(group, defs) {
  const informativos = defs.filter((d) => !d.semaforo).length;
  if (informativos === 0) return null;
  if (group.key === "flujo") {
    return "Cifras en miles, informativas (sin semáforo). EBIT y EBITDA se calculan en todos los periodos; las demás salen del Estado de cambios y por eso no aplican en el primer periodo.";
  }
  return "Las filas sin punto de color son cifras informativas: no llevan semáforo.";
}

// Una tarjeta por grupo (eficiencia, flujo, liquidez, …) con su tabla.
function RatioGroupCard({ group, defs, years, ratios, expanded, onToggle }) {
  const hasTrend = years.length >= 2;
  const last = years[years.length - 1];
  const prev = hasTrend ? years[years.length - 2] : null;
  const colSpan = years.length + 1 + (hasTrend ? 1 : 0);
  const lastRatios = ratios[last?.id];
  const note = groupNote(group, defs);

  // Pistas de lectura para el último periodo: base de días y anualización.
  const periodNote = (def) => {
    if (!lastRatios) return null;
    const months = lastRatios.months ?? 12;
    if (def.format === "days") {
      return `Días del periodo en ${yearLabel(last)}: ${months * 30} (${months} meses × 30). Saldos al cierre, sin promedios.`;
    }
    if (ANNUALIZED_KEYS.has(def.key) && isPartial(last)) {
      return `En ${yearLabel(last)} la cifra está anualizada (${months} meses llevados a 12).`;
    }
    return null;
  };

  return (
    <Card className="glass">
      <CardContent className="relative p-4 overflow-x-auto">
        <h2 className="font-subtitle text-lg px-2 pt-1">{group.title}</h2>
        <p className="text-xs text-muted px-2">{group.question}</p>
        {note && <p className="text-[11px] text-muted px-2 mt-1 mb-2">{note}</p>}
        {!note && <div className="mb-2" />}
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left p-2 font-subtitle">Concepto</th>
              {years.map((y) => (
                <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">
                  {yearLabel(y)}
                  {isPartial(y) && (
                    <span className="block text-[10px] font-normal text-muted">parcial · {y.months} meses</span>
                  )}
                </th>
              ))}
              {hasTrend && <th className="text-center p-2 font-subtitle whitespace-nowrap">Tendencia</th>}
            </tr>
          </thead>
          <tbody>
            {defs.map((def) => {
              const open = expanded.has(def.key);
              const currV = ratios[last?.id]?.values?.[def.key] ?? null;
              const prevV = prev ? ratios[prev.id]?.values?.[def.key] ?? null : null;
              const extra = periodNote(def);
              return (
                <React.Fragment key={def.key}>
                  <tr className={`border-b border-card-border/50 ${open ? "bg-accent/5" : ""}`}>
                    <td className="p-2 min-w-[220px]">
                      <button
                        type="button"
                        onClick={() => onToggle(def.key)}
                        aria-expanded={open}
                        className="inline-flex items-center gap-1.5 text-left hover:text-accent transition-colors"
                      >
                        {def.label}
                        <Info className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      </button>
                    </td>
                    {years.map((y) => {
                      const r = ratios[y.id];
                      return (
                        <RatioCell
                          key={y.id}
                          def={def}
                          value={r?.values?.[def.key] ?? null}
                          status={r?.status?.[def.key] ?? null}
                          reason={r?.na?.[def.key]}
                        />
                      );
                    })}
                    {hasTrend && <TrendCell def={def} trend={ratioTrend(def, currV, prevV)} curr={currV} prev={prevV} />}
                  </tr>
                  {open && (
                    <tr className="bg-accent/5 border-b border-card-border/50">
                      <td colSpan={colSpan} className="p-0">
                        {/* En móvil la tabla mide 640px y se desplaza; la explicación se
                            queda pegada al borde izquierdo y nunca más ancha que la pantalla. */}
                        <div className="sticky left-0 max-w-[calc(100vw-4.5rem)] p-3 pl-4 text-xs text-muted space-y-1.5">
                          <p>
                            <span className="font-subtitle text-foreground">¿Qué mide? </span>
                            {def.what}
                          </p>
                          <p>
                            <span className="font-subtitle text-foreground">¿Cómo leerlo? </span>
                            {def.how}
                          </p>
                          <p>
                            <span className="font-subtitle text-foreground">Fórmula: </span>
                            {def.formula}
                          </p>
                          {extra && <p>{extra}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

RatioGroupCard.propTypes = {
  group: PropTypes.shape({
    key: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    question: PropTypes.string,
  }).isRequired,
  defs: PropTypes.arrayOf(defShape).isRequired,
  years: PropTypes.arrayOf(yearShape).isRequired,
  ratios: PropTypes.object.isRequired,
  expanded: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
};

// Lectura rápida del último periodo: contadores del semáforo y lo que más
// llama la atención (rojos primero, luego ámbar). `summarizeRatios` solo
// cuenta los indicadores con semáforo; los informativos quedan fuera. Sin
// Balance de ese periodo no se muestra: el motor devolvería N/A con semáforo
// por saldos en cero que no están capturados.
function QuickRead({ year, ratios, hasBalance }) {
  const summary = summarizeRatios(ratios);
  const counters = [
    { status: "verde", label: "Sanos", n: summary.verde },
    { status: "ambar", label: "Por vigilar", n: summary.ambar },
    { status: "rojo", label: "Por atender", n: summary.rojo },
  ];
  const top = (summary.atencion || []).slice(0, 3);

  return (
    <Card className="glass">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="font-subtitle text-lg">
            Lectura rápida · {yearLabel(year)}
            {isPartial(year) && (
              <span className="text-sm text-muted font-normal"> · parcial, {year.months} meses</span>
            )}
          </h2>
          <p className="text-xs text-muted">
            Sobre los {N_SEMAFORO} indicadores con semáforo; las cifras informativas no entran en el conteo.
          </p>
        </div>
        {!hasBalance ? (
          <p className="text-sm text-muted">
            Captura el{" "}
            <Link to={createPageUrl("FinAnalysisBalance")} className="text-accent hover:underline font-subtitle">
              Balance General
            </Link>{" "}
            de {yearLabel(year)} para ver el semáforo de este periodo.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {counters.map((c) => (
                <div key={c.status} className="glass rounded-2xl p-4">
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <SemaforoDot status={c.status} /> {c.label}
                  </p>
                  <p className={`text-2xl font-title ${STATUS_STYLES[c.status].text}`}>{c.n}</p>
                </div>
              ))}
            </div>
            {summary.na > 0 && (
              <p className="text-xs text-muted">
                {summary.na === 1 ? "1 indicador no aplica" : `${summary.na} indicadores no aplican`} en este periodo.
              </p>
            )}
            <div>
              <h3 className="font-subtitle text-sm mb-2">Lo que más llama la atención</h3>
              {top.length === 0 ? (
                <p className="text-sm text-muted">Ningún indicador en rojo o ámbar en este periodo.</p>
              ) : (
                <ul className="space-y-2">
                  {top.map((item) => {
                    const def = RATIO_BY_KEY[item.key];
                    if (!def) return null;
                    const text = item.value == null ? ratios?.na?.[item.key] || "—" : formatRatio(def, item.value);
                    return (
                      <li key={item.key} className="glass rounded-xl p-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="font-subtitle text-sm">{def.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm whitespace-nowrap">{text}</span>
                            <SemaforoBadge status={item.status} />
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-1">{def.how}</p>
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
  );
}

QuickRead.propTypes = {
  year: yearShape.isRequired,
  ratios: PropTypes.shape({
    months: PropTypes.number,
    values: PropTypes.object,
    status: PropTypes.object,
    na: PropTypes.object,
    aux: PropTypes.object,
  }),
  hasBalance: PropTypes.bool.isRequired,
};

export default function FinAnalysisRatios() {
  const [years, setYears] = useState([]);
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, stored] = await Promise.all([
        FinYear.list(a.id),
        // El bloque "Flujo de efectivo" sale del Estado de cambios, que
        // además del Balance usa las capturas complementarias de `cashflow`.
        FinValue.getSections(a.id, [INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION]),
      ]);
      setYears(ys);
      setSections(stored);
    } catch (err) {
      console.error("Error al cargar las razones financieras:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ratios = useMemo(() => computeRatios({ sections, years }), [sections, years]);

  const toggle = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Sin Balance ni Estado de Resultados en ningún año no hay nada que calcular.
  const noData = useMemo(
    () =>
      years.length > 0 &&
      years.every((y) => {
        const aux = ratios[y.id]?.aux;
        return !aux || ((aux.totalActivo ?? 0) === 0 && (aux.ventas ?? 0) === 0);
      }),
    [years, ratios]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  const last = years.length ? years[years.length - 1] : null;
  // La lectura rápida exige Balance del último periodo (se decide por periodo).
  const lastHasBalance = !!last && hasAnyForYear(sections[BALANCE_SECTION], last.id);

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
            <Gauge className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Razones financieras</h1>
            <p className="text-muted">
              La salud financiera de tu empresa en {N_TOTAL} indicadores agrupados en seis temas ({N_SEMAFORO} con
              semáforo), explicados en lenguaje llano.
            </p>
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
            Esta pantalla <strong>se calcula sola</strong> a partir del Estado de Resultados, del Balance
            General y del Estado de cambios; aquí no capturas nada. Los indicadores con semáforo verde,
            ámbar o rojo usan <strong>umbrales de referencia general</strong>; las cifras informativas
            (sin punto de color) se muestran para leerlas junto con las demás. Tu industria puede tener
            valores normales distintos: úsalos como guía para hacerte preguntas, no como veredicto.
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

      {!error && years.length > 0 && noData && (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              Para calcular las razones necesitamos el Estado de Resultados y el Balance General.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link to={createPageUrl("FinAnalysisIncome")}>
                <Button variant="outline" className="glass hover:border-accent font-subtitle">
                  Ir al Estado de Resultados →
                </Button>
              </Link>
              <Link to={createPageUrl("FinAnalysisBalance")}>
                <Button variant="outline" className="glass hover:border-accent font-subtitle">
                  Ir al Balance General →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!error && years.length > 0 && !noData && (
        <>
          {last && ratios[last.id] && (
            <QuickRead year={last} ratios={ratios[last.id]} hasBalance={lastHasBalance} />
          )}

          {RATIO_GROUPS.map((g) => (
            <RatioGroupCard
              key={g.key}
              group={g}
              defs={RATIO_DEFS.filter((d) => d.group === g.key)}
              years={years}
              ratios={ratios}
              expanded={expanded}
              onToggle={toggle}
            />
          ))}

          <p className="text-xs text-muted flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Umbrales de referencia general para PyMEs; cada industria tiene sus rangos normales. Los
              días se calculan con los saldos al cierre (sin promedios) sobre los días del periodo
              (meses × 30: 360 en un año completo, 180 en un semestre). En periodos parciales solo el
              crecimiento en ventas, el ROA y el ROE se anualizan; los demás indicadores usan las
              cifras reales del periodo. El bloque Flujo de efectivo son montos en miles, sin semáforo.
            </span>
          </p>
        </>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisCashflow")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Estado de cambios
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisReport")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Informe →
          </Button>
        </Link>
      </div>
    </div>
  );
}
