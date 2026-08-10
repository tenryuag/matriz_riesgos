import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Target,
  Compass,
  Info,
  ArrowRight,
  Building,
  Globe,
  Map,
  Users,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from '@/components/LanguageContext';
import { StrategicPlan } from "@/api/entities";
import { QUESTIONS as CUSTOMER_QUESTIONS, SECTION as CUSTOMER_SECTION } from "./CustomerAnalysis";

// Pantalla de inicio de la Planeación Estratégica.
// Pensada para personas que NO conocen el tema: un recorrido guiado por pasos,
// en lenguaje simple. Cada tarjeta indica claramente si esa sección ya guarda
// información real ("Ya funciona") o si es una demostración con datos de
// ejemplo mientras se construye.
export default function StrategicPlanning() {
  const { t } = useLanguage();

  // Progreso real del análisis del cliente (la única sección funcional hoy).
  const [customerProgress, setCustomerProgress] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const plan = await StrategicPlan.getOrCreate();
        const answers = await StrategicPlan.getAnswers(plan.id, CUSTOMER_SECTION);
        const answered = CUSTOMER_QUESTIONS.filter(
          (q) => (answers[q.key] || "").trim()
        ).length;
        if (active) setCustomerProgress({ answered, total: CUSTOMER_QUESTIONS.length });
      } catch (_) {
        // Si las tablas aún no existen o falla la consulta, no mostramos el
        // progreso; la tarjeta sigue siendo usable.
        if (active) setCustomerProgress(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const steps = [
    {
      n: 1,
      icon: Users,
      title: "Conoce a tu cliente",
      description:
        "Responde preguntas sencillas sobre tus clientes: qué les duele, qué desean y qué esperan de ti.",
      href: createPageUrl("CustomerAnalysis"),
      cta: "Empezar aquí",
      accent: "text-blue-500",
      bg: "bg-blue-500/15",
      border: "hover:border-blue-500/50",
      ready: true,
      progress: customerProgress,
    },
    {
      n: 2,
      icon: Globe,
      title: "Analiza tu mercado",
      description:
        "Compara tu negocio con tus principales competidores y detecta oportunidades que nadie aprovecha.",
      href: createPageUrl("MarketAnalysis"),
      cta: "Empezar aquí",
      accent: "text-purple-500",
      bg: "bg-purple-500/15",
      border: "hover:border-purple-500/50",
      ready: true,
    },
    {
      n: 3,
      icon: Map,
      title: "Define tu estrategia",
      description:
        "Descubre en qué eres bueno, qué puedes mejorar, y arma un plan de acción con responsables y fechas.",
      href: createPageUrl("SwotAnalysis"),
      cta: "Ver demostración",
      accent: "text-orange-500",
      bg: "bg-orange-500/15",
      border: "hover:border-orange-500/50",
      ready: false,
    },
  ];

  return (
    <div className="space-y-8">
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
          <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
            <Building className="w-4 h-4 text-accent" />
            <span className="font-subtitle text-sm">Tenryu Corp.</span>
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
                quieres llevarlo. No necesitas ser experto: sigue los pasos de abajo en
                orden y responde con tus propias palabras.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso: qué es real y qué es demostración */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Los pasos con la etiqueta <span className="font-subtitle">"Ya funciona"</span> guardan
          de verdad lo que escribes. Los marcados como{" "}
          <span className="font-subtitle">"Demostración"</span> todavía muestran datos de
          ejemplo mientras los construimos.
        </p>
      </div>

      {/* Recorrido guiado por pasos */}
      <div>
        <h2 className="text-xl font-title mb-4">¿Por dónde empiezo?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <Link key={step.n} to={step.href}>
              <Card className={`glass glass-hover cursor-pointer h-full border-2 border-transparent transition-all ${step.border}`}>
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-title text-lg flex-shrink-0">
                        {step.n}
                      </div>
                      <span className="text-xs uppercase tracking-wider text-muted font-subtitle">
                        Paso {step.n}
                      </span>
                    </div>
                    {step.ready ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-subtitle border border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-500 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Ya funciona
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-subtitle border border-amber-400/40 bg-amber-400/10 text-amber-500 flex-shrink-0">
                        <FlaskConical className="w-3 h-3" /> Demostración
                      </span>
                    )}
                  </div>
                  <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <step.icon className={`w-6 h-6 ${step.accent}`} />
                  </div>
                  <h3 className="font-subtitle text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted mb-4 flex-grow">{step.description}</p>

                  {/* Progreso real (solo en pasos funcionales con datos) */}
                  {step.progress && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                        <span>
                          {step.progress.answered} de {step.progress.total} preguntas
                        </span>
                        <span>
                          {Math.round((step.progress.answered / step.progress.total) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 glass rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{
                            width: `${(step.progress.answered / step.progress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center text-accent text-sm font-subtitle">
                    {step.progress?.answered > 0 ? "Continuar" : step.cta}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
