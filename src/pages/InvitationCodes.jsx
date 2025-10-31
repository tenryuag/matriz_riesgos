import React, { useState, useEffect } from "react";
import { InvitationCode, User } from "@/api/entities";
import {
  Ticket,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Calendar,
  Mail,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from '@/components/LanguageContext';
import { toast } from 'sonner';

export default function InvitationCodes() {
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, used: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    email: '',
    notes: '',
    expires_at: ''
  });

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Estilos CSS globales para el modal (sin imports de fuentes)
  useEffect(() => {
    // Crear elemento style si no existe
    const styleId = 'invitation-codes-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        /* Inputs con bordes más visibles y colores adaptativos */
        .input-glass {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 2px solid rgba(18, 18, 18, 0.2);
          color: #121212;
          transition: all 0.2s ease;
        }

        .dark .input-glass {
          background: rgba(250, 247, 246, 0.15);
          border: 2px solid rgba(221, 191, 90, 0.4);
          color: #FAF7F6;
        }

        .input-glass::placeholder {
          color: rgba(18, 18, 18, 0.5);
        }

        .dark .input-glass::placeholder {
          color: rgba(250, 247, 246, 0.5);
        }

        .input-glass:focus {
          outline: none;
          border-color: #DDBF5A;
          box-shadow: 0 0 0 3px rgba(221, 191, 90, 0.2);
        }

        /* Botones con bordes visibles sin movimiento en hover */
        .glass {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 2px solid rgba(221, 191, 90, 0.4);
          color: #121212;
          transition: all 0.2s ease;
        }

        .dark .glass {
          background: rgba(250, 247, 246, 0.15);
          border: 2px solid rgba(221, 191, 90, 0.5);
          color: #FAF7F6;
        }

        .glass:hover:not(:disabled) {
          border-color: #DDBF5A;
          box-shadow: 0 0 8px rgba(221, 191, 90, 0.4);
        }

        .glass:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Modal con fondo más claro en dark mode */
        .dark [role="dialog"] {
          background: rgba(26, 26, 26, 0.98) !important;
          border: 2px solid rgba(221, 191, 90, 0.5) !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Cleanup: remover el style cuando el componente se desmonte
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  const checkAdmin = async () => {
    try {
      const currentUser = await User.me();

      // Verificar si el usuario es admin
      const role = currentUser?.user_metadata?.role ||
                   currentUser?.raw_user_meta_data?.role ||
                   'user';

      setIsAdmin(role === 'admin');
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
    setCheckingAuth(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesList, statsData] = await Promise.all([
        InvitationCode.list('-created_at'),
        InvitationCode.stats()
      ]);
      setCodes(codesList);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading codes:", error);
      toast.error(t('codesLoadError'));
    }
    setLoading(false);
  };

  const handleCreateCode = async () => {
    setIsCreating(true);
    try {
      const newCode = await InvitationCode.create({
        email: formData.email || null,
        notes: formData.notes || null,
        expires_at: formData.expires_at || null
      });

      toast.success(t('codeCreatedSuccess'));
      setIsDialogOpen(false);
      setFormData({ email: '', notes: '', expires_at: '' });
      loadData();
    } catch (error) {
      console.error("Error creating code:", error);
      toast.error(t('codeCreateError'));
    }
    setIsCreating(false);
  };

  const handleDeleteCode = async (id) => {
    try {
      await InvitationCode.delete(id);
      toast.success(t('codeDeletedSuccess'));
      setCodeToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting code:", error);
      toast.error(t('codeDeleteError'));
    }
  };

  const copyToClipboard = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(t('codeCopied'));
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast.error(t('codeCopyError'));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  // Verificando autenticación
  if (checkingAuth) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse">
          <div className="w-32 h-8 bg-gray-500/20 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full h-24 bg-gray-500/20 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No es admin - Acceso denegado
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="glass border-border max-w-md">
          <CardContent className="pt-12 pb-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-title text-foreground mb-3">
                {t('accessDenied') || 'Acceso Denegado'}
              </h2>
              <p className="text-muted mb-6">
                {t('adminOnlyFeature') || 'Esta función está disponible solo para administradores.'}
              </p>
              <p className="text-sm text-muted">
                {t('contactAdminAccess') || 'Si necesitas acceso, contacta al administrador del sistema.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cargando datos
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse">
          <div className="w-32 h-8 bg-gray-500/20 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full h-24 bg-gray-500/20 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-title text-foreground flex items-center gap-3">
            <div className="w-12 h-12 bg-accent text-accent-foreground rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6" />
            </div>
            {t('codesTitle')}
          </h1>
          <p className="text-muted mt-2">{t('codesSubtitle')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="glass text-foreground hover:border-accent">
              <Plus className="w-4 h-4 mr-2" />
              {t('codesCreateButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-zinc-900 border-2 border-accent/40 dark:border-accent/60 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{t('codesCreateTitle')}</DialogTitle>
              <DialogDescription className="text-muted">
                {t('codesCreateDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  {t('codesEmailLabel')} <span className="text-muted">({t('optional')})</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('codesEmailPlaceholder')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-glass"
                />
                <p className="text-xs text-muted">{t('codesEmailHelp')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground">
                  {t('codesNotesLabel')} <span className="text-muted">({t('optional')})</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder={t('codesNotesPlaceholder')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-glass resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires_at" className="text-foreground">
                  {t('codesExpiryLabel')} <span className="text-muted">({t('optional')})</span>
                </Label>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="input-glass"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="glass text-foreground hover:border-accent"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateCode}
                disabled={isCreating}
                variant="outline"
                className="glass text-foreground hover:border-accent"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t('creating')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('create')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Ticket className="w-5 h-5 text-accent" />
              {t('codesStatTotal')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-title text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <CheckCircle className="w-5 h-5 text-green-500" />
              {t('codesStatUsed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-title text-foreground">{stats.used}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <XCircle className="w-5 h-5 text-accent" />
              {t('codesStatAvailable')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-title text-foreground">{stats.available}</p>
          </CardContent>
        </Card>
      </div>

      {/* Codes Table */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('codesListTitle')}</CardTitle>
          <CardDescription className="text-muted">{t('codesListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-16 h-16 mx-auto text-muted mb-4" />
              <p className="text-muted">{t('codesEmpty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-subtitle text-foreground">{t('codesTableCode')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('codesTableStatus')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('codesTableEmail')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('codesTableNotes')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('codesTableCreated')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('codesTableExpires')}</th>
                    <th className="text-right p-4 font-subtitle text-foreground">{t('codesTableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => (
                    <tr key={code.id} className="border-b border-border hover:bg-accent/5">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-accent/10 text-accent px-2 py-1 rounded">
                            {code.code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(code.code)}
                            className="text-muted hover:text-accent transition-colors"
                          >
                            {copiedCode === code.code ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        {code.used ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            {t('codesStatusUsed')}
                          </span>
                        ) : isExpired(code.expires_at) ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded-full">
                            <XCircle className="w-3 h-3" />
                            {t('codesStatusExpired')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                            <Ticket className="w-3 h-3" />
                            {t('codesStatusAvailable')}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {code.email ? (
                          <span className="text-sm text-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3 text-muted" />
                            {code.email}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted line-clamp-2">
                          {code.notes || '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(code.created_at)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(code.expires_at)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCodeToDelete(code)}
                          disabled={code.used}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!codeToDelete} onOpenChange={() => setCodeToDelete(null)}>
        <AlertDialogContent className="glass bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t('codesDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {t('codesDeleteDescription')}
              {codeToDelete && (
                <code className="block mt-2 text-accent font-mono">{codeToDelete.code}</code>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => codeToDelete && handleDeleteCode(codeToDelete.id)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
