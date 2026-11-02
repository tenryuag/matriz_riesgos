// Tipos compartidos de la Edge Function `ia` (asistente de IA de la app).
// deno-lint-ignore no-explicit-any
export type Db = any

export type Access = { admin: boolean; modules: Set<string> }

export type Usage = {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
}

export type ActionCtx = {
  supabase: Db // cliente con el token del usuario (RLS del usuario)
  admin: Db // cliente service_role: bitácora y resultados guardados
  user: { id: string; email: string | null }
  access: Access
  body: Record<string, unknown> // cuerpo de la petición sin `action`
}

export type ActionResult = {
  result: unknown // lo que recibe la app en `result`
  usage?: Usage | null // tokens y costo de la llamada (null si no se llamó a la IA)
  cached?: boolean // true si se devolvió un resultado guardado
  generated_at?: string // ISO de cuándo se generó el resultado
}

export type Action = {
  // Módulo que el usuario debe tener para usar la acción (null = cualquiera
  // con al menos un módulo).
  requires: 'risk' | 'strategic' | 'fin-analysis' | null
  run: (ctx: ActionCtx) => Promise<ActionResult>
}

// Error controlado: `code` es el que la app traduce (src/api/ia.js) y
// `status` el HTTP con que se responde.
export class IaError extends Error {
  code: string
  status: number
  constructor(code: string, message?: string, status = 400) {
    super(message || code)
    this.name = 'IaError'
    this.code = code
    this.status = status
  }
}
