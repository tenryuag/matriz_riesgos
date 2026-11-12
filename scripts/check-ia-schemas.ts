// Verifica que los schemas de las cinco acciones del asistente de IA cumplan
// las restricciones de structured outputs (additionalProperties:false,
// required completo, sin min/max/format/anyOf) y que los enums del asistente
// de riesgos coincidan con los catálogos. Correr: `npm run ia:check`.
// Rutas relativas a este archivo (scripts/), para correrlo desde cualquier carpeta.
const base = new URL('../supabase/functions/', import.meta.url).href
const mods: Record<string, string> = {
  informe: base + 'ia/actions/informe.ts',
  extraer: base + 'ia/actions/extraer.ts',
  riesgo: base + 'ia/actions/riesgo.ts',
  iniciativa: base + 'ia/actions/iniciativa.ts',
  resumen: base + 'ia/actions/resumen.ts',
}
const FORBIDDEN = new Set(['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'uniqueItems', 'multipleOf'])
let problems = 0
function walk(node: unknown, path: string) {
  if (!node || typeof node !== 'object') return
  const n = node as Record<string, unknown>
  for (const k of Object.keys(n)) if (FORBIDDEN.has(k)) { problems++; console.log('  restricción no soportada', k, 'en', path) }
  if (n.type === 'object') {
    const props = Object.keys((n.properties as Record<string, unknown>) || {})
    const req = (n.required as string[]) || []
    if (n.additionalProperties !== false) { problems++; console.log('  falta additionalProperties:false en', path) }
    if (props.length !== req.length || props.some((p) => !req.includes(p))) { problems++; console.log('  required incompleto en', path) }
    for (const p of props) walk((n.properties as Record<string, unknown>)[p], `${path}.${p}`)
  }
  if (n.type === 'array') walk(n.items, `${path}[]`)
  if (Array.isArray(n.anyOf) || Array.isArray(n.oneOf)) { problems++; console.log('  anyOf/oneOf en', path) }
}
for (const [name, url] of Object.entries(mods)) {
  const m = await import(url)
  const before = problems
  walk(m.SCHEMA, name)
  console.log(name, 'schema', JSON.stringify(m.SCHEMA).length, 'bytes', problems === before ? 'OK' : 'CON PROBLEMAS')
}
// Enums de riesgo vs catálogos
const rc = await import(base + '_shared/app/riskCalc.js')
const pe = await import(base + '_shared/app/perspectives.js')
const r = (await import(mods.riesgo)).SCHEMA as Record<string, any>
const p = r.properties
const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)
const checks: [string, boolean][] = [
  ['probabilidad', same(p.probabilidad.enum, rc.PROBABILITY_LEVELS)],
  ['impacto', same(p.impacto.enum, rc.IMPACT_LEVELS)],
  ['estrategia', same(p.estrategia.enum, rc.STRATEGY_LEVELS)],
  ['perspectiva_key', same(p.perspectiva_key.enum, pe.PERSPECTIVE_KEYS)],
  ['mitiga', same(p.controles.items.properties.mitiga.enum, rc.MITIGANT_IMPACT_OPTIONS)],
  ['tipo_control', same(p.controles.items.properties.tipo_control.enum, rc.CONTROL_TYPES)],
  ['proceso', same(p.controles.items.properties.proceso.enum, rc.PROCESS_TYPES)],
  ['residual_probabilidad', same(p.residual_probabilidad.enum, rc.PROBABILITY_LEVELS)],
  ['residual_impacto', same(p.residual_impacto.enum, rc.IMPACT_LEVELS)],
]
for (const [k, ok] of checks) { if (!ok) problems++; console.log('enum', k, ok ? 'OK' : 'DIFIERE') }
console.log(problems === 0 ? 'TODO OK' : `PROBLEMAS: ${problems}`)
