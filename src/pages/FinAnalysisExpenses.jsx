import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, Receipt, Sparkles, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  EXPENSES_SECTION,
  INCOME_SECTION,
  EXPENSE_CONCEPTS,
  EXPENSE_VIRTUAL,
  INCOME_MEMO,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeExpenseBreakdown } from "@/config/finCalc";

// Desglose del gasto operativo (análisis opcional, hoja "Gasto" del Excel):
// los 20 conceptos del catálogo más el bloque de partidas virtuales. La
// depreciación y las reservas se capturan UNA sola vez en el Estado de
// Resultados y aquí se leen; amortizaciones y otras partidas virtuales sí se
// capturan aquí. El total debe coincidir con el gasto operativo del Estado
// de Resultados: se muestra la diferencia por año. Cifras en miles.

const INPUT_CLASS =
  "w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right";

// Claves que se capturan en la sección `expenses` (20 conceptos + 2 virtuales).
const INPUT_KEYS = [...EXPENSE_CONCEPTS, ...EXPENSE_VIRTUAL].map((c) => c.key);

// Claves del Estado de Resultados que forman el gasto operativo.
const INCOME_EXPENSE_KEYS = ["gasto_venta", "gasto_admin", "gasto_general"];

// Bloque de partidas virtuales en el orden del Excel. `calc` es el campo del
// resultado de computeExpenseBreakdown (y de su `pct`); `readOnly` = viene
// del memo del Estado de Resultados.
const memoByKey = Object.fromEntries(INCOME_MEMO.map((m) => [m.key, m]));
const virtualByKey = Object.fromEntries(EXPENSE_VIRTUAL.map((v) => [v.key, v]));
const VIRTUAL_ROWS = [
  { ...memoByKey.depreciacion, readOnly: true },
  { ...virtualByKey.amortizaciones, calc: "amortizaciones" },
  { ...memoByKey.reserva_cxc, readOnly: true },
  { ...memoByKey.reserva_inventarios, readOnly: true },
  { ...virtualByKey.otras_virtuales, calc: "otrasVirtuales" },
];

// Una diferencia es cero si no pasa del ruido de punto flotante.
const isZero = (v) => Math.abs(v) < 1e-6;

// ¿Hay alguna cifra capturada en un conjunto de claves para ese año?
const hasAny = (sectionValues, keys, yearId) =>
  keys.some((k) => toNumber(sectionValues?.[k]?.[yearId]) != null);

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

export default function FinAnalysisExpenses() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [income, setIncome] = useState({}); // sección `income` tal como viene de la BD
  const [values, setValues] = useState({}); // { [conceptKey]: { [yearId]: "monto" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, stored] = await Promise.all([
        FinYear.list(a.id),
        FinValue.getSections(a.id, [EXPENSES_SECTION, INCOME_SECTION]),
      ]);
      const section = stored[EXPENSES_SECTION] || {};
      const map = {};
      INPUT_KEYS.forEach((k) => {
        map[k] = {};
        ys.forEach((y) => {
          const v = section[k]?.[y.id];
          map[k][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setIncome(stored[INCOME_SECTION] || {});
      setValues(map);
    } catch (err) {
      console.error("Error al cargar el desglose del gasto:", err);
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
      Object.entries(values).forEach(([conceptKey, byYear]) => {
        Object.entries(byYear).forEach(([yearId, amount]) => {
          rows.push({
            year_id: yearId,
            section: EXPENSES_SECTION,
            concept_key: conceptKey,
            amount: toNumber(amount),
          });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (conceptKey, yearId, value) => {
    setValues((prev) => ({
      ...prev,
      [conceptKey]: { ...prev[conceptKey], [yearId]: value },
    }));
  };

  // Cálculo con lo que hay en pantalla (los inputs guardan texto; el motor lo convierte).
  const breakdown = useMemo(
    () => computeExpenseBreakdown({ sections: { [EXPENSES_SECTION]: values, [INCOME_SECTION]: income }, years }),
    [values, income, years]
  );

  // Sin gasto operativo en el Estado de Resultados para ese año.
  const incomeMissing = (yearId) => !hasAny(income, INCOME_EXPENSE_KEYS, yearId);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

  const colSpan = years.length + 1;

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
            <Receipt className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Desglose del gasto</h1>
            <p className="text-muted">En qué se va tu gasto operativo, en miles.</p>
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
              Reparte tu <strong>gasto operativo</strong> en los conceptos del catálogo para ver en qué se
              va y comparar entre años; si un concepto no aplica, déjalo en blanco. Las{" "}
              <strong>partidas virtuales</strong> (depreciación, amortizaciones y reservas) no son salidas
              de efectivo pero sí forman parte del gasto. El total debe coincidir con el gasto operativo del
              Estado de Resultados (gasto de venta + administración + generales); abajo te avisamos si hay
              diferencia.
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
        <Card className="glass">
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left p-2 font-subtitle">Concepto</th>
                  {years.map((y) => (
                    <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">
                      {yearLabel(y)}
                      {y.months < 12 && (
                        <span className="block text-[10px] font-normal text-muted">parcial</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 20 conceptos */}
                {EXPENSE_CONCEPTS.map((c) => (
                  <tr key={c.key} className="border-b border-card-border/50">
                    <td className="p-2 min-w-[220px] align-top">{c.label}</td>
                    {years.map((y) => (
                      <td key={y.id} className="p-1.5 align-top">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={values[c.key]?.[y.id] ?? ""}
                          onChange={(e) => handleCell(c.key, y.id, e.target.value)}
                          placeholder="0"
                          className={INPUT_CLASS}
                        />
                        <PctHint value={breakdown[y.id]?.pct[c.key] ?? null} />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Subtotal de los 20 conceptos */}
                <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                  <td className="p-2">Gastos de operación</td>
                  {years.map((y) => (
                    <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                      {fmtMiles.format(breakdown[y.id]?.gastosOperacion ?? 0)}
                      <PctHint value={breakdown[y.id]?.pct.gastosOperacion ?? null} />
                    </td>
                  ))}
                </tr>

                {/* Partidas virtuales */}
                <tr className="border-b border-card-border/50">
                  <td colSpan={colSpan} className="p-2 pt-4">
                    <span className="font-subtitle">Partidas virtuales</span>
                    <span className="block text-xs text-muted">
                      La depreciación y las reservas se capturan una sola vez en el{" "}
                      <Link to={createPageUrl("FinAnalysisIncome")} className="text-accent hover:underline">
                        Estado de Resultados →
                      </Link>{" "}
                      y aquí solo se leen.
                    </span>
                  </td>
                </tr>
                {VIRTUAL_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-card-border/50">
                    <td className="p-2 min-w-[220px] align-top">
                      <span className="inline-flex items-center gap-1.5">
                        {row.readOnly && <Lock className="w-3.5 h-3.5 text-muted" aria-label="Solo lectura" />}
                        {row.label}
                      </span>
                    </td>
                    {years.map((y) => (
                      <td key={y.id} className={`${row.readOnly ? "p-2 text-right whitespace-nowrap" : "p-1.5"} align-top`}>
                        {row.readOnly ? (
                          <span className="text-muted" title="Se captura en el Estado de Resultados">
                            {fmtMiles.format(breakdown[y.id]?.[row.calc] ?? 0)}
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={values[row.key]?.[y.id] ?? ""}
                            onChange={(e) => handleCell(row.key, y.id, e.target.value)}
                            placeholder="0"
                            className={INPUT_CLASS}
                          />
                        )}
                        <PctHint value={breakdown[y.id]?.pct[row.calc] ?? null} />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Total y comparación con el Estado de Resultados */}
                <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                  <td className="p-2">Total gasto de operación</td>
                  {years.map((y) => {
                    const t = breakdown[y.id]?.total ?? 0;
                    return (
                      <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                        {fmtMiles.format(t)}
                        <PctHint value={t > 0 ? 1 : null} />
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-card-border/50 text-muted">
                  <td className="p-2">Gasto de operación en Resultados</td>
                  {years.map((y) => (
                    <td key={y.id} className="p-2 text-right whitespace-nowrap">
                      {incomeMissing(y.id) ? "—" : fmtMiles.format(breakdown[y.id]?.gastoEnResultados ?? 0)}
                    </td>
                  ))}
                </tr>
                <tr className="text-xs">
                  <td className="p-2 text-muted">Diferencia</td>
                  {years.map((y) => (
                    <td key={y.id} className="p-2 text-right whitespace-nowrap">
                      <DiffCell
                        value={breakdown[y.id]?.diferencia ?? 0}
                        captured={hasAny(values, INPUT_KEYS, y.id)}
                        refMissing={incomeMissing(y.id)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisSegments")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Segmentos
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisSeasonality")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Estacionalidad →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
