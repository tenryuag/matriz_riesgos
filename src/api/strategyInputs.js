// ============================================================
// Carga unificada de los insumos de la Planeación Estratégica
// (Proyecto Perspectivas, Fase 0).
//
// Hoy cada página del módulo arma su propia combinación de consultas
// (plan + secciones de plan_answers + competidores + iniciativas). Esta
// función reúne todo en una sola llamada y añade dos insumos nuevos:
//
// - risks: los riesgos críticos de la matriz (nivel INHERENTE Alto o
//   Intolerable, puntaje >= 13), que entrarán a la planeación como objetivos
//   de prioridad alta con sus mitigantes.
// - decisions: lo que el usuario ya decidió sobre esos riesgos, guardado en
//   plan_answers: 'risk-controls' (mitigantes adoptados como iniciativas) y
//   'risk-objectives' (riesgos aceptados o descartados como objetivos).
//
// Acceso por módulo: los riesgos solo se consultan si `includeRisks` es
// true. Las páginas deben pasarlo según el acceso del usuario al módulo de
// riesgos, leído del contexto de módulos:
//
//   import { useModuleAccess } from "@/components/ModuleAccessContext";
//   import { MODULES, canAccessModule } from "@/config/modules";
//   const { isAdmin, grantedModules } = useModuleAccess();
//   const riskModule = MODULES.find((m) => m.key === "risk");
//   const inputs = await loadStrategyInputs({
//     includeRisks: canAccessModule(riskModule, { isAdmin, grantedModules }),
//   });
//
// Un usuario sin el módulo de riesgos no debe ver ni consultar riesgos; si a
// pesar de eso la consulta falla por permisos, `risks` queda vacío y la
// planeación sigue funcionando (se registra en consola).
//
// Las páginas de esta fase NO la usan todavía; queda lista para las
// pantallas de fases posteriores.
// ============================================================
import {
  StrategicPlan,
  Competitor,
  Initiative,
  Risk,
  PlanAnswer,
} from "@/api/entities";
import { isAuthError } from "@/api/authHelpers";
import {
  MKT_CONCL_SECTION,
  OPP_SECTION,
  OPP_CONCL_SECTION,
  FIN_SECTION,
  RATING_SECTION,
  MARKET_SECTION,
  compSection,
} from "@/config/strategicCatalog";

// Secciones que alimentan collectStrategies. Es la misma lista que
// SUMMARY_SOURCE_SECTIONS en src/pages/StrategicSummary.jsx; se repite aquí
// para que src/api no dependa de una página.
export const STRATEGY_SOURCE_SECTIONS = [
  MKT_CONCL_SECTION,
  OPP_SECTION,
  OPP_CONCL_SECTION,
  FIN_SECTION,
];

// Secciones de plan_answers donde viven las decisiones sobre riesgos.
export const RISK_CONTROLS_SECTION = "risk-controls";
export const RISK_OBJECTIVES_SECTION = "risk-objectives";

// ¿El error es "no tienes permiso" (RLS / grants) y no un fallo real?
function isPermissionError(error) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "42501" || // insufficient_privilege
    Number(error.status) === 403 ||
    msg.includes("permission denied") ||
    msg.includes("row-level security")
  );
}

// ¿La BD aún no tiene las columnas de la Fase 0 (SQL sin correr)?
// Staging y producción comparten base y el SQL se corre a mano, así que la
// planeación no debe romperse si el despliegue llega antes que el SQL.
function isMissingColumnError(error) {
  return error?.code === "42703"; // undefined_column
}

// Riesgos críticos con red de seguridad: ante un error de permisos (o de
// columnas aún inexistentes) devuelve [] y lo registra en consola. Los
// errores de sesión se relanzan (handleQueryError ya está cerrando sesión).
async function loadCriticalRisks() {
  try {
    return await Risk.listCritical();
  } catch (err) {
    if (isAuthError(err)) throw err;
    if (isPermissionError(err) || isMissingColumnError(err)) {
      console.warn(
        "Planeación: no se pudieron leer los riesgos críticos; se continúa sin ellos.",
        err
      );
      return [];
    }
    throw err;
  }
}

// Carga todo lo que necesita una página de la planeación en una llamada.
//
// Devuelve:
//   plan         — strategic_plans del usuario (se crea si no existe)
//   sections     — { [section]: { question_key: answer } } de las secciones
//                  fuente, calificaciones, mercado, competidores y
//                  `extraSections`; toda sección pedida existe (aunque sea {})
//   ratings      — sections[RATING_SECTION] (atajo)
//   competitors  — Competitor.list(plan.id)
//   initiatives  — Initiative.list(plan.id)
//   risks        — Risk.listCritical() si includeRisks; [] si no
//   decisions    — { controls: plan_answers 'risk-controls',
//                    objectives: plan_answers 'risk-objectives' }
export async function loadStrategyInputs({
  includeRisks = true,
  extraSections = [],
} = {}) {
  const plan = await StrategicPlan.getOrCreate();
  if (!plan) throw new Error("No se pudo obtener el plan estratégico");

  const [competitors, initiatives, controls, objectives, risks] =
    await Promise.all([
      Competitor.list(plan.id),
      Initiative.list(plan.id),
      PlanAnswer.getSection(plan.id, RISK_CONTROLS_SECTION),
      PlanAnswer.getSection(plan.id, RISK_OBJECTIVES_SECTION),
      includeRisks ? loadCriticalRisks() : Promise.resolve([]),
    ]);

  // Las secciones de competidores dependen de la lista de competidores, por
  // eso las respuestas se piden en una segunda vuelta.
  const sectionKeys = [
    ...new Set([
      ...STRATEGY_SOURCE_SECTIONS,
      RATING_SECTION,
      MARKET_SECTION,
      ...competitors.map((c) => compSection(c.id)),
      ...(extraSections || []),
    ]),
  ];
  const sections = await StrategicPlan.getAnswersForSections(plan.id, sectionKeys);
  // Garantiza un objeto por sección pedida para que las páginas no tengan que
  // defenderse de undefined.
  sectionKeys.forEach((k) => {
    if (!sections[k]) sections[k] = {};
  });
  const ratings = sections[RATING_SECTION];

  return {
    plan,
    sections,
    ratings,
    competitors,
    initiatives,
    risks,
    decisions: { controls, objectives },
  };
}
