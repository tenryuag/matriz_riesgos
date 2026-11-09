// Nota para los riesgos críticos que aún no tienen perspectiva: entran al
// plan pero no pueden ubicarse en un carril del mapa. La perspectiva se
// asigna aquí mismo (sin ir a la matriz); el padre recarga con onAssigned.
import PropTypes from "prop-types";
import { CircleDashed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RiskLevelChip from "./RiskLevelChip";
import InlinePerspectivePicker from "./InlinePerspectivePicker";

export default function UnassignedRisksNote({ objectives, onAssigned }) {
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
          Estos riesgos entran a tu plan, pero no pueden ubicarse en un carril del mapa hasta que
          tengan perspectiva. Elige la perspectiva de cada uno aquí mismo; en cuanto la asignes, el
          riesgo aparece en su carril.
        </p>
        <ul className="space-y-3">
          {pending.map((o) => (
            <li key={o.id} className="p-3 glass rounded-lg text-sm space-y-3">
              <div className="flex items-start gap-2 min-w-0">
                <RiskLevelChip levelKey={o.level} className="mt-0.5" />
                <span className="break-words">{o.label}</span>
              </div>
              {o.riskId && (
                <InlinePerspectivePicker riskId={o.riskId} value={o.perspective} onSaved={onAssigned} />
              )}
            </li>
          ))}
        </ul>
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
  onAssigned: PropTypes.func,
};
