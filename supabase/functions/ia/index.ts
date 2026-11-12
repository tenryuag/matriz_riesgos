// ============================================================
// Edge Function `ia`: el asistente de IA de la app (Claude).
// ------------------------------------------------------------
// La app llama POST /functions/v1/ia con { action, ...params } y el JWT del
// usuario (supabase.functions.invoke). Aquí:
//   1. Se responde el preflight CORS y se verifica el token con Auth
//      (auth.getUser), igual que el servidor MCP → cliente con RLS del usuario.
//      Solo después se lee y valida el cuerpo (tamaño, JSON, objeto plano).
//   2. Se comprueba el acceso por módulo que exige la acción.
//   3. Se aplican los topes de gasto (por usuario en 24 h y global en 30 días)
//      con la RPC ia_reserve: bajo un candado por usuario comprueba los topes
//      e inserta en ia_usage una fila 'en_curso' con el costo estimado, de
//      modo que peticiones en paralelo del mismo usuario no se cuelen todas.
//   4. Se ejecuta la acción (actions/*.ts), que llama a Claude con askJson().
//   5. Se completa la fila reservada (tokens, costo real, error) o se borra si
//      no hubo llamada a la IA (resultado guardado, error sin costo) y se
//      responde { ok, result, usage, cached, generated_at }.
//
// La llave de la API vive en el secreto ANTHROPIC_API_KEY; nunca sale de aquí.
// Despliegue: npx supabase functions deploy ia --no-verify-jwt
// ============================================================
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

import { DEFAULT_MODEL, isConfigured } from './claude.ts'
import { accessFor, can } from './context.ts'
import { type Action, type ActionCtx, type Db, IaError, type Usage } from './types.ts'
import { action as interpretarInforme } from './actions/informe.ts'
import { action as extraerEstados } from './actions/extraer.ts'
import { action as sugerirRiesgo } from './actions/riesgo.ts'
import { action as sugerirIniciativa } from './actions/iniciativa.ts'
import { action as resumenEjecutivo } from './actions/resumen.ts'

export const VERSION = '1.0.0'

const ACTIONS: Record<string, Action> = {
  interpretar_informe: interpretarInforme,
  extraer_estados: extraerEstados,
  sugerir_riesgo: sugerirRiesgo,
  sugerir_iniciativa: sugerirIniciativa,
  resumen_ejecutivo: resumenEjecutivo,
}

// Topes de gasto (secretos IA_DAILY_USD, IA_DAILY_CALLS, IA_MONTHLY_USD).
const num = (name: string, def: number) => {
  const v = Number(Deno.env.get(name))
  return Number.isFinite(v) && v > 0 ? v : def
}
const LIMITS = {
  daily_usd: num('IA_DAILY_USD', 2),
  daily_calls: num('IA_DAILY_CALLS', 40),
  monthly_usd: num('IA_MONTHLY_USD', 150),
}
// Costo estimado (USD) que se reserva por acción antes de llamar a Claude.
const ESTIMATE: Record<string, number> = {
  extraer_estados: 0.3,
  interpretar_informe: 0.2,
  resumen_ejecutivo: 0.2,
  sugerir_riesgo: 0.1,
  sugerir_iniciativa: 0.1,
}
const LIMIT_MESSAGES: Record<string, string> = {
  limite_diario: 'Alcanzaste el límite diario del asistente',
  limite_global: 'Se alcanzó el tope mensual del asistente',
}
// Tamaño máximo del cuerpo (los PDF viajan en base64): 12 MB.
const MAX_BODY_BYTES = 12 * 1024 * 1024

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const fail = (code: string, message: string, status: number) => json({ ok: false, error: { code, message } }, status)

// Cliente con el token del usuario (RLS del usuario) + datos del usuario.
async function userClient(req: Request): Promise<{ supabase: Db; user: { id: string; email: string | null } } | null> {
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
  return { supabase, user: { id: data.user.id, email: data.user.email ?? null } }
}

const adminClient = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

type Window = { user_24h_usd: number; user_24h_calls: number; global_30d_usd: number }
async function usageWindow(admin: Db, userId: string): Promise<Window> {
  const { data, error } = await admin.rpc('ia_usage_window', { p_user: userId })
  if (error) throw new Error(`ia_usage_window: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  return {
    user_24h_usd: Number(row?.user_24h_usd ?? 0),
    user_24h_calls: Number(row?.user_24h_calls ?? 0),
    global_30d_usd: Number(row?.global_30d_usd ?? 0),
  }
}

// Reserva atómica (RPC ia_reserve): comprueba los topes bajo un candado por
// usuario e inserta la fila 'en_curso' con el costo estimado. Devuelve el id de
// la fila, o el motivo ('limite_diario' | 'limite_global') si no pasa.
async function reserveUsage(admin: Db, userId: string, actionName: string): Promise<{ id: string | null; motivo: string | null }> {
  const { data, error } = await admin.rpc('ia_reserve', {
    p_user: userId,
    p_action: actionName,
    p_est: ESTIMATE[actionName] ?? 0.1,
    p_daily_usd: LIMITS.daily_usd,
    p_daily_calls: LIMITS.daily_calls,
    p_monthly_usd: LIMITS.monthly_usd,
  })
  if (error) throw new Error(`ia_reserve: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  return { id: row?.id ? String(row.id) : null, motivo: row?.motivo ? String(row.motivo) : null }
}

// Completa la fila reservada con los datos reales de la llamada.
async function settleReservation(admin: Db, id: string, row: Record<string, unknown>) {
  const { error } = await admin.from('ia_usage').update(row).eq('id', id)
  if (error) console.error('ia_usage update:', error.message)
}

// Borra la reserva cuando no hubo llamada a la IA (sin costo).
async function dropReservation(admin: Db, id: string) {
  const { error } = await admin.from('ia_usage').delete().eq('id', id)
  if (error) console.error('ia_usage delete:', error.message)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail('peticion_invalida', 'Usa POST', 405)

  // Autenticación ANTES de leer el cuerpo.
  const auth = await userClient(req)
  if (!auth) return fail('sin_sesion', 'Inicia sesión para usar el asistente', 401)
  const { supabase, user } = auth

  // Cuerpo: tamaño, JSON válido y objeto plano.
  const length = Number(req.headers.get('content-length') || 0)
  if (length > MAX_BODY_BYTES) return fail('archivo_grande', 'El cuerpo de la petición es demasiado grande', 413)
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return fail('archivo_grande', 'El cuerpo de la petición es demasiado grande', 413)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fail('peticion_invalida', 'El cuerpo debe ser JSON', 400)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('peticion_invalida', 'El cuerpo debe ser un objeto JSON', 400)
  }
  const body = parsed as Record<string, unknown>
  const actionName = String(body.action || '')
  delete body.action

  const admin = adminClient()
  const access = await accessFor(supabase)

  // Estado: ¿configurado?, modelo, topes y uso actual del usuario. El gasto
  // global y el tope mensual solo se muestran a administradores.
  if (actionName === 'estado') {
    let uso: Window | null = null
    try {
      uso = await usageWindow(admin, user.id)
    } catch (err) {
      console.error(err)
    }
    const limites: Record<string, number> = { diario_usd: LIMITS.daily_usd, llamadas_dia: LIMITS.daily_calls }
    if (access.admin) limites.mensual_usd = LIMITS.monthly_usd
    let usoOut: Record<string, number> | null = null
    if (uso) {
      usoOut = { usuario_24h_usd: uso.user_24h_usd, usuario_24h_llamadas: uso.user_24h_calls }
      if (access.admin) usoOut.global_30d_usd = uso.global_30d_usd
    }
    return json({
      ok: true,
      version: VERSION,
      configurado: isConfigured(),
      modelo: DEFAULT_MODEL,
      limites,
      uso: usoOut,
    })
  }

  const action = ACTIONS[actionName]
  if (!action) return fail('peticion_invalida', `Acción desconocida: ${actionName || '(vacía)'}`, 400)
  if (!isConfigured()) return fail('no_configurado', 'Falta el secreto ANTHROPIC_API_KEY en la función', 503)

  if (!access.admin && access.modules.size === 0) return fail('sin_acceso', 'Esta cuenta no tiene módulos asignados', 403)
  if (action.requires && !can(access, action.requires)) {
    return fail('sin_acceso', `Necesitas el módulo ${action.requires} para usar esta función`, 403)
  }

  // Topes de gasto: reserva atómica antes de llamar a Claude.
  let reservationId: string
  try {
    const r = await reserveUsage(admin, user.id, actionName)
    if (r.motivo) return fail(r.motivo, LIMIT_MESSAGES[r.motivo] || 'Se alcanzó el tope de uso del asistente', 429)
    if (!r.id) throw new Error('ia_reserve: respuesta sin id')
    reservationId = r.id
  } catch (err) {
    console.error(err)
    return fail('proveedor', 'No se pudo verificar el uso del asistente', 500)
  }

  const started = Date.now()
  const ctx: ActionCtx = { supabase, admin, user, access, body }
  try {
    const out = await action.run(ctx)
    if (out.usage) {
      await settleReservation(admin, reservationId, {
        model: out.usage.model,
        input_tokens: out.usage.input_tokens,
        output_tokens: out.usage.output_tokens,
        cache_read_tokens: out.usage.cache_read_tokens,
        cache_write_tokens: out.usage.cache_write_tokens,
        cost_usd: out.usage.cost_usd,
        duration_ms: Date.now() - started,
        ok: true,
        error_code: null,
      })
    } else {
      // Resultado guardado o sin llamada a la IA: no fue una llamada.
      await dropReservation(admin, reservationId)
    }
    return json({
      ok: true,
      result: out.result,
      usage: out.usage
        ? { input_tokens: out.usage.input_tokens, output_tokens: out.usage.output_tokens, cost_usd: out.usage.cost_usd, model: out.usage.model }
        : null,
      cached: !!out.cached,
      generated_at: out.generated_at || new Date().toISOString(),
    })
  } catch (err) {
    const ia = err instanceof IaError ? err : null
    const usage = (err as { usage?: Usage })?.usage || null
    console.error(`ia/${actionName}:`, err)
    if (!usage && ia && (ia.code === 'sin_datos' || ia.code === 'peticion_invalida' || ia.code === 'archivo_grande')) {
      // Error sin costo: se libera la reserva.
      await dropReservation(admin, reservationId)
    } else {
      // Las fallas con costo (rechazo, respuesta incompleta) también se registran.
      await settleReservation(admin, reservationId, {
        model: usage?.model || DEFAULT_MODEL,
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        cache_read_tokens: usage?.cache_read_tokens ?? 0,
        cache_write_tokens: usage?.cache_write_tokens ?? 0,
        cost_usd: usage?.cost_usd ?? 0,
        duration_ms: Date.now() - started,
        ok: false,
        error_code: ia?.code || 'desconocido',
      })
    }
    if (ia) return fail(ia.code, ia.message, ia.status)
    return fail('desconocido', 'Error inesperado', 500)
  }
})
