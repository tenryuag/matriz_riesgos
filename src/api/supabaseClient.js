import { createClient } from '@supabase/supabase-js'

// 🔹 Estas variables las vas a obtener desde tu proyecto en Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 🔹 Modo mentor: empresa del cliente sobre la que se está trabajando.
// Mientras hay una, cada petición de datos lleva el encabezado `x-company-id`
// y la base solo muestra (y guarda en) esa empresa. Sin él, cada quien ve
// únicamente su propia empresa. La base comprueba que el usuario sea mentor
// activo de esa empresa: el encabezado por sí solo no da acceso a nada.
// Vive en sessionStorage: se pierde al cerrar la pestaña, no se comparte.
const ACTING_KEY = 'acting-company'

export function getActingCompany() {
  try {
    const raw = sessionStorage.getItem(ACTING_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.id ? parsed : null
  } catch {
    return null
  }
}

export function setActingCompany(company) {
  try {
    if (company?.id) sessionStorage.setItem(ACTING_KEY, JSON.stringify(company))
    else sessionStorage.removeItem(ACTING_KEY)
  } catch {
    /* sin sessionStorage no hay modo mentor */
  }
}

// Aviso pendiente de mostrar: «X retiró tu acceso». Lo deja quien detecta la
// pérdida de acceso y lo consume la pantalla de inicio.
const LOST_KEY = 'mentor-access-lost'

export function setMentorAccessLost(companyName) {
  try {
    if (companyName) sessionStorage.setItem(LOST_KEY, companyName)
    else sessionStorage.removeItem(LOST_KEY)
  } catch {
    /* sin aviso */
  }
}

export function getMentorAccessLost() {
  try {
    return sessionStorage.getItem(LOST_KEY)
  } catch {
    return null
  }
}

// Agrega el encabezado solo a las peticiones de datos (REST), no a Auth.
const fetchWithCompany = (input, init = {}) => {
  const acting = getActingCompany()
  const url = typeof input === 'string' ? input : input?.url || ''
  if (!acting || !url.includes('/rest/v1/')) return fetch(input, init)
  const headers = new Headers(init.headers || {})
  headers.set('x-company-id', acting.id)
  return fetch(input, { ...init, headers })
}

// 🔹 Cliente principal de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithCompany },
  auth: {
    // Mantiene la sesión guardada entre recargas.
    persistSession: true,
    // Renueva el token automáticamente antes de que expire, de modo que la
    // sesión no caduque mientras el usuario tiene la app abierta.
    autoRefreshToken: true,
    // Necesario para el flujo de recuperación de contraseña (el token llega
    // en la URL de redirección).
    detectSessionInUrl: true,
  },
})