// ============================================================
// Motor de cálculo del Análisis Financiero (funciones puras, modelo
// MP-AFH1). Recibe las cifras cargadas con FinValue.getSections
// ({ [section]: { [conceptKey]: { [yearId]: amount } } }) y la lista de
// años ([{ id, year, months }]) y devuelve los estados financieros
// calculados por año: Estado de Resultados, Balance, EBITDA, Estado de
// cambios en la situación financiera, razones financieras con semáforo y
// los análisis opcionales (segmentos, desglose del gasto, estacionalidad).
// Lo usan las pantallas del módulo, el Inicio como tablero y el servidor
// MCP (copia en supabase/functions/_shared/app vía `npm run mcp:sync`),
// por lo que NO puede importar React ni APIs del navegador.
// Convención de signos: costos, gastos e impuestos del Estado de Resultados
// se capturan en positivo y aquí se restan; las partidas marcadas `signed`
// en finConfig llevan signo (utilidad +, pérdida/gasto −); las cuentas del
// Balance llevan su signo contable (resultados acumulados negativos con
// pérdidas) y se suman tal cual.
// Verificación: `node scripts/check-finCalc.mjs`.
// ============================================================
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  SALES_SECTION,
  SEGCOST_SECTION,
  EXPENSES_SECTION,
  SEASONALITY_SECTION,
  BALANCE_GROUPS,
  ALL_BALANCE_KEYS,
  EXPENSE_CONCEPTS,
  SEASON_MONTHS,
  RATIO_DEFS,
  toNumber,
} from "./finConfig.js";

// Valor numérico de una celda (0 si está vacía).
const cell = (sections, section, key, yearId) =>
  toNumber(sections?.[section]?.[key]?.[yearId]) ?? 0;

// Suma de varias claves de una sección en un año.
const sumKeys = (sections, section, keys, yearId) =>
  keys.reduce((s, k) => s + cell(sections, section, k, yearId), 0);

const sum = (arr) => arr.reduce((s, v) => s + v, 0);

// Proporción segura: null cuando la base no es positiva.
const share = (v, base) => (base > 0 ? v / base : null);

// Meses del periodo (12 si el año no lo trae).
const monthsOf = (y) => (y && y.months > 0 ? y.months : 12);

// Base de días del año comercial completo (12 meses × 30).
export const DAYS_BASE = 360;

// Días del periodo para las rotaciones: meses × 30 (180 en un semestre).
export const periodDays = (y) => monthsOf(y) * 30;

// Variación porcentual entre dos valores (null si no se puede calcular).
export const pctChange = (curr, prev) =>
  prev == null || prev === 0 || curr == null ? null : curr / Math.abs(prev) - 1;

// ---------- Estado de Resultados ----------
// Devuelve { [yearId]: { ventas, costo, utilidadBruta, gastoVenta, gastoAdmin,
//   gastoGeneral, gastoOperativo, resultadoOp, prodFin, gastosFin, cambiaria,
//   rif, otrosProd, rai, isr, ptu, utilidadNeta, depreciacion, reservaCxc,
//   reservaInventarios, pct: { [mismaClave]: valor / ventas | null } } }
// con las cifras REALES del periodo (sin anualizar). Costos, gastos e
// impuestos llegan en positivo y aquí se restan.
export function computeIncome({ sections, years }) {
  const out = {};
  (years || []).forEach((y) => {
    const inp = (k) => cell(sections, INCOME_SECTION, k, y.id);
    const ventas = inp("ventas");
    const costo = inp("costo");
    const gastoVenta = inp("gasto_venta");
    const gastoAdmin = inp("gasto_admin");
    const gastoGeneral = inp("gasto_general");
    const prodFin = inp("productos_financieros");
    const gastosFin = inp("gastos_financieros");
    const cambiaria = inp("utilidad_cambiaria");
    const otrosProd = inp("otros_productos");
    const isr = inp("isr");
    const ptu = inp("ptu");
    // Partidas que no son efectivo (memo): no alteran los totales.
    const depreciacion = inp("depreciacion");
    const reservaCxc = inp("reserva_cxc");
    const reservaInventarios = inp("reserva_inventarios");

    const utilidadBruta = ventas - costo;
    const gastoOperativo = gastoVenta + gastoAdmin + gastoGeneral;
    const resultadoOp = utilidadBruta - gastoOperativo;
    const rif = prodFin - gastosFin + cambiaria;
    const rai = resultadoOp + rif + otrosProd;
    const utilidadNeta = rai - isr - ptu;

    const row = {
      ventas, costo, utilidadBruta,
      gastoVenta, gastoAdmin, gastoGeneral, gastoOperativo, resultadoOp,
      prodFin, gastosFin, cambiaria, rif, otrosProd, rai, isr, ptu, utilidadNeta,
      depreciacion, reservaCxc, reservaInventarios,
    };
    const pct = {};
    Object.entries(row).forEach(([k, v]) => {
      pct[k] = share(v, ventas);
    });
    out[y.id] = { ...row, pct };
  });
  return out;
}

// ---------- Balance General ----------
const groupKeys = (gk) => BALANCE_GROUPS.find((g) => g.key === gk).items.map((i) => i.key);

// Devuelve { [yearId]: { activoCirculante, activoNoCirculante, totalActivo,
//   pasivoCirculante, pasivoLargoPlazo, totalPasivo, resultadoPeriodo,
//   totalCapital, totalPasivoCapital, diferencia, acumuladosSugerido,
//   pct: { [cuenta | total]: valor / totalActivo | null } } }.
// `resultadoPeriodo` no se captura: es la utilidad neta del Estado de
// Resultados y entra en `totalCapital`. `diferencia` = activo − (pasivo +
// capital) debe ser 0. `acumuladosSugerido` = resultados acumulados del año
// anterior + su utilidad neta (null en el primer año); solo es una pista.
export function computeBalance({ sections, years }) {
  const income = computeIncome({ sections, years });
  const out = {};
  (years || []).forEach((y, i) => {
    const bal = (k, yearId = y.id) => cell(sections, BALANCE_SECTION, k, yearId);
    const g = (gk) => sumKeys(sections, BALANCE_SECTION, groupKeys(gk), y.id);
    const activoCirculante = g("activo_circulante");
    const activoNoCirculante = g("activo_no_circulante");
    const pasivoCirculante = g("pasivo_circulante");
    const pasivoLargoPlazo = g("pasivo_largo_plazo");
    const resultadoPeriodo = income[y.id]?.utilidadNeta ?? 0;
    const totalCapital = g("capital") + resultadoPeriodo;
    const totalActivo = activoCirculante + activoNoCirculante;
    const totalPasivo = pasivoCirculante + pasivoLargoPlazo;
    const totalPasivoCapital = totalPasivo + totalCapital;
    const prev = i > 0 ? years[i - 1] : null;
    const acumuladosSugerido = prev
      ? bal("resultados_acumulados", prev.id) + (income[prev.id]?.utilidadNeta ?? 0)
      : null;

    const totals = {
      activoCirculante, activoNoCirculante, totalActivo,
      pasivoCirculante, pasivoLargoPlazo, totalPasivo,
      resultadoPeriodo, totalCapital, totalPasivoCapital,
    };
    const pct = {};
    ALL_BALANCE_KEYS.forEach((k) => {
      pct[k] = share(bal(k), totalActivo);
    });
    Object.entries(totals).forEach(([k, v]) => {
      pct[k] = share(v, totalActivo);
    });
    out[y.id] = {
      ...totals,
      diferencia: totalActivo - totalPasivoCapital,
      acumuladosSugerido,
      pct,
    };
  });
  return out;
}

// ---------- EBITDA y Estado de cambios ----------
// Ajustes por partidas diferidas del Balance (0 cuando no hay año anterior):
// la amortización de activos diferidos (baja del saldo) y la creación de
// créditos diferidos (alza del saldo) son partidas virtuales que se suman al
// EBITDA; sus movimientos contrarios van al financiamiento externo.
const deferredAdjustments = (sections, y, p) => {
  if (!p) return { amortActivosDiferidos: 0, creacionCreditosDiferidos: 0 };
  const bal = (k, yearId) => cell(sections, BALANCE_SECTION, k, yearId);
  return {
    amortActivosDiferidos: Math.max(bal("activos_diferidos", p.id) - bal("activos_diferidos", y.id), 0),
    creacionCreditosDiferidos: Math.max(bal("pasivos_diferidos", y.id) - bal("pasivos_diferidos", p.id), 0),
  };
};

const ebitdaOf = (inc, adj) =>
  inc.resultadoOp +
  inc.depreciacion + adj.amortActivosDiferidos + adj.creacionCreditosDiferidos +
  inc.reservaCxc + inc.reservaInventarios;

// Devuelve { [yearId]: ebitda } para TODOS los años ("UAFIRDA / EBITDA" =
// resultado de operación + depreciación y amortización + reservas). En el
// primer año los ajustes por diferidos valen 0.
export function computeEbitda({ sections, years }) {
  const income = computeIncome({ sections, years });
  const out = {};
  (years || []).forEach((y, i) => {
    const adj = deferredAdjustments(sections, y, i > 0 ? years[i - 1] : null);
    out[y.id] = ebitdaOf(income[y.id], adj);
  });
  return out;
}

// Estado de cambios en la situación financiera "(+) fuentes (−) aplicaciones",
// réplica de la hoja "Conciliaciones" del Excel. Solo para los años con año
// anterior; devuelve { [yearId]: {...} } (ver el objeto de salida al final).
// Las capturas de `cashflow` (venta de activo fijo, efectos cambiarios,
// ajuste por revaluación) llegan con el signo de finConfig: utilidad +.
export function computeCashflow({ sections, years }) {
  const income = computeIncome({ sections, years });
  const bal = (k, yearId) => cell(sections, BALANCE_SECTION, k, yearId);
  const out = {};
  (years || []).forEach((y, i) => {
    if (i === 0) return;
    const p = years[i - 1];
    const inc = income[y.id];
    const bp = (k) => bal(k, p.id); // saldo anterior
    const bc = (k) => bal(k, y.id); // saldo actual
    const cf = (k) => cell(sections, CASHFLOW_SECTION, k, y.id);

    // EBITDA
    const depreciacion = inc.depreciacion;
    const { amortActivosDiferidos, creacionCreditosDiferidos } = deferredAdjustments(sections, y, p);
    const depAmort = depreciacion + amortActivosDiferidos + creacionCreditosDiferidos;
    const reservaCxc = inc.reservaCxc;
    const reservaInventarios = inc.reservaInventarios;
    const reservas = reservaCxc + reservaInventarios;
    const resultadoOp = inc.resultadoOp;
    const ebitda = resultadoOp + depAmort + reservas;

    // Capturas complementarias
    const fxClientes = cf("cambiaria_clientes");
    const fxDeudaCP = cf("cambiaria_deuda_cp");
    const fxDeudaLP = cf("cambiaria_deuda_lp");
    const ventaActivoFijo = cf("venta_activo_fijo");
    const ajusteRevaluacion = cf("ajuste_revaluacion");

    // Capital de trabajo: los activos liberan efectivo al bajar, los pasivos
    // al subir. Las reservas ya redujeron el saldo contable y el efecto
    // cambiario en clientes no es efectivo: ambos se neutralizan.
    const workingCapital = {
      clientes: bp("clientes") - reservaCxc - bc("clientes") + fxClientes,
      inventarios: bp("inventarios") - reservaInventarios - bc("inventarios"),
      proveedores: bc("proveedores") - bp("proveedores"),
      pagosAnticipados: bp("pagos_anticipados") - bc("pagos_anticipados"),
      cxcRelacionadas: bp("cxc_relacionadas") - bc("cxc_relacionadas"),
      cxpRelacionadas: bc("cias_relacionadas") - bp("cias_relacionadas"),
      anticipos: bc("anticipos") - bp("anticipos"),
      gastosAcumulados: bc("gastos_acumulados") - bp("gastos_acumulados"),
    };
    const wcTotal = sum(Object.values(workingCapital));
    const flujoOperacion = ebitda + wcTotal;

    // Impuestos causados
    const impRecuperar = bp("impuestos_recuperar") - bc("impuestos_recuperar");
    const impPagar = bc("impuestos_pagar") - bp("impuestos_pagar");
    const isrPtu = -(inc.isr + inc.ptu);
    const impuestos = impRecuperar + impPagar + isrPtu;
    const flujoOperativoNetoImpuestos = flujoOperacion + impuestos;

    // Costo integral de financiamiento pagado (sin los efectos cambiarios
    // que no fueron efectivo).
    const gastoFinNeto = inc.prodFin - inc.gastosFin;
    const cambiarioDevengado = inc.cambiaria;
    const cif = gastoFinNeto + cambiarioDevengado - fxClientes - fxDeudaCP - fxDeudaLP;
    const efectivoOperacion = flujoOperacion + impuestos + cif;

    // Inversión. La variación de "Revaluación de activos" entra siempre en
    // el CAPEX (el Excel solo la incluye en una columna; con 0 no cambia nada).
    const activoFijoInicial = bp("activos_fijos");
    const activoFijoFinal = bc("activos_fijos");
    const variacionRevaluacion = bc("revaluacion") - bp("revaluacion");
    const capex =
      activoFijoInicial - depreciacion - ventaActivoFijo + ajusteRevaluacion - activoFijoFinal + variacionRevaluacion;
    const otrosActivos = bp("otros_activos") - bc("otros_activos");
    const flujoInversion = capex + otrosActivos;
    const flujoNetoInversion = efectivoOperacion + flujoInversion;

    // Financiamiento externo
    const financing = {
      porcionCirculante: -bp("porcion_circulante_lp"),
      deudaCP: bc("bancario_cp") - bp("bancario_cp") + fxDeudaCP,
      deudaLP: bc("porcion_circulante_lp") + bc("bancario_lp") - bp("bancario_lp") + fxDeudaLP,
      otrosCirculantes: bp("otros_circulantes") - bc("otros_circulantes"),
      otrasCxc: bp("otras_cxc") - bc("otras_cxc"),
      otrasCxp: bc("otras_cxp") - bp("otras_cxp"),
      acreedores: bc("acreedores") - bp("acreedores"),
      otrosIngresos: inc.otrosProd + ventaActivoFijo,
      cargosDiferidos: -Math.max(bc("activos_diferidos") - bp("activos_diferidos"), 0),
      creditosDiferidos: Math.min(bc("pasivos_diferidos") - bp("pasivos_diferidos"), 0),
    };
    const flujoFinExterno = sum(Object.values(financing));

    // Accionistas
    const aportaciones =
      bc("capital_social") + bc("aportaciones_futuras") - ajusteRevaluacion -
      (bp("capital_social") + bp("aportaciones_futuras"));
    const dividendos =
      bc("reservas") + bc("resultados_acumulados") -
      (bp("reservas") + bp("resultados_acumulados") + (income[p.id]?.utilidadNeta ?? 0));
    const accionistas = aportaciones + dividendos;
    const flujoFinanciamiento = flujoFinExterno + accionistas;

    // Flujo del periodo y verificación contra la caja del Balance
    const flujoPeriodo = flujoNetoInversion + flujoFinanciamiento;
    const cajaInicial = bp("efectivo");
    const cajaFinal = cajaInicial + flujoPeriodo;
    const cajaBalance = bc("efectivo");

    out[y.id] = {
      prevYearId: p.id,
      depreciacion, amortActivosDiferidos, creacionCreditosDiferidos, depAmort,
      reservaCxc, reservaInventarios, reservas,
      resultadoOp, ebitda,
      workingCapital, wcTotal, flujoOperacion,
      impRecuperar, impPagar, isrPtu, impuestos, flujoOperativoNetoImpuestos,
      gastoFinNeto, cambiarioDevengado, fxClientes, fxDeudaCP, fxDeudaLP, cif,
      efectivoOperacion,
      capex,
      capexDetalle: { activoFijoInicial, depreciacion, ventaActivoFijo, ajusteRevaluacion, variacionRevaluacion, activoFijoFinal },
      otrosActivos, flujoInversion, flujoNetoInversion,
      financing, flujoFinExterno,
      aportaciones, dividendos, accionistas, flujoFinanciamiento,
      flujoPeriodo, cajaInicial, cajaFinal, cajaBalance,
      diferencia: cajaFinal - cajaBalance,
    };
  });
  return out;
}

// ---------- Razones financieras ----------
// Fórmulas de la hoja "Razones Financieras" del Excel MP-AFH1: saldos al
// cierre (sin promedios), días sobre `meses × 30`, crecimiento, ROA y ROE
// anualizados en periodos parciales; el resto usa las cifras reales.

// Motivos (en español, cortos) de los valores no calculables.
export const NA_REASON = {
  sinAnioAnterior: "Sin año anterior",
  sinVentasAnterior: "Sin ventas el año anterior",
  ventas: "Sin ventas",
  costo: "Sin costo de ventas",
  ciclo: "Sin ventas ni costo de ventas",
  pasivoCirculante: "Sin pasivo circulante",
  rif: "Sin costo financiero neto",
  gastosFinNetos: "Sin gastos financieros netos",
  capital: "Capital contable negativo o cero",
  activos: "Sin activos",
  ebitda: "EBITDA negativo o cero",
  sinDeuda: "Sin deuda con costo",
};

// Semáforo de un indicador según las bandas del catálogo. Solo bandas:
// devuelve null si no hay valor, si el indicador es informativo o si
// hereda su estatus (`statusFrom`).
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

// Indicadores del bloque "Flujo de efectivo" que salen del Estado de cambios.
const FLOW_FIELDS = {
  inversion_capital_trabajo: "wcTotal",
  flujo_operacion: "flujoOperacion",
  efectivo_operacion: "efectivoOperacion",
  efectivo_inversion: "flujoInversion",
  efectivo_fin_externo: "flujoFinExterno",
  accionistas: "accionistas",
  efectivo_periodo: "flujoPeriodo",
};

// Devuelve { [yearId]: { months, values, status, na, aux } }:
//   months: meses del periodo (la base de días es months × 30);
//   values: { [key]: number | null } para los 41 indicadores de RATIO_DEFS;
//   status: { [key]: 'verde' | 'ambar' | 'rojo' | null } (informativos: null);
//   na:     { [key]: motivo } solo para los indicadores sin valor;
//   aux:    cifras base del Estado de Resultados, del Balance y del EBITDA.
export function computeRatios({ sections, years }) {
  const income = computeIncome({ sections, years });
  const balance = computeBalance({ sections, years });
  const ebitdaByYear = computeEbitda({ sections, years });
  const cashflow = computeCashflow({ sections, years });
  const out = {};
  (years || []).forEach((y, i) => {
    const months = monthsOf(y);
    const dayBase = months * 30;
    const annual = 12 / months;
    const inc = income[y.id];
    const b = balance[y.id];
    const ebitda = ebitdaByYear[y.id];
    const cf = cashflow[y.id] ?? null;
    const prev = i > 0 ? years[i - 1] : null;
    const bal = (k) => cell(sections, BALANCE_SECTION, k, y.id);

    const { ventas, costo, resultadoOp, rif, gastosFin, prodFin, utilidadNeta } = inc;
    const ac = b.activoCirculante;
    const pc = b.pasivoCirculante;
    const ta = b.totalActivo;
    const tp = b.totalPasivo;
    const tc = b.totalCapital;
    const efectivo = bal("efectivo");
    const clientes = bal("clientes");
    const inventarios = bal("inventarios");
    const proveedores = bal("proveedores");
    const anticipos = bal("anticipos");
    const otrasCxc = bal("otras_cxc");
    const cxcRelacionadas = bal("cxc_relacionadas");
    const ciasRelacionadas = bal("cias_relacionadas");
    const deudaCP = bal("bancario_cp") + bal("porcion_circulante_lp");
    const deudaLP = bal("bancario_lp");
    const deudaTotal = deudaCP + deudaLP;

    const values = {};
    const na = {};
    const forced = {}; // estatus de los N/A que sí llevan semáforo
    const skip = (key, reason, st) => {
      values[key] = null;
      na[key] = reason;
      if (st) forced[key] = st;
    };
    const z = (v) => v ?? 0; // los días no calculables cuentan como 0

    // Eficiencia
    if (!prev) skip("crecimiento_ventas", NA_REASON.sinAnioAnterior);
    else {
      const ventasPrev = income[prev.id].ventas;
      if (ventasPrev <= 0) skip("crecimiento_ventas", NA_REASON.sinVentasAnterior);
      else values.crecimiento_ventas = (ventas * annual) / ventasPrev - 1;
    }
    const diasVentas = (saldo) => saldo / (ventas / dayBase);
    const diasCosto = (saldo) => saldo / (costo / dayBase);
    if (ventas <= 0) skip("dias_clientes", NA_REASON.ventas);
    else values.dias_clientes = diasVentas(clientes);
    if (costo <= 0) skip("dias_inventario", NA_REASON.costo);
    else values.dias_inventario = diasCosto(inventarios);
    if (costo <= 0) skip("dias_anticipos", NA_REASON.costo);
    else values.dias_anticipos = diasCosto(anticipos);
    if (costo <= 0) skip("dias_proveedores", NA_REASON.costo);
    else values.dias_proveedores = diasCosto(proveedores);
    const sinCiclo = values.dias_clientes == null && values.dias_inventario == null;
    if (sinCiclo) skip("ciclo_economico", NA_REASON.ciclo);
    else {
      values.ciclo_economico =
        z(values.dias_clientes) + z(values.dias_inventario) - z(values.dias_anticipos) - z(values.dias_proveedores);
    }
    if (ventas <= 0) skip("dias_otras_cxc", NA_REASON.ventas);
    else values.dias_otras_cxc = diasVentas(otrasCxc);
    if (sinCiclo) skip("ciclo_con_ocxc", NA_REASON.ciclo);
    else values.ciclo_con_ocxc = values.ciclo_economico + z(values.dias_otras_cxc);
    if (ventas <= 0) skip("dias_cxc_inter", NA_REASON.ventas);
    else values.dias_cxc_inter = diasVentas(cxcRelacionadas);
    if (costo <= 0) skip("dias_cxp_inter", NA_REASON.costo);
    else values.dias_cxp_inter = diasCosto(ciasRelacionadas);
    if (sinCiclo) skip("ciclo_con_inter", NA_REASON.ciclo);
    else values.ciclo_con_inter = values.ciclo_con_ocxc + z(values.dias_cxc_inter) - z(values.dias_cxp_inter);

    // Flujo de efectivo (cifras en miles)
    values.ebit = resultadoOp;
    values.ebitda = ebitda;
    Object.entries(FLOW_FIELDS).forEach(([key, field]) => {
      if (!cf) skip(key, NA_REASON.sinAnioAnterior);
      else values[key] = cf[field];
    });

    // Liquidez
    if (pc <= 0) {
      skip("liquidez", NA_REASON.pasivoCirculante);
      skip("acido", NA_REASON.pasivoCirculante);
      skip("liquidez_inmediata", NA_REASON.pasivoCirculante);
    } else {
      values.liquidez = ac / pc;
      values.acido = (ac - inventarios) / pc;
      values.liquidez_inmediata = efectivo / pc;
    }
    values.capital_trabajo = ac - pc;

    // Cobertura
    if (rif >= 0) {
      skip("cobertura_rif_ebit", NA_REASON.rif);
      skip("cobertura_rif_ebitda", NA_REASON.rif);
    } else {
      values.cobertura_rif_ebit = resultadoOp / -rif;
      values.cobertura_rif_ebitda = ebitda / -rif;
    }
    const interesesNetos = gastosFin - prodFin;
    if (interesesNetos <= 0) {
      skip("cobertura_int_ebit", NA_REASON.gastosFinNetos);
      skip("cobertura_int_ebitda", NA_REASON.gastosFinNetos);
    } else {
      values.cobertura_int_ebit = resultadoOp / interesesNetos;
      values.cobertura_int_ebitda = ebitda / interesesNetos;
    }

    // Solvencia
    if (tc <= 0) {
      skip("apalancamiento", NA_REASON.capital, "rojo");
      skip("apalancamiento_financiero", NA_REASON.capital, "rojo");
    } else {
      values.apalancamiento = tp / tc;
      values.apalancamiento_financiero = deudaTotal / tc;
    }
    if (ta <= 0) skip("capital_activo", NA_REASON.activos);
    else values.capital_activo = tc / ta;
    if (ebitda <= 0) skip("pasivo_ebitda", NA_REASON.ebitda, "rojo");
    else values.pasivo_ebitda = tp / ebitda;
    if (deudaTotal <= 0) skip("pasivo_fin_ebitda", NA_REASON.sinDeuda, "verde");
    else if (ebitda <= 0) skip("pasivo_fin_ebitda", NA_REASON.ebitda, "rojo");
    else values.pasivo_fin_ebitda = deudaTotal / ebitda;
    values.deuda_cp = deudaCP;
    values.deuda_lp = deudaLP;
    values.deuda_total = deudaTotal;

    // Rentabilidad
    if (ventas <= 0) {
      skip("margen_bruto", NA_REASON.ventas);
      skip("margen_operativo", NA_REASON.ventas);
      skip("margen_neto", NA_REASON.ventas);
    } else {
      values.margen_bruto = inc.utilidadBruta / ventas;
      values.margen_operativo = resultadoOp / ventas;
      values.margen_neto = utilidadNeta / ventas;
    }
    if (ta <= 0) skip("roa", NA_REASON.activos);
    else values.roa = (utilidadNeta / ta) * annual;
    if (tc <= 0) skip("roe", NA_REASON.capital, "rojo");
    else values.roe = (utilidadNeta / tc) * annual;

    // Semáforo: informativos siempre null; primero por bandas (o forzado en
    // los N/A con estatus), después las herencias (`statusFrom`).
    const status = {};
    RATIO_DEFS.forEach((d) => {
      if (!d.semaforo) status[d.key] = null;
      else if (!d.statusFrom) status[d.key] = forced[d.key] ?? ratioStatus(d, values[d.key]);
    });
    RATIO_DEFS.forEach((d) => {
      if (d.semaforo && d.statusFrom) status[d.key] = status[d.statusFrom] ?? null;
    });

    out[y.id] = {
      months,
      values,
      status,
      na,
      aux: {
        ventas, costo, resultadoOp, rif, gastosFin, prodFin, utilidadNeta, ebitda,
        activoCirculante: ac, pasivoCirculante: pc, totalActivo: ta, totalPasivo: tp, totalCapital: tc,
        efectivo, clientes, inventarios, proveedores, anticipos,
        otras_cxc: otrasCxc, cxc_relacionadas: cxcRelacionadas, cias_relacionadas: ciasRelacionadas,
        deuda_total: deudaTotal,
      },
    };
  });
  return out;
}

// Tendencia del último periodo contra el anterior:
// 'mejora' | 'empeora' | 'igual' | null (sin alguno de los dos valores, o
// indicador de rango o sin `better`, donde "más" no es mejor ni peor).
export function ratioTrend(def, curr, prev) {
  if (!def || curr == null || prev == null) return null;
  if (def.better !== "higher" && def.better !== "lower") return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 1e-9) return "igual";
  const sube = diff > 0;
  return (def.better === "higher") === sube ? "mejora" : "empeora";
}

// Resumen del semáforo de un periodo (una entrada de computeRatios):
// { verde, ambar, rojo, na, atencion: [{ key, status, value }] }.
// Solo cuenta los indicadores con `semaforo: true` (los informativos no
// entran ni en `na`). Los N/A con estatus cuentan en su color; los N/A sin
// estatus en `na`. `atencion` lleva primero todos los rojos y luego los
// ámbar, en el orden del catálogo.
export function summarizeRatios(yearRatios) {
  const out = { verde: 0, ambar: 0, rojo: 0, na: 0, atencion: [] };
  if (!yearRatios) return out;
  const rows = RATIO_DEFS.filter((d) => d.semaforo).map((d) => ({
    key: d.key,
    status: yearRatios.status?.[d.key] ?? null,
    value: yearRatios.values?.[d.key] ?? null,
  }));
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

// ---------- Análisis opcionales ----------

// Margen bruto por segmento de negocio (hoja "Ventas y Costo de lo vendido").
// `lines` = [{ id, name }] (fin_lines). Devuelve { [yearId]: { bySegment:
//   { [lineId]: { ventas, costo, bruto, margen, pctVentas, pctCosto } },
//   totalVentas, totalCosto, totalBruto, margenTotal, ventasResultados,
//   costoResultados, difVentas, difCosto } }. Las diferencias son "según
// Estado de Resultados − suma de segmentos" y deben ser 0.
export function computeSegments({ sections, years, lines }) {
  const income = computeIncome({ sections, years });
  const out = {};
  (years || []).forEach((y) => {
    const bySegment = {};
    let totalVentas = 0;
    let totalCosto = 0;
    (lines || []).forEach((l) => {
      const ventas = cell(sections, SALES_SECTION, l.id, y.id);
      const costo = cell(sections, SEGCOST_SECTION, l.id, y.id);
      const bruto = ventas - costo;
      bySegment[l.id] = { ventas, costo, bruto, margen: share(bruto, ventas) };
      totalVentas += ventas;
      totalCosto += costo;
    });
    Object.values(bySegment).forEach((s) => {
      s.pctVentas = share(s.ventas, totalVentas);
      s.pctCosto = share(s.costo, totalCosto);
    });
    const totalBruto = totalVentas - totalCosto;
    const ventasResultados = income[y.id]?.ventas ?? 0;
    const costoResultados = income[y.id]?.costo ?? 0;
    out[y.id] = {
      bySegment,
      totalVentas,
      totalCosto,
      totalBruto,
      margenTotal: share(totalBruto, totalVentas),
      ventasResultados,
      costoResultados,
      difVentas: ventasResultados - totalVentas,
      difCosto: costoResultados - totalCosto,
    };
  });
  return out;
}

// Desglose del gasto operativo (hoja "Gasto"). Los 20 conceptos y las dos
// partidas virtuales capturables vienen de `expenses`; depreciación y
// reservas, del memo del Estado de Resultados. Devuelve { [yearId]: {
//   concepts: { [key]: valor }, gastosOperacion, depreciacion, amortizaciones,
//   reservaCxc, reservaInventarios, otrasVirtuales, total,
//   pct: { [key | campo]: valor / total | null }, gastoEnResultados,
//   diferencia } }. `diferencia` = total − gasto operativo del Estado de
// Resultados y debe ser 0.
export function computeExpenseBreakdown({ sections, years }) {
  const income = computeIncome({ sections, years });
  const out = {};
  (years || []).forEach((y) => {
    const concepts = {};
    EXPENSE_CONCEPTS.forEach((c) => {
      concepts[c.key] = cell(sections, EXPENSES_SECTION, c.key, y.id);
    });
    const gastosOperacion = sum(Object.values(concepts));
    const inc = income[y.id];
    const depreciacion = inc?.depreciacion ?? 0;
    const reservaCxc = inc?.reservaCxc ?? 0;
    const reservaInventarios = inc?.reservaInventarios ?? 0;
    const amortizaciones = cell(sections, EXPENSES_SECTION, "amortizaciones", y.id);
    const otrasVirtuales = cell(sections, EXPENSES_SECTION, "otras_virtuales", y.id);
    const total = gastosOperacion + depreciacion + amortizaciones + reservaCxc + reservaInventarios + otrasVirtuales;
    const pct = {};
    Object.entries(concepts).forEach(([k, v]) => {
      pct[k] = share(v, total);
    });
    Object.entries({ gastosOperacion, depreciacion, amortizaciones, reservaCxc, reservaInventarios, otrasVirtuales }).forEach(
      ([k, v]) => {
        pct[k] = share(v, total);
      }
    );
    const gastoEnResultados = inc?.gastoOperativo ?? 0;
    out[y.id] = {
      concepts,
      gastosOperacion,
      depreciacion,
      amortizaciones,
      reservaCxc,
      reservaInventarios,
      otrasVirtuales,
      total,
      pct,
      gastoEnResultados,
      diferencia: total - gastoEnResultados,
    };
  });
  return out;
}

// Estacionalidad en ventas (hoja "Estacionalidad en ventas"). Devuelve
// { [yearId]: { months: [12 números], pct: [12 | null], total,
//   ventasResultados, diferencia } }; `diferencia` = ventas del Estado de
// Resultados − suma de los meses y debe ser 0.
export function computeSeasonality({ sections, years }) {
  const income = computeIncome({ sections, years });
  const out = {};
  (years || []).forEach((y) => {
    const months = SEASON_MONTHS.map((m) => cell(sections, SEASONALITY_SECTION, m.key, y.id));
    const total = sum(months);
    const ventasResultados = income[y.id]?.ventas ?? 0;
    out[y.id] = {
      months,
      pct: months.map((v) => share(v, total)),
      total,
      ventasResultados,
      diferencia: ventasResultados - total,
    };
  });
  return out;
}
