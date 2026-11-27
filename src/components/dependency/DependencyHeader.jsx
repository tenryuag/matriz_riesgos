import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { FIELD_CLASS, measurementLabel } from "@/components/dependency/styles";

// Encabezado de las pantallas del módulo: título, medición abierta (con
// selector si hay más de una) y las acciones de la pantalla.
export default function DependencyHeader({ icon: Icon, title, subtitle, list = [], measurement, onSelect, back = true, children }) {
  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-4">
        {back && (
          <Link to={createPageUrl("DependencyHome")} aria-label="Volver al inicio del módulo">
            <Button variant="ghost" size="icon" className="glass">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
        )}
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <div className="w-12 h-12 bg-violet-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-violet-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-title">{title}</h1>
            {subtitle && <p className="text-muted">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex flex-wrap gap-2 w-full sm:w-auto">{children}</div>}
      </div>
      {measurement && list.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm" data-view-control>
          <span className="text-muted">Medición:</span>
          <select
            value={measurement.id}
            onChange={(e) => onSelect(e.target.value)}
            className={`${FIELD_CLASS} py-1.5 w-auto max-w-full`}
          >
            {list.map((m, i) => (
              <option key={m.id} value={m.id}>
                {measurementLabel(m, i)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

DependencyHeader.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  list: PropTypes.array,
  measurement: PropTypes.object,
  onSelect: PropTypes.func,
  back: PropTypes.bool,
  children: PropTypes.node,
};
