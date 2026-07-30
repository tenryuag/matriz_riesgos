import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Grid2x2,
  Lightbulb,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Info,
  Award,
  Sprout,
  Wrench,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

const FAKE_SWOT = {
  strengths: [
    "Precio competitivo en el mercado",
    "Servicio post-venta reconocido",
    "Equipo de ventas experimentado",
    "Marca con 10 años de presencia"
  ],
  opportunities: [
    "Mercado digital en expansión",
    "Nueva regulación favorable al sector",
    "Alianza estratégica con distribuidores",
    "Demanda creciente del 15% anual"
  ],
  weaknesses: [
    "Procesos manuales sin documentar",
    "Poca presencia en redes sociales",
    "Rotación de personal operativo",
    "Sin plan de capacitación formal"
  ],
  threats: [
    "Entrada de competidores internacionales",
    "Inflación en costos de materia prima",
    "Cambios regulatorios pendientes",
    "Volatilidad del tipo de cambio"
  ]
};

// Cada idea de estrategia sale de "cruzar" dos áreas del FODA. En vez de los
// códigos técnicos (FO/FA/DO/DA), mostramos el significado en palabras simples.
const STRATEGY_TYPES = {
  FO: { pair: "Fortaleza + Oportunidad", help: "Usa lo que haces bien para aprovechar una oportunidad.", cls: "bg-green-500/20 text-green-600 dark:text-green-500" },
  FA: { pair: "Fortaleza + Riesgo", help: "Usa tus fortalezas para protegerte de un riesgo.", cls: "bg-orange-500/20 text-orange-600 dark:text-orange-500" },
  DO: { pair: "Mejora + Oportunidad", help: "Corrige algo interno para no perder una oportunidad.", cls: "bg-blue-500/20 text-blue-600 dark:text-blue-500" },
  DA: { pair: "Mejora + Riesgo", help: "Reduce una debilidad para defenderte de un riesgo.", cls: "bg-red-500/20 text-red-600 dark:text-red-500" },
};

const FAKE_STRATEGIES = [
  { type: "FO", strategy: "Aprovechar el equipo de ventas para capturar el crecimiento digital del 15%", priority: "Alta" },
  { type: "FA", strategy: "Usar la marca consolidada como barrera contra competidores internacionales", priority: "Alta" },
  { type: "DO", strategy: "Digitalizar procesos internos aprovechando alianzas con proveedores tecnológicos", priority: "Media" },
  { type: "DA", strategy: "Implementar plan de capacitación para reducir vulnerabilidad ante cambios regulatorios", priority: "Media" },
  { type: "FO", strategy: "Expandir servicio post-venta como diferenciador en nuevos canales digitales", priority: "Alta" },
  { type: "DO", strategy: "Crear presencia en redes sociales para capturar la demanda creciente", priority: "Baja" },
];

const FAKE_TIMELINE = [
  { task: "Auditoría de procesos internos", responsible: "Dir. Operaciones", start: "2026-01-15", end: "2026-02-28", status: "completed" },
  { task: "Diseño de estrategia digital", responsible: "Dir. Marketing", start: "2026-02-01", end: "2026-03-31", status: "in-progress" },
  { task: "Implementar CRM", responsible: "Dir. IT", start: "2026-03-01", end: "2026-05-30", status: "in-progress" },
  { task: "Plan de capacitación Q2", responsible: "Dir. RRHH", start: "2026-04-01", end: "2026-06-30", status: "pending" },
  { task: "Lanzamiento e-commerce", responsible: "Dir. Comercial", start: "2026-05-01", end: "2026-07-31", status: "pending" },
  { task: "Evaluación de alianzas", responsible: "Dir. General", start: "2026-06-01", end: "2026-08-31", status: "pending" },
];

// Los 4 cuadrantes del FODA, con nombre amigable + término técnico + explicación.
const QUADRANTS = [
  { key: "strengths", friendly: "En qué somos buenos", technical: "Fortalezas", help: "Lo que tu negocio hace mejor que otros.", items: FAKE_SWOT.strengths, icon: Award, color: "text-green-600 dark:text-green-500", bg: "bg-green-500/15", border: "border-green-500/40" },
  { key: "opportunities", friendly: "Oportunidades por aprovechar", technical: "Oportunidades", help: "Cosas de afuera que podrías usar a tu favor.", items: FAKE_SWOT.opportunities, icon: Sprout, color: "text-blue-600 dark:text-blue-500", bg: "bg-blue-500/15", border: "border-blue-500/40" },
  { key: "weaknesses", friendly: "Qué podemos mejorar", technical: "Debilidades", help: "Aspectos internos que hoy te frenan.", items: FAKE_SWOT.weaknesses, icon: Wrench, color: "text-orange-600 dark:text-orange-500", bg: "bg-orange-500/15", border: "border-orange-500/40" },
  { key: "threats", friendly: "Riesgos de afuera", technical: "Amenazas", help: "Situaciones externas que podrían afectarte.", items: FAKE_SWOT.threats, icon: ShieldAlert, color: "text-red-600 dark:text-red-500", bg: "bg-red-500/15", border: "border-red-500/40" },
];

export default function SwotAnalysis() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("swot");

  const tabs = [
    { id: "swot", label: "Las 4 áreas", icon: Grid2x2 },
    { id: "strategies", label: "Ideas de estrategia", icon: Lightbulb },
    { id: "timeline", label: "Plan de acción", icon: Calendar },
  ];

  const getStatusBadge = (status) => {
    const styles = {
      completed: "bg-green-500/20 text-green-600 dark:text-green-500 border-green-500/30",
      "in-progress": "bg-accent/20 text-accent border-accent/30",
      pending: "bg-gray-500/20 text-gray-500 dark:text-gray-400 border-gray-500/30"
    };
    const icons = {
      completed: <CheckCircle className="w-3 h-3" />,
      "in-progress": <Clock className="w-3 h-3" />,
      pending: <AlertCircle className="w-3 h-3" />
    };
    const labels = { completed: "Listo", "in-progress": "En proceso", pending: "Por empezar" };
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border ${styles[status]}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      Alta: "bg-red-500/20 text-red-600 dark:text-red-500 border-red-500/30",
      Media: "bg-accent/20 text-accent border-accent/30",
      Baja: "bg-blue-500/20 text-blue-600 dark:text-blue-500 border-blue-500/30"
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-subtitle border ${styles[priority]}`}>
        Prioridad {priority.toLowerCase()}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-title">Mi estrategia (FODA)</h1>
          <p className="text-muted">Descubre tus fortalezas, qué mejorar, y arma tu plan de acción.</p>
        </div>
      </div>

      {/* Aviso de datos de ejemplo */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          <span className="font-subtitle">Datos de ejemplo.</span>{" "}
          Estás viendo una demostración con información de muestra.
        </p>
      </div>

      {/* ¿Qué es un FODA? */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Grid2x2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-subtitle text-lg mb-1">¿Qué es un FODA?</h2>
              <p className="text-sm text-muted leading-relaxed">
                Es una forma sencilla de ver tu negocio en 4 partes: en qué eres bueno,
                qué puedes mejorar, y las oportunidades y riesgos que hay afuera. Con esas
                4 partes claras, es mucho más fácil decidir qué hacer. Su nombre viene de
                <span className="text-foreground"> F</span>ortalezas,
                <span className="text-foreground"> O</span>portunidades,
                <span className="text-foreground"> D</span>ebilidades y
                <span className="text-foreground"> A</span>menazas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="grid grid-cols-3 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all ${
              activeTab === tab.id ? "nav-glass active" : "glass glass-hover"
            }`}
          >
            <tab.icon className="w-7 h-7" />
            <span className="font-subtitle text-sm text-center">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Las 4 áreas (FODA) */}
      {activeTab === "swot" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {QUADRANTS.map((q) => (
            <Card key={q.key} className={`glass border-2 ${q.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${q.bg}`}>
                    <q.icon className={`w-6 h-6 ${q.color}`} />
                  </div>
                  <div>
                    <CardTitle className="font-subtitle text-lg leading-tight">{q.friendly}</CardTitle>
                    <p className="text-xs text-muted mt-0.5">{q.technical} · {q.help}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {q.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-3 glass rounded-xl group">
                      <span className="text-sm flex-grow">{item}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg hover:bg-accent/20" title="Editar">
                          <Pencil className="w-3.5 h-3.5 text-accent" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-red-500/20" title="Quitar">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="w-full flex items-center justify-center gap-2 p-3 glass rounded-xl text-accent hover:bg-accent/10 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-subtitle">Agregar</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ideas de estrategia */}
      {activeTab === "strategies" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent" />
              Ideas de estrategia
            </CardTitle>
            <p className="text-sm text-muted mt-1">
              Estas ideas salen de combinar las 4 áreas de tu FODA. Cada una te dice cómo usar
              lo que tienes para crecer o protegerte.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {FAKE_STRATEGIES.map((s, i) => {
                const info = STRATEGY_TYPES[s.type];
                return (
                  <div key={i} className="p-4 glass rounded-xl">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-subtitle ${info.cls}`}>
                        {info.pair}
                      </span>
                      {getPriorityBadge(s.priority)}
                    </div>
                    <p className="text-sm mb-1">{s.strategy}</p>
                    <p className="text-xs text-muted italic">💡 {info.help}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan de acción */}
      {activeTab === "timeline" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              Plan de acción
            </CardTitle>
            <p className="text-sm text-muted mt-1">
              Las acciones para poner en marcha tu estrategia: qué se hace, quién la lleva y para cuándo.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">Acción</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">¿Quién lo hace?</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">Empieza</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">Termina</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">¿Cómo va?</th>
                  </tr>
                </thead>
                <tbody>
                  {FAKE_TIMELINE.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                      <td className="py-3 px-4 text-sm font-subtitle">{item.task}</td>
                      <td className="py-3 px-4 text-sm text-muted">{item.responsible}</td>
                      <td className="py-3 px-4 text-sm text-muted">{item.start}</td>
                      <td className="py-3 px-4 text-sm text-muted">{item.end}</td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Link to={createPageUrl("BusinessAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Paso 2: Entiende tu negocio
          </Button>
        </Link>
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            Volver al inicio <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
