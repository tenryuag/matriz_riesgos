// ============================================================
// Contexto de la empresa para los prompts del asistente.
// ------------------------------------------------------------
// Lee los datos del usuario con SU cliente (RLS "solo el dueño") y los
// compacta en objetos pequeños y en español: estados financieros y razones
// (mismos cálculos que la app, módulos copiados con `npm run mcp:sync`),
// matriz de riesgos y planeación estratégica. Todas las funciones toleran
// cuentas vacías (devuelven null o listas vacías) para que cada acción
// decida si hay datos suficientes.
// ============================================================
import {
  BALANCE_GROUPS,
  RATIO_DEFS,
  RATIO_GROUPS,
  formatRatio,
  yearLabel,
} from '../_shared/app/finConfig.js'
import {
  computeBalance,
  computeCashflow,
  computeIncome,
  computeRatios,
  summarizeRatios,
} from '../_shared/app/finCalc.js'
import {
  MARKET_SECTION,
  PLAN_SOURCE_SECTIONS,
  RATING_SECTION,
  compSection,
} from '../_shared/app/strategicCatalog.js'
import {
  buildFoda,
  collectStrategies,
  daysFromTo,
  localISODate,
  perspectiveFor,
  priorityFor,
  scoreFor,
} from '../_shared/app/strategicCalc.js'
import { isCriticalKey, labelForLevelKey, levelKeyOf } from '../_shared/app/riskCalc.js'
import { PERSPECTIVE_BY_KEY } from '../_shared/app/perspectives.js'
import { n1 } from './claude.ts'
import type { Access, Db } from './types.ts'

// ---------- acceso por módulo (mismas reglas que la app y el MCP) ----------
export async function accessFor(supabase: Db): Promise<Access> {
  const [adminRes, rowsRes] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.from('user_module_access').select('module_key'),
  ])
  const modules = new Set<string>(((rowsRes?.data as Db[]) || []).map((r: Db) => r.module_key))
  return { admin: adminRes?.data === true, modules }
}
export const can = (a: Access, m: string) => a.admin || a.modules.has(m)

// ---------- empresa ----------
export type Company = {
  nombre: string | null
  pais: string | null
  actividad_principal: string | null
  actividades_secundarias: string | null
  moneda: string | null
  vision: string | null
  mision: string | null
  valores: string | null
}

// Datos generales que ayudan a cualquier prompt (nombre, giro, visión…).
// Combina el análisis financiero y el plan estratégico; lo que no exista va en null.
export async function companyContext(supabase: Db, access: Access): Promise<Company> {
  const out: Company = {
    nombre: null, pais: null, actividad_principal: null, actividades_secundarias: null,
    moneda: null, vision: null, mision: null, valores: null,
  }
  if (can(access, 'fin-analysis')) {
    const a = await getAnalysis(supabase)
    if (a) {
      out.nombre = a.company_name || null
      out.pais = a.country || null
      out.actividad_principal = a.main_activity || null
      out.actividades_secundarias = a.secondary_activities || null
      out.moneda = a.currency || null
    }
  }
  if (can(access, 'strategic')) {
    const p = await getPlan(supabase)
    if (p) {
      out.vision = p.vision || null
      out.mision = p.mission || null
      out.valores = p.core_values || null
    }
  }
  return out
}

// ---------- análisis financiero ----------
export async function getAnalysis(supabase: Db) {
  const { data, error } = await supabase.from('fin_analyses').select('*').order('created_at', { ascending: true }).limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

export type FinContext = {
  analysis: Db
  years: Db[]
  lines: Db[]
  sections: Record<string, Record<string, Record<string, number>>>
}

export async function finContext(supabase: Db): Promise<FinContext | null> {
  const analysis = await getAnalysis(supabase)
  if (!analysis) return null
  const [{ data: years, error: e1 }, { data: lines, error: e2 }, { data: values, error: e3 }] = await Promise.all([
    supabase.from('fin_years').select('*').eq('analysis_id', analysis.id).order('year', { ascending: true }),
    supabase.from('fin_lines').select('*').eq('analysis_id', analysis.id).order('position', { ascending: true }),
    supabase.from('fin_values').select('year_id, section, concept_key, amount').eq('analysis_id', analysis.id),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  if (e3) throw new Error(e3.message)
  const sections: FinContext['sections'] = {}
  for (const r of values || []) {
    sections[r.section] ??= {}
    sections[r.section][r.concept_key] ??= {}
    sections[r.section][r.concept_key][r.year_id] = r.amount
  }
  return { analysis, years: years || [], lines: lines || [], sections }
}

// ¿Hay al menos una cifra capturada en la sección?
export const hasAny = (sec: Record<string, Record<string, number>> | undefined) =>
  !!sec && Object.values(sec).some((byYear) => Object.values(byYear).some((v) => v != null))

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

const pctFrac = (f: unknown) => {
  const x = Number(f)
  return Number.isFinite(x) ? Math.round(x * 1000) / 10 : null
}

// Resumen financiero compacto para los prompts (cifras en miles). Devuelve
// null si no hay años capturados. `periodos` va del más antiguo al más
// reciente; cada uno trae estado de resultados, balance (solo las cuentas
// capturadas y los totales), estado de cambios (si hay año anterior) y las 41
// razones con su semáforo. De cada razón va solo { clave, valor_texto,
// semaforo } (+ motivo_na cuando no aplica): nombre, grupo y lectura están en
// el catálogo del system prompt (ratioCatalogText).
export function finSummary(fin: FinContext | null) {
  if (!fin || !fin.years.length) return null
  const base = { sections: fin.sections, years: fin.years }
  const income = computeIncome(base) as Record<string, Db>
  const balance = computeBalance(base) as Record<string, Db>
  const cashflow = computeCashflow(base) as Record<string, Db>
  const ratios = computeRatios(base) as Record<string, Db>
  const defs = RATIO_DEFS as Db[]
  const balKeys = (BALANCE_GROUPS as Db[]).flatMap((g: Db) => g.items.map((i: Db) => i.key))

  const periodos = fin.years.map((y: Db) => {
    const inc = income[y.id] || {}
    const bal = balance[y.id] || {}
    const cf = cashflow[y.id]
    const r = ratios[y.id]
    const sem = r ? (summarizeRatios(r) as Db) : null
    const estado: Record<string, number | null> = {}
    for (const [calc, out] of INCOME_OUT) estado[out] = n1(inc[calc])
    // Solo las cuentas con saldo capturado; las que no se capturaron no van.
    const cuentas: Record<string, number> = {}
    for (const k of balKeys) {
      const v = n1(fin.sections.balance?.[k]?.[y.id])
      if (v != null) cuentas[k] = v
    }
    return {
      periodo: yearLabel(y),
      meses: y.months,
      parcial: y.months < 12,
      estado_resultados: estado,
      pct_sobre_ventas: {
        margen_bruto: pctFrac(inc.pct?.utilidadBruta),
        gasto_operativo: pctFrac(inc.pct?.gastoOperativo),
        margen_operativo: pctFrac(inc.pct?.resultadoOp),
        margen_neto: pctFrac(inc.pct?.utilidadNeta),
      },
      balance: {
        cuentas,
        total_activo_circulante: n1(bal.activoCirculante),
        total_activo: n1(bal.totalActivo),
        total_pasivo_circulante: n1(bal.pasivoCirculante),
        total_pasivo: n1(bal.totalPasivo),
        resultado_del_periodo: n1(bal.resultadoPeriodo),
        total_capital: n1(bal.totalCapital),
        total_pasivo_mas_capital: n1(bal.totalPasivoCapital),
        cuadra: Math.abs(Number(bal.totalActivo ?? 0) - Number(bal.totalPasivoCapital ?? 0)) <= 0.5,
      },
      estado_de_cambios: cf
        ? {
            ebitda: n1(cf.ebitda),
            inversion_capital_trabajo: n1(cf.wcTotal),
            efectivo_de_operacion: n1(cf.efectivoOperacion),
            capex: n1(cf.capex),
            flujo_de_inversion: n1(cf.flujoInversion),
            financiamiento_externo: n1(cf.flujoFinExterno),
            aportaciones: n1(cf.aportaciones),
            dividendos: n1(cf.dividendos),
            flujo_del_periodo: n1(cf.flujoPeriodo),
            caja_inicial: n1(cf.cajaInicial),
            caja_final: n1(cf.cajaFinal),
            cuadra_con_balance: Math.abs(Number(cf.diferencia ?? 0)) <= 0.5,
          }
        : null,
      razones: r
        ? defs.map((d: Db) => {
            const motivo = r.na[d.key] ?? null
            return {
              clave: d.key,
              valor_texto: formatRatio(d, r.values[d.key]),
              semaforo: d.semaforo ? (r.status[d.key] ?? null) : null,
              ...(motivo != null ? { motivo_na: motivo } : {}),
            }
          })
        : [],
      semaforo: sem ? { verde: sem.verde, ambar: sem.ambar, rojo: sem.rojo, no_aplica: sem.na } : null,
    }
  })

  return {
    empresa: fin.analysis.company_name || null,
    pais: fin.analysis.country || null,
    actividad_principal: fin.analysis.main_activity || null,
    moneda: fin.analysis.currency || 'MXN',
    unidad: 'miles',
    segmentos: (fin.lines || []).map((l: Db) => l.name),
    periodos,
  }
}

// Catálogo fijo de las razones (qué mide cada una, su fórmula y cómo
// leerla), para el system prompt. Es texto estable: se cachea entre llamadas.
export function ratioCatalogText(): string {
  const groups = RATIO_GROUPS as Db[]
  const defs = RATIO_DEFS as Db[]
  const lines: string[] = []
  for (const g of groups) {
    lines.push(`\n## ${g.title} — ${g.question}`)
    for (const d of defs.filter((x: Db) => x.group === g.key)) {
      const formula = d.formula ? ` Fórmula: ${d.formula}.` : ''
      lines.push(`- ${d.key} (${d.label})${d.semaforo ? '' : ' [informativo, sin semáforo]'}: ${d.what}${formula} ${d.how || ''}`.trim())
    }
  }
  return lines.join('\n')
}

// ---------- matriz de riesgos ----------
// Niveles calculados como la app (riskCalc.levelKeyOf: columna *_level_key,
// luego *_score o probabilidad × impacto, al final el texto *_level) y
// etiquetados en español (labelForLevelKey): Intolerable, Alto, Medio, Bajo,
// Tolerable o 'Sin clasificar'.
export const levelKey = (r: Db, which: 'inherent' | 'residual') =>
  labelForLevelKey(levelKeyOf(r, which) ?? 'UNCLASSIFIED') as string
const LEVEL_ORDER: Record<string, number> = { Intolerable: 0, Alto: 1, Medio: 2, Bajo: 3, Tolerable: 4, 'Sin clasificar': 5 }
// Crítico = nivel inherente Alto o Intolerable, decidido por la clave (no por la etiqueta).
export const isCritical = (r: Db) => isCriticalKey(levelKeyOf(r, 'inherent')) as boolean

export function compactRisk(r: Db, deptName: string | null) {
  return {
    descripcion: r.description,
    tipo_amenaza: r.threat_type || null,
    perspectiva: r.perspective_key ? (PERSPECTIVE_BY_KEY as Db)[r.perspective_key]?.label ?? r.perspective_key : null,
    departamento: deptName,
    inherente: { probabilidad: r.inherent_probability || null, impacto: r.inherent_impact || null, nivel: levelKey(r, 'inherent') },
    residual: { probabilidad: r.residual_probability || null, impacto: r.residual_impact || null, nivel: levelKey(r, 'residual') },
    estrategia: r.risk_strategy || null,
    controles: [1, 2, 3]
      .filter((n) => String(r[`mitigant_${n}`] || '').trim())
      .map((n) => ({
        descripcion: r[`mitigant_${n}`],
        que_mitiga: r[`mitigant_impact_${n}`] || null,
        tipo_control: r[`control_type_${n}`] || null,
        grado_de_control: r[`control_grade_${n}`] || null,
        tiene_responsable: r[`control_responsible_${n}`] || null,
      })),
  }
}

// Riesgos del usuario, críticos primero, acotados a `limit` para el prompt.
export async function riskContext(supabase: Db, limit = 60) {
  const [{ data: risks, error }, { data: depts }] = await Promise.all([
    supabase.from('risks').select('*'),
    supabase.from('departments').select('id, name'),
  ])
  if (error) throw new Error(error.message)
  const deptName = new Map<string, string>(((depts as Db[]) || []).map((d: Db) => [d.id, d.name]))
  // Cada fila compacta recuerda si es crítica (por clave) antes de perder la fila original.
  const rows = ((risks as Db[]) || []).map((r: Db) => ({
    critico: isCritical(r),
    compacto: compactRisk(r, r.department_id ? deptName.get(r.department_id) ?? null : null),
  }))
  rows.sort((a, b) => (LEVEL_ORDER[a.compacto.inherente.nivel] ?? 9) - (LEVEL_ORDER[b.compacto.inherente.nivel] ?? 9))
  const all = rows.map((x) => x.compacto)
  const criticos = rows.filter((x) => x.critico).map((x) => x.compacto)
  return {
    total: all.length,
    criticos_inherente: criticos.length,
    criticos_sin_controles: criticos.filter((r: Db) => r.controles.length === 0).length,
    por_nivel_inherente: Object.fromEntries(Object.keys(LEVEL_ORDER).map((k) => [k, all.filter((r: Db) => r.inherente.nivel === k).length])),
    por_nivel_residual: Object.fromEntries(Object.keys(LEVEL_ORDER).map((k) => [k, all.filter((r: Db) => r.residual.nivel === k).length])),
    riesgos: all.slice(0, limit),
    recortado: all.length > limit,
  }
}

// ---------- planeación estratégica ----------
export async function getPlan(supabase: Db) {
  const { data, error } = await supabase.from('strategic_plans').select('*').order('created_at', { ascending: true }).limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

export async function answersFor(supabase: Db, planId: string, sections: string[]) {
  const { data, error } = await supabase.from('plan_answers').select('section, question_key, answer').eq('plan_id', planId).in('section', sections)
  if (error) throw new Error(error.message)
  const map: Record<string, Record<string, string>> = {}
  for (const r of data || []) {
    if (!map[r.section]) map[r.section] = {}
    map[r.section][r.question_key] = r.answer || ''
  }
  return map
}

const SOURCE: Record<string, string> = { market: 'Análisis del mercado', opportunities: 'Oportunidades', financial: 'Finanzas', external: 'Diagnóstico externo' }
const MAX_INICIATIVAS = 40

// Plan del usuario: identidad, FODA, debilidades con prioridad e iniciativas
// (las primeras MAX_INICIATIVAS; `recortado` avisa si había más).
export async function planContext(supabase: Db) {
  const plan = await getPlan(supabase)
  if (!plan) return null
  const { data: comps, error } = await supabase.from('competitors').select('id, name').eq('plan_id', plan.id)
  if (error) throw new Error(error.message)
  const [sections, { data: inits, error: e2 }] = await Promise.all([
    answersFor(supabase, plan.id, [
      MARKET_SECTION, ...PLAN_SOURCE_SECTIONS, RATING_SECTION,
      ...((comps as Db[]) || []).map((c: Db) => compSection(c.id)),
    ]),
    supabase.from('strategic_initiatives').select('*').eq('plan_id', plan.id).order('position', { ascending: true }),
  ])
  if (e2) throw new Error(e2.message)
  const ratings = sections[RATING_SECTION] || {}
  const { weaknesses } = collectStrategies(sections) as Db
  const foda = buildFoda({ sections, competitors: comps || [], ratings }) as Db
  const labels = new Map<string, string>((weaknesses as Db[]).map((w: Db) => [w.id, w.label]))
  // Mismo cálculo de días que la app (strategicCalc): fechas 'YYYY-MM-DD' sin zona horaria.
  const hoy = localISODate()
  const estado = (i: Db) => {
    const dias = daysFromTo(hoy, i.end_date)
    if (dias == null) return 'sin fecha'
    if (dias < 0) return 'vencida'
    if (dias <= 30) return 'vence en menos de 30 días'
    return 'en curso'
  }
  const debilidades = (weaknesses as Db[]).map((w: Db) => {
    const score = scoreFor(ratings, w.id)
    const pKey = perspectiveFor(w)
    return {
      id: w.id,
      estrategia: w.label,
      fuente: SOURCE[w.source] || w.source,
      perspectiva: pKey ? (PERSPECTIVE_BY_KEY as Db)[pKey]?.label ?? pKey : null,
      puntaje: score,
      prioridad: priorityFor(score) || 'Sin calificar',
    }
  })
  const todasIniciativas = (inits as Db[]) || []
  return {
    vision: plan.vision || null,
    mision: plan.mission || null,
    valores: plan.core_values || null,
    competidores: ((comps as Db[]) || []).map((c: Db) => c.name),
    fortalezas: (foda.fortalezas as Db[]).map((f: Db) => f.label),
    debilidades,
    // Las líneas que salen de la comparación con competidores traen en
    // `detail` los nombres de los competidores que cumplen la regla.
    oportunidades: (foda.oportunidades as Db[]).map((o: Db) => (o.detail ? `${o.label} (${o.detail})` : o.label ?? o)),
    amenazas: (foda.amenazas as Db[]).map((a: Db) => (a.detail ? `${a.label} (${a.detail})` : a.label ?? a)),
    iniciativas: todasIniciativas.slice(0, MAX_INICIATIVAS).map((i: Db) => ({
      titulo: i.title || '(sin título)',
      objetivo: i.strategy_id?.startsWith('risk:')
        ? `Riesgo crítico: ${i.strategy_label || ''}`.trim()
        : labels.get(i.strategy_id) || i.strategy_label || i.strategy_id,
      responsable: i.owner || null,
      area: i.area || null,
      fecha_fin: i.end_date || null,
      kpi: i.kpi || null,
      estado: estado(i),
    })),
    recortado: todasIniciativas.length > MAX_INICIATIVAS,
  }
}
