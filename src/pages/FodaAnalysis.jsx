import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan, Competitor } from "@/api/entities";
import {
  ArrowLeft,
  Grid2x2,
  Sparkles,
  Award,
  Wrench,
  Sprout,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATALOG as MKT_CATALOG, SECTION as MKT_CONCL_SECTION } from "./MarketConclusions";
import { OPP_GROUPS, SECTION as OPP_SECTION } from "./OpportunityAnalysis";
import { SECTION as OPP_CONCL_SECTION, effectiveConclusions } from "./OpportunityConclusions";
import {
  RATING_SECTION,
  SUMMARY_SOURCE_SECTIONS,
  collectStrategies,
  scoreFor,
  priorityFor,
} from "./StrategicSummary";

// ============================================================
// FODA automático: se genera 100% de lo ya capturado en el módulo.
// - Fortalezas: lo marcado "voy a mantener" (mercado + oportunidades).
// - Debilidades: lo marcado "voy a cambiar" en las 3 fuentes (+ prioridad).
// - Oportunidades: las respuestas Blue Ocean (crear / incrementar).
// - Amenazas: señales calculadas de tus competidores.
// ============================================================

export const MARKET_SECTION = "market";
const compSection = (id) => `market-comp:${id}`;

// Divide una respuesta de texto libre en puntos (por línea o punto y coma).
const splitPoints = (text) =>
  (text || "")
    .split(/\n|;/)
    .map((s) => s.replace(/^[-•\d.\s]+/, "").trim())
    .filter(Boolean);

// Construye los 4 cuadrantes a partir de las secciones ya cargadas.
export function buildFoda({ sections, competitors, ratings }) {
  // Fortalezas y debilidades (con prioridad) desde las conclusiones.
  const strengths = [];
  const mkt = sections[MKT_CONCL_SECTION] || {};
  MKT_CATALOG.forEach((g) =>
    g.items.forEach((i) => {
      if (mkt[i.key] === "F") strengths.push({ label: i.label });
    })
  );
  const oppEff = effectiveConclusions(sections[OPP_SECTION] || {}, sections[OPP_CONCL_SECTION] || {});
  OPP_GROUPS.forEach((g) =>
    g.questions.forEach((q) => {
      if (oppEff[q.key] === "F") strengths.push({ label: q.strategy });
    })
  );

  const { weaknesses } = collectStrategies(sections);
  const debilidades = weaknesses.map((w) => {
    const score = scoreFor(ratings || {}, w.id);
    return { ...w, score, priority: priorityFor(score) };
  });

  // Oportunidades externas: Blue Ocean (crear e incrementar).
  const market = sections[MARKET_SECTION] || {};
  const oportunidades = [
    ...splitPoints(market.bo_crear).map((label) => ({ label, kind: "Crear" })),
    ...splitPoints(market.bo_incrementar).map((label) => ({ label, kind: "Incrementar" })),
  ];

  // Amenazas: señales de la comparación con competidores.
  const amenazas = [];
  (competitors || []).forEach((c) => {
    const a = sections[compSection(c.id)] || {};
    const add = (label) => amenazas.push({ label });
    if (a.precio === "Menor") add(`${c.name} tiene precios menores que los tuyos`);
    if (a.servicio === "Mejor") add(`${c.name} ofrece mejor servicio que el tuyo`);
    if (a.postventa_mejor === "Sí") add(`${c.name} tiene mejor servicio post-venta`);
    if (a.entrega_simple === "Sí") add(`${c.name} entrega de forma más simple`);
    if (a.entrega_comoda === "Sí") add(`${c.name} ofrece una entrega más cómoda`);
    if (a.imagen === "Sí") add(`${c.name} tiene mejor imagen de marca`);
    if (a.mercado === "Más") add(`${c.name} tiene más mercado que tú`);
    if (a.redes === "Sí" || a.publicidad === "Sí")
      add(`${c.name} está activo en redes sociales o publicidad`);
  });

  return { fortalezas: strengths, debilidades, oportunidades, amenazas };
}

const PRIORITY_CHIP = {
  Alta: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
  Media: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/40",
  Baja: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-400/30",
};

export default function FodaAnalysis() {
  const [foda, setFoda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const comps = await Competitor.list(plan.id);
      const sections = await StrategicPlan.getAnswersForSections(plan.id, [
        ...SUMMARY_SOURCE_SECTIONS,
        RATING_SECTION,
        MARKET_SECTION,
        ...comps.map((c) => compSection(c.id)),
      ]);
      setFoda(
        buildFoda({
          sections,
          competitors: comps,
          ratings: sections[RATING_SECTION] || {},
        })
      );
    } catch (err) {
      console.error("Error al cargar el FODA:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !foda) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse h-48" />
          ))}
        </div>
      </div>
    );
  }

  const quadrants = [
    {
      key: "fortalezas",
      title: "Fortalezas",
      friendly: "En qué somos buenos",
      icon: Award,
      accent: "text-green-600 dark:text-green-500",
      bg: "bg-green-500/15",
      border: "border-green-500/40",
      items: foda.fortalezas,
      empty: "Marca fortalezas ('voy a mantener') en las conclusiones.",
      editHref: "MarketConclusions",
      editLabel: "Editar en Conclusiones",
    },
    {
      key: "oportunidades",
      title: "Oportunidades",
      friendly: "Lo que el mercado no aprovecha",
      icon: Sprout,
      accent: "text-blue-600 dark:text-blue-500",
      bg: "bg-blue-500/15",
      border: "border-blue-500/40",
      items: foda.oportunidades,
      empty: "Responde las preguntas de 'Oportunidades del mercado' (crear e incrementar) en el análisis del mercado.",
      editHref: "MarketAnalysis",
      editLabel: "Editar en Análisis del mercado",
    },
    {
      key: "debilidades",
      title: "Debilidades",
      friendly: "Qué vamos a cambiar",
      icon: Wrench,
      accent: "text-orange-600 dark:text-orange-500",
      bg: "bg-orange-500/15",
      border: "border-orange-500/40",
      items: foda.debilidades,
      empty: "Marca debilidades ('voy a cambiar') en las conclusiones.",
      editHref: "StrategicSummary",
      editLabel: "Priorizar en el Resumen",
    },
    {
      key: "amenazas",
      title: "Amenazas",
      friendly: "Señales de tus competidores",
      icon: ShieldAlert,
      accent: "text-red-600 dark:text-red-500",
      bg: "bg-red-500/15",
      border: "border-red-500/40",
      items: foda.amenazas,
      empty: "Registra competidores y responde su comparación en el análisis del mercado.",
      editHref: "MarketAnalysis",
      editLabel: "Editar competidores",
    },
  ];

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
          <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Grid2x2 className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-title">FODA</h1>
            <p className="text-muted">Fortalezas, Oportunidades, Debilidades y Amenazas — en una sola vista.</p>
          </div>
        </div>
      </div>

      {/* Se llena solo */}
      <Card className="glass">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            Este FODA se genera automáticamente con lo que ya capturaste: tus conclusiones,
            tus respuestas Blue Ocean y la comparación con tus competidores. Si cambias algo
            en esas pantallas, aquí se actualiza solo.
          </p>
        </CardContent>
      </Card>

      {/* Matriz 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quadrants.map((q) => (
          <Card key={q.key} className={`glass border-2 ${q.border}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-11 h-11 ${q.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <q.icon className={`w-5 h-5 ${q.accent}`} />
                </div>
                <div className="flex-grow">
                  <h2 className="font-subtitle leading-tight">{q.title}</h2>
                  <p className="text-xs text-muted mt-0.5">{q.friendly}</p>
                </div>
                <span className={`text-lg font-title flex-shrink-0 ${q.accent}`}>
                  {q.items.length}
                </span>
              </div>

              {q.items.length === 0 ? (
                <p className="text-xs text-muted italic mb-3">{q.empty}</p>
              ) : (
                <ul className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
                  {q.items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 p-2.5 glass rounded-lg text-sm">
                      <span className="flex-grow">{item.label}</span>
                      {item.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-subtitle border flex-shrink-0 ${PRIORITY_CHIP[item.priority]}`}>
                          {item.priority}
                        </span>
                      )}
                      {item.kind && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                          {item.kind}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <Link
                to={createPageUrl(q.editHref)}
                className="inline-flex items-center gap-1.5 text-xs text-accent font-subtitle hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> {q.editLabel}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinancialStrategies")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Estrategias financieras
          </Button>
        </Link>
        <Link to={createPageUrl("StrategicSummary")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Resumen y priorización →
          </Button>
        </Link>
      </div>
    </div>
  );
}
