// ============================================================
// Mapa de dependencia (VIA · Modo Director · Semana 1): catálogos y cálculos.
// ------------------------------------------------------------
// Módulo puro (sin React ni acceso a datos). Lo usan la app y la función
// `ia`, que trabaja con una copia en supabase/functions/_shared/app
// (`npm run mcp:sync`): así la línea base que ve el empresario y la que
// recibe el asistente salen de las mismas fórmulas.
//
// Las fórmulas son las de la hoja «Línea base» del Excel del método:
//   · % del tiempo por clasificación = minutos de la clasificación ÷ minutos
//     totales de la bitácora.
//   · Decisiones por tipo de intervención: cantidad, tiempo (h y min) y % del
//     tiempo sobre el total de minutos de «Decisiones que tomas».
// Los minutos de las decisiones nunca se suman a los de la bitácora.
// ============================================================

export const MODULE_KEY = "dependency";

// Versión del método (prompt del cliente) y de su adaptación a la app. Se
// guarda con cada diagnóstico para saber con qué reglas se generó.
export const METHOD_VERSION = "2.1";

// Orden de la Línea base.
export const CATEGORIES = [
  { key: "direccion", label: "Dirección", role: "Define el rumbo y transforma las condiciones de la empresa." },
  { key: "gestion", label: "Gestión", role: "Organiza y coordina la ejecución de directrices y resultados." },
  {
    key: "supervision",
    label: "Supervisión",
    role: "Verifica el desempeño y el cumplimiento, y desarrolla a los responsables.",
  },
  { key: "operacion", label: "Operación", role: "Ejecuta directamente tareas o procesos del negocio." },
];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

// «Tipo de intervención requerida».
export const INTERVENTIONS = [
  { key: "autorizar", label: "Autorizar" },
  { key: "decidir", label: "Decidir" },
  { key: "resolver", label: "Resolver un problema" },
  { key: "indicar", label: "Indicar cómo hacerlo" },
  { key: "validar", label: "Validar / aprobar" },
  { key: "desbloquear", label: "Desbloquear a otra persona" },
];
export const INTERVENTION_KEYS = INTERVENTIONS.map((i) => i.key);
export const INTERVENTION_BY_KEY = Object.fromEntries(INTERVENTIONS.map((i) => [i.key, i]));

// «¿Por qué llegó a ti?».
export const REASONS = [
  { key: "conocimiento", label: "Falta de conocimiento o capacidad" },
  { key: "autoridad", label: "Falta de autoridad" },
  { key: "proceso", label: "Proceso o criterio no definido" },
  { key: "temor", label: "Temor al error o falta de confianza" },
  { key: "habito", label: "Intervención habitual del empresario" },
  { key: "informacion", label: "Información insuficiente" },
  { key: "riesgo", label: "Riesgo que sí requiere dirección" },
  { key: "otro", label: "Otro / por identificar" },
];
export const REASON_KEYS = REASONS.map((r) => r.key);
export const REASON_BY_KEY = Object.fromEntries(REASONS.map((r) => [r.key, r]));

// Los seis apartados del Mapa de dependencia, en su orden.
export const MAP_SECTIONS = [
  { key: "diagnostico_general", title: "Diagnóstico general" },
  { key: "decisiones_intervenciones", title: "Decisiones e intervenciones" },
  { key: "causas_condiciones", title: "Causas y condiciones que generan dependencia" },
  { key: "consecuencias_capacidades", title: "Consecuencias y capacidades existentes" },
  { key: "conclusiones_directivas", title: "Conclusiones directivas" },
  { key: "datos_a_validar", title: "Datos a validar" },
];
export const MAP_SECTION_KEYS = MAP_SECTIONS.map((s) => s.key);

export const LIMITS = {
  activities: 300, // filas de bitácora por medición (el Excel trae 200)
  decisions: 150, // filas de decisiones (el Excel trae 100)
  minActivities: 5, // mínimo de actividades con tiempo para poder analizar
  workDays: 5, // días laborables que pide el ejercicio
  longDayMinutes: 14 * 60, // un día que suma más que esto sugiere simultaneidad
  questions: 3, // preguntas de validación, como máximo
  answerLength: 1500, // caracteres por respuesta
};

// ---------- utilidades ----------

const text = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const isoDate = (v) => {
  const s = text(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// Minutos como entero entre 0 y 1440, o null si no hay dato. Vacío NO es cero.
export function toMinutes(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(1440, Math.round(n));
}

// «6 h 55 min»: el formato [h]" h "mm" min" de la Línea base (nunca horas
// decimales).
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

// «55.6%»: el formato 0.0% de la Línea base. `ratio` va de 0 a 1.
export function formatPct(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r)) return "0.0%";
  return `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
}

// «lun 17 nov» / «lunes 17 de noviembre». La fecha es un día de calendario
// (sin hora ni zona horaria). Los nombres van aquí, y no con Intl, para que
// el texto sea idéntico en el navegador y en el servidor.
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function formatDay(iso, long = false) {
  const d = isoDate(iso);
  if (!d) return "Sin fecha";
  const [y, m, day] = d.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  const month = MONTHS[m - 1];
  if (!weekday || !month) return d;
  return long ? `${weekday} ${day} de ${month}` : `${weekday.slice(0, 3)} ${day} ${month.slice(0, 3)}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- entrada del análisis ----------

const byDateThenPosition = (dateField) => (a, b) => {
  const da = isoDate(a[dateField]) || "9999-12-31";
  const db = isoDate(b[dateField]) || "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  const pa = Number(a.position) || 0;
  const pb = Number(b.position) || 0;
  if (pa !== pb) return pa - pb;
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
};

// ¿La fila tiene algo capturado? (Las filas en blanco no se guardan ni se analizan.)
export const activityHasContent = (a) =>
  !!(text(a?.description) || text(a?.purpose) || toMinutes(a?.minutes) !== null);
export const decisionHasContent = (d) =>
  !!(
    text(d?.requester) ||
    text(d?.description) ||
    text(d?.intervention) ||
    text(d?.reason) ||
    toMinutes(d?.minutes) !== null
  );

// Registros de la medición, limpios y numerados (n = número de fila que usa
// el asistente para referirse a cada registro). Recibe las filas tal como
// están en la base (dep_activities / dep_decisions).
export function buildInput({ measurement, activities, decisions }) {
  const bitacora = (activities || [])
    .filter(activityHasContent)
    .sort(byDateThenPosition("activity_date"))
    .map((a, i) => ({
      n: i + 1,
      id: a.id,
      fecha: isoDate(a.activity_date),
      actividad: text(a.description),
      proposito: text(a.purpose),
      minutos: toMinutes(a.minutes),
    }));
  const decisiones = (decisions || [])
    .filter(decisionHasContent)
    .sort(byDateThenPosition("decision_date"))
    .map((d, i) => ({
      n: i + 1,
      id: d.id,
      fecha: isoDate(d.decision_date),
      solicita: text(d.requester),
      situacion: text(d.description),
      tipo: INTERVENTION_BY_KEY[d.intervention] ? d.intervention : null,
      motivo: REASON_BY_KEY[d.reason] ? d.reason : null,
      minutos: toMinutes(d.minutes),
    }));
  return {
    persona: { puesto: text(measurement?.job_title), semana: text(measurement?.title) },
    aclaraciones: text(measurement?.notes),
    simultaneas: !!measurement?.simultaneous,
    bitacora,
    decisiones,
  };
}

// JSON canónico (claves ordenadas): la misma entrada da siempre el mismo texto.
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
export const canonicalJson = (v) => JSON.stringify(sortKeys(v));

// Huella (SHA-256) de los registros analizados. La app la compara con la del
// diagnóstico guardado para avisar si los registros cambiaron después.
// Devuelve null donde no hay crypto.subtle (página sin HTTPS).
export async function inputHash(input) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const data = new TextEncoder().encode(canonicalJson({ v: 1, ...input }));
  const buf = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- línea base ----------

// 1. Distribución del tiempo registrado. `classification` = { idActividad: clave }.
export function timeDistribution(bitacora, classification = {}) {
  const sums = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, { minutes: 0, count: 0 }]));
  let total = 0;
  let unclassifiedMinutes = 0;
  let unclassifiedCount = 0;
  let withoutTime = 0;
  for (const a of bitacora || []) {
    const m = a.minutos ?? 0;
    if (a.minutos === null || a.minutos === undefined) withoutTime += 1;
    total += m;
    const slot = sums[classification?.[a.id]];
    if (slot) {
      slot.minutes += m;
      slot.count += 1;
    } else {
      unclassifiedMinutes += m;
      unclassifiedCount += 1;
    }
  }
  return {
    totalMinutes: total,
    count: (bitacora || []).length,
    withoutTime,
    unclassifiedMinutes,
    unclassifiedCount,
    rows: CATEGORIES.map((c) => ({
      key: c.key,
      minutes: sums[c.key].minutes,
      count: sums[c.key].count,
      pct: total > 0 ? sums[c.key].minutes / total : 0,
    })),
  };
}

// 2. Decisiones que tomas por tipo de intervención. El total de tiempo es la
// suma de TODOS los minutos de la lista (como en el Excel), así que si hay
// registros sin tipo los porcentajes no llegan a 100 %: se informa aparte.
export function decisionsByType(decisiones) {
  const list = decisiones || [];
  const totalMinutes = list.reduce((s, d) => s + (d.minutos ?? 0), 0);
  const rows = INTERVENTIONS.map((t) => {
    const mine = list.filter((d) => d.tipo === t.key);
    const minutes = mine.reduce((s, d) => s + (d.minutos ?? 0), 0);
    return { key: t.key, count: mine.length, minutes, pct: totalMinutes > 0 ? minutes / totalMinutes : 0 };
  });
  const untyped = list.filter((d) => !d.tipo);
  return {
    rows,
    total: {
      count: rows.reduce((s, r) => s + r.count, 0),
      minutes: totalMinutes,
      pct: rows.reduce((s, r) => s + r.pct, 0),
    },
    untyped: { count: untyped.length, minutes: untyped.reduce((s, d) => s + (d.minutos ?? 0), 0) },
    records: list.length,
  };
}

// Motivos por los que las situaciones llegaron al empresario (no es parte de
// la Línea base: es contexto para el análisis de causas).
export function decisionsByReason(decisiones) {
  const list = decisiones || [];
  return REASONS.map((r) => {
    const mine = list.filter((d) => d.motivo === r.key);
    return { key: r.key, count: mine.length, minutes: mine.reduce((s, d) => s + (d.minutos ?? 0), 0) };
  }).filter((r) => r.count > 0);
}

// Minutos y actividades por día de la bitácora (los días sin fecha, al final).
export function dailySummary(bitacora) {
  const days = new Map();
  for (const a of bitacora || []) {
    const key = a.fecha || "";
    const d = days.get(key) || { fecha: a.fecha || null, minutes: 0, count: 0 };
    d.minutes += a.minutos ?? 0;
    d.count += 1;
    days.set(key, d);
  }
  return [...days.values()].sort((a, b) => (a.fecha || "9999") < (b.fecha || "9999") ? -1 : 1);
}

// Línea base tal como se guarda con el diagnóstico (una foto de las cifras
// que leyó el asistente).
export function buildBaseline(input, classification) {
  const time = timeDistribution(input.bitacora, classification);
  const dec = decisionsByType(input.decisiones);
  return {
    tiempo: {
      total_minutos: time.totalMinutes,
      actividades: time.count,
      sin_tiempo: time.withoutTime,
      filas: time.rows.map((r) => ({ clave: r.key, minutos: r.minutes, actividades: r.count, pct: r.pct })),
    },
    decisiones: {
      registros: dec.records,
      filas: dec.rows.map((r) => ({ clave: r.key, cantidad: r.count, minutos: r.minutes, pct: r.pct })),
      total: { cantidad: dec.total.count, minutos: dec.total.minutes, pct: dec.total.pct },
      sin_tipo: { cantidad: dec.untyped.count, minutos: dec.untyped.minutes },
    },
    dias: dailySummary(input.bitacora).map((d) => ({ fecha: d.fecha, minutos: d.minutes, actividades: d.count })),
  };
}

// ---------- revisión antes de analizar ----------

// Lo que conviene revisar antes de gastar un análisis. `level`:
//   'bloqueo' → no se puede analizar todavía.
//   'aviso'   → se puede, pero el dato quedará como pendiente de validar.
// Los mismos textos acompañan la entrada del asistente como observaciones.
export function precheck(input) {
  const out = [];
  const add = (code, level, message) => out.push({ code, level, text: message });
  const { bitacora, decisiones } = input;

  const usable = bitacora.filter((a) => a.actividad && (a.minutos ?? 0) > 0).length;
  if (usable < LIMITS.minActivities) {
    add(
      "pocas_actividades",
      "bloqueo",
      `Registra al menos ${LIMITS.minActivities} actividades con su tiempo para poder analizar la semana (hay ${usable}).`,
    );
  }
  if (bitacora.length > LIMITS.activities) {
    add("demasiadas_actividades", "bloqueo", `La bitácora admite hasta ${LIMITS.activities} actividades por medición.`);
  }
  if (decisiones.length > LIMITS.decisions) {
    add("demasiadas_decisiones", "bloqueo", `La lista de decisiones admite hasta ${LIMITS.decisions} registros por medición.`);
  }

  const days = dailySummary(bitacora).filter((d) => d.fecha);
  if (bitacora.length > 0 && days.length !== LIMITS.workDays) {
    add(
      "dias",
      "aviso",
      `La bitácora tiene registros de ${plural(days.length, "día", "días")}; el ejercicio pide ${LIMITS.workDays} días laborables.`,
    );
  }
  const noDate = bitacora.filter((a) => !a.fecha).length;
  if (noDate > 0) add("sin_fecha", "aviso", `${plural(noDate, "actividad no tiene", "actividades no tienen")} fecha.`);

  const noTime = bitacora.filter((a) => a.minutos === null).length;
  if (noTime > 0) {
    add(
      "sin_tiempo",
      "aviso",
      `${plural(noTime, "actividad no tiene", "actividades no tienen")} tiempo registrado. Un tiempo vacío no cuenta como cero: queda fuera de los porcentajes.`,
    );
  }
  const noText = bitacora.filter((a) => !a.actividad).length;
  if (noText > 0) {
    add("sin_actividad", "aviso", `${plural(noText, "registro tiene", "registros tienen")} tiempo pero no describen la actividad.`);
  }
  const noPurpose = bitacora.filter((a) => a.actividad && !a.proposito).length;
  if (noPurpose > 0) {
    add(
      "sin_proposito",
      "aviso",
      `${plural(noPurpose, "actividad no indica", "actividades no indican")} el propósito o resultado buscado, que es el contexto principal para clasificarlas.`,
    );
  }
  if (!input.simultaneas) {
    for (const d of days.filter((x) => x.minutes > LIMITS.longDayMinutes)) {
      add(
        "jornada_larga",
        "aviso",
        `El ${formatDay(d.fecha, true)} suma ${formatDuration(d.minutes)}. Si hubo actividades simultáneas, indícalo en las aclaraciones.`,
      );
    }
  }

  if (decisiones.length === 0) {
    add(
      "sin_decisiones",
      "aviso",
      "No hay registros en «Decisiones que tomas». Si alguien llevó una decisión, autorización o problema a tu atención esta semana, regístralo antes de analizar.",
    );
  } else {
    const logDates = new Set(days.map((d) => d.fecha));
    const outside = decisiones.filter((d) => d.fecha && logDates.size > 0 && !logDates.has(d.fecha)).length;
    if (outside > 0) {
      add(
        "decisiones_fuera",
        "aviso",
        `${plural(outside, "decisión tiene", "decisiones tienen")} una fecha que no aparece en la bitácora.`,
      );
    }
    const noType = decisiones.filter((d) => !d.tipo).length;
    if (noType > 0) {
      add(
        "decision_sin_tipo",
        "aviso",
        `${plural(noType, "decisión no indica", "decisiones no indican")} el tipo de intervención; no entran en la tabla por tipo.`,
      );
    }
    const noMinutes = decisiones.filter((d) => d.minutos === null).length;
    if (noMinutes > 0) {
      add("decision_sin_tiempo", "aviso", `${plural(noMinutes, "decisión no tiene", "decisiones no tienen")} tiempo invertido.`);
    }
  }
  return out;
}

// ---------- reglas de redacción que se pueden comprobar ----------

// El método pide que la «Interpretación de la IA» de la Línea base sea
// cualitativa: sin porcentajes, cifras ni expresiones de proporción («la
// mitad», «la mayoría», «una tercera parte»). Devuelve lo que encuentre.
const PROPORTION_WORDS =
  /\b(mitad|mayor[ií]a|mayor parte|tercera parte|terceras partes|tercio|tercios|cuarta parte|cuartas partes|por ciento|doble|triple)\b/gi;

export function quantityIssues(value, { proportions = true } = {}) {
  const s = text(value);
  const found = [];
  if (/%/.test(s)) found.push("%");
  const digits = s.match(/\d+(?:[.,]\d+)?/g);
  if (digits) found.push(...digits);
  if (proportions) {
    const words = s.match(PROPORTION_WORDS);
    if (words) found.push(...words.map((w) => w.toLowerCase()));
  } else if (/\bpor ciento\b/i.test(s)) {
    found.push("por ciento");
  }
  return [...new Set(found)];
}
