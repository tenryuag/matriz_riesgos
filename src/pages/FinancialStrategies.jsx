import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  Banknote,
  Info,
  Check,
  Wrench,
  Award,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  FIN_GROUPS as FIN_GROUPS_CATALOG,
  FIN_SECTION,
  FIN_SIT_SECTION,
  FIN_SITUATION_GROUPS,
  ALL_FIN_SITUATIONS,
} from "@/config/strategicCatalog";

export const SECTION = FIN_SECTION;
// Catálogo compartido con el servidor MCP.
export const FIN_GROUPS = FIN_GROUPS_CATALOG;

// Estrategias financieras en dos pasos (Excel v2_FODA, planes A y B):
// 1. Situaciones: lo que el usuario reconoce hoy en su empresa. Van directo al
//    FODA con su misma redacción (debilidad o fortaleza).
// 2. Decisiones: qué quiere hacer al respecto. Son las estrategias que entran
//    al resumen para priorizarse y de ahí al mapa y a las iniciativas.

export const ALL_FIN_KEYS = FIN_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const SIT_BY_KEY = Object.fromEntries(ALL_FIN_SITUATIONS.map((s) => [s.key, s]));

export default function FinancialStrategies() {
  const [planId, setPlanId] = useState(null);
  const [situations, setSituations] = useState({});
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const stored = await StrategicPlan.getAnswersForSections(plan.id, [FIN_SIT_SECTION, FIN_SECTION]);
      setPlanId(plan.id);
      setSituations(stored[FIN_SIT_SECTION] || {});
      setDecisions(stored[FIN_SECTION] || {});
    } catch (err) {
      console.error("Error al cargar estrategias financieras:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Paso 1: marcar una situación desmarca su contraria (p. ej. "no tiene
  // liquidez" vs "tiene liquidez suficiente").
  const toggleSituation = (key) => {
    setSituations((prev) => {
      const on = prev[key] === "Sí";
      const next = { ...prev, [key]: on ? "" : "Sí" };
      if (!on) {
        (SIT_BY_KEY[key]?.opposite || []).forEach((k) => {
          if (next[k] === "Sí") next[k] = "";
        });
      }
      return next;
    });
  };

  // Paso 2: decisiones a gestionar.
  const toggleDecision = (key) => {
    setDecisions((prev) => ({ ...prev, [key]: prev[key] === "D" ? "" : "D" }));
  };

  // Autoguardado de ambas secciones en una sola llamada.
  const data = useMemo(() => ({ situations, decisions }), [situations, decisions]);
  const { status: saveStatus, flush } = useAutosave({
    data,
    enabled: !loading && !!planId,
    onSave: async () => {
      await StrategicPlan.saveSections(planId, {
        [FIN_SIT_SECTION]: situations,
        [FIN_SECTION]: decisions,
      });
    },
  });

  const isOn = (key) => situations[key] === "Sí";
  const sitD = ALL_FIN_SITUATIONS.filter((s) => s.type === "D" && isOn(s.key)).length;
  const sitF = ALL_FIN_SITUATIONS.filter((s) => s.type === "F" && isOn(s.key)).length;
  const selected = ALL_FIN_KEYS.filter((k) => decisions[k] === "D").length;
  const suggested = (item) => (item.situations || []).some((k) => isOn(k));

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
            <p className="text-muted">Reconoce tu situación financiera y decide qué vas a trabajar.</p>
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
                Son dos pasos. <span className="text-foreground font-subtitle">Primero</span> marca
                las situaciones financieras que hoy existen en tu empresa: las que te limitan y las
                que juegan a tu favor; entran directo a tu FODA.{" "}
                <span className="text-foreground font-subtitle">Después</span> elige qué quieres
                hacer para resolver o mejorar cada una: esas decisiones entran al Resumen para
                priorizarlas y de ahí al mapa y a las iniciativas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Wrench className="w-4 h-4 text-orange-500" />
          <span className="font-subtitle">{sitD}</span> {sitD === 1 ? "debilidad" : "debilidades"}
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Award className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="font-subtitle">{sitF}</span> {sitF === 1 ? "fortaleza" : "fortalezas"}
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm">
          <Check className="w-4 h-4 text-accent" />
          <span className="font-subtitle">{selected}</span>{" "}
          {selected === 1 ? "decisión a gestionar" : "decisiones a gestionar"}
        </span>
      </div>

      {/* Paso 1: situaciones */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-subtitle text-accent uppercase tracking-wide mb-1">Paso 1</p>
          <h2 className="text-xl font-title">¿Cuál de estas situaciones financieras existe hoy en tu empresa?</h2>
          <p className="text-sm text-muted mt-1">
            Lo que marques entra directo a tu FODA con esta misma redacción.
          </p>
        </div>
        <div className="space-y-5">
          {FIN_SITUATION_GROUPS.map((group) => (
            <Card key={group.title} className="glass">
              <CardContent className="p-6">
                <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-4">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const on = isOn(item.key);
                    const isD = item.type === "D";
                    const Icon = isD ? Wrench : Award;
                    const onClasses = isD
                      ? "bg-orange-500/10 border-orange-500/50"
                      : "bg-green-500/10 border-green-500/50";
                    const boxOn = isD
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-green-500 border-green-500 text-white";
                    const tagClasses = isD
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-green-600 dark:text-green-500";
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleSituation(item.key)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          on ? onClasses : "glass border-[var(--card-border)] hover:border-accent"
                        }`}
                        aria-pressed={on}
                      >
                        <span
                          className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                            on ? boxOn : "border-[var(--card-border)]"
                          }`}
                        >
                          {on && <Check className="w-4 h-4" />}
                        </span>
                        <span className="text-sm flex-grow">{item.label}</span>
                        {on && (
                          <span className={`inline-flex items-center gap-1 text-xs font-subtitle flex-shrink-0 ${tagClasses}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {isD ? "Debilidad" : "Fortaleza"}
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
      </section>

      {/* Paso 2: decisiones por línea del estado de resultados */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-subtitle text-accent uppercase tracking-wide mb-1">Paso 2</p>
          <h2 className="text-xl font-title">¿Qué quieres hacer para resolver o mejorar cada situación?</h2>
          <p className="text-sm text-muted mt-1">
            Las que marques entran al Resumen para priorizarlas y de ahí al mapa y a las iniciativas.
          </p>
        </div>
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
                    const on = decisions[item.key] === "D";
                    const hint = suggested(item);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleDecision(item.key)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          on
                            ? "bg-orange-500/10 border-orange-500/50"
                            : hint
                              ? "glass border-accent/50 hover:border-accent"
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
                        <span className="flex-grow min-w-0">
                          <span className="text-sm block">{item.label}</span>
                          {hint && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-accent mt-0.5">
                              <Sparkles className="w-3 h-3" /> Sugerida por lo que marcaste arriba
                            </span>
                          )}
                        </span>
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
      </section>

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
        <Link to={createPageUrl("ExternalDiagnosis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Diagnóstico externo →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
