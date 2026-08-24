import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan } from "@/api/entities";
import {
  ArrowLeft,
  Map,
  Filter,
  Info,
  Users,
  Banknote,
  Rocket,
  HeartHandshake,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RATING_SECTION,
  SUMMARY_SOURCE_SECTIONS,
  collectStrategies,
  scoreFor,
  priorityFor,
} from "./StrategicSummary";
import { OPP_GROUPS } from "./OpportunityAnalysis";

// ============================================================
// Mapa estratégico (y su versión calibrada).
// Organiza las debilidades a trabajar en las 4 perspectivas del Excel:
// Cliente · Financiera · Competitiva · Desarrollo del Equipo.
// El mapa calibrado muestra solo las de prioridad ALTA (el foco real).
// Se llena solo: no se captura nada aquí.
// ============================================================

// Grupo de origen de cada pregunta de oportunidades (para asignar perspectiva).
const OPP_GROUP_BY_KEY = {};
OPP_GROUPS.forEach((g) =>
  g.questions.forEach((q) => {
    OPP_GROUP_BY_KEY[q.key] = g.title;
  })
);

// Asigna la perspectiva de una estrategia según su fuente y grupo, siguiendo
// la hoja "Mapa estratégico" del Excel.
export function perspectiveFor(item) {
  const [src, key] = item.id.split(":");
  if (src === "mkt") return "cliente";
  if (src === "fin") {
    // El Excel ubica el área comercial en la perspectiva competitiva.
    return key === "ventas_area_comercial" ? "competitiva" : "financiera";
  }
  // Oportunidades: por grupo de palanca.
  const group = OPP_GROUP_BY_KEY[key] || "";
  if (key === "costos_entrega") return "financiera";
  if (group.includes("financiero")) return "financiera";
  if (group.includes("humano")) return "equipo";
  if (group.includes("social") || group.includes("conocimiento") || group.includes("producto"))
    return "competitiva";
  // Captación de valor, confianza/redes y audiencia → cliente.
  return "cliente";
}

const PERSPECTIVES = [
  { key: "cliente", title: "Perspectiva Cliente", desc: "Lo que tu cliente ve, recibe y siente.", icon: Users, accent: "text-blue-500", bg: "bg-blue-500/15", border: "border-blue-500/30" },
  { key: "financiera", title: "Perspectiva Financiera", desc: "La salud y el crecimiento de tus números.", icon: Banknote, accent: "text-cyan-600 dark:text-cyan-500", bg: "bg-cyan-500/15", border: "border-cyan-500/30" },
  { key: "competitiva", title: "Perspectiva Competitiva", desc: "Tus ventajas frente al mercado: alianzas, información y producto.", icon: Rocket, accent: "text-purple-500", bg: "bg-purple-500/15", border: "border-purple-500/30" },
  { key: "equipo", title: "Desarrollo del Equipo", desc: "Tu gente: talento, compromiso y formación.", icon: HeartHandshake, accent: "text-green-600 dark:text-green-500", bg: "bg-green-500/15", border: "border-green-500/30" },
];

function PriorityDot({ priority, score }) {
  if (!priority) {
    return <span className="text-[10px] text-muted flex-shrink-0">sin calificar</span>;
  }
  const styles = {
    Alta: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
    Media: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/40",
    Baja: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-400/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-subtitle border flex-shrink-0 ${styles[priority]}`}
      title={`Puntaje: ${score}`}
    >
      {priority}
    </span>
  );
}

export function StrategicMapBase({ calibrated = false }) {
  const [items, setItems] = useState([]);
  const [unrated, setUnrated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const sections = await StrategicPlan.getAnswersForSections(plan.id, [
        ...SUMMARY_SOURCE_SECTIONS,
        RATING_SECTION,
      ]);
      const ratings = sections[RATING_SECTION] || {};
      const { weaknesses } = collectStrategies(sections);
      const scored = weaknesses.map((w) => {
        const score = scoreFor(ratings, w.id);
        return { ...w, score, priority: priorityFor(score), perspective: perspectiveFor(w) };
      });
      setUnrated(scored.filter((w) => w.score == null).length);
      setItems(calibrated ? scored.filter((w) => w.priority === "Alta") : scored);
    } catch (err) {
      console.error("Error al cargar el mapa estratégico:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, [calibrated]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-40" />
        ))}
      </div>
    );
  }

  const Icon = calibrated ? Filter : Map;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${calibrated ? "bg-orange-500/15" : "bg-purple-500/15"} rounded-2xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${calibrated ? "text-orange-500" : "text-purple-500"}`} />
          </div>
          <div>
            <h1 className="text-3xl font-title">
              {calibrated ? "Mapa estratégico calibrado" : "Mapa estratégico"}
            </h1>
            <p className="text-muted">
              {calibrated
                ? "Solo lo más importante: tus estrategias de prioridad alta."
                : "Todas tus estrategias, organizadas en 4 perspectivas."}
            </p>
          </div>
        </div>
      </div>

      {/* Aviso: se llena solo */}
      <Card className="glass">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            {calibrated
              ? "Este mapa se llena solo con las debilidades que calificaste como prioridad alta en el resumen. Es tu foco de trabajo real."
              : "Este mapa se llena solo con las debilidades que marcaste para trabajar. Las etiquetas de prioridad vienen de tus calificaciones del resumen."}
          </p>
        </CardContent>
      </Card>

      {/* Avisos de datos incompletos */}
      {calibrated && unrated > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
          <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Tienes <span className="font-subtitle">{unrated} debilidad(es) sin calificar</span>{" "}
            que no pueden aparecer aquí.{" "}
            <Link to={createPageUrl("StrategicSummary")} className="text-accent font-subtitle hover:underline">
              Califícalas en el resumen →
            </Link>
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center text-muted space-y-3">
            <p className="text-sm">
              {calibrated
                ? "Aún no hay estrategias de prioridad alta. Califica tus debilidades en el resumen para encontrar tu foco."
                : "Aún no hay debilidades marcadas. Completa las pantallas de análisis y conclusiones para que el mapa se llene."}
            </p>
            <Link
              to={createPageUrl(calibrated ? "StrategicSummary" : "MarketConclusions")}
              className="text-accent text-sm font-subtitle hover:underline"
            >
              {calibrated ? "Ir al resumen →" : "Ir a Conclusiones del mercado →"}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERSPECTIVES.map((p) => {
            const list = items.filter((w) => w.perspective === p.key);
            const PIcon = p.icon;
            return (
              <Card key={p.key} className={`glass border-2 ${p.border} h-full`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 ${p.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <PIcon className={`w-5 h-5 ${p.accent}`} />
                    </div>
                    <div>
                      <h2 className="font-subtitle leading-tight">{p.title}</h2>
                      <p className="text-xs text-muted mt-0.5">{p.desc}</p>
                    </div>
                    <span className="ml-auto text-xs text-muted font-subtitle flex-shrink-0">
                      {list.length}
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted italic">
                      {calibrated ? "Sin estrategias de prioridad alta aquí." : "Sin estrategias en esta perspectiva."}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {list.map((w) => (
                        <li
                          key={w.id}
                          className="flex items-center justify-between gap-2 p-2.5 glass rounded-lg text-sm"
                        >
                          <span className="flex-grow">{w.label}</span>
                          <PriorityDot priority={w.priority} score={w.score} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl(calibrated ? "StrategicMap" : "StrategicSummary")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {calibrated ? "Mapa estratégico" : "Resumen y priorización"}
          </Button>
        </Link>
        <Link to={createPageUrl(calibrated ? "StrategicInitiatives" : "StrategicMapCalibrated")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            {calibrated ? "Siguiente: Iniciativas estratégicas →" : "Siguiente: Mapa calibrado →"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function StrategicMap() {
  return <StrategicMapBase calibrated={false} />;
}
