import PropTypes from "prop-types";
import { CATEGORY_BY_KEY } from "@/config/dependencyCalc";
import { CATEGORY_STYLES } from "@/components/dependency/styles";

// Clasificación de una actividad (la asigna el asistente, no se captura).
export default function CategoryChip({ category, className = "" }) {
  const def = CATEGORY_BY_KEY[category];
  if (!def) {
    return <span className={`text-xs text-muted whitespace-nowrap ${className}`}>Sin clasificar</span>;
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-subtitle whitespace-nowrap ${CATEGORY_STYLES[category].chip} ${className}`}
    >
      {def.label}
    </span>
  );
}

CategoryChip.propTypes = {
  category: PropTypes.string,
  className: PropTypes.string,
};
