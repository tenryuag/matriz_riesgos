// ============================================================
// Llamadas a la API de Claude desde la Edge Function `ia`.
// ------------------------------------------------------------
// Un solo punto de entrada, askJson(): manda un system prompt (cacheado), el
// contenido del usuario (texto, PDF o imágenes) y un JSON Schema; devuelve el
// objeto ya parseado más el uso (tokens y costo en USD). La app nunca toca la
// API: la llave vive en el secreto ANTHROPIC_API_KEY de Supabase.
//
// Modelo: claude-opus-5-5 (secreto IA_MODEL para cambiarlo). En este modelo
// el razonamiento (thinking) siempre está activo y la profundidad se controla
// con output_config.effort (medium por omisión).
// ============================================================
import Anthropic from 'npm:@anthropic-ai/sdk@^1.3.0'
import { IaError, type Usage } from './types.ts'

export const DEFAULT_MODEL = Deno.env.get('IA_MODEL') || 'claude-opus-5-5'

// Precios públicos en USD por millón de tokens (entrada, salida, escritura y
// lectura de caché). Si el modelo no está en la tabla se usan los de Opus 5.5.
const PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
}

export const isConfigured = () => !!Deno.env.get('ANTHROPIC_API_KEY')

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!isConfigured()) throw new IaError('no_configurado', 'Falta el secreto ANTHROPIC_API_KEY', 503)
  if (!client) client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY'), maxRetries: 1, timeout: 150_000 })
  return client
}

export function costFor(model: string, u: { input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number }) {
  const p = Object.entries(PRICES).find(([k]) => model.startsWith(k))?.[1] || PRICES['claude-opus-5-5']
  const usd =
    (u.input_tokens * p.input + u.output_tokens * p.output + u.cache_write_tokens * p.cacheWrite + u.cache_read_tokens * p.cacheRead) /
    1_000_000
  return Math.round(usd * 1_000_000) / 1_000_000
}

// deno-lint-ignore no-explicit-any
type Block = any

export type AskJsonParams = {
  system: string // instrucciones fijas de la acción (se cachean)
  content: string | Block[] // mensaje del usuario: texto o bloques (text/document/image)
  schema: Record<string, unknown> // JSON Schema de la respuesta (additionalProperties:false en cada objeto)
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  model?: string
}

export type AskJsonResult<T> = { data: T; usage: Usage; stopReason: string | null }

export async function askJson<T = unknown>(params: AskJsonParams): Promise<AskJsonResult<T>> {
  const anthropic = getClient()
  const model = params.model || DEFAULT_MODEL
  const request = {
    model,
    max_tokens: params.maxTokens ?? 8000,
    system: [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: params.content }],
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: params.schema },
      ...(params.effort ? { effort: params.effort } : {}),
    },
  }
  let response: Anthropic.Message
  try {
    // deno-lint-ignore no-explicit-any
    response = await anthropic.messages.create(request as any)
  } catch (err) {
    throw mapApiError(err)
  }

  const u = response.usage
  const usage: Usage = {
    model: response.model || model,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
    cost_usd: 0,
  }
  usage.cost_usd = costFor(usage.model, usage)

  if (response.stop_reason === 'refusal') {
    throw Object.assign(new IaError('rechazado', 'El modelo declinó la petición', 422), { usage })
  }
  const text = response.content.find((b) => b.type === 'text')
  if (response.stop_reason === 'max_tokens' || !text || text.type !== 'text') {
    throw Object.assign(new IaError('incompleto', 'La respuesta quedó incompleta', 502), { usage })
  }
  let data: T
  try {
    data = JSON.parse(text.text) as T
  } catch {
    throw Object.assign(new IaError('incompleto', 'La respuesta no fue JSON válido', 502), { usage })
  }
  return { data, usage, stopReason: response.stop_reason }
}

// Cuenta los tokens de entrada (system + contenido del usuario) sin generar
// nada; sirve para rechazar archivos demasiado grandes antes de gastar.
export async function countInput(system: string, content: Block[], model = DEFAULT_MODEL): Promise<number> {
  try {
    const r = await getClient().messages.countTokens({
      model,
      system: [{ type: 'text', text: system }],
      messages: [{ role: 'user', content }],
      // deno-lint-ignore no-explicit-any
    } as any)
    return r.input_tokens ?? 0
  } catch (err) {
    throw mapApiError(err)
  }
}

// Traduce los errores tipados del SDK a códigos que la app entiende.
function mapApiError(err: unknown): IaError {
  if (err instanceof IaError) return err
  console.error('claude:', err)
  if (err instanceof Anthropic.AuthenticationError) {
    return new IaError('no_configurado', 'La llave de la API de Claude no es válida', 503)
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new IaError('saturado', 'La API de Claude limitó la petición (429)', 429)
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new IaError('peticion_invalida', 'La API rechazó la petición', 400)
  }
  if (err instanceof Anthropic.APIError) {
    const status = Number(err.status) || 502
    if (status === 529) return new IaError('saturado', 'La API de Claude está saturada (529)', 503)
    return new IaError('proveedor', `Error de la API de Claude (${status})`, 502)
  }
  return new IaError('proveedor', 'No se pudo llamar a la API de Claude', 502)
}

// ---------- utilidades para armar prompts ----------

// Bloque de texto para `content`.
export const textBlock = (text: string): Block => ({ type: 'text', text })

// Bloque de documento PDF o imagen en base64 (lo que sube el usuario).
export function fileBlock(mediaType: string, base64: string, title?: string): Block {
  if (mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 }, ...(title ? { title } : {}) }
  }
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
}

// Cifra compacta para los prompts: en miles, un decimal, sin -0.
export const n1 = (v: unknown) => {
  const x = Number(v)
  if (!Number.isFinite(x)) return null
  const r = Math.round(x * 10) / 10
  return r === 0 ? 0 : r
}
