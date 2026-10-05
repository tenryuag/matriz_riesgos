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
} from "./strategicCatalog.js";

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

export function perspectiveFor(item) {
  const [src, key] = String(item?.id || "").split(":");
  // Riesgos críticos de la matriz ('risk:<id>'): traen su perspectiva
  // puesta (perspective, o perspective_key tal cual viene de la tabla
  // risks); si no la traen, null (no se inventa un carril).
  if (src === "risk") return item.perspective || item.perspective_key || null;
  if (src === "mkt") return "cliente";
  if (src === "fin") return key === "ventas_area_comercial" ? "competitiva" : "financiera";
  if (src !== "opp") return "cliente";
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
