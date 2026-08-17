import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  ArrowRight,
  Hammer,
  FlaskConical,
  ClipboardCheck,
  Sprout,
  ListChecks,
  Banknote,
  ListOrdered,
  Map,
  Filter,
  ClipboardList,
  Trophy,
  Workflow,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Vistas previas de las hojas de la metodología que aún no se desarrollan.
// Una sola página atiende todas las secciones: se resuelve por la URL.
// Cada entrada explica, en lenguaje simple, qué hará esa pantalla y de dónde
// vendrá su información, siguiendo el Excel de planeación estratégica.
const SECTIONS = {
  MarketConclusions: {
    title: "Conclusiones del mercado",
    icon: ClipboardCheck,
    accent: "text-blue-500",
    bg: "bg-blue-500/15",
    desc: "Con lo que respondiste en el análisis del mercado, aquí elegirás qué fortalezas vas a mantener y qué debilidades vas a trabajar.",
    bullets: [
      "Lista de aspectos del mercado (precio, servicio, post-venta, entrega, imagen, audiencia).",
      "Para cada aspecto marcarás: 'Voy a mantener' (fortaleza) o 'Voy a cambiar' (debilidad).",
      "Lo que marques aquí alimentará automáticamente el resumen y el mapa estratégico.",
    ],
    source: "Se alimenta de tus respuestas del Análisis del mercado.",
  },
  OpportunityAnalysis: {
    title: "Análisis de oportunidades",
    icon: Sprout,
    accent: "text-green-600 dark:text-green-500",
    bg: "bg-green-500/15",
    desc: "Un cuestionario de Sí/No sobre tus 'palancas' de crecimiento: dinero, relaciones, conocimiento, equipo y producto.",
    bullets: [
      "Captación de valor: precios, percepción, costos, productos complementarios.",
      "Confianza y audiencia: contenido, publicidad, estrategias de atracción.",
      "Palancas: capital financiero, social, de conocimiento y humano.",
      "Tu producto o servicio: calidad y ciclo comercial.",
    ],
    source: "Cada 'Sí' se volverá una fortaleza y cada 'No' una debilidad, automáticamente.",
  },
  OpportunityConclusions: {
    title: "Conclusión de oportunidades",
    icon: ListChecks,
    accent: "text-emerald-600 dark:text-emerald-500",
    bg: "bg-emerald-500/15",
    desc: "El sistema convertirá tus respuestas del análisis de oportunidades en fortalezas y debilidades, y aquí decidirás cuáles trabajar.",
    bullets: [
      "Fortalezas ('voy a mantener') y debilidades ('voy a cambiar') calculadas solas.",
      "Podrás ajustar la selección antes de pasar al resumen.",
    ],
    source: "Se llena automáticamente con la regla: Sí → fortaleza · No → debilidad.",
  },
  FinancialStrategies: {
    title: "Estrategias financieras",
    icon: Banknote,
    accent: "text-cyan-600 dark:text-cyan-500",
    bg: "bg-cyan-500/15",
    desc: "Recorrerás tu estado de resultados línea por línea para elegir qué debilidades financieras vas a gestionar.",
    bullets: [
      "Ventas e ingresos: volumen, nuevas aperturas, área comercial.",
      "Costo de ventas: proveedores, mermas, rotación de inventarios.",
      "Gastos operativos, financiamiento e impuestos.",
      "Fondos de reserva para reinversión y crecimiento.",
    ],
    source: "Lo que marques aquí también entra al resumen y a la priorización.",
  },
  StrategicSummary: {
    title: "Resumen y priorización",
    icon: ListOrdered,
    accent: "text-accent",
    bg: "bg-accent/15",
    desc: "Todas tus estrategias juntas, calificadas para saber por dónde empezar. El sistema calculará la prioridad por ti.",
    bullets: [
      "Consolida las debilidades del mercado, oportunidades y finanzas.",
      "Calificarás costo, riesgo, complejidad y beneficio de cada estrategia.",
      "Fórmula de priorización: (Costo×0.2 + Riesgo×0.5 + Complejidad×0.15 + Beneficio×0.15).",
      "Resultado: prioridad Alta, Media o Baja para cada estrategia.",
    ],
    source: "Se alimenta de las tres pantallas de conclusiones.",
  },
  StrategicMap: {
    title: "Mapa estratégico",
    icon: Map,
    accent: "text-purple-500",
    bg: "bg-purple-500/15",
    desc: "Tus estrategias organizadas en 4 perspectivas para verlas como un mapa completo del negocio.",
    bullets: [
      "Perspectiva Cliente · Perspectiva Financiera · Perspectiva Competitiva · Desarrollo del Equipo.",
      "Se llena automáticamente con las debilidades que decidiste trabajar.",
    ],
    source: "Se alimenta del resumen consolidado.",
  },
  StrategicMapCalibrated: {
    title: "Mapa estratégico calibrado",
    icon: Filter,
    accent: "text-orange-500",
    bg: "bg-orange-500/15",
    desc: "El mismo mapa, pero mostrando solo lo más importante: las estrategias con prioridad alta.",
    bullets: [
      "Filtra automáticamente por la prioridad calculada en el resumen.",
      "Es tu foco real de trabajo para el año.",
    ],
    source: "Se alimenta del mapa estratégico + la priorización.",
  },
  StrategicInitiatives: {
    title: "Iniciativas estratégicas",
    icon: ClipboardList,
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/15",
    desc: "Aquí la estrategia se convierte en plan de acción: quién hace qué, para cuándo y con qué presupuesto.",
    bullets: [
      "Visión, misión y valores de tu empresa.",
      "Por cada objetivo: iniciativas, planes de trabajo, responsable, fechas, KPI y presupuesto.",
      "Un objetivo puede tener varias iniciativas, y cada iniciativa varios planes.",
    ],
    source: "Parte de las estrategias de prioridad alta del mapa calibrado.",
  },
  ScoreCard: {
    title: "Score Card ejecutivo",
    icon: Trophy,
    accent: "text-accent",
    bg: "bg-accent/15",
    desc: "El resumen ejecutivo de todo tu plan: una sola vista para dar seguimiento y presentar a dirección.",
    bullets: [
      "Misión, visión y valores en la cabecera.",
      "Por perspectiva: objetivo, resultado esperado, iniciativa, área responsable.",
      "Suma automática de tiempos comprometidos y presupuesto necesario.",
      "Se podrá exportar a Excel / PDF.",
    ],
    source: "Se alimenta de las iniciativas estratégicas.",
  },
};

// Orden del recorrido completo (reales + vistas previas) para los botones
// de anterior/siguiente.
const FLOW = [
  { key: "CustomerAnalysis", title: "Análisis del cliente" },
  { key: "MarketAnalysis", title: "Análisis del mercado" },
  { key: "MarketConclusions", title: "Conclusiones del mercado" },
  { key: "OpportunityAnalysis", title: "Análisis de oportunidades" },
  { key: "OpportunityConclusions", title: "Conclusión de oportunidades" },
  { key: "FinancialStrategies", title: "Estrategias financieras" },
  { key: "StrategicSummary", title: "Resumen y priorización" },
  { key: "StrategicMap", title: "Mapa estratégico" },
  { key: "StrategicMapCalibrated", title: "Mapa calibrado" },
  { key: "StrategicInitiatives", title: "Iniciativas estratégicas" },
  { key: "ScoreCard", title: "Score Card" },
];

export default function StrategicSectionPreview() {
  const location = useLocation();
  const pageKey =
    Object.keys(SECTIONS).find(
      (k) => k.toLowerCase() === location.pathname.replace(/\//g, "").toLowerCase()
    ) || "MarketConclusions";
  const section = SECTIONS[pageKey];
  const Icon = section.icon;

  const idx = FLOW.findIndex((f) => f.key === pageKey);
  const prev = idx > 0 ? FLOW[idx - 1] : null;
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${section.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${section.accent}`} />
          </div>
          <div>
            <h1 className="text-3xl font-title">{section.title}</h1>
            <p className="text-muted">{section.desc}</p>
          </div>
        </div>
      </div>

      {/* Aviso en construcción */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
        <Hammer className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          <span className="font-subtitle">Sección en construcción.</span>{" "}
          Aquí te mostramos qué hará esta pantalla cuando esté lista. El orden del menú
          sigue la metodología completa.
        </p>
      </div>

      {/* Qué incluirá */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-amber-500" />
            <h2 className="font-subtitle text-lg">¿Qué encontrarás aquí?</h2>
          </div>
          <ul className="space-y-3">
            {section.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-subtitle flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted">{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* De dónde vienen los datos */}
      <Card className="glass">
        <CardContent className="p-5 flex items-start gap-3">
          <Workflow className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted">{section.source}</p>
        </CardContent>
      </Card>

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        {prev ? (
          <Link to={createPageUrl(prev.key)}>
            <Button variant="outline" className="glass hover:border-accent font-subtitle">
              <ArrowLeft className="w-4 h-4 mr-2" /> {prev.title}
            </Button>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={createPageUrl(next.key)}>
            <Button variant="outline" className="glass hover:border-accent font-subtitle">
              {next.title} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
