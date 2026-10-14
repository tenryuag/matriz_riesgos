// Nota para los riesgos críticos que aún no tienen perspectiva: entran al
// plan pero no pueden ubicarse en un carril del mapa. Enlaza a corregir
// cada riesgo y al asistente de perspectivas.
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { CircleDashed } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import RiskLevelChip from "./RiskLevelChip";

export default function UnassignedRisksNote({ objectives }) {
  const pending = (objectives || []).filter((o) => !o.perspective);
  if (pending.length === 0) return null;

  return (
    <Card className="glass border-dashed">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <CircleDashed className="w-4 h-4 text-muted flex-shrink-0" />
          <h2 className="font-subtitle text-sm uppercase tracking-wide">
            Riesgos críticos sin perspectiva ({pending.length})
          </h2>
        </div>
        <p className="text-sm text-muted mb-3">
          Estos riesgos entran a tu plan, pero no pueden ubicarse en un carril del mapa hasta que les
          asignes perspectiva.
        </p>
        <ul className="space-y-2">
          {pending.map((o) => (
            <li
              key={o.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 glass rounded-lg text-sm"
            >
              <div className="flex items-start gap-2 min-w-0">
                <RiskLevelChip levelKey={o.level} className="mt-0.5" />
                <span className="break-words">{o.label}</span>
              </div>
              <Link
                to={createPageUrl(`AddRisk?id=${o.riskId}`)}
                className="text-xs text-accent hover:underline flex-shrink-0"
              >
                Asignar perspectiva →
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs">
          <Link to={createPageUrl("PerspectiveMigration")} className="text-accent hover:underline">
            Abrir el asistente de perspectivas →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

UnassignedRisksNote.propTypes = {
  objectives: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      riskId: PropTypes.string,
      label: PropTypes.string,
      level: PropTypes.string,
      perspective: PropTypes.string,
    })
  ).isRequired,
};
