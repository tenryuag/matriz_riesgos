// Chip de perspectiva con su color e icono. perspectiveKey null → "Sin asignar".
import PropTypes from "prop-types";
import { CircleDashed } from "lucide-react";
import { PERSPECTIVE_BY_KEY, isPerspectiveKey } from "@/config/perspectives";
import { useLanguage } from "@/components/LanguageContext";
import { iconForPerspective } from "./perspectiveIcons";

export default function PerspectiveBadge({ perspectiveKey, size = "sm", withIcon = true, className = "" }) {
  const { t } = useLanguage();
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  const base = `inline-flex items-center gap-1.5 rounded-full border ${sizeClasses}`;

  // Sin perspectiva (o clave inválida): chip punteado "Sin asignar".
  if (!isPerspectiveKey(perspectiveKey)) {
    return (
      <span className={`${base} glass text-muted border-dashed ${className}`}>
        {withIcon && <CircleDashed className="w-3.5 h-3.5" />}
        {t("perspUnassigned")}
      </span>
    );
  }

  const perspective = PERSPECTIVE_BY_KEY[perspectiveKey];
  const Icon = iconForPerspective(perspectiveKey);
  return (
    <span className={`${base} ${perspective.colorClasses.label} ${className}`}>
      {withIcon && <Icon className="w-3.5 h-3.5" />}
      {perspective.label}
    </span>
  );
}

PerspectiveBadge.propTypes = {
  perspectiveKey: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md"]),
  withIcon: PropTypes.bool,
  className: PropTypes.string,
};
