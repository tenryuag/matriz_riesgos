import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  Sprout,
  Info,
  Save,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const SECTION = "opportunities";

// Cuestionario de palancas de crecimiento (hoja "Análisis Oportunidades" del
// Excel). Todas las preguntas se responden Sí/No. Cada una está ligada a una
// estrategia: en la siguiente pantalla, "Sí" se vuelve fortaleza y "No"
// debilidad, automáticamente.
export const OPP_GROUPS = [
  {
    title: "Captación de valor",
    questions: [
      { key: "precios", q: "¿Has incrementado precios en el último año?", strategy: "Incrementar precios" },
      { key: "percepcion", q: "¿Has hecho acciones este año para mejorar cómo perciben tu producto o servicio?", strategy: "Incrementar la percepción de valor" },
      { key: "costos_entrega", q: "¿Has reducido los costos de entrega de tu producto o servicio?", strategy: "Disminuir costos de entrega" },
      { key: "complementarios", q: "¿Ofreces productos o servicios complementarios y tus clientes compran más de uno?", strategy: "Ofrecer productos/servicios complementarios" },
      { key: "plan_b", q: "¿Ofreces una opción de menor costo para no perder al cliente (plan B)?", strategy: "Ofrecer producto/servicio de menor costo (Plan B)" },
      { key: "recompra", q: "¿Más de la mitad de tus clientes te vuelven a comprar?", strategy: "Ofrecer alternativas de recompra a clientes recurrentes" },
    ],
  },
  {
    title: "Confianza y redes",
    questions: [
      { key: "contenido", q: "¿Creas contenido en redes sociales? (publicaciones, newsletters, blogs, podcast)", strategy: "Creación de contenido" },
      { key: "publicidad_masiva", q: "¿Pagas publicidad en prensa o medios masivos?", strategy: "Hacer publicidad en medios masivos" },
      { key: "influencers", q: "¿Pagas publicidad con influencers?", strategy: "Hacer publicidad con influencers" },
    ],
  },
  {
    title: "Audiencia",
    questions: [
      { key: "atraccion", q: "¿Tienes estrategias permanentes para atraer audiencia a tu empresa?", strategy: "Estrategias de atracción de clientes" },
      { key: "conversion", q: "¿Tienes estrategias para convertir tu audiencia en clientes potenciales?", strategy: "Estrategias de conversión" },
    ],
  },
  {
    title: "Palanca: capital financiero",
    questions: [
      { key: "liquidez", q: "¿Tienes liquidez holgada para crecer más de un 20% al año?", strategy: "Mejorar la liquidez" },
      { key: "credito", q: "¿Tienes líneas de crédito disponibles para activos o capital de trabajo?", strategy: "Solicitar o incrementar líneas de crédito" },
      { key: "socios", q: "¿Tienes acceso a socios, accionistas o inversionistas?", strategy: "Atraer socios inversionistas" },
      { key: "family_friends", q: "¿Tienes acceso a préstamos de familiares o amigos?", strategy: "Obtener préstamos 'family and friends'" },
      { key: "ahorros", q: "¿Tienes ahorros para soportar tu crecimiento del próximo año?", strategy: "Generar ahorros para crecimiento e imprevistos" },
      { key: "cartera", q: "¿Tienes una cartera de clientes diversificada?", strategy: "Diversificar la cartera de clientes" },
      { key: "proveeduria", q: "¿Tienes diversificada tu proveeduría?", strategy: "Diversificar el portafolio de proveedores" },
      { key: "reinversion", q: "¿Reinviertes en activos de forma permanente?", strategy: "Realizar inversiones en activos" },
    ],
  },
  {
    title: "Palanca: capital social",
    questions: [
      { key: "alianzas", q: "¿Tienes alianzas con empresas que complementan tus productos o servicios?", strategy: "Generar alianzas con competidores complementarios" },
      { key: "clientes_clave", q: "¿Tienes relaciones sólidas con clientes estratégicos?", strategy: "Generar alianzas con clientes estratégicos" },
      { key: "comunidad", q: "¿Tienes comunidad en redes sociales?", strategy: "Construir comunidad en redes sociales" },
      { key: "socios_estrategicos", q: "¿Tienes relaciones con posibles socios o inversionistas estratégicos?", strategy: "Generar alianzas con socios estratégicos" },
      { key: "proveedores_clave", q: "¿Tienes relaciones sólidas con proveedores estratégicos?", strategy: "Generar alianzas con proveedores estratégicos" },
    ],
  },
  {
    title: "Palanca: capital de conocimiento",
    questions: [
      { key: "info_interna", q: "¿Tienes información interna suficiente para tomar decisiones estratégicas?", strategy: "Generar información interna para decisiones" },
      { key: "info_mercado", q: "¿Tienes información suficiente de tu mercado?", strategy: "Obtener información del mercado" },
      { key: "info_competencia", q: "¿Tienes información suficiente de tu competencia?", strategy: "Obtener información de competidores" },
      { key: "patentes", q: "¿Tienes alguna patente?", strategy: "Tramitar patentes" },
      { key: "software", q: "¿Tienes algún software o aplicación propia?", strategy: "Desarrollar software / tecnología" },
      { key: "ia", q: "¿Usas inteligencia artificial en tu operación?", strategy: "Automatizar procesos con inteligencia artificial" },
    ],
  },
  {
    title: "Palanca: capital humano",
    questions: [
      { key: "talento", q: "¿Tienes un equipo talentoso?", strategy: "Construir un equipo talentoso" },
      { key: "madurez", q: "¿Tienes un equipo maduro?", strategy: "Construir un equipo maduro" },
      { key: "resultados", q: "¿Tu equipo está enfocado a resultados?", strategy: "Trabajar el enfoque a resultados del equipo" },
      { key: "compromiso", q: "¿Tu equipo está comprometido?", strategy: "Trabajar el compromiso del equipo" },
      { key: "formacion", q: "¿Inviertes en la capacitación de tu personal?", strategy: "Invertir en formación" },
      { key: "bienestar", q: "¿Incluyes medidas de bienestar en los indicadores de tus directivos?", strategy: "Adoptar medidas de bienestar para el equipo" },
      { key: "gerencia", q: "¿Tu línea gerencial está enfocada a la estrategia del negocio?", strategy: "Desarrollar un equipo directivo enfocado a la estrategia" },
      { key: "metas", q: "¿Tus metas financieras están alineadas a los indicadores de tu equipo?", strategy: "Sistema de gestión con indicadores de productividad" },
    ],
  },
  {
    title: "Tu producto o servicio",
    questions: [
      { key: "mejora_continua", q: "¿Tienes procesos de mejora continua para la calidad?", strategy: "Desarrollar procesos de mejora continua" },
      { key: "ciclo_comercial", q: "¿Tienes identificado tu ciclo comercial (preventa, venta y posventa)?", strategy: "Desarrollar el ciclo comercial completo" },
    ],
  },
];

export const ALL_OPP_KEYS = OPP_GROUPS.flatMap((g) => g.questions.map((q) => q.key));

export default function OpportunityAnalysis() {
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
