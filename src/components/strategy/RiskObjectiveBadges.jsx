// Fila de chips de un objetivo de riesgo: "Riesgo crítico", nivel,
// perspectiva y, si aplica, "Aceptado" / "Controlado".
import PropTypes from "prop-types";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import PerspectiveBadge from "@/components/perspectives/PerspectiveBadge";
import RiskLevelChip from "./RiskLevelChip";

const CHIP = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-subtitle border flex-shrink-0";

export default function RiskObjectiveBadges({ objective, showPerspective = true, className = "" }) {
  if (!objective) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 items-center ${className}`}>
      <span className={`${CHIP} bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40`}>
        <ShieldAlert className="w-3.5 h-3.5" />
        Riesgo crítico
      </span>
      <RiskLevelChip levelKey={objective.level} />
      {showPerspective && <PerspectiveBadge perspectiveKey={objective.perspective} />}
      {objective.accepted && (
        <span className={`${CHIP} bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/40`}>
          Aceptado
        </span>
      )}
      {objective.accepted && objective.acknowledged && (
        <span className={`${CHIP} bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/40`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Controlado
        </span>
      )}
    </div>
  );
}

RiskObjectiveBadges.propTypes = {
  objective: PropTypes.shape({
    level: PropTypes.string,
    perspective: PropTypes.string,
    accepted: PropTypes.bool,
    acknowledged: PropTypes.bool,
  }),
  showPerspective: PropTypes.bool,
  className: PropTypes.string,
};
