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
      { key: "MarketConclusions", name: "Conclusiones del mercado", icon: ClipboardCheck },
      { key: "OpportunityAnalysis", name: "Análisis de oportunidades", icon: Sprout },
      { key: "OpportunityConclusions", name: "Conclusión de oportunidades", icon: ListChecks },
      { key: "FinancialStrategies", name: "Estrategias financieras", icon: Banknote },
    ],
  },
  {
    n: 2,
    title: "Estrategia",
    desc: "Prioriza lo que vas a trabajar y organízalo en un mapa completo del negocio.",
    screens: [
      { key: "StrategicSummary", name: "Resumen y priorización", icon: ListOrdered },
      { key: "StrategicMap", name: "Mapa estratégico", icon: Map },
      { key: "StrategicMapCalibrated", name: "Mapa calibrado", icon: Filter },
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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const plan = await StrategicPlan.getOrCreate();
        const [answers, comps] = await Promise.all([
          StrategicPlan.getAnswers(plan.id, CUSTOMER_SECTION),
          Competitor.list(plan.id),
        ]);
        const answered = CUSTOMER_QUESTIONS.filter(
          (q) => (answers[q.key] || "").trim()
        ).length;
        if (active) {
          setCustomerProgress({ answered, total: CUSTOMER_QUESTIONS.length });
          setCompetitorCount(comps.length);
        }
      } catch (_) {
        // Sin datos aún (o error de carga): las tarjetas siguen usables.
        if (active) {
          setCustomerProgress(null);
          setCompetitorCount(null);
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
