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

import {
  SALES_SECTION,
  SEGCOST_SECTION,
  BALANCE_SECTION,
  EXPENSES_SECTION,
  SEASONALITY_SECTION,
  BALANCE_GROUPS,
  EXPENSE_CONCEPTS,
  SEASON_MONTHS,
  yearLabel,
  RATIO_GROUPS,
  RATIO_DEFS,
  RATIO_BY_KEY,
  RATIO_STATUS_LABEL,
  formatRatio,
} from '../_shared/app/finConfig.js'
import {
  computeIncome,
  computeBalance,
  computeEbitda,
  computeCashflow,
  computeRatios,
  summarizeRatios,
  computeSegments,
  computeExpenseBreakdown,
  computeSeasonality,
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

const VERSION = '1.1.0'

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

// ---------- utilidades del análisis financiero (modelo MP-AFH1) ----------
// Fracción → porcentaje con un decimal (0.3187 → 31.9); null si no hay valor.
const pctFrac = (f: number | null | undefined) => (f == null || !isFinite(f) ? null : Math.round(f * 1000) / 10)
// Un estado "cuadra" cuando su diferencia es despreciable (cifras en miles).
const cuadra = (d: number) => Math.abs(d) <= 0.5
// ¿La sección tiene al menos una cifra capturada?
const hasAny = (sec: Record<string, Record<string, number>> | undefined) =>
  !!sec && Object.values(sec).some((byYear) => Object.values(byYear).some((v) => v != null))
// "6 meses" para un periodo parcial; null en un año completo.
const parcialDe = (y: Db) => (y.months < 12 ? `${y.months} meses` : null)
// Renglones del Estado de Resultados en el orden del estado:
// [clave en computeIncome, clave de salida de la herramienta].
const INCOME_OUT: [string, string][] = [
  ['ventas', 'ventas'],
  ['costo', 'costo_de_ventas'],
  ['utilidadBruta', 'utilidad_bruta'],
  ['gastoVenta', 'gasto_de_venta'],
  ['gastoAdmin', 'gasto_de_administracion'],
  ['gastoGeneral', 'gastos_operativos_en_general'],
  ['gastoOperativo', 'gasto_operativo'],
  ['resultadoOp', 'resultado_de_operacion'],
  ['prodFin', 'productos_financieros'],
  ['gastosFin', 'gastos_financieros'],
  ['cambiaria', 'utilidad_cambiaria'],
  ['rif', 'resultado_integral_de_financiamiento'],
  ['otrosProd', 'otros_productos'],
  ['rai', 'resultado_antes_de_impuestos'],
  ['isr', 'isr'],
  ['ptu', 'ptu'],
  ['utilidadNeta', 'utilidad_neta'],
]

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
// URL pública del conector cuando se sirve detrás del proxy de Netlify
// (secreto PUBLIC_MCP_URL, p. ej. https://app.mara-perez.online/mcp). Si no
// está, se anuncia la URL directa de la función.
const PUBLIC_MCP_URL = (Deno.env.get('PUBLIC_MCP_URL') || '').replace(/\/+$/, '')
const APP_URL = Deno.env.get('PUBLIC_APP_URL') || 'https://app.mara-perez.online'
// Llave de API para el cliente de datos: la publicable nueva (secreto
// PUBLISHABLE_KEY, formato sb_publishable_…) si ya se migraron las llaves del
// proyecto; si no, la anon heredada que inyecta la plataforma.
const SUPABASE_ANON_KEY = Deno.env.get('PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''

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

// ---------- accesos por módulo ----------
// Mismas reglas que la app: los administradores (is_admin) ven todo; el resto
// solo los módulos concedidos en user_module_access (RLS: cada quien lee los
// suyos). Las herramientas se registran según estos accesos.
type Access = { admin: boolean; modules: Set<string> }
async function accessFor(supabase: Db): Promise<Access> {
  const [adminRes, rowsRes] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.from('user_module_access').select('module_key'),
  ])
  const modules = new Set<string>(((rowsRes?.data as Db[]) || []).map((r: Db) => r.module_key))
  return { admin: adminRes?.data === true, modules }
}
const can = (a: Access, m: string) => a.admin || a.modules.has(m)

// ---------- servidor ----------
Deno.serve(
  pipeline(
    [withOAuthProtectedResource(PUBLIC_MCP_URL ? { resourceServer: PUBLIC_MCP_URL } : {})],
    async (req) => {
      const supabase = await clientForRequest(req)
      if (!supabase) {
        return unauthorizedResponse(
          req,
          PUBLIC_MCP_URL ? { resourceMetadataUrl: `${PUBLIC_MCP_URL}/oauth-protected-resource` } : undefined
        )
      }

      const access = await accessFor(supabase)
      const handler = createMcpHandler(() => {
        const server = new McpServer({
          name: 'mara-perez',
          version: VERSION,
          // Metadatos de la especificación MCP 2025-11-25 (título, sitio e icono);
          // los clientes que ya los soportan muestran el logo de la empresa.
          title: 'Mara Pérez',
          websiteUrl: APP_URL,
          icons: [{ src: `${APP_URL}/apple-touch-icon-180x180.png`, mimeType: 'image/png', sizes: ['180x180'] }],
        })

        // ===== General =====
        server.registerTool(
          'resumen_general',
          {
            description:
              'Vista rápida de los módulos a los que el usuario tiene acceso (riesgos críticos, prioridades del plan estratégico, iniciativas vencidas, últimas cifras financieras: ventas, crecimiento, margen operativo, liquidez y semáforo). Úsala primero para orientarte.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const out: Record<string, unknown> = { version: VERSION }
            if (!access.admin && access.modules.size === 0) {
              return text({ mensaje: 'Esta cuenta no tiene módulos asignados en el software. Pide acceso a un administrador.' })
            }
            if (can(access, 'risk')) {
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
            }
            if (can(access, 'strategic')) {
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
            }
            if (can(access, 'fin-analysis')) {
            const fin = await finContext(supabase)
            if (fin && fin.years.length) {
              const inc = computeIncome({ sections: fin.sections, years: fin.years }) as Record<string, Db>
              const ratios = computeRatios({ sections: fin.sections, years: fin.years }) as Record<string, Db>
              const last = fin.years[fin.years.length - 1]
              const r = inc[last.id]
              const rr = ratios[last.id]
              const sem = summarizeRatios(rr) as Db
              const fmt = (key: string) => formatRatio(RATIO_BY_KEY[key], rr.values[key])
              out.analisis_financiero = {
                empresa: fin.analysis.company_name || null,
                moneda: fin.analysis.currency,
                unidad: 'miles',
                ultimo_periodo: yearLabel(last),
                parcial: parcialDe(last),
                ventas: r.ventas,
                crecimiento_ventas: fmt('crecimiento_ventas'),
                margen_operativo: fmt('margen_operativo'),
                liquidez: fmt('liquidez'),
                semaforo_razones: { verde: sem.verde, ambar: sem.ambar, rojo: sem.rojo },
              }
            } else {
              out.analisis_financiero = 'Aún no ha capturado información financiera.'
            }
            }
            return text(out)
          }
        )

        // ===== Matriz de riesgos =====
        if (can(access, 'risk')) {
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

        } // fin riesgos

        // ===== Planeación estratégica =====
        if (can(access, 'strategic')) {
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

        } // fin estratégica

        // ===== Análisis financiero (modelo MP-AFH1) =====
        if (can(access, 'fin-analysis')) {
        server.registerTool(
          'empresa_financiera',
          {
            description:
              'Datos generales de la empresa en el análisis financiero (nombre, país, actividad, moneda), los periodos capturados (años completos y, si lo hay, el último parcial) y los segmentos de negocio con sus ventas y costo por periodo. Todas las cifras del módulo están en miles.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin) return text({ mensaje: 'El usuario aún no ha empezado su análisis financiero.' })
            const sales = fin.sections[SALES_SECTION] || {}
            const segcost = fin.sections[SEGCOST_SECTION] || {}
            const porPeriodo = (map: Record<string, Record<string, number>>, id: string) =>
              Object.fromEntries(fin.years.map((y: Db) => [yearLabel(y), map[id]?.[y.id] ?? null]))
            return text({
              empresa: {
                nombre: fin.analysis.company_name || null,
                pais: fin.analysis.country || null,
                actividad_principal: fin.analysis.main_activity || null,
                actividades_secundarias: fin.analysis.secondary_activities || null,
                moneda: fin.analysis.currency,
                unidad: 'miles',
              },
              periodos: fin.years.map((y: Db) => ({ id: y.id, etiqueta: yearLabel(y), anio: y.year, meses: y.months, parcial: y.months < 12 })),
              segmentos: fin.lines.map((l: Db) => ({
                nombre: l.name,
                ventas_por_periodo: porPeriodo(sales, l.id),
                costo_por_periodo: porPeriodo(segcost, l.id),
              })),
            })
          }
        )

        server.registerTool(
          'estado_resultados',
          {
            description:
              'Estado de Resultados por periodo (ventas, costo, utilidad bruta, gastos de venta, administración y generales, resultado de operación, resultado integral de financiamiento, impuestos, utilidad neta) con el % sobre ventas de cada renglón, las partidas que no son efectivo (depreciación y reservas) y el EBITDA. Cifras reales del periodo en miles; los periodos parciales se marcan y no se anualizan.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin || !fin.years.length) return text({ mensaje: 'El usuario aún no ha capturado años en su análisis financiero.' })
            const inc = computeIncome({ sections: fin.sections, years: fin.years }) as Record<string, Db>
            const ebitda = computeEbitda({ sections: fin.sections, years: fin.years }) as Record<string, number>
            const periodos = fin.years.map((y: Db) => {
              const r = inc[y.id]
              return {
                periodo: yearLabel(y),
                parcial: parcialDe(y),
                ...Object.fromEntries(INCOME_OUT.map(([k, name]) => [name, r[k]])),
                pct_sobre_ventas: Object.fromEntries(INCOME_OUT.map(([k, name]) => [name, pctFrac(r.pct[k])])),
                partidas_no_efectivo: {
                  depreciacion_y_amortizacion: r.depreciacion,
                  reserva_cuentas_por_cobrar: r.reservaCxc,
                  reserva_inventarios: r.reservaInventarios,
                },
                ebitda: ebitda[y.id],
                margen_ebitda_pct: pctFrac(r.ventas > 0 ? ebitda[y.id] / r.ventas : null),
              }
            })
            return text({
              moneda: fin.analysis.currency,
              unidad: 'miles',
              nota:
                'Costos, gastos e impuestos se muestran en positivo y ya están restados en los totales; utilidad_cambiaria y otros_productos llevan signo (utilidad +, pérdida o gasto −). Las partidas que no son efectivo están incluidas en el gasto operativo y no alteran los totales. EBITDA = resultado de operación + depreciación y amortización (más la amortización de activos diferidos y la creación de créditos diferidos del Balance) + reservas de cartera e inventarios.',
              periodos,
            })
          }
        )

        server.registerTool(
          'balance_general',
          {
            description:
              'Balance General por periodo: totales de activo circulante y no circulante, pasivo circulante y a largo plazo, capital contable (con el resultado del periodo tomado del Estado de Resultados) y si cuadra (Activo = Pasivo + Capital). Cifras en miles.',
            inputSchema: z.object({ detalle: z.boolean().default(false).describe('Incluir las cuentas capturadas con su % sobre el total activo') }),
            annotations: { readOnlyHint: true },
          },
          async ({ detalle }) => {
            const fin = await finContext(supabase)
            if (!fin || !fin.years.length) return text({ mensaje: 'El usuario aún no ha capturado años en su análisis financiero.' })
            const bal = computeBalance({ sections: fin.sections, years: fin.years }) as Record<string, Db>
            const cuentas = fin.sections[BALANCE_SECTION] || {}
            const grupos = BALANCE_GROUPS as Db[]
            const periodos = fin.years.map((y: Db) => {
              const b = bal[y.id]
              const out: Record<string, unknown> = {
                periodo: yearLabel(y),
                parcial: parcialDe(y),
                activo_circulante: b.activoCirculante,
                activo_no_circulante: b.activoNoCirculante,
                total_activo: b.totalActivo,
                pasivo_circulante: b.pasivoCirculante,
                pasivo_largo_plazo: b.pasivoLargoPlazo,
                total_pasivo: b.totalPasivo,
                resultado_del_periodo: b.resultadoPeriodo,
                total_capital_contable: b.totalCapital,
                total_pasivo_mas_capital: b.totalPasivoCapital,
                diferencia: b.diferencia,
                cuadra: cuadra(b.diferencia),
              }
              if (detalle) {
                out.cuentas = grupos.flatMap((g: Db) =>
                  g.items
                    .filter((i: Db) => cuentas[i.key]?.[y.id] != null)
                    .map((i: Db) => ({
                      grupo: g.title,
                      clave: i.key,
                      nombre: i.label,
                      valor: cuentas[i.key][y.id],
                      pct_total_activo: pctFrac(b.pct[i.key]),
                    }))
                )
              }
              return out
            })
            return text({
              moneda: fin.analysis.currency,
              unidad: 'miles',
              nota: 'resultado_del_periodo no se captura: es la utilidad neta del Estado de Resultados y ya está dentro de total_capital_contable. Cuadra cuando |diferencia| ≤ 0.5 (miles).',
              periodos,
            })
          }
        )

        server.registerTool(
          'flujo_efectivo',
          {
            description:
              'Estado de cambios en la situación financiera por periodo ((+) fuentes, (−) aplicaciones): EBITDA, inversión en capital de trabajo, flujo de operación, impuestos, costo integral de financiamiento pagado, efectivo generado por la operación, inversión (CAPEX y otros activos), financiamiento externo, aportaciones o retiros de los accionistas, flujo del periodo y la conciliación con la caja del Balance. Necesita al menos dos periodos; cifras en miles.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin || fin.years.length < 2) return text({ mensaje: 'El Estado de cambios necesita al menos dos periodos capturados: compara cada uno con el anterior.' })
            const flows = computeCashflow({ sections: fin.sections, years: fin.years }) as Record<string, Db>
            const byId = new Map(fin.years.map((y: Db) => [y.id, y]))
            return text({
              moneda: fin.analysis.currency,
              unidad: 'miles',
              nota:
                'Signos: positivo = fuente de efectivo, negativo = aplicación. Cada cuenta del Balance entra una sola vez; depreciación y reservas vienen del Estado de Resultados, y venta de activo fijo, efectos cambiarios y ajuste por revaluación de las capturas complementarias del Estado de cambios. Cuadra cuando caja_final_calculada = caja_final_balance (|diferencia| ≤ 0.5).',
              periodos: fin.years.slice(1).map((y: Db) => {
                const f = flows[y.id]
                return {
                  periodo: yearLabel(y),
                  parcial: parcialDe(y),
                  periodo_anterior: yearLabel(byId.get(f.prevYearId)),
                  ebitda: {
                    resultado_de_operacion: f.resultadoOp,
                    depreciacion_y_amortizacion: f.depAmort,
                    reservas_cartera_e_inventarios: f.reservas,
                    total: f.ebitda,
                  },
                  capital_de_trabajo: {
                    clientes: f.workingCapital.clientes,
                    inventarios: f.workingCapital.inventarios,
                    proveedores: f.workingCapital.proveedores,
                    pagos_anticipados: f.workingCapital.pagosAnticipados,
                    cuentas_por_cobrar_relacionadas: f.workingCapital.cxcRelacionadas,
                    cuentas_por_pagar_relacionadas: f.workingCapital.cxpRelacionadas,
                    anticipos_de_clientes: f.workingCapital.anticipos,
                    gastos_acumulados: f.workingCapital.gastosAcumulados,
                    total: f.wcTotal,
                  },
                  flujo_de_operacion: f.flujoOperacion,
                  impuestos: {
                    impuestos_por_recuperar: f.impRecuperar,
                    impuestos_por_pagar: f.impPagar,
                    isr_y_ptu: f.isrPtu,
                    total: f.impuestos,
                  },
                  costo_integral_financiamiento_pagado: f.cif,
                  efectivo_generado_por_la_operacion: f.efectivoOperacion,
                  inversion: { capex: f.capex, otros_activos: f.otrosActivos, total: f.flujoInversion },
                  flujo_neto_de_inversion: f.flujoNetoInversion,
                  financiamiento_externo: {
                    porcion_circulante_anterior: f.financing.porcionCirculante,
                    deuda_bancaria_corto_plazo: f.financing.deudaCP,
                    deuda_bancaria_largo_plazo: f.financing.deudaLP,
                    otros_activos_circulantes: f.financing.otrosCirculantes,
                    otras_cuentas_por_cobrar: f.financing.otrasCxc,
                    otras_cuentas_por_pagar: f.financing.otrasCxp,
                    acreedores: f.financing.acreedores,
                    otros_ingresos: f.financing.otrosIngresos,
                    cargos_diferidos: f.financing.cargosDiferidos,
                    creditos_diferidos: f.financing.creditosDiferidos,
                    total: f.flujoFinExterno,
                  },
                  accionistas: { aportaciones: f.aportaciones, dividendos: f.dividendos, total: f.accionistas },
                  flujo_de_financiamiento: f.flujoFinanciamiento,
                  flujo_del_periodo: f.flujoPeriodo,
                  caja_inicial: f.cajaInicial,
                  caja_final_calculada: f.cajaFinal,
                  caja_final_balance: f.cajaBalance,
                  diferencia: f.diferencia,
                  cuadra: cuadra(f.diferencia),
                }
              }),
            })
          }
        )

        server.registerTool(
          'razones_financieras',
          {
            description:
              'Las 41 razones financieras del modelo por periodo, en seis grupos (eficiencia, flujo de efectivo, liquidez, cobertura, solvencia y rentabilidad): 25 con semáforo verde/ámbar/rojo (etiqueta Sano/Vigilar/Atender/No aplica y motivo cuando no se puede calcular) y 16 informativas (cifras sin semáforo: EBIT, EBITDA, flujos, deuda con costo…). Resumen por periodo con los indicadores que más llaman la atención. Saldos al cierre; días sobre meses × 30; crecimiento, ROA y ROE anualizados en periodos parciales. Cifras en miles.',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const fin = await finContext(supabase)
            if (!fin || !fin.years.length) return text({ mensaje: 'El usuario aún no ha capturado años en su análisis financiero.' })
            const ratios = computeRatios({ sections: fin.sections, years: fin.years }) as Record<string, Db>
            const defs = RATIO_DEFS as Db[]
            const labelOf = (status: string | null) => (RATIO_STATUS_LABEL as Record<string, string>)[status ?? 'na']
            const periodos = fin.years.map((y: Db) => {
              const r = ratios[y.id]
              const sem = summarizeRatios(r) as Db
              return {
                periodo: yearLabel(y),
                parcial: parcialDe(y),
                meses: r.months,
                indicadores: defs.map((d: Db) => {
                  const semaforo = r.status[d.key] ?? null
                  return {
                    clave: d.key,
                    nombre: d.label,
                    grupo: d.group,
                    informativo: !d.semaforo,
                    valor: r.values[d.key] ?? null,
                    valor_texto: formatRatio(d, r.values[d.key]),
                    semaforo,
                    etiqueta: d.semaforo ? labelOf(semaforo) : null,
                    motivo: r.na[d.key] ?? null,
                  }
                }),
                semaforo: { verde: sem.verde, ambar: sem.ambar, rojo: sem.rojo, na: sem.na },
                atencion: (sem.atencion as Db[]).map((a: Db) => ({
                  clave: a.key,
                  nombre: RATIO_BY_KEY[a.key].label,
                  valor_texto: formatRatio(RATIO_BY_KEY[a.key], a.value),
                  semaforo: a.status,
                })),
              }
            })
            return text({
              moneda: fin.analysis.currency,
              unidad: 'miles',
              grupos: (RATIO_GROUPS as Db[]).map((g: Db) => ({ clave: g.key, nombre: g.title, pregunta: g.question })),
              nota:
                'Umbrales de referencia general para PyMEs (el dueño del producto los confirma). Saldos al cierre, sin promedios; días sobre meses × 30 del periodo; crecimiento en ventas, ROA y ROE se anualizan en periodos parciales y el resto usa las cifras reales. Los indicadores informativos (informativo: true) no llevan semáforo ni cuentan en el resumen. EBITDA = resultado de operación + depreciación y amortización + reservas.',
              periodos,
            })
          }
        )

        server.registerTool(
          'analisis_opcionales',
          {
            description:
              'Los tres análisis opcionales del módulo, cada uno con su diferencia contra el Estado de Resultados (debe ser 0): segmentos de negocio (ventas, costo y margen bruto por segmento), desglose del gasto operativo (20 conceptos más partidas virtuales) y estacionalidad de las ventas por mes. Cifras en miles.',
            inputSchema: z.object({
              analisis: z.enum(['todos', 'segmentos', 'desglose_gasto', 'estacionalidad']).default('todos').describe('Qué análisis devolver'),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ analisis }) => {
            const fin = await finContext(supabase)
            if (!fin || !fin.years.length) return text({ mensaje: 'El usuario aún no ha capturado años en su análisis financiero.' })
            const base = { sections: fin.sections, years: fin.years }
            const out: Record<string, unknown> = { moneda: fin.analysis.currency, unidad: 'miles' }
            if (analisis === 'todos' || analisis === 'segmentos') {
              const seg = computeSegments({ ...base, lines: fin.lines }) as Record<string, Db>
              out.segmentos = {
                capturado: fin.lines.length > 0 && hasAny(fin.sections[SALES_SECTION]),
                periodos: fin.years.map((y: Db) => {
                  const s = seg[y.id]
                  return {
                    periodo: yearLabel(y),
                    parcial: parcialDe(y),
                    segmentos: fin.lines.map((l: Db) => {
                      const v = s.bySegment[l.id]
                      return {
                        nombre: l.name,
                        ventas: v.ventas,
                        pct_ventas: pctFrac(v.pctVentas),
                        costo: v.costo,
                        pct_costo: pctFrac(v.pctCosto),
                        utilidad_bruta: v.bruto,
                        margen_bruto_pct: pctFrac(v.margen),
                      }
                    }),
                    total_ventas: s.totalVentas,
                    total_costo: s.totalCosto,
                    total_utilidad_bruta: s.totalBruto,
                    margen_bruto_pct: pctFrac(s.margenTotal),
                    ventas_segun_estado_resultados: s.ventasResultados,
                    costo_segun_estado_resultados: s.costoResultados,
                    diferencia_ventas: s.difVentas,
                    diferencia_costo: s.difCosto,
                    cuadra: cuadra(s.difVentas) && cuadra(s.difCosto),
                  }
                }),
              }
            }
            if (analisis === 'todos' || analisis === 'desglose_gasto') {
              const br = computeExpenseBreakdown(base) as Record<string, Db>
              const conceptos = EXPENSE_CONCEPTS as Db[]
              out.desglose_gasto = {
                capturado: hasAny(fin.sections[EXPENSES_SECTION]),
                nota: 'Depreciación y reservas vienen del Estado de Resultados; amortizaciones y otras partidas virtuales se capturan en el desglose. El total debe coincidir con el gasto operativo del Estado de Resultados.',
                periodos: fin.years.map((y: Db) => {
                  const b = br[y.id]
                  return {
                    periodo: yearLabel(y),
                    parcial: parcialDe(y),
                    conceptos: conceptos.map((c: Db) => ({ clave: c.key, nombre: c.label, valor: b.concepts[c.key], pct_total: pctFrac(b.pct[c.key]) })),
                    gastos_de_operacion: b.gastosOperacion,
                    partidas_virtuales: {
                      depreciacion_y_amortizacion: b.depreciacion,
                      amortizaciones: b.amortizaciones,
                      reserva_cuentas_por_cobrar: b.reservaCxc,
                      reserva_inventarios: b.reservaInventarios,
                      otras_partidas_virtuales: b.otrasVirtuales,
                    },
                    total: b.total,
                    gasto_operativo_segun_estado_resultados: b.gastoEnResultados,
                    diferencia: b.diferencia,
                    cuadra: cuadra(b.diferencia),
                  }
                }),
              }
            }
            if (analisis === 'todos' || analisis === 'estacionalidad') {
              const sea = computeSeasonality(base) as Record<string, Db>
              const meses = SEASON_MONTHS as Db[]
              out.estacionalidad = {
                capturado: hasAny(fin.sections[SEASONALITY_SECTION]),
                nota: 'En un periodo parcial solo se listan los meses que incluye. La suma de los meses debe coincidir con las ventas del Estado de Resultados.',
                periodos: fin.years.map((y: Db) => {
                  const s = sea[y.id]
                  return {
                    periodo: yearLabel(y),
                    parcial: parcialDe(y),
                    meses: meses
                      .filter((m: Db) => m.month <= y.months)
                      .map((m: Db) => ({ mes: m.label, ventas: s.months[m.month - 1], pct: pctFrac(s.pct[m.month - 1]) })),
                    total: s.total,
                    ventas_segun_estado_resultados: s.ventasResultados,
                    diferencia: s.diferencia,
                    cuadra: cuadra(s.diferencia),
                  }
                }),
              }
            }
            return text(out)
          }
        )

        } // fin financiero

        return server
      })

      return handler.fetch(req)
    }
  )
)
