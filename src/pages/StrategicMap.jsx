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
  ChevronUp,
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
// Mapa estratégico (y su versión calibrada), estilo Balanced Scorecard:
// carriles horizontales por perspectiva con las estrategias como burbujas,
// leídos de abajo hacia arriba (cada nivel impulsa al de arriba).
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

// Carriles en el orden clásico del Balanced Scorecard: lo financiero arriba
// (el resultado) y el equipo abajo (la base que lo impulsa todo).
// Colores tomados de la lámina del Excel, adaptados a nuestro tema:
// financiera dorado · cliente morado · competitiva azul · equipo verde.
export const LANES = [
  {
    key: "financiera",
    title: "Financiera",
    desc: "El resultado: la salud y el crecimiento de tus números.",
    icon: Banknote,
    label: "bg-accent/20 text-accent border-accent/40",
    bubble: "bg-accent/15 border-accent/45 hover:border-accent",
  },
  {
    key: "cliente",
    title: "Cliente",
    desc: "Lo que tu cliente ve, recibe y siente.",
    icon: Users,
    label: "bg-purple-500/20 text-purple-500 border-purple-500/40",
    bubble: "bg-purple-500/15 border-purple-500/45 hover:border-purple-500",
  },
  {
    key: "competitiva",
    title: "Competitiva",
    desc: "Tus ventajas frente al mercado: alianzas, información y producto.",
    icon: Rocket,
    label: "bg-blue-500/20 text-blue-500 border-blue-500/40",
    bubble: "bg-blue-500/15 border-blue-500/45 hover:border-blue-500",
  },
  {
    key: "equipo",
    title: "Desarrollo del Equipo",
    desc: "La base: tu gente, su talento y su compromiso.",
    icon: HeartHandshake,
    label: "bg-green-500/20 text-green-600 dark:text-green-500 border-green-500/40",
    bubble: "bg-green-500/15 border-green-500/45 hover:border-green-500",
  },
];

const PRIORITY_DOT = {
  Alta: "bg-green-500",
  Media: "bg-amber-400",
  Baja: "bg-gray-400",
};

function Bubble({ item }) {
  return (
    <div
      className={`relative glass border-2 rounded-[26px] px-4 py-3 max-w-[220px] text-center transition-all ${
        LANES.find((l) => l.key === item.perspective)?.bubble || ""
      } ${item.priority == null ? "border-dashed" : ""}`}
      title={
        item.priority
          ? `Prioridad ${item.priority.toLowerCase()} · puntaje ${item.score}`
          : "Sin calificar en el resumen"
      }
    >
      {item.priority && (
        <span
          className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--background-start)] ${PRIORITY_DOT[item.priority]}`}
        />
      )}
      <span className="text-xs leading-snug">{item.label}</span>
    </div>
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
    <div className="space-y-8 max-w-5xl mx-auto">
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
                : "Tu estrategia como un mapa: cada nivel impulsa al de arriba."}
            </p>
          </div>
        </div>
      </div>

      {/* Aviso: se llena solo + cómo leerlo */}
      <Card className="glass">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted space-y-1">
            <p>
              {calibrated
                ? "Este mapa se llena solo con tus estrategias de prioridad alta. Es tu foco de trabajo real."
                : "Este mapa se llena solo con las debilidades que marcaste para trabajar."}
            </p>
            <p>
              Se lee <span className="text-foreground font-subtitle">de abajo hacia arriba</span>:
              trabajar en tu equipo impulsa tu competitividad, eso mejora la experiencia de tu
              cliente, y el cliente impulsa tus resultados financieros. El punto de cada burbuja
              es su prioridad:{" "}
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> alta</span>{" · "}
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> media</span>{" · "}
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> baja</span>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Aviso de datos incompletos (solo calibrado) */}
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
        /* Carriles estilo Balanced Scorecard */
        <div className="space-y-1">
          {LANES.map((lane, idx) => {
            const list = items.filter((w) => w.perspective === lane.key);
            const LIcon = lane.icon;
            return (
              <React.Fragment key={lane.key}>
                <div className="glass rounded-2xl flex flex-col sm:flex-row overflow-hidden">
                  {/* Banda lateral con la perspectiva */}
                  <div
                    className={`sm:w-40 flex sm:flex-col items-center justify-center gap-2 px-4 py-3 sm:py-6 border-b sm:border-b-0 sm:border-r ${lane.label}`}
                  >
                    <LIcon className="w-5 h-5" />
                    <span className="font-subtitle text-xs uppercase tracking-wider text-center leading-tight">
                      {lane.title}
                    </span>
                    <span className="text-[10px] opacity-70">{list.length}</span>
                  </div>
                  {/* Burbujas */}
                  <div className="flex-grow p-4 sm:p-5">
                    {list.length === 0 ? (
                      <p className="text-xs text-muted italic py-2">
                        {calibrated
                          ? "Sin estrategias de prioridad alta en este nivel."
                          : "Sin estrategias en este nivel."}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-3 items-center">
                        {list.map((w) => (
                          <Bubble key={w.id} item={w} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Conector causa-efecto entre carriles */}
                {idx < LANES.length - 1 && (
                  <div className="flex items-center justify-center gap-1.5 py-0.5 text-muted">
                    <ChevronUp className="w-4 h-4 text-accent" />
                    <span className="text-[10px] uppercase tracking-wider">impulsa</span>
                  </div>
                )}
              </React.Fragment>
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
