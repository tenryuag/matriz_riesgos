# Servidor MCP (conectar Claude a tu cuenta)

La app expone un **servidor MCP** (Model Context Protocol) para que un cliente de IA —Claude.ai, Claude Desktop, Claude Code, Cursor, ChatGPT…— pueda leer la información de la cuenta del usuario que lo conecta: su matriz de riesgos, su planeación estratégica y su análisis financiero.

- **Solo lectura** (versión 1): ninguna herramienta modifica datos.
- **Cada quien ve solo lo suyo**: el cliente MCP se autentica con la cuenta del usuario (OAuth 2.1) y cada herramienta corre con las mismas políticas "solo el dueño" de la base de datos.
- **Mismos cálculos que la app**: prioridades, FODA y estados financieros salen de los módulos de `src/config/` copiados a la función con `npm run mcp:sync`.
- **Costo para nosotros**: solo la invocación de la Edge Function (despreciable). La conversación la paga el usuario con su propia cuenta de Claude.

URL del servidor (la que se registra en Claude): **`https://app.mara-perez.online/mcp`**

Es un proxy transparente de Netlify (`public/_redirects`) hacia la Edge Function `https://hcmeoducjqudokfhhvyc.supabase.co/functions/v1/mcp`. Se usa el dominio propio por dos razones: la URL es más limpia y **Claude toma el icono del conector del dominio registrable de la URL** (pide el favicon de `mara-perez.online` a un servicio de Google); con la URL de Supabase mostraba el logo de Supabase. La función anuncia la URL pública en el descubrimiento OAuth mediante el secreto `PUBLIC_MCP_URL`.

## Cómo funciona

```
Cliente MCP (Claude) ──① GET/POST sin token──▶ Edge Function `mcp`
                     ◀── 401 + metadatos OAuth ──┘
Cliente ──② registro dinámico + PKCE──▶ Supabase Auth (servidor OAuth 2.1)
Supabase Auth ──③ redirige──▶ app /oauth/consent?authorization_id=…  (el usuario inicia sesión y acepta)
Cliente ◀──④ código → token (JWT del usuario)──┘
Cliente ──⑤ herramientas con bearer token──▶ Edge Function → Supabase con RLS del usuario
```

Piezas en el repositorio:

| Pieza | Archivo |
|---|---|
| Servidor MCP (Edge Function, Deno) | `supabase/functions/mcp/index.ts` |
| Módulos compartidos (copia de `src/config`) | `supabase/functions/_shared/app/*.js` (generados por `npm run mcp:sync`) |
| Pantalla de consentimiento | `src/pages/OAuthConsent.jsx` → ruta `/oauth/consent` |
| Regreso al consentimiento tras el login | `src/pages/Layout.jsx` (lee `sessionStorage.oauth_authorization_id`) |
| Configuración de la CLI | `supabase/config.toml` (`[functions.mcp] verify_jwt = false`) |

## Configuración (una sola vez)

### 1. Panel de Supabase → Authentication

1. **OAuth Server**: activar *OAuth 2.1 server*.
2. **OAuth Server → Authorization Path**: `/oauth/consent`.
3. **OAuth Server → Dynamic Client Registration**: activar (permite que Claude y otros clientes se registren solos).
4. **URL Configuration → Site URL**: debe apuntar al dominio donde esté desplegada la app **con** la pantalla de consentimiento (producción: `https://app.mara-perez.online`; mientras solo exista en staging, usar la URL de staging). El endpoint de autorización que Supabase anuncia es `Site URL + Authorization Path`.
5. En **Redirect URLs** no hace falta agregar nada para MCP (los clientes se registran con sus propias URLs de retorno).

> No corras `supabase config push`: el `config.toml` del repo es mínimo y sobreescribiría la configuración de Auth del panel.

### 1b. Dominio raíz y favicon (para el icono del conector)

El dominio `mara-perez.online` es solo de correo. Para que Claude muestre el logo, la raíz debe servir una página con favicon: `_redirects` hace que la raíz sirva `/favicon.png` y redirija todo lo demás a `app.`. Requiere, una sola vez:

1. Netlify → Domain management → *Add domain alias*: `mara-perez.online` y `www.mara-perez.online` (sitio `matrizriesgos`).
2. En el DNS del dominio: registro `A` de `@` → `75.2.60.5` (balanceador de Netlify) y `CNAME` de `www` → `matrizriesgos.netlify.app`. Los registros `MX` del correo no se tocan.
3. Netlify emite el certificado solo. El icono tarda hasta unos días en refrescarse en el caché de favicons de Google.

Secretos de la función relacionados: `PUBLIC_MCP_URL=https://app.mara-perez.online/mcp` y `PUBLIC_APP_URL=https://app.mara-perez.online` (también `PUBLISHABLE_KEY`, la llave de API nueva).

### 2. Desplegar la función (desde la laptop)

```bash
npx supabase login                      # abre el navegador
npx supabase link --project-ref hcmeoducjqudokfhhvyc
npm run mcp:sync                        # copia src/config → supabase/functions/_shared/app
npx supabase functions deploy mcp --no-verify-jwt
npx supabase functions list             # debe aparecer "mcp"
```

Cada vez que cambie algo en `src/config/finCalc.js`, `finConfig.js`, `strategicCatalog.js` o `strategicCalc.js`, hay que volver a correr `npm run mcp:sync` y desplegar.

### 3. Probar

Sin token debe responder `401` con el encabezado `www-authenticate` apuntando a los metadatos OAuth:

```bash
curl -i https://app.mara-perez.online/mcp
```

Con el inspector oficial (hace el flujo OAuth completo en el navegador):

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP · URL: https://app.mara-perez.online/mcp
```

## Conectar un cliente

- **Claude.ai / Claude Desktop**: Configuración → Conectores → *Agregar conector personalizado* → URL `https://app.mara-perez.online/mcp`. Al conectar, abre la pantalla de consentimiento de la app; el usuario inicia sesión con su cuenta de siempre y acepta.
- **Claude Code**: `claude mcp add --transport http mara-perez https://app.mara-perez.online/mcp`
- Otros clientes MCP con transporte HTTP y OAuth: misma URL.

## Herramientas disponibles (v1, solo lectura)

| Herramienta | Qué devuelve |
|---|---|
| `resumen_general` | Vista rápida de los tres módulos: riesgos críticos, prioridades, iniciativas vencidas, últimas cifras |
| `listar_departamentos` | Departamentos con conteo de riesgos |
| `listar_riesgos` | Riesgos (compactos) con filtros por nivel inherente/residual, tipo de amenaza, departamento y texto |
| `obtener_riesgo` | Detalle completo de un riesgo: calificación, estrategia, controles con su evaluación, residual |
| `resumen_riesgos` | Conteos por nivel y departamento; críticos sin controles o con residual aún alto |
| `resumen_plan` | Visión, misión, valores y avance de cada paso de la planeación estratégica |
| `prioridades` | Debilidades con puntaje, prioridad (Alta/Media/Baja), perspectiva e iniciativas |
| `foda` | FODA automático |
| `iniciativas` | Plan de acción con responsable, fechas, presupuesto y estado (vencidas, próximas, sin responsable) |
| `analisis_cliente` | Las 9 preguntas del cliente con sus respuestas |
| `competidores` | Comparación con cada competidor y respuestas Blue Ocean |
| `empresa_financiera` | Datos de la empresa, años y líneas de negocio |
| `estado_resultados` | Estado de resultados por año con márgenes y variaciones |
| `balance_general` | Totales del balance y si cuadra (opción `detalle` para todas las cuentas) |
| `flujo_efectivo` | Estado de cambios (indirecto) y flujo directo |

Ejemplos de preguntas en Claude: *"¿Cuáles son mis riesgos intolerables sin controles?"*, *"Resume mi plan estratégico y dime qué iniciativas vencen este mes"*, *"¿Cómo cambió mi margen neto entre 2024 y 2025?"*.

## Nota técnica: verificación del token (llaves HS256)

El patrón oficial de Supabase usa `withSupabase({ auth: 'user' })`, que verifica los tokens **localmente contra el JWKS** del proyecto y, por diseño, **rechaza los tokens HS256** del esquema de llaves heredado (ver `docs/auth-modes.md` de `@supabase/server`). Este proyecto todavía firma con HS256, así que la función verifica el bearer token **contra el servidor de Auth** (`auth.getUser`) y con ese token crea el cliente de datos; la RLS aplica igual. Se conserva `withOAuthProtectedResource()` para el descubrimiento OAuth.

Cuando el proyecto migre a *JWT Signing Keys* asimétricas (Supabase → Project Settings → JWT Keys), se puede volver al middleware oficial, pero no es necesario.

Para probar sin pasar por Claude: crear un usuario de prueba con `POST /auth/v1/signup` (apikey anon) y llamar a la función con su `access_token` como bearer; después borrarlo con `DELETE FROM auth.users WHERE email LIKE 'mcp-prueba-%';`.

## Seguridad

- La función no guarda nada: toda escritura futura pasará por herramientas explícitas con confirmación.
- El token que recibe la función es el del usuario (emitido por Supabase Auth); no existe ninguna llave maestra en la función.
- Un usuario conectado por MCP solo ve sus propios datos; los administradores tampoco ven los de otros (mismo criterio que en la app).
- El usuario puede revocar el conector desde su cliente (Claude) en cualquier momento.

## Pendientes / siguientes versiones

- Herramientas de escritura con confirmación (crear riesgo como borrador, agregar iniciativa, marcar control como implementado).
- Perspectivas en lugar de departamentos cuando se apruebe esa propuesta (la herramienta `listar_departamentos` pasará a `listar_perspectivas`).
- Razones financieras cuando exista esa pantalla.
