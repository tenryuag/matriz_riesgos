// ============================================================
// Catálogos y helpers del Análisis Financiero (modelo MP-AFH1).
// Conceptos y etiquetas tomados del Excel "Modelo MP-AFH1" del cliente.
// Las cifras se capturan en miles. En el Estado de Resultados y en el Estado
// de cambios van SIEMPRE en positivo (la etiqueta entre paréntesis avisa que
// la app resta) salvo las partidas marcadas `signed`, que llevan signo
// (utilidad en positivo, pérdida o gasto en negativo). Las cuentas del
// Balance llevan su signo contable: casi todas son positivas, pero
// `reservas` y `resultados_acumulados` (marcadas `signed`) van en negativo
// con déficit o pérdidas acumuladas.
// Lo usan las pantallas del módulo y el servidor MCP (copia en
// supabase/functions/_shared/app vía `npm run mcp:sync`), por lo que NO
// puede importar React ni APIs del navegador.
// ============================================================

// ---------- Helpers genéricos ----------

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

// ---------- Secciones de fin_values ----------
export const INCOME_SECTION = "income";
export const BALANCE_SECTION = "balance";
export const CASHFLOW_SECTION = "cashflow";
export const SALES_SECTION = "sales"; // concepto = id del segmento (fin_lines)
export const SEGCOST_SECTION = "segcost"; // concepto = id del segmento (fin_lines)
export const EXPENSES_SECTION = "expenses";
export const SEASONALITY_SECTION = "seasonality";

// ---------- Estado de Resultados ----------
// Filas en el orden del estado financiero. `type`: 'input' se captura,
// 'auto' se calcula (subtotal intermedio), 'total' se calcula y se resalta.
// `key` es la clave de captura (concept_key) en las filas 'input' y la clave
// del resultado de computeIncome en las calculadas; `calc` es siempre la
// clave en computeIncome (y en su `pct`). `signed`: lleva signo.
// `indent`: fila de detalle del gasto operativo.
export const INCOME_ROWS = [
  { type: "input", key: "ventas", calc: "ventas", label: "Ventas o ingresos netos" },
  { type: "input", key: "costo", calc: "costo", label: "(Costo de ventas)" },
  { type: "total", key: "utilidadBruta", calc: "utilidadBruta", label: "Utilidad bruta" },
  { type: "input", key: "gasto_venta", calc: "gastoVenta", label: "(Gasto de venta)", indent: true },
  { type: "input", key: "gasto_admin", calc: "gastoAdmin", label: "(Gasto de administración)", indent: true },
  { type: "input", key: "gasto_general", calc: "gastoGeneral", label: "(Gastos operativos en general)", indent: true },
  { type: "auto", key: "gastoOperativo", calc: "gastoOperativo", label: "(Gasto operativo)" },
  { type: "total", key: "resultadoOp", calc: "resultadoOp", label: "Resultado de operación" },
  { type: "input", key: "productos_financieros", calc: "prodFin", label: "Productos financieros" },
  { type: "input", key: "gastos_financieros", calc: "gastosFin", label: "(Gastos financieros)" },
  {
    type: "input",
    key: "utilidad_cambiaria",
    calc: "cambiaria",
    label: "Utilidad (pérdida) cambiaria",
    hint: "Pérdidas en negativo",
    signed: true,
  },
  { type: "auto", key: "rif", calc: "rif", label: "Resultado integral de financiamiento" },
  {
    type: "input",
    key: "otros_productos",
    calc: "otrosProd",
    label: "Otros productos (gastos)",
    hint: "Gastos en negativo",
    signed: true,
  },
  { type: "total", key: "rai", calc: "rai", label: "Resultado antes de impuestos" },
  { type: "input", key: "isr", calc: "isr", label: "(Impuesto sobre la renta)" },
  { type: "input", key: "ptu", calc: "ptu", label: "(PTU)" },
  { type: "total", key: "utilidadNeta", calc: "utilidadNeta", label: "Utilidad neta" },
];

// Las 11 claves que se capturan en la sección `income`.
export const INCOME_INPUT_KEYS = INCOME_ROWS.filter((r) => r.type === "input").map((r) => r.key);

// Partidas que no son efectivo incluidas en el gasto operativo. Se capturan
// una sola vez, al pie del Estado de Resultados, y NO alteran sus totales:
// las leen el Estado de cambios, el EBITDA y el Desglose del gasto.
export const INCOME_MEMO_TITLE = "Partidas que no son efectivo incluidas en el gasto operativo";
export const INCOME_MEMO_HINT =
  "No cambian los totales del Estado de Resultados: el Estado de cambios y el EBITDA las usan.";
export const INCOME_MEMO = [
  { key: "depreciacion", calc: "depreciacion", label: "Depreciación y amortización" },
  { key: "reserva_cxc", calc: "reservaCxc", label: "Reserva de cuentas por cobrar" },
  { key: "reserva_inventarios", calc: "reservaInventarios", label: "Reserva de inventarios" },
];

// ---------- Balance General ----------
// Grupos con su total después de cada uno. `total` es la etiqueta del
// subtotal y `totalKey` su clave en computeBalance. El capital lleva además
// la fila automática `resultadoPeriodo` (utilidad neta del Estado de
// Resultados, no se captura) y el gran total "Total pasivo + capital".
// En cada cuenta, `signed` marca las que pueden ir en negativo (la pantalla
// pinta el chip "± con signo") y `hint` es la pista bajo la etiqueta.
export const BALANCE_RESULT_ROW = { key: "resultadoPeriodo", label: "Resultado neto del periodo" };

export const BALANCE_GROUPS = [
  {
    key: "activo_circulante",
    title: "Activo circulante",
    total: "Total activo circulante",
    totalKey: "activoCirculante",
    items: [
      { key: "efectivo", label: "Efectivo y equivalentes" },
      { key: "clientes", label: "Clientes" },
      { key: "otras_cxc", label: "Otras cuentas por cobrar" },
      { key: "cxc_relacionadas", label: "Cuentas por cobrar a compañías relacionadas" },
      { key: "inventarios", label: "Inventarios" },
      { key: "pagos_anticipados", label: "Pagos anticipados" },
      { key: "impuestos_recuperar", label: "Impuestos por recuperar" },
      { key: "otros_circulantes", label: "Otros activos circulantes" },
    ],
  },
  {
    key: "activo_no_circulante",
    title: "Activo no circulante",
    total: "Total activo",
    totalKey: "totalActivo",
    items: [
      { key: "activos_fijos", label: "Activos fijos" },
      { key: "otros_activos", label: "Otros activos" },
      { key: "activos_diferidos", label: "Activos diferidos" },
    ],
  },
  {
    key: "pasivo_circulante",
    title: "Pasivo circulante",
    total: "Total pasivo circulante",
    totalKey: "pasivoCirculante",
    items: [
      { key: "anticipos", label: "Anticipos de clientes" },
      { key: "proveedores", label: "Proveedores" },
      { key: "cias_relacionadas", label: "Compañías relacionadas" },
      { key: "gastos_acumulados", label: "Gastos acumulados" },
      { key: "impuestos_pagar", label: "Impuestos por pagar" },
      { key: "bancario_cp", label: "Pasivo bancario a corto plazo" },
      { key: "porcion_circulante_lp", label: "Porción circulante del pasivo a largo plazo" },
      { key: "acreedores", label: "Acreedores diversos" },
      { key: "otras_cxp", label: "Otras cuentas por pagar" },
    ],
  },
  {
    key: "pasivo_largo_plazo",
    title: "Pasivo a largo plazo",
    total: "Total pasivo",
    totalKey: "totalPasivo",
    items: [
      { key: "bancario_lp", label: "Pasivo bancario a largo plazo" },
      { key: "pasivos_diferidos", label: "Pasivos diferidos" },
    ],
  },
  {
    key: "capital",
    title: "Capital contable",
    total: "Total capital contable",
    totalKey: "totalCapital",
    items: [
      { key: "capital_social", label: "Capital social" },
      { key: "aportaciones_futuras", label: "Aportaciones para futuros aumentos de capital" },
      { key: "reservas", label: "Reservas", signed: true, hint: "En negativo si el saldo es un déficit" },
      { key: "revaluacion", label: "Revaluación de activos" },
      {
        key: "resultados_acumulados",
        label: "Resultados acumulados",
        signed: true,
        hint: "Acumulados del periodo anterior más su resultado neto; en negativo si son pérdidas acumuladas",
      },
    ],
    auto: [BALANCE_RESULT_ROW],
    grandTotal: { key: "totalPasivoCapital", label: "Total pasivo + capital" },
  },
];

// Las 27 cuentas que se capturan en la sección `balance`.
export const ALL_BALANCE_KEYS = BALANCE_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// ---------- Estado de cambios: capturas complementarias ----------
// Solo para años con año anterior. `signed`: utilidad en positivo, pérdida
// en negativo (mismo criterio que el Estado de Resultados); las demás en
// positivo. `group` dice en qué bloque del estado se usa cada una.
export const CASHFLOW_INPUTS = [
  {
    key: "venta_activo_fijo",
    label: "Venta de activo fijo",
    hint: "Efectivo cobrado por la venta, en positivo",
    signed: false,
    group: "inversion",
  },
  {
    key: "cambiaria_deuda_cp",
    label: "Utilidad (pérdida) cambiaria en deuda bancaria a corto plazo",
    hint: "Utilidad en positivo, pérdida en negativo",
    signed: true,
    group: "cif",
  },
  {
    key: "cambiaria_deuda_lp",
    label: "Utilidad (pérdida) cambiaria en deuda bancaria a largo plazo",
    hint: "Utilidad en positivo, pérdida en negativo",
    signed: true,
    group: "cif",
  },
  {
    key: "cambiaria_clientes",
    label: "Utilidad (pérdida) cambiaria en clientes",
    hint: "Utilidad en positivo, pérdida en negativo",
    signed: true,
    group: "cif",
  },
  {
    key: "ajuste_revaluacion",
    label: "Ajuste por revaluación capitalizada",
    hint: "Revaluación llevada al capital, en positivo",
    signed: false,
    group: "capital",
  },
];
export const ALL_CASHFLOW_KEYS = CASHFLOW_INPUTS.map((i) => i.key);

// ---------- Desglose del gasto operativo ----------
// Los 20 conceptos de la hoja "Gasto" del Excel.
export const EXPENSE_CONCEPTS = [
  { key: "sueldos", label: "Sueldos y salarios" },
  { key: "prestaciones", label: "Prestaciones" },
  { key: "bonos", label: "Bonos" },
  { key: "honorarios", label: "Honorarios profesionales" },
  { key: "tecnologia", label: "Tecnología y software" },
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

// Partidas virtuales que se capturan en el Desglose (las otras tres —
// depreciación y reservas— vienen del memo del Estado de Resultados).
export const EXPENSE_VIRTUAL = [
  { key: "amortizaciones", label: "Amortizaciones" },
  { key: "otras_virtuales", label: "Otras partidas virtuales en el gasto" },
];
export const ALL_EXPENSE_KEYS = [...EXPENSE_CONCEPTS, ...EXPENSE_VIRTUAL].map((c) => c.key);

// ---------- Estacionalidad en ventas ----------
const MONTH_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
// m01 … m12 con etiqueta larga, corta y número de mes (1–12).
export const SEASON_MONTHS = MONTH_LABEL.map((label, i) => ({
  key: `m${String(i + 1).padStart(2, "0")}`,
  label,
  short: MONTH_SHORT[i],
  month: i + 1,
}));

// ---------- Razones financieras ----------
// Catálogo de los 41 indicadores de la hoja "Razones Financieras" del Excel
// MP-AFH1. Saldos al cierre (sin promedios) y días sobre `meses × 30`.
// Los umbrales son de referencia general para PyMEs mexicanas, propuestos
// para que el dueño del producto los confirme, y viven aquí para ajustarlos
// en un solo lugar. Las bandas de porcentajes van en fracciones (0.05 = 5 %).
// `semaforo: false` = informativo: se muestra la cifra, nunca lleva estatus
// ni cuenta en el resumen. Los textos están escritos para un empresario sin
// formación financiera.
export const RATIO_GROUPS = [
  { key: "eficiencia", title: "Eficiencia", question: "¿Qué tan rápido crece y cobra tu empresa?" },
  { key: "flujo", title: "Flujo de efectivo", question: "¿Cuánto efectivo genera y a dónde se va?" },
  { key: "liquidez", title: "Liquidez", question: "¿Puedes pagar lo que debes a corto plazo?" },
  { key: "cobertura", title: "Cobertura", question: "¿Alcanza lo que generas para pagar el costo financiero?" },
  { key: "solvencia", title: "Solvencia", question: "¿Cuánto dependes de deuda?" },
  { key: "rentabilidad", title: "Rentabilidad", question: "¿Cuánto te queda de cada peso vendido y de lo invertido?" },
];

// `better`: 'higher' (verde si ≥ greenMin, ámbar si ≥ amberMin, si no rojo),
// 'lower' (verde si ≤ greenMax, ámbar si ≤ amberMax, si no rojo), 'range'
// (verde dentro de green, ámbar dentro de amber, si no rojo) o null cuando
// "más" no es mejor ni peor. `statusFrom` hereda el semáforo de otro
// indicador (entonces no lleva bandas). Los informativos no llevan bandas.
const CICLO_BANDS = { greenMax: 45, amberMax: 90 };
const COBERTURA_BANDS = { greenMin: 3.0, amberMin: 1.5 };
const SIN_SEMAFORO = "No lleva semáforo: es una cifra para leer junto con las demás.";

export const RATIO_DEFS = [
  // --- Eficiencia ---
  {
    key: "crecimiento_ventas",
    group: "eficiencia",
    label: "Crecimiento en ventas",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.1, amberMin: 0 },
    semaforo: true,
    formula: "(Ventas del periodo llevadas a 12 meses ÷ Ventas del año anterior) − 1",
    what: "Cuánto crecieron tus ventas frente al año anterior. Si el periodo es parcial, primero se llevan a 12 meses para que la comparación sea justa.",
    how: "Arriba de 10% el negocio crece con fuerza; entre 0% y 10% crece poco; negativo significa que vendes menos que el año pasado.",
  },
  {
    key: "dias_clientes",
    group: "eficiencia",
    label: "Días clientes",
    format: "days",
    better: "lower",
    bands: { greenMax: 45, amberMax: 75 },
    semaforo: true,
    formula: "Clientes ÷ (Ventas ÷ días del periodo)",
    what: "Cuántos días tardas en cobrarle a tus clientes después de vender, con el saldo al cierre.",
    how: "Hasta 45 días es sano; de 46 a 75 revisa tu cobranza; más de 75 estás financiando a tus clientes.",
  },
  {
    key: "dias_inventario",
    group: "eficiencia",
    label: "Días inventario",
    format: "days",
    better: "lower",
    bands: { greenMax: 60, amberMax: 90 },
    semaforo: true,
    formula: "Inventarios ÷ (Costo de ventas ÷ días del periodo)",
    what: "Cuántos días de venta tienes guardados en el almacén, con el saldo al cierre.",
    how: "Hasta 60 días es ágil; de 61 a 90 hay mercancía detenida; más de 90 el dinero está atorado en el almacén. Sin inventarios, 0 días.",
  },
  {
    key: "dias_anticipos",
    group: "eficiencia",
    label: "Días anticipos de clientes",
    format: "days",
    better: null,
    semaforo: false,
    formula: "Anticipos de clientes ÷ (Costo de ventas ÷ días del periodo)",
    what: "Cuántos días de costo te adelantan tus clientes al pagarte antes de recibir el producto o servicio.",
    how: `Más días significa que tus clientes financian parte de tu operación; se restan del ciclo económico. ${SIN_SEMAFORO}`,
  },
  {
    key: "dias_proveedores",
    group: "eficiencia",
    label: "Días proveedores",
    format: "days",
    better: "range",
    bands: { green: [30, 90], amber: [15, 120] },
    semaforo: true,
    formula: "Proveedores ÷ (Costo de ventas ÷ días del periodo)",
    what: "Cuántos días tardas en pagarle a tus proveedores, con el saldo al cierre.",
    how: "Entre 30 y 90 días es un plazo equilibrado; de 15 a 29 o de 91 a 120 conviene revisarlo; menos de 15 pagas demasiado rápido y más de 120 podrías estar dañando la relación con tus proveedores.",
  },
  {
    key: "ciclo_economico",
    group: "eficiencia",
    label: "Ciclo económico",
    format: "days",
    better: "lower",
    bands: CICLO_BANDS,
    semaforo: true,
    formula: "Días clientes + Días inventario − Días anticipos − Días proveedores",
    what: "Cuántos días pasan desde que pagas la mercancía hasta que cobras la venta: el tiempo que tu dinero está atado a la operación. Los días que no se pueden calcular cuentan como 0.",
    how: "Hasta 45 días es sano; de 46 a 90 necesitas más caja para operar; más de 90 tu dinero tarda demasiado en regresar. Puede ser negativo si tus proveedores y los anticipos te financian.",
  },
  {
    key: "dias_otras_cxc",
    group: "eficiencia",
    label: "Días otras cuentas por cobrar",
    format: "days",
    better: "lower",
    semaforo: false,
    formula: "Otras cuentas por cobrar ÷ (Ventas ÷ días del periodo)",
    what: "Cuántos días de venta tienes prestados en cuentas por cobrar que no son de clientes (deudores, préstamos, saldos a favor).",
    how: `Mientras más días, más dinero fuera de la operación sin ser cobranza de ventas; conviene saber de dónde salen. ${SIN_SEMAFORO}`,
  },
  {
    key: "ciclo_con_ocxc",
    group: "eficiencia",
    label: "Ciclo económico + otras cuentas por cobrar",
    format: "days",
    better: "lower",
    bands: CICLO_BANDS,
    semaforo: true,
    formula: "Ciclo económico + Días otras cuentas por cobrar",
    what: "El ciclo económico contando también el dinero que tienes en otras cuentas por cobrar.",
    how: "Se lee igual que el ciclo económico: hasta 45 días es sano, de 46 a 90 necesitas más caja y más de 90 tu dinero tarda demasiado en regresar.",
  },
  {
    key: "dias_cxc_inter",
    group: "eficiencia",
    label: "Días cuentas por cobrar intercompañías",
    format: "days",
    better: "lower",
    semaforo: false,
    formula: "Cuentas por cobrar a compañías relacionadas ÷ (Ventas ÷ días del periodo)",
    what: "Cuántos días de venta te deben otras empresas del mismo grupo.",
    how: `Si crece, el grupo se está financiando con tu operación. Solo aplica si tienes compañías relacionadas. ${SIN_SEMAFORO}`,
  },
  {
    key: "dias_cxp_inter",
    group: "eficiencia",
    label: "Días cuentas por pagar intercompañías",
    format: "days",
    better: null,
    semaforo: false,
    formula: "Compañías relacionadas (pasivo) ÷ (Costo de ventas ÷ días del periodo)",
    what: "Cuántos días de costo les debes a otras empresas del mismo grupo.",
    how: `Si crece, el grupo te está financiando. Solo aplica si tienes compañías relacionadas. ${SIN_SEMAFORO}`,
  },
  {
    key: "ciclo_con_inter",
    group: "eficiencia",
    label: "Ciclo económico con intercompañías",
    format: "days",
    better: "lower",
    bands: CICLO_BANDS,
    semaforo: true,
    formula: "Ciclo económico + otras cuentas por cobrar + Días cuentas por cobrar intercompañías − Días cuentas por pagar intercompañías",
    what: "El ciclo completo, contando también lo que te deben y lo que debes a empresas del grupo.",
    how: "Se lee igual que el ciclo económico: hasta 45 días es sano, de 46 a 90 necesitas más caja y más de 90 tu dinero tarda demasiado en regresar.",
  },
  // --- Flujo de efectivo (cifras en miles, informativas) ---
  {
    key: "ebit",
    group: "flujo",
    label: "UAFIR / EBIT",
    format: "miles",
    better: "higher",
    semaforo: false,
    formula: "Resultado de operación",
    what: "Lo que gana la operación antes de intereses e impuestos (en inglés EBIT), en miles.",
    how: `Positivo significa que el negocio en sí deja utilidad; negativo, que la operación pierde antes de pagar intereses e impuestos. ${SIN_SEMAFORO}`,
  },
  {
    key: "ebitda",
    group: "flujo",
    label: "UAFIRDA / EBITDA",
    format: "miles",
    better: "higher",
    semaforo: false,
    formula: "Resultado de operación + Depreciación y amortización + Reservas de cartera e inventarios",
    what: "Lo que genera la operación en efectivo antes de intereses, impuestos y partidas que no son dinero (EBITDA), en miles.",
    how: `Es la medida más usada de lo que la operación produce para pagar deuda e invertir; con él se calculan las coberturas y Pasivo / EBITDA. ${SIN_SEMAFORO}`,
  },
  {
    key: "inversion_capital_trabajo",
    group: "flujo",
    label: "Inversión neta en capital de trabajo",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Cambios en clientes, inventarios, proveedores, pagos anticipados, compañías relacionadas, anticipos y gastos acumulados",
    what: "Cuánto efectivo liberó (positivo) o se quedó atrapado (negativo) en la operación diaria durante el periodo, en miles.",
    how: `Negativo es normal cuando creces (más clientes e inventario); positivo cuando cobras más rápido o te financian tus proveedores. ${SIN_SEMAFORO}`,
  },
  {
    key: "flujo_operacion",
    group: "flujo",
    label: "Flujo de operación",
    format: "miles",
    better: "higher",
    semaforo: false,
    formula: "EBITDA + Inversión neta en capital de trabajo",
    what: "El efectivo que dejó la operación después de financiar clientes e inventarios, antes de impuestos e intereses, en miles.",
    how: `Positivo significa que la operación genera caja; negativo, que la consume y alguien tiene que ponerla (bancos o socios). ${SIN_SEMAFORO}`,
  },
  {
    key: "efectivo_operacion",
    group: "flujo",
    label: "Efectivo generado por la operación",
    format: "miles",
    better: "higher",
    semaforo: false,
    formula: "Flujo de operación + Impuestos causados + Costo integral de financiamiento pagado",
    what: "El efectivo que quedó de operar ya pagados impuestos e intereses, en miles.",
    how: `Es lo que realmente tienes para invertir o pagar deuda; si es negativo, el negocio aún no se sostiene solo. ${SIN_SEMAFORO}`,
  },
  {
    key: "efectivo_inversion",
    group: "flujo",
    label: "Efectivo generado por inversión",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Adquisición de activo fijo (CAPEX) + Compra de otros activos",
    what: "Cuánto efectivo se fue a comprar activos fijos y otros activos (negativo) o entró por venderlos (positivo), en miles.",
    how: `Negativo suele ser buena señal si estás creciendo; compáralo con el efectivo de operación para ver si lo pagas con lo que generas. ${SIN_SEMAFORO}`,
  },
  {
    key: "efectivo_fin_externo",
    group: "flujo",
    label: "Efectivo generado por financiamiento externo",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Cambios en deuda bancaria, otras cuentas por cobrar y pagar, acreedores, otros ingresos y partidas diferidas",
    what: "Cuánto efectivo entró de bancos y terceros (positivo) o se usó para pagarles (negativo), en miles.",
    how: `Positivo significa que te endeudaste o te financiaron; negativo, que pagaste deuda. Léelo junto con el efectivo de operación. ${SIN_SEMAFORO}`,
  },
  {
    key: "accionistas",
    group: "flujo",
    label: "Aportaciones (retiros) de los accionistas",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Aportaciones de capital en efectivo + Dividendos pagados",
    what: "Cuánto dinero pusieron los socios (positivo) o retiraron como dividendos (negativo) en el periodo, en miles.",
    how: `Si los socios tienen que aportar año tras año, la operación no está generando lo suficiente. ${SIN_SEMAFORO}`,
  },
  {
    key: "efectivo_periodo",
    group: "flujo",
    label: "Efectivo generado en el periodo",
    format: "miles",
    better: "higher",
    semaforo: false,
    formula: "Efectivo de operación + inversión + financiamiento externo + accionistas",
    what: "Cuánto cambió tu caja en el periodo: es la diferencia entre el efectivo final y el inicial, en miles.",
    how: `Positivo significa que terminaste con más efectivo que al inicio; negativo, con menos. Lo importante es de dónde salió ese cambio. ${SIN_SEMAFORO}`,
  },
  // --- Liquidez ---
  {
    key: "liquidez",
    group: "liquidez",
    label: "Índice de liquidez",
    format: "ratio",
    better: "higher",
    bands: { greenMin: 1.5, amberMin: 1.0 },
    semaforo: true,
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
    semaforo: true,
    formula: "(Activo circulante − Inventarios) ÷ Pasivo circulante",
    what: "Lo mismo que la liquidez, pero sin contar los inventarios, que tardan en convertirse en dinero.",
    how: "Arriba de 1 estás tranquilo; entre 0.7 y 1 dependes de vender inventario para pagar; debajo de 0.7 la caja está apretada.",
  },
  {
    key: "liquidez_inmediata",
    group: "liquidez",
    label: "Liquidez inmediata",
    format: "ratio",
    better: "higher",
    bands: { greenMin: 0.3, amberMin: 0.1 },
    semaforo: true,
    formula: "Efectivo y equivalentes ÷ Pasivo circulante",
    what: "Qué parte de lo que debes a corto plazo podrías pagar hoy mismo con el dinero que tienes en caja y bancos.",
    how: "Arriba de 0.3 (30 centavos por peso) tienes colchón; entre 0.1 y 0.3 dependes de cobrar para pagar; debajo de 0.1 cualquier retraso en la cobranza te deja sin efectivo.",
  },
  {
    key: "capital_trabajo",
    group: "liquidez",
    label: "Capital de trabajo",
    format: "miles",
    better: "higher",
    statusFrom: "liquidez",
    semaforo: true,
    formula: "Activo circulante − Pasivo circulante",
    what: "El dinero que te sobra (o te falta) después de cubrir lo que debes a corto plazo, en miles.",
    how: "Positivo significa que tienes colchón para operar; negativo, que las deudas de corto plazo superan lo que tienes a la mano. Su semáforo es el mismo que el del índice de liquidez.",
  },
  // --- Cobertura ---
  {
    key: "cobertura_rif_ebit",
    group: "cobertura",
    label: "Cobertura del RIF con EBIT",
    format: "ratio",
    better: "higher",
    bands: COBERTURA_BANDS,
    semaforo: true,
    formula: "Resultado de operación ÷ Costo financiero neto (intereses, productos financieros y resultado cambiario)",
    what: "Cuántas veces lo que gana la operación alcanza para pagar todo el costo financiero del periodo, incluido el efecto del tipo de cambio.",
    how: "Arriba de 3 veces estás tranquilo; entre 1.5 y 3 cualquier baja en ventas te complica el pago; debajo de 1.5 el costo financiero se lleva casi todo lo que generas. Si el resultado financiero es a favor, no aplica.",
  },
  {
    key: "cobertura_rif_ebitda",
    group: "cobertura",
    label: "Cobertura del RIF con EBITDA",
    format: "ratio",
    better: "higher",
    bands: COBERTURA_BANDS,
    semaforo: true,
    formula: "EBITDA ÷ Costo financiero neto (intereses, productos financieros y resultado cambiario)",
    what: "Igual que la anterior, pero con el EBITDA: cuántas veces el efectivo de la operación cubre el costo financiero total.",
    how: "Arriba de 3 veces estás tranquilo; entre 1.5 y 3 el margen es estrecho; debajo de 1.5 el costo financiero se lleva casi todo el efectivo que generas. Si el resultado financiero es a favor, no aplica.",
  },
  {
    key: "cobertura_int_ebit",
    group: "cobertura",
    label: "Cobertura de intereses con EBIT",
    format: "ratio",
    better: "higher",
    bands: COBERTURA_BANDS,
    semaforo: true,
    formula: "Resultado de operación ÷ (Gastos financieros − Productos financieros)",
    what: "Cuántas veces lo que gana la operación alcanza para pagar los intereses netos de la deuda, sin contar el tipo de cambio.",
    how: "Arriba de 3 veces estás tranquilo; entre 1.5 y 3 cualquier baja en ventas te complica el pago; debajo de 1.5 los intereses se llevan casi toda la utilidad. Si ganas más intereses de los que pagas, no aplica.",
  },
  {
    key: "cobertura_int_ebitda",
    group: "cobertura",
    label: "Cobertura de intereses con EBITDA",
    format: "ratio",
    better: "higher",
    bands: COBERTURA_BANDS,
    semaforo: true,
    formula: "EBITDA ÷ (Gastos financieros − Productos financieros)",
    what: "Cuántas veces el efectivo que genera la operación (EBITDA) alcanza para pagar los intereses netos de la deuda.",
    how: "Arriba de 3 veces estás tranquilo; entre 1.5 y 3 el margen es estrecho; debajo de 1.5 los intereses se llevan casi todo el efectivo que generas. Si ganas más intereses de los que pagas, no aplica.",
  },
  // --- Solvencia ---
  {
    key: "apalancamiento",
    group: "solvencia",
    label: "Índice de apalancamiento",
    format: "ratio",
    better: "lower",
    bands: { greenMax: 1.0, amberMax: 2.0 },
    semaforo: true,
    formula: "Total pasivo ÷ Capital contable",
    what: "Cuántos pesos debes por cada peso que es realmente de los socios.",
    how: "Hasta 1 la empresa es sobre todo de los socios; entre 1 y 2 la deuda pesa tanto o más que el capital; arriba de 2 dependes mucho de terceros. Con capital negativo o cero se marca en rojo.",
  },
  {
    key: "apalancamiento_financiero",
    group: "solvencia",
    label: "Índice de apalancamiento financiero",
    format: "ratio",
    better: "lower",
    bands: { greenMax: 0.5, amberMax: 1.0 },
    semaforo: true,
    formula: "(Pasivo bancario a corto plazo + Porción circulante + Pasivo bancario a largo plazo) ÷ Capital contable",
    what: "Cuántos pesos debes a los bancos por cada peso de los socios: solo la deuda que cobra intereses.",
    how: "Hasta 0.5 la deuda bancaria es moderada; entre 0.5 y 1 ya pesa; arriba de 1 debes a los bancos más de lo que vale tu capital. Con capital negativo o cero se marca en rojo.",
  },
  {
    key: "capital_activo",
    group: "solvencia",
    label: "Capital / activo total",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.5, amberMin: 0.33 },
    semaforo: true,
    formula: "Capital contable ÷ Total activo",
    what: "Qué porcentaje de todo lo que tiene la empresa fue aportado o ganado por los socios, y no prestado.",
    how: "Arriba de 50% la empresa se sostiene sola; entre 33% y 50% hay equilibrio con la deuda; debajo de 33% la mayor parte de lo que tienes está financiado por terceros.",
  },
  {
    key: "pasivo_ebitda",
    group: "solvencia",
    label: "Pasivo total / EBITDA",
    format: "ratio",
    better: "lower",
    bands: { greenMax: 3.0, amberMax: 5.0 },
    semaforo: true,
    formula: "Total pasivo ÷ EBITDA",
    what: "Cuántos años de lo que genera la operación (EBITDA) necesitarías para pagar todo lo que debes.",
    how: "Hasta 3 es manejable; entre 3 y 5 la deuda exige disciplina; más de 5 es difícil de pagar. Si el EBITDA es negativo o cero, la operación no alcanza para pagar nada y se marca en rojo.",
  },
  {
    key: "pasivo_fin_ebitda",
    group: "solvencia",
    label: "Pasivo financiero / EBITDA",
    format: "ratio",
    better: "lower",
    bands: { greenMax: 2.0, amberMax: 3.5 },
    semaforo: true,
    formula: "Total pasivos con costo ÷ EBITDA",
    what: "Cuántos años de lo que genera la operación (EBITDA) necesitarías para pagar la deuda bancaria.",
    how: "Hasta 2 es cómodo; entre 2 y 3.5 la deuda ya exige disciplina; más de 3.5 los bancos lo ven con cautela. Sin deuda con costo está en verde; con EBITDA negativo o cero, en rojo.",
  },
  {
    key: "deuda_cp",
    group: "solvencia",
    label: "Deuda con costo de corto plazo",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Pasivo bancario a corto plazo + Porción circulante del pasivo a largo plazo",
    what: "Lo que debes a los bancos y tienes que pagar en los próximos 12 meses, en miles.",
    how: `Compáralo con el efectivo de operación: es lo que tendrás que cubrir pronto. ${SIN_SEMAFORO}`,
  },
  {
    key: "deuda_lp",
    group: "solvencia",
    label: "Deuda con costo de largo plazo",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Pasivo bancario a largo plazo",
    what: "Lo que debes a los bancos con vencimiento a más de un año, en miles.",
    how: `Deuda larga para activos largos es sana; si financia la operación diaria, revisa la estructura. ${SIN_SEMAFORO}`,
  },
  {
    key: "deuda_total",
    group: "solvencia",
    label: "Total pasivos con costo",
    format: "miles",
    better: null,
    semaforo: false,
    formula: "Deuda con costo de corto plazo + Deuda con costo de largo plazo",
    what: "Toda la deuda que cobra intereses, en miles.",
    how: `Es la base del apalancamiento financiero y de Pasivo financiero / EBITDA. ${SIN_SEMAFORO}`,
  },
  // --- Rentabilidad ---
  {
    key: "margen_bruto",
    group: "rentabilidad",
    label: "Margen bruto",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.3, amberMin: 0.15 },
    semaforo: true,
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
    semaforo: true,
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
    semaforo: true,
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
    semaforo: true,
    formula: "(Utilidad neta ÷ Total activo) llevado a 12 meses",
    what: "Cuánto ganas al año por cada peso invertido en la empresa (ROA: rendimiento sobre los activos). En periodos parciales se anualiza.",
    how: "Arriba de 5% tus activos trabajan bien; entre 0% y 5% rinden poco; negativo significa que la empresa pierde dinero.",
  },
  {
    key: "roe",
    group: "rentabilidad",
    label: "ROE (rendimiento sobre capital)",
    format: "pct",
    better: "higher",
    bands: { greenMin: 0.15, amberMin: 0 },
    semaforo: true,
    formula: "(Utilidad neta ÷ Capital contable) llevado a 12 meses",
    what: "Cuánto ganan al año los socios por cada peso que han puesto o dejado en la empresa (ROE: rendimiento sobre el capital). En periodos parciales se anualiza.",
    how: "Arriba de 15% es atractivo para los socios; entre 0% y 15% rinde menos que otras opciones; negativo significa que pierden dinero. Con capital negativo o cero se marca en rojo.",
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
