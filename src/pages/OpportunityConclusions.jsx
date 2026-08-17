import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  ListChecks,
  Info,
  Sparkles,
  Award,
  Wrench,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { OPP_GROUPS, SECTION as OPP_SECTION } from "./OpportunityAnalysis";

export const SECTION = "opportunity-conclusions";

// Regla del Excel: Sí → fortaleza (F) · No → debilidad (D).
export const deriveFromAnswer = (answer) =>
  answer === "Sí" ? "F" : answer === "No" ? "D" : "";

// Valor efectivo por estrategia: el ajuste manual (override) manda; si no
// hay, se usa el derivado automáticamente de la respuesta del cuestionario.
export function effectiveConclusions(oppAnswers, overrides) {
  const out = {};
  OPP_GROUPS.forEach((g) =>
    g.questions.forEach((q) => {
      out[q.key] = (overrides?.[q.key] || "") || deriveFromAnswer(oppAnswers?.[q.key]);
    })
  );
  return out;
}

export default function OpportunityConclusions() {
  const [planId, setPlanId] = useState(null);
  const [oppAnswers, setOppAnswers] = useState({});
  // Solo se guardan los AJUSTES del usuario; lo automático se recalcula
  // siempre desde el cuestionario (si cambia una respuesta, esto se actualiza).
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const stored = await StrategicPlan.getAnswersForSections(plan.id, [
        OPP_SECTION,
        SECTION,
      ]);
      setPlanId(plan.id);
      setOppAnswers(stored[OPP_SECTION] || {});
      setOverrides(stored[SECTION] || {});
    } catch (err) {
      console.error("Error al cargar conclusión de oportunidades:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const effective = effectiveConclusions(oppAnswers, overrides);

  const setChoice = (key, value) => {
    const auto = deriveFromAnswer(oppAnswers[key]);
    setOverrides((prev) => {
      const current = prev[key] || "";
      const effectiveNow = current || auto;
      // Click sobre el valor ya activo: regresa al automático (o queda vacío).
      if (effectiveNow === value) {
        return { ...prev, [key]: "" };
      }
      // Elegir lo mismo que el automático no necesita ajuste guardado.
      if (value === auto) {
        return { ...prev, [key]: "" };
      }
      return { ...prev, [key]: value };
    });
  };

  const restoreAuto = (key) => {
    setOverrides((prev) => ({ ...prev, [key]: "" }));
  };

  // Autoguardado de los ajustes manuales.
  const { status: saveStatus, flush } = useAutosave({
    data: overrides,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, SECTION, overrides);
    },
  });

  const allKeys = OPP_GROUPS.flatMap((g) => g.questions.map((q) => q.key));
  const fCount = allKeys.filter((k) => effective[k] === "F").length;
  const dCount = allKeys.filter((k) => effective[k] === "D").length;
  const pending = allKeys.length - fCount - dCount;

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
          <div className="w-12 h-12 bg-emerald-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ListChecks className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Conclusión de oportunidades</h1>
            <p className="text-muted">Tus fortalezas y debilidades, calculadas de tus respuestas.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-subtitle text-lg mb-1">Esta pantalla se llena sola</h2>
              <p className="text-sm text-muted leading-relaxed">
                Cada <span className="font-subtitle text-green-600 dark:text-green-500">Sí</span> de
                tu análisis de oportunidades se volvió una fortaleza (
                <span className="font-subtitle">voy a mantener</span>) y cada{" "}
                <span className="font-subtitle text-orange-500">No</span> una debilidad (
                <span className="font-subtitle">voy a cambiar</span>). Si no estás de acuerdo
                con alguna, tócala para ajustarla — tu ajuste se respeta aunque cambies
                respuestas del cuestionario.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Award className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="font-subtitle">{fCount}</span> fortalezas
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Wrench className="w-4 h-4 text-orange-500" />
          <span className="font-subtitle">{dCount}</span> debilidades
        </span>
        {pending > 0 && (
          <Link
            to={createPageUrl("OpportunityAnalysis")}
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted hover:border-accent transition-all"
          >
            {pending} sin responder — completa el cuestionario →
          </Link>
        )}
      </div>

      {/* Estrategias por grupo */}
      <div className="space-y-5">
        {OPP_GROUPS.map((group) => (
          <Card key={group.title} className="glass">
            <CardContent className="p-6">
              <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-4">
                {group.title}
              </h3>
              <div className="space-y-4">
                {group.questions.map((item) => {
                  const auto = deriveFromAnswer(oppAnswers[item.key]);
                  const value = effective[item.key];
                  const overridden = !!(overrides[item.key] || "") && overrides[item.key] !== auto;
                  return (
                    <div key={item.key} className="p-4 glass rounded-xl">
                      <p className="text-sm mb-3">{item.strategy}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setChoice(item.key, "F")}
                          className={`px-4 py-1.5 rounded-full text-sm font-subtitle border transition-all inline-flex items-center gap-1.5 ${
                            value === "F"
                              ? "bg-green-500/20 border-green-500/60 text-green-600 dark:text-green-400"
                              : "glass border-[var(--card-border)] hover:border-green-500/50"
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" /> Voy a mantener
                        </button>
                        <button
                          type="button"
                          onClick={() => setChoice(item.key, "D")}
                          className={`px-4 py-1.5 rounded-full text-sm font-subtitle border transition-all inline-flex items-center gap-1.5 ${
                            value === "D"
                              ? "bg-orange-500/20 border-orange-500/60 text-orange-600 dark:text-orange-400"
                              : "glass border-[var(--card-border)] hover:border-orange-500/50"
                          }`}
                        >
                          <Wrench className="w-3.5 h-3.5" /> Voy a cambiar
                        </button>
                        {overridden && (
                          <button
                            type="button"
                            onClick={() => restoreAuto(item.key)}
                            className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
                            title="Volver al valor automático"
                          >
                            <RotateCcw className="w-3 h-3" /> automático
                          </button>
                        )}
                      </div>
                      <p className="flex items-start gap-1.5 text-xs text-muted mt-2.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                        <span>
                          {auto === "" ? (
                            "Aún no respondes esta pregunta en el cuestionario."
                          ) : (
                            <>
                              Respondiste{" "}
                              <span className="font-subtitle">{oppAnswers[item.key]}</span>
                              {" → automático: "}
                              <span className="font-subtitle">
                                {auto === "F" ? "mantener" : "cambiar"}
                              </span>
                              {overridden && (
                                <span className="text-accent"> · ajustado por ti</span>
                              )}
                            </>
                          )}
                        </span>
                      </p>
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
        <Link to={createPageUrl("OpportunityAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Análisis de oportunidades
          </Button>
        </Link>
        <Link to={createPageUrl("FinancialStrategies")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Estrategias financieras →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
