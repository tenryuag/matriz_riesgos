// Tarjeta de avisos sobre riesgos críticos e iniciativas de riesgo.
// Agrupa por tipo (una línea cada uno) y deja ver el detalle completo bajo
// demanda. Los avisos nunca bloquean: solo orientan.
import { useState } from "react";
import PropTypes from "prop-types";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { summarizeRiskWarnings } from "@/config/strategicCalc";

const LINE = "flex items-center justify-between gap-2 p-2.5 glass rounded-lg text-sm";

function anchorFor(warning) {
  if (warning.initiativeId) return `#initiative-${warning.initiativeId}`;
  if (warning.riskId) return `#risk-${warning.riskId}`;
  return "";
}

export default function RiskWarningsCard({ warnings, title = "Avisos sobre tus riesgos" }) {
  const [open, setOpen] = useState(false);
  if (!warnings || warnings.length === 0) return null;
  const lines = summarizeRiskWarnings(warnings);

  return (
    <Card className="glass border-amber-400/40">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <h2 className="font-subtitle text-sm uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {title}
          </h2>
        </div>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.type}>
              {line.hash ? (
                <a href={line.hash} className={`${LINE} hover:border-accent transition-all`}>
                  <span>{line.label}</span>
                </a>
              ) : (
                <span className={LINE}>{line.label}</span>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-xs text-accent hover:underline"
        >
          {open ? "Ocultar detalle" : "Ver detalle"}
        </button>
        {open && (
          <ul className="mt-2 space-y-1.5 text-xs">
            {warnings.map((w, i) => {
              const href = anchorFor(w);
              return (
                <li key={`${w.type}-${w.initiativeId || w.riskId || i}`} className="flex gap-2">
                  <span className="text-amber-500 flex-shrink-0">•</span>
                  {href ? (
                    <a href={href} className="hover:text-accent transition-colors">
                      {w.message}
                    </a>
                  ) : (
                    <span>{w.message}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted mt-3">Son avisos, no bloqueos: puedes guardar igual.</p>
      </CardContent>
    </Card>
  );
}

RiskWarningsCard.propTypes = {
  warnings: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      message: PropTypes.string,
      riskId: PropTypes.string,
      initiativeId: PropTypes.string,
    })
  ).isRequired,
  title: PropTypes.string,
};
