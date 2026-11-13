import { useRef, useLayoutEffect } from "react";
import PropTypes from "prop-types";

// Captura de una cifra con separador de miles mientras se escribe
// (1,250,000.5). El valor que sube por `onChange` va SIN comas ("1250000.5"),
// igual que antes, así que el estado, el autoguardado y `toNumber` no cambian:
// las comas son solo de presentación.

// Deja solo dígitos, un punto decimal y, si se permite, un signo al inicio.
export function cleanAmountText(text, allowNegative = true) {
  let s = String(text ?? "").replace(/[^\d.-]/g, "");
  const negative = allowNegative && s.startsWith("-");
  s = s.replace(/-/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  return (negative ? "-" : "") + s;
}

// "1250000.5" → "1,250,000.5" (respeta un punto final o un "-" a medias).
export function formatAmountText(raw) {
  const s = String(raw ?? "");
  if (s === "" || s === "-") return s;
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  const [int, ...rest] = body.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + grouped + (rest.length ? `.${rest.join("")}` : "");
}

// Cuántos caracteres "con valor" (todo menos comas) hay antes del cursor.
const significantBefore = (text, pos) => text.slice(0, pos).replace(/,/g, "").length;

// Posición del cursor en `formatted` que deja `count` caracteres con valor antes.
function caretFor(formatted, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (formatted[i] !== ",") seen += 1;
    if (seen === count) return i + 1;
  }
  return formatted.length;
}

export default function MoneyInput({ value, onChange, allowNegative = true, className = "", ...rest }) {
  const ref = useRef(null);
  const caret = useRef(null); // caracteres con valor antes del cursor tras el último cambio
  const shown = formatAmountText(cleanAmountText(value, true));

  // Al reformatear, React manda el cursor al final: se regresa a su lugar.
  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    if (document.activeElement === ref.current) {
      const pos = caretFor(ref.current.value, caret.current);
      ref.current.setSelectionRange(pos, pos);
    }
    caret.current = null;
  });

  const handleChange = (e) => {
    const el = e.target;
    const raw = cleanAmountText(el.value, allowNegative);
    const before = cleanAmountText(el.value.slice(0, el.selectionStart ?? el.value.length), allowNegative);
    caret.current = significantBefore(before, before.length);
    onChange(raw);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onChange={handleChange}
      placeholder="0"
      className={className}
      {...rest}
    />
  );
}

MoneyInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  allowNegative: PropTypes.bool,
  className: PropTypes.string,
};
