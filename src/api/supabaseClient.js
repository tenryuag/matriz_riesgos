import { createClient } from '@supabase/supabase-js'

// 🔹 Estas variables las vas a obtener desde tu proyecto en Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 🔹 Cliente principal de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)