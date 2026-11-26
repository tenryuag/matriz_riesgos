// Resultados guardados (tabla ia_resultados) y huella de los datos de entrada.
// Si la huella no cambió, la acción devuelve lo guardado sin gastar.
//
// Se guarda uno por usuario, EMPRESA y tipo: un mentor trabaja sobre varias
// empresas y sus resultados no deben mezclarse. Una base anterior a la
// migración de empresas no tiene la columna company_id: ahí se guarda uno por
// usuario y tipo, como antes (ver `legacySchema`).
import type { Db } from './types.ts'

// SHA-256 en hex del JSON canónico (claves ordenadas) del objeto.
export async function hashOf(value: unknown): Promise<string> {
  const text = JSON.stringify(sortKeys(value))
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k])
    return out
  }
  return v
}

export type SavedResult = { result: unknown; input_hash: string; model: string | null; cost_usd: number; created_at: string }

// ¿El error es de una base que aún no tiene ia_resultados.company_id (ni su
// restricción única)? 42703 = columna inexistente; PGRST204 = columna que
// PostgREST no conoce; 42P10 = no hay restricción única para ese ON CONFLICT.
const legacySchema = (error: Db) => ['42703', 'PGRST204', '42P10'].includes(String(error?.code || ''))

const COLUMNS = 'result, input_hash, model, cost_usd, created_at'

export async function getSaved(admin: Db, userId: string, companyId: string | null, kind: string): Promise<SavedResult | null> {
  const base = () => admin.from('ia_resultados').select(COLUMNS).eq('user_id', userId).eq('kind', kind)
  const scoped = companyId ? base().eq('company_id', companyId) : base().is('company_id', null)
  const first = await scoped.order('created_at', { ascending: false }).limit(1)
  if (!first.error) return (first.data?.[0] as SavedResult | undefined) || null
  if (!legacySchema(first.error)) throw new Error(`ia_resultados: ${first.error.message}`)

  const { data, error } = await base().order('created_at', { ascending: false }).limit(1)
  if (error) throw new Error(`ia_resultados: ${error.message}`)
  return (data?.[0] as SavedResult | undefined) || null
}

export async function saveResult(
  admin: Db,
  userId: string,
  companyId: string | null,
  kind: string,
  inputHash: string,
  model: string,
  result: unknown,
  costUsd: number
): Promise<string> {
  const created_at = new Date().toISOString()
  const row = { user_id: userId, kind, input_hash: inputHash, model, result, cost_usd: costUsd, created_at }
  const first = await admin
    .from('ia_resultados')
    .upsert({ ...row, company_id: companyId }, { onConflict: 'user_id,company_id,kind' })
  if (!first.error) return created_at
  if (!legacySchema(first.error)) throw new Error(`ia_resultados: ${first.error.message}`)

  const { error } = await admin.from('ia_resultados').upsert(row, { onConflict: 'user_id,kind' })
  if (error) throw new Error(`ia_resultados: ${error.message}`)
  return created_at
}
