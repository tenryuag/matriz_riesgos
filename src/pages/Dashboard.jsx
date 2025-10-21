
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
  Shield,
  Plus,
  Eye,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

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
    const colors = {
      [t('intolerable')]:
        'bg-red-300 text-red-900 border border-red-500 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/30',
      [t('high')]:
        'bg-orange-300 text-orange-900 border border-orange-500 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/30',
      [t('medium')]:
        'bg-amber-300 text-amber-900 border border-amber-500 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30',
      [t('low')]:
        'bg-blue-300 text-blue-900 border border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30',
      [t('tolerable')]:
        'bg-green-300 text-green-900 border border-green-500 dark:bg-green-500/20 dark:text-green-300 dark:border-green-400/30',
    };
    return colors[level] || 'glass';
  };

  const getRiskStats = () => {
    const total = risks.length;
    const byLevel = risks.reduce((acc, risk) => {
      const level = risk.residual_level || risk.inherent_level || t('unclassified');
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    return { total, byLevel };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse">
              <div className="w-12 h-12 bg-gray-500/20 rounded-xl mb-4"></div>
              <div className="w-24 h-4 bg-gray-500/20 rounded mb-2"></div>
              <div className="w-16 h-6 bg-gray-500/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = getRiskStats();

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-subtitle text-muted">
                {t('departments')}
              </CardTitle>
              <Building2 className="w-5 h-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-title">{departments.length}</div>
            <p className="text-xs text-muted mt-1">{t('active')}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-subtitle text-muted">
                {t('totalRisks')}
              </CardTitle>
              <AlertTriangle className="w-5 h-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-title">{stats.total}</div>
            <p className="text-xs text-muted mt-1">{t('identified')}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-subtitle text-muted">
                {t('highRisks')}
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-title text-red-500">
              {(stats.byLevel[t('high')] || 0) + (stats.byLevel[t('intolerable')] || 0)}
            </div>
            <p className="text-xs text-muted mt-1">{t('immediateAttention')}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-subtitle text-muted">
                {t('lowRisks')}
              </CardTitle>
              <Shield className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-title text-green-600">
              {(stats.byLevel[t('low')] || 0) + (stats.byLevel[t('tolerable')] || 0)}
            </div>
            <p className="text-xs text-muted mt-1">{t('underControl')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
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
              {departments.slice(0, 5).map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-3 glass rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent text-accent-foreground rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-subtitle text-sm">{dept.name}</h3>
                      <p className="text-sm text-muted">{dept.description || t('noDescription')}</p>
                    </div>
                  </div>
                  <Link to={createPageUrl(`DepartmentRisks?id=${dept.id}`)}>
                    <Button size="sm" variant="ghost" className="hover:glass text-accent">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              ))}
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

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-subtitle">
              <BarChart3 className="w-5 h-5" />
              {t('riskDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.byLevel).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs border ${getRiskLevelColor(level)}`}>
                    {level}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 glass rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${(count / (stats.total || 1)) * 100}%` }} />
                    </div>
                    <span className="font-subtitle text-sm w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {stats.total === 0 && (
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
