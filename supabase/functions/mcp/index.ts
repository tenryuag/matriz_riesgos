// ============================================================
// Servidor MCP de la app (solo lectura, v1).
// ------------------------------------------------------------
// Expone los datos del usuario que inició sesión (matriz de riesgos,
// planeación estratégica y análisis financiero) a clientes MCP como
// Claude, con el patrón oficial de Supabase:
//   - withOAuthProtectedResource(): descubrimiento OAuth 2.1 (Supabase Auth
//     es el servidor de autorización; la app aloja /oauth/consent).
//   - Verificación del bearer token contra el servidor de Auth del proyecto
//     (auth.getUser). No se usa withSupabase({ auth: 'user' }) porque esa
//     verificación es local contra el JWKS y rechaza los tokens HS256 del
//     esquema de llaves heredado que usa este proyecto. Con el token del
//     usuario se crea el cliente de datos → las políticas RLS "solo el
//     dueño" aplican a cada herramienta sin código adicional.
// Los cálculos (estados financieros, prioridades, FODA) son los MISMOS
// módulos puros que usa la app, copiados con `npm run mcp:sync`.
//
// Despliegue: npx supabase functions deploy mcp --no-verify-jwt
// URL:        https://<project-ref>.supabase.co/functions/v1/mcp
// ============================================================
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { pipeline } from 'npm:@supabase/middleware@1'
import { withOAuthProtectedResource } from 'npm:@supabase/server@1'
import { unauthorizedResponse } from 'npm:@supabase/server@1/oauth-protected-resource'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@^4.3.6'

import { SALES_SECTION, BALANCE_SECTION, yearLabel } from '../_shared/app/finConfig.js'
import {
  computeIncome,
  computeBalance,
  computeCashflow,
  computeDirectCashflow,
  pctChange,
} from '../_shared/app/finCalc.js'
import {
  CUSTOMER_SECTION,
  CUSTOMER_QUESTIONS,
  MARKET_SECTION,
  compSection,
  COMP_GROUPS,
  OCEAN_QUESTIONS,
  MKT_CONCL_SECTION,
  OPP_SECTION,
  OPP_CONCL_SECTION,
  FIN_SECTION,
  RATING_SECTION,
} from '../_shared/app/strategicCatalog.js'
import {
  collectStrategies,
  scoreFor,
  priorityFor,
  perspectiveFor,
  buildFoda,
} from '../_shared/app/strategicCalc.js'

const VERSION = '1.0.0'

// deno-lint-ignore no-explicit-any
type Db = any

// ---------- utilidades ----------
const text = (obj: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 1) }] })

const RISK_LEVEL_KEY: Record<string, string> = {
  intolerable: 'Intolerable',
  alto: 'Alto', high: 'Alto',
  medio: 'Medio', medium: 'Medio',
  bajo: 'Bajo', low: 'Bajo',
  tolerable: 'Tolerable',
}
const levelKey = (v: string | null | undefined) => (v ? RISK_LEVEL_KEY[String(v).toLowerCase()] || 'Sin clasificar' : 'Sin clasificar')
const LEVEL_ORDER: Record<string, number> = { Intolerable: 0, Alto: 1, Medio: 2, Bajo: 3, Tolerable: 4, 'Sin clasificar': 5 }
const isCritical = (lvl: string) => lvl === 'Alto' || lvl === 'Intolerable'

async function answersFor(supabase: Db, planId: string, sections: string[]) {
  const { data, error } = await supabase
    .from('plan_answers')
    .select('section, question_key, answer')
    .eq('plan_id', planId)
    .in('section', sections)
  if (error) throw new Error(error.message)
  const map: Record<string, Record<string, string>> = {}
  for (const r of data || []) {
    if (!map[r.section]) map[r.section] = {}
    map[r.section][r.question_key] = r.answer || ''
  }
  return map
}

async function getPlan(supabase: Db) {
  const { data, error } = await supabase
    .from('strategic_plans')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

async function getAnalysis(supabase: Db) {
  const { data, error } = await supabase
    .from('fin_analyses')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

async function finContext(supabase: Db) {
  const analysis = await getAnalysis(supabase)
  if (!analysis) return null
  const [{ data: years, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from('fin_years').select('*').eq('analysis_id', analysis.id).order('year', { ascending: true }),
    supabase.from('fin_lines').select('*').eq('analysis_id', analysis.id).order('position', { ascending: true }),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  const { data: values, error: e3 } = await supabase
    .from('fin_values')
    .select('year_id, section, concept_key, amount')
    .eq('analysis_id', analysis.id)
  if (e3) throw new Error(e3.message)
  const sections: Record<string, Record<string, Record<string, number>>> = {}
  for (const r of values || []) {
    sections[r.section] ??= {}
    sections[r.section][r.concept_key] ??= {}
    sections[r.section][r.concept_key][r.year_id] = r.amount
  }
  return { analysis, years: years || [], lines: lines || [], sections }
}

const compactRisk = (r: Db) => ({
  id: r.id,
  descripcion: r.description,
  tipo_amenaza: r.threat_type,
  nivel_inherente: levelKey(r.inherent_level),
  nivel_residual: levelKey(r.residual_level),
  estrategia: r.risk_strategy || null,
  mitigantes: [1, 2, 3].filter((n) => (r[`mitigant_${n}`] || '').trim()).length,
  departamento_id: r.department_id,
})

const fullRisk = (r: Db, deptName: string | null) => ({
  id: r.id,
  departamento: deptName,
  tipo_amenaza: r.threat_type,
  descripcion: r.description,
  inherente: { probabilidad: r.inherent_probability, impacto: r.inherent_impact, nivel: levelKey(r.inherent_level) },
  estrategia: r.risk_strategy || null,
  controles: [1, 2, 3]
    .filter((n) => (r[`mitigant_${n}`] || '').trim())
    .map((n) => ({
      descripcion: r[`mitigant_${n}`],
      que_mitiga: r[`mitigant_impact_${n}`] || null,
      tipo_control: r[`control_type_${n}`] || null,
      documentado: r[`control_documented_${n}`] || null,
      proceso: r[`process_type_${n}`] || null,
      genera_evidencia: r[`control_evidence_${n}`] || null,
      tiene_responsable: r[`control_responsible_${n}`] || null,
      se_ejecuta_con_frecuencia: r[`control_frequency_${n}`] || null,
      grado_de_control: r[`control_grade_${n}`] || null,
    })),
  residual: { probabilidad: r.residual_probability, impacto: r.residual_impact, nivel: levelKey(r.residual_level) },
  creado: r.created_at,
})

// ---------- autenticación ----------
// Verifica el bearer token con el servidor de Auth y devuelve un cliente
// Supabase que lleva ese token en cada petición (RLS del usuario).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

async function clientForRequest(req: Request): Promise<Db | null> {
  const header = req.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1].trim()
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user || data.user.role !== 'authenticated') return null
  return supabase
}

// ---------- servidor ----------
Deno.serve(
  pipeline(
    [withOAuthProtectedResource()],
    async (req) => {
      const supabase = await clientForRequest(req)
      if (!supabase) return unauthorizedResponse(req)

      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: 'mara-perez', version: VERSION })

        // ===== General =====
        server.registerTool(
          'resumen_general',
          {
            description:
              'Vista rápida de los tres módulos del usuario: riesgos críticos, prioridades del plan estratégico, iniciativas vencidas y últimas cifras financieras. Úsala primero para orientarte.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const out: Record<string, unknown> = { version: VERSION }
            const { data: risks, error } = await supabase.from('risks').select('*')
            if (error) throw new Error(error.message)
            const rs = (risks || []).map(compactRisk)
            const criticos = rs.filter((r: Db) => isCritical(r.nivel_inherente))
            out.riesgos = {
              total: rs.length,
              criticos_inherente: criticos.length,
              criticos_sin_controles: criticos.filter((r: Db) => r.mitigantes === 0).length,
              por_nivel_residual: Object.fromEntries(
                Object.keys(LEVEL_ORDER).map((k) => [k, rs.filter((r: Db) => r.nivel_residual === k).length])
              ),
            }
            const plan = await getPlan(supabase)
            if (plan) {
              const sections = await answersFor(supabase, plan.id, [MKT_CONCL_SECTION, OPP_SECTION, OPP_CONCL_SECTION, FIN_SECTION, RATING_SECTION])
              const ratings = sections[RATING_SECTION] || {}
              const { weaknesses } = collectStrategies(sections)
              const scored = weaknesses.map((w: Db) => ({ ...w, priority: priorityFor(scoreFor(ratings, w.id)) }))
              const { data: inits } = await supabase.from('strategic_initiatives').select('id, end_date, owner').eq('plan_id', plan.id)
              const today = new Date().toISOString().slice(0, 10)
              out.planeacion_estrategica = {
                vision: plan.vision || null,
                debilidades: scored.length,
                prioridad_alta: scored.filter((w: Db) => w.priority === 'Alta').length,
                sin_calificar: scored.filter((w: Db) => !w.priority).length,
                iniciativas: (inits || []).length,
                iniciativas_vencidas: (inits || []).filter((i: Db) => i.end_date && i.end_date < today).length,
                iniciativas_sin_responsable: (inits || []).filter((i: Db) => !(i.owner || '').trim()).length,
              }
            } else {
              out.planeacion_estrategica = 'Aún no ha empezado su planeación estratégica.'
            }
            const fin = await finContext(supabase)
            if (fin && fin.years.length) {
              const inc = computeIncome({ sections: fin.sections, years: fin.years, lines: fin.lines }) as Record<string, Db>
              const last = fin.years[fin.years.length - 1]
              const r = inc[last.id]
              out.analisis_financiero = {
                empresa: fin.analysis.company_name || null,
                moneda: fin.analysis.currency,
                unidad: 'miles',
                ultimo_periodo: yearLabel(last),
                ventas: r.ventas,
                utilidad_neta: r.utilidadNeta,
                margen_neto: r.ventas ? Math.round((r.utilidadNeta / r.ventas) * 1000) / 10 : null,
              }
            } else {
              out.analisis_financiero = 'Aún no ha capturado información financiera.'
            }
            return text(out)
          }
        )

        // ===== Matriz de riesgos =====
        server.registerTool(
          'listar_departamentos',
          {
            description: 'Lista los departamentos del usuario con el número de riesgos de cada uno.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const [{ data: deps, error: e1 }, { data: risks, error: e2 }] = await Promise.all([
              supabase.from('departments').select('id, name, description'),
              supabase.from('risks').select('id, department_id, inherent_level, residual_level'),
            ])
            if (e1) throw new Error(e1.message)
            if (e2) throw new Error(e2.message)
            return text(
              (deps || []).map((d: Db) => {
                const own = (risks || []).filter((r: Db) => r.department_id === d.id)
                return {
                  id: d.id,
                  nombre: d.name,
                  descripcion: d.description || null,
                  riesgos: own.length,
                  criticos_inherente: own.filter((r: Db) => isCritical(levelKey(r.inherent_level))).length,
                }
              })
            )
          }
        )

        server.registerTool(
          'listar_riesgos',
          {
            description:
              'Lista los riesgos del usuario. Filtra por nivel (inherente o residual), tipo de amenaza, departamento o texto. Devuelve una versión compacta; usa obtener_riesgo para el detalle con controles.',
            inputSchema: z.object({
              nivel: z.enum(['Intolerable', 'Alto', 'Medio', 'Bajo', 'Tolerable']).optional().describe('Filtra por nivel'),
              criterio: z.enum(['inherente', 'residual']).default('residual').describe('Qué nivel usar para el filtro y el orden'),
              tipo_amenaza: z.enum(['Interna', 'Externa']).optional(),
              departamento: z.string().optional().describe('Nombre (o parte) del departamento'),
              buscar: z.string().optional().describe('Texto a buscar en la descripción'),
              limite: z.number().int().min(1).max(200).default(50),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ nivel, criterio, tipo_amenaza, departamento, buscar, limite }) => {
            const [{ data: risks, error: e1 }, { data: deps, error: e2 }] = await Promise.all([
              supabase.from('risks').select('*').order('created_at', { ascending: false }),
              supabase.from('departments').select('id, name'),
            ])
            if (e1) throw new Error(e1.message)
            if (e2) throw new Error(e2.message)
            const depName = new Map((deps || []).map((d: Db) => [d.id, d.name]))
            const lvl = (r: Db) => (criterio === 'inherente' ? levelKey(r.inherent_level) : levelKey(r.residual_level))
            let rows = (risks || []) as Db[]
            if (nivel) rows = rows.filter((r) => lvl(r) === nivel)
            if (tipo_amenaza) rows = rows.filter((r) => r.threat_type === tipo_amenaza)
            if (departamento) {
              const q = departamento.toLowerCase()
              rows = rows.filter((r) => String(depName.get(r.department_id) || '').toLowerCase().includes(q))
            }
            if (buscar) {
              const q = buscar.toLowerCase()
              rows = rows.filter((r) => String(r.description || '').toLowerCase().includes(q))
            }
            rows.sort((a, b) => LEVEL_ORDER[lvl(a)] - LEVEL_ORDER[lvl(b)])
            return text({
              total: rows.length,
              mostrando: Math.min(rows.length, limite),
              riesgos: rows.slice(0, limite).map((r) => ({ ...compactRisk(r), departamento: depName.get(r.department_id) || null })),
            })
          }
        )

        server.registerTool(
          'obtener_riesgo',
          {
            description: 'Detalle completo de un riesgo: calificación inherente, estrategia, controles (mitigantes) con su evaluación y nivel residual.',
            inputSchema: z.object({ id: z.string().describe('Id del riesgo (de listar_riesgos)') }),
            annotations: { readOnlyHint: true },
          },
          async ({ id }) => {
            const { data: r, error } = await supabase.from('risks').select('*').eq('id', id).maybeSingle()
            if (error) throw new Error(error.message)
            if (!r) throw new Error('No existe un riesgo con ese id (o no pertenece al usuario).')
            let dep: string | null = null
            if (r.department_id) {
              const { data: d } = await supabase.from('departments').select('name').eq('id', r.department_id).maybeSingle()
              dep = d?.name || null
            }
            return text(fullRisk(r, dep))
          }
        )

        server.registerTool(
          'resumen_riesgos',
          {
            description:
              'Resumen de la matriz: conteos por nivel inherente y residual, por departamento, riesgos críticos (inherente Alto/Intolerable) y cuáles no tienen controles. Útil para priorizar.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const [{ data: risks, error: e1 }, { data: deps, error: e2 }] = await Promise.all([
              supabase.from('risks').select('*'),
              supabase.from('departments').select('id, name'),
            ])
            if (e1) throw new Error(e1.message)
            if (e2) throw new Error(e2.message)
            const depName = new Map((deps || []).map((d: Db) => [d.id, d.name]))
            const rs = (risks || []).map((r: Db) => ({ ...compactRisk(r), departamento: depName.get(r.department_id) || null }))
            const count = (f: (r: Db) => string) =>
              Object.fromEntries(Object.keys(LEVEL_ORDER).map((k) => [k, rs.filter((r: Db) => f(r) === k).length]))
            const criticos = rs.filter((r: Db) => isCritical(r.nivel_inherente))
            const porDepto: Record<string, number> = {}
            rs.forEach((r: Db) => { const k = r.departamento || 'Sin departamento'; porDepto[k] = (porDepto[k] || 0) + 1 })
            return text({
              total: rs.length,
              por_nivel_inherente: count((r) => r.nivel_inherente),
              por_nivel_residual: count((r) => r.nivel_residual),
              por_departamento: porDepto,
              criticos_inherente: {
                total: criticos.length,
                sin_controles: criticos.filter((r: Db) => r.mitigantes === 0).map((r: Db) => ({ id: r.id, descripcion: r.descripcion, nivel: r.nivel_inherente })),
                con_residual_aun_alto: criticos.filter((r: Db) => isCritical(r.nivel_residual)).map((r: Db) => ({ id: r.id, descripcion: r.descripcion, residual: r.nivel_residual })),
              },
            })
          }
        )

        // ===== Planeación estratégica =====
        server.registerTool(
          'resumen_plan',
          {
            description: 'Identidad del plan (visión, misión, valores, año) y avance de cada paso de la planeación estratégica.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const plan = await getPlan(supabase)
            if (!plan) return text({ mensaje: 'El usuario aún no ha empezado su planeación estratégica.' })
            const sections = await answersFor(supabase, plan.id, [CUSTOMER_SECTION, MARKET_SECTION, MKT_CONCL_SECTION, OPP_SECTION, OPP_CONCL_SECTION, FIN_SECTION, RATING_SECTION])
            const { data: comps } = await supabase.from('competitors').select('id, name').eq('plan_id', plan.id)
            const { data: inits } = await supabase.from('strategic_initiatives').select('id').eq('plan_id', plan.id)
            const ratings = sections[RATING_SECTION] || {}
            const { weaknesses, strengths } = collectStrategies(sections)
            const prio = weaknesses.map((w: Db) => priorityFor(scoreFor(ratings, w.id)))
            const customer = sections[CUSTOMER_SECTION] || {}
            return text({
              identidad: { nombre: plan.name, vision: plan.vision || null, mision: plan.mission || null, valores: plan.core_values || null, anio: plan.year || null },
              avance: {
                analisis_cliente: `${CUSTOMER_QUESTIONS.filter((q: Db) => (customer[q.key] || '').trim()).length} de ${CUSTOMER_QUESTIONS.length} preguntas`,
                competidores: (comps || []).length,
                conclusiones_mercado: Object.values(sections[MKT_CONCL_SECTION] || {}).filter(Boolean).length,
                oportunidades_respondidas: Object.values(sections[OPP_SECTION] || {}).filter(Boolean).length,
                estrategias_financieras_marcadas: Object.values(sections[FIN_SECTION] || {}).filter(Boolean).length,
                fortalezas: strengths.length,
                debilidades: weaknesses.length,
                prioridad_alta: prio.filter((p) => p === 'Alta').length,
                prioridad_media: prio.filter((p) => p === 'Media').length,
                prioridad_baja: prio.filter((p) => p === 'Baja').length,
                sin_calificar: prio.filter((p) => !p).length,
                iniciativas: (inits || []).length,
              },
            })
          }
        )

        server.registerTool(
          'prioridades',
          {
            description:
              'Debilidades (estrategias a cambiar) del plan con su puntaje y prioridad (Alta = empezar por aquí), su perspectiva del mapa estratégico y cuántas iniciativas tiene cada una.',
            inputSchema: z.object({
              prioridad: z.enum(['Alta', 'Media', 'Baja', 'Sin calificar']).optional(),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ prioridad }) => {
            const plan = await getPlan(supabase)
            if (!plan) return text({ mensaje: 'El usuario aún no ha empezado su planeación estratégica.' })
            const sections = await answersFor(supabase, plan.id, [MKT_CONCL_SECTION, OPP_SECTION, OPP_CONCL_SECTION, FIN_SECTION, RATING_SECTION])
            const ratings = sections[RATING_SECTION] || {}
            const { data: inits } = await supabase.from('strategic_initiatives').select('strategy_id').eq('plan_id', plan.id)
            const initCount: Record<string, number> = {}
            for (const i of inits || []) initCount[i.strategy_id] = (initCount[i.strategy_id] || 0) + 1
            const SOURCE = { market: 'Análisis del mercado', opportunities: 'Oportunidades', financial: 'Finanzas' } as Record<string, string>
            let rows = collectStrategies(sections).weaknesses.map((w: Db) => {
              const score = scoreFor(ratings, w.id)
              return {
                id: w.id,
                estrategia: w.label,
                fuente: SOURCE[w.source] || w.source,
                perspectiva: perspectiveFor(w),
                puntaje: score,
                prioridad: priorityFor(score) || 'Sin calificar',
                calificaciones: {
                  costo: ratings[`${w.id}:costo`] || null,
                  riesgo: ratings[`${w.id}:riesgo`] || null,
                  complejidad: ratings[`${w.id}:complejidad`] || null,
                  beneficio: ratings[`${w.id}:beneficio`] || null,
                },
                iniciativas: initCount[w.id] || 0,
              }
            })
            if (prioridad) rows = rows.filter((r: Db) => r.prioridad === prioridad)
            rows.sort((a: Db, b: Db) => (a.puntaje ?? 9) - (b.puntaje ?? 9))
            return text({ nota: 'Puntaje bajo = atacar primero (1–1.39 Alta, 1.4–2.34 Media, 2.35–3 Baja).', total: rows.length, estrategias: rows })
          }
        )

        server.registerTool(
          'foda',
          {
            description: 'FODA automático del plan: fortalezas y debilidades (con prioridad) de las conclusiones, oportunidades Blue Ocean y amenazas detectadas en la comparación con competidores.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const plan = await getPlan(supabase)
            if (!plan) return text({ mensaje: 'El usuario aún no ha empezado su planeación estratégica.' })
            const { data: comps, error } = await supabase.from('competitors').select('id, name').eq('plan_id', plan.id)
            if (error) throw new Error(error.message)
            const sections = await answersFor(supabase, plan.id, [
              MARKET_SECTION, MKT_CONCL_SECTION, OPP_SECTION, OPP_CONCL_SECTION, FIN_SECTION, RATING_SECTION,
              ...(comps || []).map((c: Db) => compSection(c.id)),
            ])
            return text(buildFoda({ sections, competitors: comps || [], ratings: sections[RATING_SECTION] || {} }))
          }
        )

        server.registerTool(
          'iniciativas',
          {
            description: 'Iniciativas del plan de acción con objetivo, responsable, fechas, presupuesto, KPI y estado (vencida, próxima a vencer, sin responsable).',
            inputSchema: z.object({
              filtro: z.enum(['todas', 'vencidas', 'proximas_30_dias', 'sin_responsable', 'sin_fecha']).default('todas'),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ filtro }) => {
            const plan = await getPlan(supabase)
            if (!plan) return text({ mensaje: 'El usuario aún no ha empezado su planeación estratégica.' })
            const [{ data: inits, error }, sections] = await Promise.all([
              supabase.from('strategic_initiatives').select('*').eq('plan_id', plan.id).order('position', { ascending: true }),
              answersFor(supabase, plan.id, [MKT_CONCL_SECTION, OPP_SECTION, OPP_CONCL_SECTION, FIN_SECTION]),
            ])
            if (error) throw new Error(error.message)
            const labels = new Map(collectStrategies(sections).weaknesses.map((w: Db) => [w.id, w.label]))
            const today = new Date()
            const in30 = new Date(today.getTime() + 30 * 86400000)
            const estado = (i: Db) => {
              if (!i.end_date) return 'sin fecha'
              const d = new Date(i.end_date)
              if (d < today) return 'vencida'
              if (d <= in30) return 'vence en menos de 30 días'
              return 'en curso'
            }
            let rows = (inits || []).map((i: Db) => ({
              id: i.id,
              objetivo: labels.get(i.strategy_id) || i.strategy_id,
              titulo: i.title,
              resultado_esperado: i.expected_result || null,
              area: i.area || null,
              responsable: i.owner || null,
              inicio: i.start_date || null,
              fin: i.end_date || null,
              presupuesto: i.budget,
              kpi: i.kpi || null,
              pasos: i.steps || null,
              estado: estado(i),
            }))
            if (filtro === 'vencidas') rows = rows.filter((r: Db) => r.estado === 'vencida')
            if (filtro === 'proximas_30_dias') rows = rows.filter((r: Db) => r.estado === 'vence en menos de 30 días')
            if (filtro === 'sin_responsable') rows = rows.filter((r: Db) => !r.responsable)
            if (filtro === 'sin_fecha') rows = rows.filter((r: Db) => !r.fin)
            const presupuesto = rows.reduce((s: number, r: Db) => s + (Number(r.presupuesto) || 0), 0)
            return text({ total: rows.length, presupuesto_total: presupuesto, iniciativas: rows })
          }
        )

        server.registerTool(
          'analisis_cliente',
          {
            description: 'Las 9 preguntas del análisis del cliente con las respuestas del usuario (dolores, deseos, metas, objeciones, promesa de transformación).',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const plan = await getPlan(supabase)
            if (!plan) return text({ mensaje: 'El usuario aún no ha empezado su planeación estratégica.' })
            const sections = await answersFor(supabase, plan.id, [CUSTOMER_SECTION])
            const a = sections[CUSTOMER_SECTION] || {}
            return text(CUSTOMER_QUESTIONS.map((q: Db) => ({ clave: q.key, pregunta: q.q, respuesta: a[q.key] || null })))
          }
        )

        server.registerTool(
          'competidores',
          {
            description: 'Competidores registrados y la comparación capturada contra cada uno (precio, servicio, post-venta, entrega, imagen, mercado, publicidad), más las respuestas Blue Ocean del mercado.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const plan = await getPlan(supabase)
            if (!plan) return text({ mensaje: 'El usuario aún no ha empezado su planeación estratégica.' })
            const { data: comps, error } = await supabase.from('competitors').select('id, name').eq('plan_id', plan.id).order('position', { ascending: true })
            if (error) throw new Error(error.message)
            const sections = await answersFor(supabase, plan.id, [MARKET_SECTION, ...(comps || []).map((c: Db) => compSection(c.id))])
            const market = sections[MARKET_SECTION] || {}
            return text({
              competidores: (comps || []).map((c: Db) => {
                const a = sections[compSection(c.id)] || {}
                return {
                  nombre: c.name,
                  comparacion: COMP_GROUPS.map((g: Db) => ({
                    tema: g.title,
                    respuestas: g.questions.filter((q: Db) => a[q.key]).map((q: Db) => ({ pregunta: q.q, respuesta: a[q.key] })),
                  })).filter((g: Db) => g.respuestas.length),
                }
              }),
              blue_ocean: OCEAN_QUESTIONS.map((q: Db) => ({ accion: q.label, pregunta: q.q, respuesta: market[q.key] || null })),
            })
          }
        )

        // ===== Análisis financiero =====
        server.registerTool(
          'empresa_financiera',
          {
            description: 'Datos generales de la empresa en el análisis financiero (nombre, país, actividad, moneda), los años capturados y las líneas de negocio. Todas las cifras del módulo están en miles.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin) return text({ mensaje: 'El usuario aún no ha empezado su análisis financiero.' })
            const sales = fin.sections[SALES_SECTION] || {}
            return text({
              empresa: {
                nombre: fin.analysis.company_name || null,
                pais: fin.analysis.country || null,
                actividad_principal: fin.analysis.main_activity || null,
                actividades_secundarias: fin.analysis.secondary_activities || null,
                moneda: fin.analysis.currency,
                unidad: 'miles',
              },
              anios: fin.years.map((y: Db) => ({ id: y.id, etiqueta: yearLabel(y), anio: y.year, meses: y.months, parcial: y.months < 12 })),
              lineas_de_negocio: fin.lines.map((l: Db) => ({
                nombre: l.name,
                ventas_por_anio: Object.fromEntries(fin.years.map((y: Db) => [yearLabel(y), sales[l.id]?.[y.id] ?? null])),
              })),
            })
          }
        )

        server.registerTool(
          'estado_resultados',
          {
            description: 'Estado de resultados por año (ventas, costo, utilidad bruta, gastos, resultado de operación, EBITDA, utilidad neta) con márgenes y variación contra el año anterior. Cifras en miles; los periodos parciales se marcan.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin || !fin.years.length) return text({ mensaje: 'El usuario aún no ha capturado años en su análisis financiero.' })
            const inc = computeIncome({ sections: fin.sections, years: fin.years, lines: fin.lines }) as Record<string, Db>
            const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null)
            const pctFrac = (f: number | null) => (f == null ? null : Math.round(f * 1000) / 10)
            const rows = fin.years.map((y: Db, i: number) => {
              const r = inc[y.id]
              const prev = i > 0 ? inc[fin.years[i - 1].id] : null
              return {
                periodo: yearLabel(y),
                parcial: y.months < 12 ? `${y.months} meses` : null,
                ventas: r.ventas,
                costo_de_ventas: r.costo,
                utilidad_bruta: r.utilidadBruta,
                gastos_operacion: r.admVentas,
                depreciacion: r.depreciacion,
                otros_ingresos_gastos_operacion: r.otrosOp,
                resultado_de_operacion: r.resultadoOp,
                ebitda: r.ebitda,
                resultado_antes_de_impuestos: r.rai,
                utilidad_neta: r.utilidadNeta,
                margenes_pct: {
                  bruto: pct(r.utilidadBruta, r.ventas),
                  operativo: pct(r.resultadoOp, r.ventas),
                  ebitda: pct(r.ebitda, r.ventas),
                  neto: pct(r.utilidadNeta, r.ventas),
                },
                variacion_vs_anterior_pct: prev
                  ? { ventas: pctFrac(pctChange(r.ventas, prev.ventas)), utilidad_neta: pctFrac(pctChange(r.utilidadNeta, prev.utilidadNeta)) }
                  : null,
              }
            })
            return text({ moneda: fin.analysis.currency, unidad: 'miles', nota: 'EBITDA = resultado de operación + depreciación.', periodos: rows })
          }
        )

        server.registerTool(
          'balance_general',
          {
            description: 'Balance general por año: totales de activo, pasivo y capital, y si cuadra (Activo = Pasivo + Capital). Cifras en miles.',
            inputSchema: z.object({ detalle: z.boolean().default(false).describe('Incluir todas las cuentas capturadas') }),
            annotations: { readOnlyHint: true },
          },
          async ({ detalle }) => {
            const fin = await finContext(supabase)
            if (!fin || !fin.years.length) return text({ mensaje: 'El usuario aún no ha capturado años en su análisis financiero.' })
            const bal = computeBalance({ sections: fin.sections, years: fin.years }) as Record<string, Db>
            const cuentas = fin.sections[BALANCE_SECTION] || {}
            const rows = fin.years.map((y: Db) => {
              const b = bal[y.id]
              const out: Record<string, unknown> = {
                periodo: yearLabel(y),
                activo_circulante: b.activoCirculante,
                activo_no_circulante: b.activoNoCirculante,
                total_activo: b.totalActivo,
                pasivo_circulante: b.pasivoCirculante,
                pasivo_largo_plazo: b.pasivoLargoPlazo,
                total_pasivo: b.totalPasivo,
                total_capital: b.totalCapital,
                diferencia: b.diferencia,
                cuadra: Math.abs(b.diferencia) <= 0.5,
              }
              if (detalle) {
                out.cuentas = Object.fromEntries(
                  Object.entries(cuentas).map(([k, byYear]: [string, Db]) => [k, byYear[y.id] ?? null]).filter(([, v]) => v != null)
                )
              }
              return out
            })
            return text({ moneda: fin.analysis.currency, unidad: 'miles', periodos: rows })
          }
        )

        server.registerTool(
          'flujo_efectivo',
          {
            description: 'Estado de cambios (método indirecto) y flujo directo por año: flujo de operación, inversión, financiamiento, caja inicial/final y la diferencia contra el balance. Cifras en miles.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin || fin.years.length < 2) return text({ mensaje: 'El flujo de efectivo necesita al menos dos años capturados.' })
            const flows = computeCashflow({ sections: fin.sections, years: fin.years, lines: fin.lines }) as Record<string, Db>
            const direct = computeDirectCashflow({ sections: fin.sections, years: fin.years }) as Record<string, Db>
            return text({
              moneda: fin.analysis.currency,
              unidad: 'miles',
              estado_de_cambios: fin.years.slice(1).map((y: Db) => {
                const f = flows[y.id]
                return {
                  periodo: yearLabel(y),
                  utilidad_neta: f.utilidadNeta,
                  depreciacion: f.depreciacion,
                  variacion_capital_de_trabajo: f.wcTotal,
                  flujo_operacion: f.flujoOperacion,
                  flujo_inversion: f.flujoInversion,
                  flujo_financiamiento: f.flujoFinanciamiento,
                  flujo_neto: f.flujoNeto,
                  caja_inicial: f.cajaInicial,
                  caja_final_calculada: f.cajaFinalCalculada,
                  caja_final_balance: f.cajaFinalBalance,
                  diferencia: f.diferencia,
                }
              }),
              flujo_directo: fin.years.map((y: Db) => {
                const d = direct[y.id]
                return {
                  periodo: yearLabel(y),
                  saldo_inicial: d.saldoInicial,
                  entradas_operacion: d.groups.entradas,
                  salidas_operacion: d.groups.salidas,
                  flujo_operacion: d.flujoOperacion,
                  inversion: d.groups.inversion,
                  financiamiento: d.groups.financiamiento,
                  flujo_neto: d.flujoNeto,
                  acumulado: d.acumulado,
                }
              }),
            })
          }
        )

        return server
      })

      return handler.fetch(req)
    }
  )
)
