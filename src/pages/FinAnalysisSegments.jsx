import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import {
  ArrowLeft,
  PieChart,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  Check,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  SALES_SECTION,
  SEGCOST_SECTION,
  INCOME_SECTION,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeSegments } from "@/config/finCalc";
import { Delta } from "@/components/fin/Delta";

// Margen bruto por segmento de negocio (análisis opcional, hoja "Ventas y
// Costo de lo vendido" del Excel). Los segmentos son dinámicos (fin_lines:
// agregar, renombrar, eliminar); se capturan ventas (`sales`) y costo de
// ventas (`segcost`) por segmento y año, en miles. Tres tablas: composición
// de las ventas, costos por segmento y resultado bruto por segmento. La suma
// de los segmentos debe coincidir con el Estado de Resultados: se muestra la
// diferencia por año.

const INPUT_CLASS =
  "w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right";

// Una diferencia es cero si no pasa del ruido de punto flotante.
const isZero = (v) => Math.abs(v) < 1e-6;

// ¿Hay alguna cifra capturada en esa sección para ese año?
const hasAny = (sectionValues, yearId) =>
  Object.values(sectionValues || {}).some((byYear) => toNumber(byYear?.[yearId]) != null);

// Encabezados de año con la marca "parcial".
function YearHeaders({ years }) {
  return years.map((y) => (
    <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">
      {yearLabel(y)}
      {y.months < 12 && <span className="block text-[10px] font-normal text-muted">parcial</span>}
    </th>
  ));
}
YearHeaders.propTypes = {
  years: PropTypes.array.isRequired,
};

// Porcentaje pequeño bajo una cifra (vacío cuando no se puede calcular).
function PctHint({ value }) {
  return (
    <span className="block text-[10px] text-muted text-right h-4 pr-1 mt-0.5">
      {value == null ? "" : fmtPct(value)}
    </span>
  );
}
PctHint.propTypes = {
  value: PropTypes.number,
};

// Celda de "Diferencia": ✓ 0 en verde; distinto en ámbar con aviso.
// `captured` = hay captura en esta tabla para el año; `refMissing` = no hay
// cifra de referencia en el Estado de Resultados.
function DiffCell({ value, captured, refMissing }) {
  if (!captured) {
    return (
      <span className="text-muted">
        —<span className="block text-[10px]">sin captura</span>
      </span>
    );
  }
  if (refMissing) {
    return (
      <span className="text-muted">
        {fmtMiles.format(value)}
        <span className="block text-[10px]">sin Estado de Resultados</span>
      </span>
    );
  }
  if (isZero(value)) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-500">
        <CheckCircle2 className="w-4 h-4" /> 0
      </span>
    );
  }
  return (
    <span className="text-amber-600 dark:text-amber-400">
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="w-4 h-4" /> {fmtMiles.format(value)}
      </span>
      <span className="block text-[10px]">revisa la captura</span>
    </span>
  );
}
DiffCell.propTypes = {
  value: PropTypes.number.isRequired,
  captured: PropTypes.bool.isRequired,
  refMissing: PropTypes.bool.isRequired,
};

export default function FinAnalysisSegments() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [lines, setLines] = useState([]);
  const [income, setIncome] = useState({}); // sección `income` tal como viene de la BD
  // { sales: { [lineId]: { [yearId]: "monto" } }, segcost: { ... } }
  const [values, setValues] = useState({ [SALES_SECTION]: {}, [SEGCOST_SECTION]: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLine, setNewLine] = useState("");
  const [editingLine, setEditingLine] = useState(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, ls, stored] = await Promise.all([
        FinYear.list(a.id),
        FinLine.list(a.id),
        FinValue.getSections(a.id, [SALES_SECTION, SEGCOST_SECTION, INCOME_SECTION]),
      ]);
      const toText = (section) => {
        const src = stored[section] || {};
        const map = {};
        ls.forEach((l) => {
          map[l.id] = {};
          ys.forEach((y) => {
            const v = src[l.id]?.[y.id];
            map[l.id][y.id] = v == null ? "" : String(v);
          });
        });
        return map;
      };
      setAnalysis(a);
      setYears(ys);
      setLines(ls);
      setIncome(stored[INCOME_SECTION] || {});
      setValues({ [SALES_SECTION]: toText(SALES_SECTION), [SEGCOST_SECTION]: toText(SEGCOST_SECTION) });
    } catch (err) {
      console.error("Error al cargar los segmentos:", err);
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
      Object.entries(values).forEach(([section, byLine]) => {
        Object.entries(byLine).forEach(([lineId, byYear]) => {
          Object.entries(byYear).forEach(([yearId, amount]) => {
            rows.push({ year_id: yearId, section, concept_key: lineId, amount: toNumber(amount) });
          });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (section, lineId, yearId, value) => {
    setValues((prev) => ({
      ...prev,
      [section]: { ...prev[section], [lineId]: { ...prev[section][lineId], [yearId]: value } },
    }));
  };

  const handleAddLine = async () => {
    const name = newLine.trim();
    if (!name || !analysis) return;
    try {
      const created = await FinLine.create(analysis.id, name, lines.length);
      if (created) {
        setLines((prev) => [...prev, created]);
        setValues((prev) => ({
          [SALES_SECTION]: { ...prev[SALES_SECTION], [created.id]: {} },
          [SEGCOST_SECTION]: { ...prev[SEGCOST_SECTION], [created.id]: {} },
        }));
        setNewLine("");
      }
    } catch (err) {
      console.error("Error al crear el segmento:", err);
      setError("No pudimos crear el segmento. Intenta de nuevo.");
    }
  };

  const handleRename = async (id) => {
    const name = editingName.trim();
    setEditingLine(null);
    if (!name) return;
    try {
      await FinLine.rename(id, name);
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    } catch (err) {
      console.error("Error al renombrar el segmento:", err);
      setError("No pudimos renombrar el segmento. Intenta de nuevo.");
    }
  };

  const handleRemoveLine = async (line) => {
    const ok = window.confirm(
      `¿Eliminar el segmento "${line.name}"? Se borrarán también sus ventas y costos capturados.`
    );
    if (!ok) return;
    try {
      await FinLine.remove(analysis.id, line.id);
      setLines((prev) => prev.filter((l) => l.id !== line.id));
      setValues((prev) => {
        const sales = { ...prev[SALES_SECTION] };
        const segcost = { ...prev[SEGCOST_SECTION] };
        delete sales[line.id];
        delete segcost[line.id];
        return { [SALES_SECTION]: sales, [SEGCOST_SECTION]: segcost };
      });
    } catch (err) {
      console.error("Error al eliminar el segmento:", err);
      setError("No pudimos eliminar el segmento. Intenta de nuevo.");
    }
  };

  // Cálculo con lo que hay en pantalla (los inputs guardan texto; el motor lo convierte).
  const seg = useMemo(
    () => computeSegments({ sections: { ...values, [INCOME_SECTION]: income }, years, lines }),
    [values, income, years, lines]
  );

  const incomeMissing = (key, yearId) => toNumber(income[key]?.[yearId]) == null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

  // Celda con nombre del segmento, renombrable (solo en la primera tabla).
  const renderName = (line, editable) => {
    if (!editable) return <span>{line.name}</span>;
    if (editingLine === line.id) {
      return (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={editingName}
            autoFocus
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename(line.id)}
            className="w-full p-1.5 rounded-lg glass text-foreground outline-none focus:border-accent"
          />
          <button
            onClick={() => handleRename(line.id)}
            className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 dark:text-green-500"
            title="Guardar nombre"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 group">
        <span>{line.name}</span>
        <button
          onClick={() => {
            setEditingLine(line.id);
            setEditingName(line.name);
          }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted hover:text-accent transition-opacity"
          title="Renombrar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // Tabla de captura (ventas o costo por segmento) con total, referencia y diferencia.
  const renderInputTable = ({ title, hint, section, pctKey, totalKey, refKey, diffKey, refIncomeKey, manage }) => (
    <Card className="glass">
      <CardContent className="p-4 space-y-1">
        <div className="px-2 pt-1">
          <h2 className="font-subtitle text-lg">{title}</h2>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left p-2 font-subtitle">Segmento</th>
                <YearHeaders years={years} />
                {manage && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-card-border/50">
                  <td className="p-2 min-w-[180px] align-top">{renderName(line, manage)}</td>
                  {years.map((y) => (
                    <td key={y.id} className="p-1.5 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={values[section]?.[line.id]?.[y.id] ?? ""}
                        onChange={(e) => handleCell(section, line.id, y.id, e.target.value)}
                        placeholder="0"
                        className={INPUT_CLASS}
                      />
                      <PctHint value={seg[y.id]?.bySegment[line.id]?.[pctKey] ?? null} />
                    </td>
                  ))}
                  {manage && (
                    <td className="p-1.5 align-top">
                      <button
                        onClick={() => handleRemoveLine(line)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                        title="Eliminar segmento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                <td className="p-2">Total</td>
                {years.map((y, yi) => {
                  const t = seg[y.id]?.[totalKey] ?? 0;
                  return (
                    <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                      {fmtMiles.format(t)}
                      <PctHint value={t > 0 ? 1 : null} />
                      {yi > 0 && (
                        <Delta curr={t} prev={seg[years[yi - 1].id]?.[totalKey] ?? 0} currYear={y} prevYear={years[yi - 1]} better={totalKey === "totalCosto" ? "lower" : "higher"} className="font-normal" />
                      )}
                    </td>
                  );
                })}
                {manage && <td />}
              </tr>
              <tr className="border-b border-card-border/50 text-muted">
                <td className="p-2">Total según Estado de Resultados</td>
                {years.map((y) => (
                  <td key={y.id} className="p-2 text-right whitespace-nowrap">
                    {incomeMissing(refIncomeKey, y.id) ? "—" : fmtMiles.format(seg[y.id]?.[refKey] ?? 0)}
                  </td>
                ))}
                {manage && <td />}
              </tr>
              <tr className="text-xs">
                <td className="p-2 text-muted">Diferencia</td>
                {years.map((y) => (
                  <td key={y.id} className="p-2 text-right whitespace-nowrap">
                    <DiffCell
                      value={seg[y.id]?.[diffKey] ?? 0}
                      captured={hasAny(values[section], y.id)}
                      refMissing={incomeMissing(refIncomeKey, y.id)}
                    />
                  </td>
                ))}
                {manage && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

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
            <PieChart className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Segmentos</h1>
            <p className="text-muted">Margen bruto por segmento de negocio, en miles.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="text-sm text-muted leading-relaxed space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-full glass text-[10px] font-subtitle text-accent">
              Análisis opcional
            </span>
            <p>
              Divide tus <strong>ventas</strong> y tu <strong>costo de ventas</strong> por segmento de
              negocio (productos, servicios o mercados) para ver qué margen bruto deja cada uno. Si no
              separas por segmentos, puedes saltarte esta pantalla: no afecta al resto del análisis. La
              suma de los segmentos debe coincidir con el Estado de Resultados; abajo de cada tabla te
              avisamos si hay diferencia.
            </p>
          </div>
        </CardContent>
      </Card>

      {years.length === 0 ? (
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
      ) : (
        <>
          {/* Agregar segmento */}
          <div className="flex gap-3">
            <input
              type="text"
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLine()}
              placeholder="Nombre del segmento, ej. Piezas automotrices"
              className="flex-grow p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
            <Button
              onClick={handleAddLine}
              disabled={!newLine.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle flex-shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" /> Agregar
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted italic p-4 glass rounded-xl">
              Aún no hay segmentos. Agrega el primero arriba: pueden ser líneas de producto, servicios,
              canales o mercados; lo que uses para separar tus ventas.
            </p>
          ) : (
            <>
              {renderInputTable({
                title: "Composición de las ventas",
                hint: "Ventas de cada segmento y su peso en el total.",
                section: SALES_SECTION,
                pctKey: "pctVentas",
                totalKey: "totalVentas",
                refKey: "ventasResultados",
                diffKey: "difVentas",
                refIncomeKey: "ventas",
                manage: true,
              })}

              {renderInputTable({
                title: "Costos por segmento",
                hint: "Costo de ventas de cada segmento y su peso en el total.",
                section: SEGCOST_SECTION,
                pctKey: "pctCosto",
                totalKey: "totalCosto",
                refKey: "costoResultados",
                diffKey: "difCosto",
                refIncomeKey: "costo",
                manage: false,
              })}

              {/* Resultado bruto por segmento (calculado) */}
              <Card className="glass">
                <CardContent className="p-4 space-y-1">
                  <div className="px-2 pt-1">
                    <h2 className="font-subtitle text-lg">Resultado bruto por segmento</h2>
                    <p className="text-xs text-muted">
                      Ventas menos costo de cada segmento; debajo, su margen bruto (% sobre sus ventas).
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-card-border">
                          <th className="text-left p-2 font-subtitle">Segmento</th>
                          <YearHeaders years={years} />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id} className="border-b border-card-border/50">
                            <td className="p-2 min-w-[180px]">{line.name}</td>
                            {years.map((y, yi) => {
                              const s = seg[y.id]?.bySegment[line.id];
                              const bruto = s?.bruto ?? 0;
                              return (
                                <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                                  <span className={bruto < 0 ? "text-red-500" : ""}>{fmtMiles.format(bruto)}</span>
                                  <PctHint value={s?.margen ?? null} />
                                  {yi > 0 && (
                                    <Delta curr={bruto} prev={seg[years[yi - 1].id]?.bySegment[line.id]?.bruto ?? 0} currYear={y} prevYear={years[yi - 1]} better="higher" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-accent/5 font-subtitle">
                          <td className="p-2">Total</td>
                          {years.map((y, yi) => {
                            const t = seg[y.id]?.totalBruto ?? 0;
                            return (
                              <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                                <span className={t < 0 ? "text-red-500" : ""}>{fmtMiles.format(t)}</span>
                                <PctHint value={seg[y.id]?.margenTotal ?? null} />
                                {yi > 0 && (
                                  <Delta curr={t} prev={seg[years[yi - 1].id]?.totalBruto ?? 0} currYear={y} prevYear={years[yi - 1]} better="higher" className="font-normal" />
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
            </>
          )}
        </>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisReport")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Informe
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisExpenses")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Desglose del gasto →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
