import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear } from "@/api/entities";
import { ArrowLeft, Building, Info, Plus, Trash2, CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { yearLabel } from "@/config/finConfig";

// Datos generales de la empresa + ejercicios (años) a analizar.
// Los años alimentan todas las demás pantallas del módulo.

const FIELDS = [
  { key: "company_name", label: "Nombre de la empresa", placeholder: "Ej. Mi Empresa, S.A. de C.V." },
  { key: "country", label: "País de residencia", placeholder: "Ej. México" },
  {
    key: "main_activity",
    label: "Actividad principal",
    placeholder: "La actividad que representa la mayor parte de tus ingresos (60% o más)",
    multiline: true,
  },
  {
    key: "secondary_activities",
    label: "Actividades secundarias",
    placeholder: "Otras actividades que también generan ingresos",
    multiline: true,
  },
];

const CURRENCIES = [
  { value: "MXN", label: "Pesos mexicanos (MXN)" },
  { value: "USD", label: "Dólares (USD)" },
  { value: "EUR", label: "Euros (EUR)" },
];

const MONTH_OPTIONS = [
  { value: 12, label: "Año completo" },
  { value: 1, label: "Parcial a enero" },
  { value: 2, label: "Parcial a febrero" },
  { value: 3, label: "Parcial a marzo" },
  { value: 4, label: "Parcial a abril" },
  { value: 5, label: "Parcial a mayo" },
  { value: 6, label: "Parcial a junio" },
  { value: 7, label: "Parcial a julio" },
  { value: 8, label: "Parcial a agosto" },
  { value: 9, label: "Parcial a septiembre" },
  { value: 10, label: "Parcial a octubre" },
  { value: 11, label: "Parcial a noviembre" },
];

export default function FinAnalysisData() {
  const [analysis, setAnalysis] = useState(null);
  const [form, setForm] = useState({});
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [yearBusy, setYearBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const ys = await FinYear.list(a.id);
      setAnalysis(a);
      setForm({
        company_name: a.company_name || "",
        country: a.country || "",
        main_activity: a.main_activity || "",
        secondary_activities: a.secondary_activities || "",
        currency: a.currency || "MXN",
      });
      setYears(ys);
    } catch (err) {
      console.error("Error al cargar los datos generales:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: saveStatus, flush } = useAutosave({
    data: form,
    enabled: !loading && !!analysis,
    onSave: async () => {
      await FinAnalysis.update(analysis.id, form);
    },
  });

  const handleAddYear = async () => {
    if (!analysis || yearBusy) return;
    setYearBusy(true);
    try {
      // Sugiere el siguiente año después del último, o el año pasado si no hay.
      const nextYear =
        years.length > 0
          ? Math.max(...years.map((y) => y.year)) + 1
          : new Date().getFullYear() - 1;
      const created = await FinYear.add(analysis.id, nextYear, 12);
      if (created) setYears((prev) => [...prev, created].sort((a, b) => a.year - b.year));
    } catch (err) {
      console.error("Error al agregar el año:", err);
      setError("No pudimos agregar el año. Intenta de nuevo.");
    }
    setYearBusy(false);
  };

  const handleYearChange = async (id, fields) => {
    setYears((prev) =>
      prev
        .map((y) => (y.id === id ? { ...y, ...fields } : y))
        .sort((a, b) => a.year - b.year)
    );
    try {
      await FinYear.update(id, fields);
    } catch (err) {
      console.error("Error al actualizar el año:", err);
      setError("No pudimos guardar el cambio del año. Intenta de nuevo.");
    }
  };

  const handleRemoveYear = async (id) => {
    const y = years.find((x) => x.id === id);
    const ok = window.confirm(
      `¿Eliminar el ejercicio ${y ? yearLabel(y) : ""}? Se borrarán también todas las cifras capturadas de ese año en el módulo.`
    );
    if (!ok) return;
    try {
      await FinYear.remove(id);
      setYears((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Error al eliminar el año:", err);
      setError("No pudimos eliminar el año. Intenta de nuevo.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Building className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Datos generales</h1>
            <p className="text-muted">Identifica a tu empresa y define los años a analizar.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Esta información alimenta todo el módulo. Los <strong>años</strong> que
            definas aquí aparecerán como columnas en Ventas, Costos, Gastos y los
            estados financieros. Todas las cifras del módulo se capturan{" "}
            <strong>en miles</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Datos de la empresa */}
      <Card className="glass">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-subtitle text-lg">Tu empresa</h2>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="font-subtitle text-sm block mb-1.5" htmlFor={f.key}>
                {f.label}
              </label>
              {f.multiline ? (
                <textarea
                  id={f.key}
                  value={form[f.key] || ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  rows={2}
                  placeholder={f.placeholder}
                  className="w-full p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent resize-y"
                />
              ) : (
                <input
                  id={f.key}
                  type="text"
                  value={form[f.key] || ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent"
                />
              )}
            </div>
          ))}
          <div>
            <label className="font-subtitle text-sm block mb-1.5" htmlFor="currency">
              Moneda de la información financiera
            </label>
            <select
              id="currency"
              value={CURRENCIES.some((c) => c.value === form.currency) ? form.currency : "OTRA"}
              onChange={(e) =>
                setForm((p) => ({ ...p, currency: e.target.value === "OTRA" ? "" : e.target.value }))
              }
              className="w-full p-3 rounded-xl glass text-foreground outline-none focus:border-accent bg-transparent"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
              <option value="OTRA">Otra…</option>
            </select>
            {!CURRENCIES.some((c) => c.value === form.currency) && (
              <input
                type="text"
                value={form.currency || ""}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                placeholder="Código de la moneda, ej. GBP"
                maxLength={8}
                className="mt-2 w-full p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Años del análisis */}
      <Card className="glass">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <CalendarRange className="w-5 h-5 text-cyan-500" />
              <h2 className="font-subtitle text-lg">Años a analizar</h2>
            </div>
            <Button
              onClick={handleAddYear}
              disabled={yearBusy}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle"
            >
              <Plus className="w-4 h-4 mr-2" /> Agregar año
            </Button>
          </div>
          <p className="text-sm text-muted">
            Se recomiendan de 3 a 5 años para ver tendencias. El último puede ser un{" "}
            <strong>periodo parcial</strong> (por ejemplo, cifras a junio): en los
            estados financieros se anualiza automáticamente para poder compararlo.
          </p>

          {years.length === 0 ? (
            <p className="text-sm text-muted italic p-4 glass rounded-xl">
              Aún no hay años. Agrega el primero para empezar a capturar.
            </p>
          ) : (
            <div className="space-y-2">
              {years.map((y) => (
                <div key={y.id} className="flex items-center gap-3 p-3 glass rounded-xl flex-wrap">
                  <span className="w-16 font-title text-lg text-center flex-shrink-0">
                    {yearLabel(y)}
                  </span>
                  <input
                    type="number"
                    value={y.year}
                    min={1990}
                    max={2100}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1990 && v <= 2100) handleYearChange(y.id, { year: v });
                    }}
                    className="w-24 p-2 rounded-lg glass text-foreground outline-none focus:border-accent text-center"
                    aria-label="Año"
                  />
                  <select
                    value={y.months}
                    onChange={(e) => handleYearChange(y.id, { months: parseInt(e.target.value, 10) })}
                    className="flex-grow min-w-[150px] p-2 rounded-lg glass text-foreground outline-none focus:border-accent bg-transparent"
                    aria-label="Cobertura del año"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveYear(y.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors flex-shrink-0"
                    title="Eliminar año"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Siguiente paso */}
      <div className="flex justify-end">
        <Link to={createPageUrl("FinAnalysisSales")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Ventas →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
