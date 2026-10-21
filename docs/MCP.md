# Servidor MCP (conectar Claude a tu cuenta)

La app expone un **servidor MCP** (Model Context Protocol) para que un cliente de IA —Claude.ai, Claude Desktop, Claude Code, Cursor, ChatGPT…— pueda leer la información de la cuenta del usuario que lo conecta: su matriz de riesgos, su planeación estratégica y su análisis financiero.

- **Solo lectura** (versión 1): ninguna herramienta modifica datos.
- **Cada quien ve solo lo suyo**: el cliente MCP se autentica con la cuenta del usuario (OAuth 2.1) y cada herramienta corre con las mismas políticas "solo el dueño" de la base de datos.
- **Mismos cálculos que la app**: prioridades, FODA y estados financieros (modelo MP-AFH1: Estado de Resultados, Balance, Estado de cambios, EBITDA, 41 razones y análisis opcionales) salen de los módulos de `src/config/` copiados a la función con `npm run mcp:sync`.
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

Las herramientas se ofrecen **según los módulos a los que el usuario tiene acceso** (misma regla que la app: `is_admin()` y la tabla `user_module_access`). Un administrador ve todas; un usuario con solo "Gestión del Riesgo" ve únicamente las de riesgos; una cuenta sin módulos solo ve `resumen_general`, que le indica pedir acceso. Por eso la pantalla de consentimiento habla en general de "tu cuenta en el software de Mara Pérez" sin listar módulos.

| Módulo | Herramientas |
|---|---|
| (siempre) | `resumen_general` |
| Gestión del Riesgo (`risk`) | `listar_departamentos`, `listar_riesgos`, `obtener_riesgo`, `resumen_riesgos` |
| Planeación Estratégica (`strategic`) | `resumen_plan`, `prioridades`, `foda`, `iniciativas`, `analisis_cliente`, `competidores` |
| Análisis Financiero (`fin-analysis`) | `empresa_financiera`, `estado_resultados`, `balance_general`, `flujo_efectivo`, `razones_financieras`, `analisis_opcionales` |

| Herramienta | Qué devuelve |
|---|---|
| `resumen_general` | Vista rápida de los tres módulos: riesgos críticos, prioridades, iniciativas vencidas y, en `analisis_financiero`, el último periodo (`empresa`, `moneda`, `unidad`, `ultimo_periodo`, `parcial`, `ventas`, `crecimiento_ventas`, `margen_operativo`, `liquidez` como texto de `formatRatio` y `semaforo_razones` = { verde, ambar, rojo }) |
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
| `empresa_financiera` | Datos de la empresa, periodos (con `parcial`) y segmentos de negocio con ventas y costo por periodo |
| `estado_resultados` | Estado de Resultados por periodo con % sobre ventas, partidas que no son efectivo y EBITDA |
| `balance_general` | Totales del Balance con el resultado del periodo calculado y si cuadra (opción `detalle` para las cuentas con su % del activo) |
| `flujo_efectivo` | Estado de cambios en la situación financiera "(+) fuentes (−) aplicaciones", bloque por bloque, con la conciliación de caja |
| `razones_financieras` | Las 41 razones por periodo en 6 grupos: 25 con semáforo (etiqueta y motivo cuando no aplica) y 16 informativas |
| `analisis_opcionales` | Segmentos, desglose del gasto y estacionalidad, cada uno con su diferencia contra el Estado de Resultados (parámetro `analisis`) |

### Herramientas del Análisis Financiero (modelo MP-AFH1, servidor v1.1.0)

Todas devuelven `moneda`, `unidad: 'miles'` y una lista `periodos` con `periodo` (`yearLabel`, p. ej. "2025" o "jun 2026") y `parcial` ("6 meses" o `null`). Los costos, gastos e impuestos van en positivo y ya están restados en los totales; `utilidad_cambiaria` y `otros_productos` llevan signo. `cuadra` = |diferencia| ≤ 0.5. Los porcentajes (`pct_*`, `*_pct`) van con un decimal (31.9 = 31.9 %) o `null` cuando no hay base.

| Herramienta | Entrada | Qué devuelve por periodo |
|---|---|---|
| `empresa_financiera` | — | `empresa { nombre, pais, actividad_principal, actividades_secundarias, moneda, unidad }`, `periodos [{ id, etiqueta, anio, meses, parcial }]`, `segmentos [{ nombre, ventas_por_periodo, costo_por_periodo }]` (mapas etiqueta → cifra). |
| `estado_resultados` | — | Los 17 renglones del estado (`ventas`, `costo_de_ventas`, `utilidad_bruta`, `gasto_de_venta`, `gasto_de_administracion`, `gastos_operativos_en_general`, `gasto_operativo`, `resultado_de_operacion`, `productos_financieros`, `gastos_financieros`, `utilidad_cambiaria`, `resultado_integral_de_financiamiento`, `otros_productos`, `resultado_antes_de_impuestos`, `isr`, `ptu`, `utilidad_neta`), `pct_sobre_ventas` con las mismas claves, `partidas_no_efectivo { depreciacion_y_amortizacion, reserva_cuentas_por_cobrar, reserva_inventarios }`, `ebitda` y `margen_ebitda_pct`. Cifras reales del periodo, sin anualizar. |
| `balance_general` | `detalle` (bool, default `false`) | `activo_circulante`, `activo_no_circulante`, `total_activo`, `pasivo_circulante`, `pasivo_largo_plazo`, `total_pasivo`, `resultado_del_periodo` (utilidad neta del Estado de Resultados, no capturado), `total_capital_contable`, `total_pasivo_mas_capital`, `diferencia`, `cuadra`; con `detalle`, `cuentas [{ grupo, clave, nombre, valor, pct_total_activo }]` solo de las cuentas con cifra. |
| `flujo_efectivo` | — | Solo periodos con periodo anterior (`periodo_anterior`); si hay menos de dos periodos devuelve `mensaje`. Bloques: `ebitda { resultado_de_operacion, depreciacion_y_amortizacion, reservas_cartera_e_inventarios, total }`, `capital_de_trabajo { clientes, inventarios, proveedores, pagos_anticipados, cuentas_por_cobrar_relacionadas, cuentas_por_pagar_relacionadas, anticipos_de_clientes, gastos_acumulados, total }`, `flujo_de_operacion`, `impuestos { impuestos_por_recuperar, impuestos_por_pagar, isr_y_ptu, total }`, `costo_integral_financiamiento_pagado`, `efectivo_generado_por_la_operacion`, `inversion { capex, otros_activos, total }`, `flujo_neto_de_inversion`, `financiamiento_externo { porcion_circulante_anterior, deuda_bancaria_corto_plazo, deuda_bancaria_largo_plazo, otros_activos_circulantes, otras_cuentas_por_cobrar, otras_cuentas_por_pagar, acreedores, otros_ingresos, cargos_diferidos, creditos_diferidos, total }`, `accionistas { aportaciones, dividendos, total }`, `flujo_de_financiamiento`, `flujo_del_periodo`, `caja_inicial`, `caja_final_calculada`, `caja_final_balance`, `diferencia`, `cuadra`. Signo: positivo = fuente, negativo = aplicación. |
| `razones_financieras` | — | `grupos [{ clave, nombre, pregunta }]` y por periodo `meses`, `indicadores [{ clave, nombre, grupo, informativo, valor, valor_texto, semaforo, etiqueta, motivo }]` (41, en el orden del catálogo; `informativo: true` = sin semáforo, `etiqueta` `null`), `semaforo { verde, ambar, rojo, na }` (solo los 25 con semáforo) y `atencion [{ clave, nombre, valor_texto, semaforo }]` (rojos y luego ámbar). Saldos al cierre; días sobre meses × 30; crecimiento, ROA y ROE anualizados en parciales. |
| `analisis_opcionales` | `analisis`: `todos` (default), `segmentos`, `desglose_gasto`, `estacionalidad` | `segmentos { capturado, periodos [{ segmentos [{ nombre, ventas, pct_ventas, costo, pct_costo, utilidad_bruta, margen_bruto_pct }], total_ventas, total_costo, total_utilidad_bruta, margen_bruto_pct, ventas_segun_estado_resultados, costo_segun_estado_resultados, diferencia_ventas, diferencia_costo, cuadra }] }`; `desglose_gasto { capturado, periodos [{ conceptos [{ clave, nombre, valor, pct_total }] (20), gastos_de_operacion, partidas_virtuales { depreciacion_y_amortizacion, amortizaciones, reserva_cuentas_por_cobrar, reserva_inventarios, otras_partidas_virtuales }, total, gasto_operativo_segun_estado_resultados, diferencia, cuadra }] }`; `estacionalidad { capturado, periodos [{ meses [{ mes, ventas, pct }] (solo los meses del periodo), total, ventas_segun_estado_resultados, diferencia, cuadra }] }`. |

Las fórmulas, los motivos de N/A y las bandas del semáforo son las de [02 - Reglas de Negocio §7](./02-REGLAS-DE-NEGOCIO.md); `index.ts` no las repite: llama a `computeIncome`, `computeBalance`, `computeEbitda`, `computeCashflow`, `computeRatios`, `summarizeRatios`, `computeSegments`, `computeExpenseBreakdown` y `computeSeasonality` de `_shared/app/finCalc.js`.

> **Nota (Fase 2 de perspectivas — riesgos críticos en el plan):** las funciones nuevas de `src/config/strategicCalc.js` (`riskObjectivesFrom`, `riskInitiativeWarnings`, `focusItems`, `mergeFodaWithRisks`, plantillas de `strategicCatalog.js`, etc.) ya están **sincronizadas** a `supabase/functions/_shared/app/` con `npm run mcp:sync`, pero el servidor **aún no las expone**: `resumen_plan`, `prioridades`, `foda` e `iniciativas` siguen respondiendo solo con debilidades y no incluyen los riesgos críticos que la app ya muestra como objetivos de prioridad alta. Incorporarlos a las herramientas estratégicas (y a `resumen_general`) queda para una fase posterior; `index.ts` no cambió y la función no se redesplegó por esta fase.


Ejemplos de preguntas en Claude: *"¿Cuáles son mis riesgos intolerables sin controles?"*, *"Resume mi plan estratégico y dime qué iniciativas vencen este mes"*, *"¿Cómo cambió mi margen operativo entre 2024 y 2025?"*, *"¿Qué razones financieras tengo en rojo y qué significan?"*, *"¿Cuánto efectivo generó la operación el año pasado y a dónde se fue?"*, *"¿Mis segmentos suman lo mismo que el Estado de Resultados?"*.

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
- **Redesplegar la función por el modelo MP-AFH1** (`npm run mcp:sync` ya corrido; falta `npx supabase functions deploy mcp --no-verify-jwt`). El código de `index.ts` (v1.1.0) y las copias en `_shared/app/` ya siguen el modelo nuevo, pero la función **no se desplegó en esta fase**: en producción sigue la v1.0.0 con el modelo anterior (18 razones, flujo directo, `computeIncome` por líneas). Hay que desplegarla **junto con** la migración `supabase-fin-model-afh1.sql` y el despliegue de la app: una vez migrados los datos, la función vieja leería secciones y claves que ya no existen (`cost:<lineId>`, `balance.caja`) y devolvería ceros.
