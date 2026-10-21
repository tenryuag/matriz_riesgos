import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, FileText, Info, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  INCOME_ROWS,
  INCOME_INPUT_KEYS,
  INCOME_MEMO,
  INCOME_MEMO_TITLE,
  INCOME_MEMO_HINT,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeIncome, computeEbitda } from "@/config/finCalc";

// Estado de Resultados (modelo MP-AFH1). Aquí se capturan las 11 cifras del
// estado financiero y las 3 partidas que no son efectivo (depreciación y
// reservas), en miles y SIEMPRE en positivo: la etiqueta entre paréntesis
// avisa que la app resta. Solo "Utilidad (pérdida) cambiaria" y "Otros
// productos (gastos)" llevan signo. Subtotales, utilidades y % sobre ventas
// se calculan en vivo con computeIncome; el EBITDA de la lectura rápida sale
// de computeEbitda (por eso también se carga el Balance: los diferidos lo
// ajustan). No hay columna anualizada ni variación anual, igual que en el
// Excel: esas comparaciones viven en Razones financieras.

// Claves que se guardan en la sección `income` (captura + memo).
const CAPTURE_KEYS = [...INCOME_INPUT_KEYS, ...INCOME_MEMO.map((m) => m.key)];

const INPUT_CLASS =
  "w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right";

// Etiqueta de columna: "2025" o "jun 2026" (+ "parcial" debajo).
const isPartial = (y) => y.months < 12;
const colLabel = (y) => (isPartial(y) ? `${yearLabel(y)} parcial` : yearLabel(y));

// Evita que un cero calculado se muestre como "-0".
const clean = (v) => (v == null || Number.isNaN(v) ? 0 : v || 0);

// Celda de captura de una cifra.
function AmountInput({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className={INPUT_CLASS}
    />
  );
}

AmountInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

// Celda calculada: cifra en miles y, debajo, su % sobre ventas.
function ComputedCell({ value, pct }) {
  const v = clean(value);
  return (
    <td className="p-2 text-right whitespace-nowrap align-top">
      <span className={v < 0 ? "text-red-500" : ""}>{fmtMiles.format(v)}</span>
      <span className="block text-[11px] text-muted">{fmtPct(pct)}</span>
    </td>
  );
}

ComputedCell.propTypes = {
  value: PropTypes.number,
  pct: PropTypes.number,
};

// Encabezado de un bloque dentro de la tabla (ocupa todas las columnas).
function SectionRow({ title, hint, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="pt-5 pb-1 px-2">
        <p className="text-xs font-subtitle uppercase tracking-wide text-muted">{title}</p>
        {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
      </td>
    </tr>
  );
}

SectionRow.propTypes = {
  title: PropTypes.string.isRequired,
  hint: PropTypes.string,
  colSpan: PropTypes.number.isRequired,
};

export default function FinAnalysisIncome() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [balance, setBalance] = useState({}); // sección balance tal cual viene de la BD
  const [values, setValues] = useState({}); // { [conceptKey]: { [yearId]: "texto" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const ys = await FinYear.list(a.id);
      const stored = await FinValue.getSections(a.id, [INCOME_SECTION, BALANCE_SECTION]);
      const inc = stored[INCOME_SECTION] || {};
      const map = {};
      CAPTURE_KEYS.forEach((key) => {
        map[key] = {};
        ys.forEach((y) => {
          const v = inc[key]?.[y.id];
          map[key][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setBalance(stored[BALANCE_SECTION] || {});
      setValues(map);
    } catch (err) {
      console.error("Error al cargar el Estado de Resultados:", err);
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
          rows.push({ year_id: yearId, section: INCOME_SECTION, concept_key: key, amount: toNumber(amount) });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (key, yearId, value) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [yearId]: value } }));
  };

  // Cifras calculadas con lo que se está capturando (el Balance solo entra
  // para los ajustes por diferidos del EBITDA).
  const { computed, ebitda } = useMemo(() => {
    const live = { [INCOME_SECTION]: values, [BALANCE_SECTION]: balance };
    return {
      computed: computeIncome({ sections: live, years }),
      ebitda: computeEbitda({ sections: live, years }),
    };
  }, [values, balance, years]);

  // ¿Hay alguna cifra capturada en un año?
  const yearHasData = (yearId) => CAPTURE_KEYS.some((k) => (values[k]?.[yearId] ?? "") !== "");

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  // Lectura rápida: márgenes y EBITDA del último periodo.
  const last = years.length ? years[years.length - 1] : null;
  const lastInc = last ? computed[last.id] : null;
  const lastEbitda = last ? clean(ebitda[last.id]) : 0;
  const lastHasData = last ? yearHasData(last.id) : false;
  const anyData = years.some((y) => yearHasData(y.id));
  const quickRead = lastInc
    ? [
        { label: "Margen bruto", pct: lastInc.pct.utilidadBruta },
        { label: "Margen operativo", pct: lastInc.pct.resultadoOp },
        { label: "Margen EBITDA", pct: lastInc.ventas > 0 ? lastEbitda / lastInc.ventas : null },
        { label: "Margen neto", pct: lastInc.pct.utilidadNeta },
      ]
    : [];
  const colSpan = years.length + 1;

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
            <FileText className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Estado de Resultados</h1>
            <p className="text-muted">Cuánto ganas realmente después de costos, gastos e impuestos.</p>
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
            Captura las cifras del Estado de Resultados anual y del último periodo parcial
            que haya emitido tu contador, <strong>en miles y en positivo</strong>: los renglones
            entre paréntesis (costos, gastos e impuestos) los resta la app. Solo la{" "}
            <strong>utilidad cambiaria</strong> y los <strong>otros productos</strong> llevan signo
            (pérdidas o gastos en negativo). Los renglones sombreados se calculan en vivo y
            debajo de cada cifra verás su % sobre ventas. Al pie, anota una sola vez la
            depreciación y las reservas: no cambian los totales, pero el Estado de cambios
            y el EBITDA las necesitan.
          </p>
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
          {/* Lectura rápida del último periodo */}
          {lastHasData ? (
            <div className="space-y-2">
              <p className="text-xs text-muted px-1">
                Lectura rápida · {colLabel(last)}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {quickRead.map((k) => (
                  <div key={k.label} className="glass rounded-2xl p-4">
                    <p className="text-xs text-muted">{k.label}</p>
                    <p className={`text-2xl font-title ${k.pct != null && k.pct < 0 ? "text-red-500" : ""}`}>
                      {fmtPct(k.pct)}
                    </p>
                  </div>
                ))}
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs text-muted">EBITDA (miles)</p>
                  <p className={`text-2xl font-title ${lastEbitda < 0 ? "text-red-500" : ""}`}>
                    {fmtMiles.format(lastEbitda)}
                  </p>
                </div>
              </div>
              {lastInc.ventas <= 0 && (
                <p className="text-xs text-muted px-1">
                  Sin ventas en {colLabel(last)} los márgenes no se pueden calcular.
                </p>
              )}
            </div>
          ) : (
            <Card className="glass">
              <CardContent className="p-5 text-sm text-muted">
                {anyData
                  ? `Captura las cifras de ${colLabel(last)} para ver sus márgenes y su EBITDA aquí.`
                  : "Todavía no hay cifras. Empieza por las ventas y el costo de ventas del primer año; los márgenes y el EBITDA del último periodo aparecerán aquí."}
              </CardContent>
            </Card>
          )}

          {/* Tabla de captura */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Concepto</th>
                    {years.map((y) => (
                      <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">
                        {yearLabel(y)}
                        {isPartial(y) && (
                          <span className="block text-[10px] font-normal text-muted">parcial</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INCOME_ROWS.map((row) => {
                    if (row.type === "input") {
                      return (
                        <tr key={row.key} className="border-b border-card-border/50">
                          <td className={`p-2 min-w-[220px] ${row.indent ? "pl-6" : ""}`}>
                            {row.label}
                            {row.hint && <span className="block text-[11px] text-muted">{row.hint}</span>}
                          </td>
                          {years.map((y) => (
                            <td key={y.id} className="p-1.5 text-right">
                              <AmountInput
                                value={values[row.key]?.[y.id] ?? ""}
                                onChange={(v) => handleCell(row.key, y.id, v)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    }
                    const isTotal = row.type === "total";
                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-card-border/50 ${isTotal ? "bg-accent/5 font-subtitle" : ""}`}
                      >
                        <td className="p-2">{row.label}</td>
                        {years.map((y) => (
                          <ComputedCell
                            key={y.id}
                            value={computed[y.id]?.[row.calc]}
                            pct={computed[y.id]?.pct?.[row.calc]}
                          />
                        ))}
                      </tr>
                    );
                  })}

                  {/* Partidas que no son efectivo (memo) */}
                  <SectionRow title={INCOME_MEMO_TITLE} hint={INCOME_MEMO_HINT} colSpan={colSpan} />
                  {INCOME_MEMO.map((m) => (
                    <tr key={m.key} className="border-b border-card-border/50">
                      <td className="p-2 min-w-[220px] pl-6">{m.label}</td>
                      {years.map((y) => (
                        <td key={y.id} className="p-1.5 text-right">
                          <AmountInput
                            value={values[m.key]?.[y.id] ?? ""}
                            onChange={(v) => handleCell(m.key, y.id, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Cifras en miles. La columna de un periodo parcial muestra sus cifras reales, sin
              anualizar; las comparaciones anualizadas (crecimiento, ROA, ROE) están en Razones
              financieras. EBITDA = Resultado de operación + depreciación y amortización + reservas.
            </span>
          </p>
        </>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisData")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Datos generales
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisBalance")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Balance General →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
