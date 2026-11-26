import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  GraduationCap,
  History,
  IdCard,
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
import { COMPANY_SIZES, companySizeLabel } from "@/config/companyProfile";
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
  { value: "", labelKey: "companyLevelNone" },
  { value: "view", labelKey: "companyLevelView" },
  { value: "edit", labelKey: "companyLevelEdit" },
];

const inputClass =
  "glass rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent";

function inviteLink(token) {
  return `${window.location.origin}/register?invite=${token}`;
}

async function copyText(text, okMessage, errorMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
  } catch {
    toast.error(errorMessage);
  }
}

// Selector de nivel por módulo (sin acceso / ver / editar).
function LevelSelect({ value, onChange, disabled, label }) {
  const { t } = useLanguage();
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
          {t(l.labelKey)}
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
  const { t } = useLanguage();
  return (
    <select
      aria-label={t("companyRoleLabel")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputClass} py-1.5 disabled:opacity-60`}
    >
      <option value="member">{t("companyRoleMember")}</option>
      <option value="admin">{t("companyRoleAdmin")}</option>
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

// Campos de la tarjeta «Datos de la empresa» (columnas de `companies`).
const PROFILE_FIELDS = ["industry", "size", "contact_name", "contact_title", "contact_phone", "contact_email"];
const profileOf = (company) => Object.fromEntries(PROFILE_FIELDS.map((k) => [k, company?.[k] || ""]));

// Datos de la empresa y de la persona a cargo. Se capturan al registrarse;
// el administrador de la empresa los corrige aquí.
function CompanyProfileCard({ company, canEdit, onSaved }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profileOf(company));
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Company.updateProfile(company.id, draft);
      await onSaved();
      setEditing(false);
      toast.success(t("companyProfileSaved"));
    } catch (err) {
      toast.error(err.message || t("companyProfileSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const contactLine = [company.contact_title, company.contact_phone, company.contact_email].filter(Boolean);
  const items = [
    { label: t("companyProfileIndustryShort"), value: company.industry },
    { label: t("companyProfileSize"), value: companySizeLabel(company.size, t) },
    { label: t("companyProfileContact"), value: company.contact_name, extra: contactLine },
  ];
  const empty = PROFILE_FIELDS.every((k) => !company[k]);

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="font-subtitle flex items-center gap-2">
            <IdCard className="w-5 h-5 text-accent" /> {t("companyProfileTitle")}
          </CardTitle>
          {canEdit && !editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(profileOf(company));
                setEditing(true);
              }}
            >
              <Pencil className="w-4 h-4 mr-1.5" /> {empty ? t("companyProfileComplete") : t("edit")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={save} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="block text-xs text-muted">{t("companyProfileIndustry")}</span>
                <input value={draft.industry} onChange={set("industry")} maxLength={120} className={`${inputClass} w-full`} />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs text-muted">{t("companyProfileEmployees")}</span>
                <select value={draft.size} onChange={set("size")} className={`${inputClass} w-full`}>
                  <option value="">{t("companyProfileUnspecified")}</option>
                  {COMPANY_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {t(size.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <h3 className="text-sm font-subtitle mb-2">{t("companyProfileContact")}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="block text-xs text-muted">{t("companyProfileFullName")}</span>
                  <input
                    value={draft.contact_name}
                    onChange={set("contact_name")}
                    maxLength={120}
                    autoComplete="name"
                    className={`${inputClass} w-full`}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs text-muted">{t("companyProfileJobTitle")}</span>
                  <input
                    value={draft.contact_title}
                    onChange={set("contact_title")}
                    maxLength={120}
                    placeholder={t("companyProfileJobTitleExample")}
                    className={`${inputClass} w-full`}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs text-muted">{t("companyProfilePhone")}</span>
                  <input
                    type="tel"
                    value={draft.contact_phone}
                    onChange={set("contact_phone")}
                    maxLength={40}
                    autoComplete="tel"
                    className={`${inputClass} w-full`}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs text-muted">{t("companyProfileContactEmail")}</span>
                  <input
                    type="email"
                    value={draft.contact_email}
                    onChange={set("contact_email")}
                    maxLength={200}
                    autoComplete="email"
                    className={`${inputClass} w-full`}
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Save className="w-4 h-4 mr-1.5" /> {t("save")}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : empty ? (
          <p className="text-sm text-muted">
            {canEdit ? t("companyProfileEmptyAdmin") : t("companyProfileEmpty")}
          </p>
        ) : (
          <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {items.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-xs text-muted mb-0.5">{item.label}</dt>
                <dd className={item.value ? "font-subtitle break-words" : "text-muted"}>
                  {item.value || t("companyNoData")}
                </dd>
                {item.extra?.length > 0 && (
                  <dd className="text-xs text-muted break-words mt-0.5">{item.extra.join(" · ")}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
CompanyProfileCard.propTypes = {
  company: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onSaved: PropTypes.func.isRequired,
};

export default function CompanyTeam() {
  const { t, language } = useLanguage();
  const dateLocale = language === "en" ? "en-US" : "es-MX";
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
      toast.error(err.message || t("companyLoadError"));
    } finally {
      setLoading(false);
    }
    // `t` cambia de identidad en cada render: no va en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <ArrowLeft className="w-4 h-4 mr-1.5" /> {t("companyBackToModules")}
    </Link>
  );

  if (!team?.company) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6">
        {backLink}
        <Card className="glass">
          <CardContent className="p-10 text-center text-muted">
            <p className="text-lg font-subtitle mb-2">{t("companyNoCompanyTitle")}</p>
            <p className="text-sm">{t("companyNoCompanyDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = team.is_admin;
  const modules = MODULES.filter((m) => team.modules.includes(m.key));
  const members = team.members || [];
  const invitations = team.invitations || [];
  const mentors = team.mentors || [];

  const setMentorAccess = async (mentor, active) => {
    const who = mentor.full_name || mentor.email;
    if (!active && !window.confirm(t("companyMentorRevokeConfirm", { who }))) return;
    setBusy(mentor.mentor_id);
    try {
      await Company.setMentorAccess(mentor.mentor_id, active);
      await load();
      toast.success(t(active ? "companyAccessRestored" : "companyAccessRemoved", { who }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const setDraft = (userId, patch) =>
    setDrafts((d) => ({ ...d, [userId]: { ...d[userId], ...patch } }));

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    try {
      await Company.rename(team.company.id, name);
      setEditingName(false);
      await Promise.all([load(), refreshAccess()]);
      toast.success(t("companyNameUpdated"));
    } catch (err) {
      toast.error(err.message || t("companyNameError"));
    }
  };

  const saveMember = async (m) => {
    const d = drafts[m.user_id];
    setBusy(m.user_id);
    try {
      await Company.updateMember(m.user_id, d.role, cleanModules(d.modules));
      await load();
      if (m.is_me) await refreshAccess();
      toast.success(t("companyPermissionsSaved"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const removeMember = async (m) => {
    const who = m.full_name || m.email;
    if (!window.confirm(t("companyRemoveConfirm", { who }))) return;
    setBusy(m.user_id);
    try {
      await Company.removeMember(m.user_id);
      await load();
      toast.success(t("companyAccessRemoved", { who }));
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
          <p className="text-xs uppercase tracking-wider text-muted">{t("companyMyCompany")}</p>
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
                aria-label={t("companyNameLabel")}
                className={`${inputClass} text-lg w-full max-w-md`}
              />
              <Button size="sm" onClick={saveName} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Check className="w-4 h-4 mr-1" /> {t("save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-title text-3xl truncate">{team.company.name}</h1>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("companyRenameTitle")}
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
        <Link
          to={createPageUrl("ChangeLog")}
          className="glass glass-hover rounded-2xl px-4 py-3 inline-flex items-center gap-2 text-sm font-subtitle"
        >
          <History className="w-4 h-4 text-accent" /> {t("changeLogTitle")}
        </Link>
        <div className="glass rounded-2xl px-5 py-3 text-center">
          <div className="font-title text-2xl">{members.length}</div>
          <div className="text-xs text-muted">{t(members.length === 1 ? "companyUserOne" : "companyUserMany")}</div>
        </div>
      </div>

      <CompanyProfileCard company={team.company} canEdit={isAdmin} onSaved={load} />

      {/* Equipo */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-subtitle flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" /> {t("companyTeamTitle")}
          </CardTitle>
          <p className="text-sm text-muted">
            {isAdmin ? t("companyTeamIntroAdmin") : t("companyTeamIntroMember")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-muted">
                  <th className="text-left py-3 px-3 font-subtitle">{t("companyColPerson")}</th>
                  <th className="text-left py-3 px-3 font-subtitle">{t("companyColRole")}</th>
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
                              {t("companyYou")}
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
                          <span>{t(m.role === "admin" ? "companyRoleAdmin" : "companyRoleMember")}</span>
                        )}
                      </td>
                      {d.role === "admin" ? (
                        modules.length > 0 && (
                          <td colSpan={modules.length} className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border border-accent/40 bg-accent/10 text-accent">
                              <ShieldCheck className="w-3.5 h-3.5" /> {t("companyAllModulesEdit")}
                            </span>
                          </td>
                        )
                      ) : (
                        modules.map((mod) => (
                          <td key={mod.key} className="py-3 px-3">
                            {isAdmin ? (
                              <LevelSelect
                                label={t("companyLevelFor", {
                                  module: t(mod.nameKey),
                                  person: m.full_name || m.email,
                                })}
                                value={d.modules?.[mod.key]}
                                onChange={(level) =>
                                  setDraft(m.user_id, { modules: { ...d.modules, [mod.key]: level } })
                                }
                                disabled={rowBusy}
                              />
                            ) : (
                              <span className={m.modules?.[mod.key] ? "" : "text-muted"}>
                                {t(LEVELS.find((l) => l.value === (m.modules?.[mod.key] || ""))?.labelKey)}
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
                              <Save className="w-4 h-4 mr-1.5" /> {t("save")}
                            </Button>
                            {!m.is_me && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title={t("companyRemoveTitle", { who: m.full_name || m.email })}
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

      {/* Mentores: personas de fuera de la empresa que la acompañan */}
      {mentors.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-500" />{" "}
              {t(mentors.length === 1 ? "companyMentorOne" : "companyMentorMany")}
            </CardTitle>
            <p className="text-sm text-muted">
              {t("companyMentorsIntro")}{" "}
              <Link to={createPageUrl("ChangeLog")} className="text-accent hover:underline">
                {t("companyMentorsIntroLink")}
              </Link>
              .{isAdmin ? ` ${t("companyMentorsIntroAdmin")}` : ""}
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[var(--card-border)]">
              {mentors.map((mentor) => (
                <li key={mentor.mentor_id} className="py-3 flex flex-wrap items-center gap-4">
                  <div className="flex-grow min-w-0">
                    <div className="font-subtitle">{mentor.full_name || mentor.email}</div>
                    <div className="text-xs text-muted">
                      {mentor.email} ·{" "}
                      {modules
                        .filter((mod) => mentor.modules.includes(mod.key))
                        .map((mod) => t(mod.nameKey))
                        .join(" · ") || t("companyMentorNoModules")}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-subtitle border ${
                      mentor.active
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border-[var(--card-border)] text-muted"
                    }`}
                  >
                    {t(mentor.active ? "companyMentorActive" : "companyMentorRevoked")}
                  </span>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant={mentor.active ? "ghost" : "default"}
                      disabled={busy === mentor.mentor_id}
                      onClick={() => setMentorAccess(mentor, !mentor.active)}
                      className={
                        mentor.active
                          ? "text-red-500 hover:text-red-500"
                          : "bg-accent text-accent-foreground hover:bg-accent/90"
                      }
                    >
                      {t(mentor.active ? "companyMentorRevoke" : "companyMentorRestore")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Invitar */}
      {isAdmin && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-subtitle flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent" /> {t("companyInviteTitle")}
            </CardTitle>
            <p className="text-sm text-muted">{t("companyInviteIntro")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={sendInvite} className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex-grow min-w-[16rem] space-y-1.5">
                  <span className="text-xs text-muted">{t("companyEmail")}</span>
                  <input
                    type="email"
                    required
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    placeholder={t("companyInviteEmailPlaceholder")}
                    className={`${inputClass} w-full`}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs text-muted">{t("companyColRole")}</span>
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
                  <Mail className="w-4 h-4 mr-2" /> {t("companyInviteCreate")}
                </Button>
              </div>
              {invite.role === "admin" && (
                <p className="text-xs text-muted">{t("companyInviteAdminNote")}</p>
              )}
            </form>

            {lastInvite && (
              <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 space-y-2">
                <p className="text-sm font-subtitle">
                  {t(lastInvite.has_account ? "companyInviteHasAccount" : "companyInviteReady", {
                    email: lastInvite.email,
                  })}
                </p>
                {!lastInvite.has_account && (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-grow min-w-0 break-all text-xs glass rounded-lg px-3 py-2">
                      {inviteLink(lastInvite.token)}
                    </code>
                    <Button
                      size="sm"
                      onClick={() =>
                        copyText(inviteLink(lastInvite.token), t("companyLinkCopied"), t("companyCopyFailed"))
                      }
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Copy className="w-4 h-4 mr-1.5" /> {t("companyCopy")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {invitations.length > 0 && (
              <div>
                <h3 className="text-sm font-subtitle text-muted mb-2">{t("companyInvitesPending")}</h3>
                <ul className="divide-y divide-[var(--card-border)]">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="flex-grow min-w-0">
                        <div className="font-subtitle truncate">{inv.email}</div>
                        <div className="text-xs text-muted">
                          {inv.role === "admin"
                            ? t("companyRoleAdmin")
                            : modules
                                .filter((mod) => inv.modules?.[mod.key])
                                .map(
                                  (mod) =>
                                    `${t(mod.nameKey)}: ${t(inv.modules[mod.key] === "edit" ? "companyInviteLevelEdit" : "companyInviteLevelView")}`,
                                )
                                .join(" · ") || t("companyNoModulesAssigned")}
                          {" · "}
                          {inv.expired
                            ? t("companyInviteExpired")
                            : t("companyInviteExpires", {
                                date: new Date(inv.expires_at).toLocaleDateString(dateLocale, {
                                  day: "numeric",
                                  month: "short",
                                }),
                              })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyText(inviteLink(inv.token), t("companyLinkCopied"), t("companyCopyFailed"))}
                        disabled={inv.expired}
                      >
                        <Copy className="w-4 h-4 mr-1.5" /> {t("companyCopyLink")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelInvitation(inv)}
                        disabled={busy === inv.id}
                        className="text-red-500 hover:text-red-500"
                      >
                        <X className="w-4 h-4 mr-1" /> {t("cancel")}
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
