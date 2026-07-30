import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/components/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { getVisibleModules } from "@/config/modules";

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
  const { user } = useAuth();
  const { isAdmin, grantedModules, loading } = useModuleAccess();

  const modules = getVisibleModules({ isAdmin, grantedModules });

  const firstName =
    (user?.user_metadata?.full_name || user?.full_name || "")
      .trim()
      .split(" ")[0] || "";

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
      {/* Bienvenida */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-title">
          {firstName ? `Hola, ${firstName}` : t("welcome")}
        </h1>
        <p className="text-lg text-muted">
          ¿Con qué módulo quieres trabajar hoy?
        </p>
      </div>

      {/* Sin módulos asignados */}
      {modules.length === 0 && (
        <Card className="glass">
          <CardContent className="p-10 text-center text-muted">
            <p className="text-lg font-subtitle mb-2">{t("moduleNoneTitle")}</p>
            <p className="text-sm">{t("moduleNoneDesc")}</p>
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
    </div>
  );
}
