// ============================================================
// Motor de cálculo del Análisis Financiero (funciones puras).
// Recibe las cifras cargadas con FinValue.getSections y devuelve los
// estados financieros calculados por año. Lo usan el Estado de Resultados,
// el Balance, los flujos, las razones y el dashboard.
// ============================================================
import {
  COST_CONCEPTS,
  EXPENSE_CONCEPTS,
  SALES_SECTION,
  EXPENSES_SECTION,
  INCOME_SECTION,
  BALANCE_SECTION,
  BALANCE_GROUPS,
  costSection,
  toNumber,
} from "./finConfig";

// Valor numérico de una celda (0 si está vacía).
const cell = (sections, section, key, yearId) =>
  toNumber(sections[section]?.[key]?.[yearId]) ?? 0;

// Suma de varias claves de una sección en un año.
const sumKeys = (sections, section, keys, yearId) =>
  keys.reduce((s, k) => s + cell(sections, section, k, yearId), 0);

// ---------- Estado de Resultados ----------
// Devuelve { [yearId]: { ventas, costo, utilidadBruta, admVentas, depreciacion,
//   otrosOp, resultadoOp, ebitda, prodFin, gastosFin, cambiaria, otrosProd,
//   rai, isr, ptu, utilidadNeta } } con las cifras reales del periodo.
export function computeIncome({ sections, years, lines }) {
  const out = {};
  years.forEach((y) => {
    const ventas = lines.reduce((s, l) => s + cell(sections, SALES_SECTION, l.id, y.id), 0);
    const costo = lines.reduce(
      (s, l) => s + sumKeys(sections, costSection(l.id), COST_CONCEPTS.map((c) => c.key), y.id),
      0
    );
    const admVentas = sumKeys(sections, EXPENSES_SECTION, EXPENSE_CONCEPTS.map((c) => c.key), y.id);
    const inp = (k) => cell(sections, INCOME_SECTION, k, y.id);
    const depreciacion = inp("depreciacion");
    const otrosOp = inp("otros_operacion");
    const prodFin = inp("productos_financieros");
    const gastosFin = inp("gastos_financieros");
    const cambiaria = inp("utilidad_cambiaria");
    const otrosProd = inp("otros_productos");
    const isr = inp("isr");
    const ptu = inp("ptu");

    const utilidadBruta = ventas - costo;
    const resultadoOp = utilidadBruta - admVentas - depreciacion + otrosOp;
    // EBITDA = resultado de operación + depreciación y amortización.
    const ebitda = resultadoOp + depreciacion;
    const rai = resultadoOp + prodFin - gastosFin + cambiaria + otrosProd;
    const utilidadNeta = rai - isr - ptu;

    out[y.id] = {
      ventas, costo, utilidadBruta, admVentas, depreciacion, otrosOp,
      resultadoOp, ebitda, prodFin, gastosFin, cambiaria, otrosProd,
      rai, isr, ptu, utilidadNeta,
    };
  });
  return out;
}

// Multiplica todas las partidas por un factor (para anualizar parciales).
export function scaleIncome(row, factor) {
  if (!row || factor === 1) return row;
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    out[k] = v * factor;
  });
  return out;
}

// ---------- Balance General ----------
const groupKeys = (gk) => BALANCE_GROUPS.find((g) => g.key === gk).items.map((i) => i.key);

// Devuelve { [yearId]: { activoCirculante, activoNoCirculante, totalActivo,
//   pasivoCirculante, pasivoLargoPlazo, totalPasivo, totalCapital,
//   totalPasivoCapital, diferencia } }.
export function computeBalance({ sections, years }) {
  const out = {};
  years.forEach((y) => {
    const g = (gk) => sumKeys(sections, BALANCE_SECTION, groupKeys(gk), y.id);
    const activoCirculante = g("activo_circulante");
    const activoNoCirculante = g("activo_no_circulante");
    const pasivoCirculante = g("pasivo_circulante");
    const pasivoLargoPlazo = g("pasivo_largo_plazo");
    const totalCapital = g("capital");
    const totalActivo = activoCirculante + activoNoCirculante;
    const totalPasivo = pasivoCirculante + pasivoLargoPlazo;
    const totalPasivoCapital = totalPasivo + totalCapital;
    out[y.id] = {
      activoCirculante, activoNoCirculante, totalActivo,
      pasivoCirculante, pasivoLargoPlazo, totalPasivo,
      totalCapital, totalPasivoCapital,
      diferencia: totalActivo - totalPasivoCapital,
    };
  });
  return out;
}

// Variación porcentual entre dos valores (null si no se puede calcular).
export const pctChange = (curr, prev) =>
  prev == null || prev === 0 || curr == null ? null : curr / Math.abs(prev) - 1;
