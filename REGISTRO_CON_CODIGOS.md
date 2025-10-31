# Sistema de Registro con Códigos de Invitación

Este documento explica cómo funciona el nuevo sistema de registro con códigos de invitación y cómo configurarlo.

## 📋 Resumen

Se ha implementado un sistema de registro que requiere códigos de invitación para controlar el acceso. Solo los usuarios que tengan un código válido podrán crear una cuenta en la aplicación.

## 🎯 Características Implementadas

### 1. **Tabla de Códigos de Invitación en Supabase**
- Almacena códigos únicos generados por el administrador
- Cada código puede estar vinculado a un email específico (opcional)
- Los códigos pueden tener fecha de expiración (opcional)
- Se registra quién usó cada código y cuándo

### 2. **Pantalla de Registro** (`/register`)
- Formulario completo con validación
- Campos requeridos:
  - Nombre completo
  - Email
  - Contraseña (mínimo 6 caracteres)
  - Confirmar contraseña
  - Código de invitación
- Validación en tiempo real del código antes de crear la cuenta
- Diseño consistente con el resto de la aplicación

### 3. **Panel de Administración** (`/invitation-codes`)
- Solo accesible para usuarios autenticados
- Genera nuevos códigos automáticamente
- Lista todos los códigos con su estado (disponible, usado, expirado)
- Permite eliminar códigos no usados
- Copia códigos al portapapeles con un clic
- Estadísticas: total, usados, disponibles

### 4. **Traducciones Completas**
- Español e inglés
- Todos los mensajes de error y validación
- Interfaz completamente traducida

## 🚀 Instalación

### Paso 1: Ejecutar el SQL en Supabase

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto `matriz_riesgos`
3. Ve a la sección **"SQL Editor"** en el menú lateral
4. Crea una nueva query
5. Abre el archivo `supabase-invitation-codes.sql` en este repositorio
6. Copia y pega **todo el contenido** del archivo
7. Haz clic en **"Run"** para ejecutar

Esto creará:
- ✅ La tabla `invitation_codes`
- ✅ Índices para optimizar las consultas
- ✅ Políticas de seguridad (RLS)
- ✅ Funciones auxiliares para validar y usar códigos
- ✅ Función para generar códigos aleatorios

### Paso 2: Instalar Dependencias (si es necesario)

Si agregaste el proyecto desde cero, asegúrate de tener instaladas estas dependencias:

```bash
npm install sonner  # Para notificaciones toast
```

Las demás dependencias ya deberían estar instaladas (Radix UI, React Router, etc.)

### Paso 3: Probar el Sistema

1. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Accede a la aplicación (por defecto http://localhost:5173)

3. Inicia sesión con tu cuenta existente

4. Ve a **"Códigos de Invitación"** en el menú lateral

5. Genera un nuevo código (puedes dejarlo automático o personalizarlo)

6. Copia el código generado

7. Cierra sesión

8. En la pantalla de login, haz clic en **"Regístrate aquí"**

9. Completa el formulario con:
   - Nombre completo
   - Email válido
   - Contraseña (mínimo 6 caracteres)
   - Confirmar contraseña
   - El código que generaste

10. Haz clic en **"Crear Cuenta"**

## 📖 Flujo de Uso

### Para el Administrador (tú):

1. **Cliente te paga** → Confirmas el pago manualmente
2. **Generas un código** → Ve a "Códigos de Invitación" y haz clic en "Generar Código"
3. Opciones al generar:
   - **Email específico** (opcional): Si lo vinculas, solo ese email podrá usarlo
   - **Notas** (opcional): Ejemplo: "Cliente Juan - Plan Mensual"
   - **Fecha de expiración** (opcional): Si quieres que expire en cierta fecha
4. **Copias el código** y se lo envías al cliente
5. **Monitoreas el uso** → En la lista verás cuándo fue usado y por quién

### Para el Cliente:

1. Recibe el código de invitación por email/mensaje
2. Va a la página de registro
3. Completa el formulario con sus datos
4. Ingresa el código de invitación
5. Crea su cuenta
6. Puede iniciar sesión inmediatamente

## 🔒 Seguridad

### Validaciones del Código:

- ✅ El código debe existir en la base de datos
- ✅ No debe haber sido usado previamente
- ✅ No debe estar expirado (si tiene fecha de expiración)
- ✅ Si está vinculado a un email, debe coincidir con el email del registro

### Políticas de Seguridad (RLS):

- ✅ Solo usuarios autenticados pueden crear/ver/eliminar códigos
- ✅ Usuarios anónimos solo pueden validar códigos (para el registro)
- ✅ Los códigos usados no se pueden reutilizar
- ✅ Los códigos usados no se pueden eliminar (para mantener el historial)

## 🎨 Componentes Creados

### Archivos Nuevos:

1. **`supabase-invitation-codes.sql`** - Script SQL para Supabase
2. **`src/pages/Register.jsx`** - Pantalla de registro
3. **`src/pages/InvitationCodes.jsx`** - Panel de administración de códigos
4. **`REGISTRO_CON_CODIGOS.md`** - Este archivo de documentación

### Archivos Modificados:

1. **`src/api/entities.js`**
   - Agregado: `User.register()` - Método para registrar usuarios
   - Agregado: `InvitationCode.*` - API completa para códigos

2. **`src/pages/Layout.jsx`**
   - Agregado: Enlace "Regístrate aquí" en el login
   - Agregado: Item "Códigos de Invitación" en el sidebar

3. **`src/pages/index.jsx`**
   - Agregado: Ruta `/register` (pública)
   - Agregado: Ruta `/InvitationCodes` (protegida)

4. **`src/components/LanguageContext.jsx`**
   - Agregadas: +80 nuevas traducciones (ES + EN)

## 🧪 Casos de Prueba

### ✅ Pruebas a Realizar:

1. **Registro Exitoso**
   - [ ] Generar código válido
   - [ ] Registrarse con el código
   - [ ] Verificar que el código se marca como "usado"
   - [ ] Iniciar sesión con la nueva cuenta

2. **Código Inválido**
   - [ ] Intentar registrarse con código inexistente
   - [ ] Verificar mensaje de error apropiado

3. **Código Ya Usado**
   - [ ] Intentar usar el mismo código dos veces
   - [ ] Verificar mensaje "código ya utilizado"

4. **Código Expirado**
   - [ ] Crear código con fecha de expiración pasada
   - [ ] Intentar registrarse
   - [ ] Verificar mensaje "código expirado"

5. **Código con Email Específico**
   - [ ] Crear código vinculado a `usuario@ejemplo.com`
   - [ ] Intentar registrarse con otro email
   - [ ] Verificar rechazo
   - [ ] Registrarse con el email correcto
   - [ ] Verificar éxito

6. **Validación de Formulario**
   - [ ] Contraseña muy corta (< 6 caracteres)
   - [ ] Contraseñas que no coinciden
   - [ ] Email inválido
   - [ ] Campos vacíos

## 📝 Notas Adicionales

### Formato de Códigos

Los códigos generados automáticamente tienen el formato: `XXXX-XXXX-XXXX`
- 12 caracteres alfanuméricos
- Sin caracteres confusos (O, 0, I, 1)
- Fáciles de copiar y compartir

### Personalización

Si quieres cambiar el formato del código, modifica la función `generate_random_code()` en el archivo SQL.

### Base de Datos

La tabla `invitation_codes` incluye:
- `id` - Identificador único
- `code` - El código de invitación (único)
- `email` - Email vinculado (opcional)
- `used` - Si fue usado (boolean)
- `used_by_id` - ID del usuario que lo usó
- `created_at` - Fecha de creación
- `expires_at` - Fecha de expiración (opcional)
- `created_by_id` - ID del admin que lo creó
- `notes` - Notas sobre el cliente/pago

## 🐛 Solución de Problemas

### Error: "No se puede crear el código"
- Verifica que ejecutaste el SQL en Supabase correctamente
- Verifica que la función `generate_random_code()` exista
- Revisa los logs de Supabase para más detalles

### Error: "No se puede validar el código"
- Verifica que la función `validate_and_use_invitation_code()` exista
- Verifica las políticas RLS están habilitadas
- Revisa la consola del navegador para errores

### El código no se marca como usado
- Verifica que la función `mark_invitation_code_used()` exista
- Verifica que el usuario se creó correctamente en Supabase Auth
- Revisa los logs de la base de datos

## 🎉 ¡Listo!

Ahora tienes un sistema completo de registro con códigos de invitación. Puedes:

1. ✅ Generar códigos después de confirmar pagos
2. ✅ Controlar quién puede registrarse
3. ✅ Vincular códigos a emails específicos
4. ✅ Establecer fechas de expiración
5. ✅ Monitorear el uso de códigos
6. ✅ Mantener notas sobre cada código/cliente

¡Disfruta tu nueva funcionalidad! 🚀
