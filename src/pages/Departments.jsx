
import React, { useState, useEffect } from "react";
import { Department } from "@/api/entities";
import { Risk } from "@/api/entities";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  Plus,
  Eye,
  AlertTriangle,
  Edit,
  MoreVertical
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/components/LanguageContext';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [departmentsList, risksList] = await Promise.all([
        Department.list("-created_date"),
        Risk.list()
      ]);
      setDepartments(departmentsList);
      setRisks(risksList);
    } catch (error) {
      console.error("Error loading departments:", error);
    }
    setLoading(false);
  };

  const getDepartmentRisks = (departmentId) => {
    return risks.filter(risk => risk.department_id === departmentId);
  };

  const getRiskLevelStats = (departmentId) => {
    const departmentRisks = getDepartmentRisks(departmentId);
    const stats = departmentRisks.reduce((acc, risk) => {
      const level = risk.residual_level || risk.inherent_level || t('unclassified');
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    
    const highRisks = (stats[t('high')] || 0) + (stats[t('veryHigh')] || 0);
    return { total: departmentRisks.length, highRisks };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse">
              <div className="w-12 h-12 bg-gray-500/20 rounded-xl mb-4"></div>
              <div className="w-32 h-6 bg-gray-500/20 rounded mb-2"></div>
              <div className="w-24 h-4 bg-gray-500/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-title mb-2">{t('departmentsTitle')}</h1>
          <p className="text-muted">
            {t('departmentsSubtitle')}
          </p>
        </div>
        <Link to={createPageUrl("AddDepartment")}>
          <Button variant="outline" className="glass hover:border-accent">
            <Plus className="w-4 h-4 mr-2" />
            {t('newDepartment')}
          </Button>
        </Link>
      </div>

      {/* Departments Grid */}
      {departments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((department) => {
            const riskStats = getRiskLevelStats(department.id);
            return (
              <Card key={department.id} className="glass hover:border-accent transition-all duration-300 group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 glass rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-foreground" />
                      </div>
                      <div>
                        <CardTitle className="font-subtitle text-lg">{department.name}</CardTitle>
                        {department.description && (
                          <p className="text-sm text-muted mt-1">{department.description}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted hover:bg-white/10 dark:hover:bg-black/10">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="glass">
                        <DropdownMenuItem 
                          onClick={() => navigate(createPageUrl(`AddDepartment?id=${department.id}`))}
                          className="hover:bg-white/10 dark:hover:bg-black/10 cursor-pointer"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          {t('edit')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 glass rounded-xl">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-muted" />
                      <span className="text-sm">{t('totalRisksLabel')}</span>
                    </div>
                    <span className="font-subtitle">{riskStats.total}</span>
                  </div>
                  
                  {riskStats.highRisks > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-500/20 border border-red-400/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-sm">{t('highRisksLabel')}</span>
                      </div>
                      <span className="font-subtitle text-red-400">{riskStats.highRisks}</span>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Link to={createPageUrl(`DepartmentRisks?id=${department.id}`)} className="flex-1">
                      <Button variant="outline" className="w-full glass hover:border-accent">
                        <Eye className="w-4 h-4 mr-2" />
                        {t('viewRisks')}
                      </Button>
                    </Link>
                    <Link to={createPageUrl(`AddRisk?department=${department.id}`)}>
                      <Button size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass">
          <CardContent className="text-center py-12 text-muted">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-subtitle mb-2">{t('noDepartmentsFound')}</h3>
            <p className="mb-6">
              {t('noDepartmentsFoundSubtitle')}
            </p>
            <Link to={createPageUrl("AddDepartment")}>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                {t('createFirstDepartment')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
