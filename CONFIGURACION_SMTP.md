# Configuración de SMTP para Emails de Confirmación en Supabase

## 📧 ¿Qué es SMTP y por qué usarlo?

SMTP (Simple Mail Transfer Protocol) te permite enviar emails desde tu propio servidor de correo personalizado. Esto te da:

- ✅ Emails con tu propio dominio (ej: `noreply@tudominio.com`)
- ✅ Mayor control sobre los emails
- ✅ Mejor entregabilidad (menos probabilidad de ir a spam)
- ✅ Profesionalidad

## 🎯 Proveedores SMTP Recomendados

### 1. **Resend** (⭐ MÁS RECOMENDADO - Moderno y Fácil)

**Por qué es el mejor:**
- ✅ **100 emails GRATIS al día** (3,000 al mes)
- ✅ Configuración super simple
- ✅ Excelente entregabilidad
- ✅ Dashboard moderno
- ✅ No requiere tarjeta de crédito para empezar
- ✅ Diseñado específicamente para developers

**Configuración en Supabase:**
```
Host: smtp.resend.com
Port: 465 (SSL) o 587 (TLS)
Username: resend
Password: [Tu API Key de Resend]
Sender email: noreply@tudominio.com (o el que configures)
Sender name: Matriz de Riesgos
```

**Cómo obtener las credenciales:**
1. Ve a https://resend.com
2. Crea una cuenta gratis
3. Ve a **API Keys**
4. Crea una nueva API Key
5. Copia la API Key (esa es tu password)
6. Si tienes dominio propio, agrégalo en **Domains**
7. Si no, usa el dominio de prueba que te dan

**Plan Gratis:** 100 emails/día, 3,000/mes

---

### 2. **SendGrid** (Muy Popular)

**Por qué es bueno:**
- ✅ **100 emails GRATIS al día** (3,000 al mes)
- ✅ Muy confiable
- ✅ Usado por empresas grandes
- ✅ Buena documentación

**Configuración en Supabase:**
```
Host: smtp.sendgrid.net
Port: 587 (TLS) o 465 (SSL)
Username: apikey (literalmente escribe "apikey")
Password: [Tu API Key de SendGrid]
Sender email: noreply@tudominio.com
Sender name: Matriz de Riesgos
```

**Cómo obtener las credenciales:**
1. Ve a https://sendgrid.com
2. Crea una cuenta gratis
3. Ve a **Settings** → **API Keys**
4. Crea una nueva API Key con permisos de "Mail Send"
5. Copia la API Key (esa es tu password)
6. En **Settings** → **Sender Authentication**, verifica tu email

**Plan Gratis:** 100 emails/día

---

### 3. **Gmail SMTP** (Más Fácil para Empezar - Sin Dominio Propio)

**Por qué usarlo:**
- ✅ No necesitas dominio propio
- ✅ Configuración rápida
- ✅ Gratis hasta 500 emails/día
- ⚠️ Menos profesional (aparece tu email de Gmail)

**Configuración en Supabase:**
```
Host: smtp.gmail.com
Port: 587 (TLS) o 465 (SSL)
Username: tucorreo@gmail.com
Password: [App Password - NO tu contraseña normal]
Sender email: tucorreo@gmail.com
Sender name: Matriz de Riesgos
```

**Cómo obtener las credenciales:**
1. Ve a tu cuenta de Google: https://myaccount.google.com
2. Ve a **Seguridad** → **Verificación en 2 pasos** (actívala si no está)
3. Regresa a **Seguridad** → **Contraseñas de aplicaciones**
4. Genera una nueva contraseña para "Correo"
5. Copia la contraseña de 16 caracteres
6. Usa esa contraseña en Supabase (NO tu contraseña normal de Gmail)

**Límite:** 500 emails/día

---

### 4. **Mailgun** (Para Volumen Alto)

**Por qué usarlo:**
- ✅ **5,000 emails GRATIS al mes** (primeros 3 meses)
- ✅ Muy escalable
- ✅ Buena para producción con volumen

**Configuración en Supabase:**
```
Host: smtp.mailgun.org
Port: 587 (TLS) o 465 (SSL)
Username: postmaster@tudominio.mailgun.org
Password: [Tu SMTP Password de Mailgun]
Sender email: noreply@tudominio.com
Sender name: Matriz de Riesgos
```

**Cómo obtener las credenciales:**
1. Ve a https://mailgun.com
2. Crea una cuenta
3. Ve a **Sending** → **Domain Settings**
4. Copia el **SMTP Username** y **SMTP Password**

**Plan Gratis:** 5,000 emails/mes (primeros 3 meses), luego requiere pago

---

### 5. **Brevo (antes Sendinblue)** (Buen Plan Gratis)

**Por qué usarlo:**
- ✅ **300 emails GRATIS al día** (9,000 al mes)
- ✅ Interfaz en español
- ✅ Buen plan gratuito

**Configuración en Supabase:**
```
Host: smtp-relay.brevo.com
Port: 587 (TLS) o 465 (SSL)
Username: tu-email@ejemplo.com (email con el que te registraste)
Password: [Tu SMTP Key de Brevo]
Sender email: noreply@tudominio.com
Sender name: Matriz de Riesgos
```

**Cómo obtener las credenciales:**
1. Ve a https://brevo.com
2. Crea una cuenta gratis
3. Ve a **SMTP & API** → **SMTP**
4. Crea una nueva SMTP Key
5. Copia la clave

**Plan Gratis:** 300 emails/día

---

## 🚀 Configuración en Supabase (Paso a Paso)

### 1. Ve a Supabase Dashboard

1. Abre tu proyecto: https://supabase.com/dashboard
2. Ve a **Authentication** → **Email Templates**
3. Desplázate hasta la sección **SMTP Settings**

### 2. Completa los Campos SMTP

Según el proveedor que elegiste arriba, completa:

```
Enable Custom SMTP: [✓] Activar
SMTP Host: [según proveedor]
SMTP Port: [587 o 465]
SMTP Username: [según proveedor]
SMTP Password: [tu API Key o password]
Sender Email: noreply@tudominio.com (o tu email)
Sender Name: Matriz de Riesgos
```

### 3. Habilitar Confirmación de Email

1. Ve a **Authentication** → **Providers** → **Email**
2. **Activa** la opción **"Confirm email"**
3. Guarda

### 4. Personalizar el Email de Confirmación (Opcional)

1. Ve a **Authentication** → **Email Templates**
2. Selecciona **"Confirm signup"**
3. Edita el template HTML/texto
4. Puedes usar variables como:
   - `{{ .ConfirmationURL }}` - Link de confirmación
   - `{{ .SiteURL }}` - URL de tu app
   - `{{ .Email }}` - Email del usuario

**Ejemplo de template en español:**

```html
<h2>¡Bienvenido a Matriz de Riesgos!</h2>

<p>Hola,</p>

<p>Gracias por registrarte. Para confirmar tu cuenta, haz clic en el siguiente enlace:</p>

<p><a href="{{ .ConfirmationURL }}">Confirmar mi cuenta</a></p>

<p>Si no solicitaste esta cuenta, puedes ignorar este correo.</p>

<p>Saludos,<br>
Equipo de Matriz de Riesgos</p>
```

### 5. Configurar la URL de Redirección (Site URL)

1. Ve a **Authentication** → **URL Configuration**
2. Configura:
   - **Site URL:** `https://tudominio.com` (o `http://localhost:5173` para desarrollo)
   - **Redirect URLs:** Agrega las URLs permitidas

---

## 🧪 Probar la Configuración

### 1. Enviar un Email de Prueba

1. Ve a **Authentication** → **Users**
2. Haz clic en **"Invite user"**
3. Ingresa un email de prueba
4. Verifica que llegue el email

### 2. Registrar un Usuario de Prueba

1. En tu app, ve a `/register`
2. Regístrate con un email real
3. Verifica que llegue el email de confirmación
4. Haz clic en el link de confirmación
5. Intenta iniciar sesión

---

## 📊 Comparación de Proveedores

| Proveedor | Plan Gratis | Configuración | Profesional | Dominio Propio |
|-----------|-------------|---------------|-------------|----------------|
| **Resend** | 3,000/mes | ⭐⭐⭐⭐⭐ Muy Fácil | ⭐⭐⭐⭐⭐ | Sí |
| **SendGrid** | 3,000/mes | ⭐⭐⭐⭐ Fácil | ⭐⭐⭐⭐ | Sí |
| **Gmail** | 500/día | ⭐⭐⭐⭐⭐ Muy Fácil | ⭐⭐ | No |
| **Mailgun** | 5,000/mes* | ⭐⭐⭐ Medio | ⭐⭐⭐⭐ | Sí |
| **Brevo** | 9,000/mes | ⭐⭐⭐⭐ Fácil | ⭐⭐⭐ | Sí |

*Solo primeros 3 meses

---

## 💡 Mi Recomendación

### Para Empezar Rápido (Sin Dominio):
👉 **Gmail SMTP** - Configuración en 5 minutos

### Para Producción Profesional:
👉 **Resend** - Moderno, fácil, excelente plan gratis

### Para Alto Volumen:
👉 **SendGrid** o **Mailgun** - Más escalables

---

## 🔧 Ejemplo Completo con Resend

### 1. Crear Cuenta en Resend

```
1. Ve a https://resend.com
2. Registrarte con tu email
3. Verificar tu email
```

### 2. Obtener API Key

```
1. Dashboard de Resend → API Keys
2. Clic en "Create API Key"
3. Nombre: "Supabase SMTP"
4. Permisos: "Send emails"
5. Copiar la API Key (empieza con re_...)
```

### 3. Configurar Dominio (Opcional)

Si tienes dominio propio:
```
1. Resend Dashboard → Domains
2. Add Domain → tudominio.com
3. Agregar los registros DNS que te indican
4. Verificar dominio
```

Si NO tienes dominio:
```
- Usa el dominio de prueba: onboarding.resend.dev
- Email será: algo@onboarding.resend.dev
```

### 4. Configurar en Supabase

```
Host: smtp.resend.com
Port: 465
Username: resend
Password: re_tu_api_key_aqui_1234567890
Sender Email: noreply@tudominio.com
Sender Name: Matriz de Riesgos
```

### 5. Activar Confirmación

```
Authentication → Providers → Email
✓ Confirm email
```

### 6. ¡Listo!

Prueba registrando un nuevo usuario.

---

## 🐛 Solución de Problemas

### Email no llega

1. **Verifica la carpeta de spam**
2. **Revisa los logs de Supabase:**
   - Dashboard → Logs → Auth Logs
3. **Verifica las credenciales SMTP:**
   - Prueba enviando un email de prueba desde el dashboard del proveedor
4. **Verifica el Sender Email:**
   - Debe estar verificado en tu proveedor SMTP

### Error: "SMTP authentication failed"

- Verifica que el username y password sean correctos
- Para Gmail, asegúrate de usar App Password, no tu contraseña normal
- Para SendGrid, el username debe ser literalmente "apikey"

### Email va a spam

- Configura SPF, DKIM, y DMARC en tu dominio
- Usa un dominio verificado
- Evita palabras spam en el asunto

---

## 📝 Siguiente Paso: Personalizar el Email

Una vez configurado SMTP, puedes personalizar el email de confirmación en:
**Authentication** → **Email Templates** → **Confirm signup**

Puedes agregar:
- Logo de tu empresa
- Colores corporativos
- Mensaje personalizado
- Instrucciones adicionales

---

¿Necesitas ayuda con algún proveedor específico? ¡Dime cuál prefieres y te ayudo con la configuración detallada! 🚀
