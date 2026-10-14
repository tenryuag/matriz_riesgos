// Chip con el nivel de un riesgo (Alto, Intolerable, …) con los mismos
// colores que la matriz. Sin nivel o sin clasificar → no se dibuja.
import PropTypes from "prop-types";
import { getRiskLevelColorClasses } from "@/lib/utils";
import { labelForLevelKey } from "@/config/riskCalc";

export default function RiskLevelChip({ levelKey, className = "" }) {
  if (!levelKey || levelKey === "UNCLASSIFIED") return null;
  const colors = getRiskLevelColorClasses();
  const label = labelForLevelKey(levelKey);
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-subtitle border flex-shrink-0 ${colors[levelKey] || "glass"} ${className}`}
    >
      {label}
    </span>
  );
}

RiskLevelChip.propTypes = {
  levelKey: PropTypes.string,
  className: PropTypes.string,
};
