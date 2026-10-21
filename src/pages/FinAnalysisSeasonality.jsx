import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinValue } from "@/api/entities";
import { ArrowLeft, CalendarRange, Sparkles, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  SEASONALITY_SECTION,
  INCOME_SECTION,
  SEASON_MONTHS,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
} from "@/config/finConfig";
import { computeSeasonality } from "@/config/finCalc";

// Estacionalidad en ventas (análisis opcional, hoja "Estacionalidad en
// ventas" del Excel): ventas por mes de cada año, en miles, con su % del
// total anual. La suma de los meses debe coincidir con las ventas del Estado
// de Resultados: se muestra la diferencia por año. En periodos parciales solo
// se capturan los meses incluidos; los demás quedan deshabilitados. Abajo, una
// gráfica de barras con los meses del último periodo.

const INPUT_CLASS =
  "w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right";
const DISABLED_CLASS =
  "w-full min-w-[90px] p-2 rounded-lg glass text-muted/50 placeholder:text-muted/40 outline-none text-right opacity-60 cursor-not-allowed";

const BAR_COLOR = "#06b6d4";

// Una diferencia es cero si no pasa del ruido de punto flotante.
const isZero = (v) => Math.abs(v) < 1e-6;

// ¿El mes cae dentro del periodo capturado del año?
const inPeriod = (m, y) => m.month <= (y.months || 12);

// ¿Hay alguna cifra capturada para ese año?
const hasAny = (sectionValues, yearId) =>
  Object.values(sectionValues || {}).some((byYear) => toNumber(byYear?.[yearId]) != null);

// "Ene", "Feb", …
const monthShort = (m) => m.label.slice(0, 3);

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

// Tooltip de la gráfica, con el mismo "glass" del Inicio.
function MonthTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="glass rounded-xl p-3 text-sm border border-[var(--card-border)]">
      <p className="font-subtitle mb-1">{row.fullName ?? label}</p>
      <p className="flex items-center gap-2 text-foreground">
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: payload[0].color }} />
        Ventas: {fmtMiles.format(payload[0].value)}
        {row.pct != null && <span className="text-muted">· {fmtPct(row.pct)} del total</span>}
      </p>
      <p className="text-[10px] text-muted mt-1">cifras en miles</p>
    </div>
  );
}
MonthTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.node,
};

export default function FinAnalysisSeasonality() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [income, setIncome] = useState({}); // sección `income` tal como viene de la BD
  const [values, setValues] = useState({}); // { [m01..m12]: { [yearId]: "monto" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, stored] = await Promise.all([
        FinYear.list(a.id),
        FinValue.getSections(a.id, [SEASONALITY_SECTION, INCOME_SECTION]),
      ]);
      const section = stored[SEASONALITY_SECTION] || {};
      const map = {};
      SEASON_MONTHS.forEach((m) => {
        map[m.key] = {};
        ys.forEach((y) => {
          // Los meses fuera del periodo parcial no cuentan: se dejan en blanco.
          const v = inPeriod(m, y) ? section[m.key]?.[y.id] : null;
          map[m.key][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setIncome(stored[INCOME_SECTION] || {});
      setValues(map);
    } catch (err) {
      console.error("Error al cargar la estacionalidad:", err);
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
      Object.entries(values).forEach(([monthKey, byYear]) => {
        Object.entries(byYear).forEach(([yearId, amount]) => {
          rows.push({
            year_id: yearId,
            section: SEASONALITY_SECTION,
            concept_key: monthKey,
            amount: toNumber(amount),
          });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (monthKey, yearId, value) => {
    setValues((prev) => ({
      ...prev,
      [monthKey]: { ...prev[monthKey], [yearId]: value },
    }));
  };

  // Cálculo con lo que hay en pantalla (los inputs guardan texto; el motor lo convierte).
  const seasonality = useMemo(
    () => computeSeasonality({ sections: { [SEASONALITY_SECTION]: values, [INCOME_SECTION]: income }, years }),
    [values, income, years]
  );

  const incomeMissing = (yearId) => toNumber(income.ventas?.[yearId]) == null;

  // Gráfica: meses del último periodo (solo los incluidos si es parcial).
  const last = years.length > 0 ? years[years.length - 1] : null;
  const lastResult = last ? seasonality[last.id] : null;
  const chartData = last
    ? SEASON_MONTHS.filter((m) => inPeriod(m, last)).map((m) => ({
        name: monthShort(m),
        fullName: `${m.label} ${last.year}`,
        Ventas: lastResult?.months[m.month - 1] ?? 0,
        pct: lastResult?.pct[m.month - 1] ?? null,
      }))
    : [];
  const partialYears = years.filter((y) => y.months < 12);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

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
            <CalendarRange className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Estacionalidad</h1>
            <p className="text-muted">Tus ventas mes a mes, en miles.</p>
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
              Captura las <strong>ventas de cada mes</strong> para ver en qué parte del año se concentran y
              planear inventarios, personal y efectivo. Bajo cada cifra verás su peso en el total anual. La
              suma de los meses debe coincidir con las ventas del Estado de Resultados; abajo te avisamos si
              hay diferencia. En un periodo parcial solo se capturan los meses incluidos.
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
          {/* Tabla 12 meses × años */}
          <Card className="glass">
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-2 font-subtitle">Mes</th>
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
                  {SEASON_MONTHS.map((m, i) => (
                    <tr key={m.key} className="border-b border-card-border/50">
                      <td className="p-2 min-w-[160px] align-top">{m.label}</td>
                      {years.map((y) => {
                        const enabled = inPeriod(m, y);
                        return (
                          <td key={y.id} className="p-1.5 align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={enabled ? values[m.key]?.[y.id] ?? "" : ""}
                              onChange={(e) => handleCell(m.key, y.id, e.target.value)}
                              disabled={!enabled}
                              placeholder={enabled ? "0" : "—"}
                              title={enabled ? undefined : `Fuera del periodo de ${yearLabel(y)}`}
                              className={enabled ? INPUT_CLASS : DISABLED_CLASS}
                            />
                            <PctHint value={enabled ? seasonality[y.id]?.pct[i] ?? null : null} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <tr className="bg-accent/5 border-b border-card-border/50 font-subtitle">
                    <td className="p-2">Total</td>
                    {years.map((y) => {
                      const t = seasonality[y.id]?.total ?? 0;
                      return (
                        <td key={y.id} className="p-2 text-right whitespace-nowrap align-top">
                          {fmtMiles.format(t)}
                          <PctHint value={t > 0 ? 1 : null} />
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-card-border/50 text-muted">
                    <td className="p-2">Ventas según Estado de Resultados</td>
                    {years.map((y) => (
                      <td key={y.id} className="p-2 text-right whitespace-nowrap">
                        {incomeMissing(y.id) ? "—" : fmtMiles.format(seasonality[y.id]?.ventasResultados ?? 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-xs">
                    <td className="p-2 text-muted">Diferencia</td>
                    {years.map((y) => (
                      <td key={y.id} className="p-2 text-right whitespace-nowrap">
                        <DiffCell
                          value={seasonality[y.id]?.diferencia ?? 0}
                          captured={hasAny(values, y.id)}
                          refMissing={incomeMissing(y.id)}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              {partialYears.length > 0 && (
                <p className="text-xs text-muted px-2 pt-3">
                  {partialYears.map((y) => `${yearLabel(y)} cubre ${y.months} meses`).join("; ")}: los meses
                  posteriores quedan deshabilitados y no entran en el total.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Gráfica del último periodo */}
          {last && (
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                  <h2 className="font-subtitle text-lg">Ventas por mes · {yearLabel(last)}</h2>
                </div>
                <p className="text-xs text-muted mb-3">
                  Cifras en miles del último periodo.
                  {last.months < 12 ? ` Periodo parcial de ${last.months} meses.` : ""}
                </p>
                {lastResult && lastResult.total > 0 ? (
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
                        <Tooltip content={<MonthTooltip />} cursor={{ fill: "var(--card-border)" }} />
                        <Bar dataKey="Ventas" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted italic p-4 glass rounded-xl">
                    Captura los meses de {yearLabel(last)} para ver la gráfica.
                  </p>
                )}
              </CardContent>
            </Card>
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
        <Link to={createPageUrl("FinAnalysisExpenses")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Desglose del gasto
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Volver al Inicio →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
