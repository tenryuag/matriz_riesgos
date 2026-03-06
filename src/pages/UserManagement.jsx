import { useState, useEffect } from "react";
import { User } from "@/api/entities";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  ShieldBan,
  Mail,
  Calendar,
  Search,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionUser, setActionUser] = useState(null); // { user, action: 'suspend' | 'reactivate' }
  const [processing, setProcessing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const checkAdmin = async () => {
    try {
      const currentUser = await User.me();
      setCurrentUserId(currentUser?.id);
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

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await User.list();
      if (result?.success) {
        setUsers(result.users || []);
      } else {
        toast.error(result?.message || t('usersLoadError'));
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error(t('usersLoadError'));
    }
    setLoading(false);
  };

  const handleSuspend = async (userId) => {
    setProcessing(true);
    try {
      const result = await User.suspend(userId);
      if (result?.success) {
        toast.success(t('userSuspendedSuccess'));
        loadUsers();
      } else {
        toast.error(result?.message || t('userSuspendError'));
      }
    } catch (error) {
      console.error("Error suspending user:", error);
      toast.error(t('userSuspendError'));
    }
    setProcessing(false);
    setActionUser(null);
  };

  const handleReactivate = async (userId) => {
    setProcessing(true);
    try {
      const result = await User.reactivate(userId);
      if (result?.success) {
        toast.success(t('userReactivatedSuccess'));
        loadUsers();
      } else {
        toast.error(result?.message || t('userReactivateError'));
      }
    } catch (error) {
      console.error("Error reactivating user:", error);
      toast.error(t('userReactivateError'));
    }
    setProcessing(false);
    setActionUser(null);
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

  const isSuspended = (user) => {
    return user.banned_until !== null && user.banned_until !== undefined;
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (user.email && user.email.toLowerCase().includes(q)) ||
      (user.full_name && user.full_name.toLowerCase().includes(q))
    );
  });

  const stats = {
    total: users.length,
    active: users.filter(u => !isSuspended(u)).length,
    suspended: users.filter(u => isSuspended(u)).length,
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

  // No es admin
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
                {t('accessDenied')}
              </h2>
              <p className="text-muted mb-6">
                {t('adminOnlyFeature')}
              </p>
              <p className="text-sm text-muted">
                {t('contactAdminAccess')}
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
              <Users className="w-6 h-6" />
            </div>
            {t('usersTitle')}
          </h1>
          <p className="text-muted mt-2">{t('usersSubtitle')}</p>
        </div>
        <Button
          variant="outline"
          className="glass hover:border-accent"
          onClick={loadUsers}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('usersRefresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Users className="w-5 h-5 text-accent" />
              {t('usersStatTotal')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-title text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              {t('usersStatActive')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-title text-foreground">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <ShieldBan className="w-5 h-5 text-red-500" />
              {t('usersStatSuspended')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-title text-foreground">{stats.suspended}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder={t('usersSearchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-glass w-full p-3 pl-11 rounded-xl"
        />
      </div>

      {/* Users Table */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('usersListTitle')}</CardTitle>
          <CardDescription className="text-muted">
            {t('usersShowingCount', { count: filteredUsers.length, total: users.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-muted mb-4" />
              <p className="text-muted">{t('usersEmpty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-subtitle text-foreground">{t('usersTableName')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('usersTableEmail')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('usersTableRole')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('usersTableStatus')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('usersTableCreated')}</th>
                    <th className="text-left p-4 font-subtitle text-foreground">{t('usersTableLastLogin')}</th>
                    <th className="text-right p-4 font-subtitle text-foreground">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-accent/5">
                      <td className="p-4">
                        <span className="text-sm font-subtitle text-foreground">
                          {user.full_name || '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted" />
                          {user.email}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-accent/10 text-accent'
                            : 'bg-gray-500/10 text-muted'
                        }`}>
                          {user.role === 'admin' ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <Users className="w-3 h-3" />
                          )}
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="p-4">
                        {isSuspended(user) ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded-full">
                            <ShieldBan className="w-3 h-3" />
                            {t('usersStatusSuspended')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            {t('usersStatusActive')}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.created_at)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.last_sign_in_at)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {user.id === currentUserId ? (
                          <span className="text-xs text-muted italic">{t('usersYou')}</span>
                        ) : isSuspended(user) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionUser({ user, action: 'reactivate' })}
                            className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                          >
                            <ShieldCheck className="w-4 h-4 mr-1" />
                            {t('usersReactivateBtn')}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionUser({ user, action: 'suspend' })}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <ShieldBan className="w-4 h-4 mr-1" />
                            {t('usersSuspendBtn')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!actionUser} onOpenChange={() => setActionUser(null)}>
        <AlertDialogContent className="glass bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {actionUser?.action === 'suspend'
                ? t('usersSuspendTitle')
                : t('usersReactivateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {actionUser?.action === 'suspend'
                ? t('usersSuspendDescription')
                : t('usersReactivateDescription')}
              {actionUser && (
                <span className="block mt-2 text-accent font-mono text-sm">
                  {actionUser.user.email}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass" disabled={processing}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionUser?.action === 'suspend') {
                  handleSuspend(actionUser.user.id);
                } else {
                  handleReactivate(actionUser.user.id);
                }
              }}
              disabled={processing}
              className={actionUser?.action === 'suspend'
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-green-500 text-white hover:bg-green-600"
              }
            >
              {processing
                ? t('loading')
                : actionUser?.action === 'suspend'
                  ? t('usersSuspendBtn')
                  : t('usersReactivateBtn')
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
