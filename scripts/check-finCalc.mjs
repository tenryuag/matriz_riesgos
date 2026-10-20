// Prueba del motor de razones financieras (src/config/finCalc.js) y de su
// catálogo (src/config/finConfig.js) con las 5 columnas de la hoja
// "Razones Financieras" del Excel del cliente, tratadas como años completos.
// También demuestra que ambos módulos importan desde Node ESM (sin React ni
// APIs del navegador), como los necesita el servidor MCP en Deno.
// Correr con: node scripts/check-finCalc.mjs
import {
  computeIncome,
  computeBalance,
  computeRatios,
  ratioStatus,
  ratioTrend,
  summarizeRatios,
  DAYS_BASE,
} from "../src/config/finCalc.js";
import {
  RATIO_GROUPS,
  RATIO_DEFS,
  RATIO_BY_KEY,
  RATIO_STATUS_LABEL,
  formatRatio,
} from "../src/config/finConfig.js";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${JSON.stringify(actual)}${ok ? "" : `  (esperado ${JSON.stringify(expected)})`}`);
};
// Comparación numérica con tolerancia relativa (1e-6 por defecto).
const approx = (name, actual, expected, tol = 1e-6) => {
  const ok =
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    (expected === 0 ? Math.abs(actual) <= 1e-9 : Math.abs(actual - expected) <= tol * Math.abs(expected));
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${actual}${ok ? "" : `  (esperado ${expected})`}`);
};

// ---------- Fixture del Excel ----------
// Cinco columnas como años completos (ids y22…y26), una línea de negocio L1
// con todo el costo en materia_prima y todos los gastos en sueldos. Las
// ventas van como texto para ejercitar toNumber (así llegan de la captura).
const YEARS = [2022, 2023, 2024, 2025, 2026].map((year, i) => ({ id: `y${22 + i}`, year, months: 12 }));
const LINES = [{ id: "L1" }];
const byYear = (arr, years = YEARS) => Object.fromEntries(arr.map((v, i) => [years[i].id, v]));

const BALANCE_ROWS = [
  { caja: 6533, inversiones: 3920, clientes: 3, otras_cxc: 36637, inventarios: 588, pagos_anticipados: 3467, impuestos_recuperar: 702, activos_fijos: 57988, porcion_circulante_lp: 14022, proveedores: 5865, acreedores: 2445, impuestos_pagar: 76, impuesto_diferido_pasivo: 5923, capital_social: 9761, resultados_acumulados: 51948, resultado_periodo: 19798 },
  { caja: 18464, inversiones: 4692, clientes: 724, otras_cxc: 35232, inventarios: 526, pagos_anticipados: 6508, impuestos_recuperar: 1060, activos_fijos: 98768, otros_activos: 419, porcion_circulante_lp: 15356, proveedores: 5372, acreedores: 805, impuestos_pagar: 143, cias_relacionadas: 1530, impuesto_diferido_pasivo: 16246, capital_social: 9761, resultados_acumulados: 71746, resultado_periodo: 45434 },
  { caja: 22120, inversiones: 2056, clientes: 846, otras_cxc: 29442, inventarios: 1719, pagos_anticipados: 26731, impuestos_recuperar: 1688, cxc_relacionadas: 3043, activos_fijos: 277823, impuesto_diferido_activo: 148224, porcion_circulante_lp: 49418, proveedores: 14901, acreedores: 40217, impuestos_pagar: 1214, cias_relacionadas: 193, bancario_lp: 217583, impuesto_diferido_pasivo: 20124, capital_social: 9761, resultados_acumulados: 117181, resultado_periodo: 43100 },
  { caja: 9250, inversiones: 6115, clientes: 1436, otras_cxc: 33879, inventarios: 1033, pagos_anticipados: 28141, cxc_relacionadas: 30383, activos_fijos: 381231, otros_activos: 1463, impuesto_diferido_activo: 137104, porcion_circulante_lp: 58367, proveedores: 24061, acreedores: 88903, impuestos_pagar: 6346, bancario_lp: 195297, impuesto_diferido_pasivo: 20124, capital_social: 9761, resultados_acumulados: 159909, resultado_periodo: 67267 },
  { caja: 26544, inversiones: 2467.2, clientes: 1015.2, otras_cxc: 35330.4, inventarios: 2062.8, pagos_anticipados: 32077.2, impuestos_recuperar: 2025.6, cxc_relacionadas: 3651.6, activos_fijos: 419354.1, otros_activos: 1200, impuesto_diferido_activo: 124000, porcion_circulante_lp: 70040.4, proveedores: 28873.2, acreedores: 106683.6, impuestos_pagar: 7615.2, bancario_lp: 182000, impuesto_diferido_pasivo: 20124, capital_social: 9761, resultados_acumulados: 152875, resultado_periodo: 71756 },
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

const VENTAS = [368053, 404858.3, 445344.13, 489878.543, 538866.3973];
const COSTO = [235000, 246500, 254950, 271825, 283725.5];
const GASTOS = [86650, 95315, 104846.5, 115331.15, 126864.265];
const INCOME_ROWS = [
  { depreciacion: 5000, otros_operacion: 10000, gastos_financieros: 2500, isr: 20000 },
  { depreciacion: 5500, otros_operacion: -5000, gastos_financieros: 3000, isr: 22000 },
  { depreciacion: 6050, otros_operacion: 5000, gastos_financieros: 3500, isr: 30000 },
  { depreciacion: 6655, otros_operacion: 10000, gastos_financieros: 3800, isr: 35000 },
  { depreciacion: 7320.5, otros_operacion: -5000, gastos_financieros: 4200, isr: 40000 },
];

const SECTIONS = {
  sales: { L1: byYear(VENTAS.map(String)) },
  "cost:L1": { materia_prima: byYear(COSTO) },
  expenses: { sueldos: byYear(GASTOS) },
  income: sectionFromRows(INCOME_ROWS),
  balance: sectionFromRows(BALANCE_ROWS),
};
const FIXTURE = { sections: SECTIONS, years: YEARS, lines: LINES };

// Fixture de un solo año (copia de la columna `idx` del Excel, id "s1") con
// ajustes opcionales por sección: { balance: {...}, income: {...}, ventas, costo, gastos, months }.
const singleYear = (idx, { balance = {}, income = {}, ventas, costo, gastos, months = 12 } = {}) => {
  const years = [{ id: "s1", year: 2030, months }];
  const one = (v) => ({ s1: v });
  const row = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, one(v)]));
  return {
    years,
    lines: LINES,
    sections: {
      sales: { L1: one(ventas ?? VENTAS[idx]) },
      "cost:L1": { materia_prima: one(costo ?? COSTO[idx]) },
      expenses: { sueldos: one(gastos ?? GASTOS[idx]) },
      income: row({ ...INCOME_ROWS[idx], ...income }),
      balance: row({ ...BALANCE_ROWS[idx], ...balance }),
    },
  };
};

// ---------- Catálogo ----------
console.log("== Catálogo ==");
check("DAYS_BASE 360", DAYS_BASE, 360);
check("5 grupos", RATIO_GROUPS.map((g) => g.key), ["liquidez", "eficiencia", "apalancamiento", "cobertura", "rentabilidad"]);
check("grupos con título y pregunta", RATIO_GROUPS.every((g) => g.title && g.question), true);
check("18 indicadores", RATIO_DEFS.length, 18);
check("orden del catálogo", RATIO_DEFS.map((d) => d.key), [
  "liquidez", "acido", "capital_trabajo",
  "dias_inventario", "dias_clientes", "dias_proveedores", "ciclo",
  "apalancamiento", "apalancamiento_fin", "capitalizacion", "deuda_neta", "deuda_ebitda",
  "cobertura",
  "margen_bruto", "margen_operativo", "margen_neto", "roa", "roe",
]);
check("claves únicas", new Set(RATIO_DEFS.map((d) => d.key)).size, 18);
check("todos en un grupo válido", RATIO_DEFS.every((d) => RATIO_GROUPS.some((g) => g.key === d.group)), true);
check("formatos válidos", RATIO_DEFS.every((d) => ["ratio", "pct", "days", "miles"].includes(d.format)), true);
check("better válido", RATIO_DEFS.every((d) => ["higher", "lower", "range"].includes(d.better)), true);
check("textos label/formula/what/how no vacíos", RATIO_DEFS.every((d) => ["label", "formula", "what", "how"].every((f) => String(d[f] || "").trim() !== "")), true);
check("bandas o statusFrom (nunca ambos)", RATIO_DEFS.every((d) => (d.bands && !d.statusFrom) || (!d.bands && d.statusFrom)), true);
check("statusFrom apunta a indicadores con bandas", RATIO_DEFS.filter((d) => d.statusFrom).every((d) => RATIO_BY_KEY[d.statusFrom]?.bands != null), true);
check("capital_trabajo hereda de liquidez", [RATIO_BY_KEY.capital_trabajo.statusFrom, RATIO_BY_KEY.capital_trabajo.better], ["liquidez", "higher"]);
check("deuda_neta hereda de deuda_ebitda", [RATIO_BY_KEY.deuda_neta.statusFrom, RATIO_BY_KEY.deuda_neta.better], ["deuda_ebitda", "lower"]);
check("RATIO_BY_KEY con 18 entradas", Object.keys(RATIO_BY_KEY).length, 18);
check("RATIO_STATUS_LABEL", RATIO_STATUS_LABEL, { verde: "Sano", ambar: "Vigilar", rojo: "Atender", na: "No aplica" });

// ---------- Regresión: computeBalance / computeIncome ----------
console.log("\n== Regresión computeBalance / computeIncome ==");
const BAL = computeBalance(FIXTURE);
const INC = computeIncome(FIXTURE);
const totals = {
  activoCirculante: [51850, 67206, 87645, 110237, 105174],
  totalActivo: [109838, 166393, 513692, 630035, 649728.1],
  pasivoCirculante: [22408, 23206, 105943, 177677, 213212.4],
  totalPasivo: [28331, 39452, 343650, 393098, 415336.4],
  totalCapital: [81507, 126941, 170042, 236937, 234392],
};
Object.entries(totals).forEach(([field, arr]) => {
  arr.forEach((exp, i) => approx(`${field} ${YEARS[i].year}`, BAL[YEARS[i].id][field], exp));
});
approx("utilidadBruta 2022", INC.y22.utilidadBruta, 133053);
approx("resultadoOp 2022", INC.y22.resultadoOp, 51403);
approx("ebitda 2022", INC.y22.ebitda, 56403);
approx("rai 2022", INC.y22.rai, 48903);
approx("utilidadNeta 2022", INC.y22.utilidadNeta, 28903);

// ---------- Las 18 razones por año ----------
console.log("\n== computeRatios: 18 razones por año (Excel con signo corregido) ==");
const R = computeRatios(FIXTURE);
check("una entrada por año", Object.keys(R), YEARS.map((y) => y.id));
check("factor 1 en años completos", YEARS.map((y) => R[y.id].factor), [1, 1, 1, 1, 1]);
check("values con las 18 claves (2024)", Object.keys(R.y24.values).sort(), RATIO_DEFS.map((d) => d.key).sort());
check("status con las 18 claves (2024)", Object.keys(R.y24.status).sort(), RATIO_DEFS.map((d) => d.key).sort());

const EBITDA = [56403, 58043.3, 90547.63, 112722.393, 123276.6323];
const DEUDA_NETA = [7489, -3108, 244881, 244414, 225496.4];
const GASTOS_FIN = INCOME_ROWS.map((r) => r.gastos_financieros);
const DIAS_INV = [0.9007659574468084, 0.8134685598377283, 1.5850166699352815, 1.8223489377356752, 1.964025087628711];
const DIAS_CLI = [3 / (368053 / 360), 0.6437807993562191, 0.6838756356797607, 1.0552819824157922, 0.6782237709220764];
const DIAS_PROV = [8.98468085106383, 8.20551724137931, 14.313159443028045, 25.800275912811543, 33.582304022726184];
const EXPECTED = {
  liquidez: [2.3139057479471616, 2.8960613634404897, 0.8272844831654758, 0.6204348339965218, 0.49328275466154886],
  acido: [2.2876651196001427, 2.873394811686633, 0.8110587768894594, 0.6146209132301874, 0.4836078952256061],
  capital_trabajo: [29442, 44000, -18298, -67440, -108038.4],
  dias_inventario: DIAS_INV,
  dias_clientes: DIAS_CLI,
  dias_proveedores: DIAS_PROV,
  ciclo: DIAS_INV.map((d, i) => d + DIAS_CLI[i] - DIAS_PROV[i]),
  apalancamiento: [0.3475897775651171, 0.3107900520714348, 2.0209712894461367, 1.6590823721073535, 1.771973446192703],
  apalancamiento_fin: [0.030672212202632904, 0.02363302636657975, 0.02058315004528293, 0.016038018545014077, 0.017918700296938463],
  capitalizacion: [0.7420655875015932, 0.7628986796319557, 0.3310193656899465, 0.37606958343584085, 0.36075398308923373],
  deuda_neta: DEUDA_NETA,
  deuda_ebitda: DEUDA_NETA.map((d, i) => (d <= 0 ? null : d / EBITDA[i])),
  cobertura: EBITDA.map((e, i) => e / GASTOS_FIN[i]),
  margen_bruto: [0.361505000638495, 0.39114500060885504, 0.42752136420884235, 0.44511756253835355, 0.47347709669481747],
  margen_operativo: [0.13966195086033806, 0.12978195087021815, 0.18973558717390088, 0.2165177359074493, 0.2151853091619749],
  margen_neto: [0.07852945092147055, 0.06803195093196816, 0.11451285997639636, 0.13731443020152864, 0.1331612671703701],
  roa: [0.26314208197527267, 0.16553160289194885, 0.0992766677308583, 0.1067677081431985, 0.1104402476974601],
  roe: [0.3546075797170795, 0.21697717837420571, 0.29991196292680666, 0.28390413063388187, 0.30613729265503997],
};
const EXPECTED_AUX = {
  rotacion_inventarios: [399.65986394557825, 442.54937163375223, 227.12694877505567, 197.54723837209306, 183.29704761289494],
  rotacion_proveedores: [40.068201193520885, 43.872919818456886, 25.151679573817393, 13.953339150967613, 10.719931537644852],
  ebitda: EBITDA,
  deuda_bruta: [14022, 15356, 267001, 253664, 252040.4],
  inventario_promedio: [588, 557, 1122.5, 1376, 1547.9],
  proveedores_promedio: [5865, 5618.5, 10136.5, 19481, 26467.1],
  ventas: VENTAS,
  costo: COSTO,
  gastos_financieros: GASTOS_FIN,
  caja: BALANCE_ROWS.map((r) => r.caja),
  clientes: BALANCE_ROWS.map((r) => r.clientes),
};
Object.entries(EXPECTED).forEach(([key, arr]) => {
  arr.forEach((exp, i) => {
    const y = YEARS[i];
    const actual = R[y.id].values[key];
    if (exp == null) check(`${key} ${y.year} → null`, actual, null);
    else approx(`${key} ${y.year}`, actual, exp);
  });
});
Object.entries(EXPECTED_AUX).forEach(([key, arr]) => {
  arr.forEach((exp, i) => approx(`aux.${key} ${YEARS[i].year}`, R[YEARS[i].id].aux[key], exp));
});
check("aux con cifras base del balance 2022", [R.y22.aux.activo_circulante, R.y22.aux.pasivo_circulante, R.y22.aux.total_activo, R.y22.aux.total_pasivo, R.y22.aux.total_capital, R.y22.aux.utilidad_neta], [51850, 22408, 109838, 28331, 81507, 28903]);
check("na vacío cuando todo se calcula (2024)", R.y24.na, {});
check("na 2023 solo deuda_ebitda", R.y23.na, { deuda_ebitda: "La caja cubre toda la deuda" });

// ---------- Estatus ----------
console.log("\n== Estatus 2024 / 2023 ==");
check("2024 liquidez rojo", R.y24.status.liquidez, "rojo");
// El plan enumera "acido rojo", pero su tabla de bandas pone 0.7–0.99 en
// ámbar y el valor 2024 es 0.811: mandan las bandas del catálogo.
check("2024 acido ámbar (0.81 entre 0.7 y 1)", R.y24.status.acido, "ambar");
check("2024 capital_trabajo rojo (hereda)", R.y24.status.capital_trabajo, "rojo");
check("2024 apalancamiento rojo (2.02 > 2)", R.y24.status.apalancamiento, "rojo");
check("2024 capitalizacion ámbar (0.3310 ≥ 0.33)", R.y24.status.capitalizacion, "ambar");
check("2024 margen_bruto verde", R.y24.status.margen_bruto, "verde");
check("2024 roe verde", R.y24.status.roe, "verde");
check("2024 dias_proveedores rojo (14.3 < 15)", R.y24.status.dias_proveedores, "rojo");
check("2024 deuda_ebitda ámbar (2.70)", R.y24.status.deuda_ebitda, "ambar");
check("2024 deuda_neta ámbar (hereda)", R.y24.status.deuda_neta, "ambar");
check("2024 ciclo verde (negativo)", R.y24.status.ciclo, "verde");
check("2023 deuda_ebitda verde con valor null", [R.y23.values.deuda_ebitda, R.y23.status.deuda_ebitda], [null, "verde"]);
check("2023 deuda_neta verde (hereda)", R.y23.status.deuda_neta, "verde");
check("2025 dias_proveedores ámbar (25.8)", R.y25.status.dias_proveedores, "ambar");
check("2026 dias_proveedores verde (33.6)", R.y26.status.dias_proveedores, "verde");
check("2022 todo sano salvo proveedores", Object.entries(R.y22.status).filter(([, s]) => s !== "verde").map(([k, s]) => `${k}:${s}`), ["dias_proveedores:rojo"]);

console.log("\n== ratioStatus: bordes de las bandas ==");
const st = (key, v) => ratioStatus(RATIO_BY_KEY[key], v);
check("liquidez 1.5 verde / 1.49 ámbar / 1.0 ámbar / 0.99 rojo", [st("liquidez", 1.5), st("liquidez", 1.49), st("liquidez", 1.0), st("liquidez", 0.99)], ["verde", "ambar", "ambar", "rojo"]);
check("dias_inventario 60 verde / 61 ámbar / 90 ámbar / 91 rojo", [st("dias_inventario", 60), st("dias_inventario", 61), st("dias_inventario", 90), st("dias_inventario", 91)], ["verde", "ambar", "ambar", "rojo"]);
check("dias_proveedores rango 30,90 verde", [st("dias_proveedores", 30), st("dias_proveedores", 90)], ["verde", "verde"]);
check("dias_proveedores 15,29,91,120 ámbar", [15, 29, 91, 120].map((v) => st("dias_proveedores", v)), ["ambar", "ambar", "ambar", "ambar"]);
check("dias_proveedores 14,121 rojo", [st("dias_proveedores", 14), st("dias_proveedores", 121)], ["rojo", "rojo"]);
check("apalancamiento_fin 0.05 verde / 0.1 ámbar / 0.11 rojo", [st("apalancamiento_fin", 0.05), st("apalancamiento_fin", 0.1), st("apalancamiento_fin", 0.11)], ["verde", "ambar", "rojo"]);
check("capitalizacion 0.5 verde / 0.33 ámbar / 0.32 rojo", [st("capitalizacion", 0.5), st("capitalizacion", 0.33), st("capitalizacion", 0.32)], ["verde", "ambar", "rojo"]);
check("margen_neto 0 ámbar / -0.01 rojo", [st("margen_neto", 0), st("margen_neto", -0.01)], ["ambar", "rojo"]);
check("roe 0.15 verde / 0.149 ámbar", [st("roe", 0.15), st("roe", 0.149)], ["verde", "ambar"]);
check("cobertura 3 verde / 1.5 ámbar / 1.49 rojo", [st("cobertura", 3), st("cobertura", 1.5), st("cobertura", 1.49)], ["verde", "ambar", "rojo"]);
check("null → null", st("liquidez", null), null);
check("statusFrom sin bandas → null", st("capital_trabajo", 1000), null);
check("def undefined → null", ratioStatus(undefined, 1), null);

// ---------- Año parcial ----------
console.log("\n== Año parcial: 2022 como 6 meses (×2 en flujos) ==");
const P = computeRatios(singleYear(0, { months: 6 })).s1;
check("factor 2", P.factor, 2);
approx("aux.ventas ×2", P.aux.ventas, 736106);
approx("aux.costo ×2", P.aux.costo, 470000);
approx("aux.ebitda ×2", P.aux.ebitda, 112806);
approx("aux.gastos_financieros ×2", P.aux.gastos_financieros, 5000);
approx("aux.utilidad_neta ×2", P.aux.utilidad_neta, 57806);
approx("margen_bruto idéntico", P.values.margen_bruto, EXPECTED.margen_bruto[0]);
approx("margen_operativo idéntico", P.values.margen_operativo, EXPECTED.margen_operativo[0]);
approx("margen_neto idéntico", P.values.margen_neto, EXPECTED.margen_neto[0]);
approx("dias_clientes = 3/(736106/360)", P.values.dias_clientes, 3 / (736106 / 360));
approx("dias_inventario a la mitad", P.values.dias_inventario, DIAS_INV[0] / 2);
approx("roa = 57806/109838", P.values.roa, 57806 / 109838);
approx("roe = 57806/81507", P.values.roe, 57806 / 81507);
approx("liquidez sin cambio", P.values.liquidez, EXPECTED.liquidez[0]);
approx("capital_trabajo sin cambio", P.values.capital_trabajo, 29442);
approx("deuda_neta sin cambio", P.values.deuda_neta, 7489);
approx("deuda_ebitda = 7489/112806", P.values.deuda_ebitda, 7489 / 112806);
approx("cobertura sin cambio (ambos ×2)", P.values.cobertura, 56403 / 2500);
approx("apalancamiento_fin ×2", P.values.apalancamiento_fin, 5000 / 81507);

// ---------- N/A ----------
console.log("\n== N/A y sus motivos ==");
const naInv = computeRatios(singleYear(0, { balance: { inventarios: 0 } })).s1;
check("inventarios 0 → dias_inventario null", naInv.values.dias_inventario, null);
check("inventarios 0 → na 'Sin inventarios'", naInv.na.dias_inventario, "Sin inventarios");
check("inventarios 0 → status null", naInv.status.dias_inventario, null);
check("inventarios 0 → aux.rotacion_inventarios null", naInv.aux.rotacion_inventarios, null);
approx("inventarios 0 → ciclo lo trata como 0", naInv.values.ciclo, DIAS_CLI[0] - DIAS_PROV[0]);
approx("inventarios 0 → acido = liquidez", naInv.values.acido, naInv.values.liquidez);

const naFin = computeRatios(singleYear(0, { income: { gastos_financieros: 0 } })).s1;
check("gastos fin 0 → cobertura null, status null, motivo", [naFin.values.cobertura, naFin.status.cobertura, naFin.na.cobertura], [null, null, "Sin gastos financieros"]);
check("gastos fin 0 → apalancamiento_fin 0 verde", [naFin.values.apalancamiento_fin, naFin.status.apalancamiento_fin], [0, "verde"]);

const naCap = computeRatios(singleYear(0, { balance: { resultados_acumulados: -100000 } })).s1;
check("capital negativo → TC < 0", naCap.aux.total_capital < 0, true);
["apalancamiento", "apalancamiento_fin", "roe"].forEach((k) => {
  check(`capital negativo → ${k} null, rojo, motivo`, [naCap.values[k], naCap.status[k], naCap.na[k]], [null, "rojo", "Capital contable negativo o cero"]);
});
check("capital negativo → capitalizacion negativa rojo", naCap.status.capitalizacion, "rojo");

const naPc = computeRatios(singleYear(0, { balance: { porcion_circulante_lp: 0, proveedores: 0, acreedores: 0, impuestos_pagar: 0 } })).s1;
check("sin pasivo circulante → liquidez/acido null con motivo", [naPc.values.liquidez, naPc.na.liquidez, naPc.values.acido, naPc.na.acido], [null, "Sin pasivo circulante", null, "Sin pasivo circulante"]);
check("sin pasivo circulante → capital_trabajo = AC, status null (hereda)", [naPc.values.capital_trabajo, naPc.status.capital_trabajo], [51850, null]);
check("proveedores 0 → dias_proveedores 'Sin crédito de proveedores'", [naPc.values.dias_proveedores, naPc.na.dias_proveedores], [null, "Sin crédito de proveedores"]);
check("proveedores 0 → deuda_neta negativa → deuda_ebitda verde", [naPc.values.deuda_ebitda, naPc.status.deuda_ebitda, naPc.status.deuda_neta], [null, "verde", "verde"]);

const naVentas = computeRatios(singleYear(0, { ventas: 0 })).s1;
check("ventas 0 → márgenes null 'Sin ventas'", ["margen_bruto", "margen_operativo", "margen_neto"].map((k) => [naVentas.values[k], naVentas.na[k]]), [[null, "Sin ventas"], [null, "Sin ventas"], [null, "Sin ventas"]]);
check("ventas 0 → dias_clientes null 'Sin ventas'", [naVentas.values.dias_clientes, naVentas.na.dias_clientes], [null, "Sin ventas"]);
approx("ventas 0 → ciclo = dias_inv − dias_prov", naVentas.values.ciclo, DIAS_INV[0] - DIAS_PROV[0]);

const naCosto = computeRatios(singleYear(0, { costo: 0 })).s1;
check("costo 0 → dias_inventario/dias_proveedores 'Sin costo de ventas'", [naCosto.na.dias_inventario, naCosto.na.dias_proveedores], ["Sin costo de ventas", "Sin costo de ventas"]);
check("costo 0 → rotaciones null", [naCosto.aux.rotacion_inventarios, naCosto.aux.rotacion_proveedores], [null, null]);

const naCiclo = computeRatios(singleYear(0, { ventas: 0, costo: 0 })).s1;
check("sin ventas ni costo → ciclo null con motivo", [naCiclo.values.ciclo, naCiclo.na.ciclo, naCiclo.status.ciclo], [null, "Sin ventas ni costo de ventas", null]);

const emptyBalance = singleYear(0);
emptyBalance.sections.balance = {};
const naTa = computeRatios(emptyBalance).s1;
check("sin balance → capitalizacion/roa 'Sin activos'", [naTa.values.capitalizacion, naTa.na.capitalizacion, naTa.values.roa, naTa.na.roa], [null, "Sin activos", null, "Sin activos"]);
check("sin balance → capital cero rojo en apalancamiento/roe", [naTa.status.apalancamiento, naTa.status.roe, naTa.na.roe], ["rojo", "rojo", "Capital contable negativo o cero"]);
check("sin balance → aux.total_activo 0", naTa.aux.total_activo, 0);

const naEbitda = computeRatios(singleYear(0, { gastos: 500000 })).s1;
check("EBITDA negativo con deuda → deuda_ebitda null rojo", [naEbitda.values.deuda_ebitda, naEbitda.status.deuda_ebitda, naEbitda.na.deuda_ebitda, naEbitda.status.deuda_neta], [null, "rojo", "EBITDA negativo o cero", "rojo"]);
check("EBITDA negativo → cobertura negativa rojo", naEbitda.status.cobertura, "rojo");
check("sin años → {}", computeRatios({ sections: {}, years: [], lines: [] }), {});

// ---------- summarizeRatios ----------
console.log("\n== summarizeRatios ==");
const S24 = summarizeRatios(R.y24);
check("2024 conteos", [S24.verde, S24.ambar, S24.rojo, S24.na], [10, 4, 4, 0]);
check("2024 atencion: rojos y luego ámbar, en orden del catálogo", S24.atencion.map((a) => a.key), ["liquidez", "capital_trabajo", "dias_proveedores", "apalancamiento", "acido", "capitalizacion", "deuda_neta", "deuda_ebitda"]);
check("2024 atencion: forma {key, status, value}", S24.atencion[0], { key: "liquidez", status: "rojo", value: R.y24.values.liquidez });
const S23 = summarizeRatios(R.y23);
check("2023 conteos (deuda_ebitda null cuenta como verde)", [S23.verde, S23.ambar, S23.rojo, S23.na], [17, 0, 1, 0]);
check("2023 atencion solo dias_proveedores", S23.atencion.map((a) => a.key), ["dias_proveedores"]);
const SFin = summarizeRatios(naFin);
check("cobertura N/A sin estatus → na 1 y fuera de atencion", [SFin.na, SFin.atencion.some((a) => a.key === "cobertura")], [1, false]);
check("suma de conteos = 18", SFin.verde + SFin.ambar + SFin.rojo + SFin.na, 18);
const SCap = summarizeRatios(naCap);
check("N/A con estatus rojo sí aparece en atencion", SCap.atencion.filter((a) => a.value === null && a.status === "rojo").map((a) => a.key), ["apalancamiento", "apalancamiento_fin", "roe"]);
check("undefined → ceros", summarizeRatios(undefined), { verde: 0, ambar: 0, rojo: 0, na: 0, atencion: [] });

// ---------- ratioTrend ----------
console.log("\n== ratioTrend ==");
const tr = (key, curr, prev) => ratioTrend(RATIO_BY_KEY[key], curr, prev);
check("liquidez 1.2 → 1.5 mejora", tr("liquidez", 1.5, 1.2), "mejora");
check("liquidez 1.5 → 1.2 empeora", tr("liquidez", 1.2, 1.5), "empeora");
check("dias_clientes 40 → 50 empeora", tr("dias_clientes", 50, 40), "empeora");
check("dias_clientes 50 → 40 mejora", tr("dias_clientes", 40, 50), "mejora");
check("dias_proveedores (rango) → null", tr("dias_proveedores", 40, 20), null);
check("igual", tr("liquidez", 1.2, 1.2), "igual");
check("igual con ruido < 1e-9", tr("liquidez", 1.2 + 1e-12, 1.2), "igual");
check("curr null → null", tr("liquidez", null, 1.2), null);
check("prev null → null", tr("liquidez", 1.2, null), null);
check("capital_trabajo (higher) 100 → 50 empeora", tr("capital_trabajo", 50, 100), "empeora");
check("deuda_neta (lower) 100 → 50 mejora", tr("deuda_neta", 50, 100), "mejora");
check("def undefined → null", ratioTrend(undefined, 1, 2), null);

// ---------- formatRatio ----------
console.log("\n== formatRatio ==");
check("ratio 2.3139 → '2.31 x'", formatRatio(RATIO_BY_KEY.liquidez, 2.3139057479471616), "2.31 x");
check("pct 0.3615 → '36.2%'", formatRatio(RATIO_BY_KEY.margen_bruto, 0.361505000638495), "36.2%");
check("days 42.4 → '42 días'", formatRatio(RATIO_BY_KEY.dias_clientes, 42.4), "42 días");
check("days 0.9 → '1 días'", formatRatio(RATIO_BY_KEY.dias_inventario, 0.9007659574468084), "1 días");
check("miles 29442 → '29,442'", formatRatio(RATIO_BY_KEY.capital_trabajo, 29442), "29,442");
check("miles 108038.4 → '108,038.4'", formatRatio(RATIO_BY_KEY.deuda_neta, 108038.4), "108,038.4");
check("null → '—'", formatRatio(RATIO_BY_KEY.liquidez, null), "—");
check("undefined → '—'", formatRatio(RATIO_BY_KEY.roa, undefined), "—");
check("NaN → '—'", formatRatio(RATIO_BY_KEY.roa, NaN), "—");

console.log(`\n${failures === 0 ? "TODO OK" : `${failures} FALLA(S)`}`);
process.exit(failures === 0 ? 0 : 1);
