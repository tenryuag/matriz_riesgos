
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Department } from "@/api/entities";
import { Risk } from "@/api/entities";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertTriangle,
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
  Activity,
  Layers,
  HelpCircle,
  CircleDashed
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';
import { normalizeRiskLevel, isHighRisk, isLowRisk, getRiskLevelColorClasses } from '@/lib/utils';
import { PERSPECTIVES } from "@/config/perspectives";
import { countByPerspective, migrationProgress, isUnscored, perspectiveOf, UNASSIGNED } from "@/lib/perspectiveView";
import { iconForPerspective } from "@/components/perspectives/perspectiveIcons";
import PerspectiveBadge from "@/components/perspectives/PerspectiveBadge";
import MigrationBanner from "@/components/perspectives/MigrationBanner";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
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

// Parte una etiqueta en renglones de hasta `max` caracteres sin cortar palabras.
const wrapLabel = (text, max = 13) => {
  const lines = [];
  let current = "";
  for (const word of String(text).split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

// Etiqueta del eje de categorías en varios renglones (nombres largos de perspectiva).
const CategoryTick = ({ x = 0, y = 0, payload }) => {
  const lines = wrapLabel(payload?.value ?? "");
  const lineHeight = 12;
  const firstDy = 4 - ((lines.length - 1) * lineHeight) / 2;
  return (
    <text x={x} y={y} textAnchor="end" fill="var(--foreground-muted)" fontSize={11}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? firstDy : lineHeight}>{line}</tspan>
      ))}
    </text>
  );
};
CategoryTick.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  payload: PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) }),
};

export default function Dashboard() {
  const [departments, setDepartments] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [departmentsList, risksList] = await Promise.all([
        Department.list("-created_date"),
        Risk.list("-created_date")
      ]);
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
      const normalized = normalizeRiskLevel(risk.residual_level);
      byNormalized[normalized] = (byNormalized[normalized] || 0) + 1;
    });

    const criticalRisks = risks.filter(r => isHighRisk(r.residual_level));
    const lowRisks = risks.filter(r => isLowRisk(r.residual_level));
    const mediumCount = byNormalized.MEDIUM || 0;

    const unmitigatedCritical = criticalRisks;

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
      improved
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

  // Perspectivas: progreso de migración y conteos (crítico = inherente >= 13).
  const progress = migrationProgress(risks);
  const counts = countByPerspective(risks);
  const unscoredCount = risks.filter(isUnscored).length;
  const perspBarRow = (name, bucket) => ({
    name,
    [t('perspCritical')]: bucket.critical,
    [t('perspOthers')]: bucket.total - bucket.critical,
  });
  const perspBarData = [
    ...PERSPECTIVES.map(p => perspBarRow(p.label, counts[p.key])),
    ...(counts[UNASSIGNED].total > 0 ? [perspBarRow(t('perspUnassigned'), counts[UNASSIGNED])] : []),
  ];

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

  CustomTooltip.propTypes = { active: PropTypes.bool, payload: PropTypes.array };

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
  BarTooltip.propTypes = { active: PropTypes.bool, payload: PropTypes.array, label: PropTypes.node };

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
            <Link to={createPageUrl("Perspectives")} className="w-full md:w-auto">
              <Button variant="outline" className="w-full glass hover:border-accent">
                <Layers className="w-4 h-4 mr-2" />
                {t('perspectives')}
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

      {/* Aviso de migración: riesgos sin perspectiva */}
      <MigrationBanner count={progress.unassigned} />

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
                        <span className="flex items-center gap-2 text-xs text-muted">
                          <PerspectiveBadge perspectiveKey={perspectiveOf(risk)} size="sm" />
                          <span className="truncate">{dept?.name || "—"}</span>
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-subtitle border flex-shrink-0 ${getRiskLevelColor(risk.residual_level)}`}>
                        {risk.residual_level}
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
        <Card className={`glass ${unscoredCount > 0 ? "border-amber-500/30" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-subtitle text-muted">{t('perspUnscored')}</CardTitle>
              <HelpCircle className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-title ${unscoredCount > 0 ? "text-amber-500" : ""}`}>{unscoredCount}</div>
            <p className="text-xs text-muted mt-1">{t('dashUnscoredHint')}</p>
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

          {/* Bar Chart - Risks by Perspective */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-subtitle">
                <Layers className="w-5 h-5" />
                {t('dashByPerspective')}
              </CardTitle>
              <p className="text-xs text-muted">{t('perspCriticalHint')}</p>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {/* Barras horizontales: los nombres de las perspectivas son largos
                      y en el eje X se encimaban (sobre todo en celular). */}
                  <BarChart data={perspBarData} layout="vertical" barGap={2} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--card-border)' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={104}
                      interval={0}
                      tick={<CategoryTick />}
                      axisLine={{ stroke: 'var(--card-border)' }}
                      tickLine={false}
                    />
                    <Tooltip content={<BarTooltip />} />
                    <Bar dataKey={t('perspCritical')} fill="#ef4444" radius={[0, 4, 4, 0]} />
                    <Bar dataKey={t('perspOthers')} fill="#DDBF5A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-xs text-muted">{t('perspCritical')}</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#DDBF5A" }} /><span className="text-xs text-muted">{t('perspOthers')}</span></div>
              </div>
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
                    <th className="text-left py-3 px-4 font-subtitle text-muted">{t('tablePerspective')}</th>
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
                          <PerspectiveBadge perspectiveKey={perspectiveOf(risk)} />
                          {dept?.name && <div className="text-xs text-muted mt-1">{dept.name}</div>}
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

      {/* Bottom Row: Perspective Summary */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-subtitle">
              <Layers className="w-5 h-5" />
              {t('dashPerspectiveSummary')}
            </CardTitle>
            <Link to={createPageUrl("Perspectives")}>
              <Button variant="ghost" size="sm" className="hover:glass text-accent">
                {t('seeAll')}
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted">{t('perspCriticalHint')}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PERSPECTIVES.map((p) => {
              const Icon = iconForPerspective(p.key);
              const bucket = counts[p.key];
              return (
                <div key={p.key} className="flex items-center justify-between gap-3 p-3 glass rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${p.colorClasses.bg}`}>
                      <Icon className={`w-5 h-5 ${p.colorClasses.text}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-subtitle text-sm">{p.label}</h3>
                      <p className="text-xs text-muted">
                        {t('perspTotalRisks', { count: bucket.total })}
                        {bucket.critical > 0 && (
                          <span className="text-red-400 ml-2">{t('perspCriticalCount', { count: bucket.critical })}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link to={createPageUrl(`PerspectiveRisks?key=${p.key}`)}>
                    <Button size="sm" variant="ghost" className="hover:glass text-accent">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              );
            })}
            {counts[UNASSIGNED].total > 0 && (
              <div className="flex items-center justify-between gap-3 p-3 glass rounded-xl border-dashed">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-500/15">
                    <CircleDashed className="w-5 h-5 text-muted" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-subtitle text-sm">{t('perspUnassigned')}</h3>
                    <p className="text-xs text-muted">
                      {t('perspTotalRisks', { count: counts[UNASSIGNED].total })}
                      {counts[UNASSIGNED].critical > 0 && (
                        <span className="text-red-400 ml-2">{t('perspCriticalCount', { count: counts[UNASSIGNED].critical })}</span>
                      )}
                    </p>
                  </div>
                </div>
                <Link to={createPageUrl("PerspectiveMigration")}>
                  <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {t('dashAssignNow')}
                  </Button>
                </Link>
              </div>
            )}
            {risks.length === 0 && (
              <div className="text-center py-8 text-muted">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('noRisksRegistered')}</p>
                <Link to={createPageUrl("AddRisk")}>
                  <Button className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('registerFirstRisk')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
