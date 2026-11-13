// ============================================================
// Catálogos y cálculos puros de la Matriz de Riesgos.
// Hoy las fórmulas viven en la pantalla AddRisk; aquí se extraen para que
// las compartan la app, el motor de "riesgos críticos → planeación" y el
// servidor MCP (misma lógica, un solo lugar). AddRisk se cablea en Fase 1;
// mientras, los valores de abajo son copia EXACTA de los suyos.
//
// Módulo PURO: sin React, sin alias "@/", imports relativos con .js.
// Se copia al servidor MCP con `npm run mcp:sync`.
// ============================================================

// ---------- Catálogos (textos tal cual se guardan en la tabla risks) ----------
export const PROBABILITY_LEVELS = ["Remoto (0-20%)", "Improbable (21-40%)", "Ocasional (41-60%)", "Probable (61-80%)", "Frecuente (81-100%)"];
export const IMPACT_LEVELS = ["Insignificante", "Menor", "Crítico", "Mayor", "Catastrófico"];
export const STRATEGY_LEVELS = ["Aceptar", "Reducir", "Transferir"];
export const MITIGANT_IMPACT_OPTIONS = ["Mitiga la probabilidad", "Mitiga el impacto", "Mitiga la probabilidad e impacto"];

// Opciones de Evaluación del Control
export const CONTROL_TYPES = ["Control Preventivo", "Control Correctivo", "Control Detectivo"];
export const PROCESS_TYPES = ["Manual", "Automatizado", "Combinado"];
export const YES_NO_OPTIONS = ["Sí", "No"];

// Puntajes para el cálculo del Grado de Control
export const CONTROL_TYPE_SCORES = { "Control Preventivo": 0.30, "Control Correctivo": 0.05, "Control Detectivo": 0.15 };
export const PROCESS_TYPE_SCORES = { "Manual": 0.10, "Automatizado": 0.40, "Combinado": 0.25 };
export const YES_SCORE = 0.10;
export const NO_SCORE = 0.01;

// ---------- Niveles de riesgo ----------
// Claves internas en orden de gravedad (de menor a mayor).
export const LEVEL_KEYS = ["TOLERABLE", "LOW", "MEDIUM", "HIGH", "INTOLERABLE"];

// Un riesgo es CRÍTICO cuando su nivel es Alto o Intolerable
// (puntaje probabilidad × impacto >= 13). Esos pasan solos a la planeación.
export const CRITICAL_SCORE_MIN = 13;

// Quita acentos y pasa a minúsculas: "Crítico" → "critico".
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Prefijos aceptados (español e inglés, como el SQL de reportes) → 1..5.
// "improbable" no choca con "probable" porque se compara por prefijo del
// texto completo; "unlikely" tampoco choca con "likely".
const PROBABILITY_PREFIXES = [
  ["remot", 1], ["remote", 1],
  ["improbable", 2], ["unlikely", 2],
  ["ocasional", 3], ["occasional", 3],
  ["probable", 4], ["likely", 4],
  ["frecuente", 5], ["frequent", 5],
];
const IMPACT_PREFIXES = [
  ["insignificante", 1], ["insignificant", 1],
  ["menor", 2], ["minor", 2],
  ["critico", 3], ["critical", 3],
  ["mayor", 4], ["major", 4],
  ["catastrofico", 5], ["catastrophic", 5],
];

// Acepta también el índice ya numérico (1..5) para no obligar a texto.
const indexFrom = (value, prefixes) => {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  const text = norm(value);
  if (!text) return null;
  const hit = prefixes.find(([prefix]) => text.startsWith(prefix));
  return hit ? hit[1] : null;
};

// 'Remoto (0-20%)' → 1 … 'Frecuente (81-100%)' → 5; null si no coincide.
export const probabilityIndex = (text) => indexFrom(text, PROBABILITY_PREFIXES);

// 'Insignificante' → 1 … 'Catastrófico' → 5; null si no coincide.
export const impactIndex = (text) => indexFrom(text, IMPACT_PREFIXES);

// Puntaje = probabilidad (1-5) × impacto (1-5); null si falta alguno.
export function riskScore(probability, impact) {
  const p = probabilityIndex(probability);
  const i = impactIndex(impact);
  if (p == null || i == null) return null;
  return p * i;
}

// Umbrales de AddRisk: <=4 Tolerable · <=8 Bajo · <=12 Medio · <=16 Alto · >16 Intolerable.
export function levelKeyFromScore(score) {
  if (score == null || !Number.isFinite(score) || score <= 0) return null;
  if (score <= 4) return "TOLERABLE";
  if (score <= 8) return "LOW";
  if (score <= 12) return "MEDIUM";
  if (score <= 16) return "HIGH";
  return "INTOLERABLE";
}

export const isCriticalKey = (k) => k === "HIGH" || k === "INTOLERABLE";
export const isCriticalScore = (score) =>
  score != null && Number.isFinite(score) && score >= CRITICAL_SCORE_MIN;

// Texto guardado en inherent_level / residual_level (es/en, cualquier
// capitalización) → clave interna. Mismo mapa que normalizeRiskLevel en
// src/lib/utils.js; 'UNCLASSIFIED' si está vacío o no se reconoce.
const LEVEL_TEXT_MAP = {
  intolerable: "INTOLERABLE",
  alto: "HIGH",
  high: "HIGH",
  medio: "MEDIUM",
  medium: "MEDIUM",
  bajo: "LOW",
  low: "LOW",
  tolerable: "TOLERABLE",
};
export function levelKeyFromText(text) {
  return LEVEL_TEXT_MAP[norm(text)] || "UNCLASSIFIED";
}

// Clave del nivel inherente o residual de un riesgo, en este orden:
//   1. la columna <which>_level_key si ya existe y es válida;
//   2. la columna <which>_score (la calcula el trigger de la base) o, si no
//      viene, el puntaje probabilidad × impacto (lo más confiable);
//   3. el texto <which>_level normalizado (es/en).
export function levelKeyOf(risk, which = "inherent") {
  if (!risk) return "UNCLASSIFIED";
  const stored = risk[`${which}_level_key`];
  if (LEVEL_KEYS.includes(stored)) return stored;
  const storedScore = Number(risk[`${which}_score`]);
  const fromScore = levelKeyFromScore(
    Number.isFinite(storedScore) && storedScore > 0
      ? storedScore
      : riskScore(risk[`${which}_probability`], risk[`${which}_impact`])
  );
  if (fromScore) return fromScore;
  return levelKeyFromText(risk[`${which}_level`]);
}

// ¿El usuario ya capturó el nivel residual (después de controles)?
export const hasResidual = (risk) =>
  !!risk &&
  (LEVEL_KEYS.includes(risk.residual_level_key) ||
    String(risk.residual_level ?? "").trim() !== "" ||
    (probabilityIndex(risk.residual_probability) != null && impactIndex(risk.residual_impact) != null));

// Nivel vigente del riesgo: el residual si lo capturó, si no el inherente.
export const currentLevelKey = (risk) => levelKeyOf(risk, hasResidual(risk) ? "residual" : "inherent");

// ---------- Grado de control (misma fórmula y umbrales que AddRisk) ----------
// Suma: tipo de control + tipo de proceso + 0.10 por cada "Sí" (documentado,
// evidencia, responsable, frecuencia) o 0.01 por cada "No".
// >= 1.10 Fuerte · >= 0.70 Medio · si no Débil · "" si falta algún campo.
export function controlGrade(data, num) {
  const controlType = data?.[`control_type_${num}`];
  const documented = data?.[`control_documented_${num}`];
  const processType = data?.[`process_type_${num}`];
  const evidence = data?.[`control_evidence_${num}`];
  const responsible = data?.[`control_responsible_${num}`];
  const frequency = data?.[`control_frequency_${num}`];

  // Solo calcular si todos los campos tienen valor
  if (!controlType || !documented || !processType || !evidence || !responsible || !frequency) {
    return "";
  }

  const total =
    (CONTROL_TYPE_SCORES[controlType] || 0) +
    (documented === "Sí" ? YES_SCORE : NO_SCORE) +
    (PROCESS_TYPE_SCORES[processType] || 0) +
    (evidence === "Sí" ? YES_SCORE : NO_SCORE) +
    (responsible === "Sí" ? YES_SCORE : NO_SCORE) +
    (frequency === "Sí" ? YES_SCORE : NO_SCORE);

  if (total >= 1.10) return "Fuerte";
  if (total >= 0.70) return "Medio";
  return "Débil";
}

// ---------- Etiquetas ----------
// Clave interna → clave de traducción (t('high') → "Alto" / "High").
const LEVEL_T_KEY = {
  TOLERABLE: "tolerable",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  INTOLERABLE: "intolerable",
  UNCLASSIFIED: "unclassified",
};
const LEVEL_LABEL_ES = {
  tolerable: "Tolerable",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  intolerable: "Intolerable",
  unclassified: "Sin clasificar",
};

// Texto del nivel. Sin `t` devuelve español; con `t` (función de
// LanguageContext) usa la traducción del idioma activo.
export function labelForLevelKey(key, t) {
  const tKey = LEVEL_T_KEY[key] || "unclassified";
  if (typeof t === "function") {
    const translated = t(tKey);
    if (translated && translated !== tKey) return translated;
  }
  return LEVEL_LABEL_ES[tKey];
}
