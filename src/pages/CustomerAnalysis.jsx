import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  Users,
  Info,
  Save,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const SECTION = "customer";

// Preguntas del análisis del cliente (tomadas del Excel de planeación
// estratégica), con una ayuda en lenguaje simple para quien no conoce el tema.
// Se exporta para que el hub del módulo muestre el progreso real.
export const QUESTIONS = [
  {
    key: "dolores",
    q: "¿Qué problemas o dolores de tus clientes resuelve tu producto o servicio?",
    help: "Piensa en lo que le molesta o le complica la vida a tu cliente y que tú le solucionas.",
  },
  {
    key: "deseos",
    q: "¿Qué deseos o sueños de tus clientes atiende tu producto o servicio?",
    help: "Lo que tu cliente quiere lograr o cómo quiere sentirse.",
  },
  {
    key: "metas_funcionales",
    q: "¿Cuáles son las metas funcionales que resuelve tu producto o servicio?",
    help: "Meta funcional = ¿a dónde quiere llegar tu cliente? ¿qué quiere hacer con tu producto?",
  },
  {
    key: "metas_emocionales",
    q: "¿Cuáles son las metas emocionales que quiere resolver tu cliente?",
    help: "Meta emocional = ¿cómo se sentirá cuando cumpla sus metas funcionales?",
  },
  {
    key: "deseos_basicos",
    q: "¿Cuáles son los deseos básicos de tu cliente?",
    help: "Por ejemplo: tranquilidad, seguridad, familia, estatus, ahorrar, crecer, poder.",
  },
  {
    key: "objeciones_exterior",
    q: "¿Qué objeciones tienen tus clientes por cosas de afuera?",
    help: "Aspectos externos: la economía, el gobierno, el mercado, la incertidumbre, etc.",
  },
  {
    key: "objeciones_producto",
    q: "¿Qué objeciones tienen tus clientes con tu producto o servicio?",
    help: "Por ejemplo: el precio, la entrega, el uso, el servicio post-venta.",
  },
  {
    key: "promesa",
    q: "¿Cuál es la promesa de transformación de tu producto o servicio para el cliente?",
    help: "Una buena promesa toca sus dolores, deseos y metas — y le facilita la vida.",
  },
  {
    key: "comunicacion",
    q: "¿Tu forma de comunicarte con tus clientes toma en cuenta todo lo anterior?",
    help: "Revisa si tus mensajes y publicidad reflejan lo que respondiste arriba.",
  },
];

export default function CustomerAnalysis() {
  const [planId, setPlanId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
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
