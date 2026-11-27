// Prueba rápida de los cálculos del Mapa de dependencia
// (src/config/dependencyCalc.js) contra las cifras de la hoja «Línea base»
// del ejemplo del método: mismos totales, mismos porcentajes y el mismo
// formato de tiempo que las fórmulas del Excel. Los registros de aquí son
// inventados; solo reproducen los totales del ejemplo.
// Correr con: node scripts/check-dependencyCalc.mjs
import {
  CATEGORY_KEYS,
  INTERVENTION_KEYS,
  LIMITS,
  MAP_SECTION_KEYS,
  REASON_KEYS,
  buildBaseline,
  buildInput,
  canonicalJson,
  dailySummary,
  decisionsByReason,
  decisionsByType,
  formatDay,
  formatDuration,
  formatPct,
  inputHash,
  precheck,
  quantityIssues,
  timeDistribution,
  toMinutes,
} from "../src/config/dependencyCalc.js";

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails += 1;
  console.log(`${ok ? "OK  " : "FALLA"} ${name}${ok ? "" : `\n      obtuve   ${JSON.stringify(got)}\n      esperaba ${JSON.stringify(want)}`}`);
};

// ---------- formatos ----------
eq("toMinutes vacío no es cero", [toMinutes(""), toMinutes(null), toMinutes("  "), toMinutes("abc")], [null, null, null, null]);
eq("toMinutes números", [toMinutes("45"), toMinutes(30.4), toMinutes("12,5"), toMinutes(0), toMinutes(-5), toMinutes(5000)], [45, 30, 13, 0, null, 1440]);
eq("formatDuration (formato [h] h mm min)", [formatDuration(415), formatDuration(25), formatDuration(360), formatDuration(0), formatDuration(4005)], ["6 h 55 min", "0 h 25 min", "6 h 00 min", "0 h 00 min", "66 h 45 min"]);
eq("formatPct (formato 0.0%)", [formatPct(2225 / 4005), formatPct(810 / 4005), formatPct(0), formatPct(1)], ["55.6%", "20.2%", "0.0%", "100.0%"]);
eq("formatDay", [formatDay("2026-11-17"), formatDay("2026-11-17", true), formatDay(null)], ["mar 17 nov", "martes 17 de noviembre", "Sin fecha"]);

// ---------- línea base del ejemplo ----------
// 66 actividades en 4 fechas, 4005 min: Operación 2225, Dirección 810,
// Gestión 550, Supervisión 420.
const DAYS = ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
const plan = { operacion: [34, 2225], direccion: [12, 810], gestion: [11, 550], supervision: [9, 420] };
const activities = [];
const classification = {};
let pos = 0;
for (const [cat, [count, total]] of Object.entries(plan)) {
  const base = Math.floor(total / count);
  for (let i = 0; i < count; i += 1) {
    const id = `a-${cat}-${i}`;
    activities.push({
      id,
      activity_date: DAYS[pos % DAYS.length],
      description: `Actividad ${pos + 1}`,
      purpose: "Propósito",
      minutes: i === 0 ? total - base * (count - 1) : base,
      position: pos,
    });
    classification[id] = cat;
    pos += 1;
  }
}
// 5 decisiones, 415 min: Autorizar 1 · 25, Decidir 1 · 30, Resolver 3 · 360.
const decisions = [
  { id: "d1", decision_date: "2026-11-17", requester: "Almacén", description: "Compra urgente", intervention: "autorizar", reason: "autoridad", minutes: 25, position: 0 },
  { id: "d2", decision_date: "2026-11-18", requester: "Ventas", description: "Descuento a un cliente", intervention: "decidir", reason: "proceso", minutes: 30, position: 1 },
  { id: "d3", decision_date: "2026-11-18", requester: "Producción", description: "Falla de una máquina", intervention: "resolver", reason: "habito", minutes: 120, position: 2 },
  { id: "d4", decision_date: "2026-11-19", requester: "Producción", description: "Reproceso de un lote", intervention: "resolver", reason: "habito", minutes: 150, position: 3 },
  { id: "d5", decision_date: "2026-11-16", requester: "Logística", description: "Entrega detenida", intervention: "resolver", reason: "temor", minutes: 90, position: 4 },
];
const measurement = { title: "17 al 20 de noviembre", person_name: "Persona de prueba", job_title: "Dirección general", notes: "", simultaneous: false };
const input = buildInput({ measurement, activities: [...activities].reverse(), decisions });

eq("buildInput numera en orden de fecha y posición", [input.bitacora.length, input.bitacora[0].n, input.bitacora[0].fecha, input.bitacora[65].n], [66, 1, "2026-11-17", 66]);
eq("buildInput no manda el nombre de la persona", Object.keys(input.persona), ["puesto", "semana"]);

const time = timeDistribution(input.bitacora, classification);
eq("tiempo total y actividades", [time.totalMinutes, time.count, time.unclassifiedCount], [4005, 66, 0]);
eq(
  "% del tiempo registrado (Línea base B7:B10)",
  Object.fromEntries(time.rows.map((r) => [r.key, formatPct(r.pct)])),
  { direccion: "20.2%", gestion: "13.7%", supervision: "10.5%", operacion: "55.6%" },
);
eq("orden de la Línea base", time.rows.map((r) => r.key), CATEGORY_KEYS);

const dec = decisionsByType(input.decisiones);
eq(
  "decisiones por tipo (Línea base filas 15–20)",
  dec.rows.map((r) => [r.key, r.count, formatDuration(r.minutes), formatPct(r.pct)]),
  [
    ["autorizar", 1, "0 h 25 min", "6.0%"],
    ["decidir", 1, "0 h 30 min", "7.2%"],
    ["resolver", 3, "6 h 00 min", "86.7%"],
    ["indicar", 0, "0 h 00 min", "0.0%"],
    ["validar", 0, "0 h 00 min", "0.0%"],
    ["desbloquear", 0, "0 h 00 min", "0.0%"],
  ],
);
eq("decisiones: total (fila 21)", [dec.total.count, formatDuration(dec.total.minutes), formatPct(dec.total.pct)], [5, "6 h 55 min", "100.0%"]);
eq("decisiones por motivo", decisionsByReason(input.decisiones).map((r) => [r.key, r.count]), [["autoridad", 1], ["proceso", 1], ["temor", 1], ["habito", 2]].sort((a, b) => REASON_KEYS.indexOf(a[0]) - REASON_KEYS.indexOf(b[0])));

// Decisión sin tipo: su tiempo cuenta en el total, como en el Excel.
const withUntyped = decisionsByType([...input.decisiones, { id: "x", tipo: null, minutos: 85 }]);
eq("decisión sin tipo", [withUntyped.untyped, withUntyped.total.minutes, formatPct(withUntyped.total.pct), withUntyped.total.count], [{ count: 1, minutes: 85 }, 500, "83.0%", 5]);

// Actividad sin clasificar o sin tiempo.
const partial = timeDistribution(
  [{ id: "1", minutos: 60 }, { id: "2", minutos: null }, { id: "3", minutos: 40 }],
  { 1: "operacion", 2: "gestion" },
);
eq("sin clasificar y sin tiempo", [partial.totalMinutes, partial.withoutTime, partial.unclassifiedMinutes, formatPct(partial.rows[3].pct)], [100, 1, 40, "60.0%"]);

const baseline = buildBaseline(input, classification);
eq("buildBaseline: foto para el diagnóstico", [baseline.tiempo.total_minutos, baseline.tiempo.filas.length, baseline.decisiones.total.minutos, baseline.dias.length], [4005, 4, 415, 4]);
eq("resumen por día suma lo mismo", dailySummary(input.bitacora).reduce((s, d) => s + d.minutes, 0), 4005);

// ---------- revisión antes de analizar ----------
const codes = (i) => precheck(i).map((c) => c.code);
eq("precheck del ejemplo (4 días; una decisión fuera de la semana; jornadas largas)", codes(input), ["dias", "jornada_larga", "jornada_larga", "jornada_larga", "jornada_larga", "decisiones_fuera"]);
eq("con simultaneidad aclarada no avisa jornadas largas", codes({ ...input, simultaneas: true }), ["dias", "decisiones_fuera"]);
const empty = buildInput({ measurement, activities: [], decisions: [] });
eq("sin registros: bloquea", precheck(empty).filter((c) => c.level === "bloqueo").map((c) => c.code), ["pocas_actividades"]);
const five = buildInput({
  measurement,
  activities: Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, activity_date: `2026-11-${16 + i}`, description: `Actividad ${i}`, purpose: "p", minutes: 60, position: i })),
  decisions: [],
});
eq("cinco días completos: solo falta decisiones", codes(five), ["sin_decisiones"]);
const gaps = buildInput({
  measurement,
  activities: [
    ...five.bitacora.map((a) => ({ id: a.id, activity_date: a.fecha, description: a.actividad, purpose: "", minutes: a.minutos, position: a.n })),
    { id: "g1", activity_date: "2026-11-16", description: "Sin tiempo", purpose: "p", minutes: "", position: 9 },
    { id: "g2", activity_date: null, description: "", purpose: "", minutes: 20, position: 10 },
    { id: "g3", activity_date: "2026-11-16", description: "", purpose: "", minutes: "", position: 11 }, // en blanco: se ignora
  ],
  decisions: [{ id: "q", decision_date: "", requester: "Compras", description: "", intervention: "", reason: "", minutes: "", position: 0 }],
});
eq("filas en blanco no entran", gaps.bitacora.length, 7);
eq("precheck con huecos", codes(gaps), ["sin_fecha", "sin_tiempo", "sin_actividad", "sin_proposito", "decision_sin_tipo", "decision_sin_tiempo"]);
eq("límites", [LIMITS.questions, LIMITS.workDays], [3, 5]);

// ---------- reglas de redacción comprobables ----------
eq("interpretación con proporción", quantityIssues("Indica que más de la mitad del tiempo se destina a ejecutar."), ["mitad"]);
eq("interpretación con cifras", quantityIssues("El 55.6% de tu tiempo, 34 actividades."), ["%", "55.6", "34"]);
eq("interpretación cualitativa", quantityIssues("Tu participación se concentra en ejecutar y deja poco espacio para dirigir."), []);
eq("apartado 2: solo cifras y porcentajes", [quantityIssues("La mayoría de las consultas llega por costumbre.", { proportions: false }), quantityIssues("Tres registros, 86.7%", { proportions: false })], [[], ["%", "86.7"]]);

// ---------- huella ----------
const h1 = await inputHash(input);
const h2 = await inputHash(buildInput({ measurement: { ...measurement, person_name: "Otro nombre" }, activities, decisions }));
const h3 = await inputHash(buildInput({ measurement, activities: activities.map((a, i) => (i === 0 ? { ...a, minutes: a.minutes + 1 } : a)), decisions }));
eq("huella: 64 hex", /^[0-9a-f]{64}$/.test(h1), true);
eq("huella: no depende del orden ni del nombre", h1 === h2, true);
eq("huella: cambia si cambia un registro", h1 !== h3, true);
eq("JSON canónico ordena claves", canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] }), '{"a":[{"c":2,"d":1}],"b":1}');
eq("catálogos", [CATEGORY_KEYS.length, INTERVENTION_KEYS.length, REASON_KEYS.length, MAP_SECTION_KEYS.length], [4, 6, 8, 6]);

console.log(fails === 0 ? "\nTODO OK" : `\nFALLAS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
