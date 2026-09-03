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
