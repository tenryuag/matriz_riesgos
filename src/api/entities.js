import { supabase } from './supabaseClient';

export const Department = {
  // 🔹 Obtener lista de departamentos
  async list(order = 'created_at') {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order(order.replace('-', ''), { ascending: !order.startsWith('-') })

    if (error) throw error
    return data
  },
  // 🔹 Crear nuevo departamento
  async create(departmentData) {
    const { data, error } = await supabase
      .from('departments')
      .insert([departmentData])
      .select()  // opcional: para obtener el resultado insertado
    if (error) throw error
    return data
  },

  // 🔹 Filtrar departamentos por condiciones
  async filter(filters) {
    let query = supabase.from('departments').select('*')
    for (const key in filters) {
      query = query.eq(key, filters[key])
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }
}

export const Risk = {
  async list(order = 'created_at') {
    const { data, error } = await supabase
      .from('risks')
      .select('*')
      .order(order.replace('-', ''), { ascending: !order.startsWith('-') })

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