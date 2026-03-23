import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  LineChart,
  Globe,
  BarChart3,
  FileText,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Percent,
  Calculator,
  Briefcase,
  CreditCard,
  PiggyBank,
  Building
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

const MONTHS_SHORT = ["Ene-26", "Feb-26", "Mar-26", "Abr-26", "May-26", "Jun-26"];

const FAKE_PROJECTION = [
  { label: "Ventas/Ingresos netos", annual2025: 2450000, monthly: [210000, 220000, 215000, 230000, 235000, 228000], bold: true },
  { label: "  Otros ingresos", annual2025: 35000, monthly: [3000, 3200, 2800, 3500, 3100, 3000], indent: true },
  { label: "  Devoluciones", annual2025: -45200, monthly: [-3800, -4000, -3600, -4200, -4100, -3900], indent: true, negative: true },
  { label: "Costo de ventas", annual2025: -1617000, monthly: [-138600, -145200, -141900, -151800, -155100, -150480], bold: true, negative: true },
  { label: "Utilidad bruta", annual2025: 833000, monthly: [70600, 74000, 72300, 77500, 78900, 76620], bold: true, accent: true },
  { label: "Gastos de operación", annual2025: -477750, monthly: [-39800, -41500, -40200, -43000, -42800, -42100], bold: true, negative: true },
  { label: "Utilidad de operación", annual2025: 355250, monthly: [30800, 32500, 32100, 34500, 36100, 34520], bold: true, accent: true },
];

const PROJECTION_MENU_ITEMS = [
  { icon: Globe, label: "Datos Macroeconómicos", desc: "Inflación, tipo de cambio, PIB" },
  { icon: TrendingUp, label: "Proyección Ventas", desc: "Forecast de ingresos por línea" },
  { icon: BarChart3, label: "Resumen Ventas", desc: "Consolidado de ventas proyectadas" },
  { icon: LineChart, label: "Proyección Devoluciones", desc: "Estimación de devoluciones" },
  { icon: DollarSign, label: "Proyección Costo", desc: "Costos de venta proyectados" },
  { icon: Percent, label: "Resumen Costo", desc: "Consolidado de costos" },
  { icon: Calculator, label: "Proyección Gastos", desc: "Gastos operativos proyectados" },
  { icon: FileText, label: "Proyección Otras Partidas", desc: "Partidas extraordinarias" },
  { icon: LineChart, label: "Flujos de Efectivo", desc: "Flujo proyectado mensual" },
];

const FAKE_QUOTATION_ITEMS = [
  { position: "Director General", salary: 85000, months: 12, bonus: 85000, frequency: "Anual", monthly: 7083 },
  { position: "Dir. Comercial", salary: 55000, months: 12, bonus: 55000, frequency: "Anual", monthly: 4583 },
  { position: "Dir. Operaciones", salary: 50000, months: 12, bonus: 50000, frequency: "Anual", monthly: 4167 },
  { position: "Gerente Ventas", salary: 35000, months: 6, bonus: 17500, frequency: "Semestral", monthly: 2917 },
  { position: "Analista Financiero", salary: 28000, months: 12, bonus: 28000, frequency: "Anual", monthly: 2333 },
];

const fmt = (n) => {
  if (n === 0) return "-";
  const prefix = n < 0 ? "-$" : "$";
  return prefix + Math.abs(n).toLocaleString("en-US");
};

export default function FinancialProjection() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("menu");

  const mainTabs = [
    { id: "menu", label: t('finProjMenu'), icon: BarChart3 },
    { id: "consultation", label: t('finProjConsult'), icon: FileText },
    { id: "quotation", label: t('finQuotation'), icon: Calculator },
  ];

  const quotationTabs = [
    "Bonos Totales", "Créditos Largo Plazo", "Créditos Capital Trabajo", "Leasing", "Inversiones"
  ];
  const [quotationTab, setQuotationTab] = useState(0);

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
          <h1 className="text-3xl font-title">{t('finProjection')}</h1>
          <p className="text-muted">{t('finProjectionPageDesc')}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="grid grid-cols-3 gap-4">
        {mainTabs.map((tab) => (
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

      {/* Projection Menu */}
      {activeTab === "menu" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTION_MENU_ITEMS.map((item, i) => (
            <Card key={i} className="glass glass-hover cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-subtitle text-sm">{item.label}</h3>
                  <p className="text-xs text-muted mt-1">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Projection Consultation */}
      {activeTab === "consultation" && (
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-subtitle flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" />
                  {t('finProjConsult')}
                </CardTitle>
                <p className="text-sm text-muted mt-1">{t('finProjVsBase')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-3 font-subtitle text-muted sticky left-0 bg-transparent">{t('finConcept')}</th>
                    <th className="text-right py-3 px-3 font-subtitle text-accent">Anual 2025</th>
                    {MONTHS_SHORT.map((m) => (
                      <th key={m} className="text-right py-3 px-2 font-subtitle text-muted">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FAKE_PROJECTION.map((row, i) => (
                    <tr key={i} className={`border-b border-[var(--card-border)] ${row.accent ? "bg-accent/10" : ""} hover:bg-[var(--table-row-hover)]`}>
                      <td className={`py-3 px-3 sticky left-0 ${row.bold ? "font-subtitle" : ""} ${row.indent ? "pl-8 text-muted" : ""}`}>
                        {row.label}
                      </td>
                      <td className={`py-3 px-3 text-right ${row.bold ? "font-subtitle" : ""} ${row.negative ? "text-red-400" : ""} ${row.accent ? "text-accent" : ""}`}>
                        {fmt(row.annual2025)}
                      </td>
                      {row.monthly.map((v, j) => (
                        <td key={j} className={`py-3 px-2 text-right ${row.negative ? "text-red-400" : ""} ${row.accent ? "text-accent" : ""}`}>
                          {fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quotation Tools */}
      {activeTab === "quotation" && (
        <div className="space-y-6">
          {/* Quotation sub-tabs */}
          <div className="flex gap-2 flex-wrap">
            {quotationTabs.map((tab, i) => {
              const icons = [Briefcase, CreditCard, DollarSign, Building, PiggyBank];
              const Icon = icons[i];
              return (
                <button
                  key={i}
                  onClick={() => setQuotationTab(i)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-subtitle text-sm transition-all ${
                    quotationTab === i ? "bg-accent text-accent-foreground" : "glass hover:border-accent"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab}
                </button>
              );
            })}
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="font-subtitle flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent" />
                {quotationTabs[quotationTab]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)]">
                      <th className="text-left py-3 px-4 font-subtitle text-muted">{t('finPosition')}</th>
                      <th className="text-right py-3 px-4 font-subtitle text-muted">{t('finMonthlySalary')}</th>
                      <th className="text-right py-3 px-4 font-subtitle text-muted">{t('finBonusMonths')}</th>
                      <th className="text-right py-3 px-4 font-subtitle text-muted">{t('finBonusTotal')}</th>
                      <th className="text-left py-3 px-4 font-subtitle text-muted">{t('finFrequency')}</th>
                      <th className="text-right py-3 px-4 font-subtitle text-muted">{t('finMonthlyBudget')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FAKE_QUOTATION_ITEMS.map((item, i) => (
                      <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                        <td className="py-3 px-4 font-subtitle">{item.position}</td>
                        <td className="py-3 px-4 text-right">{fmt(item.salary)}</td>
                        <td className="py-3 px-4 text-right">{item.months}</td>
                        <td className="py-3 px-4 text-right text-accent">{fmt(item.bonus)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full text-xs glass border border-accent/20">{item.frequency}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-subtitle">{fmt(item.monthly)}</td>
                      </tr>
                    ))}
                    <tr className="bg-accent/10">
                      <td className="py-3 px-4 font-subtitle text-accent">Total</td>
                      <td className="py-3 px-4 text-right font-subtitle text-accent">{fmt(FAKE_QUOTATION_ITEMS.reduce((s, i) => s + i.salary, 0))}</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right font-subtitle text-accent">{fmt(FAKE_QUOTATION_ITEMS.reduce((s, i) => s + i.bonus, 0))}</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right font-subtitle text-accent">{fmt(FAKE_QUOTATION_ITEMS.reduce((s, i) => s + i.monthly, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Link to={createPageUrl("FinancialHistory")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('finHistorical')}
          </Button>
        </Link>
        <Link to={createPageUrl("FinancialCurrent")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            {t('finCurrent')} <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
