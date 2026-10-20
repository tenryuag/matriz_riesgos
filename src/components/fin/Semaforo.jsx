// Semáforo de las razones financieras: punto de color y etiqueta.
// Un estatus null significa "no aplica" (gris). Los colores van en pares
// claro/oscuro para que funcionen en ambos temas.
import PropTypes from "prop-types";

export const STATUS_STYLES = {
  verde: { dot: "bg-green-500", text: "text-green-600 dark:text-green-500", label: "Sano" },
  ambar: { dot: "bg-amber-400", text: "text-amber-600 dark:text-amber-400", label: "Vigilar" },
  rojo: { dot: "bg-red-500", text: "text-red-500", label: "Atender" },
  na: { dot: "bg-muted-foreground/40", text: "text-muted", label: "No aplica" },
};

// Normaliza el estatus a una clave de STATUS_STYLES (null → 'na').
export function statusKey(status) {
  return status ?? "na";
}

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
