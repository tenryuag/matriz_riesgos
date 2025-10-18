
import React, { useState, useEffect, useCallback } from "react";
import { Department } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Building2, ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from '@/components/LanguageContext';

export default function AddDepartment() {
  const navigate = useNavigate();
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const loadDepartmentData = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const departmentId = urlParams.get('id');

    if (departmentId) {
      try {
        const departmentList = await Department.filter({ id: departmentId });
        if (departmentList.length > 0) {
          const dept = departmentList[0];
          setEditingDepartment(dept);
          setFormData({ name: dept.name, description: dept.description || "" });
        } else {
          setError(t('departmentNotFound'));
        }
      } catch (err) {
        console.error("Error loading department:", err);
        setError(t('dataLoadError'));
      }
    }
    setPageLoading(false);
  }, [t]);

  useEffect(() => {
    loadDepartmentData();
  }, [loadDepartmentData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError(t('errorRequiredName'));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const dataToSave = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        area_count: editingDepartment ? editingDepartment.area_count : 0
      };

      if (editingDepartment) {
        await Department.update(editingDepartment.id, dataToSave);
      } else {
        await Department.create(dataToSave);
      }

      navigate(createPageUrl("Departments"));
    } catch (error) {
      setError(editingDepartment ? t('errorUpdatingDepartment') : t('errorCreatingDepartment'));
      console.error("Error saving department:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Departments"))}
          className="glass"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-title">{editingDepartment ? t('editDepartmentTitle') : t('addDepartmentTitle')}</h1>
          <p className="text-muted">{editingDepartment ? t('editDepartmentSubtitle') : t('addDepartmentSubtitle')}</p>
        </div>
      </div>

      {/* Form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-subtitle">
            <div className="w-10 h-10 glass rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            {t('departmentInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-400/30 text-red-200">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">
                {t('departmentNameLabel')}
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={t('departmentNamePlaceholder')}
                className="input-glass"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t('descriptionLabel')}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={4}
                className="input-glass resize-none"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createPageUrl("Departments"))}
                className="glass hover:border-accent"
                disabled={loading}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="outline"
                className="glass hover:border-accent flex-1"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {loading ? t('saving') : (editingDepartment ? t('saveChanges') : t('createDepartment'))}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
