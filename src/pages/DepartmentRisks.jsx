
import React, { useState, useEffect, useCallback } from "react";
import { Department } from "@/api/entities";
import { Risk } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Filter,
  Search,
  Eye,
  Edit
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from '@/components/LanguageContext';

export default function DepartmentRisks() {
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [risks, setRisks] = useState([]);
  const [filteredRisks, setFilteredRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [threatTypeFilter, setThreatTypeFilter] = useState("all");
  const { t } = useLanguage();

  const loadData = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const departmentId = urlParams.get('id');
      if (!departmentId) { navigate(createPageUrl("Departments")); return; }

      const [departmentsList, risksList] = await Promise.all([
        Department.list(),
        Risk.filter({ department_id: departmentId }, "-created_date")
      ]);

      const foundDepartment = departmentsList.find(d => d.id === departmentId);
      if (!foundDepartment) { navigate(createPageUrl("Departments")); return; }

      setDepartment(foundDepartment);
      setRisks(risksList);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const filterRisks = useCallback(() => {
    let filtered = risks.filter(risk =>
      (searchTerm === "" || risk.description.toLowerCase().includes(searchTerm.toLowerCase())) && // Removed risk.area from search
      (riskLevelFilter === "all" || (risk.residual_level || risk.inherent_level) === riskLevelFilter) &&
      (threatTypeFilter === "all" || risk.threat_type === threatTypeFilter)
    );
    setFilteredRisks(filtered);
  }, [risks, searchTerm, riskLevelFilter, threatTypeFilter]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { filterRisks(); }, [filterRisks]);

  const getRiskLevelColor = (level) => {
    const colors = {
      [t('intolerable')]: 'bg-red-500 text-[#121212] dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/30',
      [t('high')]: 'bg-orange-500 text-[#121212] dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/30',
      [t('medium')]: 'bg-amber-500 text-[#121212] dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30',
      [t('low')]: 'bg-blue-500 text-[#121212] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30',
      [t('tolerable')]: 'bg-green-500 text-[#121212] dark:bg-green-500/20 dark:text-green-300 dark:border-green-400/30'
    };
    return colors[level] || 'glass';
  };
  
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="glass rounded-3xl p-8"><div className="w-48 h-8 bg-gray-500/20 rounded mb-4"></div><div className="w-32 h-4 bg-gray-500/20 rounded"></div></div>
      </div>
    );
  }

  if (!department) return null;

  const RISK_LEVELS_OPTIONS = [t('intolerable'), t('high'), t('medium'), t('low'), t('tolerable')];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Departments"))} className="glass">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Building2 className="w-8 h-8" />
            <h1 className="text-3xl font-title">{department.name}</h1>
          </div>
          <p className="text-muted">{department.description || t('departmentRiskManagement')}</p>
        </div>
        <Button onClick={() => navigate(createPageUrl(`AddRisk?department=${department.id}`))} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          {t('newRisk')}
        </Button>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="font-subtitle flex items-center gap-2"><Filter className="w-5 h-5" />{t('filtersAndSearch')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <Input placeholder={t('searchRisksPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 input-glass" />
            </div>
            <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
              <SelectTrigger className="input-glass"><SelectValue placeholder={t('riskLevelLabel')} /></SelectTrigger>
              <SelectContent className="glass">
                <SelectItem value="all">{t('allLevels')}</SelectItem>
                {RISK_LEVELS_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={threatTypeFilter} onValueChange={setThreatTypeFilter}>
              <SelectTrigger className="input-glass"><SelectValue placeholder={t('threatTypeLabel')} /></SelectTrigger>
              <SelectContent className="glass">
                <SelectItem value="all">{t('allThreats')}</SelectItem>
                <SelectItem value="Interna">{t('threatInternal')}</SelectItem>
                <SelectItem value="Externa">{t('threatExternal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="font-subtitle">{t('riskList', { count: filteredRisks.length })}</CardTitle></CardHeader>
        <CardContent>
          {filteredRisks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="table-glass">
                <TableHeader>
                  <TableRow className="border-card-border hover:bg-transparent">
                    <TableHead>{t('tableDescription')}</TableHead>
                    <TableHead>{t('tableType')}</TableHead>
                    <TableHead>{t('tableInherentLevel')}</TableHead>
                    <TableHead>{t('tableResidualLevel')}</TableHead>
                    <TableHead>{t('tableStrategy')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.map((risk) => (
                    <TableRow key={risk.id} className="border-card-border hover:bg-gray-500/5">
                      <TableCell className="max-w-xs truncate text-muted">{risk.description}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${risk.threat_type === 'Interna' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                          {t(risk.threat_type === 'Interna' ? 'threatInternal' : 'threatExternal')}
                        </span>
                      </TableCell>
                      <TableCell>{risk.inherent_level && <span className={`px-2 py-1 rounded-full text-xs border ${getRiskLevelColor(risk.inherent_level)}`}>{risk.inherent_level}</span>}</TableCell>
                      <TableCell>{risk.residual_level && <span className={`px-2 py-1 rounded-full text-xs border ${getRiskLevelColor(risk.residual_level)}`}>{risk.residual_level}</span>}</TableCell>
                      <TableCell className="text-muted">{risk.risk_strategy ? t(`strategy${risk.risk_strategy}`) : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-muted hover:glass" onClick={() => navigate(createPageUrl(`AddRisk?id=${risk.id}`))}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <h3 className="text-xl font-subtitle mb-2">{t('noRisksFound')}</h3>
              <p className="mb-6">{risks.length === 0 ? t('noRisksInDepartment') : t('noRisksMatchFilters')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
