// ============================================================
// Motor de cálculo del Análisis Financiero (funciones puras).
// Recibe las cifras cargadas con FinValue.getSections y devuelve los
// estados financieros calculados por año: Estado de Resultados, Balance,
// flujos de efectivo y razones financieras con semáforo (computeRatios,
// ratioStatus, ratioTrend, summarizeRatios). Lo usan las pantallas del
// módulo, el Inicio como tablero y el servidor MCP (copia en
// supabase/functions/_shared/app vía `npm run mcp:sync`), por lo que NO
// puede importar React ni APIs del navegador.
// Verificación: `node scripts/check-finCalc.mjs`.
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
  annualizeFactor,
  CASHFLOW_ANNEX_SECTION,
  ANNEX_GROUPS,
  CASHFLOW_DIRECT_SECTION,
  DIRECT_GROUPS,
  DIRECT_INITIAL_KEY,
  RATIO_DEFS,
} from "./finConfig.js";

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

// ---------- Razones financieras ----------
// Fórmulas de la hoja "Razones Financieras" del Excel del cliente, con los
// signos corregidos (costos y gastos financieros en positivo), siempre la
// fila de Clientes para los días de cobranza y EBITDA = resultado de
// operación + depreciación. Los flujos de un año parcial se anualizan con
// annualizeFactor antes de calcular; los saldos del Balance no se tocan.

// Base de días para rotaciones (año comercial).
export const DAYS_BASE = 360;

// Motivos (en español, cortos) de los valores no calculables.
const NA_REASON = {
  pasivoCirculante: "Sin pasivo circulante",
  costo: "Sin costo de ventas",
  inventarios: "Sin inventarios",
  ventas: "Sin ventas",
  proveedores: "Sin crédito de proveedores",
  capital: "Capital contable negativo o cero",
  activos: "Sin activos",
  cajaCubre: "La caja cubre toda la deuda",
  ebitda: "EBITDA negativo o cero",
  gastosFin: "Sin gastos financieros",
  ciclo: "Sin ventas ni costo de ventas",
};

// Semáforo de un indicador según las bandas del catálogo. Solo bandas:
// devuelve null si no hay valor o si el indicador hereda su estatus.
export function ratioStatus(def, value) {
  if (value == null || !isFinite(value) || !def?.bands) return null;
  const b = def.bands;
  if (def.better === "higher") {
    return value >= b.greenMin ? "verde" : value >= b.amberMin ? "ambar" : "rojo";
  }
  if (def.better === "lower") {
    return value <= b.greenMax ? "verde" : value <= b.amberMax ? "ambar" : "rojo";
  }
  if (def.better === "range") {
    const inside = ([min, max]) => value >= min && value <= max;
    return inside(b.green) ? "verde" : inside(b.amber) ? "ambar" : "rojo";
  }
  return null;
}

// Devuelve { [yearId]: { factor, values, status, na, aux } }:
//   factor: 12/meses en años parciales (1 si es completo);
//   values: { [key]: number | null } para los 18 indicadores de RATIO_DEFS;
//   status: { [key]: 'verde' | 'ambar' | 'rojo' | null };
//   na:     { [key]: motivo } solo para los indicadores sin valor;
//   aux:    rotaciones, EBITDA, deuda bruta, promedios y cifras base
//           (los flujos ya anualizados).
export function computeRatios({ sections, years, lines }) {
  const income = computeIncome({ sections, years, lines });
  const balance = computeBalance({ sections, years });
  const bal = (k, yearId) => cell(sections, BALANCE_SECTION, k, yearId);
  const out = {};
  years.forEach((y, i) => {
    const factor = annualizeFactor(y);
    const inc = scaleIncome(income[y.id], factor);
    const prev = i > 0 ? years[i - 1] : null;
    // Promedio del saldo del año y del anterior; el saldo del año si es el primero.
    const promedio = (k) => (prev ? (bal(k, y.id) + bal(k, prev.id)) / 2 : bal(k, y.id));

    const { ventas, costo, ebitda, gastosFin, utilidadNeta } = inc;
    const {
      activoCirculante: ac,
      pasivoCirculante: pc,
      totalActivo: ta,
      totalPasivo: tp,
      totalCapital: tc,
    } = balance[y.id];
    const inventarios = bal("inventarios", y.id);
    const clientes = bal("clientes", y.id);
    const caja = bal("caja", y.id);
    const invProm = promedio("inventarios");
    const provProm = promedio("proveedores");
    const deudaBruta =
      bal("bancario_cp", y.id) + bal("porcion_circulante_lp", y.id) + bal("bancario_lp", y.id);

    const values = {};
    const na = {};
    const forced = {}; // estatus de los N/A que sí llevan semáforo
    const skip = (key, reason, st) => {
      values[key] = null;
      na[key] = reason;
      if (st) forced[key] = st;
    };

    // Liquidez
    if (pc <= 0) {
      skip("liquidez", NA_REASON.pasivoCirculante);
      skip("acido", NA_REASON.pasivoCirculante);
    } else {
      values.liquidez = ac / pc;
      values.acido = (ac - inventarios) / pc;
    }
    values.capital_trabajo = ac - pc;

    // Eficiencia
    let rotacionInventarios = null;
    let rotacionProveedores = null;
    if (costo <= 0) skip("dias_inventario", NA_REASON.costo);
    else if (invProm <= 0) skip("dias_inventario", NA_REASON.inventarios);
    else {
      rotacionInventarios = costo / invProm;
      values.dias_inventario = DAYS_BASE / rotacionInventarios;
    }
    if (ventas <= 0) skip("dias_clientes", NA_REASON.ventas);
    else values.dias_clientes = clientes / (ventas / DAYS_BASE);
    if (costo <= 0) skip("dias_proveedores", NA_REASON.costo);
    else if (provProm <= 0) skip("dias_proveedores", NA_REASON.proveedores);
    else {
      rotacionProveedores = costo / provProm;
      values.dias_proveedores = DAYS_BASE / rotacionProveedores;
    }
    // Los días no calculables cuentan como 0; si ninguno se pudo calcular
    // no hay ciclo que mostrar.
    const dias = [values.dias_inventario, values.dias_clientes, values.dias_proveedores];
    if (dias.every((d) => d == null)) skip("ciclo", NA_REASON.ciclo);
    else values.ciclo = (dias[0] ?? 0) + (dias[1] ?? 0) - (dias[2] ?? 0);

    // Apalancamiento
    if (tc <= 0) {
      skip("apalancamiento", NA_REASON.capital, "rojo");
      skip("apalancamiento_fin", NA_REASON.capital, "rojo");
    } else {
      values.apalancamiento = tp / tc;
      values.apalancamiento_fin = gastosFin / tc;
    }
    if (ta <= 0) skip("capitalizacion", NA_REASON.activos);
    else values.capitalizacion = tc / ta;
    values.deuda_neta = deudaBruta - caja;
    if (values.deuda_neta <= 0) skip("deuda_ebitda", NA_REASON.cajaCubre, "verde");
    else if (ebitda <= 0) skip("deuda_ebitda", NA_REASON.ebitda, "rojo");
    else values.deuda_ebitda = values.deuda_neta / ebitda;

    // Cobertura
    if (gastosFin <= 0) skip("cobertura", NA_REASON.gastosFin);
    else values.cobertura = ebitda / gastosFin;

    // Rentabilidad
    if (ventas <= 0) {
      skip("margen_bruto", NA_REASON.ventas);
      skip("margen_operativo", NA_REASON.ventas);
      skip("margen_neto", NA_REASON.ventas);
    } else {
      values.margen_bruto = inc.utilidadBruta / ventas;
      values.margen_operativo = inc.resultadoOp / ventas;
      values.margen_neto = utilidadNeta / ventas;
    }
    if (ta <= 0) skip("roa", NA_REASON.activos);
    else values.roa = utilidadNeta / ta;
    if (tc <= 0) skip("roe", NA_REASON.capital, "rojo");
    else values.roe = utilidadNeta / tc;

    // Semáforo: primero por bandas (o forzado en los N/A con estatus),
    // después las herencias (`statusFrom`).
    const status = {};
    RATIO_DEFS.forEach((d) => {
      if (!d.statusFrom) status[d.key] = forced[d.key] ?? ratioStatus(d, values[d.key]);
    });
    RATIO_DEFS.forEach((d) => {
      if (d.statusFrom) status[d.key] = status[d.statusFrom] ?? null;
    });

    out[y.id] = {
      factor,
      values,
      status,
      na,
      aux: {
        rotacion_inventarios: rotacionInventarios,
        rotacion_proveedores: rotacionProveedores,
        ebitda,
        deuda_bruta: deudaBruta,
        inventario_promedio: invProm,
        proveedores_promedio: provProm,
        ventas,
        costo,
        gastos_financieros: gastosFin,
        utilidad_neta: utilidadNeta,
        activo_circulante: ac,
        pasivo_circulante: pc,
        total_activo: ta,
        total_pasivo: tp,
        total_capital: tc,
        caja,
        clientes,
        inventarios,
      },
    };
  });
  return out;
}

// Tendencia del último periodo contra el anterior:
// 'mejora' | 'empeora' | 'igual' | null (sin alguno de los dos valores o
// indicador de rango, donde "más" no es mejor ni peor).
export function ratioTrend(def, curr, prev) {
  if (!def || curr == null || prev == null || def.better === "range") return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 1e-9) return "igual";
  const sube = diff > 0;
  return (def.better === "higher") === sube ? "mejora" : "empeora";
}

// Resumen del semáforo de un periodo (una entrada de computeRatios):
// { verde, ambar, rojo, na, atencion: [{ key, status, value }] }.
// `atencion` lleva primero todos los rojos y luego los ámbar, en el orden
// del catálogo; los N/A sin estatus no aparecen.
export function summarizeRatios(yearRatios) {
  const out = { verde: 0, ambar: 0, rojo: 0, na: 0, atencion: [] };
  if (!yearRatios) return out;
  const entry = (d) => ({
    key: d.key,
    status: yearRatios.status?.[d.key] ?? null,
    value: yearRatios.values?.[d.key] ?? null,
  });
  const rows = RATIO_DEFS.map(entry);
  rows.forEach((r) => {
    if (r.status) out[r.status] += 1;
    else out.na += 1;
  });
  out.atencion = [
    ...rows.filter((r) => r.status === "rojo"),
    ...rows.filter((r) => r.status === "ambar"),
  ];
  return out;
}
