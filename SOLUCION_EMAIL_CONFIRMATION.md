# Solución: Error "Invalid login credentials" después del registro

## 🔍 Problema

Después de registrarse exitosamente, el usuario no puede iniciar sesión y recibe el error:
```
Error al iniciar sesión: Invalid login credentials
```

## 🎯 Causa

Por defecto, **Supabase requiere confirmación de email**. Cuando un usuario se registra:
1. Se crea la cuenta
2. Supabase envía un email de confirmación
3. El usuario **NO puede** iniciar sesión hasta confirmar el email
4. Por eso aparece "Invalid login credentials"

## ✅ Soluciones

### Opción 1: Desactivar Confirmación de Email (RÁPIDO - Para Desarrollo)

Esta es la solución más rápida para que funcione inmediatamente:

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Ve a **Authentication** → **Providers** → **Email**
3. Desactiva la opción **"Confirm email"**
4. Guarda los cambios

**Ventajas:**
- ✅ Funciona inmediatamente
- ✅ No requiere código adicional
- ✅ Usuarios pueden iniciar sesión inmediatamente después del registro

**Desventajas:**
- ⚠️ No valida que el email sea real
- ⚠️ Menos seguro para producción

### Opción 2: Auto-Confirmar Usuarios con Código de Invitación (RECOMENDADO - Para Producción)

Esta opción es más segura porque solo auto-confirma a usuarios que tienen un código válido:

#### Paso 1: Crear un Database Trigger en Supabase

Ve a **SQL Editor** en Supabase y ejecuta:

```sql
-- Función que auto-confirma usuarios que se registran con código de invitación
CREATE OR REPLACE FUNCTION auto_confirm_invited_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el usuario se registró con un código de invitación válido
  -- (chequeamos si hay un código no usado que coincida con el email)
  IF EXISTS (
    SELECT 1 FROM invitation_codes
    WHERE email = NEW.email
    AND used = false
  ) THEN
    -- Auto-confirmar el email
    NEW.email_confirmed_at = NOW();
    NEW.confirmed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger que se ejecuta ANTES de insertar en auth.users
CREATE TRIGGER auto_confirm_users_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_invited_users();
```

**Ventajas:**
- ✅ Más seguro
- ✅ Solo auto-confirma usuarios con código válido
- ✅ Mantiene la validación de email para otros flujos
- ✅ Profesional para producción

**Desventajas:**
- ⚠️ Requiere ejecutar SQL adicional

### Opción 3: Configurar emailAutoConfirm en el registro

Modificar el código para auto-confirmar programáticamente:

```javascript
// En entities.js, modificar User.register()
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
      role: 'user'
    },
    emailRedirectTo: undefined  // Desactivar redirect de confirmación
  }
})
```

Luego, en **Supabase Dashboard** → **Authentication** → **Email Templates** →
Puedes personalizar el email de confirmación o desactivarlo completamente.

## 🚀 Solución Rápida (Recomendada para empezar)

**Para que funcione AHORA MISMO:**

1. Ve a Supabase: https://supabase.com/dashboard
2. **Authentication** → **Providers** → **Email**
3. **Desactiva "Confirm email"**
4. Guarda

Listo, ya puedes iniciar sesión inmediatamente después del registro.

## 🔐 Para Producción

Usa la **Opción 2** (Database Trigger) porque:
- Solo auto-confirma usuarios con código de invitación válido
- Mantiene seguridad
- Valida que el código y el email coincidan
- Más profesional

## 📝 Estado Actual de los Usuarios

Si ya registraste usuarios y no pueden iniciar sesión, tienes 2 opciones:

### A) Confirmarlos manualmente en Supabase:

1. Ve a **Authentication** → **Users**
2. Encuentra el usuario
3. Haz clic en los 3 puntos → **"Confirm user"**

### B) Eliminarlos y que se registren de nuevo:

1. Ve a **Authentication** → **Users**
2. Elimina el usuario
3. Desactiva la confirmación de email (Opción 1 arriba)
4. Pide al usuario que se registre nuevamente

## 🧪 Verificar que funciona

Después de aplicar la solución:

1. Si usaste Opción 1 (desactivar confirmación):
   - Los usuarios existentes aún no podrán iniciar sesión
   - Confírmalos manualmente o elimínalos
   - Los nuevos registros funcionarán inmediatamente

2. Si usaste Opción 2 (trigger):
   - Los usuarios existentes aún no podrán iniciar sesión
   - Confírmalos manualmente
   - Los nuevos registros se auto-confirmarán

3. Registra un nuevo usuario de prueba
4. Intenta iniciar sesión
5. ✅ Debería funcionar sin problemas

## 💡 Recomendación Final

**Para desarrollo:** Usa Opción 1 (desactivar confirmación)
**Para producción:** Usa Opción 2 (database trigger)

¡Con esto el sistema quedará completamente funcional! 🎉
