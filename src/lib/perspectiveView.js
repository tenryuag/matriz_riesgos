// ============================================================
// Ayudas PURAS de presentación para los riesgos por perspectiva (Fase 1).
// Sin React ni alias "@/": imports relativos con .js para que
// scripts/check-perspectiveView.mjs las pruebe con node.
// No se copia al servidor MCP (no la necesita).
// ============================================================
import { riskScore, isCriticalScore } from "../config/riskCalc.js";
import {
  PERSPECTIVE_KEYS,
  PERSPECTIVE_BY_KEY,
  isPerspectiveKey,
  suggestPerspectiveForDepartment,
} from "../config/perspectives.js";

// Valor del filtro "Sin asignar" en los <Select> (no es clave de perspectiva).
export const UNASSIGNED = "unassigned";
// Centinela del <Select> de departamento: Radix no admite value="".
export const NO_DEPARTMENT = "__none__";
// Modos de orden de las listas.
export const SORT_MODES = ["recent", "scoreDesc", "scoreAsc"];

const positiveInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Puntaje inherente: la columna del disparador si viene; si no, se calcula
// de probabilidad × impacto (misma fórmula). null = "Sin puntaje".
export function inherentScoreOf(risk) {
  if (!risk) return null;
  return positiveInt(risk.inherent_score) ?? riskScore(risk.inherent_probability, risk.inherent_impact);
}
export function residualScoreOf(risk) {
  if (!risk) return null;
  return positiveInt(risk.residual_score) ?? riskScore(risk.residual_probability, risk.residual_impact);
}
export const isUnscored = (risk) => inherentScoreOf(risk) == null;
// Crítico = nivel INHERENTE Alto o Intolerable (puntaje >= 13). Mismo
// criterio que Risk.listCritical y que el paso a planeación (Fase 2).
export const isCriticalRisk = (risk) => isCriticalScore(inherentScoreOf(risk));

export const perspectiveOf = (risk) =>
  isPerspectiveKey(risk?.perspective_key) ? risk.perspective_key : null;
export const isUnassigned = (risk) => perspectiveOf(risk) == null;
export const perspectiveLabel = (key) => PERSPECTIVE_BY_KEY[key]?.label ?? null;

const emptyBucket = () => ({ total: 0, critical: 0, unscored: 0 });
// { financiera: {total, critical, unscored}, …, unassigned: {…} }
export function countByPerspective(risks) {
  const out = {};
  for (const k of PERSPECTIVE_KEYS) out[k] = emptyBucket();
  out[UNASSIGNED] = emptyBucket();
  for (const r of risks || []) {
    const b = out[perspectiveOf(r) ?? UNASSIGNED];
    b.total++;
    if (isCriticalRisk(r)) b.critical++;
    if (isUnscored(r)) b.unscored++;
  }
  return out;
}

// { total, assigned, unassigned, pct } — pct 100 cuando no hay riesgos.
export function migrationProgress(risks) {
  const list = risks || [];
  const total = list.length;
  const unassigned = list.filter(isUnassigned).length;
  const assigned = total - unassigned;
  return { total, assigned, unassigned, pct: total === 0 ? 100 : Math.round((assigned / total) * 100) };
}

// Sugerencia para un departamento: su mapa guardado (departments.perspective_key)
// y, si no lo tiene, la heurística por nombre. null = el usuario elige.
export function suggestionForDepartment(department) {
  if (!department) return null;
  if (isPerspectiveKey(department.perspective_key)) return department.perspective_key;
  return suggestPerspectiveForDepartment(department.name);
}

// Filas del asistente. Solo departamentos (de la lista del usuario) con al
// menos un riesgo. Los riesgos cuyo department_id no está en `departments`
// (huérfanos) NO caen aquí: los recoge looseUnassigned.
//   status 'pending'  → tiene riesgos sin perspectiva (botón Asignar)
//   status 'done'     → sin pendientes y su mapa coincide con riesgos (botón Deshacer)
//   status 'complete' → sin pendientes, asignados uno a uno (sin botones)
// assignedCount = riesgos del departamento con la clave del mapa: es
// EXACTAMENTE lo que Deshacer revertirá (incluye los que el usuario puso a
// mano en esa misma perspectiva).
// Orden: pending (más pendientes primero) · done · complete; empate por nombre.
export function groupByDepartment(risks, departments) {
  const byDept = new Map();
  for (const r of risks || []) {
    if (!r.department_id) continue;
    if (!byDept.has(r.department_id)) byDept.set(r.department_id, []);
    byDept.get(r.department_id).push(r);
  }
  const rows = [];
  for (const d of departments || []) {
    const all = byDept.get(d.id);
    if (!all || all.length === 0) continue;
    const unassigned = all.filter(isUnassigned);
    const mapped = isPerspectiveKey(d.perspective_key) ? d.perspective_key : null;
    const withMapped = mapped ? all.filter((r) => perspectiveOf(r) === mapped).length : 0;
    let status = "pending";
    if (unassigned.length === 0) status = mapped && withMapped > 0 ? "done" : "complete";
    rows.push({
      department: d,
      total: all.length,
      unassigned,
      suggestion: status === "pending" ? suggestionForDepartment(d) : null,
      assignedKey: status === "done" ? mapped : null,
      assignedCount: status === "done" ? withMapped : 0,
      status,
    });
  }
  const rank = { pending: 0, done: 1, complete: 2 };
  rows.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      b.unassigned.length - a.unassigned.length ||
      String(a.department.name).localeCompare(String(b.department.name), "es")
  );
  return rows;
}

// [v2] Riesgos sin perspectiva que NO caen en ninguna fila del asistente:
// sin departamento, o con un department_id que no está en la lista del
// usuario (huérfano). Se asignan uno por uno.
export function looseUnassigned(risks, departments) {
  const ids = new Set((departments || []).map((d) => d.id));
  return (risks || []).filter(
    (r) => isUnassigned(r) && (!r.department_id || !ids.has(r.department_id))
  );
}

// [v2] created_date primero: es la columna por la que ordena el servidor
// (Risk.list("-created_date")); created_at como respaldo.
const createdMs = (r) => {
  const t = Date.parse(r?.created_date || r?.created_at || "");
  return Number.isFinite(t) ? t : 0;
};
// 'recent' (default) · 'scoreDesc' · 'scoreAsc'. Sin puntaje siempre al final.
export function sortRisks(risks, mode = "recent") {
  const arr = [...(risks || [])];
  if (mode === "scoreDesc" || mode === "scoreAsc") {
    const dir = mode === "scoreDesc" ? -1 : 1;
    arr.sort((a, b) => {
      const sa = inherentScoreOf(a);
      const sb = inherentScoreOf(b);
      if (sa == null && sb == null) return createdMs(b) - createdMs(a);
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa !== sb ? dir * (sa - sb) : createdMs(b) - createdMs(a);
    });
    return arr;
  }
  arr.sort((a, b) => createdMs(b) - createdMs(a));
  return arr;
}

// Fila del Excel. Mismas columnas y orden que AllRisks exportaba, más
// 'Perspectiva' (primera) y 'Puntaje inherente' (tras 'Nivel inherente').
// El nombre del departamento se CONSERVA durante la transición.
// 'Fecha creación' mantiene la preferencia actual de AllRisks (created_at primero).
export function riskExportRow(r, departmentMap = {}) {
  const score = inherentScoreOf(r);
  return {
    "Perspectiva": perspectiveLabel(perspectiveOf(r)) || "Sin asignar",
    "Departamento": departmentMap[r.department_id] || "",
    "Tipo de amenaza": r.threat_type || "",
    "Descripción": r.description || "",
    "Prob. inherente": r.inherent_probability || "",
    "Impacto inherente": r.inherent_impact || "",
    "Nivel inherente": r.inherent_level || "",
    "Puntaje inherente": score ?? "Sin puntaje",
    "Estrategia": r.risk_strategy || "",
    "Mitigante 1": r.mitigant_1 || "",
    "Impacto mitigante 1": r.mitigant_impact_1 || "",
    "Tipo Control 1": r.control_type_1 || "",
    "Grado Control 1": r.control_grade_1 || "",
    "Mitigante 2": r.mitigant_2 || "",
    "Impacto mitigante 2": r.mitigant_impact_2 || "",
    "Tipo Control 2": r.control_type_2 || "",
    "Grado Control 2": r.control_grade_2 || "",
    "Mitigante 3": r.mitigant_3 || "",
    "Impacto mitigante 3": r.mitigant_impact_3 || "",
    "Tipo Control 3": r.control_type_3 || "",
    "Grado Control 3": r.control_grade_3 || "",
    "Prob. residual": r.residual_probability || "",
    "Impacto residual": r.residual_impact || "",
    "Nivel residual": r.residual_level || "",
    "Fecha creación": r.created_at || r.created_date || "",
  };
}
