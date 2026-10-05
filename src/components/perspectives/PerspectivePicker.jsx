// Selector de las 4 perspectivas. value: clave o null. onChange(key).
// variant "cards" (formulario) o "chips" (asistente, tablas).
import { useState } from "react";
import PropTypes from "prop-types";
import { HelpCircle } from "lucide-react";
import { PERSPECTIVES } from "@/config/perspectives";
import { useLanguage } from "@/components/LanguageContext";
import { iconForPerspective } from "./perspectiveIcons";

export default function PerspectivePicker({
  value,
  onChange,
  variant = "cards",
  disabled = false,
  showHelp = true,
}) {
  const { t } = useLanguage();
  const [helpOpen, setHelpOpen] = useState(false);

  // Clic sobre la perspectiva ya seleccionada no hace nada.
  const select = (key) => {
    if (disabled || key === value) return;
    onChange?.(key);
  };

  if (variant === "chips") {
    return (
      <div className="flex flex-wrap gap-2">
        {PERSPECTIVES.map((p) => {
          const selected = value === p.key;
          const Icon = iconForPerspective(p.key);
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => select(p.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selected ? `${p.colorClasses.label} ring-2 ring-accent/40` : "glass hover:border-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {p.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PERSPECTIVES.map((p) => {
          const selected = value === p.key;
          const Icon = iconForPerspective(p.key);
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => select(p.key)}
              className={`rounded-2xl p-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? `border-2 ${p.colorClasses.border} ${p.colorClasses.bg} ring-2 ring-accent/40`
                  : "glass hover:border-accent"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.colorClasses.bg}`}>
                  <Icon className={`w-5 h-5 ${p.colorClasses.text}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-subtitle">{p.label}</div>
                  <div className="text-xs text-muted">{p.short}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showHelp && (
        <div>
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            aria-expanded={helpOpen}
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <HelpCircle className="w-4 h-4" />
            {t("perspPickerHelp")}
          </button>
          {helpOpen && (
            <ul className="mt-3 space-y-3">
              {PERSPECTIVES.map((p) => (
                <li key={p.key} className="text-sm text-muted">
                  <span className={`font-subtitle ${p.colorClasses.text}`}>{p.label}</span>
                  <span className="mx-1.5">·</span>
                  {p.help}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

PerspectivePicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  variant: PropTypes.oneOf(["cards", "chips"]),
  disabled: PropTypes.bool,
  showHelp: PropTypes.bool,
};
