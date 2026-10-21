// ============================================================
// Generador del seed demo del Análisis Financiero (modelo MP-AFH1).
// Produce supabase-seed-fin-demo.sql con la empresa ficticia
// "Metalmecánica del Bajío, S.A. de C.V." (2023, 2024 y 2025 completos,
// 2026 parcial a junio). Las cifras se validan con el motor real de la app
// (src/config/finCalc.js): el script ABORTA (sin escribir el SQL) si algún
// año del Balance no cuadra, si alguna `diferencia` del Estado de cambios no
// es 0, si segmentos, desglose del gasto o estacionalidad no suman lo del
// Estado de Resultados, o si el semáforo del último periodo no mezcla
// verde, ámbar y rojo. Al final imprime un resumen con las razones del
// último periodo.
// Correr con: node scripts/seed-fin-demo.mjs
// ============================================================
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeIncome,
  computeBalance,
  computeEbitda,
  computeCashflow,
  computeRatios,
  computeSegments,
  computeExpenseBreakdown,
  computeSeasonality,
  summarizeRatios,
} from "../src/config/finCalc.js";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  CASHFLOW_SECTION,
  SALES_SECTION,
  SEGCOST_SECTION,
  EXPENSES_SECTION,
  SEASONALITY_SECTION,
  INCOME_INPUT_KEYS,
  INCOME_MEMO,
  ALL_BALANCE_KEYS,
  ALL_CASHFLOW_KEYS,
  EXPENSE_CONCEPTS,
  EXPENSE_VIRTUAL,
  SEASON_MONTHS,
  RATIO_DEFS,
  RATIO_GROUPS,
  RATIO_STATUS_LABEL,
  formatRatio,
  fmtMiles,
  yearLabel,
} from "../src/config/finConfig.js";

const OUT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../supabase-seed-fin-demo.sql");

// ---------- Empresa, periodos y segmentos ----------
const COMPANY = {
  company_name: "Metalmecánica del Bajío, S.A. de C.V.",
  country: "México",
  main_activity:
    "Fabricación de piezas metálicas de precisión para la industria automotriz y de electrodomésticos",
  secondary_activities: "Mantenimiento industrial en planta y venta de refacciones",
  currency: "MXN",
};

// `id` es la clave interna del generador; `sql` la variable PL/pgSQL que
// lleva el UUID (determinista por análisis, calculado en el propio SQL).
const YEARS = [
  { id: "y2023", year: 2023, months: 12, sql: "v_y2023" },
  { id: "y2024", year: 2024, months: 12, sql: "v_y2024" },
  { id: "y2025", year: 2025, months: 12, sql: "v_y2025" },
  { id: "y2026", year: 2026, months: 6, sql: "v_y2026" },
];
const SEGMENTS = [
  { id: "seg_auto", name: "Piezas automotrices", sql: "v_seg_auto" },
  { id: "seg_electro", name: "Electrodomésticos", sql: "v_seg_electro" },
  { id: "seg_mant", name: "Mantenimiento y refacciones", sql: "v_seg_mant" },
];

// ---------- Historia de la empresa (cifras en miles de MXN) ----------
// 2023: año base, rentable pero con cobranza e inventario lentos.
// 2024: crece 15 %, mejora el margen operativo; apoya la operación con más
//       crédito bancario de corto plazo.
// 2025: el mejor año (margen operativo 11 %, utilidad neta > 5 % de ventas);
//       contrata un crédito a largo plazo para una celda de maquinado CNC,
//       vende una máquina vieja (150) y paga dividendos (800). La cobranza y
//       el inventario empiezan a estirarse.
// 2026 (6 meses): sigue creciendo (~12 % anualizado) pero el capital de
//       trabajo se desborda: 60 días de clientes, 92 días de inventario, la
//       caja baja y la línea de crédito de corto plazo sube; el semáforo
//       mezcla verde (coberturas, márgenes), ámbar (liquidez, apalancamiento)
//       y rojo (inventario, liquidez inmediata, pasivo / EBITDA).

// Estado de Resultados: capturas en POSITIVO; solo utilidad_cambiaria y
// otros_productos llevan signo (utilidad +, pérdida/gasto −). El memo
// (depreciacion, reserva_cxc, reserva_inventarios) va incluido en el gasto
// operativo y no altera los totales.
const INCOME = {
  y2023: {
    ventas: 41200, costo: 27600,
    gasto_venta: 3400, gasto_admin: 5300, gasto_general: 1650,
    productos_financieros: 120, gastos_financieros: 980, utilidad_cambiaria: -140,
    otros_productos: 60, isr: 690, ptu: 230,
    depreciacion: 1150, reserva_cxc: 80, reserva_inventarios: 60,
  },
  y2024: {
    ventas: 47400, costo: 31500,
    gasto_venta: 3900, gasto_admin: 5900, gasto_general: 1900,
    productos_financieros: 150, gastos_financieros: 1100, utilidad_cambiaria: 210,
    otros_productos: -45, isr: 1020, ptu: 340,
    depreciacion: 1300, reserva_cxc: 120, reserva_inventarios: 90,
  },
  y2025: {
    ventas: 55300, costo: 35900,
    gasto_venta: 4500, gasto_admin: 6600, gasto_general: 2150,
    productos_financieros: 180, gastos_financieros: 1350, utilidad_cambiaria: -380,
    otros_productos: 180, isr: 1430, ptu: 480,
    depreciacion: 1480, reserva_cxc: 150, reserva_inventarios: 110,
  },
  y2026: {
    ventas: 31000, costo: 20500,
    gasto_venta: 2650, gasto_admin: 3700, gasto_general: 1250,
    productos_financieros: 90, gastos_financieros: 820, utilidad_cambiaria: 95,
    otros_productos: 30, isr: 690, ptu: 230,
    depreciacion: 820, reserva_cxc: 90, reserva_inventarios: 70,
  },
};

// Balance: todas las cuentas salvo UNA, que se calcula para que cuadre
// ("plug"). En 2023 el plug son los resultados acumulados (la historia
// previa de la empresa); de 2024 en adelante los acumulados siguen la regla
// contable (acumulados anteriores + utilidad anterior − dividendos) y el
// plug es el efectivo. Así el Balance cuadra por construcción y el Estado
// de cambios concilia solo (todas las cuentas entran una vez).
const DIVIDENDOS = { y2024: 0, y2025: 800, y2026: 0 };
const BALANCE = {
  y2023: {
    plug: "resultados_acumulados",
    efectivo: 1800, clientes: 5950, otras_cxc: 420, cxc_relacionadas: 0, inventarios: 5200,
    pagos_anticipados: 380, impuestos_recuperar: 610, otros_circulantes: 250,
    activos_fijos: 11800, otros_activos: 540, activos_diferidos: 320,
    anticipos: 450, proveedores: 4220, cias_relacionadas: 0, gastos_acumulados: 680,
    impuestos_pagar: 920, bancario_cp: 1500, porcion_circulante_lp: 1200, acreedores: 860, otras_cxp: 390,
    bancario_lp: 4800, pasivos_diferidos: 210,
    capital_social: 6000, aportaciones_futuras: 0, reservas: 300, revaluacion: 0,
  },
  y2024: {
    plug: "efectivo",
    clientes: 7100, otras_cxc: 510, cxc_relacionadas: 0, inventarios: 6000,
    pagos_anticipados: 450, impuestos_recuperar: 720, otros_circulantes: 300,
    activos_fijos: 13400, otros_activos: 600, activos_diferidos: 260,
    anticipos: 520, proveedores: 5250, cias_relacionadas: 0, gastos_acumulados: 760,
    impuestos_pagar: 1150, bancario_cp: 2600, porcion_circulante_lp: 1200, acreedores: 940, otras_cxp: 430,
    bancario_lp: 3600, pasivos_diferidos: 230,
    capital_social: 6000, aportaciones_futuras: 0, reservas: 300, revaluacion: 0,
  },
  y2025: {
    plug: "efectivo",
    clientes: 7370, otras_cxc: 480, cxc_relacionadas: 0, inventarios: 6180,
    pagos_anticipados: 520, impuestos_recuperar: 650, otros_circulantes: 340,
    activos_fijos: 15610, otros_activos: 650, activos_diferidos: 200,
    anticipos: 900, proveedores: 5780, cias_relacionadas: 0, gastos_acumulados: 850,
    impuestos_pagar: 1480, bancario_cp: 900, porcion_circulante_lp: 1500, acreedores: 1020, otras_cxp: 470,
    bancario_lp: 6900, pasivos_diferidos: 250,
    capital_social: 6000, aportaciones_futuras: 0, reservas: 300, revaluacion: 0,
  },
  y2026: {
    plug: "efectivo",
    clientes: 10330, otras_cxc: 560, cxc_relacionadas: 0, inventarios: 10480,
    pagos_anticipados: 610, impuestos_recuperar: 720, otros_circulantes: 380,
    activos_fijos: 16890, otros_activos: 700, activos_diferidos: 170,
    anticipos: 1150, proveedores: 7060, cias_relacionadas: 0, gastos_acumulados: 910,
    impuestos_pagar: 1120, bancario_cp: 4800, porcion_circulante_lp: 1500, acreedores: 1180, otras_cxp: 510,
    bancario_lp: 6150, pasivos_diferidos: 260,
    capital_social: 6000, aportaciones_futuras: 0, reservas: 300, revaluacion: 0,
  },
};

// Estado de cambios: capturas complementarias (solo años con año anterior).
// Venta de activo fijo 0 salvo 2025 (una máquina vieja); efectos cambiarios
// y ajuste por revaluación en 0.
const CASHFLOW = {
  y2024: { venta_activo_fijo: 0, cambiaria_deuda_cp: 0, cambiaria_deuda_lp: 0, cambiaria_clientes: 0, ajuste_revaluacion: 0 },
  y2025: { venta_activo_fijo: 150, cambiaria_deuda_cp: 0, cambiaria_deuda_lp: 0, cambiaria_clientes: 0, ajuste_revaluacion: 0 },
  y2026: { venta_activo_fijo: 0, cambiaria_deuda_cp: 0, cambiaria_deuda_lp: 0, cambiaria_clientes: 0, ajuste_revaluacion: 0 },
};

// Segmentos: ventas y costo de los dos primeros; el tercero es el resto, así
// la suma coincide exactamente con el Estado de Resultados.
const SEGMENT_DATA = {
  y2023: { seg_auto: { ventas: 23500, costo: 16450 }, seg_electro: { ventas: 11200, costo: 7400 } },
  y2024: { seg_auto: { ventas: 27100, costo: 18900 }, seg_electro: { ventas: 12800, costo: 8400 } },
  y2025: { seg_auto: { ventas: 31400, costo: 21400 }, seg_electro: { ventas: 15000, costo: 9600 } },
  y2026: { seg_auto: { ventas: 17700, costo: 12300 }, seg_electro: { ventas: 8300, costo: 5400 } },
};

// Desglose del gasto: pesos relativos de los 20 conceptos (se normalizan);
// `menores` absorbe el redondeo para que el total sea exacto. Las partidas
// virtuales capturables (amortizaciones, otras_virtuales) van por año;
// depreciación y reservas vienen del memo del Estado de Resultados.
const EXPENSE_WEIGHTS = {
  sueldos: 0.30, prestaciones: 0.09, bonos: 0.03, honorarios: 0.045, tecnologia: 0.03,
  suministros: 0.008, viajes: 0.02, mantenimiento: 0.05, marketing: 0.035, capacitacion: 0.012,
  seguros: 0.03, representacion: 0.01, servicios_basicos: 0.06, renta: 0.08, comunicaciones: 0.012,
  outsourcing: 0.045, innovacion: 0.02, logistica: 0.07, legales: 0.01, menores: 0.033,
};
// Variaciones por año para que las proporciones no sean idénticas.
const EXPENSE_TWEAKS = {
  y2023: { tecnologia: 0.8, marketing: 0.9 },
  y2024: { capacitacion: 1.3, viajes: 1.2 },
  y2025: { marketing: 1.25, innovacion: 1.3, honorarios: 1.15 },
  y2026: { logistica: 1.2, honorarios: 1.3, legales: 1.5 },
};
const EXPENSE_VIRTUAL_DATA = {
  y2023: { amortizaciones: 60, otras_virtuales: 40 },
  y2024: { amortizaciones: 60, otras_virtuales: 45 },
  y2025: { amortizaciones: 60, otras_virtuales: 50 },
  y2026: { amortizaciones: 30, otras_virtuales: 25 },
};

// Estacionalidad: pesos mensuales típicos de un proveedor automotriz (bajo
// en enero y diciembre, alto en marzo y en octubre–noviembre), con una
// variación pequeña por año; el último mes capturado absorbe el redondeo.
const SEASON_WEIGHTS = [0.070, 0.078, 0.090, 0.082, 0.088, 0.085, 0.078, 0.088, 0.090, 0.095, 0.092, 0.064];

// ---------- Armado de las secciones ----------
const sections = {
  [INCOME_SECTION]: {},
  [BALANCE_SECTION]: {},
  [CASHFLOW_SECTION]: {},
  [SALES_SECTION]: {},
  [SEGCOST_SECTION]: {},
  [EXPENSES_SECTION]: {},
  [SEASONALITY_SECTION]: {},
};
const put = (section, key, yearId, value) => {
  sections[section][key] = sections[section][key] || {};
  sections[section][key][yearId] = value;
};
const get = (section, key, yearId) => sections[section]?.[key]?.[yearId] ?? 0;

const problems = [];
const fail = (msg) => problems.push(msg);
const INCOME_KEYS = [...INCOME_INPUT_KEYS, ...INCOME_MEMO.map((m) => m.key)];

// Estado de Resultados
YEARS.forEach((y) => {
  INCOME_KEYS.forEach((k) => {
    if (INCOME[y.id][k] == null) fail(`income.${k} sin valor en ${y.id}`);
    put(INCOME_SECTION, k, y.id, INCOME[y.id][k]);
  });
});
const income = computeIncome({ sections, years: YEARS });

// Balance con plug
const GROUP = {
  activo: ["efectivo", "clientes", "otras_cxc", "cxc_relacionadas", "inventarios", "pagos_anticipados",
    "impuestos_recuperar", "otros_circulantes", "activos_fijos", "otros_activos", "activos_diferidos"],
  pasivo: ["anticipos", "proveedores", "cias_relacionadas", "gastos_acumulados", "impuestos_pagar",
    "bancario_cp", "porcion_circulante_lp", "acreedores", "otras_cxp", "bancario_lp", "pasivos_diferidos"],
  capital: ["capital_social", "aportaciones_futuras", "reservas", "revaluacion", "resultados_acumulados"],
};
const plugs = {};
YEARS.forEach((y, i) => {
  const row = { ...BALANCE[y.id] };
  const plug = row.plug;
  delete row.plug;
  if (i > 0) {
    const prev = YEARS[i - 1];
    row.resultados_acumulados =
      get(BALANCE_SECTION, "resultados_acumulados", prev.id) +
      income[prev.id].utilidadNeta -
      (DIVIDENDOS[y.id] ?? 0);
  }
  const sumOf = (keys) => keys.reduce((s, k) => s + (k === plug ? 0 : (row[k] ?? 0)), 0);
  const utilidad = income[y.id].utilidadNeta;
  // activo = pasivo + capital (capturado) + utilidad neta
  const activo = sumOf(GROUP.activo);
  const pasivoCapital = sumOf(GROUP.pasivo) + sumOf(GROUP.capital) + utilidad;
  row[plug] = GROUP.activo.includes(plug) ? pasivoCapital - activo : activo - pasivoCapital;
  plugs[y.id] = { key: plug, value: row[plug] };
  ALL_BALANCE_KEYS.forEach((k) => {
    if (row[k] == null) fail(`balance.${k} sin valor en ${y.id}`);
    if (k !== "resultados_acumulados" && row[k] < 0) fail(`balance.${k} negativo en ${y.id}: ${row[k]}`);
    put(BALANCE_SECTION, k, y.id, row[k]);
  });
  if (plug === "efectivo" && row.efectivo <= 0) fail(`el efectivo (plug) de ${y.id} no es positivo: ${row.efectivo}`);
});

// Estado de cambios (capturas complementarias)
YEARS.slice(1).forEach((y) => {
  ALL_CASHFLOW_KEYS.forEach((k) => {
    if (CASHFLOW[y.id]?.[k] == null) fail(`cashflow.${k} sin valor en ${y.id}`);
    put(CASHFLOW_SECTION, k, y.id, CASHFLOW[y.id][k]);
  });
});

// Segmentos
YEARS.forEach((y) => {
  const inc = income[y.id];
  let ventasRest = inc.ventas;
  let costoRest = inc.costo;
  SEGMENTS.forEach((seg, i) => {
    const last = i === SEGMENTS.length - 1;
    const d = last ? { ventas: ventasRest, costo: costoRest } : SEGMENT_DATA[y.id][seg.id];
    if (!d) fail(`segmento ${seg.id} sin datos en ${y.id}`);
    const ventas = d?.ventas ?? 0;
    const costo = d?.costo ?? 0;
    if (ventas <= 0 || costo <= 0 || costo >= ventas) {
      fail(`segmento ${seg.name} en ${y.id} sin sentido: ventas ${ventas}, costo ${costo}`);
    }
    put(SALES_SECTION, seg.id, y.id, ventas);
    put(SEGCOST_SECTION, seg.id, y.id, costo);
    ventasRest -= ventas;
    costoRest -= costo;
  });
});

// Desglose del gasto
YEARS.forEach((y) => {
  const inc = income[y.id];
  const virt = EXPENSE_VIRTUAL_DATA[y.id];
  EXPENSE_VIRTUAL.forEach((v) => {
    if (virt?.[v.key] == null) fail(`expenses.${v.key} sin valor en ${y.id}`);
    put(EXPENSES_SECTION, v.key, y.id, virt[v.key]);
  });
  const base =
    inc.gastoOperativo - inc.depreciacion - inc.reservaCxc - inc.reservaInventarios -
    (virt?.amortizaciones ?? 0) - (virt?.otras_virtuales ?? 0);
  const tweaks = EXPENSE_TWEAKS[y.id] || {};
  const weights = EXPENSE_CONCEPTS.map((c) => (EXPENSE_WEIGHTS[c.key] ?? 0) * (tweaks[c.key] ?? 1));
  const totalW = weights.reduce((s, w) => s + w, 0);
  let acumulado = 0;
  EXPENSE_CONCEPTS.forEach((c, i) => {
    const last = i === EXPENSE_CONCEPTS.length - 1;
    const value = last ? base - acumulado : Math.round((base * weights[i]) / totalW);
    if (value < 0) fail(`expenses.${c.key} negativo en ${y.id}: ${value}`);
    put(EXPENSES_SECTION, c.key, y.id, value);
    acumulado += value;
  });
});

// Estacionalidad (solo los meses del periodo)
YEARS.forEach((y) => {
  const ventas = income[y.id].ventas;
  const months = SEASON_MONTHS.slice(0, y.months);
  const weights = months.map((m, i) => SEASON_WEIGHTS[i] * (1 + ((((i * 7 + y.year) % 5) - 2) * 0.012)));
  const totalW = weights.reduce((s, w) => s + w, 0);
  let acumulado = 0;
  months.forEach((m, i) => {
    const last = i === months.length - 1;
    const value = last ? ventas - acumulado : Math.round((ventas * weights[i]) / totalW);
    if (value <= 0) fail(`seasonality.${m.key} no positivo en ${y.id}: ${value}`);
    put(SEASONALITY_SECTION, m.key, y.id, value);
    acumulado += value;
  });
});

// ---------- Validación con el motor de la app ----------
const balance = computeBalance({ sections, years: YEARS });
const ebitda = computeEbitda({ sections, years: YEARS });
const cashflow = computeCashflow({ sections, years: YEARS });
const ratios = computeRatios({ sections, years: YEARS });
const segments = computeSegments({ sections, years: YEARS, lines: SEGMENTS });
const expenses = computeExpenseBreakdown({ sections, years: YEARS });
const seasonality = computeSeasonality({ sections, years: YEARS });

const isZero = (v) => Math.abs(v) < 1e-6;
YEARS.forEach((y, i) => {
  const b = balance[y.id];
  if (Math.abs(b.diferencia) > 0.5) fail(`Balance ${yearLabel(y)} no cuadra: diferencia ${b.diferencia}`);
  if (i > 0 && !isZero(cashflow[y.id].diferencia)) {
    fail(`Estado de cambios ${yearLabel(y)}: caja final ${cashflow[y.id].cajaFinal} ≠ Balance ${cashflow[y.id].cajaBalance}`);
  }
  const s = segments[y.id];
  if (!isZero(s.difVentas) || !isZero(s.difCosto)) {
    fail(`Segmentos ${yearLabel(y)}: diferencia ventas ${s.difVentas}, costo ${s.difCosto}`);
  }
  if (!isZero(expenses[y.id].diferencia)) fail(`Desglose del gasto ${yearLabel(y)}: diferencia ${expenses[y.id].diferencia}`);
  if (!isZero(seasonality[y.id].diferencia)) fail(`Estacionalidad ${yearLabel(y)}: diferencia ${seasonality[y.id].diferencia}`);
});
const last = YEARS[YEARS.length - 1];
const resumen = summarizeRatios(ratios[last.id]);
if (!(resumen.verde > 0 && resumen.ambar > 0 && resumen.rojo > 0)) {
  fail(`El semáforo de ${yearLabel(last)} no mezcla colores: ${JSON.stringify(resumen)}`);
}

if (problems.length) {
  console.error("ABORTADO: las cifras del seed no cuadran. No se escribió el SQL.");
  problems.forEach((p) => console.error(` - ${p}`));
  process.exit(1);
}

// ---------- Emisión del SQL ----------
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sqlNum = (n) => {
  if (!Number.isFinite(n)) throw new Error(`cifra inválida: ${n}`);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};
const yearSql = Object.fromEntries(YEARS.map((y) => [y.id, y.sql]));
const segSql = Object.fromEntries(SEGMENTS.map((s) => [s.id, `${s.sql}::text`]));

// Filas (año, sección, concepto, cifra) en el orden del catálogo.
const rows = [];
const emitSection = (section, keys, conceptSql = sqlStr) => {
  YEARS.forEach((y) => {
    keys.forEach((k) => {
      const v = sections[section]?.[k]?.[y.id];
      if (v == null) return;
      rows.push({ section, line: `(v_fin, ${yearSql[y.id]}, ${sqlStr(section)}, ${conceptSql(k)}, ${sqlNum(v)})` });
    });
  });
};
emitSection(INCOME_SECTION, INCOME_KEYS);
emitSection(BALANCE_SECTION, ALL_BALANCE_KEYS);
emitSection(CASHFLOW_SECTION, ALL_CASHFLOW_KEYS);
emitSection(SALES_SECTION, SEGMENTS.map((s) => s.id), (k) => segSql[k]);
emitSection(SEGCOST_SECTION, SEGMENTS.map((s) => s.id), (k) => segSql[k]);
emitSection(EXPENSES_SECTION, [...EXPENSE_CONCEPTS, ...EXPENSE_VIRTUAL].map((c) => c.key));
emitSection(SEASONALITY_SECTION, SEASON_MONTHS.map((m) => m.key));

const SECTION_TITLE = {
  [INCOME_SECTION]: "Estado de Resultados (capturas en positivo; memo: depreciacion, reserva_cxc, reserva_inventarios)",
  [BALANCE_SECTION]: "Balance General (27 cuentas; el resultado del periodo lo calcula la app)",
  [CASHFLOW_SECTION]: "Estado de cambios: capturas complementarias (solo años con año anterior)",
  [SALES_SECTION]: "Segmentos: ventas (suman exactamente income.ventas)",
  [SEGCOST_SECTION]: "Segmentos: costo (suma exactamente income.costo)",
  [EXPENSES_SECTION]: "Desglose del gasto (20 conceptos + amortizaciones y otras_virtuales; con el memo suma el gasto operativo)",
  [SEASONALITY_SECTION]: "Estacionalidad en ventas (suma income.ventas; en 2026 solo los 6 meses del periodo)",
};
const insertBlocks = Object.keys(SECTION_TITLE)
  .map((section) => {
    const lines = rows.filter((r) => r.section === section).map((r) => `    ${r.line}`);
    return [
      `  -- ${SECTION_TITLE[section]}`,
      "  INSERT INTO fin_values (analysis_id, year_id, section, concept_key, amount) VALUES",
      `${lines.join(",\n")};`,
    ].join("\n");
  })
  .join("\n\n");

const uuidLines = [
  ...YEARS.map((y) => `  ${y.sql} := md5(v_fin::text || ':year:${y.year}')::uuid;`),
  ...SEGMENTS.map((s) => `  ${s.sql} := md5(v_fin::text || ':segment:${s.id}')::uuid;`),
].join("\n");

const header = `-- ============================================================
-- Seed demo del Análisis Financiero (modelo MP-AFH1)
-- ============================================================
-- Empresa ficticia "${COMPANY.company_name}": ${YEARS.map(yearLabel).join(", ")}
-- (cifras en miles de MXN). Tiene historia: crece 12–17 % al año, margen
-- bruto 33–35 %, margen operativo 8–11 %, liquidez entre 1.2 y 1.6 y deuda
-- bancaria moderada; en el último periodo el capital de trabajo se estira
-- y el semáforo mezcla verde, ámbar y rojo.
--
-- GENERADO por scripts/seed-fin-demo.mjs (no editar a mano; para cambiar
-- cifras edita el script y corre \`node scripts/seed-fin-demo.mjs\`).
-- Validado con el motor de la app (src/config/finCalc.js): el Balance
-- cuadra los ${YEARS.length} años, el Estado de cambios concilia con la caja y los
-- segmentos, el desglose del gasto y la estacionalidad suman exactamente lo
-- del Estado de Resultados.
--
-- Qué hace:
--   1. Localiza al usuario por v_email (⚠️ cámbialo para sembrar otra cuenta).
--   2. Toma su análisis financiero (el más antiguo, igual que la app) o lo
--      crea con owner_id y created_by_id = el usuario.
--   3. Borra SOLO fin_values, fin_lines y fin_years de ESE análisis. No toca
--      riesgos, plan estratégico, otros análisis ni otros usuarios.
--   4. Siembra datos generales, ${YEARS.length} periodos, ${SEGMENTS.length} segmentos y ${rows.length} cifras.
-- Los UUID de años y segmentos son deterministas por análisis (md5 del id
-- del análisis + etiqueta): el seed es repetible y no choca entre cuentas.
-- Prerrequisitos: supabase-fin-analysis.sql y supabase-per-user-plans.sql
-- (columna owner_id). Ejecutar completo en Supabase → SQL Editor.
-- ============================================================
`;

const sql = `${header}BEGIN;

DO $$
DECLARE
  v_email TEXT := ${sqlStr("tenryu@mara-perez.online")};  -- ⚠️ cambia el correo para sembrar otra cuenta
  v_uid   UUID;
  v_fin   UUID;
${YEARS.map((y) => `  ${y.sql} UUID;`).join("\n")}
${SEGMENTS.map((s) => `  ${s.sql} UUID;`).join("\n")}
  v_n_years  INT;
  v_n_lines  INT;
  v_n_values INT;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %.', v_email;
  END IF;

  -- Análisis del usuario: el más antiguo (mismo criterio que FinAnalysis.getOrCreate).
  SELECT id INTO v_fin
    FROM fin_analyses
   WHERE owner_id = v_uid
   ORDER BY created_at ASC
   LIMIT 1;
  IF v_fin IS NULL THEN
    INSERT INTO fin_analyses (owner_id, created_by_id)
    VALUES (v_uid, v_uid)
    RETURNING id INTO v_fin;
    RAISE NOTICE 'Análisis financiero creado para %: %', v_email, v_fin;
  END IF;

${uuidLines}

  -- Limpieza: SOLO las cifras, segmentos y años de este análisis.
  DELETE FROM fin_values WHERE analysis_id = v_fin;
  DELETE FROM fin_lines  WHERE analysis_id = v_fin;
  DELETE FROM fin_years  WHERE analysis_id = v_fin;

  -- Datos generales
  UPDATE fin_analyses
     SET company_name         = ${sqlStr(COMPANY.company_name)},
         country              = ${sqlStr(COMPANY.country)},
         main_activity        = ${sqlStr(COMPANY.main_activity)},
         secondary_activities = ${sqlStr(COMPANY.secondary_activities)},
         currency             = ${sqlStr(COMPANY.currency)},
         updated_at           = now()
   WHERE id = v_fin;

  -- Periodos
  INSERT INTO fin_years (id, analysis_id, year, months) VALUES
${YEARS.map((y) => `    (${y.sql}, v_fin, ${y.year}, ${y.months})`).join(",\n")};

  -- Segmentos de negocio
  INSERT INTO fin_lines (id, analysis_id, name, position) VALUES
${SEGMENTS.map((s, i) => `    (${s.sql}, v_fin, ${sqlStr(s.name)}, ${i})`).join(",\n")};

${insertBlocks}

  SELECT count(*) INTO v_n_years  FROM fin_years  WHERE analysis_id = v_fin;
  SELECT count(*) INTO v_n_lines  FROM fin_lines  WHERE analysis_id = v_fin;
  SELECT count(*) INTO v_n_values FROM fin_values WHERE analysis_id = v_fin;
  IF v_n_values <> ${rows.length} THEN
    RAISE EXCEPTION 'Se esperaban ${rows.length} cifras y quedaron %; se revierte.', v_n_values;
  END IF;
  RAISE NOTICE 'Seed demo MP-AFH1 listo para % (análisis %): % periodos, % segmentos, % cifras.',
    v_email, v_fin, v_n_years, v_n_lines, v_n_values;
END $$;

COMMIT;
`;

writeFileSync(OUT_FILE, sql, "utf8");

// ---------- Resumen ----------
const miles = (v) => fmtMiles.format(v);
console.log(`Seed demo MP-AFH1 — ${COMPANY.company_name}`);
console.log("\nCifras clave por periodo (miles de MXN):");
YEARS.forEach((y, i) => {
  const inc = income[y.id];
  const b = balance[y.id];
  const r = ratios[y.id];
  const plug = plugs[y.id];
  console.log(
    `  ${yearLabel(y).padEnd(8)} ventas ${miles(inc.ventas).padStart(7)} · utilidad neta ${miles(inc.utilidadNeta).padStart(6)}` +
      ` · EBITDA ${miles(ebitda[y.id]).padStart(6)} · total activo ${miles(b.totalActivo).padStart(7)}` +
      ` · liquidez ${r.values.liquidez.toFixed(2)} · plug ${plug.key} = ${miles(plug.value)}` +
      ` · balance ${Math.abs(b.diferencia) <= 0.5 ? "✓" : "✗"}` +
      (i > 0 ? ` · flujo del periodo ${miles(cashflow[y.id].flujoPeriodo)} (diferencia ${cashflow[y.id].diferencia})` : ""),
  );
});

console.log(`\nRazones financieras de ${yearLabel(last)} (semáforo: ${resumen.verde} verdes, ${resumen.ambar} ámbar, ${resumen.rojo} rojos, ${resumen.na} sin dato):`);
const r = ratios[last.id];
RATIO_GROUPS.forEach((g) => {
  console.log(`  ${g.title}`);
  RATIO_DEFS.filter((d) => d.group === g.key).forEach((d) => {
    const value = r.values[d.key];
    const status = r.status[d.key];
    const estado = d.semaforo ? (status ? RATIO_STATUS_LABEL[status] : RATIO_STATUS_LABEL.na) : "informativo";
    const nota = value == null && r.na[d.key] ? ` (${r.na[d.key]})` : "";
    console.log(`    ${d.label.padEnd(46)} ${formatRatio(d, value).padStart(12)}  ${estado}${nota}`);
  });
});

console.log(`\nSQL escrito en ${OUT_FILE}`);
console.log(`  ${YEARS.length} periodos, ${SEGMENTS.length} segmentos, ${rows.length} filas en fin_values.`);
