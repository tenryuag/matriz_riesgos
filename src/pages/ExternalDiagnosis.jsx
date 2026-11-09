import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  Radar,
  Info,
  Sprout,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { EXT_GROUPS, EXT_SECTION, ALL_EXT_KEYS } from "@/config/strategicCatalog";

// ============================================================
// Diagnóstico externo (hoja "Diagnóstico Externo" del Excel v2_FODA).
// 19 preguntas de Sí/No sobre el entorno. Cada "Sí" entra al FODA como
// oportunidad o amenaza con su redacción, y su estrategia derivada pasa al
// Resumen para priorizarse. "No" o sin responder no genera nada.
// ============================================================

export const SECTION = EXT_SECTION;

const KIND = {
  O: {
    label: "Oportunidad",
    icon: Sprout,
    chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40",
  },
  A: {
    label: "Amenaza",
    icon: ShieldAlert,
    chip: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40",
  },
};

// Botonera Sí/No (mismo patrón que el análisis del mercado).
function Choice({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? "" : opt)}
          aria-pressed={value === opt}
          className={`px-4 py-1.5 rounded-full text-sm font-subtitle border transition-all ${
            value === opt
              ? "bg-accent text-accent-foreground border-accent"
              : "glass border-[var(--card-border)] hover:border-accent"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

Choice.propTypes = {
  value: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default function ExternalDiagnosis() {
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
      console.error("Error al cargar el diagnóstico externo:", err);
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

  // Autoguardado.
  const { status: saveStatus, flush } = useAutosave({
    data: answers,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveAnswers(planId, SECTION, answers);
    },
  });

  const allQuestions = EXT_GROUPS.flatMap((g) => g.questions);
  const answered = ALL_EXT_KEYS.filter((k) => answers[k] === "Sí" || answers[k] === "No").length;
  const countYes = (type) =>
    allQuestions.filter((q) => q.type === type && answers[q.key] === "Sí").length;
  const opportunities = countYes("O");
  const threats = countYes("A");

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
            <Radar className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Diagnóstico externo</h1>
            <p className="text-muted">Mira hacia afuera: qué del mercado te favorece y qué te amenaza.</p>
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
                Son {allQuestions.length} preguntas de Sí o No sobre tu entorno: mercado,
                competencia, tendencias, tecnología, economía, regulación, nuevos mercados y
                sustitutos. Cada <span className="font-subtitle text-foreground">Sí</span> se
                vuelve una oportunidad o una amenaza en tu FODA y una estrategia que podrás
                priorizar en el Resumen. Un &ldquo;No&rdquo; o una pregunta sin responder no genera nada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <span className="font-subtitle">{answered}</span> de {allQuestions.length} respondidas
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-blue-600 dark:text-blue-400">
          <Sprout className="w-4 h-4" />
          <span className="font-subtitle">{opportunities}</span>{" "}
          {opportunities === 1 ? "oportunidad detectada" : "oportunidades detectadas"}
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-red-600 dark:text-red-400">
          <ShieldAlert className="w-4 h-4" />
          <span className="font-subtitle">{threats}</span>{" "}
          {threats === 1 ? "amenaza detectada" : "amenazas detectadas"}
        </span>
      </div>

      {/* Preguntas por categoría */}
      <div className="space-y-5">
        {EXT_GROUPS.map((group) => (
          <Card key={group.title} className="glass">
            <CardContent className="p-6">
              <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-4">
                {group.title}
              </h3>
              <div className="space-y-4">
                {group.questions.map((item) => {
                  const value = answers[item.key] || "";
                  const kind = KIND[item.type];
                  const KindIcon = kind.icon;
                  return (
                    <div key={item.key} className="p-4 glass rounded-xl">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <p id={`ext-q-${item.key}`} className="text-sm flex-grow min-w-0">{item.q}</p>
                        <div className="flex-shrink-0" role="group" aria-labelledby={`ext-q-${item.key}`}>
                          <Choice
                            value={value}
                            options={["Sí", "No"]}
                            onChange={(v) => setAnswer(item.key, v)}
                          />
                        </div>
                      </div>

                      {value === "Sí" && (
                        <div className="mt-3 pt-3 border-t border-[var(--card-border)] space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-subtitle border ${kind.chip}`}
                          >
                            <KindIcon className="w-3 h-3" />
                            {kind.label}
                          </span>
                          <p className="text-xs text-muted">
                            <span className="font-subtitle text-foreground">Al FODA:</span>{" "}
                            {item.foda}
                          </p>
                          <p className="text-xs text-muted">
                            <span className="font-subtitle text-foreground">Estrategia:</span>{" "}
                            {item.strategy}
                          </p>
                          <p className="flex items-start gap-1.5 text-xs text-muted">
                            <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                            <span>
                              <span className="font-subtitle text-foreground">Iniciativa sugerida:</span>{" "}
                              {item.initiative}
                            </span>
                          </p>
                        </div>
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

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinancialStrategies")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Estrategias financieras
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
