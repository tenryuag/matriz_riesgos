import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import { ArrowLeft, Users, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { CUSTOMER_QUESTIONS } from "@/config/strategicCatalog";

export const SECTION = "customer";

// Preguntas (catálogo compartido con el servidor MCP).
export const QUESTIONS = CUSTOMER_QUESTIONS;


export default function CustomerAnalysis() {
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
      console.error("Error al cargar el análisis del cliente:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Autoguardado: persiste ~1.5 s después del último cambio.
  const { status: saveStatus, flush } = useAutosave({
    data: answers,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, SECTION, answers);
    },
  });

  const answeredCount = QUESTIONS.filter((q) => (answers[q.key] || "").trim()).length;

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
            <Users className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Análisis del cliente</h1>
            <p className="text-muted">Conoce a fondo a tu cliente para enfocar tu estrategia.</p>
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
              <h2 className="font-subtitle text-lg mb-1">¿Para qué sirve esto?</h2>
              <p className="text-sm text-muted leading-relaxed">
                Responde con calma estas preguntas sobre tu cliente. No hay respuestas
                correctas o incorrectas: entre mejor lo conozcas, más fácil será tomar
                buenas decisiones después. Puedes guardar y volver cuando quieras.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progreso */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {answeredCount} de {QUESTIONS.length} preguntas respondidas
        </span>
        <div className="w-40 h-2 glass rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Preguntas */}
      <div className="space-y-5">
        {QUESTIONS.map((item, idx) => (
          <Card key={item.key} className="glass">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-subtitle flex-shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <label className="font-subtitle block mb-1" htmlFor={item.key}>
                    {item.q}
                  </label>
                  <p className="text-xs text-muted">{item.help}</p>
                </div>
              </div>
              <textarea
                id={item.key}
                value={answers[item.key] || ""}
                onChange={(e) => handleChange(item.key, e.target.value)}
                rows={3}
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

      {/* Siguiente paso del recorrido */}
      <div className="flex justify-end">
        <Link to={createPageUrl("MarketAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Paso 2: Analiza tu mercado →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
