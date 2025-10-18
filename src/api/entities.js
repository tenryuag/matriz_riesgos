import { supabase } from './supabaseClient';


export const Department = {
  async getAll() {
    const { data, error } = await supabase.from('departments').select('*')
    if (error) throw error
    return data
  },
  // Agrega aquí más métodos como create, update, delete, etc.
}

export const Risk = {
  async getAll() {
    const { data, error } = await supabase.from('risks').select('*')
    if (error) throw error
    return data
  },
}



// auth

export const User = {
  // 🔹 Iniciar sesión
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return data.user
    } catch (err) {
      console.error('Error al iniciar sesión:', err.message)
      throw err
    }
  },

  // 🔹 Cerrar sesión
  async logout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return true
    } catch (err) {
      console.error('Error al cerrar sesión:', err.message)
      throw err
    }
  },

  // 🔹 Obtener usuario actual
  async me() {
    try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
        if (error.message === 'Auth session missing!') return null
        throw error
        }
        return data.user
    } catch (err) {
        console.error('Error al obtener usuario:', err.message)
        throw err
    }
    }
}