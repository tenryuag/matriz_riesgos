import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Hammer, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";
import { MODULES } from "@/config/modules";

// Pantalla amigable para módulos que aún no se desarrollan. Se muestra al
// entrar a un módulo con status 'in-development' desde el selector.
export default function ModuleInDevelopment() {
  const { t } = useLanguage();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const moduleKey = params.get("module");
  const mod = MODULES.find((m) => m.key === moduleKey);
  const moduleName = mod ? t(mod.nameKey) : "";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center glass rounded-3xl p-10">
        <div className="mx-auto w-20 h-20 bg-amber-400/15 rounded-3xl flex items-center justify-center mb-6">
          <Hammer className="w-10 h-10 text-amber-500" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border border-amber-400/40 bg-amber-400/10 text-amber-500 mb-4">
          <Clock className="w-3 h-3" /> {t("moduleInDevBadge")}
        </span>

        <h1 className="text-2xl md:text-3xl font-title mb-3">
          {moduleName || t("moduleInDevTitle")}
        </h1>
        <p className="text-muted mb-8 leading-relaxed">
          {t("moduleInDevBody")}
        </p>

        <Link to={createPageUrl("ModuleLauncher")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("moduleBackToLauncher")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
