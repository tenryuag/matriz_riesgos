import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  Banknote,
  Info,
  Check,
  Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { FIN_GROUPS as FIN_GROUPS_CATALOG } from "@/config/strategicCatalog";

export const SECTION = "financial-strategies";
// Catálogo compartido con el servidor MCP.
export const FIN_GROUPS = FIN_GROUPS_CATALOG;

// Catálogo de la hoja "Estrategias Financieras" del Excel: estrategias por
// línea del estado de resultados. El usuario marca las debilidades que quiere
// gestionar; las marcadas fluyen al resumen y al mapa estratégico.

export const ALL_FIN_KEYS = FIN_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export default function FinancialStrategies() {
  const [planId, setPlanId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const stored = await StrategicPlan.getAnswers(plan.id, SECTION);
      setPlanId(plan.id);
      setAnswers(stored);
    } catch (err) {
      console.error("Error al cargar estrategias financieras:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key) => {
    setAnswers((prev) => ({ ...prev, [key]: prev[key] === "D" ? "" : "D" }));
  };

  // Autoguardado.
  const { status: saveStatus, flush } = useAutosave({
    data: answers,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, SECTION, answers);
    },
  });

  const selected = ALL_FIN_KEYS.filter((k) => answers[k] === "D").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Banknote className="w-6 h-6 text-cyan-600 dark:text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Estrategias financieras</h1>
            <p className="text-muted">Recorre tus números y elige qué vas a trabajar.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-subtitle text-lg mb-1">¿Qué hago aquí?</h2>
              <p className="text-sm text-muted leading-relaxed">
                Este es un recorrido por tu estado de resultados: ventas, costos, gastos,
                financiamiento, impuestos y reservas. Marca las estrategias que hoy son una
                debilidad en tu empresa y quieres gestionar. Las que marques entrarán al
                resumen y al mapa estratégico.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Wrench className="w-4 h-4 text-orange-500" />
          <span className="font-subtitle">{selected}</span> debilidades a gestionar
        </span>
      </div>

      {/* Catálogo por línea del estado de resultados */}
      <div className="space-y-5">
        {FIN_GROUPS.map((group) => (
          <Card key={group.title} className="glass">
            <CardContent className="p-6">
              <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-1">
                {group.title}
              </h3>
              <p className="text-xs text-muted italic mb-4">{group.guide}</p>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const on = answers[item.key] === "D";
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggle(item.key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        on
                          ? "bg-orange-500/10 border-orange-500/50"
                          : "glass border-[var(--card-border)] hover:border-accent"
                      }`}
                      aria-pressed={on}
                    >
                      <span
                        className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                          on
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "border-[var(--card-border)]"
                        }`}
                      >
                        {on && <Check className="w-4 h-4" />}
                      </span>
                      <span className="text-sm flex-grow">{item.label}</span>
                      {on && (
                        <span className="text-xs font-subtitle text-orange-600 dark:text-orange-400 flex-shrink-0">
                          La voy a gestionar
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("OpportunityConclusions")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Conclusión de oportunidades
          </Button>
        </Link>
        <Link to={createPageUrl("Foda")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: FODA →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
