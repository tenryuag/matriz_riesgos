// Cómo se comparan dos periodos de un renglón del Estado de Resultados.
// Lo comparten el Estado de Resultados y el Comparativo de cortes para que
// los colores digan lo mismo en ambas pantallas.

// Renglones de costo o gasto: menos es mejor, tanto en monto como en su peso
// sobre ventas. Cada variación lleva su propio color (lámina 2 del mentor):
// un gasto puede subir en monto (rojo) y aun así pesar menos sobre las ventas
// (verde), que es la señal de que la empresa es más eficiente.
export const COST_ROWS = new Set(["costo", "gastoVenta", "gastoAdmin", "gastoGeneral", "gastoOperativo", "gastosFin", "isr", "ptu"]);

// Devuelve los valores a comparar y qué dirección es buena para el monto y
// para el % sobre ventas.
//  - Costos y gastos: menos es mejor en monto y en puntos porcentuales.
//  - Resultado integral de financiamiento cuando es un costo neto (negativo)
//    en ambos periodos: se compara como costo, por su tamaño; si baja, verde.
//  - Utilidades y resultados: más es mejor en monto y en puntos.
export function incomeComparison(calc, curr, prev, currPct, prevPct) {
  if (COST_ROWS.has(calc)) {
    return { curr, prev, currPct, prevPct, amountBetter: "lower", pctBetter: "lower" };
  }
  if (calc === "rif" && curr <= 0 && prev < 0) {
    const neg = (v) => (v == null ? null : -v);
    return { curr: -curr, prev: -prev, currPct: neg(currPct), prevPct: neg(prevPct), amountBetter: "lower", pctBetter: "lower" };
  }
  return { curr, prev, currPct, prevPct, amountBetter: "higher", pctBetter: "higher" };
}
