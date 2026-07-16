import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Target,
  Compass,
  Lightbulb,
  Info,
  ArrowRight,
  Building,
  Search,
  Map,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from '@/components/LanguageContext';

// Pantalla de bienvenida a la Planeación Estratégica.
// Pensada para personas que NO conocen el tema: lenguaje simple, un recorrido
// guiado por pasos y una explicación de qué es y para qué sirve.
// Los datos son de ejemplo (mockup navegable).
export default function StrategicPlanning() {
  const { t } = useLanguage();

  const steps = [
    {
      n: 1,
      icon: Search,
      title: "Entiende tu negocio",
      description:
        "Compara tu empresa con la competencia, revisa cómo estás por dentro y qué necesitan tus clientes.",
      href: createPageUrl("BusinessAnalysis"),
      cta: "Empezar aquí",
      accent: "text-blue-500",
      bg: "bg-blue-500/15",
      border: "hover:border-blue-500/50",
    },
    {
      n: 2,
      icon: Map,
      title: "Define tu estrategia",
      description:
        "Descubre en qué eres bueno, qué puedes mejorar, y arma un plan de acción con responsables y fechas.",
      href: createPageUrl("SwotAnalysis"),
      cta: "Ver estrategia",
      accent: "text-purple-500",
      bg: "bg-purple-500/15",
      border: "hover:border-purple-500/50",
    },
  ];

  const glance = [
    { icon: Lightbulb, label: "Ideas de estrategia", value: "6" },
    { icon: CheckCircle2, label: "Tareas listas", value: "1" },
    { icon: Clock, label: "Tareas en progreso", value: "2" },
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

      {/* Aviso de datos de ejemplo */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          <span className="font-subtitle">Datos de ejemplo.</span>{" "}
          Lo que ves aquí es una demostración para mostrar cómo funciona la sección.
          Más adelante podrás capturar la información real de tu empresa.
        </p>
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
                quieres llevarlo. No necesitas ser experto: esta sección te guía con preguntas
                sencillas para descubrir tus fortalezas, lo que puedes mejorar, y qué pasos
                dar para crecer. Solo sigue los dos pasos de abajo, en orden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recorrido guiado por pasos */}
      <div>
        <h2 className="text-xl font-title mb-4">¿Por dónde empiezo?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <Link key={step.n} to={step.href}>
              <Card className={`glass glass-hover cursor-pointer h-full border-2 border-transparent transition-all ${step.border}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-title text-lg flex-shrink-0">
                      {step.n}
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted font-subtitle">
                      Paso {step.n}
                    </span>
                  </div>
                  <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <step.icon className={`w-6 h-6 ${step.accent}`} />
                  </div>
                  <h3 className="font-subtitle text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted mb-5">{step.description}</p>
                  <div className="flex items-center text-accent text-sm font-subtitle">
                    {step.cta} <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Resumen rápido */}
      <div>
        <h2 className="text-xl font-title mb-4">Un vistazo rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {glance.map((g, i) => (
            <Card key={i} className="glass">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <g.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <div className="text-2xl font-title leading-none">{g.value}</div>
                  <p className="text-sm text-muted mt-1">{g.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
