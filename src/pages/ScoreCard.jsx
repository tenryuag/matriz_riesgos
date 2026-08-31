import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan, Initiative } from "@/api/entities";
import {
  ArrowLeft,
  Trophy,
  Sparkles,
  Compass,
  Target,
  Gem,
  Printer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RATING_SECTION,
  SUMMARY_SOURCE_SECTIONS,
  collectStrategies,
} from "./StrategicSummary";
import { perspectiveFor, LANES } from "./StrategicMap";

// ============================================================
// Score Card ejecutivo: el resumen final del plan estratégico.
// Misión/visión/valores + todas las iniciativas por perspectiva y objetivo,
// con suma de días comprometidos y presupuesto. Solo lectura: se llena solo.
// ============================================================

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const daysBetween = (start, end) => {
  if (!start || !end) return null;
  const d = Math.round((new Date(end) - new Date(start)) / 86400000);
  return d >= 0 ? d : null;
};

export default function ScoreCard() {
  const [plan, setPlan] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = await StrategicPlan.getOrCreate();
      const [sections, initiatives] = await Promise.all([
        StrategicPlan.getAnswersForSections(p.id, [
          ...SUMMARY_SOURCE_SECTIONS,
          RATING_SECTION,
        ]),
        Initiative.list(p.id),
      ]);
      const { weaknesses } = collectStrategies(sections);
      const byId = {};
      weaknesses.forEach((w) => (byId[w.id] = w));
      const built = initiatives.map((it) => {
        const strategy = byId[it.strategy_id];
        return {
          ...it,
          objective: strategy?.label || it.strategy_id,
          perspective: strategy ? perspectiveFor(strategy) : "cliente",
          days: daysBetween(it.start_date, it.end_date),
        };
      });
      setPlan(p);
      setRows(built);
    } catch (err) {
      console.error("Error al cargar el score card:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const totalBudget = rows.reduce((s, r) => s + (Number(r.budget) || 0), 0);
  const totalDays = rows.reduce((s, r) => s + (r.days || 0), 0);

  const identity = [
    { icon: Target, title: "Misión", value: plan?.mission },
    { icon: Compass, title: "Visión", value: plan?.vision },
    { icon: Gem, title: "Valores", value: plan?.core_values },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-grow">
          <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Score Card ejecutivo</h1>
            <p className="text-muted">El resumen de tu plan, listo para presentar.</p>
          </div>
        </div>
        <Button
          onClick={() => window.print()}
          variant="outline"
          className="glass hover:border-accent font-subtitle flex-shrink-0"
        >
          <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
        </Button>
      </div>

      {/* Título para impresión */}
      <div className="hidden print:block text-center">
        <h1 className="text-2xl font-title">Score Card Ejecutivo · Plan Estratégico</h1>
      </div>

      {/* Aviso: se llena solo */}
      <Card className="glass print:hidden">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            Este resumen se llena solo con la identidad de tu empresa y las iniciativas que
            capturaste. Los tiempos y presupuestos se suman automáticamente.
          </p>
        </CardContent>
      </Card>

      {/* Misión / Visión / Valores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {identity.map((b) => (
          <Card key={b.title} className="glass">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <b.icon className="w-4 h-4 text-accent" />
                <h2 className="font-subtitle text-sm uppercase tracking-wide text-accent">
                  {b.title}
                </h2>
              </div>
              {b.value ? (
                <p className="text-sm leading-relaxed">{b.value}</p>
              ) : (
                <p className="text-xs text-muted italic">
                  Sin definir.{" "}
                  <Link to={createPageUrl("StrategicInitiatives")} className="text-accent hover:underline print:hidden">
                    Defínela en Iniciativas →
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Totales */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <span className="font-subtitle">{rows.length}</span> iniciativas
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <span className="font-subtitle">{totalDays}</span> días comprometidos
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          Presupuesto: <span className="font-subtitle text-accent">{money.format(totalBudget)}</span>
        </span>
      </div>

      {/* Tabla por perspectiva */}
      {rows.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center text-muted space-y-3">
            <p className="text-sm">
              Aún no hay iniciativas capturadas. Créalas para que el score card se llene.
            </p>
            <Link to={createPageUrl("StrategicInitiatives")} className="text-accent text-sm font-subtitle hover:underline">
              Ir a Iniciativas estratégicas →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-2.5 px-3 font-subtitle text-muted">Objetivo</th>
                    <th className="text-left py-2.5 px-3 font-subtitle text-muted">Iniciativa</th>
                    <th className="text-left py-2.5 px-3 font-subtitle text-muted">Área</th>
                    <th className="text-left py-2.5 px-3 font-subtitle text-muted">Responsable</th>
                    <th className="text-right py-2.5 px-3 font-subtitle text-muted">Plazo</th>
                    <th className="text-right py-2.5 px-3 font-subtitle text-muted">Presupuesto</th>
                  </tr>
                </thead>
                <tbody>
                  {LANES.map((lane) => {
                    const list = rows.filter((r) => r.perspective === lane.key);
                    if (list.length === 0) return null;
                    return (
                      <React.Fragment key={lane.key}>
                        <tr>
                          <td colSpan={6} className={`py-2 px-3 font-subtitle text-xs uppercase tracking-wider ${lane.label} rounded-lg`}>
                            Perspectiva {lane.title}
                          </td>
                        </tr>
                        {list.map((r) => (
                          <tr key={r.id} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                            <td className="py-2.5 px-3 max-w-[220px]">{r.objective}</td>
                            <td className="py-2.5 px-3 max-w-[220px] font-subtitle">
                              {r.title || <span className="text-muted italic">Sin nombre</span>}
                            </td>
                            <td className="py-2.5 px-3">{r.area || "—"}</td>
                            <td className="py-2.5 px-3">{r.owner || "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {r.days != null ? `${r.days} días` : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {r.budget != null && r.budget !== "" ? money.format(Number(r.budget)) : "—"}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr className="font-subtitle">
                    <td colSpan={4} className="py-3 px-3 text-right">Totales:</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">{totalDays} días</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap text-accent">
                      {money.format(totalBudget)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap print:hidden">
        <Link to={createPageUrl("StrategicInitiatives")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Iniciativas estratégicas
          </Button>
        </Link>
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            Volver al inicio del módulo
          </Button>
        </Link>
      </div>
    </div>
  );
}
