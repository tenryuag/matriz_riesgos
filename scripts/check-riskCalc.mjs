// Prueba rápida de los módulos puros de perspectivas y cálculo de riesgos.
// Compara contra casos conocidos (misma fórmula que AddRisk.jsx) y verifica
// que el catálogo de perspectivas quede consistente con el resto de la app.
// Correr con: node scripts/check-riskCalc.mjs
import {
  PROBABILITY_LEVELS,
  IMPACT_LEVELS,
  LEVEL_KEYS,
  probabilityIndex,
  impactIndex,
  riskScore,
  levelKeyFromScore,
  isCriticalKey,
  isCriticalScore,
  controlGrade,
  levelKeyOf,
  currentLevelKey,
  hasResidual,
  labelForLevelKey,
  levelKeyFromText,
} from "../src/config/riskCalc.js";
import {
  PERSPECTIVES,
  PERSPECTIVE_KEYS,
  PERSPECTIVE_BY_KEY,
  LANES,
  isPerspectiveKey,
  suggestPerspectiveForDepartment,
} from "../src/config/perspectives.js";
import { perspectiveFor } from "../src/config/strategicCalc.js";
import {
  COST_CONCEPTS,
  EXPENSE_CONCEPTS,
  INCOME_INPUTS,
  ALL_BALANCE_KEYS,
  SALES_SECTION,
} from "../src/config/finConfig.js";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${JSON.stringify(actual)}${ok ? "" : `  (esperado ${JSON.stringify(expected)})`}`);
};

console.log("== Grado de control (misma fórmula que AddRisk) ==");
const ctl = (type, proc, doc, evi, resp, freq) => ({
  control_type_1: type, process_type_1: proc, control_documented_1: doc,
  control_evidence_1: evi, control_responsible_1: resp, control_frequency_1: freq,
});
check("Preventivo + Automatizado + 4 Sí = 1.10 → Fuerte",
  controlGrade(ctl("Control Preventivo", "Automatizado", "Sí", "Sí", "Sí", "Sí"), 1), "Fuerte");
check("Preventivo + Automatizado + 3 Sí + 1 No = 1.01 → Medio",
  controlGrade(ctl("Control Preventivo", "Automatizado", "Sí", "Sí", "Sí", "No"), 1), "Medio");
check("Detectivo + Combinado + 4 Sí = 0.80 → Medio",
  controlGrade(ctl("Control Detectivo", "Combinado", "Sí", "Sí", "Sí", "Sí"), 1), "Medio");
check("Correctivo + Manual + 4 Sí = 0.55 → Débil",
  controlGrade(ctl("Control Correctivo", "Manual", "Sí", "Sí", "Sí", "Sí"), 1), "Débil");
check("Preventivo + Manual + 4 No = 0.44 → Débil",
  controlGrade(ctl("Control Preventivo", "Manual", "No", "No", "No", "No"), 1), "Débil");
check("Falta un campo → ''",
  controlGrade(ctl("Control Preventivo", "Automatizado", "Sí", "Sí", "Sí", ""), 1), "");
check("Mitigante 2 independiente del 1", controlGrade({
  ...ctl("Control Preventivo", "Automatizado", "Sí", "Sí", "Sí", "Sí"),
  control_type_2: "Control Correctivo", process_type_2: "Manual", control_documented_2: "No",
  control_evidence_2: "No", control_responsible_2: "No", control_frequency_2: "No",
}, 2), "Débil");

console.log("\n== Índices y puntaje ==");
check("probabilityIndex catálogo completo", PROBABILITY_LEVELS.map(probabilityIndex), [1, 2, 3, 4, 5]);
check("impactIndex catálogo completo", IMPACT_LEVELS.map(impactIndex), [1, 2, 3, 4, 5]);
check("probabilityIndex en inglés",
  ["Remote (0-20%)", "Unlikely (21-40%)", "Occasional (41-60%)", "Likely (61-80%)", "Frequent (81-100%)"].map(probabilityIndex),
  [1, 2, 3, 4, 5]);
check("impactIndex en inglés",
  ["Insignificant", "Minor", "Critical", "Major", "Catastrophic"].map(impactIndex), [1, 2, 3, 4, 5]);
check("Sin acentos / minúsculas", [impactIndex("critico"), impactIndex("CATASTRÓFICO")], [3, 5]);
check("Texto desconocido → null", [probabilityIndex("Casi seguro"), impactIndex(""), impactIndex(null)], [null, null, null]);
check("Índice numérico directo", [probabilityIndex(4), impactIndex(7)], [4, null]);
check("Frecuente × Mayor = 20", riskScore("Frecuente (81-100%)", "Mayor"), 20);
check("Falta impacto → null", riskScore("Frecuente (81-100%)", ""), null);

console.log("\n== Nivel por puntaje (umbrales <=4, <=8, <=12, <=16) ==");
check("20 → INTOLERABLE", levelKeyFromScore(20), "INTOLERABLE");
check("16 → HIGH", levelKeyFromScore(16), "HIGH");
check("13 → HIGH", levelKeyFromScore(13), "HIGH");
check("12 → MEDIUM", levelKeyFromScore(12), "MEDIUM");
check("8 → LOW", levelKeyFromScore(8), "LOW");
check("4 → TOLERABLE", levelKeyFromScore(4), "TOLERABLE");
check("1 → TOLERABLE", levelKeyFromScore(1), "TOLERABLE");
check("null / 0 / NaN → null", [levelKeyFromScore(null), levelKeyFromScore(0), levelKeyFromScore(NaN)], [null, null, null]);
check("LEVEL_KEYS en orden de gravedad", LEVEL_KEYS, ["TOLERABLE", "LOW", "MEDIUM", "HIGH", "INTOLERABLE"]);
check("isCriticalKey", LEVEL_KEYS.map(isCriticalKey), [false, false, false, true, true]);
check("isCriticalScore 12/13/null", [isCriticalScore(12), isCriticalScore(13), isCriticalScore(null)], [false, true, false]);

// Tabla completa 5×5 comparada con la fórmula literal de AddRisk.
const addRiskLevel = (p, i) => {
  const s = p * i;
  return s <= 4 ? "TOLERABLE" : s <= 8 ? "LOW" : s <= 12 ? "MEDIUM" : s <= 16 ? "HIGH" : "INTOLERABLE";
};
let matrixOk = true;
for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) {
  const got = levelKeyFromScore(riskScore(PROBABILITY_LEVELS[p - 1], IMPACT_LEVELS[i - 1]));
  if (got !== addRiskLevel(p, i)) matrixOk = false;
}
check("Matriz 5×5 completa coincide con AddRisk", matrixOk, true);

console.log("\n== levelKeyOf / currentLevelKey ==");
const seed = { inherent_probability: "Frecuente (81-100%)", inherent_impact: "Mayor", inherent_level: "Intolerable" };
check("Inherente desde el puntaje", levelKeyOf(seed, "inherent"), "INTOLERABLE");
check("level_key almacenada manda", levelKeyOf({ ...seed, inherent_level_key: "HIGH" }), "HIGH");
check("level_key inválida se ignora", levelKeyOf({ ...seed, inherent_level_key: "X" }), "INTOLERABLE");
check("Columna inherent_score del trigger manda sobre el texto", levelKeyOf({ inherent_score: 6, inherent_level: "Alto" }), "LOW");
check("inherent_score vacío → se calcula del texto", levelKeyOf({ ...seed, inherent_score: null }), "INTOLERABLE");
check("Solo texto en inglés", levelKeyOf({ inherent_level: "High" }), "HIGH");
check("Solo texto en español minúsculas", levelKeyOf({ inherent_level: "medio" }), "MEDIUM");
check("Vacío → UNCLASSIFIED", [levelKeyOf({}), levelKeyOf(null), levelKeyFromText("")], ["UNCLASSIFIED", "UNCLASSIFIED", "UNCLASSIFIED"]);
check("Sin residual → vigente = inherente", currentLevelKey(seed), "INTOLERABLE");
check("Con residual → vigente = residual", currentLevelKey({
  ...seed, residual_probability: "Improbable (21-40%)", residual_impact: "Menor", residual_level: "Tolerable",
}), "TOLERABLE");
check("hasResidual solo con texto", hasResidual({ residual_level: "Bajo" }), true);
check("hasResidual vacío", hasResidual({ residual_level: "" }), false);

console.log("\n== Etiquetas ==");
check("Español por defecto", ["TOLERABLE", "LOW", "MEDIUM", "HIGH", "INTOLERABLE", "UNCLASSIFIED", "X"].map((k) => labelForLevelKey(k)),
  ["Tolerable", "Bajo", "Medio", "Alto", "Intolerable", "Sin clasificar", "Sin clasificar"]);
const tEn = (k) => ({ tolerable: "Tolerable", low: "Low", medium: "Medium", high: "High", intolerable: "Intolerable", unclassified: "Unclassified" })[k] || k;
check("Con t() en inglés", labelForLevelKey("HIGH", tEn), "High");

console.log("\n== Perspectivas ==");
check("Orden Balanced Scorecard", PERSPECTIVE_KEYS, ["financiera", "cliente", "competitiva", "equipo"]);
check("Etiquetas unificadas", PERSPECTIVES.map((p) => p.label),
  ["Finanzas", "Clientes", "Procesos y competitividad", "Equipo y talento"]);
check("lane = key", PERSPECTIVES.every((p) => p.lane === p.key), true);
check("3 ejemplos con threat_type válido", PERSPECTIVES.every((p) =>
  p.examples.length === 3 && p.examples.every((e) => e.description && ["Interna", "Externa"].includes(e.threat_type))), true);
check("isPerspectiveKey", [isPerspectiveKey("cliente"), isPerspectiveKey("ventas"), isPerspectiveKey(null)], [true, false, false]);
check("PERSPECTIVE_BY_KEY.equipo.label", PERSPECTIVE_BY_KEY.equipo.label, "Equipo y talento");
check("LANES mantiene la forma (key,title,desc,iconName,label,bubble)",
  LANES.every((l) => ["key", "title", "desc", "iconName", "label", "bubble"].every((f) => typeof l[f] === "string" && l[f])), true);
// Las clases de color deben ser las que usaba StrategicMap antes del cambio.
const OLD_LANE_CLASSES = {
  financiera: ["bg-accent/20 text-accent border-accent/40", "bg-accent/15 border-accent/45 hover:border-accent"],
  cliente: ["bg-rose-500/20 text-rose-500 border-rose-500/40", "bg-rose-500/15 border-rose-500/45 hover:border-rose-500"],
  competitiva: ["bg-blue-500/20 text-blue-500 border-blue-500/40", "bg-blue-500/15 border-blue-500/45 hover:border-blue-500"],
  equipo: ["bg-green-500/20 text-green-600 dark:text-green-500 border-green-500/40", "bg-green-500/15 border-green-500/45 hover:border-green-500"],
};
check("Clases Tailwind idénticas a las del mapa anterior",
  LANES.map((l) => [l.label, l.bubble]), PERSPECTIVE_KEYS.map((k) => OLD_LANE_CLASSES[k]));
check("Iconos lucide esperados", LANES.map((l) => l.iconName), ["Banknote", "Users", "Rocket", "HeartHandshake"]);

// finConcepts: cada clave debe existir en algún catálogo del módulo financiero.
const FIN_KEYS = new Set([
  SALES_SECTION,
  ...COST_CONCEPTS.map((c) => c.key),
  ...EXPENSE_CONCEPTS.map((c) => c.key),
  ...INCOME_INPUTS.map((c) => c.key),
  ...ALL_BALANCE_KEYS,
]);
const unknownFin = PERSPECTIVES.flatMap((p) => p.finConcepts.filter((k) => !FIN_KEYS.has(k)).map((k) => `${p.key}:${k}`));
check("finConcepts existen en finConfig", unknownFin, []);
// Y las claves de finConfig no se repiten entre catálogos (una clave = un concepto).
const allFin = [SALES_SECTION, ...COST_CONCEPTS, ...EXPENSE_CONCEPTS, ...INCOME_INPUTS].map((c) => c.key ?? c).concat(ALL_BALANCE_KEYS);
check("Claves de finConfig sin duplicados entre catálogos", allFin.length === new Set(allFin).size, true);

console.log("\n== Sugerencia por nombre de departamento ==");
const cases = [
  ["Ventas", "cliente"], ["Área Comercial", "cliente"], ["Marketing y Publicidad", "cliente"], ["Atención a Clientes", "cliente"],
  ["Finanzas", "financiera"], ["Contabilidad", "financiera"], ["Tesorería", "financiera"], ["Cobranza", "financiera"],
  ["Operaciones", "competitiva"], ["Producción", "competitiva"], ["TI", "competitiva"], ["Tecnología", "competitiva"],
  ["Sistemas", "competitiva"], ["Calidad", "competitiva"], ["Compras", "competitiva"], ["Logística", "competitiva"], ["Legal", "competitiva"],
  ["RH", "equipo"], ["Recursos Humanos", "equipo"], ["Capital Humano", "equipo"], ["Talento", "equipo"],
  ["Dirección General", null], ["Gestión", null], ["", null], [null, null],
];
check("Heurística de departamentos", cases.map(([n]) => suggestPerspectiveForDepartment(n)), cases.map(([, k]) => k));

console.log("\n== perspectiveFor con riesgos ==");
check("risk:<id> con perspectiva", perspectiveFor({ id: "risk:abc", perspective: "equipo" }), "equipo");
check("risk:<id> sin perspectiva → null", perspectiveFor({ id: "risk:abc" }), null);
check("risk:<id> con perspective_key de la tabla", perspectiveFor({ id: "risk:abc", perspective_key: "financiera" }), "financiera");
check("mkt sigue → cliente", perspectiveFor({ id: "mkt:precio" }), "cliente");
check("fin sigue → financiera", perspectiveFor({ id: "fin:liquidez" }), "financiera");
check("fin ventas_area_comercial → competitiva", perspectiveFor({ id: "fin:ventas_area_comercial" }), "competitiva");
check("opp costos_entrega → financiera", perspectiveFor({ id: "opp:costos_entrega" }), "financiera");
check("id vacío → cliente (como antes)", perspectiveFor({}), "cliente");

console.log(`\n${failures === 0 ? "TODO OK" : `${failures} FALLA(S)`}`);
process.exit(failures === 0 ? 0 : 1);
