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

  // 🔹 Filtrar riesgos por condiciones
  async filter(filters) {
    let query = supabase.from('risks').select('*')
    for (const key in filters) {
      query = query.eq(key, filters[key])
    }
    const { data, error } = await query
    if (error) throw error
    return data
  },

  // 🔹 Crear nuevo riesgo
  async create(riskData) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { data, error } = await supabase
      .from('risks')
      .insert([{ ...riskData, created_by_id: userId }])
      .select()

    if (error) throw error
    return data
  },

  // 🔹 Actualizar riesgo por ID
  async update(id, riskData) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { data, error } = await supabase
      .from('risks')
      .update({ ...riskData, created_by_id: userId })
      .eq('id', id)
      .select()

    if (error) throw error
    return data
  },

  // 🔹 Eliminar riesgo por ID
  async delete(id) {
    const { data, error } = await supabase
      .from('risks')
      .delete()
      .eq('id', id)
    if (error) throw error
    return data
  }
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
    },

  // 🔹 Registrar nuevo usuario con código de invitación
  async register(email, password, fullName, invitationCode) {
    try {
      // 1. Validar el código de invitación primero
      const validationResult = await InvitationCode.validate(invitationCode, email)

      if (!validationResult.valid) {
        throw new Error(validationResult.message || 'Código de invitación inválido')
      }

      // 2. Crear el usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'user'
          }
        }
      })

      if (error) throw error

      // 3. Marcar el código como usado
      if (data.user) {
        await InvitationCode.markAsUsed(invitationCode, data.user.id)
      }

      return data.user
    } catch (err) {
      console.error('Error al registrar usuario:', err.message)
      throw err
    }
  }
}

// 🔹 Gestión de códigos de invitación
export const InvitationCode = {
  // Validar un código de invitación
  async validate(code, email = null) {
    try {
      const { data, error } = await supabase.rpc('validate_and_use_invitation_code', {
        code_to_validate: code,
        user_email: email
      })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error al validar código:', err.message)
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: 'Error al validar el código de invitación'
      }
    }
  },

  // Marcar código como usado
  async markAsUsed(code, userId) {
    try {
      const { data, error } = await supabase.rpc('mark_invitation_code_used', {
        code_to_mark: code,
        user_id: userId
      })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error al marcar código como usado:', err.message)
      throw err
    }
  },

  // Listar todos los códigos (para admin)
  async list(order = '-created_at') {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('*')
        .order(order.replace('-', ''), { ascending: !order.startsWith('-') })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error al listar códigos:', err.message)
      throw err
    }
  },

  // Crear nuevo código de invitación
  async create(codeData) {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      // Generar código aleatorio si no se proporciona
      let code = codeData.code
      if (!code) {
        const { data: generatedCode, error: genError } = await supabase.rpc('generate_random_code', { length: 12 })
        if (genError) throw genError
        code = generatedCode
      }

      const { data, error } = await supabase
        .from('invitation_codes')
        .insert([{
          code,
          email: codeData.email || null,
          expires_at: codeData.expires_at || null,
          notes: codeData.notes || null,
          created_by_id: userId
        }])
        .select()

      if (error) throw error
      return data[0]
    } catch (err) {
      console.error('Error al crear código:', err.message)
      throw err
    }
  },

  // Eliminar código de invitación
  async delete(id) {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .delete()
        .eq('id', id)

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error al eliminar código:', err.message)
      throw err
    }
  },

  // Obtener estadísticas de códigos
  async stats() {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('used')

      if (error) throw error

      const total = data.length
      const used = data.filter(c => c.used).length
      const available = total - used

      return { total, used, available }
    } catch (err) {
      console.error('Error al obtener estadísticas:', err.message)
      throw err
    }
  }
}