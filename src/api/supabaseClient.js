import { createClient } from '@supabase/supabase-js'

// 🔹 Estas variables las vas a obtener desde tu proyecto en Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 🔹 Cliente principal de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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