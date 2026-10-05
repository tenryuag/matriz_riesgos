// Aviso permanente mientras haya riesgos sin perspectiva. count 0 → no renderiza nada.
// La página que lo usa calcula count como migrationProgress(risks).unassigned.
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Wand2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";

export default function MigrationBanner({ count }) {
  const { t } = useLanguage();
  if (!count) return null;

  return (
    <div className="rounded-3xl p-5 border-2 border-accent/40 bg-accent/10 backdrop-blur-xl flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-6 h-6 text-accent" />
        </div>
        <div className="min-w-0">
          <h3 className="font-title text-base">{t("perspBannerTitle", { count })}</h3>
          <p className="text-sm text-muted">{t("perspBannerDesc")}</p>
        </div>
      </div>
      <Link to={createPageUrl("PerspectiveMigration")} className="w-full md:w-auto">
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto">
          {t("perspBannerAction")}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}

MigrationBanner.propTypes = {
  count: PropTypes.number,
};
