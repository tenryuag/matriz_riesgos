import PropTypes from "prop-types";
import { Sparkles } from "lucide-react";

// Nota al pie de todo lo que genera el asistente: quién lo hizo, cuándo y
// que es una sugerencia a revisar. `generatedAt` es un ISO string o Date.
// `text` (opcional) sustituye el texto fijo, por ejemplo con la versión
// traducida (t('iaDisclaimerShort')); la fecha y el sufijo de `cached` se
// conservan, añadidos al final entre paréntesis.
const CACHED_SUFFIX = "guardado; tus datos no han cambiado";

export default function IaDisclaimer({ generatedAt, cached = false, text, className = "" }) {
  const when = generatedAt ? new Date(generatedAt) : null;
  const fecha =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
      : null;
  const extra = [fecha, cached ? CACHED_SUFFIX : null].filter(Boolean).join("; ");
  return (
    <p className={`text-[11px] text-muted flex items-start gap-1.5 ${className}`}>
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-px text-accent" />
      <span>
        {text ? (
          <>
            {text}
            {extra ? ` (${extra})` : ""}
          </>
        ) : (
          <>
            Generado con IA{fecha ? ` el ${fecha}` : ""}
            {cached ? ` (${CACHED_SUFFIX})` : ""}. Es una sugerencia: revísala con tu criterio y el de tu
            asesor antes de tomar decisiones.
          </>
        )}
      </span>
    </p>
  );
}

IaDisclaimer.propTypes = {
  generatedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  cached: PropTypes.bool,
  text: PropTypes.string,
  className: PropTypes.string,
};
