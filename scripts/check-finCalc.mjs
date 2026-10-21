// Prueba del motor del Análisis Financiero (src/config/finCalc.js) y de su
// catálogo (src/config/finConfig.js) contra las 4 columnas del Excel
// "Modelo MP-AFH1" del cliente (Productos Metálicos del Potosí: 2023, 2024,
// 2025 y jun-2026 parcial de 6 meses). Los valores esperados son los
// literales del Excel (hojas Edo Res, Balance, Conciliaciones y Razones
// Financieras), salvo donde nuestras reglas N/A sustituyen un número sin
// sentido. También demuestra que ambos módulos importan desde Node ESM (sin
// React ni APIs del navegador), como los necesita el servidor MCP en Deno.
// Correr con: node scripts/check-finCalc.mjs
import {
  computeIncome,
  computeBalance,
  computeEbitda,
  computeCashflow,
  computeRatios,
  ratioStatus,
  ratioTrend,
  summarizeRatios,
  computeSegments,
  computeExpenseBreakdown,
  computeSeasonality,
  pctChange,
  DAYS_BASE,
  periodDays,
  NA_REASON,
} from "../src/config/finCalc.js";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  SALES_SECTION,
  SEGCOST_SECTION,
  EXPENSES_SECTION,
  SEASONALITY_SECTION,
  INCOME_ROWS,
  INCOME_INPUT_KEYS,
  INCOME_MEMO,
  BALANCE_GROUPS,
  ALL_BALANCE_KEYS,
  CASHFLOW_INPUTS,
  EXPENSE_CONCEPTS,
  EXPENSE_VIRTUAL,
  SEASON_MONTHS,
  RATIO_GROUPS,
  RATIO_DEFS,
  RATIO_BY_KEY,
  RATIO_STATUS_LABEL,
  formatRatio,
  yearLabel,
  annualizeFactor,
  toNumber,
  sumValues,
  fmtPct,
} from "../src/config/finConfig.js";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${JSON.stringify(actual)}${ok ? "" : `  (esperado ${JSON.stringify(expected)})`}`);
};
// Comparación numérica: tolerancia relativa 1e-6; para ceros, absoluta 1e-9.
const approx = (name, actual, expected, tol = 1e-6) => {
  const ok =
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    (expected === 0 ? Math.abs(actual) <= 1e-9 : Math.abs(actual - expected) <= tol * Math.abs(expected));
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${actual}${ok ? "" : `  (esperado ${expected})`}`);
};
// Serie por año: `arr[i]` es el esperado del año YEARS[i] (null → debe ser null).
const series = (label, getter, arr, years = YEARS) => {
  arr.forEach((exp, i) => {
    const y = years[i];
    const actual = getter(y.id);
    if (exp == null) check(`${label} ${yearLabel(y)} → null`, actual, null);
    else approx(`${label} ${yearLabel(y)}`, actual, exp);
  });
};

// ---------- Fixture: las 4 columnas del Excel MP-AFH1 ----------
// Capturas en POSITIVO (en el Excel costos, gastos e impuestos van en
// negativo). Las ventas van como texto para ejercitar toNumber (así llegan
// de la captura). Depreciación 0 / 0 / 1210 / 645 (hoja Conciliaciones).
const YEARS = [
  { id: "y23", year: 2023, months: 12 },
  { id: "y24", year: 2024, months: 12 },
  { id: "y25", year: 2025, months: 12 },
  { id: "y26", year: 2026, months: 6 },
];

// Convierte [{key: valor}] por año en la forma { [key]: { [yearId]: valor } }.
const sectionFromRows = (rows, years = YEARS) => {
  const out = {};
  rows.forEach((row, i) => {
    Object.entries(row).forEach(([k, v]) => {
      out[k] = out[k] || {};
      out[k][years[i].id] = v;
    });
  });
  return out;
};

const INCOME_ROWS_FX = [
  { ventas: "878", costo: 704, gasto_venta: 0, gasto_admin: 0, gasto_general: 196, productos_financieros: 0, gastos_financieros: 16, utilidad_cambiaria: 7, otros_productos: 0, isr: 0, ptu: 0, depreciacion: 0 },
  { ventas: "75,316", costo: 65820, gasto_general: 12066, gastos_financieros: 183, utilidad_cambiaria: -1825, otros_productos: 34, isr: 0, ptu: 0, depreciacion: 0 },
  { ventas: "93860", costo: 63942, gasto_general: 24734, gastos_financieros: 626, utilidad_cambiaria: -752, otros_productos: 42, isr: 120, ptu: 238, depreciacion: 1210 },
  { ventas: "62625", costo: 43626, gasto_general: 16116, gastos_financieros: 3021, utilidad_cambiaria: 113, otros_productos: 6, depreciacion: 645 },
];
const BALANCE_ROWS = [
  { efectivo: 48, clientes: 871, otras_cxc: 55, cxc_relacionadas: 0, inventarios: 0, pagos_anticipados: 5, impuestos_recuperar: 201, otros_circulantes: 0, activos_fijos: 793, otros_activos: 0, activos_diferidos: 0, anticipos: 0, proveedores: 790, cias_relacionadas: 0, gastos_acumulados: 0, impuestos_pagar: 20, bancario_cp: 0, porcion_circulante_lp: 0, acreedores: 1022, otras_cxp: 122, bancario_lp: 0, pasivos_diferidos: 0, capital_social: 50, aportaciones_futuras: 0, reservas: 0, revaluacion: 0, resultados_acumulados: 0 },
  { efectivo: 293, clientes: 9509, otras_cxc: 377, inventarios: 3756, pagos_anticipados: 656, impuestos_recuperar: 0, otros_circulantes: 3635, activos_fijos: 7369, otros_activos: 588, proveedores: 26334, impuestos_pagar: 1958, acreedores: 1112, otras_cxp: 1304, capital_social: 50, resultados_acumulados: -31 },
  { efectivo: 294, clientes: 9016, otras_cxc: 264, inventarios: 4199, pagos_anticipados: 5072, impuestos_recuperar: 192, otros_circulantes: 3103, activos_fijos: 12172, otros_activos: 2154, anticipos: 34, proveedores: 20452, impuestos_pagar: 2418, bancario_cp: 4885, acreedores: 774, otras_cxp: 1342, capital_social: 50, aportaciones_futuras: 7596, resultados_acumulados: -4575 },
  { efectivo: 2287, clientes: 9858, otras_cxc: 1421, inventarios: 14757, pagos_anticipados: 14847, impuestos_recuperar: 878, otros_circulantes: 6582, activos_fijos: 33033, otros_activos: 1981, anticipos: 544, proveedores: 47640, impuestos_pagar: 2268, acreedores: 3262, otras_cxp: 1533, bancario_lp: 18613, capital_social: 20, aportaciones_futuras: 12868, reservas: -500, resultados_acumulados: -585 },
];
const CASHFLOW_ROWS = [
  {},
  { venta_activo_fijo: 0, cambiaria_deuda_cp: 0, cambiaria_deuda_lp: 0, cambiaria_clientes: 0, ajuste_revaluacion: 0 },
  { venta_activo_fijo: 0, cambiaria_deuda_cp: 0, ajuste_revaluacion: 0 },
  {},
];

const SECTIONS = {
  [INCOME_SECTION]: sectionFromRows(INCOME_ROWS_FX),
  [BALANCE_SECTION]: sectionFromRows(BALANCE_ROWS),
  [CASHFLOW_SECTION]: sectionFromRows(CASHFLOW_ROWS),
};
const FIXTURE = { sections: SECTIONS, years: YEARS };

// Copia profunda del fixture con ajustes: { income: {yId: {...}}, balance: {...}, cashflow: {...}, years }.
const clone = (o) => JSON.parse(JSON.stringify(o));
const variant = ({ income = {}, balance = {}, cashflow = {}, years = YEARS } = {}) => {
  const sections = clone(SECTIONS);
  const apply = (section, patch) =>
    Object.entries(patch).forEach(([yId, row]) =>
      Object.entries(row).forEach(([k, v]) => {
        sections[section][k] = sections[section][k] || {};
        sections[section][k][yId] = v;
      })
    );
  apply(INCOME_SECTION, income);
  apply(BALANCE_SECTION, balance);
  apply(CASHFLOW_SECTION, cashflow);
  return { sections, years: clone(years) };
};

// ---------- Catálogo ----------
console.log("== Catálogo ==");
check("DAYS_BASE 360", DAYS_BASE, 360);
check("periodDays 12 meses → 360, 6 → 180, sin meses → 360", [periodDays({ months: 12 }), periodDays({ months: 6 }), periodDays({})], [360, 180, 360]);
check("secciones", [INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION, SALES_SECTION, SEGCOST_SECTION, EXPENSES_SECTION, SEASONALITY_SECTION], ["income", "balance", "cashflow", "sales", "segcost", "expenses", "seasonality"]);
check("INCOME_ROWS: 17 filas en el orden del estado", INCOME_ROWS.map((r) => r.key), [
  "ventas", "costo", "utilidadBruta", "gasto_venta", "gasto_admin", "gasto_general", "gastoOperativo", "resultadoOp",
  "productos_financieros", "gastos_financieros", "utilidad_cambiaria", "rif", "otros_productos", "rai", "isr", "ptu", "utilidadNeta",
]);
check("INCOME_ROWS: tipos válidos", INCOME_ROWS.every((r) => ["input", "auto", "total"].includes(r.type) && r.label && r.calc), true);
check("INCOME_INPUT_KEYS: 11 claves", INCOME_INPUT_KEYS, ["ventas", "costo", "gasto_venta", "gasto_admin", "gasto_general", "productos_financieros", "gastos_financieros", "utilidad_cambiaria", "otros_productos", "isr", "ptu"]);
check("INCOME_ROWS: solo cambiaria y otros productos llevan signo", INCOME_ROWS.filter((r) => r.signed).map((r) => r.key), ["utilidad_cambiaria", "otros_productos"]);
check("INCOME_MEMO: 3 partidas", INCOME_MEMO.map((m) => m.key), ["depreciacion", "reserva_cxc", "reserva_inventarios"]);
check("BALANCE_GROUPS: 5 grupos con items y total", BALANCE_GROUPS.map((g) => [g.key, g.items.length, g.total]), [
  ["activo_circulante", 8, "Total activo circulante"],
  ["activo_no_circulante", 3, "Total activo"],
  ["pasivo_circulante", 9, "Total pasivo circulante"],
  ["pasivo_largo_plazo", 2, "Total pasivo"],
  ["capital", 5, "Total capital contable"],
]);
check("ALL_BALANCE_KEYS: 27 cuentas sin resultado_periodo", [ALL_BALANCE_KEYS.length, ALL_BALANCE_KEYS.includes("resultado_periodo"), new Set(ALL_BALANCE_KEYS).size], [27, false, 27]);
check("Balance sin cuentas obsoletas", ["caja", "inversiones", "impuesto_diferido_activo", "provisiones", "impuesto_diferido_pasivo"].filter((k) => ALL_BALANCE_KEYS.includes(k)), []);
check("Capital: fila automática resultadoPeriodo y gran total", [BALANCE_GROUPS[4].auto[0].key, BALANCE_GROUPS[4].grandTotal.key], ["resultadoPeriodo", "totalPasivoCapital"]);
check("CASHFLOW_INPUTS: 5 capturas", CASHFLOW_INPUTS.map((i) => [i.key, i.signed]), [
  ["venta_activo_fijo", false], ["cambiaria_deuda_cp", true], ["cambiaria_deuda_lp", true], ["cambiaria_clientes", true], ["ajuste_revaluacion", false],
]);
check("CASHFLOW_INPUTS con label y hint", CASHFLOW_INPUTS.every((i) => i.label && i.hint), true);
check("EXPENSE_CONCEPTS: 20", EXPENSE_CONCEPTS.length, 20);
check("EXPENSE_CONCEPTS: etiquetas corregidas", [EXPENSE_CONCEPTS.find((c) => c.key === "renta").label, EXPENSE_CONCEPTS.find((c) => c.key === "innovacion").label], ["Renta / alquiler", "I+D e innovación"]);
check("EXPENSE_VIRTUAL", EXPENSE_VIRTUAL.map((c) => c.key), ["amortizaciones", "otras_virtuales"]);
check("SEASON_MONTHS m01…m12", [SEASON_MONTHS.length, SEASON_MONTHS[0].key, SEASON_MONTHS[11].key, SEASON_MONTHS[0].label, SEASON_MONTHS[11].label], [12, "m01", "m12", "Enero", "Diciembre"]);
check("6 grupos de razones", RATIO_GROUPS.map((g) => g.key), ["eficiencia", "flujo", "liquidez", "cobertura", "solvencia", "rentabilidad"]);
check("grupos con título y pregunta", RATIO_GROUPS.every((g) => g.title && g.question), true);
check("41 indicadores", RATIO_DEFS.length, 41);
check("orden del catálogo", RATIO_DEFS.map((d) => d.key), [
  "crecimiento_ventas", "dias_clientes", "dias_inventario", "dias_anticipos", "dias_proveedores", "ciclo_economico",
  "dias_otras_cxc", "ciclo_con_ocxc", "dias_cxc_inter", "dias_cxp_inter", "ciclo_con_inter",
  "ebit", "ebitda", "inversion_capital_trabajo", "flujo_operacion", "efectivo_operacion", "efectivo_inversion",
  "efectivo_fin_externo", "accionistas", "efectivo_periodo",
  "liquidez", "acido", "liquidez_inmediata", "capital_trabajo",
  "cobertura_rif_ebit", "cobertura_rif_ebitda", "cobertura_int_ebit", "cobertura_int_ebitda",
  "apalancamiento", "apalancamiento_financiero", "capital_activo", "pasivo_ebitda", "pasivo_fin_ebitda", "deuda_cp", "deuda_lp", "deuda_total",
  "margen_bruto", "margen_operativo", "margen_neto", "roa", "roe",
]);
check("claves únicas", new Set(RATIO_DEFS.map((d) => d.key)).size, 41);
check("todos en un grupo válido", RATIO_DEFS.every((d) => RATIO_GROUPS.some((g) => g.key === d.group)), true);
check("formatos válidos", RATIO_DEFS.every((d) => ["ratio", "pct", "days", "miles"].includes(d.format)), true);
check("semaforo booleano en todos", RATIO_DEFS.every((d) => typeof d.semaforo === "boolean"), true);
check("16 informativos", RATIO_DEFS.filter((d) => !d.semaforo).map((d) => d.key), [
  "dias_anticipos", "dias_otras_cxc", "dias_cxc_inter", "dias_cxp_inter",
  "ebit", "ebitda", "inversion_capital_trabajo", "flujo_operacion", "efectivo_operacion", "efectivo_inversion", "efectivo_fin_externo", "accionistas", "efectivo_periodo",
  "deuda_cp", "deuda_lp", "deuda_total",
]);
check("informativos sin bandas ni statusFrom", RATIO_DEFS.filter((d) => !d.semaforo).every((d) => !d.bands && !d.statusFrom), true);
check("con semáforo: bandas o statusFrom (nunca ambos)", RATIO_DEFS.filter((d) => d.semaforo).every((d) => (d.bands && !d.statusFrom) || (!d.bands && d.statusFrom)), true);
check("con bandas: better válido", RATIO_DEFS.filter((d) => d.bands).every((d) => ["higher", "lower", "range"].includes(d.better)), true);
check("better de los informativos: higher, lower o null", RATIO_DEFS.filter((d) => !d.semaforo).every((d) => d.better === null || ["higher", "lower"].includes(d.better)), true);
check("statusFrom apunta a indicadores con bandas", RATIO_DEFS.filter((d) => d.statusFrom).every((d) => RATIO_BY_KEY[d.statusFrom]?.bands != null), true);
check("capital_trabajo hereda de liquidez", [RATIO_BY_KEY.capital_trabajo.statusFrom, RATIO_BY_KEY.capital_trabajo.better, RATIO_BY_KEY.capital_trabajo.semaforo], ["liquidez", "higher", true]);
check("textos label/formula/what/how no vacíos", RATIO_DEFS.every((d) => ["label", "formula", "what", "how"].every((f) => String(d[f] || "").trim() !== "")), true);
check("etiquetas del Excel", ["ebit", "ebitda", "liquidez", "cobertura_rif_ebit", "apalancamiento", "capital_activo", "pasivo_ebitda", "pasivo_fin_ebitda", "deuda_total", "efectivo_periodo"].map((k) => RATIO_BY_KEY[k].label), [
  "UAFIR / EBIT", "UAFIRDA / EBITDA", "Índice de liquidez", "Cobertura del RIF con EBIT", "Índice de apalancamiento", "Capital / activo total", "Pasivo total / EBITDA", "Pasivo financiero / EBITDA", "Total pasivos con costo", "Efectivo generado en el periodo",
]);
check("bloque flujo: 9 indicadores en miles e informativos", RATIO_DEFS.filter((d) => d.group === "flujo").every((d) => d.format === "miles" && !d.semaforo) && RATIO_DEFS.filter((d) => d.group === "flujo").length === 9, true);
check("bandas del plan (muestra)", [RATIO_BY_KEY.crecimiento_ventas.bands, RATIO_BY_KEY.liquidez_inmediata.bands, RATIO_BY_KEY.apalancamiento_financiero.bands, RATIO_BY_KEY.pasivo_ebitda.bands, RATIO_BY_KEY.pasivo_fin_ebitda.bands, RATIO_BY_KEY.dias_proveedores.bands], [
  { greenMin: 0.1, amberMin: 0 }, { greenMin: 0.3, amberMin: 0.1 }, { greenMax: 0.5, amberMax: 1.0 }, { greenMax: 3.0, amberMax: 5.0 }, { greenMax: 2.0, amberMax: 3.5 }, { green: [30, 90], amber: [15, 120] },
]);
check("RATIO_BY_KEY con 41 entradas", Object.keys(RATIO_BY_KEY).length, 41);
check("RATIO_STATUS_LABEL", RATIO_STATUS_LABEL, { verde: "Sano", ambar: "Vigilar", rojo: "Atender", na: "No aplica" });

console.log("\n== Helpers genéricos ==");
check("yearLabel", [yearLabel(YEARS[0]), yearLabel(YEARS[3]), yearLabel(null)], ["2023", "jun 2026", ""]);
check("annualizeFactor", [annualizeFactor(YEARS[0]), annualizeFactor(YEARS[3]), annualizeFactor(null)], [1, 2, 1]);
check("toNumber", [toNumber("1,234.5"), toNumber(""), toNumber(null), toNumber("abc"), toNumber(-7)], [1234.5, null, null, null, -7]);
check("sumValues ignora vacíos", sumValues(["10", "", null, 5, "x"]), 15);
check("fmtPct", [fmtPct(0.1234), fmtPct(null), fmtPct(NaN)], ["12.3%", "—", "—"]);
check("pctChange", [pctChange(110, 100), pctChange(50, -100), pctChange(10, 0), pctChange(null, 5)], [0.10000000000000009, -0.5, null, null]);

// ---------- (a) computeIncome ----------
console.log("\n== (a) computeIncome: hoja Edo Res ==");
const INC = computeIncome(FIXTURE);
check("una entrada por año", Object.keys(INC), YEARS.map((y) => y.id));
series("ventas", (id) => INC[id].ventas, [878, 75316, 93860, 62625]);
series("costo", (id) => INC[id].costo, [704, 65820, 63942, 43626]);
series("utilidadBruta", (id) => INC[id].utilidadBruta, [174, 9496, 29918, 18999]);
series("gastoOperativo", (id) => INC[id].gastoOperativo, [196, 12066, 24734, 16116]);
series("resultadoOp", (id) => INC[id].resultadoOp, [-22, -2570, 5184, 2883]);
series("rif", (id) => INC[id].rif, [-9, -2008, -1378, -2908]);
series("rai", (id) => INC[id].rai, [-31, -4544, 3848, -19]);
series("utilidadNeta", (id) => INC[id].utilidadNeta, [-31, -4544, 3490, -19]);
series("depreciacion (memo)", (id) => INC[id].depreciacion, [0, 0, 1210, 645]);
check("memo no altera totales (reservas 0)", [INC.y25.reservaCxc, INC.y25.reservaInventarios], [0, 0]);
check("claves del resultado", Object.keys(INC.y25).sort(), [
  "cambiaria", "costo", "depreciacion", "gastoAdmin", "gastoGeneral", "gastoOperativo", "gastoVenta", "gastosFin", "isr", "otrosProd", "pct",
  "prodFin", "ptu", "rai", "reservaCxc", "reservaInventarios", "resultadoOp", "rif", "utilidadBruta", "utilidadNeta", "ventas",
]);
approx("pct.costo 2023 (0.8018…)", INC.y23.pct.costo, 0.8018223234624146);
approx("pct.utilidadBruta 2025", INC.y25.pct.utilidadBruta, 0.31875133177072235);
approx("pct.resultadoOp jun 2026", INC.y26.pct.resultadoOp, 0.04603592814371257);
approx("pct.utilidadNeta 2024", INC.y24.pct.utilidadNeta, -0.06033246587710447);
check("pct.ventas = 1", YEARS.map((y) => INC[y.id].pct.ventas), [1, 1, 1, 1]);
check("sin ventas → pct null", computeIncome(variant({ income: { y25: { ventas: 0 } } })).y25.pct.costo, null);
check("sin años → {}", computeIncome({ sections: {}, years: [] }), {});
check("sin secciones → ceros", computeIncome({ sections: undefined, years: [YEARS[0]] }).y23.utilidadNeta, 0);

// ---------- (b) computeBalance ----------
console.log("\n== (b) computeBalance: hoja Balance ==");
const BAL = computeBalance(FIXTURE);
series("activoCirculante", (id) => BAL[id].activoCirculante, [1180, 18226, 22140, 50630]);
series("totalActivo", (id) => BAL[id].totalActivo, [1973, 26183, 36466, 85644]);
series("pasivoCirculante", (id) => BAL[id].pasivoCirculante, [1954, 30708, 29905, 55247]);
series("totalPasivo", (id) => BAL[id].totalPasivo, [1954, 30708, 29905, 73860]);
series("totalCapital", (id) => BAL[id].totalCapital, [19, -4525, 6561, 11784]);
series("totalPasivoCapital = totalActivo", (id) => BAL[id].totalPasivoCapital, [1973, 26183, 36466, 85644]);
series("diferencia 0", (id) => BAL[id].diferencia, [0, 0, 0, 0]);
series("resultadoPeriodo = utilidad neta", (id) => BAL[id].resultadoPeriodo, [-31, -4544, 3490, -19]);
series("activoNoCirculante", (id) => BAL[id].activoNoCirculante, [793, 7957, 14326, 35014]);
series("pasivoLargoPlazo", (id) => BAL[id].pasivoLargoPlazo, [0, 0, 0, 18613]);
check("acumuladosSugerido: null el primer año; después acumulados + utilidad anteriores", YEARS.map((y) => BAL[y.id].acumuladosSugerido), [null, -31, -4575, -1085]);
approx("pct.clientes 2023 (0.4414…)", BAL.y23.pct.clientes, 0.4414597060314242);
approx("pct.proveedores 2024 (> 1)", BAL.y24.pct.proveedores, 1.0057671007905893);
approx("pct.totalCapital 2025", BAL.y25.pct.totalCapital, 0.17992102232216312);
approx("pct.resultadoPeriodo 2024", BAL.y24.pct.resultadoPeriodo, -0.17354772180422412);
check("pct.totalActivo = 1", YEARS.map((y) => BAL[y.id].pct.totalActivo), [1, 1, 1, 1]);
check("balance vacío → pct null", computeBalance({ sections: {}, years: [YEARS[0]] }).y23.pct.clientes, null);
const descuadre = computeBalance(variant({ balance: { y25: { efectivo: 394 } } }));
approx("descuadre de 100 en efectivo → diferencia 100", descuadre.y25.diferencia, 100);

// ---------- (c) computeEbitda ----------
console.log("\n== (c) computeEbitda ==");
const EB = computeEbitda(FIXTURE);
check("una entrada por año (incluye el primero)", Object.keys(EB), YEARS.map((y) => y.id));
series("ebitda", (id) => EB[id], [-22, -2570, 6394, 3528]);
const conDiferidos = computeEbitda(variant({ balance: { y24: { activos_diferidos: 100, pasivos_diferidos: 0 }, y25: { activos_diferidos: 40, pasivos_diferidos: 70 } } }));
approx("2025 con amortización de diferidos (60) y créditos diferidos (70)", conDiferidos.y25, 6394 + 60 + 70);
approx("2024: alza de activos diferidos no suma al EBITDA", conDiferidos.y24, -2570);
const conReservas = computeEbitda(variant({ income: { y25: { reserva_cxc: 100, reserva_inventarios: 50 } } }));
approx("2025 con reservas 150", conReservas.y25, 6544);
approx("primer año: resultadoOp + depreciación + reservas", computeEbitda(variant({ income: { y23: { depreciacion: 10, reserva_cxc: 5 } } })).y23, -7);

// ---------- (d) computeCashflow ----------
console.log("\n== (d) computeCashflow: hoja Conciliaciones ==");
const CF = computeCashflow(FIXTURE);
const CF_YEARS = YEARS.slice(1);
check("solo años con año anterior", Object.keys(CF), ["y24", "y25", "y26"]);
check("prevYearId", CF_YEARS.map((y) => CF[y.id].prevYearId), ["y23", "y24", "y25"]);
const cfSeries = (label, field, arr) => series(label, (id) => (typeof field === "function" ? field(CF[id]) : CF[id][field]), arr, CF_YEARS);
cfSeries("resultadoOp", "resultadoOp", [-2570, 5184, 2883]);
cfSeries("depreciacion", "depreciacion", [0, 1210, 645]);
cfSeries("depAmort", "depAmort", [0, 1210, 645]);
cfSeries("reservas", "reservas", [0, 0, 0]);
cfSeries("ebitda", "ebitda", [-2570, 6394, 3528]);
cfSeries("wc.clientes", (r) => r.workingCapital.clientes, [-8638, 493, -842]);
cfSeries("wc.inventarios", (r) => r.workingCapital.inventarios, [-3756, -443, -10558]);
cfSeries("wc.proveedores", (r) => r.workingCapital.proveedores, [25544, -5882, 27188]);
cfSeries("wc.pagosAnticipados", (r) => r.workingCapital.pagosAnticipados, [-651, -4416, -9775]);
cfSeries("wc.cxcRelacionadas", (r) => r.workingCapital.cxcRelacionadas, [0, 0, 0]);
cfSeries("wc.cxpRelacionadas", (r) => r.workingCapital.cxpRelacionadas, [0, 0, 0]);
cfSeries("wc.anticipos", (r) => r.workingCapital.anticipos, [0, 34, 510]);
cfSeries("wc.gastosAcumulados", (r) => r.workingCapital.gastosAcumulados, [0, 0, 0]);
cfSeries("wcTotal", "wcTotal", [12499, -10214, 6523]);
cfSeries("flujoOperacion", "flujoOperacion", [9929, -3820, 10051]);
cfSeries("impRecuperar", "impRecuperar", [201, -192, -686]);
cfSeries("impPagar", "impPagar", [1938, 460, -150]);
cfSeries("isrPtu", "isrPtu", [0, -358, 0]);
cfSeries("impuestos", "impuestos", [2139, -90, -836]);
cfSeries("flujoOperativoNetoImpuestos", "flujoOperativoNetoImpuestos", [12068, -3910, 9215]);
cfSeries("gastoFinNeto", "gastoFinNeto", [-183, -626, -3021]);
cfSeries("cambiarioDevengado", "cambiarioDevengado", [-1825, -752, 113]);
cfSeries("cif", "cif", [-2008, -1378, -2908]);
cfSeries("efectivoOperacion", "efectivoOperacion", [10060, -5288, 6307]);
cfSeries("capex", "capex", [-6576, -6013, -21506]);
cfSeries("capexDetalle.activoFijoInicial", (r) => r.capexDetalle.activoFijoInicial, [793, 7369, 12172]);
cfSeries("capexDetalle.activoFijoFinal", (r) => r.capexDetalle.activoFijoFinal, [7369, 12172, 33033]);
cfSeries("otrosActivos", "otrosActivos", [-588, -1566, 173]);
cfSeries("flujoInversion", "flujoInversion", [-7164, -7579, -21333]);
cfSeries("flujoNetoInversion", "flujoNetoInversion", [2896, -12867, -15026]);
cfSeries("fin.porcionCirculante", (r) => r.financing.porcionCirculante, [0, 0, 0]);
cfSeries("fin.deudaCP", (r) => r.financing.deudaCP, [0, 4885, -4885]);
cfSeries("fin.deudaLP", (r) => r.financing.deudaLP, [0, 0, 18613]);
cfSeries("fin.otrosCirculantes", (r) => r.financing.otrosCirculantes, [-3635, 532, -3479]);
cfSeries("fin.otrasCxc", (r) => r.financing.otrasCxc, [-322, 113, -1157]);
cfSeries("fin.otrasCxp", (r) => r.financing.otrasCxp, [1182, 38, 191]);
cfSeries("fin.acreedores", (r) => r.financing.acreedores, [90, -338, 2488]);
cfSeries("fin.otrosIngresos", (r) => r.financing.otrosIngresos, [34, 42, 6]);
cfSeries("fin.cargosDiferidos", (r) => r.financing.cargosDiferidos, [0, 0, 0]);
cfSeries("fin.creditosDiferidos", (r) => r.financing.creditosDiferidos, [0, 0, 0]);
cfSeries("flujoFinExterno", "flujoFinExterno", [-2651, 5272, 11777]);
cfSeries("aportaciones", "aportaciones", [0, 7596, 5242]);
cfSeries("dividendos", "dividendos", [0, 0, 0]);
cfSeries("accionistas", "accionistas", [0, 7596, 5242]);
cfSeries("flujoFinanciamiento", "flujoFinanciamiento", [-2651, 12868, 17019]);
cfSeries("flujoPeriodo", "flujoPeriodo", [245, 1, 1993]);
cfSeries("cajaInicial", "cajaInicial", [48, 293, 294]);
cfSeries("cajaFinal", "cajaFinal", [293, 294, 2287]);
cfSeries("cajaBalance", "cajaBalance", [293, 294, 2287]);
cfSeries("diferencia 0", "diferencia", [0, 0, 0]);
check("claves del resultado", Object.keys(CF.y25).sort(), [
  "accionistas", "amortActivosDiferidos", "aportaciones", "cajaBalance", "cajaFinal", "cajaInicial", "cambiarioDevengado", "capex", "capexDetalle",
  "cif", "creacionCreditosDiferidos", "depAmort", "depreciacion", "diferencia", "dividendos", "ebitda", "efectivoOperacion", "financing",
  "flujoFinExterno", "flujoFinanciamiento", "flujoInversion", "flujoNetoInversion", "flujoOperacion", "flujoOperativoNetoImpuestos", "flujoPeriodo",
  "fxClientes", "fxDeudaCP", "fxDeudaLP", "gastoFinNeto", "impPagar", "impRecuperar", "impuestos", "isrPtu", "otrosActivos", "prevYearId",
  "reservaCxc", "reservaInventarios", "reservas", "resultadoOp", "wcTotal", "workingCapital",
]);
check("workingCapital con 8 líneas", Object.keys(CF.y25.workingCapital), ["clientes", "inventarios", "proveedores", "pagosAnticipados", "cxcRelacionadas", "cxpRelacionadas", "anticipos", "gastosAcumulados"]);
check("financing con 10 líneas", Object.keys(CF.y25.financing), ["porcionCirculante", "deudaCP", "deudaLP", "otrosCirculantes", "otrasCxc", "otrasCxp", "acreedores", "otrosIngresos", "cargosDiferidos", "creditosDiferidos"]);
check("capexDetalle", Object.keys(CF.y25.capexDetalle), ["activoFijoInicial", "depreciacion", "ventaActivoFijo", "ajusteRevaluacion", "variacionRevaluacion", "activoFijoFinal"]);
check("un solo año → {}", computeCashflow({ sections: SECTIONS, years: [YEARS[0]] }), {});

// Capturas complementarias: cada una se neutraliza dentro del estado, así
// que el flujo del periodo y la diferencia no cambian (propiedad del §5).
console.log("\n== (d) capturas complementarias: signos y neutralidad ==");
const CFV1 = computeCashflow(variant({ cashflow: { y25: { venta_activo_fijo: 100 } } })).y25;
approx("venta AF 100 → capex −100", CFV1.capex - CF.y25.capex, -100);
approx("venta AF 100 → otrosIngresos +100 (se cancela: flujoPeriodo igual)", CFV1.flujoPeriodo, 1);
const CFX = computeCashflow(variant({ cashflow: { y25: { venta_activo_fijo: 100, cambiaria_clientes: 50, cambiaria_deuda_cp: 30, cambiaria_deuda_lp: -20, ajuste_revaluacion: 40 } } })).y25;
approx("venta AF 100 + ajuste 40 → capex −60", CFX.capex - CF.y25.capex, -60);
approx("otrosIngresos = otros productos + venta AF", CFX.financing.otrosIngresos, 142);
approx("cambiaria clientes +50 → clientes +50", CFX.workingCapital.clientes - CF.y25.workingCapital.clientes, 50);
approx("cambiaria deuda CP +30 → deudaCP +30", CFX.financing.deudaCP - CF.y25.financing.deudaCP, 30);
approx("cambiaria deuda LP −20 → deudaLP −20", CFX.financing.deudaLP - CF.y25.financing.deudaLP, -20);
approx("cif resta los tres efectos (−50 −30 +20)", CFX.cif - CF.y25.cif, -60);
approx("ajuste revaluación 40 → capex +40", CFX.capex - CF.y25.capex + 100, 40);
approx("ajuste revaluación 40 → aportaciones −40", CFX.aportaciones - CF.y25.aportaciones, -40);
check("fx capturados en el resultado", [CFX.fxClientes, CFX.fxDeudaCP, CFX.fxDeudaLP, CFX.capexDetalle.ventaActivoFijo, CFX.capexDetalle.ajusteRevaluacion], [50, 30, -20, 100, 40]);
approx("flujoPeriodo no cambia", CFX.flujoPeriodo, 1);
approx("diferencia sigue en 0", CFX.diferencia, 0);
// Revaluación de activos en el capital: entra al CAPEX y se cancela con el activo fijo.
const CFR = computeCashflow(variant({ balance: { y25: { revaluacion: 500, activos_fijos: 12672 } } })).y25;
approx("revaluación +500 con AF +500 → capex igual", CFR.capex, -6013);
approx("variacionRevaluacion 500", CFR.capexDetalle.variacionRevaluacion, 500);
approx("diferencia 0", CFR.diferencia, 0);
// Diferidos: alza de activos diferidos → cargos diferidos (−); baja → amortización en EBITDA.
const CFD = computeCashflow(variant({ balance: { y24: { activos_diferidos: 100, pasivos_diferidos: 50, efectivo: 243 }, y25: { activos_diferidos: 40, pasivos_diferidos: 120, efectivo: 374 } } }));
check("2024: cargos diferidos −100, créditos diferidos +50 en EBITDA", [CFD.y24.financing.cargosDiferidos, CFD.y24.creacionCreditosDiferidos, CFD.y24.amortActivosDiferidos, CFD.y24.financing.creditosDiferidos], [-100, 50, 0, 0]);
check("2025: amortización 60 y créditos 70 en EBITDA; financiamiento 0", [CFD.y25.amortActivosDiferidos, CFD.y25.creacionCreditosDiferidos, CFD.y25.financing.cargosDiferidos, CFD.y25.financing.creditosDiferidos], [60, 70, 0, 0]);
approx("2025 ebitda con diferidos", CFD.y25.ebitda, 6394 + 130);
check("diferidos: diferencia 0 en ambos años", [CFD.y24.diferencia, CFD.y25.diferencia], [0, 0]);
// Reservas: reducen el saldo contable, no son efectivo.
const CFS = computeCashflow(variant({ income: { y25: { reserva_cxc: 100, reserva_inventarios: 50, gasto_general: 24734 } } })).y25;
approx("reservas 150 → ebitda +150", CFS.ebitda, 6544);
approx("clientes −100 por la reserva", CFS.workingCapital.clientes, 393);
approx("inventarios −50 por la reserva", CFS.workingCapital.inventarios, -493);
approx("flujoPeriodo no cambia", CFS.flujoPeriodo, 1);
// Dividendos: si los acumulados no suben con la utilidad anterior, hubo retiro.
const CFV = computeCashflow(variant({ balance: { y26: { resultados_acumulados: -1585, efectivo: 1287 } } })).y26;
approx("retiro de 1000 → dividendos −1000", CFV.dividendos, -1000);
approx("accionistas 4242", CFV.accionistas, 4242);
approx("diferencia 0", CFV.diferencia, 0);

// ---------- (e) computeRatios ----------
console.log("\n== (e) computeRatios: hoja Razones Financieras ==");
const R = computeRatios(FIXTURE);
check("una entrada por año", Object.keys(R), YEARS.map((y) => y.id));
check("months por año", YEARS.map((y) => R[y.id].months), [12, 12, 12, 6]);
check("forma { months, values, status, na, aux }", Object.keys(R.y25).sort(), ["aux", "months", "na", "status", "values"]);
check("values con las 41 claves (2025)", Object.keys(R.y25.values).sort(), RATIO_DEFS.map((d) => d.key).sort());
check("status con las 41 claves (2025)", Object.keys(R.y25.status).sort(), RATIO_DEFS.map((d) => d.key).sort());
check("aux con las 22 cifras base", Object.keys(R.y25.aux).sort(), [
  "activoCirculante", "anticipos", "cias_relacionadas", "clientes", "costo", "cxc_relacionadas", "deuda_total", "ebitda", "efectivo", "gastosFin",
  "inventarios", "otras_cxc", "pasivoCirculante", "prodFin", "proveedores", "resultadoOp", "rif", "totalActivo", "totalCapital", "totalPasivo", "utilidadNeta", "ventas",
]);

const EXPECTED = {
  crecimiento_ventas: [null, 84.78132118451025, 0.24621594349142284, 0.3344342637971447],
  dias_clientes: [357.129840546697, 45.451696850602794, 34.58086511826124, 28.334371257485028],
  dias_inventario: [0, 20.543299908842297, 23.640799474523785, 60.88708568284967],
  dias_anticipos: [0, 0, 0.1914234775265084, 2.244533076605694],
  dias_proveedores: [403.97727272727275, 144.03281677301732, 115.14685183447499, 196.56168339980744],
  ciclo_economico: [-46.847432180575765, -78.03782001357223, -57.116610719216474, -109.58475953607842],
  dias_otras_cxc: [22.551252847380407, 1.8020075415582346, 1.012571915619007, 4.084311377245509],
  ciclo_con_ocxc: [-24.296179333195358, -76.23581247201399, -56.10403880359747, -105.50044815883291],
  dias_cxc_inter: [0, 0, 0, 0],
  dias_cxp_inter: [0, 0, 0, 0],
  ciclo_con_inter: [-24.296179333195358, -76.23581247201399, -56.10403880359747, -105.50044815883291],
  ebit: [-22, -2570, 5184, 2883],
  ebitda: [-22, -2570, 6394, 3528],
  inversion_capital_trabajo: [null, 12499, -10214, 6523],
  flujo_operacion: [null, 9929, -3820, 10051],
  efectivo_operacion: [null, 10060, -5288, 6307],
  efectivo_inversion: [null, -7164, -7579, -21333],
  efectivo_fin_externo: [null, -2651, 5272, 11777],
  accionistas: [null, 0, 7596, 5242],
  efectivo_periodo: [null, 245, 1, 1993],
  liquidez: [0.6038894575230297, 0.5935261169727758, 0.740344424009363, 0.9164298513946458],
  acido: [0.6038894575230297, 0.47121271329946596, 0.59993312155158, 0.649320325085525],
  liquidez_inmediata: [0.02456499488229273, 0.009541487560244886, 0.00983113191773951, 0.04139591290024798],
  capital_trabajo: [-774, -12482, -7765, -4617],
  cobertura_rif_ebit: [-2.4444444444444446, -1.2798804780876494, 3.7619738751814222, 0.9914030261348006],
  cobertura_rif_ebitda: [-2.4444444444444446, -1.2798804780876494, 4.6400580551523944, 1.2132049518569463],
  cobertura_int_ebit: [-1.375, -14.043715846994536, 8.281150159744408, 0.9543197616683218],
  cobertura_int_ebitda: [-1.375, -14.043715846994536, 10.21405750798722, 1.1678252234359483],
  apalancamiento: [102.84210526315789, null, 4.557994208199969, 6.267820773930754],
  apalancamiento_financiero: [0, null, 0.7445511354976375, 1.5795145960624575],
  capital_activo: [0.00963000506842372, -0.172822060115342, 0.17992102232216312, 0.13759282611741627],
  pasivo_ebitda: [null, null, 4.67704097591492, 20.935374149659864],
  pasivo_fin_ebitda: [null, null, 0.7639974976540507, 5.275793650793651],
  deuda_cp: [0, 0, 4885, 0],
  deuda_lp: [0, 0, 0, 18613],
  deuda_total: [0, 0, 4885, 18613],
  margen_bruto: [0.19817767653758542, 0.1260821073875405, 0.31875133177072235, 0.30337724550898204],
  margen_operativo: [-0.025056947608200455, -0.03412289553348558, 0.05523119539740038, 0.04603592814371257],
  margen_neto: [-0.03530751708428246, -0.06033246587710447, 0.03718303856808012, -0.0003033932135728543],
  roa: [-0.015712113532691332, -0.17354772180422412, 0.09570558876761917, -0.0004436971650086405],
  roe: [-1.6315789473684212, null, 0.5319311080627953, -0.003224711473183978],
};
check("EXPECTED cubre las 41 razones", Object.keys(EXPECTED).sort(), RATIO_DEFS.map((d) => d.key).sort());
Object.entries(EXPECTED).forEach(([key, arr]) => series(key, (id) => R[id].values[key], arr));

console.log("\n== (e) aux ==");
series("aux.ventas", (id) => R[id].aux.ventas, [878, 75316, 93860, 62625]);
series("aux.costo", (id) => R[id].aux.costo, [704, 65820, 63942, 43626]);
series("aux.ebitda", (id) => R[id].aux.ebitda, [-22, -2570, 6394, 3528]);
series("aux.rif", (id) => R[id].aux.rif, [-9, -2008, -1378, -2908]);
series("aux.totalCapital", (id) => R[id].aux.totalCapital, [19, -4525, 6561, 11784]);
series("aux.deuda_total", (id) => R[id].aux.deuda_total, [0, 0, 4885, 18613]);
check("aux 2025 (cifras base)", [R.y25.aux.resultadoOp, R.y25.aux.gastosFin, R.y25.aux.prodFin, R.y25.aux.utilidadNeta, R.y25.aux.activoCirculante, R.y25.aux.pasivoCirculante, R.y25.aux.totalActivo, R.y25.aux.totalPasivo, R.y25.aux.efectivo, R.y25.aux.clientes, R.y25.aux.inventarios, R.y25.aux.proveedores, R.y25.aux.anticipos, R.y25.aux.otras_cxc, R.y25.aux.cxc_relacionadas, R.y25.aux.cias_relacionadas],
  [5184, 626, 0, 3490, 22140, 29905, 36466, 29905, 294, 9016, 4199, 20452, 34, 264, 0, 0]);

console.log("\n== (e) N/A del fixture y sus motivos ==");
check("2023 na", R.y23.na, {
  crecimiento_ventas: "Sin año anterior",
  inversion_capital_trabajo: "Sin año anterior", flujo_operacion: "Sin año anterior", efectivo_operacion: "Sin año anterior",
  efectivo_inversion: "Sin año anterior", efectivo_fin_externo: "Sin año anterior", accionistas: "Sin año anterior", efectivo_periodo: "Sin año anterior",
  pasivo_ebitda: "EBITDA negativo o cero", pasivo_fin_ebitda: "Sin deuda con costo",
});
check("2024 na", R.y24.na, {
  apalancamiento: "Capital contable negativo o cero", apalancamiento_financiero: "Capital contable negativo o cero",
  pasivo_ebitda: "EBITDA negativo o cero", pasivo_fin_ebitda: "Sin deuda con costo", roe: "Capital contable negativo o cero",
});
check("2025 y jun 2026: todo calculable", [R.y25.na, R.y26.na], [{}, {}]);

console.log("\n== (e) estatus por año ==");
const informativos = RATIO_DEFS.filter((d) => !d.semaforo).map((d) => d.key);
YEARS.forEach((y) => check(`informativos sin estatus ${yearLabel(y)}`, informativos.map((k) => R[y.id].status[k]), informativos.map(() => null)));
const STATUS_25 = {
  crecimiento_ventas: "verde", dias_clientes: "verde", dias_inventario: "verde", dias_proveedores: "ambar", ciclo_economico: "verde", ciclo_con_ocxc: "verde", ciclo_con_inter: "verde",
  liquidez: "rojo", acido: "rojo", liquidez_inmediata: "rojo", capital_trabajo: "rojo",
  cobertura_rif_ebit: "verde", cobertura_rif_ebitda: "verde", cobertura_int_ebit: "verde", cobertura_int_ebitda: "verde",
  apalancamiento: "rojo", apalancamiento_financiero: "ambar", capital_activo: "rojo", pasivo_ebitda: "ambar", pasivo_fin_ebitda: "verde",
  margen_bruto: "verde", margen_operativo: "ambar", margen_neto: "ambar", roa: "verde", roe: "verde",
};
Object.entries(STATUS_25).forEach(([k, s]) => check(`2025 ${k} ${s}`, R.y25.status[k], s));
check("2023 crecimiento null (sin año anterior)", R.y23.status.crecimiento_ventas, null);
check("2023 dias_clientes rojo (357)", R.y23.status.dias_clientes, "rojo");
check("2023 dias_inventario verde (0 días, no N/A)", [R.y23.values.dias_inventario, R.y23.status.dias_inventario, R.y23.na.dias_inventario], [0, "verde", undefined]);
check("2023 dias_proveedores rojo (404)", R.y23.status.dias_proveedores, "rojo");
check("2023 ciclo verde (negativo)", R.y23.status.ciclo_economico, "verde");
check("2023 apalancamiento rojo (102.8)", R.y23.status.apalancamiento, "rojo");
check("2023 apalancamiento_financiero verde (0)", R.y23.status.apalancamiento_financiero, "verde");
check("2023 capital_activo rojo (0.96 %)", R.y23.status.capital_activo, "rojo");
check("2023 pasivo_ebitda null rojo (EBITDA ≤ 0)", [R.y23.values.pasivo_ebitda, R.y23.status.pasivo_ebitda], [null, "rojo"]);
check("2023 pasivo_fin_ebitda null verde (sin deuda)", [R.y23.values.pasivo_fin_ebitda, R.y23.status.pasivo_fin_ebitda], [null, "verde"]);
check("2023 margen_bruto ámbar (19.8 %)", R.y23.status.margen_bruto, "ambar");
check("2023 coberturas negativas rojo", ["cobertura_rif_ebit", "cobertura_rif_ebitda", "cobertura_int_ebit", "cobertura_int_ebitda"].map((k) => R.y23.status[k]), ["rojo", "rojo", "rojo", "rojo"]);
check("2024 crecimiento verde (8478 %)", R.y24.status.crecimiento_ventas, "verde");
check("2024 dias_clientes ámbar (45.45 > 45)", R.y24.status.dias_clientes, "ambar");
check("2024 apalancamiento / apalancamiento_financiero / roe null rojo (TC −4525)", ["apalancamiento", "apalancamiento_financiero", "roe"].map((k) => [R.y24.values[k], R.y24.status[k]]), [[null, "rojo"], [null, "rojo"], [null, "rojo"]]);
check("2024 capital_activo negativo rojo", R.y24.status.capital_activo, "rojo");
check("2024 pasivo_fin_ebitda verde aunque EBITDA < 0 (sin deuda manda)", R.y24.status.pasivo_fin_ebitda, "verde");
check("jun 2026 dias_inventario ámbar (60.9)", R.y26.status.dias_inventario, "ambar");
check("jun 2026 coberturas rojo (< 1.5)", ["cobertura_rif_ebit", "cobertura_rif_ebitda", "cobertura_int_ebit", "cobertura_int_ebitda"].map((k) => R.y26.status[k]), ["rojo", "rojo", "rojo", "rojo"]);
check("jun 2026 apalancamiento_financiero rojo (1.58)", R.y26.status.apalancamiento_financiero, "rojo");
check("jun 2026 pasivo_ebitda rojo (20.9) y pasivo_fin_ebitda rojo (5.28)", [R.y26.status.pasivo_ebitda, R.y26.status.pasivo_fin_ebitda], ["rojo", "rojo"]);
check("jun 2026 margen_operativo rojo (4.6 %)", R.y26.status.margen_operativo, "rojo");
check("jun 2026 margen_bruto verde (30.3 %)", R.y26.status.margen_bruto, "verde");
check("jun 2026 roa / roe rojo", [R.y26.status.roa, R.y26.status.roe], ["rojo", "rojo"]);

console.log("\n== ratioStatus: bordes de las bandas ==");
const st = (key, v) => ratioStatus(RATIO_BY_KEY[key], v);
check("crecimiento 0.1 verde / 0.099 ámbar / 0 ámbar / −0.01 rojo", [st("crecimiento_ventas", 0.1), st("crecimiento_ventas", 0.099), st("crecimiento_ventas", 0), st("crecimiento_ventas", -0.01)], ["verde", "ambar", "ambar", "rojo"]);
check("dias_clientes 45 verde / 46 ámbar / 75 ámbar / 76 rojo", [45, 46, 75, 76].map((v) => st("dias_clientes", v)), ["verde", "ambar", "ambar", "rojo"]);
check("dias_inventario 60 verde / 61 ámbar / 90 ámbar / 91 rojo", [60, 61, 90, 91].map((v) => st("dias_inventario", v)), ["verde", "ambar", "ambar", "rojo"]);
check("dias_proveedores rango 30,90 verde", [st("dias_proveedores", 30), st("dias_proveedores", 90)], ["verde", "verde"]);
check("dias_proveedores 15,29,91,120 ámbar", [15, 29, 91, 120].map((v) => st("dias_proveedores", v)), ["ambar", "ambar", "ambar", "ambar"]);
check("dias_proveedores 14,121 rojo", [st("dias_proveedores", 14), st("dias_proveedores", 121)], ["rojo", "rojo"]);
check("ciclo 45 verde / 46 ámbar / 90 ámbar / 91 rojo (tres variantes)", ["ciclo_economico", "ciclo_con_ocxc", "ciclo_con_inter"].map((k) => [45, 46, 90, 91].map((v) => st(k, v))), [["verde", "ambar", "ambar", "rojo"], ["verde", "ambar", "ambar", "rojo"], ["verde", "ambar", "ambar", "rojo"]]);
check("liquidez 1.5 verde / 1.49 ámbar / 1.0 ámbar / 0.99 rojo", [1.5, 1.49, 1.0, 0.99].map((v) => st("liquidez", v)), ["verde", "ambar", "ambar", "rojo"]);
check("acido 1 verde / 0.7 ámbar / 0.69 rojo", [1, 0.7, 0.69].map((v) => st("acido", v)), ["verde", "ambar", "rojo"]);
check("liquidez_inmediata 0.3 verde / 0.1 ámbar / 0.09 rojo", [0.3, 0.1, 0.09].map((v) => st("liquidez_inmediata", v)), ["verde", "ambar", "rojo"]);
check("coberturas 3 verde / 1.5 ámbar / 1.49 rojo", ["cobertura_rif_ebit", "cobertura_rif_ebitda", "cobertura_int_ebit", "cobertura_int_ebitda"].map((k) => [3, 1.5, 1.49].map((v) => st(k, v))), Array(4).fill(["verde", "ambar", "rojo"]));
check("apalancamiento 1 verde / 1.01 ámbar / 2 ámbar / 2.01 rojo", [1, 1.01, 2, 2.01].map((v) => st("apalancamiento", v)), ["verde", "ambar", "ambar", "rojo"]);
check("apalancamiento_financiero 0.5 verde / 0.51 ámbar / 1 ámbar / 1.01 rojo", [0.5, 0.51, 1, 1.01].map((v) => st("apalancamiento_financiero", v)), ["verde", "ambar", "ambar", "rojo"]);
check("capital_activo 0.5 verde / 0.33 ámbar / 0.32 rojo", [0.5, 0.33, 0.32].map((v) => st("capital_activo", v)), ["verde", "ambar", "rojo"]);
check("pasivo_ebitda 3 verde / 3.01 ámbar / 5 ámbar / 5.01 rojo", [3, 3.01, 5, 5.01].map((v) => st("pasivo_ebitda", v)), ["verde", "ambar", "ambar", "rojo"]);
check("pasivo_fin_ebitda 2 verde / 2.01 ámbar / 3.5 ámbar / 3.51 rojo", [2, 2.01, 3.5, 3.51].map((v) => st("pasivo_fin_ebitda", v)), ["verde", "ambar", "ambar", "rojo"]);
check("margen_bruto 0.3 verde / 0.15 ámbar / 0.149 rojo", [0.3, 0.15, 0.149].map((v) => st("margen_bruto", v)), ["verde", "ambar", "rojo"]);
check("margen_operativo 0.1 verde / 0.05 ámbar / 0.049 rojo", [0.1, 0.05, 0.049].map((v) => st("margen_operativo", v)), ["verde", "ambar", "rojo"]);
check("margen_neto 0.05 verde / 0 ámbar / −0.01 rojo", [0.05, 0, -0.01].map((v) => st("margen_neto", v)), ["verde", "ambar", "rojo"]);
check("roa 0.05 verde / 0 ámbar / −0.01 rojo", [0.05, 0, -0.01].map((v) => st("roa", v)), ["verde", "ambar", "rojo"]);
check("roe 0.15 verde / 0.149 ámbar / −0.01 rojo", [0.15, 0.149, -0.01].map((v) => st("roe", v)), ["verde", "ambar", "rojo"]);
check("null → null", st("liquidez", null), null);
check("statusFrom sin bandas → null", st("capital_trabajo", 1000), null);
check("informativo → null", [st("ebitda", 5000), st("dias_anticipos", 10), st("deuda_total", 1)], [null, null, null]);
check("def undefined → null", ratioStatus(undefined, 1), null);

// ---------- (h) Reglas N/A ----------
console.log("\n== (h) reglas N/A ==");
const one = (patch) => computeRatios(variant(patch)).y25; // 2025 modificado
const naPc = one({ balance: { y25: { anticipos: 0, proveedores: 0, impuestos_pagar: 0, bancario_cp: 0, acreedores: 0, otras_cxp: 0 } } });
check("PC 0 → liquidez / acido / liquidez_inmediata null 'Sin pasivo circulante'", ["liquidez", "acido", "liquidez_inmediata"].map((k) => [naPc.values[k], naPc.na[k], naPc.status[k]]), Array(3).fill([null, "Sin pasivo circulante", null]));
check("PC 0 → capital_trabajo = AC, status null (hereda)", [naPc.values.capital_trabajo, naPc.status.capital_trabajo], [22140, null]);
check("PC 0 → sin deuda → pasivo_fin_ebitda verde, apalancamiento_financiero 0", [naPc.status.pasivo_fin_ebitda, naPc.na.pasivo_fin_ebitda, naPc.values.apalancamiento_financiero], ["verde", "Sin deuda con costo", 0]);

const naVentas = one({ income: { y25: { ventas: 0 } } });
check("ventas 0 → dias_clientes / dias_otras_cxc / dias_cxc_inter null 'Sin ventas'", ["dias_clientes", "dias_otras_cxc", "dias_cxc_inter"].map((k) => [naVentas.values[k], naVentas.na[k]]), Array(3).fill([null, "Sin ventas"]));
check("ventas 0 → márgenes null 'Sin ventas'", ["margen_bruto", "margen_operativo", "margen_neto"].map((k) => [naVentas.values[k], naVentas.na[k], naVentas.status[k]]), Array(3).fill([null, "Sin ventas", null]));
approx("ventas 0 → ciclo = inventario − anticipos − proveedores", naVentas.values.ciclo_economico, EXPECTED.dias_inventario[2] - EXPECTED.dias_anticipos[2] - EXPECTED.dias_proveedores[2]);
approx("ventas 0 → ciclo_con_ocxc = ciclo (otras CxC cuentan 0)", naVentas.values.ciclo_con_ocxc, naVentas.values.ciclo_economico);
check("ventas 0 → crecimiento −1 (ventas del año anterior sí hay)", naVentas.values.crecimiento_ventas, -1);

const naCosto = one({ income: { y25: { costo: 0 } } });
check("costo 0 → días de inventario / anticipos / proveedores / CxP inter null 'Sin costo de ventas'", ["dias_inventario", "dias_anticipos", "dias_proveedores", "dias_cxp_inter"].map((k) => [naCosto.values[k], naCosto.na[k]]), Array(4).fill([null, "Sin costo de ventas"]));
approx("costo 0 → ciclo = dias_clientes", naCosto.values.ciclo_economico, EXPECTED.dias_clientes[2]);
check("costo 0 → dias_clientes sigue", naCosto.na.dias_clientes, undefined);

const naCiclo = one({ income: { y25: { ventas: 0, costo: 0 } } });
check("sin ventas ni costo → los tres ciclos null con motivo", ["ciclo_economico", "ciclo_con_ocxc", "ciclo_con_inter"].map((k) => [naCiclo.values[k], naCiclo.na[k], naCiclo.status[k]]), Array(3).fill([null, "Sin ventas ni costo de ventas", null]));

const naInv = one({ balance: { y25: { inventarios: 0, otros_circulantes: 7302 } } });
check("inventario 0 → 0 días, verde (no N/A)", [naInv.values.dias_inventario, naInv.status.dias_inventario, naInv.na.dias_inventario], [0, "verde", undefined]);
approx("inventario 0 → acido = liquidez", naInv.values.acido, naInv.values.liquidez);

const naTc = one({ balance: { y25: { resultados_acumulados: -11136 } } });
check("TC = 0 → apalancamiento / apalancamiento_financiero / roe null rojo", ["apalancamiento", "apalancamiento_financiero", "roe"].map((k) => [naTc.values[k], naTc.status[k], naTc.na[k]]), Array(3).fill([null, "rojo", "Capital contable negativo o cero"]));
check("TC = 0 → capital_activo 0 rojo (sí se calcula)", [naTc.values.capital_activo, naTc.status.capital_activo], [0, "rojo"]);
check("TC = 0 → aux.totalCapital 0", naTc.aux.totalCapital, 0);

const naEbitda = one({ income: { y25: { gasto_general: 32000 } } }); // resultadoOp −2082, ebitda −872
check("EBITDA ≤ 0 con deuda → pasivo_ebitda y pasivo_fin_ebitda null rojo 'EBITDA negativo o cero'", ["pasivo_ebitda", "pasivo_fin_ebitda"].map((k) => [naEbitda.values[k], naEbitda.status[k], naEbitda.na[k]]), Array(2).fill([null, "rojo", "EBITDA negativo o cero"]));
check("EBITDA ≤ 0 → ebitda informativo sigue con valor", [naEbitda.values.ebitda, naEbitda.status.ebitda], [-872, null]);
check("EBITDA ≤ 0 → coberturas con EBITDA negativas rojo", [naEbitda.status.cobertura_rif_ebitda, naEbitda.status.cobertura_int_ebitda], ["rojo", "rojo"]);

const naDeuda = one({ balance: { y25: { bancario_cp: 0, otras_cxp: 6227 } } });
check("sin deuda → pasivo_fin_ebitda null verde 'Sin deuda con costo'", [naDeuda.values.pasivo_fin_ebitda, naDeuda.status.pasivo_fin_ebitda, naDeuda.na.pasivo_fin_ebitda], [null, "verde", "Sin deuda con costo"]);
check("sin deuda → deuda_* 0 y apalancamiento_financiero 0 verde", [naDeuda.values.deuda_cp, naDeuda.values.deuda_lp, naDeuda.values.deuda_total, naDeuda.values.apalancamiento_financiero, naDeuda.status.apalancamiento_financiero], [0, 0, 0, 0, "verde"]);

const naRif = one({ income: { y25: { utilidad_cambiaria: 626 } } }); // rif = 0 − 626 + 626 = 0
check("rif = 0 → coberturas del RIF null 'Sin costo financiero neto', status null", ["cobertura_rif_ebit", "cobertura_rif_ebitda"].map((k) => [naRif.values[k], naRif.na[k], naRif.status[k]]), Array(2).fill([null, "Sin costo financiero neto", null]));
check("rif = 0 → coberturas de intereses siguen", [naRif.values.cobertura_int_ebit != null, naRif.na.cobertura_int_ebit], [true, undefined]);
const naRifPos = one({ income: { y25: { utilidad_cambiaria: 1000 } } });
check("rif > 0 → también 'Sin costo financiero neto'", naRifPos.na.cobertura_rif_ebit, "Sin costo financiero neto");

const naInt = one({ income: { y25: { productos_financieros: 626 } } }); // gastosFin − prodFin = 0
check("intereses netos ≤ 0 → coberturas de intereses null 'Sin gastos financieros netos'", ["cobertura_int_ebit", "cobertura_int_ebitda"].map((k) => [naInt.values[k], naInt.na[k], naInt.status[k]]), Array(2).fill([null, "Sin gastos financieros netos", null]));
check("intereses netos ≤ 0 → coberturas del RIF siguen (rif = −752)", [naInt.aux.rif, naInt.values.cobertura_rif_ebit != null], [-752, true]);

const emptyBal = computeRatios(variant({ balance: { y25: Object.fromEntries(ALL_BALANCE_KEYS.map((k) => [k, 0])) } })).y25;
check("sin balance → capital_activo / roa null 'Sin activos'", ["capital_activo", "roa"].map((k) => [emptyBal.values[k], emptyBal.na[k]]), Array(2).fill([null, "Sin activos"]));
check("sin balance → TC = utilidad neta (3490) > 0: apalancamiento 0 verde", [emptyBal.aux.totalCapital, emptyBal.values.apalancamiento, emptyBal.status.apalancamiento], [3490, 0, "verde"]);
check("sin balance → liquidez N/A 'Sin pasivo circulante'", emptyBal.na.liquidez, "Sin pasivo circulante");
const noPrevVentas = computeRatios(variant({ income: { y24: { ventas: 0 } } })).y25;
check("ventas del año anterior 0 → crecimiento null 'Sin ventas el año anterior'", [noPrevVentas.values.crecimiento_ventas, noPrevVentas.na.crecimiento_ventas, noPrevVentas.status.crecimiento_ventas], [null, "Sin ventas el año anterior", null]);
check("NA_REASON exporta los 12 motivos", Object.values(NA_REASON).sort(), [
  "Capital contable negativo o cero", "EBITDA negativo o cero", "Sin activos", "Sin año anterior", "Sin costo de ventas", "Sin costo financiero neto",
  "Sin deuda con costo", "Sin gastos financieros netos", "Sin pasivo circulante", "Sin ventas", "Sin ventas el año anterior", "Sin ventas ni costo de ventas",
]);
check("sin años → {}", computeRatios({ sections: {}, years: [] }), {});

// ---------- (i) Año parcial ----------
console.log("\n== (i) año parcial: jun 2026 (6 meses) contra el mismo año como 12 meses ==");
const full26 = computeRatios(variant({ years: YEARS.map((y) => ({ ...y, months: 12 })) })).y26;
check("months 6 vs 12", [R.y26.months, full26.months], [6, 12]);
approx("dias_clientes con dayBase 180 = 9858 / (62625 / 180)", R.y26.values.dias_clientes, 9858 / (62625 / 180));
approx("dias_clientes a 12 meses = el doble (dayBase 360)", full26.values.dias_clientes, R.y26.values.dias_clientes * 2);
approx("dias_inventario a 12 meses = el doble", full26.values.dias_inventario, EXPECTED.dias_inventario[3] * 2);
approx("dias_proveedores a 12 meses = el doble", full26.values.dias_proveedores, EXPECTED.dias_proveedores[3] * 2);
approx("dias_anticipos a 12 meses = el doble", full26.values.dias_anticipos, EXPECTED.dias_anticipos[3] * 2);
approx("ciclo a 12 meses = el doble", full26.values.ciclo_economico, EXPECTED.ciclo_economico[3] * 2);
approx("roa parcial = (−19 / 85644) × 2", R.y26.values.roa, (-19 / 85644) * 2);
approx("roa a 12 meses = la mitad", full26.values.roa, R.y26.values.roa / 2);
approx("roe parcial = (−19 / 11784) × 2", R.y26.values.roe, (-19 / 11784) * 2);
approx("roe a 12 meses = la mitad", full26.values.roe, R.y26.values.roe / 2);
approx("crecimiento anualizado = (62625 × 2) / 93860 − 1", R.y26.values.crecimiento_ventas, (62625 * 2) / 93860 - 1);
approx("crecimiento a 12 meses = 62625 / 93860 − 1", full26.values.crecimiento_ventas, 62625 / 93860 - 1);
approx("márgenes no se anualizan", full26.values.margen_neto, R.y26.values.margen_neto);
approx("liquidez no cambia", full26.values.liquidez, R.y26.values.liquidez);
approx("coberturas no cambian (ambos reales)", full26.values.cobertura_int_ebitda, R.y26.values.cobertura_int_ebitda);
approx("ebitda no se anualiza", full26.values.ebitda, 3528);
approx("efectivo_periodo no se anualiza", full26.values.efectivo_periodo, 1993);
check("sin months → 12", computeRatios({ sections: SECTIONS, years: [{ id: "y25", year: 2025 }] }).y25.months, 12);

// ---------- summarizeRatios ----------
console.log("\n== summarizeRatios ==");
const S25 = summarizeRatios(R.y25);
check("2025 conteos (25 con semáforo)", [S25.verde, S25.ambar, S25.rojo, S25.na], [14, 5, 6, 0]);
check("2025 suma = 25 (los 16 informativos no cuentan)", S25.verde + S25.ambar + S25.rojo + S25.na, 25);
check("2025 atencion: rojos y luego ámbar, en orden del catálogo", S25.atencion.map((a) => a.key), [
  "liquidez", "acido", "liquidez_inmediata", "capital_trabajo", "apalancamiento", "capital_activo",
  "dias_proveedores", "apalancamiento_financiero", "pasivo_ebitda", "margen_operativo", "margen_neto",
]);
check("2025 atencion: forma {key, status, value}", S25.atencion[0], { key: "liquidez", status: "rojo", value: R.y25.values.liquidez });
const S23 = summarizeRatios(R.y23);
check("2023 conteos (crecimiento N/A → na; pasivo_ebitda rojo y pasivo_fin_ebitda verde cuentan)", [S23.verde, S23.ambar, S23.rojo, S23.na], [6, 1, 17, 1]);
check("2023 atencion incluye N/A con estatus rojo", S23.atencion.some((a) => a.key === "pasivo_ebitda" && a.value === null && a.status === "rojo"), true);
check("2023 atencion no incluye informativos ni N/A sin estatus", S23.atencion.some((a) => informativos.includes(a.key) || a.key === "crecimiento_ventas"), false);
const S24 = summarizeRatios(R.y24);
check("2024 conteos (margen bruto 12.6 % también rojo)", [S24.verde, S24.ambar, S24.rojo, S24.na], [6, 1, 18, 0]);
check("2024 atencion empieza con dias_proveedores (primer rojo del catálogo)", S24.atencion[0].key, "dias_proveedores");
const SPc = summarizeRatios(naPc);
check("PC 0 → 4 en na (liquidez, acido, inmediata y capital_trabajo heredado)", SPc.na, 4);
check("undefined → ceros", summarizeRatios(undefined), { verde: 0, ambar: 0, rojo: 0, na: 0, atencion: [] });

// ---------- ratioTrend ----------
console.log("\n== ratioTrend ==");
const tr = (key, curr, prev) => ratioTrend(RATIO_BY_KEY[key], curr, prev);
check("liquidez 1.2 → 1.5 mejora", tr("liquidez", 1.5, 1.2), "mejora");
check("liquidez 1.5 → 1.2 empeora", tr("liquidez", 1.2, 1.5), "empeora");
check("dias_clientes 40 → 50 empeora", tr("dias_clientes", 50, 40), "empeora");
check("dias_clientes 50 → 40 mejora", tr("dias_clientes", 40, 50), "mejora");
check("dias_proveedores (rango) → null", tr("dias_proveedores", 40, 20), null);
check("informativo sin better → null", [tr("dias_anticipos", 5, 1), tr("efectivo_inversion", -100, -500), tr("deuda_total", 100, 500), tr("accionistas", 10, 0)], [null, null, null, null]);
check("informativo con better: ebitda sube mejora, dias_otras_cxc sube empeora", [tr("ebitda", 6394, -2570), tr("dias_otras_cxc", 4.08, 1.01)], ["mejora", "empeora"]);
check("igual", tr("liquidez", 1.2, 1.2), "igual");
check("igual con ruido < 1e-9", tr("liquidez", 1.2 + 1e-12, 1.2), "igual");
check("curr null → null", tr("liquidez", null, 1.2), null);
check("prev null → null", tr("liquidez", 1.2, null), null);
check("capital_trabajo (higher) 100 → 50 empeora", tr("capital_trabajo", 50, 100), "empeora");
check("apalancamiento (lower) 2 → 1 mejora", tr("apalancamiento", 1, 2), "mejora");
check("ciclo (lower) −57 → −109 mejora", tr("ciclo_economico", -109.58, -57.12), "mejora");
check("def undefined → null", ratioTrend(undefined, 1, 2), null);

// ---------- (f) Análisis opcionales ----------
console.log("\n== (f) computeSegments / computeExpenseBreakdown / computeSeasonality ==");
const OPT_YEARS = [{ id: "a", year: 2024, months: 12 }, { id: "b", year: 2025, months: 6 }];
const LINES = [{ id: "L1", name: "Piezas" }, { id: "L2", name: "Servicio" }];
const OPT = {
  years: OPT_YEARS,
  lines: LINES,
  sections: {
    [INCOME_SECTION]: {
      ventas: { a: 1000, b: 500 },
      costo: { a: 550, b: 300 },
      gasto_venta: { a: 60, b: 30 },
      gasto_admin: { a: 90, b: 40 },
      gasto_general: { a: 50, b: 30 },
      depreciacion: { a: 20, b: 10 },
      reserva_cxc: { a: 5, b: 0 },
      reserva_inventarios: { a: 0, b: 0 },
    },
    [SALES_SECTION]: { L1: { a: "600", b: 300 }, L2: { a: 400, b: 150 } },
    [SEGCOST_SECTION]: { L1: { a: 300, b: 200 }, L2: { a: 250, b: 90 } },
    [EXPENSES_SECTION]: {
      sueldos: { a: 100, b: 60 },
      renta: { a: 40, b: 20 },
      marketing: { a: 25, b: 0 },
      amortizaciones: { a: 8, b: 0 },
      otras_virtuales: { a: 2, b: 0 },
    },
    [SEASONALITY_SECTION]: {
      m01: { a: 80, b: 80 }, m02: { a: 80, b: 80 }, m03: { a: 90, b: 80 }, m04: { a: 80, b: 80 }, m05: { a: 80, b: 80 }, m06: { a: 90, b: 80 },
      m07: { a: 80 }, m08: { a: 80 }, m09: { a: 90 }, m10: { a: 80 }, m11: { a: 80 }, m12: { a: 90 },
    },
  },
};
const SEG = computeSegments(OPT);
check("segmentos: una entrada por año", Object.keys(SEG), ["a", "b"]);
check("segmentos a: por línea", SEG.a.bySegment, {
  L1: { ventas: 600, costo: 300, bruto: 300, margen: 0.5, pctVentas: 0.6, pctCosto: 300 / 550 },
  L2: { ventas: 400, costo: 250, bruto: 150, margen: 0.375, pctVentas: 0.4, pctCosto: 250 / 550 },
});
check("segmentos a: totales y diferencias 0", [SEG.a.totalVentas, SEG.a.totalCosto, SEG.a.totalBruto, SEG.a.margenTotal, SEG.a.ventasResultados, SEG.a.costoResultados, SEG.a.difVentas, SEG.a.difCosto], [1000, 550, 450, 0.45, 1000, 550, 0, 0]);
check("segmentos b: diferencias ≠ 0 (ventas 500 − 450, costo 300 − 290)", [SEG.b.totalVentas, SEG.b.totalCosto, SEG.b.difVentas, SEG.b.difCosto], [450, 290, 50, 10]);
check("segmentos: línea sin ventas → margen null", computeSegments({ ...OPT, sections: { ...OPT.sections, [SALES_SECTION]: { L1: { a: 0 }, L2: { a: 0 } } } }).a.bySegment.L1, { ventas: 0, costo: 300, bruto: -300, margen: null, pctVentas: null, pctCosto: 300 / 550 });
check("segmentos: sin líneas → totales 0 y diferencia = Estado de Resultados", computeSegments({ ...OPT, lines: [] }).a, { bySegment: {}, totalVentas: 0, totalCosto: 0, totalBruto: 0, margenTotal: null, ventasResultados: 1000, costoResultados: 550, difVentas: 1000, difCosto: 550 });

const EXP = computeExpenseBreakdown(OPT);
check("gasto a: concepts con las 20 claves", Object.keys(EXP.a.concepts), EXPENSE_CONCEPTS.map((c) => c.key));
check("gasto a: Σ 20 = 165; virtuales del memo y del desglose", [EXP.a.gastosOperacion, EXP.a.depreciacion, EXP.a.amortizaciones, EXP.a.reservaCxc, EXP.a.reservaInventarios, EXP.a.otrasVirtuales], [165, 20, 8, 5, 0, 2]);
check("gasto a: total 200 = gasto operativo del Estado de Resultados → diferencia 0", [EXP.a.total, EXP.a.gastoEnResultados, EXP.a.diferencia], [200, 200, 0]);
check("gasto a: pct sobre el total", [EXP.a.pct.sueldos, EXP.a.pct.renta, EXP.a.pct.bonos, EXP.a.pct.gastosOperacion, EXP.a.pct.depreciacion, EXP.a.pct.amortizaciones, EXP.a.pct.reservaCxc, EXP.a.pct.otrasVirtuales], [0.5, 0.2, 0, 0.825, 0.1, 0.04, 0.025, 0.01]);
check("gasto b: total 90 vs 100 en resultados → diferencia −10", [EXP.b.gastosOperacion, EXP.b.depreciacion, EXP.b.total, EXP.b.gastoEnResultados, EXP.b.diferencia], [80, 10, 90, 100, -10]);
check("gasto solo con depreciación → total 10, pct depreciación 1, diferencia −90", (() => { const e = computeExpenseBreakdown({ years: OPT_YEARS, sections: { [INCOME_SECTION]: OPT.sections[INCOME_SECTION] } }).b; return [e.total, e.pct.sueldos, e.pct.depreciacion, e.diferencia]; })(), [10, 0, 1, -90]);

const SEA = computeSeasonality(OPT);
check("estacionalidad a: 12 meses", SEA.a.months, [80, 80, 90, 80, 80, 90, 80, 80, 90, 80, 80, 90]);
check("estacionalidad a: total 1000 = ventas → diferencia 0", [SEA.a.total, SEA.a.ventasResultados, SEA.a.diferencia], [1000, 1000, 0]);
approx("estacionalidad a: pct marzo 0.09", SEA.a.pct[2], 0.09);
approx("estacionalidad a: pct suma 1", SEA.a.pct.reduce((s, v) => s + v, 0), 1);
check("estacionalidad b (6 meses): meses faltantes 0, total 480 vs 500 → diferencia 20", [SEA.b.months.slice(6), SEA.b.total, SEA.b.diferencia], [[0, 0, 0, 0, 0, 0], 480, 20]);
check("estacionalidad vacía → pct null", computeSeasonality({ years: OPT_YEARS, sections: {} }).a.pct, Array(12).fill(null));

// ---------- (g) formatRatio ----------
console.log("\n== (g) formatRatio ==");
check("ratio 0.7403 → '0.74 x'", formatRatio(RATIO_BY_KEY.liquidez, 0.740344424009363), "0.74 x");
check("ratio 102.842 → '102.84 x'", formatRatio(RATIO_BY_KEY.apalancamiento, 102.84210526315789), "102.84 x");
check("pct 0.3188 → '31.9%'", formatRatio(RATIO_BY_KEY.margen_bruto, 0.31875133177072235), "31.9%");
check("pct 84.78 → '8478.1%'", formatRatio(RATIO_BY_KEY.crecimiento_ventas, 84.78132118451025), "8478.1%");
check("pct −0.0003 → '-0.0%'", formatRatio(RATIO_BY_KEY.margen_neto, -0.0003033932135728543), "0.0%");
check("days 34.58 → '35 días'", formatRatio(RATIO_BY_KEY.dias_clientes, 34.58086511826124), "35 días");
check("days −57.1 → '-57 días'", formatRatio(RATIO_BY_KEY.ciclo_economico, -57.116610719216474), "-57 días");
check("days 0.19 → '0 días'", formatRatio(RATIO_BY_KEY.dias_anticipos, 0.1914234775265084), "0 días");
check("miles 6394 → '6,394'", formatRatio(RATIO_BY_KEY.ebitda, 6394), "6,394");
check("miles −12482 → '-12,482'", formatRatio(RATIO_BY_KEY.capital_trabajo, -12482), "-12,482");
check("miles 18613.4 → '18,613.4'", formatRatio(RATIO_BY_KEY.deuda_total, 18613.4), "18,613.4");
check("null → '—'", formatRatio(RATIO_BY_KEY.liquidez, null), "—");
check("undefined → '—'", formatRatio(RATIO_BY_KEY.roa, undefined), "—");
check("NaN → '—'", formatRatio(RATIO_BY_KEY.roa, NaN), "—");
check("def undefined → ratio", formatRatio(undefined, 1.5), "1.50 x");

console.log(`\n${failures === 0 ? "TODO OK" : `${failures} FALLA(S)`}`);
process.exit(failures === 0 ? 0 : 1);
