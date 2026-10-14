// Prueba rápida del motor "riesgos críticos → planeación" (Fase 2) en
// src/config/strategicCalc.js y de las plantillas de strategicCatalog.js.
// También demuestra que strategicCalc.js importa desde Node ESM (sin React).
// Correr con: node scripts/check-strategicCalc.mjs
import {
  // regresión
  collectStrategies,
  scoreFor,
  priorityFor,
  perspectiveFor,
  buildFoda,
  // Fase 2
  RISK_ACKNOWLEDGED,
  RISK_EXPECTED_RESULT,
  FOCUS_LIMIT,
  riskObjectiveId,
  isRiskObjectiveId,
  riskIdFromObjectiveId,
  controlSourceKey,
  templateSourceKey,
  controlIndexFromSourceKey,
  localISODate,
  addDays,
  daysFromTo,
  suggestedDeadline,
  riskControls,
  riskObjectivesFrom,
  templatesFor,
  initiativeFromControl,
  initiativeFromTemplate,
  riskInitiativesOf,
  existingForSource,
  orphanLabelFor,
  riskInitiativeWarnings,
  summarizeRiskWarnings,
  focusItems,
  mergeFodaWithRisks,
  riskCountIn,
  objectivesById,
} from "../src/config/strategicCalc.js";
import {
  RISK_INITIATIVE_TEMPLATES,
  DEFAULT_RISK_TEMPLATE_STRATEGY,
  templatesForStrategy,
} from "../src/config/strategicCatalog.js";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} → ${JSON.stringify(actual)}${ok ? "" : `  (esperado ${JSON.stringify(expected)})`}`);
};

const TODAY = "2026-10-14";

// ---------- Fixtures ----------
// Riesgo mínimo: puntaje por probabilidad × impacto (como calcula el trigger).
const risk = (id, description, probability, impact, extra = {}) => ({
  id,
  description,
  inherent_probability: probability,
  inherent_impact: impact,
  risk_strategy: "Reducir",
  threat_type: "Externa",
  perspective_key: "cliente",
  ...extra,
});

const P = { remoto: "Remoto (0-20%)", improbable: "Improbable (21-40%)", ocasional: "Ocasional (41-60%)", probable: "Probable (61-80%)", frecuente: "Frecuente (81-100%)" };
const I = { insig: "Insignificante", menor: "Menor", critico: "Crítico", mayor: "Mayor", catastrofico: "Catastrófico" };

// Los 5 críticos del seed sandbox (H11) + R-A + R-B + 2 no críticos.
const S1 = risk("s1", "Pérdida del cliente principal por incumplimiento en entregas", P.probable, I.catastrofico, {
  inherent_score: 20, perspective_key: "cliente", threat_type: "Externa", risk_strategy: "Reducir",
  mitigant_1: "Diversificar la cartera de clientes", mitigant_impact_1: "Mitiga el impacto",
  residual_probability: P.ocasional, residual_impact: I.mayor, // 12 → Medio
});
const S2 = risk("s2", "Errores en cotizaciones que generan pérdidas", P.probable, I.mayor, {
  inherent_score: 16, perspective_key: "cliente", threat_type: "Interna", risk_strategy: "Reducir",
  mitigant_1: "Revisión de cotizaciones por un segundo responsable", mitigant_impact_1: "Mitiga la probabilidad",
  control_type_1: "Control Preventivo", control_documented_1: "Sí", process_type_1: "Automatizado",
  control_evidence_1: "Sí", control_responsible_1: "Sí", control_frequency_1: "Sí", // Fuerte
  residual_probability: P.improbable, residual_impact: I.critico, // 6 → Bajo
});
const S3 = risk("s3", "Interrupción de la cadena de suministro", P.probable, I.mayor, {
  inherent_score: 16, perspective_key: "competitiva", threat_type: "Externa", risk_strategy: "Reducir",
  mitigant_1: "Inventario de seguridad", mitigant_impact_1: "Mitiga el impacto", control_grade_1: "Débil",
  residual_level: "Alto",
});
const S4 = risk("s4", "Ataque de ransomware", P.probable, I.catastrofico, {
  inherent_score: 20, perspective_key: "competitiva", threat_type: "Externa", risk_strategy: "Transferir",
  mitigant_1: "Póliza de ciberseguridad y respaldos", mitigant_impact_1: "Mitiga el impacto",
  residual_probability: P.improbable, residual_impact: I.critico, // 6 → Bajo
  residual_level_key: "LOW",
});
const S5 = risk("s5", "Pérdida cambiaria por deuda en dólares", P.probable, I.catastrofico, {
  inherent_score: 20, perspective_key: "financiera", threat_type: "Externa", risk_strategy: "Transferir",
});
const RA = risk("ra", "Demanda laboral de un exempleado", P.probable, I.mayor, {
  inherent_score: 16, perspective_key: "equipo", threat_type: "Interna", risk_strategy: "Aceptar",
});
const RB = risk("rb", "Falta de sucesor para el puesto de dirección", P.frecuente, I.critico, {
  inherent_score: 15, perspective_key: null, threat_type: "Interna", risk_strategy: "Reducir",
});
const RMEDIO = risk("rm", "Retrasos en entregas", P.ocasional, I.mayor, { inherent_score: 12 });
const RTOL = risk("rt", "Indisponibilidad breve del sitio", P.remoto, I.mayor, { inherent_score: 4, risk_strategy: "Aceptar" });
const SEED = [S1, S2, S3, S4, S5, RA, RB, RMEDIO, RTOL];

// ---------- Regresión ----------
console.log("== Regresión: exportaciones existentes ==");
check("collectStrategies exportada", typeof collectStrategies, "function");
check("scoreFor exportada", typeof scoreFor, "function");
check("priorityFor exportada", typeof priorityFor, "function");
check("perspectiveFor exportada", typeof perspectiveFor, "function");
check("buildFoda exportada", typeof buildFoda, "function");
check("perspectiveFor risk con perspectiva", perspectiveFor({ id: "risk:a", perspective: "equipo" }), "equipo");
check("perspectiveFor risk sin perspectiva", perspectiveFor({ id: "risk:a" }), null);
check("perspectiveFor {} → cliente", perspectiveFor({}), "cliente");
check("collectStrategies({}) vacío", collectStrategies({}), { weaknesses: [], strengths: [] });
check("priorityFor(1.2) Alta", priorityFor(1.2), "Alta");

// ---------- Identificadores ----------
console.log("\n== Identificadores ==");
check("riskObjectiveId", riskObjectiveId("abc"), "risk:abc");
check("isRiskObjectiveId true", isRiskObjectiveId("risk:abc"), true);
check("isRiskObjectiveId false", isRiskObjectiveId("mkt:abc"), false);
check("isRiskObjectiveId null", isRiskObjectiveId(null), false);
check("riskIdFromObjectiveId", riskIdFromObjectiveId("risk:abc"), "abc");
check("riskIdFromObjectiveId otro → null", riskIdFromObjectiveId("opp:x"), null);
check("controlSourceKey", controlSourceKey("risk:a", 1), "risk:a:m1");
check("templateSourceKey", templateSourceKey("risk:a", "control"), "risk:a:tpl:control");
check("controlIndexFromSourceKey m2 → 2", controlIndexFromSourceKey("risk:a", "risk:a:m2"), 2);
check("controlIndexFromSourceKey tpl → null", controlIndexFromSourceKey("risk:a", "risk:a:tpl:senal"), null);
check("controlIndexFromSourceKey otro objetivo → null", controlIndexFromSourceKey("risk:a", "risk:b:m1"), null);
check("controlIndexFromSourceKey null → null", controlIndexFromSourceKey("risk:a", null), null);

// ---------- Fechas ----------
console.log("\n== Fechas ==");
check("localISODate formato", /^\d{4}-\d{2}-\d{2}$/.test(localISODate()), true);
check("localISODate hora local", localISODate(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
check("addDays +30", addDays("2026-10-14", 30), "2026-11-13");
check("addDays +60 cruza año", addDays("2026-12-15", 60), "2027-02-13");
check("addDays inválida → null", addDays("x", 1), null);
check("daysFromTo mismo día → 0", daysFromTo("2026-10-14", "2026-10-14"), 0);
check("daysFromTo negativo", daysFromTo("2026-10-14", "2026-10-04"), -10);
check("daysFromTo con hora → 60", daysFromTo("2026-10-14", "2026-12-13T00:00:00Z"), 60);
check("daysFromTo inválida → null", daysFromTo("2026-10-14", ""), null);
check("daysFromTo null → null", daysFromTo("2026-10-14", null), null);
check("suggestedDeadline INTOLERABLE", suggestedDeadline("INTOLERABLE", TODAY), "2026-11-13");
check("suggestedDeadline HIGH", suggestedDeadline("HIGH", TODAY), "2026-12-13");
check("suggestedDeadline MEDIUM → null", suggestedDeadline("MEDIUM", TODAY), null);
check("suggestedDeadline null → null", suggestedDeadline(null, TODAY), null);

// ---------- Controles ----------
console.log("\n== riskControls ==");
const withGaps = { mitigant_1: " Control A ", mitigant_2: "   ", mitigant_3: "Control C", mitigant_impact_3: "Mitiga el impacto", control_responsible_1: "No" };
check("mitigant 1 y 3 (2 vacío) → n [1,3]", riskControls(withGaps).map((c) => c.n), [1, 3]);
check("texto recortado", riskControls(withGaps)[0].text, "Control A");
check("impact null si no viene", riskControls(withGaps)[0].impact, null);
check("impact del 3", riskControls(withGaps)[1].impact, "Mitiga el impacto");
check("control_responsible No → false", riskControls(withGaps)[0].hasResponsible, false);
check("grade null si faltan campos", riskControls(withGaps)[0].grade, null);
check("sin mitigantes → []", riskControls({ description: "x" }), []);
check("null → []", riskControls(null), []);
check("grade calculado (Fuerte) cuando control_grade_1 vacío", riskControls(S2)[0].grade, "Fuerte");
check("hasResponsible Sí → true", riskControls(S2)[0].hasResponsible, true);
check("control_grade guardado manda", riskControls(S3)[0].grade, "Débil");

// ---------- Objetivos ----------
console.log("\n== riskObjectivesFrom ==");
check("MEDIUM 12 excluido", riskObjectivesFrom([RMEDIO]).length, 0);
check("13 incluido como HIGH", riskObjectivesFrom([risk("x", "d", P.frecuente, I.critico, { inherent_score: 13 })])[0].level, "HIGH");
const sinPersp = riskObjectivesFrom([risk("x", "d", P.probable, I.mayor, { perspective_key: null })])[0];
check("sin perspectiva → null/null", [sinPersp.perspective, sinPersp.perspectiveLabel], [null, null]);
const perspMala = riskObjectivesFrom([risk("x", "d", P.probable, I.mayor, { perspective_key: "ventas" })])[0];
check("perspective_key 'ventas' → null", [perspMala.perspective, perspMala.perspectiveLabel], [null, null]);
check("sin controles → []", riskObjectivesFrom([S5])[0].controls, []);
const acc = (decisions) => riskObjectivesFrom([RA], decisions)[0];
check("Aceptar sin decisión → accepted true, acknowledged false", [acc({ objectives: {} }).accepted, acc({ objectives: {} }).acknowledged], [true, false]);
check("Aceptar acknowledged → true", acc({ objectives: { ra: RISK_ACKNOWLEDGED } }).acknowledged, true);
check("Aceptar valor 'x' → false", acc({ objectives: { ra: "x" } }).acknowledged, false);
check("decisions undefined → false", acc(undefined).acknowledged, false);
const s4o = riskObjectivesFrom([S4])[0];
check("residual Bajo con inherente INTOLERABLE entra", [s4o.level, s4o.residual, s4o.residualLabel], ["INTOLERABLE", "LOW", "Bajo"]);
check("S5 sin residual → null/null", [riskObjectivesFrom([S5])[0].residual, riskObjectivesFrom([S5])[0].residualLabel], [null, null]);
const orden = riskObjectivesFrom([
  risk("h16", "a", P.probable, I.mayor, { inherent_score: 16 }),
  risk("i20", "b", P.probable, I.catastrofico, { inherent_score: 20 }),
  risk("h15", "c", P.frecuente, I.critico, { inherent_score: 15 }),
  risk("i25", "d", P.frecuente, I.catastrofico, { inherent_score: 25 }),
]).map((o) => o.riskId);
check("orden INT desc, luego HIGH desc", orden, ["i25", "i20", "h16", "h15"]);
const vacio = riskObjectivesFrom([risk("x", "   ", P.probable, I.mayor, { risk_strategy: "Evitar" })])[0];
check("descripción vacía → 'Riesgo sin descripción'", vacio.label, "Riesgo sin descripción");
check("risk_strategy fuera de catálogo → null, accepted false", [vacio.strategy, vacio.accepted], [null, false]);
check("[] → []", riskObjectivesFrom([], {}), []);
check("undefined → []", riskObjectivesFrom(undefined, {}), []);
check("score desde probabilidad × impacto si no hay inherent_score", riskObjectivesFrom([risk("x", "d", P.probable, I.mayor)])[0].score, 16);
check("threat_type raro → null", riskObjectivesFrom([risk("x", "d", P.probable, I.mayor, { threat_type: "Mixta" })])[0].threatType, null);
const s1o = riskObjectivesFrom([S1])[0];
check("campos del objetivo", [s1o.id, s1o.riskId, s1o.source, s1o.priority, s1o.perspective, s1o.perspectiveLabel, s1o.levelLabel, s1o.score, s1o.strategy, s1o.threatType, s1o.residual, s1o.residualLabel],
  ["risk:s1", "s1", "risk", "Alta", "cliente", "Clientes", "Intolerable", 20, "Reducir", "Externa", "MEDIUM", "Medio"]);

// Fixture del seed completo (H11)
console.log("\n== Fixture del seed: 5 críticos + R-A + R-B ==");
const OBJ = riskObjectivesFrom(SEED, { objectives: {} });
check("7 objetivos", OBJ.length, 7);
check("orden INT (entrada) → HIGH (16,16,16,15)", OBJ.map((o) => o.riskId), ["s1", "s4", "s5", "s2", "s3", "ra", "rb"]);
check("niveles", OBJ.map((o) => o.score), [20, 20, 20, 16, 16, 16, 15]);
const byId = objectivesById(OBJ);
check("objectivesById", Object.keys(byId).length, 7);
check("objectivesById([]) → {}", objectivesById(undefined), {});
const EMPTY_FODA = { fortalezas: [], debilidades: [], oportunidades: [], amenazas: [] };
const fodaSeed = mergeFodaWithRisks(EMPTY_FODA, OBJ);
check("FODA vacío + 7 → debilidades 3 (Interna)", fodaSeed.debilidades.map((d) => d.riskId), ["s2", "ra", "rb"]);
check("FODA vacío + 7 → amenazas 4", fodaSeed.amenazas.map((d) => d.riskId), ["s1", "s4", "s5", "s3"]);

// ---------- Plantillas ----------
console.log("\n== Plantillas ==");
check("3 estrategias", Object.keys(RISK_INITIATIVE_TEMPLATES).sort(), ["Aceptar", "Reducir", "Transferir"]);
Object.entries(RISK_INITIATIVE_TEMPLATES).forEach(([strategy, list]) => {
  check(`${strategy}: 3 plantillas`, list.length, 3);
  check(`${strategy}: claves únicas`, new Set(list.map((t) => t.key)).size, 3);
  check(`${strategy}: campos no vacíos`, list.every((t) => ["key", "title", "expected_result", "kpi"].every((f) => String(t[f] || "").trim() !== "")), true);
});
check("Aceptar[0].key === senal", templatesForStrategy("Aceptar")[0].key, "senal");
check("templatesForStrategy(undefined) = Reducir", templatesForStrategy(undefined), RISK_INITIATIVE_TEMPLATES.Reducir);
check("DEFAULT_RISK_TEMPLATE_STRATEGY", DEFAULT_RISK_TEMPLATE_STRATEGY, "Reducir");
check("templatesFor({strategy:'Transferir'})", templatesFor({ strategy: "Transferir" }).map((t) => t.key), ["poliza", "clausulas", "tercero"]);
check("templatesFor({strategy:null}) → Reducir", templatesFor({ strategy: null }).map((t) => t.key), ["control", "capacitar", "alerta"]);
check("templatesFor(undefined) → Reducir", templatesFor(undefined).map((t) => t.key), ["control", "capacitar", "alerta"]);

// ---------- Iniciativas sugeridas ----------
console.log("\n== initiativeFromControl / initiativeFromTemplate ==");
const intCliente = riskObjectivesFrom([risk("rid", "Riesgo X", P.probable, I.catastrofico, {
  inherent_score: 20, perspective_key: "cliente", mitigant_1: "Uno", mitigant_2: "Dos", control_responsible_2: "No",
})])[0];
const fromCtrl = initiativeFromControl(intCliente, intCliente.controls[1], TODAY, 3);
check("control n=2 → fila", fromCtrl, {
  strategy_id: "risk:rid", strategy_label: "Riesgo X", area: "Clientes", owner: null, start_date: TODAY,
  end_date: "2026-11-13", budget: null, steps: null, position: 3, source_key: "risk:rid:m2", title: "Dos",
  expected_result: "Bajar el riesgo a nivel Medio o menor", kpi: null,
});
const highAccept = riskObjectivesFrom([risk("rid2", "Riesgo Y", P.probable, I.mayor, { inherent_score: 16, perspective_key: null, risk_strategy: "Aceptar" })])[0];
const senal = templatesFor(highAccept)[0];
const fromTpl = initiativeFromTemplate(highAccept, senal, TODAY);
check("plantilla senal → source_key", fromTpl.source_key, "risk:rid2:tpl:senal");
check("plantilla → area null", fromTpl.area, null);
check("plantilla HIGH → end_date hoy+60", fromTpl.end_date, "2026-12-13");
check("plantilla → expected_result de la plantilla", fromTpl.expected_result, senal.expected_result);
check("plantilla → kpi de la plantilla", fromTpl.kpi, senal.kpi);
check("plantilla → title", fromTpl.title, senal.title);
check("plantilla → position 0 por defecto", fromTpl.position, 0);
check("control de un Aceptar → expected_result accept", initiativeFromControl(highAccept, { n: 1, text: "c" }, TODAY).expected_result, RISK_EXPECTED_RESULT.accept);

// ---------- Iniciativas de un objetivo ----------
console.log("\n== riskInitiativesOf / existingForSource / orphanLabelFor ==");
const INITS = [
  { id: "i1", strategy_id: "risk:a", source_key: "risk:a:m1", strategy_label: "A" },
  { id: "i2", strategy_id: "risk:b", source_key: null, strategy_label: null },
  { id: "i3", strategy_id: "opp:x", source_key: null, strategy_label: null },
];
check("riskInitiativesOf", riskInitiativesOf("risk:a", INITS).map((i) => i.id), ["i1"]);
check("riskInitiativesOf undefined → []", riskInitiativesOf("risk:a", undefined), []);
check("existingForSource creada → fila", existingForSource(INITS, "risk:a:m1")?.id, "i1");
check("existingForSource sin ella → null", existingForSource(INITS, "risk:a:m2"), null);
check("orphanLabelFor → 'X'", orphanLabelFor([{ strategy_label: null }, { strategy_label: "X" }]), "X");
check("orphanLabelFor todas null → null", orphanLabelFor([{ strategy_label: null }, { strategy_label: "  " }]), null);

// ---------- Avisos ----------
console.log("\n== riskInitiativeWarnings ==");
const objReducir = (id, extra = {}) => riskObjectivesFrom([risk(id, `R ${id}`, P.probable, I.catastrofico, { inherent_score: 20, ...extra })])[0];
const objHigh = (id, extra = {}) => riskObjectivesFrom([risk(id, `R ${id}`, P.probable, I.mayor, { inherent_score: 16, ...extra })])[0];
const types = (ws) => ws.map((w) => w.type);
const init = (id, strategy_id, extra = {}) => ({ id, strategy_id, title: `T ${id}`, owner: "Ana", end_date: null, source_key: null, ...extra });

// 1. no-plan
const o1 = objReducir("o1");
let ws = riskInitiativeWarnings([o1], [], TODAY);
check("1. sin iniciativas y sin controles → no-plan controlsCount 0", [types(ws), ws[0].controlsCount], [["no-plan"], 0]);
check("1. mensaje sin controles", ws[0].message, '"R o1" no tiene ninguna iniciativa. Elige una sugerencia para empezar.');
const o1c = objReducir("o1c", { mitigant_1: "a", mitigant_2: "b" });
ws = riskInitiativeWarnings([o1c], [], TODAY);
check("1. con 2 controles → mensaje", ws[0].message, '"R o1c" tiene 2 control(es) en tu matriz, pero ninguno está en tu plan. Conviértelos con un clic.');
check("1. controlsCount 2", ws[0].controlsCount, 2);
check("1. campos no-plan", [ws[0].objectiveId, ws[0].riskId, ws[0].label], ["risk:o1c", "o1c", "R o1c"]);
ws = riskInitiativeWarnings([o1c], [init("m1", "risk:o1c")], TODAY);
check("1. con 1 iniciativa manual → sin no-plan", types(ws).includes("no-plan"), false);

// 2. accepted-unconfirmed
const oAcc = objHigh("oa", { risk_strategy: "Aceptar" });
ws = riskInitiativeWarnings([oAcc], [], TODAY);
check("2. Aceptar sin confirmar sin iniciativas → solo accepted-unconfirmed", types(ws), ["accepted-unconfirmed"]);
check("2. initiativeCount 0", ws[0].initiativeCount, 0);
check("2. mensaje", ws[0].message, '"R oa" es un riesgo crítico que decidiste aceptar: necesita una señal de alerta y un plan de reacción. Confírmalo cuando los tengas.');
ws = riskInitiativeWarnings([oAcc], [init("a1", "risk:oa"), init("a2", "risk:oa")], TODAY);
check("2. con 2 iniciativas → initiativeCount 2", [types(ws), ws[0].initiativeCount], [["accepted-unconfirmed"], 2]);
const oAccOk = riskObjectivesFrom([risk("oa", "R oa", P.probable, I.mayor, { inherent_score: 16, risk_strategy: "Aceptar" })], { objectives: { oa: RISK_ACKNOWLEDGED } })[0];
check("2. confirmado → []", riskInitiativeWarnings([oAccOk], [], TODAY), []);

// 3. far
const oInt = objReducir("oi");
const oHi = objHigh("oh");
const farOf = (obj, days) => riskInitiativeWarnings([obj], [init("f1", obj.id, { end_date: addDays(TODAY, days) })], TODAY).filter((w) => w.type === "far");
ws = farOf(oInt, 61);
check("3. INTOLERABLE hoy+61 → far 61/60", [ws.length, ws[0]?.days, ws[0]?.limit, ws[0]?.levelLabel], [1, 61, 60, "Intolerable"]);
check("3. mensaje far", ws[0].message, '"T f1" termina en 61 días. Para un riesgo intolerable se sugiere cerrarla en 60 días o menos.');
check("3. INTOLERABLE hoy+60 → nada", farOf(oInt, 60).length, 0);
check("3. HIGH hoy+121 → far", farOf(oHi, 121).length, 1);
check("3. HIGH mensaje 'alto'", farOf(oHi, 121)[0].message.includes("riesgo alto se sugiere cerrarla en 120 días"), true);
check("3. HIGH hoy+120 → nada", farOf(oHi, 120).length, 0);
check("3. vencida hoy−5 → nada", farOf(oInt, -5).length, 0);
check("3. end_date vacía → nada", riskInitiativeWarnings([oInt], [init("f1", oInt.id, { end_date: "" })], TODAY).filter((w) => w.type === "far").length, 0);

// 4. no-owner
const ownerOf = (obj, inits) => riskInitiativeWarnings([obj], inits, TODAY).filter((w) => w.type === "no-owner");
ws = ownerOf(oInt, [init("n1", oInt.id, { owner: "" })]);
check("4. owner '' → no-owner responsibleInMatrix false", [ws.length, ws[0]?.responsibleInMatrix], [1, false]);
check("4. mensaje corto", ws[0].message, '"T n1" no tiene responsable.');
check("4. owner '  Ana ' → nada", ownerOf(oInt, [init("n1", oInt.id, { owner: "  Ana " })]).length, 0);
const oResp = objReducir("or", { mitigant_1: "Control", control_responsible_1: "Sí" });
ws = ownerOf(oResp, [init("n1", oResp.id, { owner: "", source_key: "risk:or:m1" })]);
check("4. control con responsable en matriz → responsibleInMatrix true", ws[0].responsibleInMatrix, true);
check("4. mensaje largo", ws[0].message, '"T n1" no tiene responsable. En la matriz indicaste que este control sí tiene uno: escribe su nombre.');
const oNoResp = objReducir("on", { mitigant_1: "Control", control_responsible_1: "No" });
ws = ownerOf(oNoResp, [init("n1", oNoResp.id, { owner: "", source_key: "risk:on:m1" })]);
check("4. hasResponsible false → mensaje corto", [ws[0].responsibleInMatrix, ws[0].message], [false, '"T n1" no tiene responsable.']);
ws = ownerOf(oResp, [init("n1", oResp.id, { owner: "", source_key: "risk:or:tpl:control" })]);
check("4. plantilla → false", ws[0].responsibleInMatrix, false);
check("4. título vacío → 'Iniciativa sin nombre'", ownerOf(oInt, [init("n1", oInt.id, { owner: "", title: "  " })])[0].message, '"Iniciativa sin nombre" no tiene responsable.');

// 5. concentración
const oc = objReducir("oc");
const conc = (owners) => riskInitiativeWarnings([oc], owners.map((o, i) => init(`c${i}`, oc.id, { owner: o })), TODAY).filter((w) => w.type === "concentration");
ws = conc(["Ana", "Ana", "Ana"]);
check("5. 1 responsable con 3 → concentration 3 de 3", [ws.length, ws[0]?.count, ws[0]?.total, ws[0]?.owner], [1, 3, 3, "Ana"]);
check("5. mensaje", ws[0].message, "Ana concentra 3 de 3 iniciativas de riesgo. Reparte el trabajo si puedes.");
check("5. 2 y 1 → concentration 2 de 3", conc(["Ana", "Luis", "Ana"]).map((w) => [w.count, w.total]), [[2, 3]]);
check("5. 1 y 1 → nada (total 2 < 3)", conc(["Ana", "Luis"]).length, 0);
check("5. 2,1,1 → nada", conc(["Ana", "Ana", "Luis", "Pedro"]).length, 0);
check("5. 3,1,1 → concentration 3 de 5", conc(["Ana", "Ana", "Ana", "Luis", "Pedro"]).map((w) => [w.count, w.total]), [[3, 5]]);
check("5. 'Ana' y 'ana ' misma persona", conc(["Ana", "ana ", " ANA"]).map((w) => [w.owner, w.count]), [["Ana", 3]]);
check("5. empate 2-2 → nada", conc(["Ana", "Ana", "Luis", "Luis"]).length, 0);

// 6. huérfanas
check("6. strategy_id fuera de objectives → ignorada", riskInitiativeWarnings([oc], [init("z", "risk:otro", { owner: "", end_date: addDays(TODAY, 200) })], TODAY).filter((w) => w.type !== "no-plan"), []);
// 7. sin objetivos
check("7. objectives [] → []", riskInitiativeWarnings([], [init("z", "risk:otro", { owner: "" })], TODAY), []);

// Orden de salida
const oA = objReducir("oa1", { mitigant_1: "x" });
const oB = objHigh("ob1", { risk_strategy: "Aceptar" });
ws = riskInitiativeWarnings([oA, oB], [
  init("b1", oB.id, { owner: "", end_date: addDays(TODAY, 150) }),
  init("b2", oB.id, { owner: "Ana" }),
  init("b3", oB.id, { owner: "Ana" }),
  init("b4", oB.id, { owner: "Ana" }),
], TODAY);
check("orden: no-plan(A) → accepted(B) → far,no-owner(b1) → concentration", types(ws), ["no-plan", "accepted-unconfirmed", "far", "no-owner", "concentration"]);

// ---------- summarizeRiskWarnings ----------
console.log("\n== summarizeRiskWarnings ==");
const mix = [
  { type: "no-plan", riskId: "r1", objectiveId: "risk:r1" },
  { type: "far", initiativeId: "i9", riskId: "r2" },
  { type: "concentration", message: "Ana concentra 3 de 3 iniciativas de riesgo. Reparte el trabajo si puedes." },
  { type: "no-plan", riskId: "r3", objectiveId: "risk:r3" },
];
let lines = summarizeRiskWarnings(mix);
check("mezcla → 3 líneas en orden", lines.map((l) => l.type), ["no-plan", "far", "concentration"]);
check("labels", lines.map((l) => l.label), ["2 riesgo(s) crítico(s) sin plan de acción", "1 iniciativa(s) de riesgo programada(s) demasiado lejos", "Ana concentra 3 de 3 iniciativas de riesgo. Reparte el trabajo si puedes."]);
check("hashes", lines.map((l) => l.hash), ["", "#initiative-i9", ""]);
check("href", lines.map((l) => l.href), ["StrategicInitiatives", "StrategicInitiatives", "StrategicInitiatives"]);
check("counts", lines.map((l) => l.count), [2, 1, 1]);
check("1 no-plan → hash #risk-", summarizeRiskWarnings([{ type: "no-plan", riskId: "r1" }])[0].hash, "#risk-r1");
check("1 accepted-unconfirmed → label y hash", summarizeRiskWarnings([{ type: "accepted-unconfirmed", riskId: "ra" }])[0], { type: "accepted-unconfirmed", count: 1, label: "1 riesgo(s) crítico(s) aceptado(s) sin confirmar", href: "StrategicInitiatives", hash: "#risk-ra" });
check("2 no-owner → label, hash ''", summarizeRiskWarnings([{ type: "no-owner", initiativeId: "a" }, { type: "no-owner", initiativeId: "b" }])[0], { type: "no-owner", count: 2, label: "2 iniciativa(s) de riesgo sin responsable", href: "StrategicInitiatives", hash: "" });
check("[] → []", summarizeRiskWarnings([]), []);

// ---------- focusItems ----------
console.log("\n== focusItems ==");
const weak = (id, score, priority = "Alta") => ({ id, label: `W ${id}`, score, priority });
const r3 = [objReducir("f1"), objReducir("f2"), objHigh("f3")];
const w4 = [weak("w1", 1.3), weak("w2", 1.1), weak("w3", 1.35), weak("w4", 1.2)];
let focus = focusItems(r3, w4, []);
check("3 riesgos + 4 debilidades → 5 items, hidden 2, total 7", [focus.items.length, focus.hidden, focus.total], [5, 2, 7]);
check("primeros 3 riesgos, luego 2 debilidades de menor score", focus.items.map((i) => i.id), ["risk:f1", "risk:f2", "risk:f3", "w2", "w4"]);
check("FOCUS_LIMIT 5", FOCUS_LIMIT, 5);
focus = focusItems([], w4, []);
check("0 riesgos → debilidades por score asc", focus.items.map((i) => i.id), ["w2", "w4", "w1", "w3"]);
check("debilidad: kind y status", [focus.items[0].kind, focus.items[0].status, focus.items[0].initiativeCount], ["weakness", "no-plan", 0]);
focus = focusItems([objReducir("p1")], [], [init("x1", "risk:p1"), init("x2", "risk:p1")]);
check("riesgo con 2 iniciativas → planned, riskId", [focus.items[0].status, focus.items[0].initiativeCount, focus.items[0].riskId, focus.items[0].kind, focus.items[0].level, focus.items[0].levelLabel], ["planned", 2, "p1", "risk", "INTOLERABLE", "Intolerable"]);
check("Aceptar confirmado sin iniciativas → accepted", focusItems([oAccOk], [], []).items[0].status, "accepted");
check("Aceptar sin confirmar sin iniciativas → accepted-unconfirmed", focusItems([oAcc], [], []).items[0].status, "accepted-unconfirmed");
check("Aceptar sin confirmar con 2 iniciativas → accepted-unconfirmed", focusItems([oAcc], [], [init("a1", "risk:oa"), init("a2", "risk:oa")]).items[0].status, "accepted-unconfirmed");
check("limit 2 con 6 → hidden 4", focusItems(r3, w4.slice(0, 3), [], 2).hidden, 4);
check("debilidad con iniciativa → planned", focusItems([], [weak("w1", 1.2)], [init("q", "w1")]).items[0].status, "planned");

// ---------- FODA ----------
console.log("\n== mergeFodaWithRisks ==");
const fodaBase = { fortalezas: [{ label: "F1" }], debilidades: [{ id: "opp:a", label: "D1", score: 1.2, priority: "Alta" }], oportunidades: [{ label: "O1", kind: "Crear" }], amenazas: [{ label: "A1" }] };
const trio = [
  objReducir("t1", { threat_type: "Interna" }),
  objReducir("t2", { threat_type: "Externa" }),
  objReducir("t3", { threat_type: null }),
];
const merged = mergeFodaWithRisks(fodaBase, trio);
check("debilidades +1", merged.debilidades.length, 2);
check("amenazas +2", merged.amenazas.length, 3);
check("riesgos primero", [merged.debilidades[0].riskId, merged.amenazas[0].riskId, merged.amenazas[1].riskId], ["t1", "t2", "t3"]);
check("item sin priority ni kind", merged.debilidades[0], { id: "risk:t1", riskId: "t1", label: "R t1", source: "risk", level: "INTOLERABLE", levelLabel: "Intolerable", score: 20, tag: "Riesgo crítico" });
check("riskCountIn(amenazas) → 2", riskCountIn(merged.amenazas), 2);
check("riskCountIn(undefined) → 0", riskCountIn(undefined), 0);
check("fortalezas idénticas", merged.fortalezas, fodaBase.fortalezas);
check("oportunidades idénticas", merged.oportunidades, fodaBase.oportunidades);
check("entrada no mutada", [fodaBase.debilidades.length, fodaBase.amenazas.length], [1, 1]);
const same = mergeFodaWithRisks(fodaBase, []);
check("con [] → copias iguales", same, fodaBase);
check("con [] → no es la misma referencia", same.debilidades !== fodaBase.debilidades, true);

// ---------- Flujo completo con el seed ----------
console.log("\n== Flujo completo (seed) ==");
const s2obj = byId["risk:s2"];
const rowS2 = initiativeFromControl(s2obj, s2obj.controls[0], TODAY, 0);
check("control 1 de Errores: source_key y hasResponsible", [rowS2.source_key, s2obj.controls[0].hasResponsible, rowS2.area, rowS2.end_date], ["risk:s2:m1", true, "Clientes", "2026-12-13"]);
const created = { ...rowS2, id: "db-1", owner: "" }; // así vuelve de Initiative.list() (owner vacío)
const flowWs = riskInitiativeWarnings(OBJ, [created], TODAY);
check("no-owner de Errores → responsibleInMatrix true", flowWs.find((w) => w.type === "no-owner" && w.initiativeId === "db-1")?.responsibleInMatrix, true);
check("Pérdida cambiaria → no-plan controlsCount 0", flowWs.find((w) => w.type === "no-plan" && w.riskId === "s5")?.controlsCount, 0);
check("Ransomware → no-plan controlsCount 1", flowWs.find((w) => w.type === "no-plan" && w.riskId === "s4")?.controlsCount, 1);
check("R-A → accepted-unconfirmed", flowWs.find((w) => w.riskId === "ra")?.type, "accepted-unconfirmed");
check("Errores (con iniciativa) → sin no-plan", flowWs.some((w) => w.type === "no-plan" && w.riskId === "s2"), false);
check("no-plan total 5 (s1, s4, s5, s3, rb)", flowWs.filter((w) => w.type === "no-plan").map((w) => w.riskId), ["s1", "s4", "s5", "s3", "rb"]);
check("ya creada: existingForSource", existingForSource([created], "risk:s2:m1")?.id, "db-1");
check("no creada: existingForSource null", existingForSource([created], "risk:s2:m2"), null);
const flowLines = summarizeRiskWarnings(flowWs);
check("resumen: aceptados hash #risk-ra", flowLines.find((l) => l.type === "accepted-unconfirmed")?.hash, "#risk-ra");
check("resumen: no-plan (count>1) hash ''", flowLines.find((l) => l.type === "no-plan")?.hash, "");
check("resumen: no-owner (count 1) hash #initiative-db-1", flowLines.find((l) => l.type === "no-owner")?.hash, "#initiative-db-1");
check("resumen: orden", flowLines.map((l) => l.type), ["no-plan", "accepted-unconfirmed", "no-owner"]);
const flowFocus = focusItems(OBJ, [weak("w1", 1.3), weak("w2", 1.1)], [created]);
check("foco: items 5, hidden 4, total 9", [flowFocus.items.length, flowFocus.hidden, flowFocus.total], [5, 4, 9]);
check("foco: 3 INT + s2 + s3 (R-A y R-B ocultos)", flowFocus.items.map((i) => i.riskId), ["s1", "s4", "s5", "s2", "s3"]);
check("foco: Errores planned", flowFocus.items.find((i) => i.riskId === "s2")?.status, "planned");

console.log(`\n${failures === 0 ? "TODO OK" : `${failures} FALLA(S)`}`);
process.exit(failures === 0 ? 0 : 1);
