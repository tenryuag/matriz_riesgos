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

// ---------- Razones financieras ----------
// Catálogo de los 18 indicadores de la hoja "Razones Financieras" del Excel,
// con su semáforo. Los umbrales son de referencia general para PyMEs
// mexicanas y viven aquí para poder ajustarlos en un solo lugar. Las bandas
// de porcentajes van en fracciones (0.05 = 5 %). Los textos están escritos
// para un empresario sin formación financiera.
export const RATIO_GROUPS = [
  { key: "liquidez", title: "Liquidez", question: "¿Puedes pagar lo que debes a corto plazo?" },
  { key: "eficiencia", title: "Eficiencia", question: "¿Qué tan rápido conviertes inventario y cobranza en efectivo?" },
  { key: "apalancamiento", title: "Apalancamiento", question: "¿Cuánto dependes de deuda?" },
  { key: "cobertura", title: "Cobertura", question: "¿Alcanza lo que generas para pagar los intereses?" },
  { key: "rentabilidad", title: "Rentabilidad", question: "¿Cuánto te queda de cada peso vendido y de lo invertido?" },
];

// `better`: 'higher' (verde si ≥ greenMin, ámbar si ≥ amberMin, si no rojo),
// 'lower' (verde si ≤ greenMax, ámbar si ≤ amberMax, si no rojo) o 'range'
// (verde dentro de green, ámbar dentro de amber, si no rojo). `statusFrom`
// hereda el semáforo de otro indicador (entonces no lleva bandas).
export const RATIO_DEFS = [
  // --- Liquidez ---
  {
    key: "liquidez",
    group: "liquidez",
    label: "Índice de liquidez",
    format: "ratio",
    better: "higher",
    bands: { greenMin: 1.5, amberMin: 1.0 },
    formula: "Activo circulante ÷ Pasivo circulante",
    what: "Cuántos pesos tienes disponibles a corto plazo por cada peso que debes pronto.",
    how: "Arriba de 1.5 es cómodo; entre 1 y 1.5 vigila la caja; debajo de 1 podrías no alcanzar a pagar a tiempo.",
  },
  {
    key: "acido",
    group: "liquidez",
    label: "Prueba del ácido",
    format: "ratio",
    better: "higher",
    bands: { greenMin: 1.0, amberMin: 0.7 },
    formula: "(Activo circulante − Inventarios) ÷ Pasivo circulante",
    what: "Lo mismo que la liquidez, pero sin contar los inventarios, que tardan en convertirse en dinero.",
    how: "Arriba de 1 estás tranquilo; entre 0.7 y 1 dependes de vender inventario para pagar; debajo de 0.7 la caja está apretada.",
  },
  {
    key: "capital_trabajo",
    group: "liquidez",
    label: "Capital de trabajo",
    format: "miles",
    better: "higher",
    statusFrom: "liquidez",
    formula: "Activo circulante − Pasivo circulante",
    what: "El dinero que te sobra (o te falta) después de cubrir lo que debes a corto plazo, en miles.",
    how: "Positivo significa que tienes colchón para operar; negativo, que las deudas de corto plazo superan lo que tienes a la mano. Su semáforo es el mismo que el de la liquidez.",
  },
  // --- Eficiencia ---
  {
    key: "dias_inventario",
    group: "eficiencia",
    label: "Días de inventario",
    format: "days",
    better: "lower",
    bands: { greenMax: 60, amberMax: 90 },
    formula: "360 ÷ (Costo de ventas ÷ Inventario promedio)",
    what: "Cuántos días tarda tu inventario en venderse, en promedio.",
    how: "Hasta 60 días es ágil; de 61 a 90 hay mercancía detenida; más de 90 el dinero está atorado en el almacén.",
  },
  {
    key: "dias_clientes",
    group: "eficiencia",
    label: "Días de clientes (cobranza)",
    format: "days",
    better: "lower",
    bands: { greenMax: 45, amberMax: 75 },
    formula: "Clientes ÷ (Ventas ÷ 360)",
    what: "Cuántos días tardas en cobrarle a tus clientes después de vender.",
    how: "Hasta 45 días es sano; de 46 a 75 revisa tu cobranza; más de 75 estás financiando a tus clientes.",
  },
  {
    key: "dias_proveedores",
    group: "eficiencia",
    label: "Días de proveedores (pago)",
    format: "days",
    better: "range",
    bands: { green: [30, 90], amber: [15, 120] },
    formula: "360 ÷ (Costo de ventas ÷ Proveedores promedio)",
    what: "Cuántos días tardas en pagarle a tus proveedores.",
    how: "Entre 30 y 90 días es un plazo equilibrado; de 15 a 29 o de 91 a 120 conviene revisarlo; menos de 15 pagas demasiado rápido y más de 120 podrías estar dañando la relación con tus proveedores.",
  },
  {
    key: "ciclo",
    group: "eficiencia",
    label: "Ciclo económico",
    format: "days",
    better: "lower",
    bands: { greenMax: 45, amberMax: 90 },
    formula: "Días de inventario + Días de clientes − Días de proveedores",
    what: "Cuántos días pasan desde que pagas la mercancía hasta que cobras la venta: el tiempo que tu dinero está atado a la operación (también llamado ciclo de conversión de efectivo).",
    how: "Hasta 45 días es sano; de 46 a 90 necesitas más caja para operar; más de 90 tu dinero tarda demasiado en regresar. Puede ser negativo si tus proveedores te financian.",
  },
  // --- Apalancamiento ---
  {
    key: "apalancamiento",
    group: "apalancamiento",
    label: "Índice de apalancamiento",
    format: "ratio",
    better: "lower",
    bands: { greenMax: 1.0, amberMax: 2.0 },
    formula: "Total pasivo ÷ Capital contable",
    what: "Cuántos pesos debes por cada peso que es realmente de los socios.",
    how: "Hasta 1 la empresa es sobre todo de los socios; entre 1 y 2 la deuda pesa tanto o más que el capital; arriba de 2 dependes mucho de terceros.",
  },
  {
    key: "apalancamiento_fin",
    group: "apalancamiento",
    label: "Apalancamiento financiero",
    format: "pct",
    better: "lower",
    bands: { greenMax: 0.05, amberMax: 0.1 },
    formula: "Gastos financieros ÷ Capital contable",
    what: "Qué parte de tu capital se va cada año en intereses y comisiones bancarias (el costo financiero sobre el capital).",
    how: "Hasta 5% es manejable; entre 5% y 10% los intereses empiezan a pesar; más de 10% la deuda se está comiendo el patrimonio.",
  },
  {
    key: "capitalizacion",
    group: "apalancamiento",
    label: "Índice de capitalización",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.5, amberMin: 0.33 },
    formula: "Capital contable ÷ Total activo",
    what: "Qué porcentaje de todo lo que tiene la empresa fue aportado o ganado por los socios, y no prestado.",
    how: "Arriba de 50% la empresa se sostiene sola; entre 33% y 50% hay equilibrio con la deuda; debajo de 33% la mayor parte de lo que tienes está financiado por terceros.",
  },
  {
    key: "deuda_neta",
    group: "apalancamiento",
    label: "Deuda neta",
    format: "miles",
    better: "lower",
    statusFrom: "deuda_ebitda",
    formula: "(Bancario a corto plazo + Porción circulante + Bancario a largo plazo) − Caja y bancos",
    what: "Lo que debes a los bancos después de restar el dinero que tienes en caja, en miles.",
    how: "Si es negativa, la caja alcanza para pagar toda la deuda bancaria. Su semáforo es el mismo que el de Deuda / EBITDA.",
  },
  {
    key: "deuda_ebitda",
    group: "apalancamiento",
    label: "Deuda / EBITDA",
    format: "ratio",
    better: "lower",
    bands: { greenMax: 2.0, amberMax: 3.5 },
    formula: "Deuda neta ÷ EBITDA",
    what: "Cuántos años de lo que genera la operación (EBITDA: utilidad antes de intereses, impuestos y depreciación) necesitarías para pagar toda la deuda bancaria neta.",
    how: "Hasta 2 es cómodo; entre 2 y 3.5 la deuda ya exige disciplina; más de 3.5 es difícil de pagar y los bancos lo ven con cautela. Si el EBITDA es negativo, la operación no alcanza para pagar la deuda.",
  },
  // --- Cobertura ---
  {
    key: "cobertura",
    group: "cobertura",
    label: "Cobertura de intereses",
    format: "ratio",
    better: "higher",
    bands: { greenMin: 3.0, amberMin: 1.5 },
    formula: "EBITDA ÷ Gastos financieros",
    what: "Cuántas veces lo que genera la operación alcanza para pagar los intereses de la deuda.",
    how: "Arriba de 3 veces estás tranquilo; entre 1.5 y 3 cualquier baja en ventas te complica el pago; debajo de 1.5 los intereses se llevan casi todo lo que generas.",
  },
  // --- Rentabilidad ---
  {
    key: "margen_bruto",
    group: "rentabilidad",
    label: "Margen bruto",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.3, amberMin: 0.15 },
    formula: "Utilidad bruta ÷ Ventas",
    what: "De cada peso que vendes, cuánto te queda después de pagar lo que cuesta producir o comprar lo que vendes.",
    how: "Arriba de 30% hay espacio para gastos y utilidad; entre 15% y 30% cuida tus costos; debajo de 15% casi no queda margen para operar.",
  },
  {
    key: "margen_operativo",
    group: "rentabilidad",
    label: "Margen operativo",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.1, amberMin: 0.05 },
    formula: "Resultado de operación ÷ Ventas",
    what: "De cada peso vendido, cuánto queda después de costos y gastos de operación, antes de intereses e impuestos.",
    how: "Arriba de 10% el negocio es eficiente; entre 5% y 10% los gastos pesan; debajo de 5% la operación apenas se sostiene.",
  },
  {
    key: "margen_neto",
    group: "rentabilidad",
    label: "Margen neto",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.05, amberMin: 0 },
    formula: "Utilidad neta ÷ Ventas",
    what: "De cada peso vendido, cuánto te queda al final, ya pagados intereses e impuestos.",
    how: "Arriba de 5% es una utilidad sana; entre 0% y 5% ganas poco por cada venta; negativo significa que pierdes dinero.",
  },
  {
    key: "roa",
    group: "rentabilidad",
    label: "ROA (rendimiento sobre activos)",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.05, amberMin: 0 },
    formula: "Utilidad neta ÷ Total activo",
    what: "Cuánto ganas por cada peso invertido en la empresa (ROA: rendimiento sobre los activos).",
    how: "Arriba de 5% tus activos trabajan bien; entre 0% y 5% rinden poco; negativo significa que la empresa pierde dinero.",
  },
  {
    key: "roe",
    group: "rentabilidad",
    label: "ROE (rendimiento sobre capital)",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.15, amberMin: 0 },
    formula: "Utilidad neta ÷ Capital contable",
    what: "Cuánto ganan los socios por cada peso que han puesto o dejado en la empresa (ROE: rendimiento sobre el capital).",
    how: "Arriba de 15% es atractivo para los socios; entre 0% y 15% rinde menos que otras opciones; negativo significa que pierden dinero.",
  },
];

export const RATIO_BY_KEY = Object.fromEntries(RATIO_DEFS.map((d) => [d.key, d]));

export const RATIO_STATUS_LABEL = { verde: "Sano", ambar: "Vigilar", rojo: "Atender", na: "No aplica" };

// Texto de un indicador según su formato: "2.31 x", "36.2%", "42 días",
// "29,442". Sin valor → "—".
export function formatRatio(def, value) {
  if (value == null || !isFinite(value)) return "—";
  switch (def?.format) {
    case "pct":
      return fmtPct(value);
    case "days":
      return `${Math.round(value)} días`;
    case "miles":
      return fmtMiles.format(value);
    default:
      return `${value.toFixed(2)} x`;
  }
}
