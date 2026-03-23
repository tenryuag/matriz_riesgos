import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Users,
  Building,
  Globe,
  BarChart3,
  ChevronRight,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

const FAKE_COMPETITORS = [
  { name: "Competidor A", precio: "Alto", servicio: "Bueno", postVenta: "Regular", entrega: "Rápida" },
  { name: "Competidor B", precio: "Medio", servicio: "Excelente", postVenta: "Bueno", entrega: "Media" },
  { name: "Competidor C", precio: "Bajo", servicio: "Regular", postVenta: "Malo", entrega: "Lenta" },
  { name: "Competidor D", precio: "Alto", servicio: "Bueno", postVenta: "Excelente", entrega: "Rápida" },
  { name: "Competidor E", precio: "Medio", servicio: "Regular", postVenta: "Bueno", entrega: "Media" },
];

const FAKE_INTERNAL_QUESTIONS = [
  { category: "Capital Financiero", question: "¿Cuentas con capital de trabajo suficiente?", answer: "Sí" },
  { category: "Capital Financiero", question: "¿Tienes acceso a líneas de crédito?", answer: "No" },
  { category: "Capital Social", question: "¿Tienes alianzas estratégicas?", answer: "Sí" },
  { category: "Capital Social", question: "¿Red de contactos activa?", answer: "Sí" },
  { category: "Capital Humano", question: "¿Equipo capacitado?", answer: "Sí" },
  { category: "Capital Humano", question: "¿Plan de retención de talento?", answer: "No" },
  { category: "Infraestructura", question: "¿Tecnología actualizada?", answer: "Sí" },
  { category: "Infraestructura", question: "¿Procesos documentados?", answer: "No" },
];

const FAKE_FINANCIAL_WEAKNESSES = [
  { category: "Rotación de inventarios", isWeakness: true, description: "Inventario lento en línea de productos B" },
  { category: "Indicadores de productividad", isWeakness: false, description: "Niveles aceptables" },
  { category: "Definición de métricas", isWeakness: true, description: "Sin KPIs claros para ventas" },
  { category: "Gastos operativos", isWeakness: true, description: "Gastos administrativos por encima del 25%" },
  { category: "Margen de contribución", isWeakness: false, description: "Saludable en todas las líneas" },
];

export default function BusinessAnalysis() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("market");
  const [marketSubTab, setMarketSubTab] = useState("competitors");

  const mainTabs = [
    { id: "market", label: t('finTabMarket'), icon: Globe },
    { id: "internal", label: t('finTabInternal'), icon: Building },
    { id: "customer", label: t('finTabCustomer'), icon: Users },
    { id: "financial", label: t('finTabFinStatus'), icon: BarChart3 },
  ];

  const marketSubTabs = [
    { id: "competitors", label: t('finSubTabCompetitors') },
    { id: "position", label: t('finSubTabPosition') },
    { id: "external", label: t('finSubTabExternal') },
  ];

  const getRatingIcon = (val) => {
    if (val === "Excelente" || val === "Rápida" || val === "Alto") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (val === "Malo" || val === "Lenta" || val === "Bajo") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinanceDashboard")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-title">{t('finBizAnalysis')}</h1>
          <p className="text-muted">{t('finBizAnalysisPageDesc')}</p>
        </div>
      </div>

      {/* Main Tabs - Icon navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all ${
              activeTab === tab.id
                ? "nav-glass active"
                : "glass glass-hover"
            }`}
          >
            <tab.icon className="w-8 h-8" />
            <span className="font-subtitle text-sm text-center">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "market" && (
        <div className="space-y-6">
          {/* Market Sub-tabs */}
          <div className="flex gap-2 flex-wrap">
            {marketSubTabs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setMarketSubTab(sub.id)}
                className={`px-5 py-2.5 rounded-xl font-subtitle text-sm transition-all ${
                  marketSubTab === sub.id
                    ? "bg-accent text-accent-foreground"
                    : "glass hover:border-accent"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {marketSubTab === "competitors" && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="font-subtitle flex items-center gap-2">
                  <Globe className="w-5 h-5 text-accent" />
                  {t('finCompetitorAnalysis')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-glass">
                    <thead>
                      <tr className="border-b border-[var(--card-border)]">
                        <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finCompetitor')}</th>
                        <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finPrice')}</th>
                        <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finService')}</th>
                        <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finPostSale')}</th>
                        <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finDelivery')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FAKE_COMPETITORS.map((comp, i) => (
                        <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                          <td className="py-3 px-4 font-subtitle text-sm">{comp.name}</td>
                          <td className="py-3 px-4 text-sm"><div className="flex items-center gap-2">{getRatingIcon(comp.precio)} {comp.precio}</div></td>
                          <td className="py-3 px-4 text-sm"><div className="flex items-center gap-2">{getRatingIcon(comp.servicio)} {comp.servicio}</div></td>
                          <td className="py-3 px-4 text-sm"><div className="flex items-center gap-2">{getRatingIcon(comp.postVenta)} {comp.postVenta}</div></td>
                          <td className="py-3 px-4 text-sm"><div className="flex items-center gap-2">{getRatingIcon(comp.entrega)} {comp.entrega}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {marketSubTab === "position" && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="font-subtitle">{t('finMarketPosition')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-subtitle text-accent">{t('finStrengths')}</h3>
                    {["Precio competitivo", "Servicio post-venta superior", "Marca reconocida"].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 glass rounded-xl">
                        <Star className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-subtitle text-accent">{t('finWeaknessesToManage')}</h3>
                    {["Tiempo de entrega", "Alcance geográfico limitado", "Poca presencia digital"].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 glass rounded-xl">
                        <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {marketSubTab === "external" && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="font-subtitle">{t('finExternalEnv')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { title: t('finOpportunities'), items: ["Mercado en crecimiento del 15%", "Nueva regulación favorable", "Expansión de comercio electrónico"], color: "text-green-500" },
                    { title: t('finThreats'), items: ["Entrada de competidores internacionales", "Inflación de costos de materia prima", "Cambios en preferencias del consumidor"], color: "text-red-500" },
                  ].map((section, i) => (
                    <div key={i} className="space-y-4">
                      <h3 className={`font-subtitle ${section.color}`}>{section.title}</h3>
                      {section.items.map((item, j) => (
                        <div key={j} className="p-3 glass rounded-xl text-sm">{item}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "internal" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <Building className="w-5 h-5 text-accent" />
              {t('finInternalAnalysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {["Capital Financiero", "Capital Social", "Capital Humano", "Infraestructura"].map((cat) => (
                <div key={cat}>
                  <h3 className="font-subtitle text-accent mb-3">{cat}</h3>
                  <div className="space-y-2">
                    {FAKE_INTERNAL_QUESTIONS.filter(q => q.category === cat).map((q, i) => (
                      <div key={i} className="flex items-center justify-between p-4 glass rounded-xl">
                        <span className="text-sm flex-grow">{q.question}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-subtitle ${
                          q.answer === "Sí"
                            ? "bg-green-500/20 text-green-500 border border-green-500/30"
                            : "bg-red-500/20 text-red-500 border border-red-500/30"
                        }`}>
                          {q.answer}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "customer" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              {t('finCustomerAnalysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { label: t('finCustProblem'), value: "Dificultad para gestionar inventarios de forma eficiente y predecir la demanda de productos estacionales." },
                { label: t('finCustDesire'), value: "Automatización de procesos, reducción de costos operativos y mayor visibilidad del estado del negocio." },
                { label: t('finCustFunctionalGoals'), value: "Reducir tiempos de entrega en un 30%, mejorar la precisión de forecasting al 85% y digitalizar procesos manuales." },
                { label: t('finCustEmotionalGoals'), value: "Sentir confianza en las decisiones de negocio, reducir el estrés operativo y obtener reconocimiento como empresa innovadora." },
                { label: t('finCustBasicNeeds'), value: "Solución accesible, soporte técnico confiable, interfaz fácil de usar y reportes claros para toma de decisiones." },
              ].map((field, i) => (
                <div key={i} className="space-y-2">
                  <label className="font-subtitle text-sm text-accent">{field.label}</label>
                  <div className="p-4 glass rounded-xl">
                    <p className="text-sm text-muted">{field.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "financial" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              {t('finFinancialStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finCategory')}</th>
                    <th className="text-center py-3 px-4 font-subtitle text-sm text-muted">{t('finIsWeakness')}</th>
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finDescription')}</th>
                  </tr>
                </thead>
                <tbody>
                  {FAKE_FINANCIAL_WEAKNESSES.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                      <td className="py-3 px-4 font-subtitle text-sm">{item.category}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-subtitle ${
                          item.isWeakness
                            ? "bg-red-500/20 text-red-500 border border-red-500/30"
                            : "bg-green-500/20 text-green-500 border border-green-500/30"
                        }`}>
                          {item.isWeakness ? t('yes') : t('no')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next button */}
      <div className="flex justify-end">
        <Link to={createPageUrl("SwotAnalysis")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            {t('finGoToConclusions')} <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
