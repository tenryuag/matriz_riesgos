
import React, { useState, useEffect } from "react";
import { Department } from "@/api/entities";
import { Risk } from "@/api/entities";
import { User } from "@/api/entities";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Plus,
  Eye,
  BarChart3,
  ShieldAlert,
  ArrowRight,
  Flame,
  CircleAlert,
  ChevronRight,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';
import { normalizeRiskLevel, isHighRisk, isLowRisk, getRiskLevelColorClasses } from '@/lib/utils';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar, Legend
} from "recharts";

const LEVEL_COLORS = {
  INTOLERABLE: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  TOLERABLE: "#22c55e",
  UNCLASSIFIED: "#6b7280",
};

const LEVEL_ORDER = ["INTOLERABLE", "HIGH", "MEDIUM", "LOW", "TOLERABLE", "UNCLASSIFIED"];

export default function Dashboard() {
  const [departments, setDepartments] = useState([]);
  const [risks, setRisks] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, departmentsList, risksList] = await Promise.all([
        User.me(),
        Department.list("-created_date"),
        Risk.list("-created_date")
      ]);
      setUser(currentUser);
      setDepartments(departmentsList);
      setRisks(risksList);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const getRiskLevelColor = (level) => {
    const normalized = normalizeRiskLevel(level);
    const colors = getRiskLevelColorClasses();
    return colors[normalized] || 'glass';
  };

  const getLevelLabel = (normalized) => {
    const labels = {
      INTOLERABLE: t('intolerable'),
      HIGH: t('high'),
      MEDIUM: t('medium'),
      LOW: t('low'),
      TOLERABLE: t('tolerable'),
      UNCLASSIFIED: t('unclassified'),
    };
    return labels[normalized] || normalized;
  };

  const getDetailedStats = () => {
    const total = risks.length;
    const byNormalized = {};

    LEVEL_ORDER.forEach(level => { byNormalized[level] = 0; });

    risks.forEach(risk => {
      const normalized = normalizeRiskLevel(risk.inherent_level);
      byNormalized[normalized] = (byNormalized[normalized] || 0) + 1;
    });

    const criticalRisks = risks.filter(r => isHighRisk(r.inherent_level));
    const lowRisks = risks.filter(r => isLowRisk(r.inherent_level));
    const mediumCount = byNormalized.MEDIUM || 0;

    // Risks by department
    const byDepartment = {};
    risks.forEach(risk => {
      const deptId = risk.department_id;
      if (!byDepartment[deptId]) {
        byDepartment[deptId] = { total: 0, critical: 0, medium: 0, low: 0 };
      }
      byDepartment[deptId].total++;
      if (isHighRisk(risk.inherent_level)) byDepartment[deptId].critical++;
      else if (normalizeRiskLevel(risk.inherent_level) === 'MEDIUM') byDepartment[deptId].medium++;
      else byDepartment[deptId].low++;
    });

    // Critical risks without residual improvement
    const unmitigatedCritical = criticalRisks.filter(r => {
      if (!r.residual_level) return true;
      return isHighRisk(r.residual_level);
    });

    // Inherent vs residual improvement
    const improved = risks.filter(r => {
      if (!r.inherent_level || !r.residual_level) return false;
      const iIdx = LEVEL_ORDER.indexOf(normalizeRiskLevel(r.inherent_level));
      const rIdx = LEVEL_ORDER.indexOf(normalizeRiskLevel(r.residual_level));
      return rIdx > iIdx;
    }).length;

    return {
      total,
      byNormalized,
      criticalCount: criticalRisks.length,
      intolerableCount: byNormalized.INTOLERABLE || 0,
      highCount: byNormalized.HIGH || 0,
      mediumCount,
      lowCount: lowRisks.length,
      criticalRisks,
      unmitigatedCritical,
      improved,
      byDepartment
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse">
          <div className="w-48 h-6 bg-gray-500/20 rounded mb-3"></div>
          <div className="w-72 h-4 bg-gray-500/20 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse">
              <div className="w-12 h-12 bg-gray-500/20 rounded-xl mb-4"></div>
              <div className="w-24 h-4 bg-gray-500/20 rounded mb-2"></div>
              <div className="w-16 h-6 bg-gray-500/20 rounded"></div>
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-8">
          {[1, 2].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse h-64"></div>
          ))}
        </div>
      </div>
    );
  }

  const stats = getDetailedStats();

  // Data for pie chart
  const pieData = LEVEL_ORDER
    .filter(level => stats.byNormalized[level] > 0)
    .map(level => ({
      name: getLevelLabel(level),
      value: stats.byNormalized[level],
      color: LEVEL_COLORS[level],
      normalized: level
    }));

  // Data for department bar chart
  const deptBarData = departments.slice(0, 6).map(dept => {
    const deptStats = stats.byDepartment[dept.id] || { total: 0, critical: 0, medium: 0, low: 0 };
    return {
      name: dept.name.length > 12 ? dept.name.substring(0, 12) + "..." : dept.name,
      fullName: dept.name,
      [t('dashCritical')]: deptStats.critical,
      [t('medium')]: deptStats.medium,
      [t('dashControlled')]: deptStats.low,
    };
  }).filter(d => d[t('dashCritical')] > 0 || d[t('medium')] > 0 || d[t('dashControlled')] > 0);

  // Mitigation effectiveness
  const mitigationPct = stats.total > 0 ? Math.round((stats.improved / stats.total) * 100) : 0;
  const criticalPct = stats.total > 0 ? Math.round((stats.criticalCount / stats.total) * 100) : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-xl p-3 text-sm border border-[var(--card-border)]">
          <p className="font-subtitle">{payload[0].name}: <span className="text-accent">{payload[0].value}</span></p>
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-xl p-3 text-sm border border-[var(--card-border)]">
          <p className="font-subtitle mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-title mb-2">
              {t('welcome')}
            </h1>
            <p className="text-lg text-muted">
              {t('dashboardHeaderSubtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Link to={createPageUrl("Departments")} className="w-full md:w-auto">
              <Button variant="outline" className="w-full glass hover:border-accent">
                <Building2 className="w-4 h-4 mr-2" />
                {t('departments')}
              </Button>
            </Link>
            <Link to={createPageUrl("AddRisk")} className="w-full md:w-auto">
              <Button className="w-full glass hover:border-accent bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                {t('newRisk')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Critical Risk Alert Banner */}
      {stats.unmitigatedCritical.length > 0 && (
        <div className="rounded-3xl p-6 border-2 border-red-500/40 bg-red-500/10 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
              <ShieldAlert className="w-7 h-7 text-red-500" />
            </div>
            <div className="flex-grow">
              <h3 className="font-title text-lg text-red-500 mb-1">
                {t('dashAlertTitle')}
              </h3>
              <p className="text-sm text-muted mb-4">
                {t('dashAlertDesc', { count: stats.unmitigatedCritical.length })}
              </p>
              <div className="space-y-2 mb-4">
                {stats.unmitigatedCritical.slice(0, 3).map((risk) => {
                  const dept = departments.find(d => d.id === risk.department_id);
                  return (
                    <div key={risk.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <Flame className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div className="flex-grow min-w-0">
                        <span className="font-subtitle text-sm truncate block">{risk.description?.substring(0, 80) || t('noDescription')}{risk.description?.length > 80 ? "..." : ""}</span>
                        <span className="text-xs text-muted">{dept?.name || "—"}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-subtitle border flex-shrink-0 ${getRiskLevelColor(risk.inherent_level)}`}>
                        {risk.inherent_level}
                      </span>
                    </div>
                  );
                })}
                {stats.unmitigatedCritical.length > 3 && (
                  <p className="text-xs text-red-400 pl-7">
                    +{stats.unmitigatedCritical.length - 3} {t('dashAlertMore')}
                  </p>
                )}
              </div>
              <Link to={createPageUrl("AllRisks")}>
                <Button size="sm" className="bg-red-500 text-white hover:bg-red-600">
                  {t('dashAlertAction')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - 5 cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-subtitle text-muted">{t('departments')}</CardTitle>
              <Building2 className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-title">{departments.length}</div>
            <p className="text-xs text-muted mt-1">{t('active')}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-subtitle text-muted">{t('totalRisks')}</CardTitle>
              <Activity className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-title">{stats.total}</div>
            <p className="text-xs text-muted mt-1">{t('identified')}</p>
          </CardContent>
        </Card>
        <Card className="glass border-red-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-subtitle text-muted">{t('intolerable')}</CardTitle>
              <Flame className="w-4 h-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-title text-red-500">{stats.intolerableCount}</div>
            <p className="text-xs text-red-400 mt-1">{t('dashCriticalPriority')}</p>
          </CardContent>
        </Card>
        <Card className="glass border-orange-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-subtitle text-muted">{t('high')}</CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-title text-orange-500">{stats.highCount}</div>
            <p className="text-xs text-orange-400 mt-1">{t('immediateAttention')}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-subtitle text-muted">{t('dashControlled')}</CardTitle>
              <Shield className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-title text-green-500">{stats.lowCount}</div>
            <p className="text-xs text-muted mt-1">{t('underControl')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mitigation Effectiveness + Critical % indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Critical Risk Percentage */}
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-subtitle text-sm text-muted">{t('dashCriticalPct')}</span>
              <CircleAlert className="w-5 h-5 text-red-500" />
            </div>
            <div className="relative flex items-center justify-center mb-3">
              <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--card-border)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={criticalPct > 30 ? "#ef4444" : criticalPct > 15 ? "#f97316" : "#22c55e"}
                  strokeWidth="8"
                  strokeDasharray={`${criticalPct * 2.51} ${251 - criticalPct * 2.51}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-title text-2xl">{criticalPct}%</span>
            </div>
            <p className="text-center text-xs text-muted">{t('dashCriticalPctDesc')}</p>
          </CardContent>
        </Card>

        {/* Mitigation Rate */}
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-subtitle text-sm text-muted">{t('dashMitigationRate')}</span>
              <TrendingDown className="w-5 h-5 text-green-500" />
            </div>
            <div className="relative flex items-center justify-center mb-3">
              <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--card-border)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={mitigationPct >= 60 ? "#22c55e" : mitigationPct >= 30 ? "#eab308" : "#ef4444"}
                  strokeWidth="8"
                  strokeDasharray={`${mitigationPct * 2.51} ${251 - mitigationPct * 2.51}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-title text-2xl">{mitigationPct}%</span>
            </div>
            <p className="text-center text-xs text-muted">{t('dashMitigationDesc')}</p>
          </CardContent>
        </Card>

        {/* Quick summary */}
        <Card className="glass">
          <CardContent className="p-6">
            <span className="font-subtitle text-sm text-muted">{t('dashQuickSummary')}</span>
            <div className="mt-4 space-y-3">
              {LEVEL_ORDER.filter(l => stats.byNormalized[l] > 0).map(level => (
                <div key={level} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: LEVEL_COLORS[level] }} />
                  <span className="text-sm flex-grow">{getLevelLabel(level)}</span>
                  <span className="font-subtitle text-sm">{stats.byNormalized[level]}</span>
                  <div className="w-20 h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(stats.byNormalized[level] / (stats.total || 1)) * 100}%`,
                        backgroundColor: LEVEL_COLORS[level]
                      }}
                    />
                  </div>
                </div>
              ))}
              {stats.total === 0 && (
                <p className="text-center text-muted text-sm py-4">{t('noRisksRegistered')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {stats.total > 0 && (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Pie Chart - Risk Distribution */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-subtitle">
                <BarChart3 className="w-5 h-5" />
                {t('riskDistribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-muted">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart - Risks by Department */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-subtitle">
                <Building2 className="w-5 h-5" />
                {t('dashRisksByDept')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deptBarData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptBarData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--card-border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--card-border)' }}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey={t('dashCritical')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={t('medium')} fill="#eab308" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={t('dashControlled')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-muted text-sm">
                  {t('noDepartmentsRegistered')}
                </div>
              )}
              {deptBarData.length > 0 && (
                <div className="flex justify-center gap-6 mt-2">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-xs text-muted">{t('dashCritical')}</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-yellow-500" /><span className="text-xs text-muted">{t('medium')}</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-xs text-muted">{t('dashControlled')}</span></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reminder Card for Risk Management */}
      {stats.criticalCount > 0 && (
        <Card className="glass border-2 border-accent/40">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-title text-base mb-2">{t('dashReminderTitle')}</h3>
                <ul className="space-y-2 text-sm text-muted">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    {t('dashReminderTip1', { count: stats.intolerableCount })}
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    {t('dashReminderTip2', { count: stats.highCount })}
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    {t('dashReminderTip3')}
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    {t('dashReminderTip4')}
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Risks Detail Table */}
      {stats.criticalRisks.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-subtitle">
                <Flame className="w-5 h-5 text-red-500" />
                {t('dashCriticalRisksTitle')}
              </CardTitle>
              <Link to={createPageUrl("AllRisks")}>
                <Button variant="ghost" size="sm" className="hover:glass text-accent">
                  {t('seeAll')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-muted">{t('tableDepartment')}</th>
                    <th className="text-left py-3 px-4 font-subtitle text-muted">{t('tableDescription')}</th>
                    <th className="text-center py-3 px-4 font-subtitle text-muted">{t('tableInherentLevel')}</th>
                    <th className="text-center py-3 px-4 font-subtitle text-muted">{t('tableResidualLevel')}</th>
                    <th className="text-center py-3 px-4 font-subtitle text-muted">{t('tableStrategy')}</th>
                    <th className="text-center py-3 px-4 font-subtitle text-muted">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.criticalRisks.slice(0, 8).map((risk) => {
                    const dept = departments.find(d => d.id === risk.department_id);
                    const residualStillCritical = risk.residual_level && isHighRisk(risk.residual_level);
                    return (
                      <tr key={risk.id} className={`border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)] ${residualStillCritical ? "bg-red-500/5" : ""}`}>
                        <td className="py-3 px-4">
                          <span className="font-subtitle">{dept?.name || "—"}</span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <span className="truncate block">{risk.description?.substring(0, 60) || "—"}{risk.description?.length > 60 ? "..." : ""}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-subtitle border ${getRiskLevelColor(risk.inherent_level)}`}>
                            {risk.inherent_level}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {risk.residual_level ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-subtitle border ${getRiskLevelColor(risk.residual_level)}`}>
                              {risk.residual_level}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs">{risk.risk_strategy || "—"}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link to={createPageUrl(`AddRisk?id=${risk.id}`)}>
                            <Button size="sm" variant="ghost" className="hover:glass text-accent">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Recent Departments */}
      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-subtitle">
                <Building2 className="w-5 h-5" />
                {t('recentDepartments')}
              </CardTitle>
              <Link to={createPageUrl("Departments")}>
                <Button variant="ghost" size="sm" className="hover:glass text-accent">
                  {t('seeAll')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departments.slice(0, 5).map((dept) => {
                const deptStats = stats.byDepartment[dept.id] || { total: 0, critical: 0 };
                return (
                  <div key={dept.id} className="flex items-center justify-between p-3 glass rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${deptStats.critical > 0 ? "bg-red-500/20" : "bg-accent text-accent-foreground"}`}>
                        <Building2 className={`w-5 h-5 ${deptStats.critical > 0 ? "text-red-500" : ""}`} />
                      </div>
                      <div>
                        <h3 className="font-subtitle text-sm">{dept.name}</h3>
                        <p className="text-xs text-muted">
                          {deptStats.total} {t('totalRisks').toLowerCase()}
                          {deptStats.critical > 0 && (
                            <span className="text-red-400 ml-2">{deptStats.critical} {t('dashCritical').toLowerCase()}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Link to={createPageUrl(`DepartmentRisks?id=${dept.id}`)}>
                      <Button size="sm" variant="ghost" className="hover:glass text-accent">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
              {departments.length === 0 && (
                <div className="text-center py-8 text-muted">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noDepartmentsRegistered')}</p>
                  <Link to={createPageUrl("AddDepartment")}>
                    <Button className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                      {t('createFirstDepartment')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* No-risk empty state OR Inherent vs Residual comparison */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-subtitle">
              <TrendingDown className="w-5 h-5" />
              {t('dashInherentVsResidual')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.total > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted mb-2">{t('dashInherentVsResidualDesc')}</p>
                {stats.criticalRisks.slice(0, 5).map((risk) => {
                  const inherentNorm = normalizeRiskLevel(risk.inherent_level);
                  const residualNorm = normalizeRiskLevel(risk.residual_level);
                  const improved = LEVEL_ORDER.indexOf(residualNorm) > LEVEL_ORDER.indexOf(inherentNorm);
                  return (
                    <div key={risk.id} className="flex items-center gap-3 p-3 glass rounded-xl">
                      <div className="flex items-center gap-2 flex-grow min-w-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${getRiskLevelColor(risk.inherent_level)}`}>
                          {risk.inherent_level}
                        </span>
                        <ArrowRight className={`w-4 h-4 flex-shrink-0 ${improved ? "text-green-500" : "text-red-400"}`} />
                        <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${getRiskLevelColor(risk.residual_level || risk.inherent_level)}`}>
                          {risk.residual_level || "—"}
                        </span>
                      </div>
                      <span className="text-xs text-muted truncate max-w-[120px]" title={risk.description}>
                        {risk.description?.substring(0, 25) || "—"}{risk.description?.length > 25 ? "..." : ""}
                      </span>
                    </div>
                  );
                })}
                {stats.criticalRisks.length === 0 && (
                  <div className="text-center py-8 text-muted">
                    <Shield className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
                    <p className="text-sm">{t('dashNoCritical')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('noRisksRegistered')}</p>
                <Link to={createPageUrl("AddRisk")}>
                  <Button className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                    {t('registerFirstRisk')}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
