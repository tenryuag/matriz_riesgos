import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Clock, Sparkles, GraduationCap, Building2, ShieldOff, X } from "lucide-react";
import { getMentorAccessLost, setMentorAccessLost } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/components/LanguageContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { getVisibleModules, MODULES } from "@/config/modules";

// Frases que se van rotando mientras cargan los módulos, para que la espera
// se sienta más amena.
const LOADING_PHRASES = [
  "Estamos preparando tu espacio de trabajo…",
  "Cargando tus módulos…",
  "Organizando todo para ti…",
  "Casi listo…",
];

// Pantalla de bienvenida tras el inicio de sesión: el usuario elige el módulo
// al que quiere entrar. Cada módulo lleva a su propia sección.
export default function ModuleLauncher() {
  const { t } = useLanguage();
  // El usuario y el acceso vienen del mismo contexto (leído de la sesión
  // local), sin llamadas de red extra.
  const {
    user,
    isAdmin,
    grantedModules,
    loading,
    company,
    hasCompanies,
    mentorCompanies,
    actingCompany,
    enterCompany,
  } = useModuleAccess();
  // Con cuenta pero sin empresa (lo dieron de baja): no hay nada que mostrar.
  const noCompany = hasCompanies && !company && !isAdmin;

  const modules = getVisibleModules({ isAdmin, grantedModules });

  const firstName =
    (user?.user_metadata?.full_name || user?.full_name || "")
      .trim()
      .split(" ")[0] || "";

  // Aviso de «la empresa retiró tu acceso» (lo deja el modo mentor al salir).
  const [lostAccess, setLostAccess] = useState(() => getMentorAccessLost());
  const dismissLostAccess = () => {
    setMentorAccessLost(null);
    setLostAccess(null);
  };
  // Cuando no se conoce el nombre de la empresa, el aviso guarda «La empresa»
  // (leaveLostCompany, en ModuleAccessContext): se muestra en el idioma activo.
  const lostAccessName = lostAccess === "La empresa" ? t("mentorLostAccessUnknown") : lostAccess;

  // Rota las frases de carga cada 1.8 s mientras se cargan los módulos.
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(
      () => setPhraseIdx((p) => (p + 1) % LOADING_PHRASES.length),
      1800,
    );
    return () => clearInterval(id);
  }, [loading]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-10 py-6">
        {/* Encabezado con frase rotativa */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-[3px] border-accent/30 border-t-accent rounded-full animate-spin" />
            <h1 className="text-2xl md:text-3xl font-title">
              {firstName ? `Un momento, ${firstName}…` : "Un momento…"}
            </h1>
          </div>
          <p className="text-lg text-muted transition-opacity duration-500">
            {LOADING_PHRASES[phraseIdx]}
          </p>
        </div>

        {/* Tarjetas esqueleto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-3xl p-7 animate-pulse">
              <div className="w-14 h-14 rounded-2xl bg-gray-500/20 mb-5" />
              <div className="h-5 w-40 bg-gray-500/20 rounded mb-3" />
              <div className="h-3 w-full bg-gray-500/20 rounded mb-2" />
              <div className="h-3 w-2/3 bg-gray-500/20 rounded mb-6" />
              <div className="h-3 w-24 bg-gray-500/20 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-6">
      {lostAccess && (
        <div
          role="status"
          className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5 flex items-start gap-4"
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <ShieldOff className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-grow min-w-0">
            <h2 className="font-subtitle">{t("mentorLostAccessTitle", { company: lostAccessName })}</h2>
            <p className="text-sm text-muted mt-0.5">{t("mentorLostAccessDesc")}</p>
          </div>
          <button
            type="button"
            onClick={dismissLostAccess}
            aria-label={t("mentorLostAccessClose")}
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:bg-indigo-500/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bienvenida */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-title">
          {firstName ? `Hola, ${firstName}` : t("welcome")}
        </h1>
        <p className="text-lg text-muted">
          {actingCompany
            ? t("mentorModeLauncherQuestion", { company: actingCompany.name })
            : "¿Con qué módulo quieres trabajar hoy?"}
        </p>
      </div>

      {/* Sin módulos asignados */}
      {modules.length === 0 && (
        <Card className="glass">
          <CardContent className="p-10 text-center text-muted">
            <p className="text-lg font-subtitle mb-2">
              {noCompany ? t("companyNoCompanyTitle") : t("moduleNoneTitle")}
            </p>
            <p className="text-sm">
              {noCompany
                ? t("companyNoCompanyDesc")
                : company
                  ? t("companyNoModulesYet")
                  : t("moduleNoneDesc")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tarjetas de módulos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const inDev = mod.status === "in-development";
          const href = inDev
            ? createPageUrl("ModuleInDevelopment") + `?module=${mod.key}`
            : createPageUrl(mod.home);
          const Icon = mod.icon;

          return (
            <Link key={mod.key} to={href}>
              <Card className="glass glass-hover cursor-pointer h-full border-2 border-transparent hover:border-accent/40 transition-all">
                <CardContent className="p-7">
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-14 h-14 ${mod.bg} rounded-2xl flex items-center justify-center`}>
                      <Icon className={`w-7 h-7 ${mod.accent}`} />
                    </div>
                    {inDev && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border border-amber-400/40 bg-amber-400/10 text-amber-500">
                        <Clock className="w-3 h-3" /> {t("moduleInDevBadge")}
                      </span>
                    )}
                  </div>
                  <h2 className="font-title text-xl mb-2">{t(mod.nameKey)}</h2>
                  <p className="text-sm text-muted mb-5">{t(mod.descKey)}</p>
                  <div className="flex items-center text-accent text-sm font-subtitle">
                    {inDev ? t("moduleInDevCta") : t("moduleEnter")}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Mentor: empresas que acompaña. Al entrar, toda la app pasa a mostrar
          los datos de esa empresa hasta que salga. */}
      {!actingCompany && mentorCompanies.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-500" />
            <h2 className="font-title text-xl">{t("mentorCompaniesTitle")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mentorCompanies.map((c) => {
              const names = MODULES.filter((m) => c.modules.includes(m.key)).map((m) => t(m.nameKey));
              const canEnter = c.active && names.length > 0;
              return (
                <Card key={c.id} className="glass">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-11 h-11 bg-indigo-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-subtitle truncate">{c.name}</h3>
                      <p className="text-xs text-muted">
                        {!c.active
                          ? t("mentorCompanyRevoked")
                          : names.length > 0
                            ? names.join(" · ")
                            : t("companyNoModulesAssigned")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canEnter}
                      onClick={() => enterCompany(c)}
                      className="inline-flex items-center text-sm font-subtitle text-indigo-500 hover:underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
                    >
                      {t("moduleEnter")} <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Resumen ejecutivo con IA: junta los módulos del usuario en un
          documento. Vive fuera de los módulos (el Layout lo muestra en modo
          launcher), por eso va como tarjeta aparte debajo del grid. Por ahora
          solo para administradores: los clientes ven únicamente sus módulos. */}
      {isAdmin && modules.length > 0 && (
        <Card className="glass border-accent/30">
          <CardContent className="p-6 flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-grow min-w-0">
              <h2 className="font-title text-lg">Resumen ejecutivo con IA</h2>
              <p className="text-sm text-muted">
                Junta lo más importante de tus módulos en un documento para tu cliente o tu equipo.
              </p>
            </div>
            <Link
              to={createPageUrl("ExecutiveSummary")}
              className="inline-flex items-center text-accent text-sm font-subtitle hover:underline underline-offset-4"
            >
              Abrir <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
