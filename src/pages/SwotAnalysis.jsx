import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Target,
  ListChecks,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle
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

const FAKE_STRATEGIES = [
  { type: "FO", label: "Fortaleza-Oportunidad", strategy: "Aprovechar el equipo de ventas para capturar el crecimiento digital del 15%", priority: "Alta" },
  { type: "FA", label: "Fortaleza-Amenaza", strategy: "Usar la marca consolidada como barrera contra competidores internacionales", priority: "Alta" },
  { type: "DO", label: "Debilidad-Oportunidad", strategy: "Digitalizar procesos internos aprovechando alianzas con proveedores tecnológicos", priority: "Media" },
  { type: "DA", label: "Debilidad-Amenaza", strategy: "Implementar plan de capacitación para reducir vulnerabilidad ante cambios regulatorios", priority: "Media" },
  { type: "FO", label: "Fortaleza-Oportunidad", strategy: "Expandir servicio post-venta como diferenciador en nuevos canales digitales", priority: "Alta" },
  { type: "DO", label: "Debilidad-Oportunidad", strategy: "Crear presencia en redes sociales para capturar la demanda creciente", priority: "Baja" },
];

const FAKE_TIMELINE = [
  { task: "Auditoría de procesos internos", responsible: "Dir. Operaciones", start: "2026-01-15", end: "2026-02-28", status: "completed" },
  { task: "Diseño de estrategia digital", responsible: "Dir. Marketing", start: "2026-02-01", end: "2026-03-31", status: "in-progress" },
  { task: "Implementar CRM", responsible: "Dir. IT", start: "2026-03-01", end: "2026-05-30", status: "in-progress" },
  { task: "Plan de capacitación Q2", responsible: "Dir. RRHH", start: "2026-04-01", end: "2026-06-30", status: "pending" },
  { task: "Lanzamiento e-commerce", responsible: "Dir. Comercial", start: "2026-05-01", end: "2026-07-31", status: "pending" },
  { task: "Evaluación de alianzas", responsible: "Dir. General", start: "2026-06-01", end: "2026-08-31", status: "pending" },
];

export default function SwotAnalysis() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("swot");

  const tabs = [
    { id: "swot", label: t('finSwotMatrix'), icon: Target },
    { id: "strategies", label: t('finStrategySummary'), icon: ListChecks },
    { id: "timeline", label: t('finTimeline'), icon: Calendar },
  ];

  const getStatusBadge = (status) => {
    const styles = {
      completed: "bg-green-500/20 text-green-500 border-green-500/30",
      "in-progress": "bg-accent/20 text-accent border-accent/30",
      pending: "bg-gray-500/20 text-gray-400 border-gray-500/30"
    };
    const icons = {
      completed: <CheckCircle className="w-3 h-3" />,
      "in-progress": <Clock className="w-3 h-3" />,
      pending: <AlertCircle className="w-3 h-3" />
    };
    const labels = {
      completed: t('finStatusCompleted'),
      "in-progress": t('finStatusInProgress'),
      pending: t('finStatusPending')
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border ${styles[status]}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      Alta: "bg-red-500/20 text-red-500 border-red-500/30",
      Media: "bg-accent/20 text-accent border-accent/30",
      Baja: "bg-blue-500/20 text-blue-500 border-blue-500/30"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-subtitle border ${styles[priority]}`}>
        {priority}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("BusinessAnalysis")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-title">{t('finConclusionsTitle')}</h1>
          <p className="text-muted">{t('finConclusionsSubtitle')}</p>
        </div>
      </div>

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

      {/* SWOT Matrix */}
      {activeTab === "swot" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: "strengths", title: "F", fullTitle: t('finStrengths'), items: FAKE_SWOT.strengths, borderColor: "border-green-500/50", bgLetter: "bg-green-500/20 text-green-500" },
            { key: "opportunities", title: "O", fullTitle: t('finOpportunities'), items: FAKE_SWOT.opportunities, borderColor: "border-blue-500/50", bgLetter: "bg-blue-500/20 text-blue-500" },
            { key: "weaknesses", title: "D", fullTitle: t('finWeaknesses'), items: FAKE_SWOT.weaknesses, borderColor: "border-orange-500/50", bgLetter: "bg-orange-500/20 text-orange-500" },
            { key: "threats", title: "A", fullTitle: t('finThreatsLabel'), items: FAKE_SWOT.threats, borderColor: "border-red-500/50", bgLetter: "bg-red-500/20 text-red-500" },
          ].map((quadrant) => (
            <Card key={quadrant.key} className={`glass border-2 ${quadrant.borderColor}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-title text-2xl ${quadrant.bgLetter}`}>
                    {quadrant.title}
                  </div>
                  <CardTitle className="font-subtitle text-lg">{quadrant.fullTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quadrant.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-3 glass rounded-xl group">
                      <span className="text-sm flex-grow">{item}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg hover:bg-accent/20">
                          <Pencil className="w-3.5 h-3.5 text-accent" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-red-500/20">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="w-full flex items-center justify-center gap-2 p-3 glass rounded-xl text-accent hover:bg-accent/10 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-subtitle">{t('finAddItem')}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Strategy Summary */}
      {activeTab === "strategies" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-accent" />
              {t('finStrategySummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {FAKE_STRATEGIES.map((s, i) => (
                <div key={i} className="flex items-start gap-4 p-4 glass rounded-xl">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-subtitle text-xs ${
                    s.type === "FO" ? "bg-green-500/20 text-green-500" :
                    s.type === "FA" ? "bg-orange-500/20 text-orange-500" :
                    s.type === "DO" ? "bg-blue-500/20 text-blue-500" :
                    "bg-red-500/20 text-red-500"
                  }`}>
                    {s.type}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-subtitle text-sm text-accent">{s.label}</span>
                      {getPriorityBadge(s.priority)}
                    </div>
                    <p className="text-sm text-muted">{s.strategy}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {activeTab === "timeline" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              {t('finTimeline')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finTask')}</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finResponsible')}</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finStart')}</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finEnd')}</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finStatus')}</th>
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
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('finBizAnalysis')}
          </Button>
        </Link>
        <Link to={createPageUrl("FinancialHistory")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            {t('finHistorical')} <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
