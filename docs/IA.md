# Asistente de IA (Claude) dentro de la app

La app tiene un **asistente de IA** que usa Claude para cinco tareas puntuales: explicar el Informe financiero en lenguaje llano, leer estados financieros desde un PDF o una foto, sugerir cómo evaluar un riesgo, proponer iniciativas para un objetivo del plan y redactar un resumen ejecutivo. Cada tarea es un botón con el icono `Sparkles` en la pantalla donde hace falta.

- **No es un chat.** Para conversar con los datos ("¿cuáles son mis riesgos intolerables sin controles?") está el conector MCP ([MCP.md](./MCP.md)), que corre con la cuenta de Claude del propio usuario. El asistente de la app hace trabajos acotados con un contrato fijo (JSON) y **lo paga la consultoría** con su llave.
- **Sugiere; el usuario confirma.** Nada se escribe en la base de datos por iniciativa de la IA. Las únicas excepciones son la interpretación del Informe y el Resumen ejecutivo, cuyo resultado se guarda (uno por usuario y tipo) para no volver a pagar la misma respuesta.
- **Cada quien ve solo lo suyo.** La Edge Function recibe el JWT del usuario y lee con sus políticas RLS "solo el dueño"; el contexto que recibe Claude sale únicamente de los datos de ese usuario.
- **La llave nunca sale del servidor.** Vive en el secreto `ANTHROPIC_API_KEY` de Supabase; el navegador solo habla con la Edge Function `ia`.
- **Gasto acotado.** Topes por usuario (24 h) y global (30 días), bitácora de cada llamada (`ia_usage`) y panel "Uso de IA" para administradores.
- **Mismos cálculos que la app.** Estados financieros, razones y catálogos salen de los módulos de `src/config/` copiados a `supabase/functions/_shared/app/` con `npm run mcp:sync` (los mismos que usa el servidor MCP).

## Las cinco funciones

| # | Función | Dónde está el botón | Acción | Módulo que exige | ¿Guarda algo? |
|---|---|---|---|---|---|
| 1 | **Explicar con IA** el Informe financiero | Análisis Financiero → Informe (`FinAnalysisReport`): tarjeta «Explicación con IA» entre la introducción y los cuadros; solo aparece cuando ya hay cifras (`ready`) | `interpretar_informe` | `fin-analysis` | Sí: `ia_resultados` con `kind = 'informe'` (uno por usuario) |
| 2 | **Importar desde PDF** | Análisis Financiero → Estado de Resultados y Balance General (`FinAnalysisIncome`, `FinAnalysisBalance`): botón en el encabezado, visible si hay periodos registrados; abre un diálogo de tres pasos | `extraer_estados` | `fin-analysis` | No: la IA devuelve las cifras; el usuario elige ejercicio y filas y la app guarda con `FinValue.saveRows` |
| 3 | **Sugerir con IA** al capturar un riesgo | Gestión del Riesgo → Agregar / editar riesgo (`AddRisk`), debajo de la descripción; se habilita con ≥ 10 caracteres | `sugerir_riesgo` | `risk` | No: cada bloque tiene su botón «Aplicar» que llena el formulario; se guarda solo al pulsar «Guardar» del riesgo |
| 4 | **Sugerir iniciativa con IA** | Planeación Estratégica → Iniciativas (`StrategicInitiatives`): al pie de la lista de iniciativas de cada riesgo crítico y de cada debilidad | `sugerir_iniciativa` | `strategic` | No: «Agregar al plan» crea la fila en pantalla y el autoguardado de la página la sube como cualquier otra |
| 5 | **Resumen ejecutivo** | Tarjeta «Resumen ejecutivo con IA» debajo de los módulos en la pantalla de inicio (`ModuleLauncher`) → `/ExecutiveSummary`; botones «Generar con IA» / «Volver a generar» e «Imprimir» | `resumen_ejecutivo` | cualquiera (cubre solo los módulos a los que el usuario tiene acceso) | Sí: `ia_resultados` con `kind = 'resumen_ejecutivo'` (uno por usuario) |
| — | **Uso de IA** (administración) | Módulo Administración → «Uso de IA» (`/IaUsage`) | `estado` + tablas | admin | Solo lee |

### Qué devuelve cada una y cómo se usa

**1. Explicar con IA (Informe).** Un diagnóstico para el dueño de la empresa a partir del resumen financiero compacto (`finSummary`: empresa, moneda, segmentos y, por periodo, Estado de Resultados, % sobre ventas, Balance, Estado de cambios y las 41 razones con semáforo). La tarjeta muestra el título, el periodo analizado, un chip de **salud general** (sana / vigilar / atender, con los colores del semáforo de `Semaforo.jsx`), el resumen, dos columnas **Fortalezas** / **Alertas** (punto de color; la acción concreta en cursiva), **Tendencias**, **Preguntas para tu contador** (numeradas) y la **Conclusión** destacada. Al abrir el Informe se muestra la última explicación guardada sin llamar a la IA (con la nota "Es tu última explicación guardada. Si capturaste datos nuevos, vuelve a generarla."); el botón dice «Explicar con IA» la primera vez y «Volver a generar» cuando ya hay una. Ese botón llama **sin** `force`: si la función responde `cached: true` (las cifras no cambiaron), la app avisa "Tus datos no han cambiado desde la última vez; se muestra la versión guardada (sin costo)." y ofrece el botón secundario «Generar de nuevo de todos modos» (`force: true`). La tarjeta se imprime junto con los cuadros; los botones no (`print:hidden`).

**2. Importar desde PDF.** *Paso 1:* el usuario arrastra o elige los archivos que emite su contador (PDF, JPG, PNG o WebP; hasta 4 archivos y 8 MB en total, 5 MB por imagen); «Leer con IA» los convierte a base64 (`fileToBase64`) y manda `archivos` más `anios` (los ejercicios que el usuario tiene en Datos generales, para que la IA etiquete cada columna). *Paso 2:* cabecera con la unidad detectada ("pesos (convertidas a miles)", "miles", "millones…"), moneda, empresa y advertencias; por cada periodo del documento un bloque con el selector «Guardar en el ejercicio:» (preselecciona el que coincide en año y meses; «No importar» si ninguno), aviso si los meses del documento y del ejercicio difieren, dos tablas (Estado de Resultados y Balance; la de la pantalla desde donde se abrió va primero) con columnas Cuenta | Actual | Del documento | Sobrescribir —marcadas por defecto solo las cuentas que **no** tienen valor actual; "sin cambio" cuando coinciden; botones «Todas» / «Ninguna»—, la **comprobación** (utilidad neta, total activo y total pasivo + capital según el documento vs. calculados con las cifras leídas, en ámbar si no coinciden) y las notas de mapeo de la IA. *Paso 3:* «Guardar cifras seleccionadas (n)» → `FinValue.saveRows(analysisId, rows)` solo con las filas marcadas → `onImported()` recarga la pantalla. Antes de abrir el diálogo la página llama a `flush()` del autoguardado para no pisar la captura en vuelo. La utilidad neta y los totales nunca se importan: la app los calcula.

**3. Sugerir con IA (riesgo).** Manda la `descripcion` y, si ya se eligieron, la `perspectiva_key`, el `tipo_amenaza` y el nombre del `departamento`. Devuelve una **redacción mejorada** (causa → evento → consecuencia, una oración), la **evaluación inherente** (tipo de amenaza, perspectiva, probabilidad, impacto, nivel calculado en la app con `riskScore` / `levelKeyFromScore`, estrategia y justificación), **tres controles** (descripción, qué mitiga, tipo de control, tipo de proceso, responsable sugerido) y el **residual** esperado, más una nota (por ejemplo, si se parece a un riesgo ya capturado o si la IA cambió la perspectiva elegida). Botones: «Usar esta redacción», «Aplicar evaluación», «Aplicar los 3 controles» o «Usar como medida n» (la siguiente medida vacía), «Aplicar residual», «Aplicar todo» y «Descartar». `AddRisk.applyPatch(patch)` mezcla el parche en `formData` y recalcula `inherent_level`, `residual_level` y `control_grade_n` igual que `handleChange`; documentado / evidencia / responsable / frecuencia de cada control quedan al usuario, porque son hechos de su empresa. Todos los textos de la interfaz usan `t('ia…')` (es / en); los que genera la IA vienen en español.

**4. Sugerir iniciativa con IA.** Para un objetivo de prioridad alta (`{ id, label, tipo: 'debilidad' | 'riesgo', perspectiva, estrategia, nivel, controles, fuente }`) y los títulos que ya tiene (`existingTitles`, para no repetir), devuelve **dos opciones** etiquetadas «Rápida y de bajo costo» y «Más completa», cada una con título, resultado esperado, área, responsable (un puesto, no un nombre), KPI, plazo en semanas, presupuesto en MXN (o «Sin estimar»), plan de trabajo en pasos y un «por qué». «Agregar al plan» → `addInitiativeFrom(strategyId, label, fields)` con `start_date` = hoy, `end_date` = hoy + plazo × 7 días, `steps` numerados uno por línea y `budget` como texto; la tarjeta pasa a «Agregada ✓» y la página se desplaza a la iniciativa nueva. Para riesgos Intolerable la IA propone plazos ≤ 4 semanas; Alto ≤ 8.

**5. Resumen ejecutivo.** Página fuera de los módulos (el Layout la muestra en modo "launcher", sin menú lateral). Arriba, chips de los módulos que cubre ("Cubre los módulos a los que tienes acceso"; los que no, con candado). Al abrir se muestra el último resumen guardado; «Generar con IA» pide uno y «Volver a generar» fuerza una versión nueva. El documento trae portada (título y fecha en letras), **Resumen general** (con aviso de los módulos sin datos), una sección por módulo con su icono y color (Matriz de riesgos / Planeación estratégica / Análisis financiero; "Sin información capturada en este módulo" cuando no hay datos), **Prioridades para los próximos 90 días** como tarjetas numeradas con chip del módulo (o «Transversal») y responsable sugerido, el **Cierre**, la nota "Generado con IA…" y el costo aproximado. «Imprimir» → `window.print()` (cabecera, botones y barra del Layout ocultos en papel). Si ningún módulo tiene datos (`sin_datos`) se muestra un estado vacío con enlaces a los módulos.

Toda salida del asistente lleva `<IaDisclaimer generatedAt cached text? />`: "Generado con IA el {fecha}. Es una sugerencia: revísala con tu criterio y el de tu asesor antes de tomar decisiones." (el sufijo "guardado; tus datos no han cambiado" solo cuando el servidor respondió `cached: true`; en el módulo de riesgos el texto viene de la clave i18n `iaDisclaimerShort`, es / en). El costo aproximado de la llamada (`fmtUsd(usage.cost_usd)`) solo se muestra en el Informe, el Resumen y el panel de administración.

## Cómo funciona

```
App (React) ──① supabase.functions.invoke('ia', { action, …params })──▶ Edge Function `ia`
             [Authorization: Bearer <JWT del usuario>, lo pone supabase-js]
Edge Function ──② auth.getUser(token) ✓ → cliente Supabase con ese token (RLS "solo el dueño")
              ──③ acceso por módulo (is_admin(), user_module_access) y topes de gasto:
                  reserva atómica de la llamada (RPC ia_reserve con service_role)
              ──④ arma el contexto con los datos del usuario (context.ts) y llama a Claude:
                  askJson({ system (cacheado), content, JSON Schema })──▶ API de Claude
                  [ANTHROPIC_API_KEY solo existe aquí]
              ──⑤ completa la fila reservada en ia_usage con tokens y costo reales (o la borra
                  si no hubo llamada); informe y resumen se guardan en ia_resultados
App ◀──⑥ { ok: true, result, usage, cached, generated_at }  ó  { ok: false, error: { code, message } }
```

Piezas en el repositorio:

| Pieza | Archivo |
|---|---|
| Entrada de la Edge Function (CORS, JWT, acceso por módulo, topes, bitácora, acción `estado`) | `supabase/functions/ia/index.ts` |
| Llamada a Claude: `askJson`, precios, errores del SDK, bloques PDF / imagen | `supabase/functions/ia/claude.ts` |
| Contexto de la empresa, finanzas, riesgos y plan (con el cliente del usuario) | `supabase/functions/ia/context.ts` |
| Resultados guardados y huella SHA-256 de los datos | `supabase/functions/ia/store.ts` |
| Tipos (`Action`, `ActionCtx`, `ActionResult`, `IaError`) | `supabase/functions/ia/types.ts` |
| Las cinco acciones: prompt, JSON Schema, validación y saneo | `supabase/functions/ia/actions/{informe,extraer,riesgo,iniciativa,resumen}.ts` |
| Módulos compartidos con la app y con `mcp` (`finConfig`, `finCalc`, `riskCalc`, `perspectives`, `strategicCalc`, `strategicCatalog`) | `supabase/functions/_shared/app/*.js` (generados por `npm run mcp:sync`) |
| Tablas `ia_usage` e `ia_resultados`, RPC y RLS | `supabase-ia.sql` |
| Configuración de la CLI | `supabase/config.toml` (`[functions.ia] verify_jwt = false`) |
| Cliente en la app (`callIa`, `IaError`, `iaStatus`, `iaSavedResult`, `IaUsage`, `fmtUsd`, `fileToBase64`) | `src/api/ia.js` |
| Nota al pie «Generado con IA…» | `src/components/ia/IaDisclaimer.jsx` |
| Componentes de cada función | `src/components/fin/IaInterpretacion.jsx`, `src/components/fin/ImportStatementsDialog.jsx`, `src/components/risk/IaRiskSuggest.jsx`, `src/components/strategy/IaInitiativeSuggest.jsx` |
| Páginas | `src/pages/ExecutiveSummary.jsx` (`/ExecutiveSummary`), `src/pages/IaUsageAdmin.jsx` (`/IaUsage`, página `IaUsage` del módulo admin) |
| Pantallas que montan los botones | `FinAnalysisReport.jsx`, `FinAnalysisIncome.jsx`, `FinAnalysisBalance.jsx`, `AddRisk.jsx`, `StrategicInitiatives.jsx`, `ModuleLauncher.jsx` |
| Textos i18n del asistente de riesgos (`ia…`) y del menú (`navIaUsage`) | `src/components/LanguageContext.jsx` |
| Verificación de los schemas y enums | `scripts/check-ia-schemas.ts` (`npm run ia:check`) |

## Contrato de la Edge Function

**Petición:** `POST https://hcmeoducjqudokfhhvyc.supabase.co/functions/v1/ia` con JSON `{ "action": "<acción>", …parámetros }` y la cabecera `Authorization: Bearer <access_token>` (supabase-js la agrega en `functions.invoke`). Solo POST; `OPTIONS` responde el preflight CORS (`Access-Control-Allow-Origin: *`). Cuerpo máximo **12 MB** (`content-length`; los PDF viajan en base64).

**Orden de comprobaciones** (`index.ts`): ① método, tamaño y JSON → ② sesión (`sin_sesion`, 401) → ③ si la acción es `estado`, responde aquí (no exige llave ni módulos) → ④ acción conocida → ⑤ llave configurada (`no_configurado`, 503) → ⑥ al menos un módulo o admin, y el módulo que exige la acción (`sin_acceso`, 403) → ⑦ topes (`limite_diario` / `limite_global`, 429; si la RPC de uso falla, `proveedor`, 500) → ⑧ corre la acción → ⑨ registra en `ia_usage`.

**Respuesta correcta:**

```json
{
  "ok": true,
  "result": { "…": "la forma depende de la acción (abajo)" },
  "usage": { "input_tokens": 9870, "output_tokens": 2310, "cost_usd": 0.0857, "model": "claude-opus-5-5" },
  "cached": false,
  "generated_at": "2026-11-02T18:30:12.345Z"
}
```

`usage` es `null` cuando no se llamó a la IA (se devolvió un resultado guardado, `cached: true`); `generated_at` es el `created_at` del guardado o el momento de la respuesta.

**Error:** `{ "ok": false, "error": { "code": "limite_diario", "message": "Alcanzaste el límite diario del asistente" } }` con el HTTP del código (tabla más abajo). En la app `callIa` lo convierte en `IaError` y sustituye `message` por el texto en español de `IA_ERROR_MESSAGES`.

**Acción `estado`** (la usa el panel de administración y `iaStatus()`):

```json
{
  "ok": true, "version": "1.0.0", "configurado": true, "modelo": "claude-opus-5-5",
  "limites": { "diario_usd": 2, "llamadas_dia": 40, "mensual_usd": 150 },
  "uso": { "usuario_24h_usd": 0.31, "usuario_24h_llamadas": 4, "global_30d_usd": 12.8 }
}
```

`limites.mensual_usd` y `uso.global_30d_usd` solo se incluyen cuando quien pregunta es administrador; los demás usuarios reciben únicamente su propio uso de 24 h.

`uso` es `null` si la RPC `ia_usage_window` falla (típicamente porque no se ha ejecutado `supabase-ia.sql`).

### Acciones

| Acción | Módulo | Body | `maxTokens` | Contexto que lee (con la RLS del usuario) | Guarda |
|---|---|---|---|---|---|
| `interpretar_informe` | `fin-analysis` | `{ force?: boolean }` | 16000 | `finContext` → `finSummary` | `ia_resultados` (`informe`) |
| `extraer_estados` | `fin-analysis` | `{ archivos: [{ nombre, tipo, base64 }], anios: [{ id, year, months }] }` | 16000 | nada de la base: solo los archivos y los ejercicios (≤ 30) que manda la app; antes de llamar cuenta los tokens de entrada (`countInput`, gratis) y rechaza más de 60 000 con `archivo_grande` | no |
| `sugerir_riesgo` | `risk` | `{ descripcion, perspectiva_key?, tipo_amenaza?, departamento? }` | 16000 | `companyContext` + hasta 15 riesgos ya capturados (`riskContext(15)`, opcional: si falla sigue sin ellos) | no |
| `sugerir_iniciativa` | `strategic` | `{ objetivo: { id, label, tipo, perspectiva?, estrategia?, nivel?, controles?, fuente? }, existentes?: string[] }` | 16000 | `companyContext` + plan acotado (visión, misión, ≤ 10 fortalezas, ≤ 10 debilidades por prioridad) | no |
| `resumen_ejecutivo` | ninguno en particular (≥ 1 módulo) | `{ force?: boolean }` | 16000 | según acceso: `riskContext(40)`, `planContext`, `finSummary`, `companyContext` | `ia_resultados` (`resumen_ejecutivo`) |
| `estado` | — | `{}` | — | `ia_usage_window` | no |

**Validaciones y saneo por acción:**

- `interpretar_informe`: `sin_datos` (409) si no hay análisis, no hay periodos o ninguna cifra del Estado de Resultados (`hasAny(sections.income)`).
- `extraer_estados`: de 1 a 4 archivos; `tipo` ∈ `application/pdf`, `image/jpeg`, `image/png`, `image/webp`; tamaño estimado = `base64.length × 0.75`; una imagen > 5 MB → `archivo_grande` (413) "La imagen … pesa más de 5 MB; redúcela o conviértela a PDF"; suma > 8 MB → `archivo_grande` (413); `anios` no vacío con `id` y `year` entero (`months` fuera de 1–12 → 12). Se tolera el prefijo `data:…;base64,`. La respuesta se **normaliza**: cada sección trae todas sus claves (`null` donde no hay cifra), `meses` fuera de 1–12 → 12, `etiqueta` vacía → el año.
- `sugerir_riesgo`: `descripcion` de 10 a 3000 caracteres (se recorta; menos de 10 → `peticion_invalida`); `perspectiva_key` y `tipo_amenaza` fuera del catálogo se ignoran; `departamento` ≤ 120 caracteres. Salida saneada: máximo 3 controles; redacción ≤ 600 (si viene vacía se usa la descripción original), justificación ≤ 1500, nota ≤ 800, descripción de control ≤ 400, responsable ≤ 120.
- `sugerir_iniciativa`: `objetivo.label` y `objetivo.tipo` obligatorios (`peticion_invalida`); `existentes` ≤ 20; `controles` ≤ 3 y solo para `tipo: 'riesgo'`; la app manda la **clave** de la perspectiva y la función la traduce a su etiqueta. Salida: ≤ 2 opciones con título, ≤ 8 pasos (se les quita la numeración si el modelo la puso), plazo inválido → 4 (riesgo Intolerable) / 8 (otro riesgo) / 12 (debilidad) semanas, presupuesto redondeado o `null`; si no viene ninguna iniciativa → `incompleto` (502).
- `resumen_ejecutivo`: un módulo cuenta "con datos" si riesgos `total > 0`, si el plan tiene algún texto o lista, o si hay alguna cifra en `income` o `balance`; los tres vacíos → `sin_datos` (409). Los módulos sin acceso se le anuncian al modelo como "sin acceso" y van en `modulos_sin_datos`.

### Forma del `result`

`interpretar_informe` (`actions/informe.ts`):

```ts
{
  titulo: string                       // «Diagnóstico financiero de {empresa}»
  periodo_analizado: string            // «2024 – jun 2026 (parcial, 6 meses)»
  resumen: string                      // 3–5 oraciones
  salud_general: 'sana' | 'vigilar' | 'atender'
  fortalezas: { indicador: string; clave: string; texto: string }[]           // ≤ 3; clave = clave de la razón o ""
  alertas: { indicador: string; clave: string; semaforo: 'rojo' | 'ambar'; texto: string; accion: string }[]  // ≤ 3
  tendencias: string[]                 // 2–5 frases
  preguntas_contador: string[]         // 3–5 preguntas
  conclusion: string                   // la acción más importante a 90 días
}
```

`extraer_estados` (`actions/extraer.ts`):

```ts
{
  unidad_detectada: 'pesos' | 'miles' | 'millones' | 'desconocida'
  moneda_detectada: string             // «MXN», «USD», "" si no se indica
  empresa_detectada: string            // razón social del encabezado o ""
  periodos: {
    etiqueta: string                   // nombre de la columna tal como aparece
    anio: number | null
    meses: number                      // 12 salvo que el documento diga que es parcial
    estado_resultados: { [clave]: number | null }   // 14 claves: INCOME_INPUT_KEYS (11) + INCOME_MEMO (3), EN MILES
    balance: { [clave]: number | null }             // 27 claves: ALL_BALANCE_KEYS, EN MILES, con su signo contable
    comprobacion: { utilidad_neta_documento: number | null; total_activo_documento: number | null; total_pasivo_capital_documento: number | null }
    notas: string[]                    // mapeos no obvios, sumas, lecturas dudosas
  }[]
  advertencias: string[]               // avisos generales (documento ilegible, moneda distinta, periodo que no coincide…)
}
```

Costos, gastos e impuestos vienen **en positivo** (la app los resta); solo `utilidad_cambiaria`, `otros_productos`, `reservas` y `resultados_acumulados` pueden ir negativos. Si el documento está en pesos la IA divide entre 1000; en millones, multiplica por 1000.

`sugerir_riesgo` (`actions/riesgo.ts`). Todos los valores salen **exactamente** del catálogo de la app (`riskCalc.js` y `perspectives.js`, con `enum` en el schema), por eso el formulario los aplica tal cual:

```ts
{
  riesgo_redactado: string             // causa → evento → consecuencia, una oración
  tipo_amenaza: 'Interna' | 'Externa'
  perspectiva_key: 'financiera' | 'cliente' | 'competitiva' | 'procesos' | 'equipo'
  probabilidad: PROBABILITY_LEVELS     // «Remoto (0-20%)» … «Frecuente (81-100%)»
  impacto: IMPACT_LEVELS               // «Insignificante», «Menor», «Crítico», «Mayor», «Catastrófico»
  justificacion: string
  estrategia: 'Aceptar' | 'Reducir' | 'Transferir'
  controles: {                         // exactamente 3 (la función recorta a 3)
    descripcion: string
    mitiga: MITIGANT_IMPACT_OPTIONS    // «Mitiga la probabilidad» | «Mitiga el impacto» | «Mitiga la probabilidad e impacto»
    tipo_control: CONTROL_TYPES        // «Control Preventivo» | «Control Correctivo» | «Control Detectivo»
    proceso: PROCESS_TYPES             // «Manual» | «Automatizado» | «Combinado»
    responsable_sugerido: string       // un puesto, no un nombre
  }[]
  residual_probabilidad: PROBABILITY_LEVELS
  residual_impacto: IMPACT_LEVELS
  nota: string                         // "" si no hay nada que aclarar
}
```

El **nivel** (inherente y residual) no lo manda la IA: lo calcula la app con probabilidad × impacto (`riskScore`, `calculateRiskLevel`), igual que cuando el usuario captura a mano.

`sugerir_iniciativa` (`actions/iniciativa.ts`):

```ts
{
  iniciativas: {                       // 2: la primera rápida y de bajo costo, la segunda más completa
    titulo: string                     // acción en infinitivo, ≤ 12 palabras
    resultado_esperado: string         // «¿cómo sabremos que fue un éxito?»
    area: string
    responsable: string                // puesto
    kpi: string                        // un indicador con meta y unidad
    plazo_semanas: number              // entero
    presupuesto_mxn: number | null     // entero redondo o null
    pasos: string[]                    // 3–6 (la función admite hasta 8), sin numerar: la app los numera
    por_que: string
  }[]
}
```

`resumen_ejecutivo` (`actions/resumen.ts`):

```ts
{
  titulo: string                       // «Resumen ejecutivo — {empresa}»
  fecha_texto: string                  // la fecha de hoy en letras (zona America/Mexico_City)
  resumen_general: string              // 4–6 oraciones
  modulos_sin_datos: ('riesgos' | 'planeacion' | 'finanzas')[]
  riesgos:    { texto: string; puntos: string[] }   // texto = «Sin información capturada» y puntos = [] cuando el módulo no trae datos
  planeacion: { texto: string; puntos: string[] }
  finanzas:   { texto: string; puntos: string[] }
  prioridades_90_dias: { titulo: string; por_que: string; responsable_sugerido: string; modulo: 'riesgos' | 'planeacion' | 'finanzas' | 'transversal' }[]  // 3–5
  cierre: string
}
```

Las cinco respuestas se piden con **structured outputs** (`output_config.format = json_schema`): cada objeto del schema lleva `additionalProperties: false` y todas sus propiedades en `required`; no se usan `minimum`, `maximum`, `minLength`, `format` ni `pattern` (restricción de la API), pero sí `enum`. `npm run ia:check` verifica estas reglas y que los enums del asistente de riesgos coincidan con los catálogos.

## Acceso por módulo

Misma regla que la app y el servidor MCP: `accessFor(supabase)` consulta `is_admin()` y `user_module_access.module_key` con el cliente del usuario; `can(access, m) = admin || modules.has(m)`. Una cuenta sin módulos (y no admin) recibe `sin_acceso` en cualquier acción salvo `estado`. Cada acción declara `requires` (`'fin-analysis'`, `'risk'`, `'strategic'` o `null`); el Resumen ejecutivo (`null`) reúne únicamente los módulos a los que el usuario tiene acceso y le dice al modelo cuáles quedaron fuera. Los administradores tienen acceso a todo, pero —como en el resto de la app— solo ven **sus propios** datos: la RLS "solo el dueño" aplica también dentro de la función.

## Topes de gasto y bitácora

Antes de cada acción (menos `estado`) la función llama a la RPC `ia_reserve(p_user, p_action, p_est, …)` con `service_role`. Bajo un candado de transacción por usuario (`pg_advisory_xact_lock`), la RPC lee `ia_usage_window(p_user)`, compara con los topes **sumando el costo estimado de la acción** (`extraer_estados` 0.30 USD, `interpretar_informe` y `resumen_ejecutivo` 0.20, el resto 0.10) y, si cabe, inserta de inmediato la fila `en_curso` en `ia_usage`. Así dos peticiones en paralelo del mismo usuario no se cuelan por debajo del tope. Los topes:

| Tope | Por omisión | Secreto para cambiarlo | Código si se alcanza (HTTP 429) | Mensaje en la app |
|---|---|---|---|---|
| Gasto del usuario en las últimas 24 h | **2 USD** | `IA_DAILY_USD` | `limite_diario` | "Alcanzaste el límite diario de uso del asistente. Podrás volver a usarlo mañana." |
| Llamadas del usuario en las últimas 24 h | **40** | `IA_DAILY_CALLS` | `limite_diario` | ídem |
| Gasto global (todos los usuarios) en los últimos 30 días | **150 USD** | `IA_MONTHLY_USD` | `limite_global` | "El asistente llegó al tope de gasto de este mes. Avisa al administrador." |

Las ventanas son **móviles** (24 h y 30 días hacia atrás desde el momento de la llamada), no días ni meses calendario. Un secreto con valor no numérico o ≤ 0 se ignora y queda el valor por omisión. Para contar, `ia_usage_window` suma y cuenta **todas** las filas de `ia_usage` del usuario: las llamadas terminadas (correctas o fallidas con costo) y las reservas `en_curso` aún abiertas (con su costo estimado). Al terminar, la función **completa** la fila reservada con los tokens y el costo reales (`settleReservation`) o la **borra** (`dropReservation`) cuando no hubo llamada: resultado guardado (`cached: true`) o error sin costo (`sin_datos`, `peticion_invalida`, `archivo_grande`). La acción `estado` nunca reserva.

**Bitácora `ia_usage`** (una fila por llamada a Claude): `user_id`, `action`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd` (NUMERIC(10,6)), `duration_ms`, `ok`, `error_code`, `created_at`. Queda registrada toda llamada que llegó a Claude (correcta, o fallida con costo: `rechazado`, `incompleto`) y también las fallas con otros códigos (`proveedor`, `saturado`, `desconocido`…, con costo 0); **no** quedan `sin_datos`, `peticion_invalida` ni `archivo_grande` cuando no hubo llamada (son errores del usuario, no gasto: la reserva se borra). Escribe solo la función (`service_role`); cada usuario lee lo suyo y los administradores (`public.is_admin()`) leen todo.

**RPC:** `ia_reserve(uuid, text, numeric, numeric, int, numeric)` → `{ id, motivo }` (reserva atómica; `motivo` = `limite_diario` / `limite_global` cuando no cabe) y `ia_usage_window(uuid)` → `{ user_24h_usd, user_24h_calls, global_30d_usd }` (ambas SECURITY DEFINER; `EXECUTE` solo para `service_role`). `ia_usage_by_user()` → una fila por usuario con `email` y `full_name` (de `auth.users`, que la app no puede leer directamente), `calls`, `calls_30d`, `cost_usd`, `cost_30d_usd`, `last_call`; la pueden llamar los `authenticated`, pero su `WHERE public.is_admin()` devuelve vacío a quien no es administrador. Ver [03 - Base de Datos](./03-BASE-DE-DATOS.md).

## Resultados guardados y caché por huella de datos

La interpretación del Informe y el Resumen ejecutivo son caros y cambian solo cuando cambian los datos, así que se guardan en `ia_resultados` (`UNIQUE (user_id, kind)`; `kind` = `'informe'` | `'resumen_ejecutivo'`) junto con la **huella** de los datos con que se generaron:

1. La acción arma el **input** del modelo (`finSummary` para el informe; `{ empresa, riesgos, plan, finanzas, modulos }` para el resumen; la fecha de hoy va fuera del input para no romper la huella) y calcula `hashOf(input)` = SHA-256 del JSON canónico (claves ordenadas), en `store.ts`.
2. Si no viene `force: true`, busca el guardado (`getSaved`, con `service_role`): si `input_hash` coincide devuelve `{ result, usage: null, cached: true, generated_at: created_at }` **sin llamar a la IA**.
3. Si no coincide (o `force`), llama a Claude y hace `upsert` del resultado con `input_hash`, `model`, `cost_usd` y `created_at` (`saveResult`); la respuesta lleva `cached: false`.

En la app, `iaSavedResult(kind)` lee el guardado del usuario al abrir la pantalla (RLS: solo el propio) sin tocar la función; «Volver a generar» manda `force: true`. Solo se conserva **la última versión** por usuario y tipo: regenerar la reemplaza. Los demás resultados (PDF, riesgo, iniciativa) no se guardan; viven en el estado de la pantalla hasta que el usuario los aplica o los descarta.

## Modelo, prompts y precios

- **Modelo:** `claude-opus-5-5` (`DEFAULT_MODEL`; el secreto `IA_MODEL` lo cambia sin redesplegar). `claude.ts` conoce los precios de `claude-opus-5-5`, `claude-sonnet-5-5` y `claude-haiku-5-5`; un modelo fuera de esa tabla se cobra como Opus 5.5 para la bitácora.
- **Razonamiento:** se manda `thinking: { type: 'adaptive' }`. En Opus 5.5 el razonamiento siempre está activo y la profundidad la decide `output_config.effort` (`medium` por omisión; `askJson` acepta `effort` pero ninguna acción lo fija). Los tokens de razonamiento **se cobran como salida** y cuentan para `max_tokens`.
- **Salida estructurada:** `output_config.format = { type: 'json_schema', schema }`; la respuesta se parsea tal cual. `stop_reason = 'refusal'` → `rechazado`; `max_tokens` o sin texto → `incompleto` (ambos con su `usage`, que se registra).
- **Caché de prompts:** el `system` de cada acción es texto estable (rol, reglas, catálogos: `ratioCatalogText()`, cuentas de captura, catálogo de riesgos, perspectivas) y va con `cache_control: { type: 'ephemeral' }`; los datos del usuario van en el mensaje. La primera llamada escribe el caché (1.25 × el precio de entrada) y las siguientes dentro de ~5 minutos lo leen a 5 % del precio; después vuelve a escribirse. Con uso esporádico casi todas las llamadas pagan la escritura, así que la estimación de abajo no cuenta con el caché.
- **Reintentos:** el SDK reintenta 2 veces (`maxRetries: 2`) ante 429 / 5xx / red.

**Precios públicos** (USD por millón de tokens, tabla `PRICES` de `claude.ts`):

| Modelo | Entrada | Salida | Escritura de caché | Lectura de caché |
|---|---|---|---|---|
| `claude-opus-5-5` (por omisión) | **4.00** | **20.00** | 5.00 | **0.20** |
| `claude-sonnet-5-5` | 2.00 | 10.00 | 2.50 | 0.10 |
| `claude-haiku-5-5` | 0.10 | 0.50 | 0.125 | 0.01 |

`cost_usd = (input × 4 + output × 20 + cache_write × 5 + cache_read × 0.20) / 1 000 000`, redondeado a 6 decimales (`costFor`). Es lo que se guarda en `ia_usage.cost_usd` y lo que muestra la app como "costo aprox."; la factura real es la de la consola de Anthropic.

### Estimación por acción (Opus 5.5, sin contar el caché)

Cifras **aproximadas**, deducidas del tamaño de los prompts del código y de los `maxTokens`; los valores reales quedan en `ia_usage`. La salida incluye el razonamiento adaptativo, que varía con la dificultad.

| Acción | `system` (estable) | Datos del usuario | Salida típica (JSON + razonamiento) | Costo típico | Techo de salida (`maxTokens` × 20 $/M) |
|---|---|---|---|---|---|
| `interpretar_informe` | ≈ 4 000 tokens (reglas + catálogo de 41 razones) | ≈ 2 000–2 500 por periodo (3 periodos ≈ 7 000) | ≈ 3 000–5 000 | **≈ 0.10–0.15 USD** | 16 000 → 0.32 USD |
| `resumen_ejecutivo` | ≈ 4 000 | ≈ 15 000–20 000 (40 riesgos + plan + 3 periodos financieros) | ≈ 4 000–6 000 | **≈ 0.15–0.25 USD** | 16 000 → 0.32 USD |
| `extraer_estados` | ≈ 2 800 (catálogo de cuentas) | PDF ≈ 1 500–3 000 por página; foto ≈ 1 500 por imagen (2–4 páginas ≈ 4 000–10 000) | ≈ 3 000–5 000 (≈ 700 por periodo del documento + razonamiento) | **≈ 0.08–0.15 USD** | 16 000 → 0.32 USD |
| `sugerir_riesgo` | ≈ 1 900 (matriz + catálogo + perspectivas) | ≈ 1 500–2 500 (empresa + 15 riesgos) | ≈ 2 000–3 500 | **≈ 0.05–0.08 USD** | 16 000 → 0.32 USD |
| `sugerir_iniciativa` | ≈ 1 300 | ≈ 1 000–2 000 (empresa + plan acotado + objetivo) | ≈ 2 000–3 500 | **≈ 0.05–0.08 USD** | 16 000 → 0.32 USD |

Con los topes por omisión, un usuario dispone de unas 15–30 llamadas al día (2 USD) sin pasar de 40, y el tope global de 150 USD en 30 días equivale a unas 1 000–2 000 llamadas. Un informe o un resumen que no cambió de datos no cuesta nada (resultado guardado).

## Códigos de error y mensajes

`IaError(code, message, status)` en la función; en la app `IA_ERROR_MESSAGES[code]` (`src/api/ia.js`) sustituye el mensaje técnico. Los componentes muestran `no_configurado` en ámbar (informativo) y el resto en rojo.

| Código | HTTP | Cuándo | Mensaje que ve el usuario |
|---|---|---|---|
| `no_configurado` | 503 | Falta el secreto `ANTHROPIC_API_KEY`, o la API rechazó la llave (`AuthenticationError`) | El asistente de IA aún no está configurado en el servidor. Pide al administrador que registre la llave de la API. |
| `sin_sesion` | 401 | Sin bearer válido (o `callIa` sin sesión local) | Tu sesión expiró. Vuelve a iniciar sesión para usar el asistente. |
| `sin_acceso` | 403 | Cuenta sin módulos, o sin el módulo que exige la acción | No tienes acceso al módulo que necesita esta función. |
| `sin_datos` | 409 | Informe sin Estado de Resultados; resumen sin ningún módulo con datos | Aún no hay información suficiente para generar esto. Captura tus datos primero. |
| `limite_diario` | 429 | Gasto o llamadas del usuario en 24 h ≥ tope | Alcanzaste el límite diario de uso del asistente. Podrás volver a usarlo mañana. |
| `limite_global` | 429 | Gasto global en 30 días ≥ tope | El asistente llegó al tope de gasto de este mes. Avisa al administrador. |
| `peticion_invalida` | 400 (405) | No es POST, no es JSON, acción desconocida, body inválido (descripción corta, archivo de formato no admitido, sin ejercicios…), o la API rechazó la petición (`BadRequestError`) | La petición no es válida. Recarga la página e inténtalo de nuevo. |
| `archivo_grande` | 413 | Cuerpo > 12 MB, archivos > 8 MB en total o una imagen > 5 MB | Los archivos pesan demasiado. Sube archivos de hasta 8 MB en total. |
| `rechazado` | 422 | `stop_reason = 'refusal'` del modelo | El asistente no pudo procesar esta petición. Revisa el contenido e inténtalo de nuevo. |
| `incompleto` | 502 | Se agotó `max_tokens`, la respuesta no fue JSON o no trajo iniciativas | La respuesta quedó incompleta. Inténtalo de nuevo. |
| `proveedor` | 502 / 500 | Otro error de la API de Claude, fallo de red, o no se pudo reservar la llamada (`ia_reserve`) | El servicio de IA no respondió. Inténtalo en unos minutos. |
| `saturado` | 429 / 503 | `RateLimitError` (429) o sobrecarga (529) de la API de Claude | El servicio de IA está saturado en este momento. Inténtalo en unos minutos. |
| `desconocido` | 500 | Cualquier otra excepción | No pudimos completar la petición. Inténtalo de nuevo. |

Si la respuesta de error llega sin `code` (por ejemplo, un 401 del gateway), `toIaError` deduce el código por el HTTP: 401 → `sin_sesion`, 429 → `saturado`, 413 → `archivo_grande`, otro → `desconocido`.

## Configuración (una sola vez)

1. **Crear la llave de la API** en [console.anthropic.com](https://console.anthropic.com) → *API Keys*, en la organización de la consultoría (conviene crear un *workspace* propio para la app y fijarle ahí un límite de gasto mensual: es la segunda barrera después de los topes de la función). Copia la llave: solo se muestra una vez.
2. **Enlazar la CLI** (si no está hecho): `npx supabase login` y `npx supabase link --project-ref hcmeoducjqudokfhhvyc`.
3. **Registrar los secretos** de la función (también se puede en el panel: Supabase → Edge Functions → Secrets):

   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-… --project-ref hcmeoducjqudokfhhvyc

   La llave debe crearse **dentro de un workspace** (al crearla, el selector "Workspace" → por ejemplo *Default*). Una llave creada a nivel organización ("not scoped to a workspace") hace que la API responda 400 pidiendo el encabezado `anthropic-workspace-id`; en ese caso, o se crea otra llave dentro de un workspace, o se registra además el secreto `ANTHROPIC_WORKSPACE_ID` con el ID del workspace (Settings → Workspaces, formato `wrkspc_…`). La app muestra ese caso en ámbar con el texto exacto.
   # opcionales (con sus valores por omisión):
   npx supabase secrets set IA_MODEL=claude-opus-5-5 IA_DAILY_USD=2 IA_DAILY_CALLS=40 IA_MONTHLY_USD=150 --project-ref hcmeoducjqudokfhhvyc
   ```

   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase; para el cliente del usuario la función usa `PUBLISHABLE_KEY` (el secreto que ya tiene el servidor MCP) o, si no existe, `SUPABASE_ANON_KEY`.
4. **Crear las tablas**: ejecutar `supabase-ia.sql` una vez en Supabase → SQL Editor (idempotente). Requiere `public.is_admin()` de `supabase-fix-role-security.sql`.
5. **Desplegar la función** desde la laptop:

   ```bash
   npm run mcp:sync                                  # copia src/config → supabase/functions/_shared/app (la función importa de ahí)
   npm run ia:check                                  # deno check + verificación de los schemas y enums
   npx supabase functions deploy ia --no-verify-jwt  # la función verifica el JWT por sí misma (config.toml: verify_jwt = false)
   npx supabase functions list                       # debe aparecer "ia"
   ```

   `--no-verify-jwt` es necesario porque la función debe responder el preflight CORS (sin token) y porque, como el servidor MCP, verifica el token contra Auth (`auth.getUser`) en vez de con el JWKS del gateway (ver la nota técnica sobre llaves HS256 en [MCP.md](./MCP.md)). Cada Edge Function se empaqueta por separado: desplegar `ia` **no** redespliega `mcp`. **Pendiente (9-nov-2026):** redesplegar `ia` tras el cambio FODA v2 (`context.ts` y las copias de `_shared/app/` cambiaron); mientras tanto el resumen ejecutivo se genera con el plan anterior, sin error.
6. **Comprobar** en la app: Administración → Uso de IA debe mostrar el chip verde «Configurado», el modelo y los topes.

> Cada vez que cambie algo en `src/config/finConfig.js`, `finCalc.js`, `riskCalc.js`, `perspectives.js`, `strategicCalc.js` o `strategicCatalog.js`, hay que volver a correr `npm run mcp:sync` y desplegar **las dos** funciones (`ia` y `mcp`). No corras `supabase config push`: el `config.toml` del repo es mínimo.

## Probar sin gastar

- **Schemas y tipos:** `npm run ia:check` corre `deno check` sobre `index.ts` y `scripts/check-ia-schemas.ts` (reglas de structured outputs y enums contra `riskCalc.js` / `perspectives.js`); imprime `TODO OK`. Para solo tipos: `cd supabase/functions/ia && npx -y deno@2 check --node-modules-dir=none index.ts`.
- **La función responde** (sin llamar a Claude, no cuesta): la acción `estado` con el `access_token` de un usuario:

  ```bash
  curl -s -X POST https://hcmeoducjqudokfhhvyc.supabase.co/functions/v1/ia \
    -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
    -d '{"action":"estado"}'
  ```

  Sin token responde `401 { ok:false, error:{ code:'sin_sesion' } }`. El token se obtiene de la sesión del navegador (`supabase.auth.getSession()`) o creando un usuario de prueba como en MCP.md.
- **Sin llave:** con la función desplegada y sin `ANTHROPIC_API_KEY`, `estado` devuelve `configurado: false` y cualquier acción responde `no_configurado` (503): sirve para ver el aviso ámbar de cada pantalla y el panel sin gastar.
- **Interfaz con respuestas simuladas** (así se hizo la QA de este lote, que no tenía llave): interceptar la petición `POST …/functions/v1/ia` en el navegador (DevTools → Network → *Override content* / *Local overrides*, o un proxy local) y devolver `{ "ok": true, "result": <result exacto del contrato de arriba>, "usage": { "input_tokens": 1000, "output_tokens": 500, "cost_usd": 0.014, "model": "claude-opus-5-5" }, "cached": false, "generated_at": "<ISO>" }`, o un `{ "ok": false, "error": { "code": "limite_diario", "message": "…" } }` con el HTTP correspondiente para ver los mensajes de error. La UI debe funcionar con el `result` **exacto** de cada contrato; las claves faltantes se tratan como vacías, no rompen la pantalla.
- **Topes:** en staging se pueden fijar `IA_DAILY_USD=0.05` o `IA_DAILY_CALLS=2` para ver `limite_diario` sin gastar casi nada; recuerda restaurarlos.
- **Primera prueba real:** con la llave puesta, una llamada por acción y revisar la fila en `ia_usage` (tokens, costo, duración) desde el panel «Uso de IA».

## Panel "Uso de IA" (administración)

`src/pages/IaUsageAdmin.jsx`, página `IaUsage` del módulo admin (`src/config/modules.js`, i18n `navIaUsage`), ruta `/IaUsage`. Carga en paralelo e independiente (`Promise.allSettled`) `iaStatus()`, `IaUsage.byUser()` e `IaUsage.recent(50)`, así que si la función no responde las tablas se muestran igual (y al revés).

1. **Estado del asistente:** chip «Configurado» (verde) o «Sin llave de API» (ámbar, con la instrucción de registrar `ANTHROPIC_API_KEY` en Supabase → Edge Functions → Secrets); versión de la función; modelo; tope diario por usuario (USD y llamadas) y tope mensual global; barra «Uso global en los últimos 30 días» contra el tope (ámbar desde 70 %, rojo desde 90 %); las últimas 24 h del propio administrador. Si la función no contesta: chip rojo «Sin respuesta» y el mensaje del error.
2. **Cifras** (calculadas de `ia_usage_by_user`): gasto total, gasto 30 días, llamadas 30 días (y usuarios con uso), costo promedio por llamada.
3. **Gasto por usuario:** nombre, correo, llamadas, llamadas 30 d, gasto, gasto 30 d, última vez. Vacío para quien no es administrador ("El resumen por usuario solo lo ven los administradores").
4. **Últimas llamadas** (máximo 50; RLS: el admin ve todas): fecha, usuario, acción con etiqueta en español (`interpretar_informe` → "Interpretación del informe", `extraer_estados` → "Lectura de PDF", `sugerir_riesgo` → "Sugerencia de riesgo", `sugerir_iniciativa` → "Iniciativa sugerida", `resumen_ejecutivo` → "Resumen ejecutivo"), tokens entrada / salida (el `title` muestra los de caché), costo (`fmtUsd`), duración en segundos y estado OK / `error_code`.

Buscador por correo o nombre (filtra ambas tablas) y botón «Actualizar». Si fallan las consultas: "No pudimos cargar el uso. ¿Ya se ejecutó supabase-ia.sql?".

## Seguridad

- El navegador nunca recibe la llave de Anthropic ni habla con su API: todo pasa por la Edge Function `ia`, que la lee del secreto `ANTHROPIC_API_KEY`.
- La función verifica el bearer token contra Supabase Auth (`auth.getUser`), exige `role = 'authenticated'` y crea el cliente de datos **con ese token**: todas las lecturas de contexto pasan por la RLS "solo el dueño" ([04 - Autenticación y Seguridad](./04-AUTENTICACION-Y-SEGURIDAD.md)).
- El cliente `service_role` se usa únicamente para las RPC `ia_reserve` / `ia_usage_window`, para completar o borrar la fila reservada en `ia_usage` y para la lectura / escritura de `ia_resultados` del usuario que llama; nunca para leer datos de negocio.
- Los mensajes de error internos (Postgres, SDK de Anthropic) no salen al cliente: se registran en el log de la función y la app recibe textos fijos por código. En la app, `toIaError` conserva el mensaje del servidor solo para los códigos de cara al usuario (`sin_datos`, `archivo_grande`, `peticion_invalida`, `sin_acceso`, `limite_diario`, `limite_global`).
- Cada `system` prompt indica que el contenido de los archivos y del JSON son **datos**, no instrucciones (un PDF con texto oculto no puede redirigir al modelo; en la lectura de PDF se reporta en `advertencias`).
- Las tablas de IA no tienen políticas de escritura para `authenticated`: desde la app solo se leen (lo propio; el admin lee toda la bitácora).
- La sesión se verifica antes de leer el cuerpo; el cuerpo se limita a 12 MB (medidos sobre el texto recibido) y cada acción valida y recorta su entrada antes de armar el prompt (la lectura de PDF además rechaza más de 60 000 tokens de entrada); los archivos subidos viajan a la API de Claude dentro de la petición y la función **no los guarda**.
- El modelo solo puede devolver la forma del schema (structured outputs) y, en el asistente de riesgos, solo valores del catálogo; la app vuelve a calcular niveles y grados de control con su propia lógica.

## Limitaciones conocidas

- **Lectura de PDF / foto:** hasta 4 archivos y 8 MB en total; cada imagen hasta 5 MB (tope de la API por imagen). La IA puede leer mal una cifra, confundir una columna o mapear una cuenta a otra parecida: **el usuario siempre revisa** la tabla y la comprobación (utilidad neta y totales del documento contra lo calculado) antes de guardar. La utilidad neta y los subtotales nunca se importan. Un escaneo borroso o un documento que no es un estado financiero devuelve `periodos: []` con la explicación en `advertencias`.
- **Umbrales del semáforo:** son de referencia general para PyMEs mexicanas ([02 - Reglas de Negocio §7](./02-REGLAS-DE-NEGOCIO.md)); la IA tiene instrucción de no recalcularlos ni contradecirlos, solo matizarlos. Nada de lo que genera es un dictamen financiero, fiscal ni legal.
- **Tiempo de respuesta:** las llamadas no usan streaming; un informe o un resumen puede tardar alrededor de un minuto ("puede tardar un minuto" en pantalla). La función corre dentro del límite de tiempo de las Edge Functions de Supabase.
- **Contexto acotado:** el resumen manda hasta 40 riesgos (los más críticos; `recortado: true` avisa al modelo) y el asistente de riesgos hasta 15; el plan acotado lleva 10 fortalezas y 10 debilidades. Desde el 9-nov-2026 `planContext` lee las secciones del plan con `PLAN_SOURCE_SECTIONS` (incluye `financial-situations` y `external-diagnosis`): las fortalezas llegan con la redacción FODA v2 y las debilidades incluyen las estrategias del diagnóstico externo con `fuente: 'Diagnóstico externo'`.
- **Una versión guardada** por usuario y tipo (informe, resumen): regenerar reemplaza la anterior; no hay historial. Al abrir se muestra con la nota "Es tu última explicación / tu último resumen guardado…"; la huella de los datos solo se compara al pulsar el botón.
- **Idioma:** la IA siempre responde en español de México; los textos de los módulos financiero, estratégico y del Resumen están solo en español (como esos módulos). Solo el asistente de riesgos está en es / en (incluida su nota «Generado con IA…», clave `iaDisclaimerShort`).
- **Costo del razonamiento:** el razonamiento adaptativo se cobra como salida y no es visible; el costo real por llamada varía con la dificultad de los datos.
- **Datos hacia Anthropic:** el contexto (cifras, riesgos, plan) y los archivos viajan a la API de Claude en cada llamada; aplican las condiciones de uso de la API de Anthropic.

## Pendientes / siguientes versiones

- QA con la llave real: una llamada por acción y ajuste de prompts con documentos y matrices reales de clientes (hasta ahora solo con respuestas simuladas).
- Mostrar avance (streaming o estados intermedios) en las acciones largas; hoy solo "Pensando…".
- Traducir al inglés los textos del Resumen ejecutivo y del panel cuando esos módulos se internacionalicen.
- Historial de versiones del informe y del resumen (hoy solo la última), y borrar el guardado desde la app.
- Aviso al administrador cuando el uso global pase del 70–90 % del tope; tope por acción (la lectura de PDF es la que más varía).
- Decidir, con casos reales, si `sugerir_riesgo` y `sugerir_iniciativa` pueden correr con `effort: 'low'` (recorta 30–50 % del costo, que en esas acciones es sobre todo razonamiento).
- Herramientas de escritura con confirmación en el servidor MCP (otra pieza; ver [MCP.md](./MCP.md)).
