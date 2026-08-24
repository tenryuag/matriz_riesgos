import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  ListOrdered,
  Info,
  Award,
  Wrench,
  Calculator,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { CATALOG as MKT_CATALOG, SECTION as MKT_CONCL_SECTION } from "./MarketConclusions";
import { OPP_GROUPS, SECTION as OPP_SECTION } from "./OpportunityAnalysis";
import { SECTION as OPP_CONCL_SECTION, effectiveConclusions } from "./OpportunityConclusions";
import { FIN_GROUPS, SECTION as FIN_SECTION } from "./FinancialStrategies";

export const RATING_SECTION = "summary-ratings";

// Secciones que el resumen necesita leer (útil también para el hub).
export const SUMMARY_SOURCE_SECTIONS = [
  MKT_CONCL_SECTION,
  OPP_SECTION,
  OPP_CONCL_SECTION,
  FIN_SECTION,
];

// Junta las estrategias de las tres fuentes: conclusiones del mercado,
// conclusión de oportunidades (efectiva) y estrategias financieras.
export function collectStrategies(sections) {
  const weaknesses = [];
  const strengths = [];

  const mkt = sections[MKT_CONCL_SECTION] || {};
  MKT_CATALOG.forEach((g) =>
    g.items.forEach((i) => {
      if (mkt[i.key] === "D") weaknesses.push({ id: `mkt:${i.key}`, label: i.label, source: "market" });
      else if (mkt[i.key] === "F") strengths.push({ label: i.label, source: "market" });
    })
  );

  const oppEff = effectiveConclusions(sections[OPP_SECTION] || {}, sections[OPP_CONCL_SECTION] || {});
  OPP_GROUPS.forEach((g) =>
    g.questions.forEach((q) => {
      if (oppEff[q.key] === "D") weaknesses.push({ id: `opp:${q.key}`, label: q.strategy, source: "opportunities" });
      else if (oppEff[q.key] === "F") strengths.push({ label: q.strategy, source: "opportunities" });
    })
  );

  const fin = sections[FIN_SECTION] || {};
  FIN_GROUPS.forEach((g) =>
    g.items.forEach((i) => {
      if (fin[i.key] === "D") weaknesses.push({ id: `fin:${i.key}`, label: i.label, source: "financial" });
    })
  );

  return { weaknesses, strengths };
}

// Motor de priorización del Excel:
// Prioridad = Costo×0.2 + Riesgo×0.5 + Complejidad×0.15 + Beneficio×0.15
// (Alto/Alta=3 · Medio/Media=2 · Bajo/Baja=1 · Ingresos=1 · Ahorros=2)
// Puntaje bajo = atacar primero: 1–1.39 Alta · 1.4–2.34 Media · 2.35–3 Baja.
const level3 = (v) =>
  v?.startsWith("Alt") ? 3 : v?.startsWith("Med") ? 2 : v?.startsWith("Baj") ? 1 : null;
const benefit2 = (v) => (v === "Ingresos" ? 1 : v === "Ahorros" ? 2 : null);

export function scoreFor(ratings, id) {
  const c = level3(ratings[`${id}:costo`]);
  const r = level3(ratings[`${id}:riesgo`]);
  const x = level3(ratings[`${id}:complejidad`]);
  const b = benefit2(ratings[`${id}:beneficio`]);
  if ([c, r, x, b].some((v) => v == null)) return null;
  return Math.round((c * 0.2 + r * 0.5 + x * 0.15 + b * 0.15) * 100) / 100;
}

export function priorityFor(score) {
  if (score == null) return null;
  if (score <= 1.39) return "Alta";
  if (score <= 2.34) return "Media";
  return "Baja";
}

const SOURCES = [
  { key: "market", title: "Del análisis del mercado" },
  { key: "opportunities", title: "De tus oportunidades" },
  { key: "financial", title: "De tus finanzas" },
];

const DIMS = [
  { dim: "costo", label: "Costo de implementar", options: ["Alto", "Medio", "Bajo"], help: "¿Qué tan caro es hacerlo?" },
  { dim: "riesgo", label: "Riesgo de fracasar", options: ["Alto", "Medio", "Bajo"], help: "¿Qué tan probable es que no funcione?" },
  { dim: "complejidad", label: "Complejidad", options: ["Alta", "Media", "Baja"], help: "¿Qué tan complicado es implementarlo?" },
  { dim: "beneficio", label: "Beneficio principal", options: ["Ingresos", "Ahorros"], help: "¿Genera ingresos o produce ahorros?" },
];

function PriorityBadge({ priority, score }) {
  if (!priority) return null;
  const styles = {
    Alta: "border-green-500/50 bg-green-500/15 text-green-600 dark:text-green-400",
    Media: "border-amber-400/50 bg-amber-400/10 text-amber-600 dark:text-amber-400",
    Baja: "border-gray-400/40 bg-gray-500/10 text-gray-500 dark:text-gray-400",
  };
  const captions = {
    Alta: "¡Empieza por aquí!",
    Media: "Para después",
    Baja: "Puede esperar",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border flex-shrink-0 ${styles[priority]}`}
      title={`Puntaje: ${score}`}
    >
      Prioridad {priority.toLowerCase()} · {captions[priority]}
    </span>
  );
}

export default function StrategicSummary() {
  const [planId, setPlanId] = useState(null);
  const [sections, setSections] = useState({});
  const [ratings, setRatings] = useState({});
  const [showStrengths, setShowStrengths] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const stored = await StrategicPlan.getAnswersForSections(plan.id, [
        ...SUMMARY_SOURCE_SECTIONS,
        RATING_SECTION,
      ]);
      setPlanId(plan.id);
      setSections(stored);
      setRatings(stored[RATING_SECTION] || {});
    } catch (err) {
      console.error("Error al cargar el resumen:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRating = (id, dim, value) => {
    const key = `${id}:${dim}`;
    setRatings((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));
  };

  // Autoguardado de las calificaciones.
  const { status: saveStatus, flush } = useAutosave({
    data: ratings,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, RATING_SECTION, ratings);
    },
  });

  const { weaknesses, strengths } = collectStrategies(sections);
  const scored = weaknesses.map((w) => {
    const score = scoreFor(ratings, w.id);
    return { ...w, score, priority: priorityFor(score) };
  });
  const ratedCount = scored.filter((w) => w.score != null).length;
  const countBy = (p) => scored.filter((w) => w.priority === p).length;

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
          <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ListOrdered className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Resumen y priorización</h1>
            <p className="text-muted">Todas tus debilidades juntas — y por dónde empezar.</p>
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
                Aquí están las debilidades que marcaste en el mercado, las oportunidades y
                tus finanzas. Califica cada una en 4 aspectos y el sistema calculará su
                prioridad: <span className="text-green-600 dark:text-green-500 font-subtitle">alta</span> significa
                barata, de bajo riesgo y con buen beneficio — por ahí conviene empezar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cómo se calcula (plegable) */}
      <details className="glass rounded-2xl">
        <summary className="flex items-center gap-2 p-4 cursor-pointer select-none text-sm font-subtitle">
          <Calculator className="w-4 h-4 text-accent" />
          ¿Cómo se calcula la prioridad?
          <ChevronDown className="w-4 h-4 text-muted ml-auto" />
        </summary>
        <div className="px-5 pb-5 text-sm text-muted space-y-2">
          <p>
            Cada calificación vale puntos (Alto/Alta = 3 · Medio/Media = 2 · Bajo/Baja = 1 ·
            Ingresos = 1 · Ahorros = 2) y se combinan con estos pesos:
          </p>
          <p className="font-mono text-xs glass rounded-lg p-3">
            Puntaje = Costo×0.20 + Riesgo×0.50 + Complejidad×0.15 + Beneficio×0.15
          </p>
          <p>
            Entre <span className="font-subtitle text-foreground">más bajo el puntaje, más pronto conviene empezar</span>:
            1–1.39 alta · 1.4–2.34 media · 2.35–3 baja. El riesgo pesa la mitad de la
            calificación: preferimos lo que tiene más probabilidad de salir bien.
          </p>
        </div>
      </details>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Wrench className="w-4 h-4 text-orange-500" />
          <span className="font-subtitle">{weaknesses.length}</span> debilidades
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted">
          {ratedCount} calificadas
        </span>
        {ratedCount > 0 && (
          <>
            <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-green-600 dark:text-green-500">
              {countBy("Alta")} alta
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-amber-600 dark:text-amber-400">
              {countBy("Media")} media
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted">
              {countBy("Baja")} baja
            </span>
          </>
        )}
      </div>

      {/* Sin debilidades aún */}
      {weaknesses.length === 0 && (
        <Card className="glass">
          <CardContent className="p-8 text-center text-muted space-y-3">
            <p className="text-sm">
              Aún no hay debilidades marcadas. Completa las pantallas de análisis y
              conclusiones para que aparezcan aquí.
            </p>
            <Link to={createPageUrl("MarketConclusions")} className="text-accent text-sm font-subtitle hover:underline">
              Ir a Conclusiones del mercado →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Debilidades por fuente */}
      {SOURCES.map((src) => {
        const items = scored.filter((w) => w.source === src.key);
        if (items.length === 0) return null;
        return (
          <div key={src.key} className="space-y-3">
            <h2 className="font-subtitle text-sm text-accent uppercase tracking-wide">
              {src.title} ({items.length})
            </h2>
            {items.map((w) => (
              <Card key={w.id} className="glass">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <p className="text-sm font-subtitle flex-grow">{w.label}</p>
                    {w.priority ? (
                      <PriorityBadge priority={w.priority} score={w.score} />
                    ) : (
                      <span className="text-xs text-muted flex-shrink-0">Sin calificar</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {DIMS.map((d) => (
                      <div key={d.dim} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-xs text-muted sm:w-44 flex-shrink-0" title={d.help}>
                          {d.label}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {d.options.map((opt) => {
                            const on = ratings[`${w.id}:${d.dim}`] === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setRating(w.id, d.dim, opt)}
                                className={`px-3 py-1 rounded-full text-xs font-subtitle border transition-all ${
                                  on
                                    ? "bg-accent text-accent-foreground border-accent"
                                    : "glass border-[var(--card-border)] hover:border-accent"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}

      {/* Fortalezas (referencia) */}
      {strengths.length > 0 && (
        <Card className="glass">
          <CardContent className="p-5">
            <button
              type="button"
              onClick={() => setShowStrengths((s) => !s)}
              className="w-full flex items-center gap-2 text-sm font-subtitle"
            >
              <Award className="w-4 h-4 text-green-600 dark:text-green-500" />
              Fortalezas a mantener ({strengths.length})
              <ChevronDown
                className={`w-4 h-4 text-muted ml-auto transition-transform ${showStrengths ? "rotate-180" : ""}`}
              />
            </button>
            {showStrengths && (
              <div className="mt-4 flex flex-wrap gap-2">
                {strengths.map((s, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-xs glass border border-green-500/30 text-green-700 dark:text-green-400"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinancialStrategies")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Estrategias financieras
          </Button>
        </Link>
        <Link to={createPageUrl("StrategicMap")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Mapa estratégico →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
