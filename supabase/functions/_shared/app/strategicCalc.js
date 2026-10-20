// ============================================================
// Motor de la Planeación Estratégica (funciones puras, sin React).
// Lo usan las páginas de la app y el servidor MCP (misma lógica, un
// solo lugar). Se copia a supabase/functions/_shared/app con
// `npm run mcp:sync`.
// ============================================================
import {
  MARKET_SECTION,
  MKT_CONCL_SECTION,
  OPP_SECTION,
  OPP_CONCL_SECTION,
  FIN_SECTION,
  MKT_CATALOG,
  OPP_GROUPS,
  FIN_GROUPS,
  compSection,
  templatesForStrategy,
} from "./strategicCatalog.js";
import {
  STRATEGY_LEVELS,
  isCriticalKey,
  levelKeyOf,
  hasResidual,
  currentLevelKey,
  controlGrade,
  labelForLevelKey,
  riskScore,
} from "./riskCalc.js";
import { PERSPECTIVE_BY_KEY, isPerspectiveKey } from "./perspectives.js";

// Sí → Fortaleza, No → Debilidad (conclusión automática de oportunidades).
export const deriveFromAnswer = (answer) =>
  answer === "Sí" ? "F" : answer === "No" ? "D" : "";

// Valor efectivo por estrategia: el ajuste manual (override) manda; si no
// hay, se usa el derivado automáticamente de la respuesta del cuestionario.
export function effectiveConclusions(oppAnswers, overrides) {
  const out = {};
  OPP_GROUPS.forEach((g) =>
    g.questions.forEach((q) => {
      out[q.key] = (overrides?.[q.key] || "") || deriveFromAnswer(oppAnswers?.[q.key]);
    })
  );
  return out;
}

// Junta las estrategias de las tres fuentes: conclusiones del mercado,
// conclusión de oportunidades (efectiva) y estrategias financieras.
export function collectStrategies(sections) {
  const weaknesses = [];
  const strengths = [];

  const mkt = sections[MKT_CONCL_SECTION] || {};
  MKT_CATALOG.forEach((g) =>
    g.items.forEach((i) => {
      if (mkt[i.key] === "D") weaknesses.push({ id: `mkt:${i.key}`, label: i.label, source: "market" });
      else if (mkt[i.key] === "F") strengths.push({ label: i.label, source: "market" });
    })
  );

  const oppEff = effectiveConclusions(sections[OPP_SECTION] || {}, sections[OPP_CONCL_SECTION] || {});
  OPP_GROUPS.forEach((g) =>
    g.questions.forEach((q) => {
      if (oppEff[q.key] === "D") weaknesses.push({ id: `opp:${q.key}`, label: q.strategy, source: "opportunities" });
      else if (oppEff[q.key] === "F") strengths.push({ label: q.strategy, source: "opportunities" });
    })
  );

  const fin = sections[FIN_SECTION] || {};
  FIN_GROUPS.forEach((g) =>
    g.items.forEach((i) => {
      if (fin[i.key] === "D") weaknesses.push({ id: `fin:${i.key}`, label: i.label, source: "financial" });
    })
  );

  return { weaknesses, strengths };
}

// Motor de priorización del Excel:
// Prioridad = Costo×0.2 + Riesgo×0.5 + Complejidad×0.15 + Beneficio×0.15
// (Alto/Alta=3 · Medio/Media=2 · Bajo/Baja=1 · Ingresos=1 · Ahorros=2)
// Puntaje bajo = atacar primero: 1–1.39 Alta · 1.4–2.34 Media · 2.35–3 Baja.
const level3 = (v) =>
  v?.startsWith("Alt") ? 3 : v?.startsWith("Med") ? 2 : v?.startsWith("Baj") ? 1 : null;
const benefit2 = (v) => (v === "Ingresos" ? 1 : v === "Ahorros" ? 2 : null);

export function scoreFor(ratings, id) {
  const c = level3(ratings[`${id}:costo`]);
  const r = level3(ratings[`${id}:riesgo`]);
  const x = level3(ratings[`${id}:complejidad`]);
  const b = benefit2(ratings[`${id}:beneficio`]);
  if ([c, r, x, b].some((v) => v == null)) return null;
  return Math.round((c * 0.2 + r * 0.5 + x * 0.15 + b * 0.15) * 100) / 100;
}

export function priorityFor(score) {
  if (score == null) return null;
  if (score <= 1.39) return "Alta";
  if (score <= 2.34) return "Media";
  return "Baja";
}

// Perspectiva (carril del mapa estratégico) de una estrategia por su id.
const OPP_GROUP_BY_KEY = {};
OPP_GROUPS.forEach((g) => g.questions.forEach((q) => { OPP_GROUP_BY_KEY[q.key] = g.title || g.key || ""; }));

// Reparto explícito por clave de las estrategias de oportunidades que antes
// caían juntas en "Procesos y competitividad" (hoy dos carriles distintos).
// Competitividad: capital social completo, info del mercado y de la
// competencia, patentes y el ciclo comercial. Procesos: información interna,
// software, IA y mejora continua. Lo que no está aquí sigue el fallback.
const OPP_COMPETITIVA = new Set([
  "alianzas", "clientes_clave", "comunidad", "socios_estrategicos", "proveedores_clave",
  "info_mercado", "info_competencia", "patentes",
  "ciclo_comercial",
]);
const OPP_PROCESOS = new Set(["info_interna", "software", "ia", "mejora_continua"]);

export function perspectiveFor(item) {
  const [src, key] = String(item?.id || "").split(":");
  // Riesgos críticos de la matriz ('risk:<id>'): traen su perspectiva
  // puesta (perspective, o perspective_key tal cual viene de la tabla
  // risks); si no la traen, null (no se inventa un carril).
  if (src === "risk") return item.perspective || item.perspective_key || null;
  if (src === "mkt") return "cliente";
  if (src === "fin") return key === "ventas_area_comercial" ? "competitiva" : "financiera";
  if (src !== "opp") return "cliente";
  if (OPP_COMPETITIVA.has(key)) return "competitiva";
  if (OPP_PROCESOS.has(key)) return "procesos";
  const group = (OPP_GROUP_BY_KEY[key] || "").toLowerCase();
  if (key === "costos_entrega") return "financiera";
  if (group.includes("financiero")) return "financiera";
  if (group.includes("humano")) return "equipo";
  if (group.includes("social") || group.includes("conocimiento") || group.includes("producto"))
    return "competitiva";
  return "cliente";
}

// Divide una respuesta de texto libre en puntos (por línea o punto y coma).
export const splitPoints = (text) =>
  (text || "")
    .split(/\n|;/)
    .map((s) => s.replace(/^[-•\d.\s]+/, "").trim())
    .filter(Boolean);

// FODA automático a partir de lo capturado.
export function buildFoda({ sections, competitors, ratings }) {
  const strengths = [];
  const mkt = sections[MKT_CONCL_SECTION] || {};
  MKT_CATALOG.forEach((g) =>
    g.items.forEach((i) => {
      if (mkt[i.key] === "F") strengths.push({ label: i.label });
    })
  );
  const oppEff = effectiveConclusions(sections[OPP_SECTION] || {}, sections[OPP_CONCL_SECTION] || {});
  OPP_GROUPS.forEach((g) =>
    g.questions.forEach((q) => {
      if (oppEff[q.key] === "F") strengths.push({ label: q.strategy });
    })
  );

  const { weaknesses } = collectStrategies(sections);
  const debilidades = weaknesses.map((w) => {
    const score = scoreFor(ratings || {}, w.id);
    return { ...w, score, priority: priorityFor(score) };
  });

  const market = sections[MARKET_SECTION] || {};
  const oportunidades = [
    ...splitPoints(market.bo_crear).map((label) => ({ label, kind: "Crear" })),
    ...splitPoints(market.bo_incrementar).map((label) => ({ label, kind: "Incrementar" })),
  ];

  const amenazas = [];
  (competitors || []).forEach((c) => {
    const a = sections[compSection(c.id)] || {};
    const add = (label) => amenazas.push({ label });
    if (a.precio === "Menor") add(`${c.name} tiene precios menores que los tuyos`);
    if (a.servicio === "Mejor") add(`${c.name} ofrece mejor servicio que el tuyo`);
    if (a.postventa_mejor === "Sí") add(`${c.name} tiene mejor servicio post-venta`);
    if (a.entrega_simple === "Sí") add(`${c.name} entrega de forma más simple`);
    if (a.entrega_comoda === "Sí") add(`${c.name} ofrece una entrega más cómoda`);
    if (a.imagen === "Sí") add(`${c.name} tiene mejor imagen de marca`);
    if (a.mercado === "Más") add(`${c.name} tiene más mercado que tú`);
    if (a.redes === "Sí" || a.publicidad === "Sí")
      add(`${c.name} está activo en redes sociales o publicidad`);
  });

  return { fortalezas: strengths, debilidades, oportunidades, amenazas };
}

// ============================================================
// Riesgos críticos en el plan (Fase 2). Funciones puras: las usan las
// páginas del módulo estratégico y, en el futuro, el servidor MCP.
// Un riesgo es crítico cuando su nivel INHERENTE es Alto o Intolerable
// (puntaje >= 13); entra al plan como objetivo de prioridad alta con id
// 'risk:<risk.id>'. Nada de aquí escribe en la base.
// ============================================================

// ---------- Constantes ----------
export const RISK_OBJECTIVE_PREFIX = "risk:";
export const RISK_ACKNOWLEDGED = "acknowledged"; // valor en plan_answers 'risk-objectives'
export const RISK_DEADLINE_DAYS = { INTOLERABLE: 30, HIGH: 60 }; // fecha fin sugerida
export const RISK_FAR_DAYS = { INTOLERABLE: 60, HIGH: 120 }; // aviso "demasiado lejos" si end_date - hoy > esto
export const RISK_CONCENTRATION_MIN = 3; // mínimo de iniciativas de riesgo con responsable para evaluar concentración
export const FOCUS_LIMIT = 5;
export const RISK_EXPECTED_RESULT = {
  mitigate: "Bajar el riesgo a nivel Medio o menor",
  accept: "Tener definida la señal de alerta y el plan de reacción",
};

// ---------- Identificadores ----------
export const riskObjectiveId = (riskId) => `${RISK_OBJECTIVE_PREFIX}${riskId}`;
export const isRiskObjectiveId = (id) => typeof id === "string" && id.startsWith(RISK_OBJECTIVE_PREFIX);
export const riskIdFromObjectiveId = (id) =>
  isRiskObjectiveId(id) ? id.slice(RISK_OBJECTIVE_PREFIX.length) : null;
export const controlSourceKey = (objectiveId, n) => `${objectiveId}:m${n}`; // 'risk:<id>:m1'
export const templateSourceKey = (objectiveId, key) => `${objectiveId}:tpl:${key}`; // 'risk:<id>:tpl:control'
// 'risk:<id>:m2' → 2; cualquier otra cosa → null.
export const controlIndexFromSourceKey = (objectiveId, sourceKey) => {
  if (typeof sourceKey !== "string" || !sourceKey.startsWith(`${objectiveId}:m`)) return null;
  const m = /^:m([1-3])$/.exec(sourceKey.slice(objectiveId.length));
  return m ? Number(m[1]) : null;
};

// ---------- Fechas (sin zona horaria: todo en 'YYYY-MM-DD') ----------
const pad2 = (n) => String(n).padStart(2, "0");

// Descompone 'YYYY-MM-DD…' en [año, mes(1-12), día]; null si no es válida.
const isoParts = (iso) => {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const utc = new Date(Date.UTC(y, mo - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) return null;
  return [y, mo, d];
};

// 'YYYY-MM-DD' en hora LOCAL (la fecha que ve el usuario en su reloj).
export function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 'YYYY-MM-DD' + n días → 'YYYY-MM-DD'; null si la fecha no es válida.
export function addDays(isoDate, days) {
  const parts = isoParts(isoDate);
  if (!parts || !Number.isFinite(Number(days))) return null;
  const [y, mo, d] = parts;
  const utc = new Date(Date.UTC(y, mo - 1, d + Number(days)));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

// Días enteros de fromISO a toISO (negativo si toISO es anterior); null si
// alguna no es válida. Solo mira los primeros 10 caracteres.
export function daysFromTo(fromISO, toISO) {
  const a = isoParts(fromISO);
  const b = isoParts(toISO);
  if (!a || !b) return null;
  const ms = Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2]);
  return Math.round(ms / 86400000);
}

// Fecha fin sugerida para una iniciativa de riesgo según su nivel.
export function suggestedDeadline(levelKey, todayISO) {
  const days = RISK_DEADLINE_DAYS[levelKey];
  if (days == null) return null;
  return addDays(todayISO, days);
}

// ---------- Controles (mitigantes) de un riesgo ----------
// Devuelve solo los mitigantes con texto: [{ n, text, impact, hasResponsible, grade }].
export function riskControls(risk) {
  if (!risk) return [];
  const out = [];
  for (let n = 1; n <= 3; n++) {
    const text = String(risk[`mitigant_${n}`] ?? "").trim();
    if (text === "") continue;
    out.push({
      n,
      text,
      impact: risk[`mitigant_impact_${n}`] || null,
      hasResponsible: risk[`control_responsible_${n}`] === "Sí",
      grade: risk[`control_grade_${n}`] || controlGrade(risk, n) || null,
    });
  }
  return out;
}

// ---------- Objetivos de riesgo ----------
const LEVEL_RANK = { INTOLERABLE: 0, HIGH: 1 };

const positiveInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Convierte las filas de `risks` (críticas) en objetivos del plan.
// `decisions` = { objectives: { [riskId]: answer } } (plan_answers
// 'risk-objectives') o undefined. Orden: Intolerable antes que Alto, luego
// puntaje descendente; si empatan, el orden de entrada.
export function riskObjectivesFrom(risks, decisions) {
  const list = Array.isArray(risks) ? risks : [];
  const objectives = [];
  list.forEach((risk) => {
    if (!risk?.id) return;
    const level = levelKeyOf(risk, "inherent");
    if (!isCriticalKey(level)) return;
    const perspective = isPerspectiveKey(risk.perspective_key) ? risk.perspective_key : null;
    const strategy = STRATEGY_LEVELS.includes(risk.risk_strategy) ? risk.risk_strategy : null;
    const residual = hasResidual(risk) ? currentLevelKey(risk) : null;
    const threatType =
      risk.threat_type === "Interna" || risk.threat_type === "Externa" ? risk.threat_type : null;
    objectives.push({
      id: riskObjectiveId(risk.id),
      riskId: risk.id,
      source: "risk",
      priority: "Alta",
      label: String(risk.description || "").trim() || "Riesgo sin descripción",
      perspective,
      perspectiveLabel: perspective ? PERSPECTIVE_BY_KEY[perspective]?.label ?? null : null,
      level,
      levelLabel: labelForLevelKey(level),
      score: positiveInt(risk.inherent_score) ?? riskScore(risk.inherent_probability, risk.inherent_impact) ?? null,
      strategy,
      threatType,
      controls: riskControls(risk),
      residual,
      residualLabel: residual ? labelForLevelKey(residual) : null,
      accepted: strategy === "Aceptar",
      acknowledged: decisions?.objectives?.[risk.id] === RISK_ACKNOWLEDGED,
    });
  });
  // Array.prototype.sort es estable: los empates conservan el orden de entrada.
  return objectives.sort((a, b) => {
    const r = (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9);
    if (r !== 0) return r;
    const sa = a.score == null ? -Infinity : a.score;
    const sb = b.score == null ? -Infinity : b.score;
    return sb - sa;
  });
}

// ---------- Plantillas e iniciativas sugeridas ----------
export function templatesFor(objective) {
  return templatesForStrategy(objective?.strategy);
}

const baseInitiativeRow = (objective, todayISO, position) => ({
  strategy_id: objective.id,
  strategy_label: objective.label,
  area: objective.perspectiveLabel ?? null, // null si no tiene perspectiva
  owner: null, // la matriz solo guarda Sí/No, no el nombre del responsable
  start_date: todayISO,
  end_date: suggestedDeadline(objective.level, todayISO),
  budget: null,
  steps: null,
  position,
});

// Fila para Initiative.createFromSource a partir de un control de la matriz.
export function initiativeFromControl(objective, control, todayISO, position = 0) {
  return {
    ...baseInitiativeRow(objective, todayISO, position),
    source_key: controlSourceKey(objective.id, control.n),
    title: control.text,
    expected_result: objective.accepted ? RISK_EXPECTED_RESULT.accept : RISK_EXPECTED_RESULT.mitigate,
    kpi: null,
  };
}

// Fila para Initiative.createFromSource a partir de una plantilla.
export function initiativeFromTemplate(objective, template, todayISO, position = 0) {
  return {
    ...baseInitiativeRow(objective, todayISO, position),
    source_key: templateSourceKey(objective.id, template.key),
    title: template.title,
    expected_result:
      template?.expected_result ??
      (objective.accepted ? RISK_EXPECTED_RESULT.accept : RISK_EXPECTED_RESULT.mitigate),
    kpi: template?.kpi ?? null,
  };
}

// ---------- Iniciativas de un objetivo ----------
export const riskInitiativesOf = (objectiveId, initiatives) =>
  (initiatives || []).filter((it) => it.strategy_id === objectiveId);
export const existingForSource = (initiatives, sourceKey) =>
  (initiatives || []).find((it) => it.source_key === sourceKey) || null;
export const orphanLabelFor = (initiatives) =>
  (initiatives || []).map((it) => (it.strategy_label || "").trim()).find(Boolean) || null;

// ---------- Avisos (nunca bloquean) ----------
const normalizeOwner = (owner) => String(owner ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function riskInitiativeWarnings(objectives, initiatives, todayISO) {
  const list = objectives || [];
  const all = initiatives || [];
  const warnings = [];
  const ownerStats = new Map(); // owner normalizado → { owner (texto original), count }
  let total = 0;

  list.forEach((objective) => {
    const mine = riskInitiativesOf(objective.id, all);
    const { label, riskId } = objective;
    const objectiveId = objective.id;

    if (!objective.accepted && mine.length === 0) {
      const n = objective.controls?.length || 0;
      warnings.push({
        type: "no-plan",
        objectiveId,
        riskId,
        label,
        controlsCount: n,
        message:
          n > 0
            ? `"${label}" tiene ${n} control(es) en tu matriz, pero ninguno está en tu plan. Conviértelos con un clic.`
            : `"${label}" no tiene ninguna iniciativa. Elige una sugerencia para empezar.`,
      });
    }
    if (objective.accepted && !objective.acknowledged) {
      warnings.push({
        type: "accepted-unconfirmed",
        objectiveId,
        riskId,
        label,
        initiativeCount: mine.length,
        message: `"${label}" es un riesgo crítico que decidiste aceptar: necesita una señal de alerta y un plan de reacción. Confírmalo cuando los tengas.`,
      });
    }

    mine.forEach((it) => {
      const title = it.title?.trim() || "Iniciativa sin nombre";
      const limit = RISK_FAR_DAYS[objective.level];
      const days = daysFromTo(todayISO, it.end_date);
      if (days != null && limit != null && days > limit) {
        warnings.push({
          type: "far",
          objectiveId,
          riskId,
          initiativeId: it.id,
          days,
          limit,
          levelLabel: objective.levelLabel,
          message: `"${title}" termina en ${days} días. Para un riesgo ${String(objective.levelLabel || "").toLowerCase()} se sugiere cerrarla en ${limit} días o menos.`,
        });
      }

      const ownerText = String(it.owner ?? "").trim();
      if (ownerText === "") {
        const n = controlIndexFromSourceKey(objective.id, it.source_key);
        const responsibleInMatrix = !!(objective.controls || []).find((c) => c.n === n)?.hasResponsible;
        warnings.push({
          type: "no-owner",
          objectiveId,
          riskId,
          initiativeId: it.id,
          responsibleInMatrix,
          message: responsibleInMatrix
            ? `"${title}" no tiene responsable. En la matriz indicaste que este control sí tiene uno: escribe su nombre.`
            : `"${title}" no tiene responsable.`,
        });
      } else {
        total++;
        const key = normalizeOwner(ownerText);
        const stat = ownerStats.get(key);
        if (stat) stat.count++;
        else ownerStats.set(key, { owner: ownerText, count: 1 });
      }
    });
  });

  if (total >= RISK_CONCENTRATION_MIN) {
    let top = null;
    let tie = false;
    ownerStats.forEach((stat) => {
      if (!top || stat.count > top.count) {
        top = stat;
        tie = false;
      } else if (stat.count === top.count) {
        tie = true;
      }
    });
    if (top && !tie && top.count > total / 2) {
      warnings.push({
        type: "concentration",
        owner: top.owner,
        count: top.count,
        total,
        message: `${top.owner} concentra ${top.count} de ${total} iniciativas de riesgo. Reparte el trabajo si puedes.`,
      });
    }
  }

  return warnings;
}

// Resume los avisos en una línea por tipo (para el Inicio y la tarjeta de
// avisos). `href` es el nombre de la página; `hash` el ancla dentro de ella
// cuando el aviso apunta a un solo riesgo o iniciativa.
const WARNING_SUMMARY_ORDER = ["no-plan", "accepted-unconfirmed", "far", "no-owner", "concentration"];
const WARNING_SUMMARY_LABEL = {
  "no-plan": (n) => `${n} riesgo(s) crítico(s) sin plan de acción`,
  "accepted-unconfirmed": (n) => `${n} riesgo(s) crítico(s) aceptado(s) sin confirmar`,
  far: (n) => `${n} iniciativa(s) de riesgo programada(s) demasiado lejos`,
  "no-owner": (n) => `${n} iniciativa(s) de riesgo sin responsable`,
};

export function summarizeRiskWarnings(warnings) {
  const list = warnings || [];
  const out = [];
  WARNING_SUMMARY_ORDER.forEach((type) => {
    const ofType = list.filter((w) => w.type === type);
    if (ofType.length === 0) return;
    const count = ofType.length;
    let hash = "";
    if (count === 1) {
      const w = ofType[0];
      if ((type === "no-plan" || type === "accepted-unconfirmed") && w.riskId) hash = `#risk-${w.riskId}`;
      else if ((type === "far" || type === "no-owner") && w.initiativeId) hash = `#initiative-${w.initiativeId}`;
    }
    out.push({
      type,
      count,
      label: type === "concentration" ? ofType[0].message : WARNING_SUMMARY_LABEL[type](count),
      href: "StrategicInitiatives",
      hash,
    });
  });
  return out;
}

// ---------- Foco del Inicio ----------
// Riesgos críticos primero (ya ordenados por gravedad), luego debilidades de
// prioridad Alta por puntaje ascendente (igual que hoy el dashboard).
export function focusItems(riskObjectives, altaWeaknesses, initiatives, limit = FOCUS_LIMIT) {
  const all = initiatives || [];
  const countFor = (id) => all.filter((it) => it.strategy_id === id).length;

  const risks = (riskObjectives || []).map((o) => {
    const initiativeCount = countFor(o.id);
    let status = "no-plan";
    if (o.accepted && o.acknowledged) status = "accepted";
    else if (o.accepted && !o.acknowledged) status = "accepted-unconfirmed";
    else if (initiativeCount > 0) status = "planned";
    return {
      kind: "risk",
      id: o.id,
      riskId: o.riskId,
      label: o.label,
      level: o.level,
      levelLabel: o.levelLabel,
      score: o.score,
      initiativeCount,
      accepted: !!o.accepted,
      acknowledged: !!o.acknowledged,
      status,
    };
  });

  const weaknesses = (altaWeaknesses || [])
    .filter((w) => w.priority === "Alta" && w.score != null)
    .slice()
    .sort((a, b) => a.score - b.score)
    .map((w) => {
      const initiativeCount = countFor(w.id);
      return {
        kind: "weakness",
        id: w.id,
        label: w.label,
        score: w.score,
        initiativeCount,
        accepted: false,
        acknowledged: false,
        status: initiativeCount > 0 ? "planned" : "no-plan",
      };
    });

  const todos = [...risks, ...weaknesses];
  const items = todos.slice(0, limit);
  return { items, hidden: todos.length - items.length, total: todos.length };
}

// ---------- FODA con riesgos ----------
// Riesgo Interna → Debilidades; Externa o sin tipo → Amenazas. Van primero,
// en su orden de gravedad. No muta la entrada.
export function mergeFodaWithRisks(foda, riskObjectives) {
  const base = foda || {};
  const toItem = (o) => ({
    id: o.id,
    riskId: o.riskId,
    label: o.label,
    source: "risk",
    level: o.level,
    levelLabel: o.levelLabel,
    score: o.score,
    tag: "Riesgo crítico",
  });
  const internos = [];
  const externos = [];
  (riskObjectives || []).forEach((o) => {
    if (o.threatType === "Interna") internos.push(toItem(o));
    else externos.push(toItem(o));
  });
  return {
    fortalezas: [...(base.fortalezas || [])],
    debilidades: [...internos, ...(base.debilidades || [])],
    oportunidades: [...(base.oportunidades || [])],
    amenazas: [...externos, ...(base.amenazas || [])],
  };
}

export const riskCountIn = (items) => (items || []).filter((i) => i.source === "risk").length;

// ---------- Utilidad de índices ----------
export const objectivesById = (list) => Object.fromEntries((list || []).map((o) => [o.id, o]));
