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
  CASHFLOW_ANNEX_SECTION,
  ANNEX_GROUPS,
  CASHFLOW_DIRECT_SECTION,
  DIRECT_GROUPS,
  DIRECT_INITIAL_KEY,
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

// ---------- Estado de cambios (método indirecto) ----------

// Cuentas de capital de trabajo: los activos restan su aumento, los
// pasivos lo suman.
export const WORKING_CAPITAL = [
  { key: "clientes", label: "Clientes", kind: "asset" },
  { key: "otras_cxc", label: "Otras cuentas por cobrar", kind: "asset" },
  { key: "inventarios", label: "Inventarios", kind: "asset" },
  { key: "pagos_anticipados", label: "Pagos anticipados", kind: "asset" },
  { key: "impuestos_recuperar", label: "Impuestos por recuperar", kind: "asset" },
  { key: "cxc_relacionadas", label: "Cuentas por cobrar a compañías relacionadas", kind: "asset" },
  { key: "otros_circulantes", label: "Otros activos circulantes", kind: "asset" },
  { key: "proveedores", label: "Proveedores", kind: "liability" },
  { key: "acreedores", label: "Acreedores diversos", kind: "liability" },
  { key: "impuestos_pagar", label: "Impuestos por pagar", kind: "liability" },
  { key: "cias_relacionadas", label: "Compañías relacionadas (pasivo)", kind: "liability" },
  { key: "anticipos", label: "Anticipos de clientes", kind: "liability" },
  { key: "gastos_acumulados", label: "Gastos acumulados", kind: "liability" },
  { key: "otras_cxp", label: "Otras cuentas por pagar", kind: "liability" },
];

// Calcula el flujo de cada año a partir del año anterior. Devuelve
// { [yearId]: {...} } solo para los años que tienen un año previo.
export function computeCashflow({ sections, years, lines }) {
  const income = computeIncome({ sections, years, lines });
  const bal = (k, yearId) => cell(sections, BALANCE_SECTION, k, yearId);
  const annex = (k, yearId) => cell(sections, CASHFLOW_ANNEX_SECTION, k, yearId);
  const out = {};
  years.forEach((y, i) => {
    if (i === 0) return;
    const p = years[i - 1];
    const d = (k) => bal(k, y.id) - bal(k, p.id);

    const utilidadNeta = income[y.id]?.utilidadNeta ?? 0;
    const depreciacion = income[y.id]?.depreciacion ?? 0;
    const provisiones = d("provisiones");
    const impuestoDiferido = d("impuesto_diferido_pasivo") - d("impuesto_diferido_activo");
    const workingCapital = {};
    let wcTotal = 0;
    WORKING_CAPITAL.forEach((w) => {
      const v = w.kind === "asset" ? -d(w.key) : d(w.key);
      workingCapital[w.key] = v;
      wcTotal += v;
    });
    const flujoOperacion = utilidadNeta + depreciacion + provisiones + impuestoDiferido + wcTotal;

    const signed = {};
    const groupTotal = (gk) =>
      ANNEX_GROUPS.find((g) => g.key === gk).items.reduce((s, it) => {
        const v = it.sign * annex(it.key, y.id);
        signed[it.key] = v;
        return s + v;
      }, 0);
    const flujoInversion = groupTotal("inversion");
    const flujoFinanciamiento = groupTotal("financiamiento");
    const flujoNeto = flujoOperacion + flujoInversion + flujoFinanciamiento;
    const cajaInicial = bal("caja", p.id);
    const cajaFinalCalculada = cajaInicial + flujoNeto;
    const cajaFinalBalance = bal("caja", y.id);

    // Conciliación del anexo contra el balance.
    const capexNeto = annex("capex_adquisicion", y.id) - annex("capex_venta", y.id);
    const deltaActivosFijos = d("activos_fijos") + depreciacion;
    const deudaCpNeta = annex("deuda_cp_disposicion", y.id) - annex("deuda_cp_pago", y.id);
    const deltaDeudaCp = d("bancario_cp") + d("porcion_circulante_lp");
    const deudaLpNeta = annex("deuda_lp_disposicion", y.id) - annex("deuda_lp_pago", y.id);
    const deltaDeudaLp = d("bancario_lp");

    out[y.id] = {
      prevYearId: p.id,
      utilidadNeta, depreciacion, provisiones, impuestoDiferido,
      workingCapital, wcTotal, flujoOperacion,
      signed, flujoInversion, flujoFinanciamiento, flujoNeto,
      cajaInicial, cajaFinalCalculada, cajaFinalBalance,
      diferencia: cajaFinalCalculada - cajaFinalBalance,
      reconciliation: [
        { label: "CAPEX neto (adquisición − venta)", captured: capexNeto, balance: deltaActivosFijos, balanceLabel: "Δ activos fijos + depreciación" },
        { label: "Deuda a corto plazo neta", captured: deudaCpNeta, balance: deltaDeudaCp, balanceLabel: "Δ bancario CP + porción circulante LP" },
        { label: "Deuda a largo plazo neta", captured: deudaLpNeta, balance: deltaDeudaLp, balanceLabel: "Δ bancario LP" },
      ],
    };
  });
  return out;
}

// ---------- Flujo de efectivo directo ----------
// El saldo inicial se captura solo en el primer año; después es el
// acumulado del año anterior.
export function computeDirectCashflow({ sections, years }) {
  const v = (k, yearId) => cell(sections, CASHFLOW_DIRECT_SECTION, k, yearId);
  const out = {};
  let prevAcumulado = null;
  years.forEach((y, i) => {
    const groups = {};
    DIRECT_GROUPS.forEach((g) => {
      groups[g.key] = g.items.reduce((s, it) => s + v(it.key, y.id), 0);
    });
    const flujoOperacion = groups.entradas - groups.salidas;
    const flujoNeto = flujoOperacion + groups.inversion + groups.financiamiento;
    const saldoInicial = i === 0 ? v(DIRECT_INITIAL_KEY, y.id) : prevAcumulado;
    const acumulado = saldoInicial + flujoNeto;
    prevAcumulado = acumulado;
    out[y.id] = { groups, flujoOperacion, flujoNeto, saldoInicial, acumulado, initialIsInput: i === 0 };
  });
  return out;
}
