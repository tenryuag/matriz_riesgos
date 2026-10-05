import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  BookOpen,
  Minus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

const MONTHS_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const FAKE_REAL_SALES = [
  { month: "Enero", total: 252000, income: 255000, returns: -3000, net: 252000 },
  { month: "Febrero", total: 268000, income: 272000, returns: -4000, net: 268000 },
  { month: "Marzo", total: 258000, income: 262000, returns: -4000, net: 258000 },
  { month: "Abril", total: null, income: null, returns: null, net: null },
  { month: "Mayo", total: null, income: null, returns: null, net: null },
  { month: "Junio", total: null, income: null, returns: null, net: null },
];

const FAKE_COMPARISON = [
  {
    label: "Ventas/Ingresos netos", bold: true,
    months: [
      { real: 252000, budget: 210000, diff: 42000 },
      { real: 268000, budget: 220000, diff: 48000 },
      { real: 258000, budget: 215000, diff: 43000 },
    ]
  },
  {
    label: "  Otros ingresos", indent: true,
    months: [
      { real: 3200, budget: 3000, diff: 200 },
      { real: 3500, budget: 3200, diff: 300 },
      { real: 2900, budget: 2800, diff: 100 },
    ]
  },
  {
    label: "  Devoluciones", indent: true, negative: true,
    months: [
      { real: -3000, budget: -3800, diff: 800 },
      { real: -4000, budget: -4000, diff: 0 },
      { real: -4000, budget: -3600, diff: -400 },
    ]
  },
  {
    label: "Costo de ventas", bold: true, negative: true,
    months: [
      { real: -166320, budget: -138600, diff: -27720 },
      { real: -176960, budget: -145200, diff: -31760 },
      { real: -170280, budget: -141900, diff: -28380 },
    ]
  },
  {
    label: "Utilidad bruta", bold: true, accent: true,
    months: [
      { real: 85680, budget: 70600, diff: 15080 },
      { real: 91040, budget: 74000, diff: 17040 },
      { real: 87720, budget: 72300, diff: 15420 },
    ]
  },
  {
    label: "Gastos de operación", bold: true, negative: true,
    months: [
      { real: -42500, budget: -39800, diff: -2700 },
      { real: -44200, budget: -41500, diff: -2700 },
      { real: -41800, budget: -40200, diff: -1600 },
    ]
  },
  {
    label: "Utilidad de operación", bold: true, accent: true,
    months: [
      { real: 43180, budget: 30800, diff: 12380 },
      { real: 46840, budget: 32500, diff: 14340 },
      { real: 45920, budget: 32100, diff: 13820 },
    ]
  },
];

const fmt = (n) => {
  if (n === null || n === undefined) return "";
  if (n === 0) return "-";
  const prefix = n < 0 ? "-$" : "$";
  return prefix + Math.abs(n).toLocaleString("en-US");
};

const MONTHS_Q1 = ["Ene 2026", "Feb 2026", "Mar 2026"];

export default function FinancialCurrent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("capture");

  const mainTabs = [
    { id: "capture", label: t('finRealDataCapture'), icon: FileText },
    { id: "comparison", label: t('finRealVsBudget'), icon: BarChart3 },
    { id: "guide", label: t('finAnalysisGuide'), icon: BookOpen },
  ];

  const getDiffColor = (diff) => {
    if (diff > 0) return "text-green-500";
    if (diff < 0) return "text-red-400";
    return "text-muted";
  };

  const getDiffIcon = (diff) => {
    if (diff > 0) return <TrendingUp className="w-3 h-3" />;
    if (diff < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
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
          <h1 className="text-3xl font-title">{t('finCurrent')}</h1>
          <p className="text-muted">{t('finCurrentPageDesc')}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted font-subtitle">{t('finAccumReal')}</span>
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div className="text-2xl font-title">$778,000</div>
            <div className="flex items-center gap-1 mt-1 text-green-500 text-xs">
              <TrendingUp className="w-3 h-3" />
              <span>+20.6% vs presupuesto</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted font-subtitle">{t('finAccumBudget')}</span>
              <BarChart3 className="w-5 h-5 text-accent" />
            </div>
            <div className="text-2xl font-title">$645,000</div>
            <p className="text-xs text-muted mt-1">Q1 2026</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted font-subtitle">{t('finVariance')}</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-title text-green-500">+$133,000</div>
            <p className="text-xs text-muted mt-1">{t('finFavorable')}</p>
          </CardContent>
        </Card>
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

      {/* Real Data Capture */}
      {activeTab === "capture" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              {t('finRealDataCapture')} — 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finMonth')}</th>
                    <th className="text-right py-3 px-4 font-subtitle text-sm text-muted">{t('finIncome')}</th>
                    <th className="text-right py-3 px-4 font-subtitle text-sm text-muted">{t('finReturns')}</th>
                    <th className="text-right py-3 px-4 font-subtitle text-sm text-muted">{t('finNetTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {FAKE_REAL_SALES.map((row, i) => (
                    <tr key={i} className={`border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)] ${row.net === null ? "opacity-40" : ""}`}>
                      <td className="py-3 px-4 font-subtitle text-sm">{row.month}</td>
                      <td className="py-3 px-4 text-right text-sm">
                        {row.income !== null ? fmt(row.income) : (
                          <span className="inline-block w-24 h-8 glass rounded-lg" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-red-400">
                        {row.returns !== null ? fmt(row.returns) : (
                          <span className="inline-block w-24 h-8 glass rounded-lg" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-subtitle text-accent">
                        {row.net !== null ? fmt(row.net) : (
                          <span className="inline-block w-24 h-8 glass rounded-lg" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real vs Budget Comparison */}
      {activeTab === "comparison" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              {t('finRealVsBudget')} — Q1 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th rowSpan={2} className="text-left py-2 px-3 font-subtitle text-muted sticky left-0 bg-transparent">{t('finConcept')}</th>
                    {MONTHS_Q1.map((m) => (
                      <th key={m} colSpan={3} className="text-center py-2 px-1 font-subtitle text-accent border-b border-accent/20">{m}</th>
                    ))}
                  </tr>
                  <tr className="border-b border-[var(--card-border)]">
                    {MONTHS_Q1.map((m) => (
                      <React.Fragment key={m}>
                        <th className="text-right py-2 px-2 font-subtitle text-xs text-muted">Real</th>
                        <th className="text-right py-2 px-2 font-subtitle text-xs text-muted">{t('finBudget')}</th>
                        <th className="text-right py-2 px-2 font-subtitle text-xs text-muted">{t('finDiff')}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FAKE_COMPARISON.map((row, i) => (
                    <tr key={i} className={`border-b border-[var(--card-border)] ${row.accent ? "bg-accent/10" : ""} hover:bg-[var(--table-row-hover)]`}>
                      <td className={`py-2 px-3 sticky left-0 ${row.bold ? "font-subtitle" : ""} ${row.indent ? "pl-8 text-muted" : ""}`}>
                        {row.label}
                      </td>
                      {row.months.map((m, j) => (
                        <React.Fragment key={j}>
                          <td className={`py-2 px-2 text-right ${row.negative ? "text-red-400" : ""} ${row.accent ? "text-accent" : ""}`}>
                            {fmt(m.real)}
                          </td>
                          <td className={`py-2 px-2 text-right text-muted`}>
                            {fmt(m.budget)}
                          </td>
                          <td className={`py-2 px-2 text-right ${getDiffColor(m.diff)}`}>
                            <span className="inline-flex items-center gap-1">
                              {getDiffIcon(m.diff)}
                              {fmt(m.diff)}
                            </span>
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Guide */}
      {activeTab === "guide" && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-accent" />
              {t('finAnalysisGuide')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  title: t('finGuideStep1Title'),
                  desc: t('finGuideStep1Desc'),
                  status: "done"
                },
                {
                  title: t('finGuideStep2Title'),
                  desc: t('finGuideStep2Desc'),
                  status: "done"
                },
                {
                  title: t('finGuideStep3Title'),
                  desc: t('finGuideStep3Desc'),
                  status: "current"
                },
                {
                  title: t('finGuideStep4Title'),
                  desc: t('finGuideStep4Desc'),
                  status: "pending"
                },
              ].map((step, i) => (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-xl ${
                  step.status === "current" ? "glass border-2 border-accent/50" : "glass"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-title text-sm ${
                    step.status === "done" ? "bg-green-500/20 text-green-500" :
                    step.status === "current" ? "bg-accent text-accent-foreground" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-subtitle text-sm mb-1">{step.title}</h3>
                    <p className="text-sm text-muted">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-start">
        <Link to={createPageUrl("FinancialProjection")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('finProjection')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
