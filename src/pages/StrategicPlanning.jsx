import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Target,
  Compass,
  Info,
  ArrowRight,
  ChevronRight,
  Building,
  Globe,
  Map,
  Users,
  CheckCircle2,
  Hammer,
  ClipboardCheck,
  Sprout,
  ListChecks,
  Banknote,
  ListOrdered,
  Filter,
  ClipboardList,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from '@/components/LanguageContext';
import { StrategicPlan, Competitor } from "@/api/entities";
import { QUESTIONS as CUSTOMER_QUESTIONS, SECTION as CUSTOMER_SECTION } from "./CustomerAnalysis";
import { ALL_OPP_KEYS, SECTION as OPP_SECTION } from "./OpportunityAnalysis";
import {
  SECTION as OPP_CONCL_SECTION,
  effectiveConclusions,
} from "./OpportunityConclusions";
import { ALL_FIN_KEYS, SECTION as FIN_SECTION } from "./FinancialStrategies";
import {
  RATING_SECTION,
  collectStrategies,
  scoreFor,
  priorityFor,
} from "./StrategicSummary";

// Inicio de la Planeación Estratégica: el recorrido completo de la
// metodología en 3 fases (las mismas del menú lateral), con el estado real
// de cada pantalla — funcional o en construcción — y tu avance.
const PHASES = [
  {
    n: 1,
    title: "Análisis",
    desc: "Primero conoce tu negocio: tu cliente, tu mercado, tus oportunidades y tus finanzas.",
    screens: [
      { key: "CustomerAnalysis", name: "Análisis del cliente", icon: Users, ready: true },
      { key: "MarketAnalysis", name: "Análisis del mercado", icon: Globe, ready: true },
      { key: "MarketConclusions", name: "Conclusiones del mercado", icon: ClipboardCheck, ready: true },
      { key: "OpportunityAnalysis", name: "Análisis de oportunidades", icon: Sprout, ready: true },
      { key: "OpportunityConclusions", name: "Conclusión de oportunidades", icon: ListChecks, ready: true },
      { key: "FinancialStrategies", name: "Estrategias financieras", icon: Banknote, ready: true },
    ],
  },
  {
    n: 2,
    title: "Estrategia",
    desc: "Prioriza lo que vas a trabajar y organízalo en un mapa completo del negocio.",
    screens: [
      { key: "StrategicSummary", name: "Resumen y priorización", icon: ListOrdered, ready: true },
      { key: "StrategicMap", name: "Mapa estratégico", icon: Map, ready: true },
      { key: "StrategicMapCalibrated", name: "Mapa calibrado", icon: Filter, ready: true },
    ],
  },
  {
    n: 3,
    title: "Plan de acción",
    desc: "Convierte la estrategia en acciones concretas: quién, cuándo y con qué presupuesto.",
    screens: [
      { key: "StrategicInitiatives", name: "Iniciativas estratégicas", icon: ClipboardList },
      { key: "ScoreCard", name: "Score Card ejecutivo", icon: Trophy },
    ],
  },
];

export default function StrategicPlanning() {
  const { t } = useLanguage();

  // Avance real de las pantallas funcionales.
  const [customerProgress, setCustomerProgress] = useState(null);
  const [competitorCount, setCompetitorCount] = useState(null);
  const [conclusionCounts, setConclusionCounts] = useState(null);
  const [oppProgress, setOppProgress] = useState(null);
  const [oppConclCounts, setOppConclCounts] = useState(null);
  const [finCount, setFinCount] = useState(null);
  const [summaryMeta, setSummaryMeta] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const plan = await StrategicPlan.getOrCreate();
        const [sections, comps] = await Promise.all([
          StrategicPlan.getAnswersForSections(plan.id, [
            CUSTOMER_SECTION,
            "market-conclusions",
            OPP_SECTION,
            OPP_CONCL_SECTION,
            FIN_SECTION,
            RATING_SECTION,
          ]),
          Competitor.list(plan.id),
        ]);
        const answers = sections[CUSTOMER_SECTION] || {};
        const answered = CUSTOMER_QUESTIONS.filter(
          (q) => (answers[q.key] || "").trim()
        ).length;
        const conclusions = sections["market-conclusions"] || {};
        const values = Object.values(conclusions);
        const opp = sections[OPP_SECTION] || {};
        const oppAnswered = ALL_OPP_KEYS.filter((k) => (opp[k] || "").trim()).length;
        const oppEffective = effectiveConclusions(opp, sections[OPP_CONCL_SECTION] || {});
        const oppEffValues = Object.values(oppEffective);
        if (active) {
          setCustomerProgress({ answered, total: CUSTOMER_QUESTIONS.length });
          setCompetitorCount(comps.length);
          setConclusionCounts({
            f: values.filter((v) => v === "F").length,
            d: values.filter((v) => v === "D").length,
          });
          setOppProgress({ answered: oppAnswered, total: ALL_OPP_KEYS.length });
          setOppConclCounts({
            f: oppEffValues.filter((v) => v === "F").length,
            d: oppEffValues.filter((v) => v === "D").length,
          });
          const fin = sections[FIN_SECTION] || {};
          setFinCount(ALL_FIN_KEYS.filter((k) => fin[k] === "D").length);
          const { weaknesses } = collectStrategies(sections);
          const summaryRatings = sections[RATING_SECTION] || {};
          const scoredList = weaknesses.map((w) => scoreFor(summaryRatings, w.id));
          setSummaryMeta({
            total: weaknesses.length,
            rated: scoredList.filter((s) => s != null).length,
            alta: scoredList.filter((s) => priorityFor(s) === "Alta").length,
          });
        }
      } catch (_) {
        // Sin datos aún (o error de carga): las tarjetas siguen usables.
        if (active) {
          setCustomerProgress(null);
          setCompetitorCount(null);
          setConclusionCounts(null);
          setOppProgress(null);
          setOppConclCounts(null);
          setFinCount(null);
          setSummaryMeta(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // A dónde lleva el botón "Continuar": la primera pantalla funcional
  // incompleta del recorrido.
  const continueTarget =
    customerProgress && customerProgress.answered < customerProgress.total
      ? { key: "CustomerAnalysis", name: "Análisis del cliente" }
      : { key: "MarketAnalysis", name: "Análisis del mercado" };

  // Datos extra por pantalla (avance real).
  const screenMeta = (key) => {
    if (key === "CustomerAnalysis" && customerProgress) {
      return `${customerProgress.answered} de ${customerProgress.total} preguntas`;
    }
    if (key === "MarketAnalysis" && competitorCount !== null) {
      return competitorCount === 1
        ? "1 competidor registrado"
        : `${competitorCount} competidores registrados`;
    }
    if (key === "MarketConclusions" && conclusionCounts && (conclusionCounts.f > 0 || conclusionCounts.d > 0)) {
      return `${conclusionCounts.f} a mantener · ${conclusionCounts.d} a cambiar`;
    }
    if (key === "OpportunityAnalysis" && oppProgress) {
      return `${oppProgress.answered} de ${oppProgress.total} preguntas`;
    }
    if (key === "OpportunityConclusions" && oppConclCounts && (oppConclCounts.f > 0 || oppConclCounts.d > 0)) {
      return `${oppConclCounts.f} fortalezas · ${oppConclCounts.d} debilidades`;
    }
    if (key === "FinancialStrategies" && finCount !== null && finCount > 0) {
      return `${finCount} debilidades a gestionar`;
    }
    if (key === "StrategicSummary" && summaryMeta && summaryMeta.total > 0) {
      return summaryMeta.alta > 0
        ? `${summaryMeta.rated} de ${summaryMeta.total} calificadas · ${summaryMeta.alta} de prioridad alta`
        : `${summaryMeta.rated} de ${summaryMeta.total} calificadas`;
    }
    if (key === "StrategicMap" && summaryMeta && summaryMeta.total > 0) {
      return `${summaryMeta.total} estrategias en 4 perspectivas`;
    }
    if (key === "StrategicMapCalibrated" && summaryMeta && summaryMeta.alta > 0) {
      return `${summaryMeta.alta} de prioridad alta`;
    }
    return null;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Compass className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-title mb-1">Planeación Estratégica</h1>
              <p className="text-lg text-muted">
                Entiende tu negocio y decide hacia dónde llevarlo, paso a paso.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
              <Building className="w-4 h-4 text-accent" />
              <span className="font-subtitle text-sm">Tenryu Corp.</span>
            </div>
            <Link to={createPageUrl(continueTarget.key)}>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-subtitle text-sm">
                {customerProgress?.answered > 0 ? "Continuar" : "Empezar"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ¿Qué es esto? */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-subtitle text-lg mb-1">¿Qué es la planeación estratégica?</h2>
              <p className="text-sm text-muted leading-relaxed">
                Es tomarte un momento para ver tu negocio con calma y decidir hacia dónde
                quieres llevarlo. No necesitas ser experto: recorre las 3 fases en orden
                y responde con tus propias palabras. Cada fase alimenta a la siguiente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso: qué es real y qué está en construcción */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Las pantallas con <span className="font-subtitle">"Ya funciona"</span> guardan de
          verdad lo que escribes. Las marcadas <span className="font-subtitle">"En construcción"</span>{" "}
          te muestran una vista previa de lo que harán.
        </p>
      </div>

      {/* Recorrido por fases */}
      <div className="space-y-6">
        {PHASES.map((phase) => (
          <Card key={phase.n} className="glass">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-title text-xl flex-shrink-0">
                  {phase.n}
                </div>
                <div>
                  <h2 className="font-title text-xl leading-tight">{phase.title}</h2>
                  <p className="text-sm text-muted mt-0.5">{phase.desc}</p>
                </div>
              </div>

              <div className="space-y-2">
                {phase.screens.map((screen) => {
                  const meta = screenMeta(screen.key);
                  const Icon = screen.icon;
                  return (
                    <Link
                      key={screen.key}
                      to={createPageUrl(screen.key)}
                      className="flex items-center gap-3 p-3 glass rounded-xl hover:border-accent transition-all group"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${screen.ready ? "bg-green-500/15" : "bg-amber-400/10"}`}>
                        <Icon className={`w-5 h-5 ${screen.ready ? "text-green-600 dark:text-green-500" : "text-amber-500"}`} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <span className="font-subtitle text-sm block truncate">{screen.name}</span>
                        {meta && <span className="text-xs text-muted">{meta}</span>}
                      </div>
                      {screen.ready ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-subtitle border border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-500 flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Ya funciona
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-subtitle border border-amber-400/40 bg-amber-400/10 text-amber-500 flex-shrink-0">
                          <Hammer className="w-3 h-3" /> En construcción
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
