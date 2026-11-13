import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, History, Info, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  INCOME_ROWS,
  RATIO_GROUPS,
  RATIO_DEFS,
  formatRatio,
  yearLabel,
  fmtMiles,
  fmtPct,
} from "@/config/finConfig";
import {
  computeIncome,
  computeBalance,
  computeRatios,
  ratioTrend,
  sortPeriods,
  basePeriod,
  previousCut,
  sameCutPriorYear,
} from "@/config/finCalc";
import { Delta, DeltaPP } from "@/components/fin/Delta";
import { SemaforoDot, STATUS_STYLES } from "@/components/fin/Semaforo";
import { incomeComparison } from "@/lib/finIncomeCompare";

// Comparativo de cortes. Toma un corte (por defecto el más reciente) y lo
// pone junto a tres referencias, cada una con su propia regla:
//  1. El corte anterior del MISMO año (oct 2026 vs jun 2026). Los montos
//     acumulados no son comparables tal cual (octubre trae más meses), así
//     que el cambio en monto se mide con ambos llevados a 12 meses ("ritmo
//     anualizado"). Márgenes, días y razones sí se comparan directo.
//  2. El MISMO corte del año anterior (oct 2026 vs oct 2025). Es la
//     comparación más limpia: mismos meses, sin anualizar, respeta la
//     estacionalidad. Solo existe si ese corte se guardó.
//  3. El cierre del año anterior (la base de siempre), anualizando el parcial.
// Aquí no se captura nada: todo sale de los estados financieros.

// Renglones del Estado de Resultados que se comparan (subtotales + ventas y costo).
const INCOME_KEYS = ["ventas", "costo", "utilidadBruta", "gastoOperativo", "resultadoOp", "rif", "rai", "utilidadNeta"];
const INCOME_COMPARE = INCOME_KEYS.map((calc) => INCOME_ROWS.find((r) => r.calc === calc));

// Totales del Balance: más activo o capital es bueno; más pasivo, no.
const BALANCE_COMPARE = [
  { key: "activoCirculante", label: "Total activo circulante", better: "higher" },
  { key: "totalActivo", label: "Total activo", better: "higher" },
  { key: "pasivoCirculante", label: "Total pasivo circulante", better: "lower" },
  { key: "totalPasivo", label: "Total pasivo", better: "lower" },
  { key: "totalCapital", label: "Total capital contable", better: "higher" },
];

// Las razones del bloque "Flujo de efectivo" son flujos del periodo contra
// su base: no tiene sentido compararlas entre cortes.
const RATIO_COMPARE_GROUPS = RATIO_GROUPS.filter((g) => g.key !== "flujo");

const clean = (v) => (v == null || Number.isNaN(v) ? 0 : v || 0);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const periodShape = PropTypes.shape({ id: PropTypes.string, year: PropTypes.number, months: PropTypes.number });
const refShape = PropTypes.shape({
  key: PropTypes.string,
  period: periodShape,
  annualize: PropTypes.bool,
  title: PropTypes.string,
  hint: PropTypes.string,
});

// Cifra de un periodo: monto en miles y su % sobre ventas (o sobre activo).
function AmountBlock({ value, pct }) {
  const v = clean(value);
  return (
    <>
      <span className={`block ${v < 0 ? "text-red-500" : ""}`}>{fmtMiles.format(v)}</span>
      {pct !== undefined && <span className="block text-[11px] text-muted font-normal">{fmtPct(pct)}</span>}
    </>
  );
}

AmountBlock.propTypes = { value: PropTypes.number, pct: PropTypes.number };

// Celda de una referencia en el Estado de Resultados: su cifra y, debajo,
// cuánto cambió el corte analizado contra ella (monto y puntos porcentuales).
function IncomeRefCell({ calc, curr, currPct, currPeriod, refPeriod, refValue, refPct, annualize }) {
  const c = incomeComparison(calc, curr ?? 0, refValue ?? 0, currPct, refPct);
  return (
    <td className="p-2 text-right whitespace-nowrap align-top border-l border-card-border/40">
      <span className="text-muted">
        <AmountBlock value={refValue} pct={refPct} />
      </span>
      <Delta
        curr={c.curr}
        prev={c.prev}
        currYear={annualize ? currPeriod : undefined}
        prevYear={annualize ? refPeriod : undefined}
        better={c.amountBetter}
        className="font-normal"
      />
      <DeltaPP curr={c.currPct} prev={c.prevPct} better={c.pctBetter} className="font-normal" />
    </td>
  );
}

IncomeRefCell.propTypes = {
  calc: PropTypes.string.isRequired,
  curr: PropTypes.number,
  currPct: PropTypes.number,
  currPeriod: periodShape,
  refPeriod: periodShape,
  refValue: PropTypes.number,
  refPct: PropTypes.number,
  annualize: PropTypes.bool,
};

// Flecha de una razón contra una referencia: hacia dónde se movió y, si el
// indicador tiene dirección buena, en verde o rojo.
function RatioRefCell({ def, curr, refValue }) {
  let glyph = null;
  let cls = "text-muted";
  let title = "";
  if (isNum(curr) && isNum(refValue)) {
    const same = formatRatio(def, curr) === formatRatio(def, refValue);
    const trend = ratioTrend(def, curr, refValue);
    const colored = def.semaforo || def.trendBetter;
    if (same) {
      glyph = "=";
      title = "Sin cambio apreciable";
    } else {
      const up = curr > refValue;
      glyph = up ? "▲" : "▼";
      title = up ? "Subió" : "Bajó";
      if (colored && (trend === "mejora" || trend === "empeora")) {
        cls = trend === "mejora" ? STATUS_STYLES.verde.text : STATUS_STYLES.rojo.text;
        title += trend === "mejora" ? ": mejora" : ": empeora";
      }
    }
  }
  return (
    <td className="relative p-2 text-right whitespace-nowrap align-top border-l border-card-border/40" title={title || undefined}>
      <span className="text-muted tabular-nums">{formatRatio(def, refValue)}</span>
      {glyph && (
        <span className={`ml-2 text-[11px] ${cls}`} aria-hidden="true">
          {glyph}
        </span>
      )}
      {title && <span className="sr-only">{title}</span>}
    </td>
  );
}

RatioRefCell.propTypes = {
  def: PropTypes.object.isRequired,
  curr: PropTypes.number,
  refValue: PropTypes.number,
};

// Encabezado de una columna de referencia.
function RefHead({ reference }) {
  return (
    <th className="text-right p-2 font-subtitle whitespace-nowrap align-bottom border-l border-card-border/40">
      <span className="block text-[10px] font-normal uppercase tracking-wide text-muted">{reference.title}</span>
      {yearLabel(reference.period)}
      <span className="block text-[10px] font-normal text-muted">{reference.hint}</span>
    </th>
  );
}

RefHead.propTypes = { reference: refShape.isRequired };

export default function FinAnalysisCuts() {
  const [years, setYears] = useState([]);
  const [sections, setSections] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, stored] = await Promise.all([
        FinYear.list(a.id),
        FinValue.getSections(a.id, [INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION]),
      ]);
      setYears(sortPeriods(ys));
      setSections(stored);
    } catch (err) {
      console.error("Error al cargar el comparativo de cortes:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const income = useMemo(() => computeIncome({ sections, years }), [sections, years]);
  const balance = useMemo(() => computeBalance({ sections, years }), [sections, years]);
  const ratios = useMemo(() => computeRatios({ sections, years }), [sections, years]);

  // Corte analizado: el elegido o, por defecto, el más reciente.
  const current = years.find((y) => y.id === selectedId) || years[years.length - 1] || null;

  // Referencias disponibles para el corte analizado, en el orden de lectura.
  const references = useMemo(() => {
    if (!current) return [];
    const prevCut = previousCut(years, current);
    const sameCut = sameCutPriorYear(years, current);
    const base = basePeriod(years, current);
    const list = [];
    if (prevCut) {
      list.push({ key: "prevCut", period: prevCut, annualize: true, title: "Corte anterior", hint: "mismo año · ritmo anualizado" });
    }
    if (sameCut) {
      list.push({ key: "sameCut", period: sameCut, annualize: false, title: "Mismo corte", hint: "año anterior · mismos meses" });
    }
    // El cierre anterior solo aporta si no es ya el "mismo corte" (un cierre
    // de 12 meses contra el cierre previo).
    if (base && base.id !== sameCut?.id) {
      list.push({
        key: "base",
        period: base,
        annualize: true,
        title: base.months >= 12 ? "Cierre anterior" : "Último corte anterior",
        hint: current.months < 12 || base.months < 12 ? "llevado a 12 meses" : "año completo",
      });
    }
    return list;
  }, [years, current]);

  const hasPrevCut = references.some((r) => r.key === "prevCut");
  const hasSameCut = references.some((r) => r.key === "sameCut");

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-48" />
        ))}
      </div>
    );
  }

  const cur = current ? income[current.id] : null;
  const curBal = current ? balance[current.id] : null;
  const curRatios = current ? ratios[current.id] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="outline" size="icon" className="glass hover:border-accent flex-shrink-0" aria-label="Volver al inicio del análisis">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <History className="w-6 h-6 text-cyan-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-title">Comparativo de cortes</h1>
            <p className="text-muted">Cómo va el año contra tus cortes anteriores y contra el mismo corte del año pasado.</p>
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
            Esta pantalla <strong>se calcula sola</strong> con los periodos que tienes en Datos generales. Cada vez que
            tengas cifras más recientes del mismo año, agrégalas ahí con <strong>+ Corte</strong> en lugar de editar el
            parcial: el anterior se conserva y aquí los ves lado a lado. Elige el corte que quieres analizar y léelo
            contra sus referencias.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
      )}

      {!error && years.length === 0 && (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">Aún no hay periodos. Empieza por definir los años en Datos generales.</p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">Ir a Datos generales →</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!error && current && (
        <>
          {/* Selector de corte */}
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="fin-cut" className="text-sm font-subtitle">Corte a analizar</label>
            <select
              id="fin-cut"
              value={current.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="p-2 rounded-lg glass text-foreground outline-none focus:border-accent bg-transparent min-w-[180px]"
            >
              {[...years].reverse().map((y) => (
                <option key={y.id} value={y.id}>
                  {yearLabel(y)}
                  {y.months < 12 ? ` · parcial, ${y.months} ${y.months === 1 ? "mes" : "meses"}` : " · año completo"}
                </option>
              ))}
            </select>
          </div>

          {references.length === 0 ? (
            <Card className="glass">
              <CardContent className="p-6 text-sm text-muted space-y-2">
                <p>
                  <strong className="text-foreground">{yearLabel(current)}</strong> todavía no tiene contra qué compararse:
                  no hay un año anterior ni otro corte del mismo año.
                </p>
                <p>Agrega un año anterior o, cuando tengas cifras más recientes de este año, un nuevo corte en Datos generales.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {(!hasPrevCut || !hasSameCut) && (
                <p className="text-xs text-muted flex items-start gap-2 px-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    {!hasPrevCut && `${yearLabel(current)} es el primer corte guardado de ${current.year}: cuando agregues el siguiente, aquí aparecerá la comparación entre ambos. `}
                    {!hasSameCut && `No hay un corte a ${current.months} ${current.months === 1 ? "mes" : "meses"} de ${current.year - 1}; si lo capturas, podrás comparar contra los mismos meses del año pasado.`}
                  </span>
                </p>
              )}

              {/* Estado de Resultados */}
              <Card className="glass">
                <CardContent className="p-4 overflow-x-auto">
                  <h2 className="font-title text-lg px-2 pb-2">Estado de Resultados</h2>
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-card-border">
                        <th className="text-left p-2 font-subtitle">Concepto</th>
                        <th className="text-right p-2 font-subtitle whitespace-nowrap align-bottom">
                          <span className="block text-[10px] font-normal uppercase tracking-wide text-muted">Corte analizado</span>
                          {yearLabel(current)}
                          <span className="block text-[10px] font-normal text-muted">
                            {current.months < 12 ? `acumulado a ${current.months} ${current.months === 1 ? "mes" : "meses"}` : "año completo"}
                          </span>
                        </th>
                        {references.map((r) => <RefHead key={r.key} reference={r} />)}
                      </tr>
                    </thead>
                    <tbody>
                      {INCOME_COMPARE.map((row) => {
                        const isTotal = row.type === "total";
                        return (
                          <tr key={row.calc} className={`border-b border-card-border/50 ${isTotal ? "bg-accent/5 font-subtitle" : ""}`}>
                            <td className="p-2 align-top min-w-[200px]">
                              {row.label}
                              <span className="block text-[11px] text-muted font-normal" aria-hidden="true">
                                <span className="block">% de ventas</span>
                                <span className="block">Cambio en monto</span>
                                <span className="block">Cambio % de ventas</span>
                              </span>
                            </td>
                            <td className="p-2 text-right whitespace-nowrap align-top">
                              <AmountBlock value={cur?.[row.calc]} pct={cur?.pct?.[row.calc]} />
                            </td>
                            {references.map((r) => (
                              <IncomeRefCell
                                key={r.key}
                                calc={row.calc}
                                curr={cur?.[row.calc]}
                                currPct={cur?.pct?.[row.calc]}
                                currPeriod={current}
                                refPeriod={r.period}
                                refValue={income[r.period.id]?.[row.calc]}
                                refPct={income[r.period.id]?.pct?.[row.calc]}
                                annualize={r.annualize}
                              />
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Balance */}
              <Card className="glass">
                <CardContent className="p-4 overflow-x-auto">
                  <h2 className="font-title text-lg px-2 pb-2">Balance General</h2>
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-card-border">
                        <th className="text-left p-2 font-subtitle">Concepto</th>
                        <th className="text-right p-2 font-subtitle whitespace-nowrap">{yearLabel(current)}</th>
                        {references.map((r) => (
                          <th key={r.key} className="text-right p-2 font-subtitle whitespace-nowrap border-l border-card-border/40">
                            {yearLabel(r.period)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BALANCE_COMPARE.map((row) => (
                        <tr key={row.key} className="border-b border-card-border/50">
                          <td className="p-2 align-top min-w-[200px]">{row.label}</td>
                          <td className="p-2 text-right whitespace-nowrap align-top">
                            <AmountBlock value={curBal?.[row.key]} />
                          </td>
                          {references.map((r) => (
                            <td key={r.key} className="p-2 text-right whitespace-nowrap align-top border-l border-card-border/40">
                              <span className="text-muted">
                                <AmountBlock value={balance[r.period.id]?.[row.key]} />
                              </span>
                              <Delta curr={curBal?.[row.key] ?? 0} prev={balance[r.period.id]?.[row.key] ?? 0} better={row.better} className="font-normal" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-muted px-2 pt-2">
                    Los saldos del Balance son una foto a la fecha del corte: se comparan directo, sin anualizar.
                  </p>
                </CardContent>
              </Card>

              {/* Razones */}
              {RATIO_COMPARE_GROUPS.map((group) => {
                const defs = RATIO_DEFS.filter((d) => d.group === group.key);
                return (
                  <Card key={group.key} className="glass">
                    <CardContent className="p-4 overflow-x-auto">
                      <h2 className="font-title text-lg px-2">{group.title}</h2>
                      <p className="text-xs text-muted px-2 pb-2">{group.question}</p>
                      <table className="w-full text-sm min-w-[640px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className="text-left p-2 font-subtitle">Concepto</th>
                            <th className="text-right p-2 font-subtitle whitespace-nowrap">{yearLabel(current)}</th>
                            {references.map((r) => (
                              <th key={r.key} className="text-right p-2 font-subtitle whitespace-nowrap border-l border-card-border/40">
                                {yearLabel(r.period)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {defs.map((def) => {
                            const v = curRatios?.values?.[def.key] ?? null;
                            return (
                              <tr key={def.key} className="border-b border-card-border/50">
                                <td className="p-2 min-w-[200px]">{def.label}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                  <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                                    {def.semaforo && <SemaforoDot status={curRatios?.status?.[def.key]} />}
                                    <span>{formatRatio(def, v)}</span>
                                  </span>
                                </td>
                                {references.map((r) => (
                                  <RatioRefCell key={r.key} def={def} curr={v} refValue={ratios[r.period.id]?.values?.[def.key] ?? null} />
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              })}

              <p className="text-xs text-muted flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Cifras en miles. En cada referencia se muestra su cifra y, debajo o al lado, cómo cambió{" "}
                  {yearLabel(current)} contra ella. <strong>Corte anterior</strong>: como un corte trae más meses
                  acumulados que el otro, el cambio en monto compara ambos llevados a 12 meses (ritmo anualizado); los
                  porcentajes sobre ventas, los días y las razones se comparan directo.{" "}
                  <strong>Mismo corte del año anterior</strong>: mismos meses, sin anualizar; es la comparación que mejor
                  respeta la estacionalidad. <strong>Cierre anterior</strong>: el parcial se lleva a 12 meses para
                  compararlo con el año completo. El crecimiento en ventas, el ROA y el ROE de cada periodo ya vienen
                  anualizados. Las cifras del bloque Flujo de efectivo no se incluyen: son flujos de cada periodo contra
                  su cierre anterior y no se comparan entre cortes.
                </span>
              </p>
            </>
          )}
        </>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisReport")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Informe
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisData")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">Datos generales →</Button>
        </Link>
      </div>
    </div>
  );
}
