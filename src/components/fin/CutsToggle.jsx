import PropTypes from "prop-types";
import { History } from "lucide-react";

// Interruptor "Ver cortes anteriores". Solo aparece cuando algún año tiene
// más de un corte; recibe lo que devuelve useFinPeriods.
export default function CutsToggle({ periods, className = "" }) {
  if (!periods?.multiple) return null;
  const { showCuts, setShowCuts, hiddenCount } = periods;
  return (
    <div className={`flex items-center justify-between gap-3 flex-wrap text-xs text-muted ${className}`}>
      <span className="flex items-center gap-1.5">
        <History className="w-3.5 h-3.5 flex-shrink-0" />
        {showCuts
          ? "Se muestran todos los cortes. Cada corte se compara contra el cierre del año anterior."
          : "Se muestra el corte más reciente de cada año."}
      </span>
      <button
        type="button"
        onClick={() => setShowCuts(!showCuts)}
        aria-pressed={showCuts}
        className="px-3 py-1.5 rounded-lg glass hover:border-accent text-foreground font-subtitle transition-colors"
      >
        {showCuts
          ? "Ocultar cortes anteriores"
          : `Ver ${hiddenCount === 1 ? "el corte anterior" : `los ${hiddenCount} cortes anteriores`}`}
      </button>
    </div>
  );
}

CutsToggle.propTypes = {
  periods: PropTypes.shape({
    multiple: PropTypes.bool,
    showCuts: PropTypes.bool,
    setShowCuts: PropTypes.func,
    hiddenCount: PropTypes.number,
  }),
  className: PropTypes.string,
};
