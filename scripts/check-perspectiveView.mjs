// Prueba rápida de las ayudas puras de perspectivas (src/lib/perspectiveView.js).
// Mismo patrón que check-riskCalc.mjs: compara contra casos conocidos y
// termina con "TODO OK" (código 0) o "<n> FALLA(S)" (código 1).
// Correr con: node scripts/check-perspectiveView.mjs
import {
  UNASSIGNED,
  NO_DEPARTMENT,
  SORT_MODES,
  inherentScoreOf,
  residualScoreOf,
  isUnscored,
  isCriticalRisk,
  perspectiveOf,
  isUnassigned,
  perspectiveLabel,
  countByPerspective,
  migrationProgress,
  suggestionForDepartment,
  groupByDepartment,
  looseUnassigned,
  sortRisks,
  riskExportRow,
} from "../src/lib/perspectiveView.js";
import { PERSPECTIVE_KEYS } from "../src/config/perspectives.js";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${JSON.stringify(actual)}${ok ? "" : `  (esperado ${JSON.stringify(expected)})`}`);
};

console.log("== Constantes ==");
check("UNASSIGNED no es clave de perspectiva", PERSPECTIVE_KEYS.includes(UNASSIGNED), false);
check("NO_DEPARTMENT es un centinela no vacío", typeof NO_DEPARTMENT === "string" && NO_DEPARTMENT.length > 0, true);
check("SORT_MODES", SORT_MODES, ["recent", "scoreDesc", "scoreAsc"]);

console.log("\n== 1. Puntaje inherente ==");
const conScore = { inherent_score: 20 };
const calculado = { inherent_score: null, inherent_probability: "Frecuente (81-100%)", inherent_impact: "Mayor" };
const sinPuntaje = { inherent_score: 0, inherent_probability: "", inherent_impact: "" };
check("Columna del disparador manda", inherentScoreOf(conScore), 20);
check("Sin columna → se calcula prob × impacto", inherentScoreOf(calculado), 20);
check("0 y textos vacíos → null", inherentScoreOf(sinPuntaje), null);
check("null → null", inherentScoreOf(null), null);
check("Columna como texto '15' → 15", inherentScoreOf({ inherent_score: "15" }), 15);
check("Columna inválida pero prob/impacto válidos → recalcula", inherentScoreOf({ inherent_score: -3, inherent_probability: "Remoto (0-20%)", inherent_impact: "Menor" }), 2);
check("residualScoreOf columna", residualScoreOf({ residual_score: 6 }), 6);
check("residualScoreOf calculado", residualScoreOf({ residual_probability: "Ocasional (41-60%)", residual_impact: "Crítico" }), 9);
check("residualScoreOf null", residualScoreOf(null), null);

console.log("\n== 2. Sin puntaje y crítico ==");
check("isUnscored en los tres casos", [conScore, calculado, sinPuntaje].map(isUnscored), [false, false, true]);
check("isCriticalRisk 13 → true", isCriticalRisk({ inherent_score: 13 }), true);
check("isCriticalRisk 12 → false", isCriticalRisk({ inherent_score: 12 }), false);
check("isCriticalRisk sin puntaje → false", isCriticalRisk(sinPuntaje), false);
check("isCriticalRisk null → false", isCriticalRisk(null), false);

console.log("\n== 3. Perspectiva de un riesgo ==");
check("Clave desconocida → null", perspectiveOf({ perspective_key: "ventas" }), null);
check("Clave válida", perspectiveOf({ perspective_key: "cliente" }), "cliente");
check("Sin perspective_key → null", perspectiveOf({}), null);
check("Riesgo null → null", perspectiveOf(null), null);
check("isUnassigned({}) → true", isUnassigned({}), true);
check("isUnassigned con clave → false", isUnassigned({ perspective_key: "equipo" }), false);
check("perspectiveLabel cliente", perspectiveLabel("cliente"), "Clientes");
check("perspectiveLabel null", perspectiveLabel(null), null);
check("perspectiveLabel desconocida", perspectiveLabel("otra"), null);

console.log("\n== 4. Conteo por perspectiva ==");
const conteo = countByPerspective([
  { perspective_key: "cliente", inherent_score: 20 },
  { perspective_key: "cliente", inherent_score: 4 },
  { perspective_key: "equipo", inherent_score: null, inherent_probability: "", inherent_impact: "" },
  { perspective_key: null, inherent_score: 9 },
]);
check("cliente {2,1,0}", conteo.cliente, { total: 2, critical: 1, unscored: 0 });
check("equipo {1,0,1}", conteo.equipo, { total: 1, critical: 0, unscored: 1 });
check("unassigned {1,0,0}", conteo[UNASSIGNED], { total: 1, critical: 0, unscored: 0 });
check("financiera {0,0,0}", conteo.financiera, { total: 0, critical: 0, unscored: 0 });
check("competitiva {0,0,0}", conteo.competitiva, { total: 0, critical: 0, unscored: 0 });
check("Claves del conteo = 4 perspectivas + unassigned", Object.keys(conteo), [...PERSPECTIVE_KEYS, UNASSIGNED]);
check("Lista vacía → todo en cero", countByPerspective([]).cliente, { total: 0, critical: 0, unscored: 0 });
check("Lista null → no truena", countByPerspective(null)[UNASSIGNED], { total: 0, critical: 0, unscored: 0 });

console.log("\n== 5. Progreso de migración ==");
check("Sin riesgos → pct 100", migrationProgress([]), { total: 0, assigned: 0, unassigned: 0, pct: 100 });
check("3 riesgos, 1 sin asignar → 67%", migrationProgress([
  { perspective_key: "cliente" }, { perspective_key: "financiera" }, { perspective_key: null },
]), { total: 3, assigned: 2, unassigned: 1, pct: 67 });
check("Clave inválida cuenta como sin asignar", migrationProgress([{ perspective_key: "ventas" }]), { total: 1, assigned: 0, unassigned: 1, pct: 0 });
check("null → como lista vacía", migrationProgress(null), { total: 0, assigned: 0, unassigned: 0, pct: 100 });

console.log("\n== 6. Sugerencia por departamento ==");
check("Dirección General sin mapa → null", suggestionForDepartment({ name: "Dirección General", perspective_key: null }), null);
check("Ventas → cliente", suggestionForDepartment({ name: "Ventas" }), "cliente");
check("El mapa guardado manda", suggestionForDepartment({ name: "Ventas", perspective_key: "equipo" }), "equipo");
check("Mapa inválido → heurística", suggestionForDepartment({ name: "Contabilidad", perspective_key: "otra" }), "financiera");
check("Departamento null → null", suggestionForDepartment(null), null);

console.log("\n== 7. Filas del asistente ==");
const deptVentas = { id: "d-ventas", name: "Ventas", perspective_key: null };
const deptConta = { id: "d-conta", name: "Contabilidad", perspective_key: "cliente" };
const deptRH = { id: "d-rh", name: "Recursos Humanos", perspective_key: null };
const deptVacio = { id: "d-vacio", name: "Sin riesgos", perspective_key: null };
const deptDG = { id: "d-dg", name: "Dirección General", perspective_key: null };
const riesgos7 = [
  // Ventas: 1 pendiente
  { id: "r1", department_id: "d-ventas", perspective_key: null },
  { id: "r2", department_id: "d-ventas", perspective_key: "cliente" },
  // Contabilidad: mapa cliente, 3 riesgos en cliente (uno "a mano"), ninguno pendiente
  { id: "r3", department_id: "d-conta", perspective_key: "cliente" },
  { id: "r4", department_id: "d-conta", perspective_key: "cliente" },
  { id: "r5", department_id: "d-conta", perspective_key: "cliente" },
  // RH: sin pendientes, sin mapa → complete
  { id: "r6", department_id: "d-rh", perspective_key: "equipo" },
  // Dirección General: 3 pendientes (más que Ventas) y sin sugerencia
  { id: "r7", department_id: "d-dg", perspective_key: null },
  { id: "r8", department_id: "d-dg", perspective_key: null },
  { id: "r9", department_id: "d-dg", perspective_key: null },
  // Huérfano: su departamento no está en la lista → no genera fila
  { id: "r10", department_id: "d-borrado", perspective_key: null },
  // Sin departamento → no genera fila
  { id: "r11", department_id: null, perspective_key: null },
];
const filas = groupByDepartment(riesgos7, [deptVentas, deptConta, deptRH, deptVacio, deptDG]);
const byId = Object.fromEntries(filas.map((f) => [f.department.id, f]));
check("Orden: pending (más pendientes primero) → done → complete", filas.map((f) => f.department.id), ["d-dg", "d-ventas", "d-conta", "d-rh"]);
check("Departamento sin riesgos excluido", "d-vacio" in byId, false);
check("Huérfano no genera fila", "d-borrado" in byId, false);
check("Ventas pending con sugerencia cliente", {
  status: byId["d-ventas"].status, suggestion: byId["d-ventas"].suggestion,
  total: byId["d-ventas"].total, pendientes: byId["d-ventas"].unassigned.map((r) => r.id),
}, { status: "pending", suggestion: "cliente", total: 2, pendientes: ["r1"] });
check("Dirección General pending sin sugerencia", {
  status: byId["d-dg"].status, suggestion: byId["d-dg"].suggestion, pendientes: byId["d-dg"].unassigned.length,
}, { status: "pending", suggestion: null, pendientes: 3 });
check("Contabilidad done con assignedCount = 3 (incluye el manual)", {
  status: byId["d-conta"].status, assignedKey: byId["d-conta"].assignedKey,
  assignedCount: byId["d-conta"].assignedCount, suggestion: byId["d-conta"].suggestion,
}, { status: "done", assignedKey: "cliente", assignedCount: 3, suggestion: null });
check("RH complete sin botones", {
  status: byId["d-rh"].status, assignedKey: byId["d-rh"].assignedKey, assignedCount: byId["d-rh"].assignedCount,
}, { status: "complete", assignedKey: null, assignedCount: 0 });
// Mapa guardado pero riesgos en otra perspectiva → complete (nada que deshacer).
check("Mapa sin riesgos que coincidan → complete", groupByDepartment(
  [{ id: "x", department_id: "d1", perspective_key: "equipo" }],
  [{ id: "d1", name: "Algo", perspective_key: "cliente" }]
)[0].status, "complete");
check("Empate de pendientes → orden alfabético (es)", groupByDepartment(
  [
    { id: "a", department_id: "d-z", perspective_key: null },
    { id: "b", department_id: "d-a", perspective_key: null },
  ],
  [{ id: "d-z", name: "Zapatería" }, { id: "d-a", name: "Almacén" }]
).map((f) => f.department.name), ["Almacén", "Zapatería"]);
check("Listas vacías → sin filas", groupByDepartment([], []), []);
check("null → sin filas", groupByDepartment(null, null), []);

console.log("\n== 8. Riesgos sueltos (sin departamento o huérfanos) ==");
const sueltos = looseUnassigned([
  { id: "s1", department_id: null, perspective_key: null },
  { id: "s2", department_id: "x", perspective_key: null },
  { id: "s3", department_id: "x", perspective_key: "cliente" },
  { id: "s4", department_id: "d-ventas", perspective_key: null },
  { id: "s5", department_id: undefined, perspective_key: "equipo" },
  { id: "s6", department_id: "", perspective_key: null },
], [deptVentas]);
check("Incluye sin departamento y huérfanos sin perspectiva", sueltos.map((r) => r.id), ["s1", "s2", "s6"]);
check("Sin departamentos → todos los sin perspectiva son sueltos", looseUnassigned(
  [{ id: "a", department_id: "d1", perspective_key: null }, { id: "b", department_id: "d1", perspective_key: "cliente" }],
  []
).map((r) => r.id), ["a"]);
check("null → vacío", looseUnassigned(null, null), []);

console.log("\n== 9. Orden de listas ==");
const lista9 = [
  { id: "a", inherent_score: 13, created_date: "2026-01-02T00:00:00Z" },
  { id: "b", inherent_score: null, inherent_probability: "", inherent_impact: "", created_date: "2026-01-05T00:00:00Z" },
  { id: "c", inherent_score: 4, created_date: "2026-01-03T00:00:00Z" },
  { id: "d", inherent_score: 20, created_at: "2026-01-01T00:00:00Z" },
];
check("scoreDesc → 20, 13, 4, null al final", sortRisks(lista9, "scoreDesc").map((r) => r.id), ["d", "a", "c", "b"]);
check("scoreAsc → 4, 13, 20, null al final", sortRisks(lista9, "scoreAsc").map((r) => r.id), ["c", "a", "d", "b"]);
check("recent → fecha descendente (created_date, respaldo created_at)", sortRisks(lista9, "recent").map((r) => r.id), ["b", "c", "a", "d"]);
check("Modo por defecto = recent", sortRisks(lista9).map((r) => r.id), ["b", "c", "a", "d"]);
check("Empate de puntaje → más reciente primero", sortRisks([
  { id: "viejo", inherent_score: 9, created_date: "2026-01-01T00:00:00Z" },
  { id: "nuevo", inherent_score: 9, created_date: "2026-02-01T00:00:00Z" },
], "scoreDesc").map((r) => r.id), ["nuevo", "viejo"]);
check("Varios sin puntaje → entre ellos por fecha", sortRisks([
  { id: "n1", created_date: "2026-01-01T00:00:00Z" },
  { id: "n2", created_date: "2026-03-01T00:00:00Z" },
  { id: "p", inherent_score: 1, created_date: "2025-01-01T00:00:00Z" },
], "scoreAsc").map((r) => r.id), ["p", "n2", "n1"]);
check("created_date manda sobre created_at", sortRisks([
  { id: "x", created_date: "2026-01-01T00:00:00Z", created_at: "2026-12-31T00:00:00Z" },
  { id: "y", created_date: "2026-06-01T00:00:00Z", created_at: "2025-01-01T00:00:00Z" },
], "recent").map((r) => r.id), ["y", "x"]);
check("No muta la lista original", (() => { const l = [{ id: 1, inherent_score: 1 }, { id: 2, inherent_score: 5 }]; sortRisks(l, "scoreDesc"); return l.map((r) => r.id); })(), [1, 2]);
check("null → vacío", sortRisks(null, "scoreDesc"), []);

console.log("\n== 10. Fila del Excel ==");
const columnas = [
  "Perspectiva", "Departamento", "Tipo de amenaza", "Descripción",
  "Prob. inherente", "Impacto inherente", "Nivel inherente", "Puntaje inherente",
  "Estrategia",
  "Mitigante 1", "Impacto mitigante 1", "Tipo Control 1", "Grado Control 1",
  "Mitigante 2", "Impacto mitigante 2", "Tipo Control 2", "Grado Control 2",
  "Mitigante 3", "Impacto mitigante 3", "Tipo Control 3", "Grado Control 3",
  "Prob. residual", "Impacto residual", "Nivel residual", "Fecha creación",
];
check("25 columnas", columnas.length, 25);
check("Claves y orden exactos", Object.keys(riskExportRow({})), columnas);
check("Sin perspectiva → 'Sin asignar'", riskExportRow({ perspective_key: null })["Perspectiva"], "Sin asignar");
check("Con perspectiva → nombre del catálogo", riskExportRow({ perspective_key: "financiera" })["Perspectiva"], "Finanzas");
check("Sin puntaje → 'Sin puntaje'", riskExportRow({ inherent_score: null, inherent_probability: "", inherent_impact: "" })["Puntaje inherente"], "Sin puntaje");
check("Con puntaje → número", riskExportRow({ inherent_score: 16 })["Puntaje inherente"], 16);
check("Departamento por mapa de nombres", riskExportRow({ department_id: "d1" }, { d1: "Ventas" })["Departamento"], "Ventas");
check("Departamento ausente del mapa → ''", riskExportRow({ department_id: "d-borrado" }, { d1: "Ventas" })["Departamento"], "");
check("Fecha creación prefiere created_at", riskExportRow({ created_at: "A", created_date: "B" })["Fecha creación"], "A");
check("Fecha creación respaldo created_date", riskExportRow({ created_date: "B" })["Fecha creación"], "B");
check("Campos vacíos → ''", riskExportRow({})["Descripción"], "");

console.log(`\n${failures === 0 ? "TODO OK" : `${failures} FALLA(S)`}`);
process.exit(failures === 0 ? 0 : 1);
