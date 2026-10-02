import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import { ArrowLeft, Sprout, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { OPP_GROUPS as OPP_GROUPS_CATALOG } from "@/config/strategicCatalog";

export const SECTION = "opportunities";
// Catálogo compartido con el servidor MCP.
export const OPP_GROUPS = OPP_GROUPS_CATALOG;

// Cuestionario de palancas de crecimiento (hoja "Análisis Oportunidades" del
// Excel). Todas las preguntas se responden Sí/No. Cada una está ligada a una
// estrategia: en la siguiente pantalla, "Sí" se vuelve fortaleza y "No"
// debilidad, automáticamente.

export const ALL_OPP_KEYS = OPP_GROUPS.flatMap((g) => g.questions.map((q) => q.key));

export default function OpportunityAnalysis() {
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
      console.error("Error al cargar análisis de oportunidades:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));
  };

  // Autoguardado: persiste ~1.5 s después del último cambio.
  const { status: saveStatus, flush } = useAutosave({
    data: answers,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, SECTION, answers);
    },
  });

  const answered = ALL_OPP_KEYS.filter((k) => (answers[k] || "").trim()).length;

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
          <div className="w-12 h-12 bg-green-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sprout className="w-6 h-6 text-green-600 dark:text-green-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Análisis de oportunidades</h1>
            <p className="text-muted">Tus palancas de crecimiento, en preguntas de Sí o No.</p>
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
                Responde con honestidad: no hay respuestas buenas ni malas. En la siguiente
                pantalla, cada <span className="font-subtitle text-green-600 dark:text-green-500">Sí</span> se
                convertirá automáticamente en una fortaleza y cada{" "}
                <span className="font-subtitle text-orange-500">No</span> en una debilidad
                que podrás decidir si trabajar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progreso */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {answered} de {ALL_OPP_KEYS.length} preguntas respondidas
        </span>
        <div className="w-40 h-2 glass rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(answered / ALL_OPP_KEYS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Preguntas por grupo */}
      <div className="space-y-5">
        {OPP_GROUPS.map((group) => (
          <Card key={group.title} className="glass">
            <CardContent className="p-6">
              <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-4">
                {group.title}
              </h3>
              <div className="space-y-4">
                {group.questions.map((item) => {
                  const value = answers[item.key] || "";
                  return (
                    <div
                      key={item.key}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 glass rounded-xl"
                    >
                      <p className="text-sm flex-grow">{item.q}</p>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setAnswer(item.key, "Sí")}
                          className={`px-4 py-1.5 rounded-full text-sm font-subtitle border transition-all ${
                            value === "Sí"
                              ? "bg-green-500/20 border-green-500/60 text-green-600 dark:text-green-400"
                              : "glass border-[var(--card-border)] hover:border-green-500/50"
                          }`}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswer(item.key, "No")}
                          className={`px-4 py-1.5 rounded-full text-sm font-subtitle border transition-all ${
                            value === "No"
                              ? "bg-orange-500/20 border-orange-500/60 text-orange-600 dark:text-orange-400"
                              : "glass border-[var(--card-border)] hover:border-orange-500/50"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
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
        <Link to={createPageUrl("MarketConclusions")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Conclusiones del mercado
          </Button>
        </Link>
        <Link to={createPageUrl("OpportunityConclusions")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Conclusión de oportunidades →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
