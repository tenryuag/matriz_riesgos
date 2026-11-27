// Semáforo de las razones financieras: punto de color y etiqueta.
// Un estatus null significa "no aplica" (gris). Los colores van en pares
// claro/oscuro para que funcionen en ambos temas.
import PropTypes from "prop-types";
import { STATUS_STYLES, statusKey } from "@/components/fin/semaforoStyles";

const styleOf = (status) => STATUS_STYLES[statusKey(status)] || STATUS_STYLES.na;

export function SemaforoDot({ status, className = "" }) {
  const s = styleOf(status);
  return (
    <span
      role="img"
      aria-label={s.label}
      title={s.label}
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot} ${className}`}
    />
  );
}

SemaforoDot.propTypes = {
  status: PropTypes.oneOf(["verde", "ambar", "rojo"]),
  className: PropTypes.string,
};

export function SemaforoBadge({ status }) {
  const s = styleOf(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-subtitle glass whitespace-nowrap ${s.text}`}
    >
      <SemaforoDot status={status} />
      {s.label}
    </span>
  );
}

SemaforoBadge.propTypes = {
  status: PropTypes.oneOf(["verde", "ambar", "rojo"]),
};
