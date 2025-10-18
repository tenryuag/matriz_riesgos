
import React, { useState, useEffect, useCallback } from "react";
import { Risk } from "@/api/entities";
import { Department } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AlertTriangle, ArrowLeft, Save, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from '@/components/LanguageContext';

const PROBABILITY_LEVELS = ["Remoto (0-20%)", "Improbable (21-40%)", "Ocasional (41-60%)", "Probable (61-80%)", "Frecuente (81-100%)"];
const IMPACT_LEVELS = ["Insignificante", "Menor", "Crítico", "Mayor", "Catastrófico"];
const STRATEGY_LEVELS = ["Aceptar", "Reducir", "Transferir", "Evitar"];
const MITIGANT_IMPACT_OPTIONS = ["Mitiga la probabilidad", "Mitiga el impacto", "Mitiga la probabilidad e impacto"];

export default function AddRisk() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [editingRisk, setEditingRisk] = useState(null);
  const [formData, setFormData] = useState({
    department_id: "", threat_type: "", description: "", // Removed 'area' field
    inherent_probability: "", inherent_impact: "", inherent_level: "",
    risk_strategy: "", mitigant_1: "", mitigant_impact_1: "",
    mitigant_2: "", mitigant_impact_2: "", mitigant_3: "", mitigant_impact_3: "",
    residual_probability: "", residual_impact: "", residual_level: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const loadData = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const riskId = urlParams.get('id');
      const departmentId = urlParams.get('department');
      const departmentsList = await Department.list("-created_date");
      setDepartments(departmentsList);

      if (riskId) {
        const riskList = await Risk.filter({ id: riskId });
        if (riskList.length > 0) {
          const riskToEdit = riskList[0];
          setEditingRisk(riskToEdit);
          // Ensure 'area' is not set if it doesn't exist in riskToEdit
          const { area, ...restOfRisk } = riskToEdit;
          setFormData({ ...restOfRisk });
        } else {
          setError(t('riskNotFound'));
        }
      } else if (departmentId) {
        setFormData(prev => ({ ...prev, department_id: departmentId }));
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError(t('dataLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  const calculateRiskLevel = (probability, impact) => {
    if (!probability || !impact) return "";
    const probValues = { [PROBABILITY_LEVELS[0]]: 1, [PROBABILITY_LEVELS[1]]: 2, [PROBABILITY_LEVELS[2]]: 3, [PROBABILITY_LEVELS[3]]: 4, [PROBABILITY_LEVELS[4]]: 5 };
    const impactValues = { [IMPACT_LEVELS[0]]: 1, [IMPACT_LEVELS[1]]: 2, [IMPACT_LEVELS[2]]: 3, [IMPACT_LEVELS[3]]: 4, [IMPACT_LEVELS[4]]: 5 };
    const score = (probValues[probability] || 0) * (impactValues[impact] || 0);
    if (score <= 4) return t('tolerable');
    if (score <= 8) return t('low');
    if (score <= 12) return t('medium');
    if (score <= 16) return t('high');
    return t('intolerable');
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "inherent_probability" || field === "inherent_impact") {
        updated.inherent_level = calculateRiskLevel(field === "inherent_probability" ? value : prev.inherent_probability, field === "inherent_impact" ? value : prev.inherent_impact);
      }
      if (field === "residual_probability" || field === "residual_impact") {
        updated.residual_level = calculateRiskLevel(field === "residual_probability" ? value : prev.residual_probability, field === "residual_impact" ? value : prev.residual_impact);
      }
      return updated;
    });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = ['department_id', 'threat_type', 'description']; // Removed 'area' from required fields
    if (requiredFields.some(field => !formData[field]?.trim())) {
      setError(t('errorRequiredFields'));
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (editingRisk) {
        await Risk.update(editingRisk.id, formData);
      } else {
        await Risk.create(formData);
      }
      navigate(createPageUrl(`DepartmentRisks?id=${formData.department_id}`));
    } catch (error) {
      setError(t('errorSavingRisk'));
      console.error("Error saving risk:", error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="glass">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-title">{editingRisk ? t('editRiskTitle') : t('addRiskTitle')}</h1>
          <p className="text-muted">{editingRisk ? t('editRiskSubtitle') : t('addRiskSubtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert variant="destructive" className="bg-red-500/20 border-red-400/30 text-red-200"><AlertDescription>{error}</AlertDescription></Alert>}

        <Card className="glass">
          <CardHeader><CardTitle className="font-subtitle flex items-center gap-2"><AlertTriangle className="w-5 h-5" />{t('riskInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"> {/* This div no longer needs to be part of a grid */}
              <Label>{t('departmentLabel')}</Label>
              <Select value={formData.department_id} onValueChange={(value) => handleChange("department_id", value)} disabled={loading}>
                <SelectTrigger className="input-glass"><SelectValue placeholder={t('departmentPlaceholder')} /></SelectTrigger>
                <SelectContent className="glass">{departments.map((dept) => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Removed the 'area' input field */}
            <div className="space-y-2">
              <Label>{t('threatTypeLabel')}</Label>
              <Select value={formData.threat_type} onValueChange={(value) => handleChange("threat_type", value)} disabled={loading}>
                <SelectTrigger className="input-glass"><SelectValue placeholder={t('threatTypePlaceholder')} /></SelectTrigger>
                <SelectContent className="glass"><SelectItem value="Interna">{t('threatInternal')}</SelectItem><SelectItem value="Externa">{t('threatExternal')}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('riskDescriptionLabel')}</Label>
              <Textarea value={formData.description} onChange={(e) => handleChange("description", e.target.value)} placeholder={t('riskDescriptionPlaceholder')} rows={3} className="input-glass resize-none" disabled={loading} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="font-subtitle flex items-center gap-2"><Calculator className="w-5 h-5" />{t('inherentRiskEval')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('inherentProbability')}</Label>
                <Select value={formData.inherent_probability} onValueChange={(v) => handleChange("inherent_probability", v)} disabled={loading}>
                  <SelectTrigger className="input-glass"><SelectValue placeholder={t('selectProbability')} /></SelectTrigger>
                  <SelectContent className="glass">{PROBABILITY_LEVELS.map(l => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('inherentImpact')}</Label>
                <Select value={formData.inherent_impact} onValueChange={(v) => handleChange("inherent_impact", v)} disabled={loading}>
                  <SelectTrigger className="input-glass"><SelectValue placeholder={t('selectImpact')} /></SelectTrigger>
                  <SelectContent className="glass">{IMPACT_LEVELS.map(l => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {formData.inherent_level && <div className="p-4 glass rounded-xl flex items-center justify-between"><span className="text-muted">{t('inherentRiskLevel')}</span><span className={`px-3 py-1 rounded-full text-sm border ${getRiskLevelColor(formData.inherent_level)}`}>{formData.inherent_level}</span></div>}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="font-subtitle">{t('strategyAndMitigation')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('managementStrategy')}</Label>
              <Select value={formData.risk_strategy} onValueChange={(v) => handleChange("risk_strategy", v)} disabled={loading}>
                <SelectTrigger className="input-glass"><SelectValue placeholder={t('selectStrategy')} /></SelectTrigger>
                <SelectContent className="glass">{STRATEGY_LEVELS.map(s => <SelectItem key={s} value={s}>{t(`strategy${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[1, 2, 3].map(num => (
              <div key={num} className="space-y-2 p-4 glass rounded-xl">
                <Label className="font-subtitle text-sm">{t('mitigationMeasure', { num })}</Label>
                <div className="space-y-3">
                  <Input value={formData[`mitigant_${num}`]} onChange={(e) => handleChange(`mitigant_${num}`, e.target.value)} placeholder={t('mitigationDescription', { num })} className="input-glass" disabled={loading} />
                  <Select value={formData[`mitigant_impact_${num}`]} onValueChange={(v) => handleChange(`mitigant_impact_${num}`, v)} disabled={loading}>
                    <SelectTrigger className="input-glass">
                      <SelectValue placeholder={t('selectMitigationImpact')} />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      {MITIGANT_IMPACT_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>{t(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="font-subtitle">{t('residualRisk')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('residualProbability')}</Label>
                <Select value={formData.residual_probability} onValueChange={(v) => handleChange("residual_probability", v)} disabled={loading}>
                  <SelectTrigger className="input-glass"><SelectValue placeholder={t('selectProbability')} /></SelectTrigger>
                  <SelectContent className="glass">{PROBABILITY_LEVELS.map(l => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('residualImpact')}</Label>
                <Select value={formData.residual_impact} onValueChange={(v) => handleChange("residual_impact", v)} disabled={loading}>
                  <SelectTrigger className="input-glass"><SelectValue placeholder={t('selectImpact')} /></SelectTrigger>
                  <SelectContent className="glass">{IMPACT_LEVELS.map(l => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {formData.residual_level && <div className="p-4 glass rounded-xl flex items-center justify-between"><span className="text-muted">{t('residualRiskLevel')}</span><span className={`px-3 py-1 rounded-full text-sm border ${getRiskLevelColor(formData.residual_level)}`}>{formData.residual_level}</span></div>}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="glass hover:border-accent" disabled={loading}>{t('cancel')}</Button>
          <Button type="submit" variant="outline" className="glass hover:border-accent flex-1" disabled={loading}>
            {loading ? <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {loading ? t('saving') : (editingRisk ? t('saveChanges') : t('registerRisk'))}
          </Button>
        </div>
      </form>
    </div>
  );
}
