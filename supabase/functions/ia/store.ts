// Resultados guardados (tabla ia_resultados) y huella de los datos de entrada.
// Si la huella no cambió, la acción devuelve lo guardado sin gastar.
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

export async function getSaved(admin: Db, userId: string, kind: string): Promise<SavedResult | null> {
  const { data, error } = await admin
    .from('ia_resultados')
    .select('result, input_hash, model, cost_usd, created_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle()
  if (error) throw new Error(`ia_resultados: ${error.message}`)
  return (data as SavedResult | null) || null
}

export async function saveResult(
  admin: Db,
  userId: string,
  kind: string,
  inputHash: string,
  model: string,
  result: unknown,
  costUsd: number
): Promise<string> {
  const created_at = new Date().toISOString()
  const { error } = await admin
    .from('ia_resultados')
    .upsert({ user_id: userId, kind, input_hash: inputHash, model, result, cost_usd: costUsd, created_at }, { onConflict: 'user_id,kind' })
  if (error) throw new Error(`ia_resultados: ${error.message}`)
  return created_at
}
