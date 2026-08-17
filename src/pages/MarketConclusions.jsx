import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan, Competitor } from "@/api/entities";
import {
  ArrowLeft,
  ClipboardCheck,
  Info,
  Save,
  CheckCircle2,
  Sparkles,
  Award,
  Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const SECTION = "market-conclusions";
const MARKET_SECTION = "market";
const compSection = (id) => `market-comp:${id}`;

// Catálogo de estrategias del mercado (de la hoja "Conclusiones del mercado"
// del Excel), agrupado por tema. Para cada una el usuario decide:
// F = "Voy a mantener" (fortaleza) · D = "Voy a cambiar" (debilidad).
export const CATALOG = [
  {
    category: "Precio",
    items: [{ key: "precio_valor", label: "Incrementar el valor vs el precio" }],
  },
  {
    category: "Servicio",
    items: [
      { key: "servicio_calidad", label: "Mejorar la calidad de servicio" },
      { key: "servicio_encuestas", label: "Implementar encuestas de satisfacción a clientes" },
      { key: "servicio_resenas", label: "Solicitar reseñas y testimonios de clientes" },
    ],
  },
  {
    category: "Servicio post-venta",
    items: [
      { key: "postventa_retencion", label: "Mejorar el servicio post-venta para retener clientes" },
    ],
  },
  {
    category: "Entrega e imagen",
    items: [
      { key: "entrega_simple", label: "Hacer la entrega más simple para el cliente" },
      { key: "entrega_comodo", label: "Hacer la entrega más cómoda para el cliente" },
      { key: "entrega_riesgo", label: "Disminuir el riesgo para el cliente" },
      { key: "entrega_tiempo", label: "Optimizar el tiempo y la forma de entrega" },
      { key: "entrega_imagen", label: "Fortalecer la imagen de la marca" },
    ],
  },
  {
    category: "Responsabilidad social",
    items: [
      { key: "rs_comunicacion", label: "Mejorar la comunicación de responsabilidad social" },
    ],
  },
  {
    category: "Audiencia",
    items: [
      { key: "audiencia_incrementar", label: "Incrementar la audiencia" },
      { key: "audiencia_leads", label: "Incrementar los prospectos (leads)" },
    ],
  },
];

const ALL_KEYS = CATALOG.flatMap((c) => c.items.map((i) => i.key));

// Sugerencias calculadas a partir del análisis del mercado. Cada una dice por
// qué y qué opción sugiere (F o D). Son solo ayudas: el usuario decide.
function computeHints(competitors, answersBySection) {
  const global = answersBySection[MARKET_SECTION] || {};
  const compAnswers = competitors.map((c) => answersBySection[compSection(c.id)] || {});
  const count = (key, value) => compAnswers.filter((a) => a[key] === value).length;
  const any = (key, value) => count(key, value) > 0;
  const total = compAnswers.length;
  const hints = {};

  if (total > 0) {
    const menor = count("precio", "Menor");
    const mayor = count("precio", "Mayor");
    if (menor > mayor && menor > 0) {
      hints.precio_valor = { suggest: "D", why: "La mayoría de tus competidores tiene precios menores que el tuyo." };
    } else if (mayor > menor && mayor > 0) {
      hints.precio_valor = { suggest: "F", why: "Tu precio es más competitivo que el de la mayoría." };
    }

    const mejor = count("servicio", "Mejor");
    const peor = count("servicio", "Peor");
    if (mejor > peor && mejor > 0) {
      hints.servicio_calidad = { suggest: "D", why: "Varios competidores ofrecen mejor servicio que el tuyo." };
    } else if (peor > mejor && peor > 0) {
      hints.servicio_calidad = { suggest: "F", why: "Tu servicio es mejor que el de la mayoría de tus competidores." };
    }

    if (any("encuestas", "Sí")) {
      hints.servicio_encuestas = { suggest: "D", why: "Al menos un competidor ya hace encuestas de satisfacción." };
    }
    if (any("resenas", "Sí")) {
      hints.servicio_resenas = { suggest: "D", why: "Al menos un competidor ya recaba reseñas de clientes." };
    }
    if (any("postventa_mejor", "Sí")) {
      hints.postventa_retencion = { suggest: "D", why: "Algún competidor tiene mejor post-venta que el tuyo." };
    }
    if (any("entrega_simple", "Sí")) {
      hints.entrega_simple = { suggest: "D", why: "Algún competidor entrega de forma más simple que tú." };
    } else if (count("entrega_simple", "No") === total && total > 0) {
      hints.entrega_simple = { suggest: "F", why: "Ningún competidor entrega más simple que tú." };
    }
    if (any("entrega_comoda", "Sí")) {
      hints.entrega_comodo = { suggest: "D", why: "Algún competidor ofrece una entrega más cómoda." };
    } else if (count("entrega_comoda", "No") === total && total > 0) {
      hints.entrega_comodo = { suggest: "F", why: "Tu entrega es tan cómoda o más que la de tus competidores." };
    }
    if (any("imagen", "Sí")) {
      hints.entrega_imagen = { suggest: "D", why: "Algún competidor tiene mejor imagen de marca." };
    }
    if (any("redes", "Sí") || any("publicidad", "Sí")) {
      hints.audiencia_incrementar = { suggest: "D", why: "Tus competidores ya están activos en redes o publicidad." };
      hints.audiencia_leads = { suggest: "D", why: "La competencia ya invierte en atraer prospectos." };
    }
  }

  if (global.rs_propia === "No") {
    hints.rs_comunicacion = { suggest: "D", why: "Indicaste que aún no comunicas una estrategia de medio ambiente." };
  } else if (global.rs_propia === "Sí") {
    hints.rs_comunicacion = { suggest: "F", why: "Ya tienes y comunicas una estrategia de responsabilidad social." };
  }

  return hints;
}

export default function MarketConclusions() {
  const [planId, setPlanId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [hints, setHints] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const comps = await Competitor.list(plan.id);
      const sections = [SECTION, MARKET_SECTION, ...comps.map((c) => compSection(c.id))];
      const stored = await StrategicPlan.getAnswersForSections(plan.id, sections);
      setPlanId(plan.id);
      setAnswers(stored[SECTION] || {});
      setHints(computeHints(comps, stored));
    } catch (err) {
      console.error("Error al cargar conclusiones del mercado:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setChoice = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));
    setSavedAt(false);
  };

  const handleSave = async () => {
    if (!planId) return;
    setSaving(true);
    setError("");
    try {
      await StrategicPlan.saveAnswers(planId, SECTION, answers);
      setSavedAt(true);
    } catch (err) {
      console.error("Error al guardar:", err);
      setError("No se pudieron guardar los cambios. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const fCount = ALL_KEYS.filter((k) => answers[k] === "F").length;
  const dCount = ALL_KEYS.filter((k) => answers[k] === "D").length;
  const pending = ALL_KEYS.length - fCount - dCount;

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
          <div className="w-12 h-12 bg-blue-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Conclusiones del mercado</h1>
            <p className="text-muted">Decide qué vas a mantener y qué vas a cambiar.</p>
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
                Para cada aspecto del mercado, marca{" "}
                <span className="text-green-600 dark:text-green-500 font-subtitle">Voy a mantener</span>{" "}
                si hoy es una fortaleza tuya, o{" "}
                <span className="text-orange-500 font-subtitle">Voy a cambiar</span>{" "}
                si es algo que quieres trabajar. Cuando veas el ícono ✨ es una sugerencia
                calculada con tus respuestas del análisis del mercado — tú tienes la última palabra.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Award className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="font-subtitle">{fCount}</span> a mantener
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Wrench className="w-4 h-4 text-orange-500" />
          <span className="font-subtitle">{dCount}</span> a cambiar
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted">
          {pending} sin decidir
        </span>
      </div>

      {/* Catálogo por categoría */}
      <div className="space-y-5">
        {CATALOG.map((group) => (
          <Card key={group.category} className="glass">
            <CardContent className="p-6">
              <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-4">
                {group.category}
              </h3>
              <div className="space-y-4">
                {group.items.map((item) => {
                  const value = answers[item.key] || "";
                  const hint = hints[item.key];
                  return (
                    <div key={item.key} className="p-4 glass rounded-xl">
                      <p className="text-sm mb-3">{item.label}</p>
                      <div className="flex flex-wrap gap-2">
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
                      </div>
                      {hint && (
                        <p className="flex items-start gap-1.5 text-xs text-muted mt-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                          <span>
                            {hint.why}{" "}
                            <span className="text-accent font-subtitle">
                              Sugerencia: {hint.suggest === "F" ? "mantener" : "cambiar"}.
                            </span>
                          </span>
                        </p>
                      )}
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

      {/* Siguiente paso del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("MarketAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Análisis del mercado
          </Button>
        </Link>
        <Link to={createPageUrl("OpportunityAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Análisis de oportunidades →
          </Button>
        </Link>
      </div>

      {/* Barra de guardado fija */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-80 z-30 glass-darker border-t border-[var(--card-border)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="text-sm text-muted flex items-center gap-2">
            {savedAt && (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Guardado
              </>
            )}
          </span>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Guardar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
