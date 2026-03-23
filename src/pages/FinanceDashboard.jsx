import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  TrendingUp,
  BarChart3,
  Target,
  DollarSign,
  FileText,
  ArrowRight,
  Building,
  Users,
  PieChart,
  Calendar,
  Briefcase,
  LineChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

export default function FinanceDashboard() {
  const { t } = useLanguage();

  const businessModules = [
    {
      icon: Target,
      title: t('finBizAnalysis'),
      description: t('finBizAnalysisDesc'),
      href: createPageUrl("BusinessAnalysis"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/20"
    },
    {
      icon: PieChart,
      title: t('finSwot'),
      description: t('finSwotDesc'),
      href: createPageUrl("SwotAnalysis"),
      color: "text-purple-500",
      bgColor: "bg-purple-500/20"
    }
  ];

  const financeModules = [
    {
      icon: BarChart3,
      title: t('finHistorical'),
      description: t('finHistoricalDesc'),
      href: createPageUrl("FinancialHistory"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/20"
    },
    {
      icon: LineChart,
      title: t('finProjection'),
      description: t('finProjectionDesc'),
      href: createPageUrl("FinancialProjection"),
      color: "text-orange-500",
      bgColor: "bg-orange-500/20"
    },
    {
      icon: FileText,
      title: t('finCurrent'),
      description: t('finCurrentDesc'),
      href: createPageUrl("FinancialCurrent"),
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/20"
    }
  ];

  const summaryStats = [
    { label: t('finStatRevenue'), value: "$2,450,000", icon: DollarSign, trend: "+12.5%" },
    { label: t('finStatMargin'), value: "34.2%", icon: TrendingUp, trend: "+2.1%" },
    { label: t('finStatStrategies'), value: "8", icon: Briefcase, trend: "3 " + t('finStatActive') },
    { label: t('finStatPeriod'), value: "Q1 2026", icon: Calendar, trend: t('finStatInProgress') }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-title mb-2">{t('finDashboardTitle')}</h1>
            <p className="text-lg text-muted">{t('finDashboardSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
            <Building className="w-4 h-4 text-accent" />
            <span className="font-subtitle text-sm">Tenryu Corp.</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryStats.map((stat, i) => (
          <Card key={i} className="glass">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-subtitle text-muted">{stat.label}</CardTitle>
                <stat.icon className="w-5 h-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-title">{stat.value}</div>
              <p className="text-xs text-accent mt-1">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business Planning Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-title">{t('finBizPlanningTitle')}</h2>
            <p className="text-sm text-muted">{t('finBizPlanningSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {businessModules.map((mod, i) => (
            <Link key={i} to={mod.href}>
              <Card className="glass glass-hover cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${mod.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <mod.icon className={`w-6 h-6 ${mod.color}`} />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-subtitle text-lg mb-2">{mod.title}</h3>
                      <p className="text-sm text-muted mb-4">{mod.description}</p>
                      <div className="flex items-center text-accent text-sm font-subtitle">
                        {t('finEnter')} <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Financial Planning Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-title">{t('finFinPlanningTitle')}</h2>
            <p className="text-sm text-muted">{t('finFinPlanningSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {financeModules.map((mod, i) => (
            <Link key={i} to={mod.href}>
              <Card className="glass glass-hover cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 ${mod.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                    <mod.icon className={`w-6 h-6 ${mod.color}`} />
                  </div>
                  <h3 className="font-subtitle text-lg mb-2">{mod.title}</h3>
                  <p className="text-sm text-muted mb-4">{mod.description}</p>
                  <div className="flex items-center text-accent text-sm font-subtitle">
                    {t('finEnter')} <ArrowRight className="w-4 h-4 ml-1" />
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
