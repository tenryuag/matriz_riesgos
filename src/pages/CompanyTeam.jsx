import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Mail,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Company } from "@/api/entities";
import { MODULES } from "@/config/modules";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";

// «Mi empresa»: quién forma parte de la empresa y qué puede hacer cada quien.
// El administrador de la empresa invita, da de baja y reparte los módulos que
// la empresa tiene contratados, con nivel «ver» o «editar». Los demás
// miembros ven la lista sin poder cambiarla.

const LEVELS = [
  { value: "", label: "Sin acceso" },
  { value: "view", label: "Solo ver" },
  { value: "edit", label: "Ver y editar" },
];

const inputClass =
  "glass rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent";

function inviteLink(token) {
  return `${window.location.origin}/register?invite=${token}`;
}

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
  } catch {
    toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
  }
}

// Selector de nivel por módulo (sin acceso / ver / editar).
function LevelSelect({ value, onChange, disabled, label }) {
  return (
    <select
      aria-label={label}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputClass} py-1.5 w-full min-w-[8.5rem] disabled:opacity-60`}
    >
      {LEVELS.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
LevelSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
};

function RoleSelect({ value, onChange, disabled }) {
  return (
    <select
      aria-label="Papel en la empresa"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputClass} py-1.5 disabled:opacity-60`}
    >
      <option value="member">Miembro</option>
      <option value="admin">Administrador</option>
    </select>
  );
}
RoleSelect.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

// Quita los módulos «sin acceso» antes de mandar a la base.
const cleanModules = (modules) =>
  Object.fromEntries(Object.entries(modules || {}).filter(([, level]) => level));

const sameDraft = (a, b) =>
  a.role === b.role &&
  JSON.stringify(Object.entries(cleanModules(a.modules)).sort()) ===
    JSON.stringify(Object.entries(cleanModules(b.modules)).sort());

export default function CompanyTeam() {
  const { t } = useLanguage();
  const { refresh: refreshAccess } = useModuleAccess();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // user_id -> { role, modules }
  const [busy, setBusy] = useState(null); // id de la fila que se está guardando
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "member", modules: {} });
  const [lastInvite, setLastInvite] = useState(null); // { email, token, has_account }

  const load = useCallback(async () => {
    try {
      const data = await Company.team();
      setTeam(data);
      setDrafts(
        Object.fromEntries(
          (data?.members || []).map((m) => [m.user_id, { role: m.role, modules: { ...m.modules } }]),
        ),
      );
    } catch (err) {
      toast.error(err.message || "No se pudo cargar tu empresa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const backLink = (
    <Link
      to={createPageUrl("ModuleLauncher")}
      className="inline-flex items-center text-sm text-muted hover:text-accent"
    >
      <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver a los módulos
    </Link>
  );

  if (!team?.company) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6">
        {backLink}
        <Card className="glass">
          <CardContent className="p-10 text-center text-muted">
            <p className="text-lg font-subtitle mb-2">Tu cuenta no pertenece a ninguna empresa</p>
            <p className="text-sm">
              Pide al administrador de tu empresa que te invite de nuevo con este mismo correo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = team.is_admin;
  const modules = MODULES.filter((m) => team.modules.includes(m.key));
  const members = team.members || [];
  const invitations = team.invitations || [];

  const setDraft = (userId, patch) =>
    setDrafts((d) => ({ ...d, [userId]: { ...d[userId], ...patch } }));

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    try {
      await Company.rename(team.company.id, name);
      setEditingName(false);
      await Promise.all([load(), refreshAccess()]);
      toast.success("Nombre actualizado");
    } catch (err) {
      toast.error(err.message || "No se pudo cambiar el nombre");
    }
  };

  const saveMember = async (m) => {
    const d = drafts[m.user_id];
    setBusy(m.user_id);
    try {
      await Company.updateMember(m.user_id, d.role, cleanModules(d.modules));
      await load();
      if (m.is_me) await refreshAccess();
      toast.success("Permisos guardados");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const removeMember = async (m) => {
    const who = m.full_name || m.email;
    if (
      !window.confirm(
        `¿Dar de baja a ${who}?\n\nDejará de ver los datos de la empresa. Lo que haya capturado se conserva.`,
      )
    )
      return;
    setBusy(m.user_id);
    try {
      await Company.removeMember(m.user_id);
      await load();
      toast.success(`${who} ya no tiene acceso`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    const email = invite.email.trim();
    if (!email) return;
    setBusy("invite");
    try {
      const res = await Company.invite(email, invite.role, cleanModules(invite.modules));
      setLastInvite({ email, token: res.token, has_account: res.has_account });
      setInvite({ email: "", role: "member", modules: {} });
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const cancelInvitation = async (inv) => {
    setBusy(inv.id);
    try {
      await Company.cancelInvitation(inv.id);
      if (lastInvite?.token === inv.token) setLastInvite(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6">
      {backLink}

      {/* Encabezado: nombre de la empresa */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Building2 className="w-7 h-7 text-accent" />
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted">Mi empresa</p>
          {editingName ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                aria-label="Nombre de la empresa"
                className={`${inputClass} text-lg w-full max-w-md`}
              />
              <Button size="sm" onClick={saveName} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Check className="w-4 h-4 mr-1" /> Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-title text-3xl truncate">{team.company.name}</h1>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Cambiar el nombre"
                  onClick={() => {
                    setNameDraft(team.company.name);
                    setEditingName(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="glass rounded-2xl px-5 py-3 text-center">
          <div className="font-title text-2xl">{members.length}</div>
          <div className="text-xs text-muted">{members.length === 1 ? "usuario" : "usuarios"}</div>
        </div>
      </div>

      {/* Equipo */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-subtitle flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" /> Equipo
          </CardTitle>
          <p className="text-sm text-muted">
            {isAdmin
              ? "Decide a qué módulos entra cada persona y si solo ve o también edita. Los administradores entran a todo."
              : "Estas son las personas de tu empresa. Solo un administrador puede cambiar los permisos."}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-muted">
                  <th className="text-left py-3 px-3 font-subtitle">Persona</th>
                  <th className="text-left py-3 px-3 font-subtitle">Papel</th>
                  {modules.map((m) => (
                    <th key={m.key} className="text-left py-3 px-3 font-subtitle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <m.icon className={`w-4 h-4 ${m.accent}`} /> {t(m.nameKey)}
                      </span>
                    </th>
                  ))}
                  {isAdmin && <th className="py-3 px-3" />}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const d = drafts[m.user_id] || { role: m.role, modules: m.modules };
                  const dirty = !sameDraft(d, m);
                  const rowBusy = busy === m.user_id;
                  return (
                    <tr key={m.user_id} className="border-b border-[var(--card-border)] align-middle">
                      <td className="py-3 px-3">
                        <div className="font-subtitle flex items-center gap-2">
                          {m.full_name || "—"}
                          {m.is_me && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] border border-accent/40 text-accent">
                              tú
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted">{m.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        {isAdmin ? (
                          <RoleSelect
                            value={d.role}
                            onChange={(role) => setDraft(m.user_id, { role })}
                            disabled={rowBusy}
                          />
                        ) : (
                          <span>{m.role === "admin" ? "Administrador" : "Miembro"}</span>
                        )}
                      </td>
                      {d.role === "admin" ? (
                        modules.length > 0 && (
                          <td colSpan={modules.length} className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border border-accent/40 bg-accent/10 text-accent">
                              <ShieldCheck className="w-3.5 h-3.5" /> Todos los módulos, con edición
                            </span>
                          </td>
                        )
                      ) : (
                        modules.map((mod) => (
                          <td key={mod.key} className="py-3 px-3">
                            {isAdmin ? (
                              <LevelSelect
                                label={`${t(mod.nameKey)} para ${m.full_name || m.email}`}
                                value={d.modules?.[mod.key]}
                                onChange={(level) =>
                                  setDraft(m.user_id, { modules: { ...d.modules, [mod.key]: level } })
                                }
                                disabled={rowBusy}
                              />
                            ) : (
                              <span className={m.modules?.[mod.key] ? "" : "text-muted"}>
                                {LEVELS.find((l) => l.value === (m.modules?.[mod.key] || ""))?.label}
                              </span>
                            )}
                          </td>
                        ))
                      )}
                      {isAdmin && (
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() => saveMember(m)}
                              disabled={!dirty || rowBusy}
                              className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
                            >
                              <Save className="w-4 h-4 mr-1.5" /> Guardar
                            </Button>
                            {!m.is_me && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title={`Dar de baja a ${m.full_name || m.email}`}
                                onClick={() => removeMember(m)}
                                disabled={rowBusy}
                                className="text-red-500 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invitar */}
      {isAdmin && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent" /> Invitar a alguien
            </CardTitle>
            <p className="text-sm text-muted">
              Se crea un enlace personal para ese correo. Compártelo por el medio que prefieras: la persona
              crea su contraseña y entra directo a tu empresa. El enlace dura 14 días.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={sendInvite} className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex-grow min-w-[16rem] space-y-1.5">
                  <span className="text-xs text-muted">Correo</span>
                  <input
                    type="email"
                    required
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    placeholder="persona@tuempresa.com"
                    className={`${inputClass} w-full`}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs text-muted">Papel</span>
                  <RoleSelect value={invite.role} onChange={(role) => setInvite({ ...invite, role })} />
                </label>
                {invite.role !== "admin" &&
                  modules.map((mod) => (
                    <label key={mod.key} className="space-y-1.5">
                      <span className="block text-xs text-muted">{t(mod.nameKey)}</span>
                      <LevelSelect
                        value={invite.modules[mod.key]}
                        onChange={(level) =>
                          setInvite({ ...invite, modules: { ...invite.modules, [mod.key]: level } })
                        }
                      />
                    </label>
                  ))}
                <Button
                  type="submit"
                  disabled={busy === "invite"}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Mail className="w-4 h-4 mr-2" /> Crear invitación
                </Button>
              </div>
              {invite.role === "admin" && (
                <p className="text-xs text-muted">
                  Un administrador entra a todos los módulos de la empresa y puede invitar y dar de baja.
                </p>
              )}
            </form>

            {lastInvite && (
              <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 space-y-2">
                <p className="text-sm font-subtitle">
                  {lastInvite.has_account
                    ? `${lastInvite.email} ya tiene cuenta: entrará a tu empresa la próxima vez que inicie sesión.`
                    : `Invitación lista para ${lastInvite.email}. Envíale este enlace:`}
                </p>
                {!lastInvite.has_account && (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-grow min-w-0 break-all text-xs glass rounded-lg px-3 py-2">
                      {inviteLink(lastInvite.token)}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => copyText(inviteLink(lastInvite.token), "Enlace copiado")}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Copy className="w-4 h-4 mr-1.5" /> Copiar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {invitations.length > 0 && (
              <div>
                <h3 className="text-sm font-subtitle text-muted mb-2">Invitaciones pendientes</h3>
                <ul className="divide-y divide-[var(--card-border)]">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="flex-grow min-w-0">
                        <div className="font-subtitle truncate">{inv.email}</div>
                        <div className="text-xs text-muted">
                          {inv.role === "admin"
                            ? "Administrador"
                            : modules
                                .filter((mod) => inv.modules?.[mod.key])
                                .map(
                                  (mod) =>
                                    `${t(mod.nameKey)}: ${inv.modules[mod.key] === "edit" ? "editar" : "ver"}`,
                                )
                                .join(" · ") || "Sin módulos asignados"}
                          {" · "}
                          {inv.expired
                            ? "vencida"
                            : `vence el ${new Date(inv.expires_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyText(inviteLink(inv.token), "Enlace copiado")}
                        disabled={inv.expired}
                      >
                        <Copy className="w-4 h-4 mr-1.5" /> Copiar enlace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelInvitation(inv)}
                        disabled={busy === inv.id}
                        className="text-red-500 hover:text-red-500"
                      >
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
