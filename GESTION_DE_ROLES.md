# Gestión de Roles de Usuario

Esta guía explica cómo funciona el sistema de roles y cómo hacer a un usuario administrador.

## 🎭 Roles Disponibles

### 1. **Usuario Normal** (`role: 'user'`)
- Acceso a:
  - ✅ Dashboard
  - ✅ Departamentos (ver y crear)
  - ✅ Riesgos (ver, crear, editar, eliminar)
  - ❌ **NO tiene acceso** a Códigos de Invitación

### 2. **Administrador** (`role: 'admin'`)
- Acceso a **TODO lo anterior** más:
  - ✅ **Códigos de Invitación** (generar, ver, eliminar)
  - ✅ Gestión completa del sistema

## 🔐 Cómo Funciona el Control de Acceso

El sistema verifica el rol del usuario en 3 niveles:

### 1. **Frontend** (src/pages/Layout.jsx)
- Oculta el item "Códigos de Invitación" del menú si no eres admin
- Los usuarios normales no ven la opción

### 2. **Componente** (src/pages/InvitationCodes.jsx)
- Si un usuario intenta acceder directamente a `/InvitationCodes`
- Muestra mensaje: "Acceso Denegado"

### 3. **Base de Datos** (Supabase RLS)
- Políticas que bloquean consultas no autorizadas
- Protección a nivel de base de datos

## 👨‍💼 Cómo Hacer a un Usuario Administrador

### Opción 1: Desde Supabase Dashboard (RECOMENDADO)

**Paso 1:** Ve a Supabase Dashboard
```
https://supabase.com/dashboard → Tu Proyecto → Authentication → Users
```

**Paso 2:** Encuentra al usuario
- Busca por email o navega la lista de usuarios

**Paso 3:** Editar User Metadata
1. Haz clic en el usuario
2. Ve a la pestaña **"User Metadata"** o **"Raw User Meta Data"**
3. Edita el JSON y agrega/modifica:
   ```json
   {
     "role": "admin",
     "full_name": "Nombre del Usuario"
   }
   ```
4. **Guarda** los cambios

**Paso 4:** El usuario debe cerrar sesión y volver a iniciar sesión
- El cambio de rol se aplica en el próximo login

---

### Opción 2: Con SQL (Avanzado)

Si prefieres usar SQL, puedes ejecutar este comando en **SQL Editor**:

```sql
-- Actualizar un usuario específico a admin
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'email-del-usuario@ejemplo.com';
```

**Reemplaza** `email-del-usuario@ejemplo.com` con el email real del usuario.

---

### Opción 3: Durante el Registro (Código)

Si quieres que ciertos usuarios sean admin desde el registro, puedes modificar el archivo `src/pages/Register.jsx`:

```javascript
// Cambiar esto:
role: 'user'

// Por esto (para hacer admin a usuarios específicos):
role: email.includes('@tudominio.com') ? 'admin' : 'user'
```

Esto haría admin automáticamente a cualquier email de tu dominio.

---

## 🧪 Verificar si un Usuario es Admin

### Método 1: Desde la Aplicación

1. Inicia sesión con el usuario
2. Ve a la pantalla principal
3. Verifica si aparece **"Códigos de Invitación"** en el menú lateral
   - ✅ **Sí aparece** = Es admin
   - ❌ **No aparece** = Es usuario normal

### Método 2: Desde Supabase Dashboard

1. Ve a **Authentication** → **Users**
2. Haz clic en el usuario
3. Mira el **User Metadata** o **Raw User Meta Data**
4. Busca el campo `"role": "admin"`

### Método 3: Con SQL

```sql
SELECT
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'full_name' as name
FROM auth.users
WHERE email = 'email-del-usuario@ejemplo.com';
```

---

## 📋 Lista de Usuarios y sus Roles (SQL)

Para ver todos los usuarios y sus roles:

```sql
SELECT
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'full_name' as name,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

---

## 🔄 Cambiar un Admin a Usuario Normal

Si quieres quitar permisos de admin:

**Desde Supabase Dashboard:**
1. **Authentication** → **Users** → Selecciona el usuario
2. Edita **User Metadata**
3. Cambia:
   ```json
   {
     "role": "user"
   }
   ```
4. Guarda y el usuario debe volver a iniciar sesión

**Con SQL:**
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"user"'
)
WHERE email = 'email-del-usuario@ejemplo.com';
```

---

## 🚨 Importante: Protección de Base de Datos

Después de configurar roles, **debes ejecutar las políticas RLS**:

1. Ve a **SQL Editor** en Supabase
2. Ejecuta el archivo: `supabase-admin-rls-policies.sql`
3. Esto protegerá la tabla `invitation_codes` para solo admins

**Si no ejecutas este SQL**, cualquier usuario podría acceder a la API directamente y saltarse la protección del frontend.

---

## 🎯 Primer Admin - Configuración Inicial

Cuando instales el sistema por primera vez:

1. **Regístrate** con tu email principal
2. Ve a **Supabase Dashboard** → **Authentication** → **Users**
3. Encuentra tu usuario recién creado
4. Edita el **User Metadata** y agrega:
   ```json
   {
     "role": "admin",
     "full_name": "Tu Nombre"
   }
   ```
5. Cierra sesión y vuelve a iniciar sesión
6. ✅ Ahora eres administrador

---

## 🔍 Solución de Problemas

### "No veo Códigos de Invitación en el menú"

**Verificar:**
1. ¿El usuario tiene `role: 'admin'` en su metadata?
2. ¿Cerraste sesión y volviste a iniciar sesión después del cambio?
3. ¿Ejecutaste el SQL de políticas RLS?

### "Acceso Denegado al entrar a Códigos de Invitación"

**Causas posibles:**
1. El rol no está configurado como 'admin'
2. El metadata está en un campo diferente (verifica ambos `user_metadata` y `raw_user_meta_data`)
3. No cerraste sesión después del cambio

**Solución:**
1. Verifica el rol en Supabase Dashboard
2. Cierra sesión completamente
3. Limpia el localStorage del navegador (F12 → Application → Local Storage → Clear)
4. Vuelve a iniciar sesión

### "Error al crear código de invitación"

**Causa:** Las políticas RLS no permiten la operación

**Solución:**
1. Ejecuta `supabase-admin-rls-policies.sql`
2. Verifica que el usuario sea admin
3. Verifica los logs en Supabase

---

## 📊 Estructura de User Metadata

El objeto completo de metadata del usuario se ve así:

```json
{
  "role": "admin",           // o "user"
  "full_name": "Juan Pérez"
}
```

Este se guarda en:
- `auth.users.user_metadata` (cuando se setea con signUp)
- `auth.users.raw_user_meta_data` (cuando se edita manualmente)

El código de la app verifica ambos campos para máxima compatibilidad.

---

## 🎓 Buenas Prácticas

1. **Limita los administradores** - Solo da permisos de admin a personas de confianza
2. **Usa emails corporativos** - Considera hacer admin automáticamente a `@tudominio.com`
3. **Audita regularmente** - Revisa quién tiene acceso de admin
4. **Documenta cambios** - Lleva registro de quién es admin y por qué
5. **Protege en 3 niveles** - Frontend, Componente, y Base de Datos (RLS)

---

## ✅ Checklist de Seguridad

- [ ] Ejecutaste `supabase-admin-rls-policies.sql`
- [ ] Configuraste al menos un usuario admin (tú)
- [ ] Verificaste que usuarios normales NO ven "Códigos de Invitación"
- [ ] Probaste que usuarios normales reciben "Acceso Denegado"
- [ ] Verificaste que admins SÍ pueden crear códigos

---

¿Necesitas ayuda? Revisa los logs de Supabase o contacta al soporte técnico. 🚀
