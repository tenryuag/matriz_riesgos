import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Save,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { PlatformAdmin, User } from "@/api/entities";
import { getAssignableModules } from "@/config/modules";
import { companySizeLabel } from "@/config/companyProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

// Administración de la plataforma, por empresa: qué módulos tiene contratados
// cada una y qué mentor la acompaña (con qué módulos). También define quiénes
// son mentores. Sustituye a la asignación de módulos por usuario.

const inputClass =
  "glass rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent";

const personName = (p) => p.full_name || p.email;

// Casillas de módulos (para la empresa o para un mentor).
function ModuleChecks({ modules, value, onChange, disabled, t }) {
  return (
    <div className="flex flex-wrap gap-2">
      {modules.map((m) => {
        const on = value.includes(m.key);
        return (
          <button
            key={m.key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((k) => k !== m.key) : [...value, m.key])}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-subtitle border transition-colors disabled:opacity-50 ${
              on
                ? "bg-accent/15 border-accent text-foreground"
                : "glass border-[var(--card-border)] text-muted hover:border-accent"
            }`}
          >
            <span
              className={`w-4 h-4 rounded border inline-flex items-center justify-center ${
                on ? "bg-accent border-accent text-accent-foreground" : "border-[var(--card-border)]"
              }`}
            >
              {on && <Check className="w-3 h-3" />}
            </span>
            {t(m.nameKey)}
          </button>
        );
      })}
    </div>
  );
}
ModuleChecks.propTypes = {
  modules: PropTypes.array.isRequired,
  value: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  t: PropTypes.func.isRequired,
};

const sameSet = (a, b) => a.length === b.length && a.every((k) => b.includes(k));

// Detalle de una empresa: módulos contratados y mentores.
function CompanyDetail({ company, eligibleMentors, assignable, onChanged, t }) {
  const [modules, setModules] = useState(company.modules);
  const [mentorDrafts, setMentorDrafts] = useState(
    Object.fromEntries(company.mentors.map((m) => [m.mentor_id, m.modules])),
  );
  const [newMentor, setNewMentor] = useState({ id: "", modules: [] });
  const [busy, setBusy] = useState(false);

  // Un mentor solo puede recibir módulos que la empresa tiene.
  const companyModules = assignable.filter((m) => company.modules.includes(m.key));
  const memberIds = company.members.map((m) => m.user_id);
  const available = eligibleMentors.filter(
    (m) => !memberIds.includes(m.id) && !company.mentors.some((x) => x.mentor_id === m.id),
  );

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMessage);
      await onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 pb-6 pt-2 space-y-6">
      {/* Datos que la empresa dio al registrarse (los corrige ella en «Mi empresa») */}
      <section className="space-y-1">
        <h3 className="text-sm font-subtitle">{t("companyProfileTitle")}</h3>
        <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div className="min-w-0">
            <dt className="text-xs text-muted">{t("companyProfileIndustryShort")}</dt>
            <dd className={company.industry ? "break-words" : "text-muted"}>
              {company.industry || t("companyNoData")}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">{t("companyProfileSize")}</dt>
            <dd className={company.size ? "" : "text-muted"}>
              {companySizeLabel(company.size, t) || t("companyNoData")}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">{t("companyProfileContact")}</dt>
            <dd className={company.contact_name ? "break-words" : "text-muted"}>
              {company.contact_name || t("companyNoData")}
            </dd>
            {[company.contact_title, company.contact_phone, company.contact_email].some(Boolean) && (
              <dd className="text-xs text-muted break-words">
                {[company.contact_title, company.contact_phone, company.contact_email].filter(Boolean).join(" · ")}
              </dd>
            )}
          </div>
        </dl>
      </section>

      {/* Módulos de la empresa */}
      <section className="space-y-2">
        <h3 className="text-sm font-subtitle">{t("adminCompaniesModulesTitle")}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <ModuleChecks modules={assignable} value={modules} onChange={setModules} disabled={busy} t={t} />
          <Button
            size="sm"
            disabled={busy || sameSet(modules, company.modules)}
            onClick={() =>
              run(() => PlatformAdmin.setCompanyModules(company.id, modules), t("adminCompaniesModulesSaved"))
            }
            className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            <Save className="w-4 h-4 mr-1.5" /> {t("save")}
          </Button>
        </div>
        <p className="text-xs text-muted">{t("adminCompaniesModulesNote")}</p>
      </section>

      {/* Personas */}
      <section className="space-y-2">
        <h3 className="text-sm font-subtitle">
          {company.members.length === 1
            ? t("adminCompaniesUserOne")
            : t("adminCompaniesUserMany", { count: company.members.length })}
        </h3>
        <ul className="text-sm space-y-1">
          {company.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-baseline gap-x-2">
              <span>{personName(m)}</span>
              {m.full_name && <span className="text-xs text-muted">{m.email}</span>}
              {m.role === "admin" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-accent/40 text-accent">
                  {t("adminCompaniesAdminBadge")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Mentores */}
      <section className="space-y-3">
        <h3 className="text-sm font-subtitle flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-indigo-500" /> {t("adminCompaniesMentors")}
        </h3>
        {company.mentors.length === 0 && <p className="text-sm text-muted">{t("adminCompaniesNoMentor")}</p>}
        {company.mentors.map((m) => {
          const draft = mentorDrafts[m.mentor_id] || [];
          return (
            <div key={m.mentor_id} className="glass rounded-2xl p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-[12rem] flex-grow">
                <div className="font-subtitle text-sm">{personName(m)}</div>
                <div className="text-xs text-muted">
                  {m.email}
                  {!m.active && <span className="text-amber-500"> · {t("adminCompaniesMentorRevoked")}</span>}
                </div>
              </div>
              <ModuleChecks
                modules={companyModules}
                value={draft}
                onChange={(v) => setMentorDrafts({ ...mentorDrafts, [m.mentor_id]: v })}
                disabled={busy}
                t={t}
              />
              <Button
                size="sm"
                disabled={busy || draft.length === 0 || sameSet(draft, m.modules)}
                onClick={() =>
                  run(
                    () => PlatformAdmin.setCompanyMentor(company.id, m.mentor_id, draft),
                    t("adminCompaniesMentorModulesSaved"),
                  )
                }
                className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
              >
                <Save className="w-4 h-4 mr-1.5" /> {t("save")}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                title={t("adminCompaniesMentorRemoveTitle", { name: personName(m) })}
                onClick={() => {
                  if (
                    window.confirm(
                      t("adminCompaniesMentorRemoveConfirm", { name: personName(m), company: company.name }),
                    )
                  )
                    run(
                      () => PlatformAdmin.setCompanyMentor(company.id, m.mentor_id, []),
                      t("adminCompaniesMentorRemoved"),
                    );
                }}
                className="text-red-500 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}

        {/* Asignar uno nuevo */}
        {companyModules.length === 0 ? (
          <p className="text-xs text-muted">{t("adminCompaniesNeedModule")}</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-muted">{t("adminCompaniesNoMoreMentors")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label={t("adminCompaniesMentorSelectLabel")}
              value={newMentor.id}
              onChange={(e) => setNewMentor({ ...newMentor, id: e.target.value })}
              disabled={busy}
              className={`${inputClass} min-w-[14rem]`}
            >
              <option value="">{t("adminCompaniesMentorSelect")}</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {personName(m)}
                  {m.role === "admin" ? " (admin)" : ""}
                </option>
              ))}
            </select>
            {newMentor.id && (
              <>
                <ModuleChecks
                  modules={companyModules}
                  value={newMentor.modules}
                  onChange={(v) => setNewMentor({ ...newMentor, modules: v })}
                  disabled={busy}
                  t={t}
                />
                <Button
                  size="sm"
                  disabled={busy || newMentor.modules.length === 0}
                  onClick={() =>
                    run(async () => {
                      await PlatformAdmin.setCompanyMentor(company.id, newMentor.id, newMentor.modules);
                      setNewMentor({ id: "", modules: [] });
                    }, t("adminCompaniesMentorAssigned"))
                  }
                  className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" /> {t("adminCompaniesAssign")}
                </Button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
CompanyDetail.propTypes = {
  company: PropTypes.object.isRequired,
  eligibleMentors: PropTypes.array.isRequired,
  assignable: PropTypes.array.isRequired,
  onChanged: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default function AdminCompanies() {
  const { t } = useLanguage();
  const assignable = getAssignableModules().filter((m) => m.status === "ready");

  const [data, setData] = useState({ companies: [], mentors: [] });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const [newMentorId, setNewMentorId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, usersRes] = await Promise.all([PlatformAdmin.companies(), User.list()]);
      setData({ companies: res.companies || [], mentors: res.mentors || [] });
      setUsers(usersRes?.users || []);
    } catch (err) {
      toast.error(err.message || t("adminCompaniesLoadError"));
    } finally {
      setLoading(false);
    }
    // `t` cambia de identidad en cada render: no va en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.companies;
    return data.companies.filter(
      (c) =>
        `${c.name} ${c.industry || ""} ${c.contact_name || ""} ${c.contact_email || ""}`.toLowerCase().includes(q) ||
        c.members.some((m) => `${m.full_name} ${m.email}`.toLowerCase().includes(q)) ||
        c.mentors.some((m) => `${m.full_name} ${m.email}`.toLowerCase().includes(q)),
    );
  }, [data.companies, search]);

  const setRole = async (userId, role, okMessage) => {
    setBusy(true);
    try {
      const res = await User.setRole(userId, role);
      if (res?.success === false) throw new Error(res.message);
      toast.success(okMessage);
      setNewMentorId("");
      await load();
    } catch (err) {
      toast.error(err.message || t("adminCompaniesRoleError"));
    } finally {
      setBusy(false);
    }
  };

  const candidates = users.filter((u) => u.role !== "admin" && u.role !== "mentor");
  const moduleName = (key) => {
    const mod = assignable.find((m) => m.key === key);
    return mod ? t(mod.nameKey) : key;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-title text-3xl mb-1">{t("navCompanies")}</h1>
        <p className="text-muted">{t("adminCompaniesSubtitle")}</p>
      </div>

      {/* Mentores de la plataforma */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-subtitle flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-500" /> {t("adminCompaniesMentors")}
          </CardTitle>
          <p className="text-sm text-muted">{t("adminCompaniesMentorsIntro")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {data.mentors.map((m) => {
              const count = data.companies.filter((c) => c.mentors.some((x) => x.mentor_id === m.id)).length;
              return (
                <span key={m.id} className="glass rounded-full pl-3 pr-1.5 py-1 text-sm inline-flex items-center gap-2">
                  <span className="font-subtitle">{personName(m)}</span>
                  <span className="text-xs text-muted">
                    {m.role === "admin" ? "admin · " : ""}
                    {count === 1 ? t("adminCompaniesCompanyOne") : t("adminCompaniesCompanyMany", { count })}
                  </span>
                  {m.role === "mentor" ? (
                    <button
                      type="button"
                      disabled={busy}
                      title={t("adminCompaniesMentorRoleRemoveTitle", { name: personName(m) })}
                      onClick={() => {
                        if (window.confirm(t("adminCompaniesMentorRoleRemoveConfirm", { name: personName(m) })))
                          setRole(m.id, "user", t("adminCompaniesMentorRoleRemoved"));
                      }}
                      className="w-6 h-6 rounded-full inline-flex items-center justify-center text-red-500 hover:bg-red-500/15"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="w-1" />
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label={t("adminCompaniesNewMentorLabel")}
              value={newMentorId}
              onChange={(e) => setNewMentorId(e.target.value)}
              disabled={busy}
              className={`${inputClass} min-w-[18rem]`}
            >
              <option value="">{t("adminCompaniesNewMentorSelect")}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ? `${u.full_name} — ${u.email}` : u.email}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={busy || !newMentorId}
              onClick={() => setRole(newMentorId, "mentor", t("adminCompaniesNowMentor"))}
              className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
            >
              <UserPlus className="w-4 h-4 mr-1.5" /> {t("adminCompaniesMakeMentor")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Empresas */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("adminCompaniesSearch")}
          className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-foreground placeholder:text-muted outline-none focus:border-accent"
        />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-subtitle flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent" />
            {loading
              ? t("navCompanies")
              : filtered.length === 1
                ? t("adminCompaniesCompanyOne")
                : t("adminCompaniesCompanyMany", { count: filtered.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--card-border)] border-t border-[var(--card-border)]">
              {filtered.map((c) => {
                const isOpen = open === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : c.id)}
                      aria-expanded={isOpen}
                      className="w-full text-left px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-[var(--table-row-hover)]"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                      )}
                      <span className="flex-grow min-w-[12rem]">
                        <span className="font-subtitle block truncate">{c.name}</span>
                        <span className="text-xs text-muted block truncate">
                          {c.members.length === 1
                            ? c.members[0].email
                            : `${t("adminCompaniesUserMany", { count: c.members.length })} · ${c.members.find((m) => m.role === "admin")?.email || ""}`}
                        </span>
                      </span>
                      <span className="text-xs text-muted">
                        {c.modules.length ? c.modules.map(moduleName).join(" · ") : t("adminCompaniesNoModules")}
                      </span>
                      {c.mentors.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
                          <GraduationCap className="w-3 h-3" />
                          {c.mentors.map((m) => personName(m)).join(", ")}
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <CompanyDetail
                        key={`${c.id}-${c.modules.join()}-${c.mentors.map((m) => m.mentor_id + m.modules.join()).join()}`}
                        company={c}
                        eligibleMentors={data.mentors}
                        assignable={assignable}
                        onChanged={load}
                        t={t}
                      />
                    )}
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="text-center text-muted py-10">{t("adminCompaniesNoMatch")}</li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
