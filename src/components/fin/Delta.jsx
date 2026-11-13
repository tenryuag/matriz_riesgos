import PropTypes from "prop-types";
import { pctChange } from "@/config/finCalc";
import { fmtPct, annualizeFactor } from "@/config/finConfig";

// Variación de una cifra contra el periodo anterior, en el estilo de la app:
// ▲ verde cuando el cambio es bueno, ▼ rojo cuando es malo. Qué es "bueno" lo
// decide `better`: 'higher' (ventas, utilidades, activos), 'lower' (costos,
// gastos, pasivos) o 'neutral' (gris, solo informa la dirección).
//
// Si alguno de los dos periodos es parcial, las cifras se anualizan antes de
// comparar (×12/meses) y se indica "anualizado"; así un semestre se compara
// contra el año completo anterior sin engañar.

const GOOD = "text-green-600 dark:text-green-500";
const BAD = "text-red-500";
const FLAT = "text-muted";

export function annualized(value, year) {
  if (value == null || !year) return value ?? null;
  return value * annualizeFactor(year);
}

// Fracción de cambio entre dos periodos (anualizando parciales), o null.
export function deltaBetween(curr, prev, currYear, prevYear) {
  if (curr == null || prev == null) return null;
  return pctChange(annualized(curr, currYear), annualized(prev, prevYear));
}

export function deltaClass(delta, better = "higher") {
  if (delta == null) return FLAT;
  if (Math.abs(delta) < 0.0005) return FLAT;
  if (better === "neutral") return FLAT;
  const up = delta > 0;
  const good = better === "lower" ? !up : up;
  return good ? GOOD : BAD;
}

export function Delta({ curr, prev, currYear, prevYear, better = "higher", className = "" }) {
  const delta = deltaBetween(curr, prev, currYear, prevYear);
  if (delta == null) return null;
  const flat = Math.abs(delta) < 0.0005;
  const partial = (currYear && currYear.months < 12) || (prevYear && prevYear.months < 12);
  const title = flat
    ? "Sin cambio respecto al periodo anterior"
    : `${delta > 0 ? "Sube" : "Baja"} ${fmtPct(Math.abs(delta))} respecto al periodo anterior${partial ? " (anualizado)" : ""}`;
  return (
    <span className={`block text-[11px] whitespace-nowrap ${deltaClass(delta, better)} ${className}`} title={title}>
      {flat ? "= sin cambio" : `${delta > 0 ? "▲" : "▼"} ${fmtPct(Math.abs(delta))}`}
      {partial && !flat && <span className="text-muted font-normal"> · anualizado</span>}
    </span>
  );
}

// Variación de un porcentaje sobre ventas (un margen o el peso de un gasto)
// contra el periodo anterior, en puntos porcentuales: de 35.0 % a 33.2 % son
// ▼ 1.8 pp. No se anualiza: es una proporción, no un monto. `curr` y `prev`
// son fracciones (0.35). `better` decide el color igual que en <Delta>.
export function DeltaPP({ curr, prev, better = "higher", className = "" }) {
  if (curr == null || prev == null || !isFinite(curr) || !isFinite(prev)) return null;
  const diff = curr - prev;
  const pp = Math.abs(diff * 100);
  const flat = pp < 0.05;
  const title = flat
    ? "Mismo porcentaje sobre ventas que el periodo anterior"
    : `${diff > 0 ? "Sube" : "Baja"} ${pp.toFixed(1)} puntos porcentuales sobre ventas respecto al periodo anterior`;
  return (
    <span className={`block text-[11px] whitespace-nowrap ${flat ? FLAT : deltaClass(diff, better)} ${className}`} title={title}>
      {flat ? "= 0.0 pp" : `${diff > 0 ? "▲" : "▼"} ${pp.toFixed(1)} pp`}
    </span>
  );
}

DeltaPP.propTypes = {
  curr: PropTypes.number,
  prev: PropTypes.number,
  better: PropTypes.oneOf(["higher", "lower", "neutral"]),
  className: PropTypes.string,
};

const yearShape = PropTypes.shape({ id: PropTypes.string, year: PropTypes.number, months: PropTypes.number });

Delta.propTypes = {
  curr: PropTypes.number,
  prev: PropTypes.number,
  currYear: yearShape,
  prevYear: yearShape,
  better: PropTypes.oneOf(["higher", "lower", "neutral"]),
  className: PropTypes.string,
};

// Cifra en miles con los negativos en rojo (y en negrita cuando es un total).
export function Money({ v, strong = false, className = "" }) {
  const n = Number.isFinite(v) && Math.abs(v) >= 0.05 ? v : 0;
  return (
    <span className={`${n < 0 ? BAD : ""} ${strong ? "font-subtitle" : ""} ${className}`}>
      {new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n)}
    </span>
  );
}

Money.propTypes = {
  v: PropTypes.number,
  strong: PropTypes.bool,
  className: PropTypes.string,
};
