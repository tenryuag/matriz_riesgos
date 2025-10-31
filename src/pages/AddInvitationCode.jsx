import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Ticket, ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from '@/components/LanguageContext';
import { InvitationCode } from '@/api/entities';
import { toast } from 'sonner';

export default function AddInvitationCode() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    notes: '',
    expires_at: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await InvitationCode.create({
        email: formData.email || null,
        notes: formData.notes || null,
        expires_at: formData.expires_at || null
      });

      toast.success(t('codeCreatedSuccess'));
      navigate(createPageUrl("InvitationCodes"));
    } catch (error) {
      console.error("Error creating code:", error);
      setError(t('codeCreateError'));
      toast.error(t('codeCreateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("InvitationCodes"))}
          className="glass"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-title">{t('codesCreateTitle')}</h1>
          <p className="text-muted">{t('codesCreateDescription')}</p>
        </div>
      </div>

      {/* Form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-subtitle">
            <div className="w-10 h-10 glass rounded-xl flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            {t('codesCreateTitle')}
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
              <Label htmlFor="email">
                {t('codesEmailLabel')} <span className="text-muted">({t('optional')})</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder={t('codesEmailPlaceholder')}
                className="input-glass"
                disabled={loading}
              />
              <p className="text-xs text-muted">{t('codesEmailHelp')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                {t('codesNotesLabel')} <span className="text-muted">({t('optional')})</span>
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder={t('codesNotesPlaceholder')}
                rows={4}
                className="input-glass resize-none"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires_at">
                {t('codesExpiryLabel')} <span className="text-muted">({t('optional')})</span>
              </Label>
              <Input
                id="expires_at"
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => handleChange("expires_at", e.target.value)}
                className="input-glass"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createPageUrl("InvitationCodes"))}
                className="glass hover:border-accent"
                disabled={loading}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="outline"
                className="glass hover:border-accent flex-1"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {loading ? t('creating') : t('create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
