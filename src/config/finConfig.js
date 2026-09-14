// ============================================================
// Catálogos y helpers del Análisis Financiero.
// Conceptos tomados del Excel "Modelo Simplificado con Tableros
// Estratégicos" (sección histórica). Las cifras se capturan en miles.
// ============================================================

// Conceptos que componen el costo de ventas de cada línea de negocio.
export const COST_CONCEPTS = [
  { key: "materia_prima", label: "Materia prima / Insumos directos" },
  { key: "mano_obra", label: "Mano de obra directa" },
  { key: "indirectos", label: "Costos indirectos de producción / operación" },
  { key: "fletes", label: "Fletes, empaque y logística directa" },
  { key: "subcontratados", label: "Servicios subcontratados / maquila / regalías" },
];

// Catálogo de gastos de operación (agrupación sugerida por el modelo).
export const EXPENSE_CONCEPTS = [
  { key: "sueldos", label: "Sueldos y Salarios" },
  { key: "prestaciones", label: "Prestaciones" },
  { key: "bonos", label: "Bonos" },
  { key: "honorarios", label: "Honorarios profesionales" },
  { key: "tecnologia", label: "Tecnología y Software" },
  { key: "suministros", label: "Suministros de oficina" },
  { key: "viajes", label: "Gastos de viaje y viáticos" },
  { key: "mantenimiento", label: "Mantenimiento e infraestructura" },
  { key: "marketing", label: "Marketing y publicidad" },
  { key: "capacitacion", label: "Desarrollo y capacitación" },
  { key: "seguros", label: "Seguros" },
  { key: "representacion", label: "Gastos de representación" },
  { key: "servicios_basicos", label: "Servicios básicos" },
  { key: "renta", label: "Renta / alquiler" },
  { key: "comunicaciones", label: "Comunicaciones y telefonía" },
  { key: "outsourcing", label: "Servicios externos y outsourcing" },
  { key: "innovacion", label: "I+D e innovación" },
  { key: "logistica", label: "Logística y distribución" },
  { key: "legales", label: "Gastos legales" },
  { key: "menores", label: "Gastos generales \"menores\"" },
];

// Sección de ventas: el concepto es el id de la línea de negocio.
export const SALES_SECTION = "sales";
export const EXPENSES_SECTION = "expenses";
export const costSection = (lineId) => `cost:${lineId}`;

// Etiqueta corta de un ejercicio: "2024" o "jun 2026" para parciales.
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function yearLabel(y) {
  if (!y) return "";
  if (y.months >= 12) return String(y.year);
  return `${MONTH_SHORT[y.months - 1]} ${y.year}`;
}

// Factor para anualizar un periodo parcial (jun → ×2).
export const annualizeFactor = (y) => (y && y.months < 12 ? 12 / y.months : 1);

// Formato de cifras en miles (sin símbolo de moneda; la unidad es "miles").
export const fmtMiles = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
export const fmtPct = (v) =>
  v == null || !isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`;

// Convierte el texto de un input a número (o null si está vacío/ inválido).
export function toNumber(value) {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

// Suma segura de una colección de valores capturados (ignora vacíos).
export function sumValues(values) {
  return values.reduce((s, v) => s + (toNumber(v) ?? 0), 0);
}

// ---------- Estado de Resultados ----------
export const INCOME_SECTION = "income";

// Partidas que se capturan (el resto se calcula de Ventas, Costos y Gastos).
export const INCOME_INPUTS = [
  { key: "depreciacion", label: "Depreciación y amortización", group: "operacion" },
  {
    key: "otros_operacion",
    label: "Otros ingresos (gastos) de operación",
    hint: "Ingresos en positivo, gastos en negativo",
    group: "operacion",
  },
  { key: "productos_financieros", label: "Productos financieros", group: "financiamiento" },
  { key: "gastos_financieros", label: "Gastos financieros", group: "financiamiento" },
  {
    key: "utilidad_cambiaria",
    label: "Utilidad (pérdida) cambiaria",
    hint: "Pérdidas en negativo",
    group: "financiamiento",
  },
  {
    key: "otros_productos",
    label: "Otros productos (gastos)",
    hint: "Gastos en negativo",
    group: "financiamiento",
  },
  { key: "isr", label: "Impuesto sobre la renta (ISR)", group: "impuestos" },
  { key: "ptu", label: "PTU", group: "impuestos" },
];

// ---------- Balance General ----------
export const BALANCE_SECTION = "balance";

export const BALANCE_GROUPS = [
  {
    key: "activo_circulante",
    title: "Activo circulante",
    total: "Total activo circulante",
    items: [
      { key: "caja", label: "Caja y bancos" },
      { key: "inversiones", label: "Inversiones en valores" },
      { key: "clientes", label: "Clientes" },
      { key: "otras_cxc", label: "Otras cuentas por cobrar" },
      { key: "inventarios", label: "Inventarios" },
      { key: "pagos_anticipados", label: "Pagos anticipados" },
      { key: "impuestos_recuperar", label: "Impuestos por recuperar" },
      { key: "cxc_relacionadas", label: "Cuentas por cobrar a compañías relacionadas" },
      { key: "otros_circulantes", label: "Otros activos circulantes" },
    ],
  },
  {
    key: "activo_no_circulante",
    title: "Activo no circulante",
    total: "Total activo",
    items: [
      { key: "activos_fijos", label: "Activos fijos (neto)" },
      { key: "otros_activos", label: "Otros activos" },
      { key: "impuesto_diferido_activo", label: "Impuesto diferido (activo)" },
    ],
  },
  {
    key: "pasivo_circulante",
    title: "Pasivo circulante",
    total: "Total pasivo circulante",
    items: [
      { key: "bancario_cp", label: "Pasivo bancario a corto plazo" },
      { key: "porcion_circulante_lp", label: "Porción circulante del pasivo a largo plazo" },
      { key: "proveedores", label: "Proveedores" },
      { key: "acreedores", label: "Acreedores diversos" },
      { key: "impuestos_pagar", label: "Impuestos por pagar" },
      { key: "cias_relacionadas", label: "Compañías relacionadas" },
      { key: "anticipos", label: "Anticipos de clientes" },
      { key: "gastos_acumulados", label: "Gastos acumulados" },
      { key: "otras_cxp", label: "Otras cuentas por pagar" },
    ],
  },
  {
    key: "pasivo_largo_plazo",
    title: "Pasivo a largo plazo",
    total: "Total pasivo",
    items: [
      { key: "bancario_lp", label: "Pasivo bancario a largo plazo" },
      { key: "provisiones", label: "Provisiones" },
      { key: "impuesto_diferido_pasivo", label: "Impuesto a la utilidad diferido" },
    ],
  },
  {
    key: "capital",
    title: "Capital contable",
    total: "Total capital contable",
    items: [
      { key: "capital_social", label: "Capital social" },
      { key: "aportaciones_futuras", label: "Aportaciones para futuros aumentos de capital" },
      { key: "reservas", label: "Reservas" },
      { key: "resultados_acumulados", label: "Resultados acumulados" },
      { key: "resultado_periodo", label: "Resultado neto del periodo" },
    ],
  },
];

export const ALL_BALANCE_KEYS = BALANCE_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// ---------- Estado de cambios: anexo de movimientos reales ----------
export const CASHFLOW_ANNEX_SECTION = "cashflow-annex";

// Se capturan en positivo; `sign` indica si es entrada (+1) o salida (−1)
// de efectivo. Así el usuario no tiene que pensar en signos.
export const ANNEX_GROUPS = [
  {
    key: "inversion",
    title: "Inversión — movimientos reales de efectivo",
    items: [
      { key: "capex_adquisicion", label: "Adquisición de activo fijo (CAPEX pagado)", sign: -1 },
      { key: "capex_venta", label: "Venta de activo fijo (efectivo cobrado)", sign: 1 },
      { key: "otros_activos_compra", label: "Compra de otros activos / inversiones en valores", sign: -1 },
      { key: "otros_activos_venta", label: "Venta / recuperación de otros activos / inversiones", sign: 1 },
    ],
  },
  {
    key: "financiamiento",
    title: "Financiamiento — movimientos reales de efectivo",
    items: [
      { key: "deuda_cp_disposicion", label: "Disposición de deuda bancaria a corto plazo", sign: 1 },
      { key: "deuda_cp_pago", label: "Pago de deuda bancaria a corto plazo", sign: -1 },
      { key: "deuda_lp_disposicion", label: "Disposición de deuda bancaria a largo plazo", sign: 1 },
      { key: "deuda_lp_pago", label: "Pago de deuda bancaria a largo plazo", sign: -1 },
      { key: "aportaciones_capital", label: "Aportaciones de capital en efectivo", sign: 1 },
      { key: "dividendos", label: "Dividendos pagados en efectivo", sign: -1 },
    ],
  },
];
export const ALL_ANNEX_KEYS = ANNEX_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// ---------- Flujo de efectivo directo ----------
export const CASHFLOW_DIRECT_SECTION = "cashflow-direct";

export const DIRECT_GROUPS = [
  {
    key: "entradas",
    title: "Entradas de efectivo — operación",
    total: "Total entradas de operación",
    items: [
      { key: "ent_ventas", label: "Cobros de ventas / ingresos operativos" },
      { key: "ent_cxc", label: "Cobros de cuentas por cobrar / anticipos de clientes" },
      { key: "ent_otros", label: "Otros ingresos cobrados" },
    ],
  },
  {
    key: "salidas",
    title: "Salidas de efectivo — operación",
    total: "Total salidas de operación",
    items: [
      { key: "sal_proveedores", label: "Pagos a proveedores (mercancías / materiales)" },
      { key: "sal_sueldos_operativos", label: "Sueldos y salarios operativos (producción / servicio)" },
      { key: "sal_sueldos_admin", label: "Sueldos y salarios administrativos" },
      { key: "sal_sueldos_ventas", label: "Sueldos y salarios de ventas y comercialización" },
      { key: "sal_impuestos", label: "Pagos de impuestos" },
      { key: "sal_otros", label: "Otros pagos (renta, publicidad, fletes, comisiones, etc.)" },
    ],
  },
  {
    key: "inversion",
    title: "Actividades de inversión",
    total: "Flujo de inversión",
    signed: true,
    hint: "Pagos en negativo, cobros en positivo",
    items: [
      { key: "inv_oficina", label: "Equipo de oficina" },
      { key: "inv_computo", label: "Equipo de cómputo" },
      { key: "inv_transporte", label: "Equipo de transporte" },
      { key: "inv_otros", label: "Otros" },
    ],
  },
  {
    key: "financiamiento",
    title: "Actividades de financiamiento",
    total: "Flujo de financiamiento",
    signed: true,
    hint: "Obtenido / cobrado en positivo, pagado en negativo",
    items: [
      { key: "fin_creditos", label: "Créditos de instituciones financieras" },
      { key: "fin_prestamos_terceros", label: "Préstamos de terceros" },
      { key: "fin_intereses_creditos", label: "Intereses de créditos bancarios" },
      { key: "fin_intereses_otros", label: "Intereses de otros conceptos" },
      { key: "fin_aportaciones", label: "Aportaciones de socios" },
      { key: "fin_dividendos", label: "Dividendos (pagados)" },
      { key: "fin_cambiario", label: "Resultado cambiario" },
      { key: "fin_otros", label: "Otros" },
    ],
  },
];
export const DIRECT_INITIAL_KEY = "saldo_inicial";
export const ALL_DIRECT_KEYS = [DIRECT_INITIAL_KEY, ...DIRECT_GROUPS.flatMap((g) => g.items.map((i) => i.key))];
