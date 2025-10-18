
import React, { useState, useEffect, useCallback } from "react";
import { Department } from "@/api/entities";
import { Risk } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Filter, Search, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from '@/components/LanguageContext';

export default function AllRisks() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [risks, setRisks] = useState([]);
  const [filteredRisks, setFilteredRisks] = useState([]);
  const [selectedRisks, setSelectedRisks] = new useState(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [departmentMap, setDepartmentMap] = useState({});
  const { t } = useLanguage();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [departmentsList, risksList] = await Promise.all([
        Department.list("-created_date"),
        Risk.list("-created_date")
      ]);
      const deptMap = departmentsList.reduce((acc, dept) => { acc[dept.id] = dept.name; return acc; }, {});
      setDepartments(departmentsList);
      setRisks(risksList);
      setDepartmentMap(deptMap);
      setSelectedRisks(new Set());
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [setSelectedRisks]);

  const filterRisks = useCallback(() => {
    let filtered = risks.filter(risk =>
      (departmentFilter === "all" || risk.department_id === departmentFilter) &&
      (searchTerm === "" || risk.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (riskLevelFilter === "all" || (risk.residual_level || risk.inherent_level) === riskLevelFilter)
    );
    setFilteredRisks(filtered);
    const visibleRiskIds = new Set(filtered.map(risk => risk.id));
    setSelectedRisks(prev => new Set([...prev].filter(id => visibleRiskIds.has(id))));
  }, [risks, searchTerm, riskLevelFilter, departmentFilter, setSelectedRisks]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { filterRisks(); }, [filterRisks]);

  const handleSelectAll = (checked) => setSelectedRisks(checked ? new Set(filteredRisks.map(r => r.id)) : new Set());

  const handleSelectRisk = (riskId, checked) => {
    const newSelected = new Set(selectedRisks);
    checked ? newSelected.add(riskId) : newSelected.delete(riskId);
    setSelectedRisks(newSelected);
  };
  
  const confirmAndDelete = async (riskIds) => {
    const count = riskIds.size || (Array.isArray(riskIds) ? riskIds.length : 1);
    const riskIdArray = Array.isArray(riskIds) ? riskIds : [...riskIds];
    
    if (count === 0) return;
    if (!window.confirm(t('confirmDelete', { count }))) return;

    setDeleting(true);
    try {
      await Promise.all(riskIdArray.map(id => Risk.delete(id)));
      await loadData();
    } catch (error) {
      console.error("Error deleting risks:", error);
      alert(t('errorDeleting'));
    } finally {
      setDeleting(false);
    }
  };

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
  
  const getProbabilityColor = (probability) => {
    // Assuming 't' translates these keys to the Spanish strings "Remoto (0-20%)", etc.
    const colors = {
      [t("Remoto (0-20%)")]: 'bg-green-500/20 text-green-300 border-green-400/30',
      [t("Improbable (21-40%)")]: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
      [t("Ocasional (41-60%)")]: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      [t("Probable (61-80%)")]: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
      [t("Frecuente (81-100%)")]: 'bg-red-500/20 text-red-300 border-red-400/30'
    };
    return colors[probability] || 'border-transparent text-muted';
  };

  const getImpactColor = (impact) => {
    // Assuming 't' translates these keys to the Spanish strings "Insignificante", etc.
    const colors = {
      [t("Insignificante")]: 'bg-green-500/20 text-green-300 border-green-400/30',
      [t("Menor")]: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
      [t("Crítico")]: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      [t("Mayor")]: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
      [t("Catastrófico")]: 'bg-red-500/20 text-red-300 border-red-400/30'
    };
    return colors[impact] || 'border-transparent text-muted';
  };
  
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="glass rounded-3xl p-8"><div className="w-48 h-8 bg-gray-500/20 rounded mb-4"></div><div className="w-full h-64 bg-gray-500/10 rounded-xl mt-6"></div></div>
      </div>
    );
  }

  const allFilteredSelected = filteredRisks.length > 0 && selectedRisks.size === filteredRisks.length;
  const RISK_LEVELS_OPTIONS = [t('intolerable'), t('high'), t('medium'), t('low'), t('tolerable')];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-title mb-2">{t('allRisksTitle')}</h1>
          <p className="text-muted">{t('allRisksSubtitle')}</p>
        </div>
        <div className="flex gap-3">
          {selectedRisks.size === 1 && (
            <Button 
              onClick={() => {
                const selectedRiskId = [...selectedRisks][0];
                navigate(createPageUrl(`AddRisk?id=${selectedRiskId}`));
              }} 
              disabled={deleting} 
              variant="outline" 
              className="glass hover:border-accent"
            >
              <Edit className="w-4 h-4 mr-2" />
              {t('edit')}
            </Button>
          )}
          {selectedRisks.size > 0 && (
            <Button onClick={() => confirmAndDelete(selectedRisks)} disabled={deleting} variant="destructive" className="bg-red-500/80 hover:bg-red-500/90 text-white">
              {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? t('deleting') : t('deleteSelected', { count: selectedRisks.size })}
            </Button>
          )}
          <Button onClick={() => navigate(createPageUrl(`AddRisk`))} variant="outline" className="glass hover:border-accent" disabled={deleting}>
            <Plus className="w-4 h-4 mr-2" />
            {t('newRisk')}
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="font-subtitle flex items-center gap-2"><Filter className="w-5 h-5" />{t('filtersAndSearch')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <Input placeholder={t('searchAllPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 input-glass" disabled={deleting} />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={deleting}>
              <SelectTrigger className="input-glass"><SelectValue placeholder={t('departmentLabel')} /></SelectTrigger>
              <SelectContent className="glass">
                <SelectItem value="all">{t('allDepartments')}</SelectItem>
                {departments.map((dept) => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter} disabled={deleting}>
              <SelectTrigger className="input-glass"><SelectValue placeholder={t('riskLevelLabel')} /></SelectTrigger>
              <SelectContent className="glass">
                <SelectItem value="all">{t('allLevels')}</SelectItem>
                {RISK_LEVELS_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <Card className="glass">
        <CardHeader><div className="text-sm text-muted">{t('showingRisks', { count: filteredRisks.length, total: risks.length })}</div></CardHeader>
        <CardContent>
          {filteredRisks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-max text-sm border-t border-b border-card-border table-glass">
                <TableHeader>
                  <TableRow className="border-card-border hover:bg-transparent">
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-l border-r border-card-border w-12">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={handleSelectAll} disabled={deleting} />
                    </TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">
                      {t('tableDepartment')}
                    </TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableThreatType')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableDescription')}</TableHead>
                    <TableHead colSpan={3} className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('inherentRiskEval')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableHandling')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableMitigant1')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableImpact1')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableMitigant2')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableImpact2')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableMitigant3')}</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-accent font-subtitle text-xs uppercase tracking-wider p-2 border-r border-card-border">{t('tableImpact3')}</TableHead>
                    <TableHead colSpan={3} className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('residualRisk')}</TableHead>
                  </TableRow>
                  <TableRow className="border-card-border hover:bg-transparent">
                    <TableHead className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('tableInherentProb')}</TableHead>
                    <TableHead className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('tableInherentImp')}</TableHead>
                    <TableHead className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('tableInherentLvl')}</TableHead>
                    <TableHead className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('tableResidualProb')}</TableHead>
                    <TableHead className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('tableResidualImp')}</TableHead>
                    <TableHead className="text-center border-r border-card-border text-accent font-subtitle text-xs uppercase tracking-wider p-2">{t('tableResidualLvl')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.map((risk) => (
                    <TableRow key={risk.id} className={`border-card-border hover:bg-gray-500/5 ${deleting && selectedRisks.has(risk.id) ? 'opacity-50' : ''}`}>
                      <TableCell className="align-top text-center border-l border-r border-card-border">
                        <Checkbox checked={selectedRisks.has(risk.id)} onCheckedChange={(c) => handleSelectRisk(risk.id, c)} disabled={deleting} />
                      </TableCell>
                      <TableCell className="align-top max-w-[150px] whitespace-normal border-r border-card-border">
                        <span className="font-subtitle">{departmentMap[risk.department_id] || 'N/A'}</span>
                      </TableCell>
                      <TableCell className="text-muted align-top border-r border-card-border">{risk.threat_type ? t(risk.threat_type === 'Interna' ? 'threatInternal' : 'threatExternal') : ''}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.description}</TableCell>
                      <TableCell className="text-center border-r border-card-border align-top">
                        {risk.inherent_probability && <span className={`px-2 py-1 rounded-full text-xs border ${getProbabilityColor(t(risk.inherent_probability))}`}>{t(risk.inherent_probability)}</span>}
                      </TableCell>
                      <TableCell className="text-center align-top border-r border-card-border">
                        {risk.inherent_impact && <span className={`px-2 py-1 rounded-full text-xs border ${getImpactColor(t(risk.inherent_impact))}`}>{t(risk.inherent_impact)}</span>}
                      </TableCell>
                      <TableCell className="text-center border-r border-card-border align-top">{risk.inherent_level && <span className={`px-2 py-1 rounded-full text-xs border-transparent ${getRiskLevelColor(risk.inherent_level)}`}>{risk.inherent_level}</span>}</TableCell>
                      <TableCell className="text-muted align-top border-r border-card-border">{risk.risk_strategy ? t(`strategy${risk.risk_strategy}`) : ''}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.mitigant_1}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.mitigant_impact_1}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.mitigant_2}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.mitigant_impact_2}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.mitigant_3}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted align-top border-r border-card-border">{risk.mitigant_impact_3}</TableCell>
                      <TableCell className="text-center border-r border-card-border align-top">
                        {risk.residual_probability && <span className={`px-2 py-1 rounded-full text-xs border ${getProbabilityColor(t(risk.residual_probability))}`}>{t(risk.residual_probability)}</span>}
                      </TableCell>
                      <TableCell className="text-center align-top border-r border-card-border">
                        {risk.residual_impact && <span className={`px-2 py-1 rounded-full text-xs border ${getImpactColor(t(risk.residual_impact))}`}>{t(risk.residual_impact)}</span>}
                      </TableCell>
                      <TableCell className="text-center border-r border-card-border align-top">{risk.residual_level && <span className={`px-2 py-1 rounded-full text-xs border-transparent ${getRiskLevelColor(risk.residual_level)}`}>{risk.residual_level}</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <h3 className="text-xl font-subtitle mb-2">{t('noRisksFound')}</h3>
              <p>{risks.length === 0 ? t('noRisksRegistered') : t('noRisksMatchFilters')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
