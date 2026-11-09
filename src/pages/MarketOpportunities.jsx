import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import { ArrowLeft, Waves, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { MARKET_SECTION, OCEAN_QUESTIONS } from "@/config/strategicCatalog";

// ============================================================
// Oportunidades del mercado (lienzo Blue Ocean): eliminar, reducir, crear e
// incrementar. Antes vivía al final de "Análisis del mercado"; ahora es un
// paso propio entre el análisis y las conclusiones del mercado. Las
// respuestas se guardan en la misma sección "market" (solo las claves bo_*),
// así lo capturado antes sigue ahí y el FODA y el servidor MCP no cambian.
// Lo que se escribe en Crear e Incrementar entra al FODA como oportunidades,
// una por línea.
// ============================================================

const OCEAN_KEYS = OCEAN_QUESTIONS.map((q) => q.key);

// Deja solo las respuestas Blue Ocean de la sección "market".
const onlyOcean = (answers) =>
  Object.fromEntries(OCEAN_KEYS.map((k) => [k, (answers || {})[k] || ""]));

export default function MarketOpportunities() {
  const [planId, setPlanId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const stored = await StrategicPlan.getAnswers(plan.id, MARKET_SECTION);
      setPlanId(plan.id);
      setAnswers(onlyOcean(stored));
    } catch (err) {
      console.error("Error al cargar oportunidades del mercado:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Autoguardado: solo las claves bo_* (el upsert no toca las demás
  // respuestas de la sección, p. ej. la de responsabilidad social).
  const { status: saveStatus, flush } = useAutosave({
    data: answers,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, MARKET_SECTION, onlyOcean(answers));
    },
  });

  const answered = OCEAN_KEYS.filter((k) => (answers[k] || "").trim()).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2, 3, 4].map((i) => (
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
            <Waves className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Oportunidades del mercado</h1>
            <p className="text-muted">Con lo que viste de tu competencia, responde estas 4 preguntas.</p>
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
                Este es el lienzo Blue Ocean: piensa qué puedes{" "}
                <span className="text-foreground font-subtitle">eliminar</span>,{" "}
                <span className="text-foreground font-subtitle">reducir</span>,{" "}
                <span className="text-foreground font-subtitle">crear</span> e{" "}
                <span className="text-foreground font-subtitle">incrementar</span> frente a lo que
                ofrece tu competencia. Lo que escribas en Crear e Incrementar entra a tu FODA como
                oportunidades, una por línea. Las respuestas se guardan solas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Waves className="w-4 h-4 text-cyan-500" />
          <span className="font-subtitle">{answered}</span> de {OCEAN_KEYS.length} preguntas respondidas
        </span>
      </div>

      {/* Las 4 preguntas */}
      <div className="space-y-4">
        {OCEAN_QUESTIONS.map((item) => (
          <Card key={item.key} className="glass">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-subtitle bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  {item.label}
                </span>
              </div>
              <label htmlFor={`ocean-${item.key}`} className="text-sm block mb-2">
                {item.q}
              </label>
              <textarea
                id={`ocean-${item.key}`}
                value={answers[item.key] || ""}
                onChange={(e) => setAnswer(item.key, e.target.value)}
                rows={2}
                placeholder="Escribe tu respuesta aquí…"
                className="w-full p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent resize-y"
              />
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
        <Link to={createPageUrl("MarketAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Análisis del mercado
          </Button>
        </Link>
        <Link to={createPageUrl("MarketConclusions")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Conclusiones del mercado →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
