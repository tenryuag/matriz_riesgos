# 🔌 API y Entidades

## Arquitectura de la Capa de Datos

La capa de acceso a datos se organiza en tres archivos:

| Archivo                     | Propósito                                                |
| --------------------------- | -------------------------------------------------------- |
| `src/api/supabaseClient.js` | Inicialización del cliente Supabase                      |
| `src/api/entities.js`       | Modelos de datos: Department, Risk, User, InvitationCode |
| `src/api/integrations.js`   | Integraciones externas (LLM, Email, etc.)                |

```mermaid
graph TD
    subgraph "Componentes React"
        Pages["Páginas"]
    end

    subgraph "Capa API"
        E["entities.js<br/>Department, Risk, User, InvitationCode"]
        I["integrations.js<br/>Core, InvokeLLM, SendEmail..."]
    end

    subgraph "Supabase"
        SC["supabaseClient.js"]
        DB["PostgreSQL"]
        Auth["Supabase Auth"]
        RPC["Funciones RPC"]
    end

    Pages --> E
    Pages --> I
    E --> SC
    I --> SC
    SC --> DB
    SC --> Auth
    SC --> RPC
```

---

## Cliente Supabase

### `src/api/supabaseClient.js`

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Entidades

### `Department`

Gestión de departamentos organizacionales.

| Método   | Firma                     | Descripción                                                    |
| -------- | ------------------------- | -------------------------------------------------------------- |
| `list`   | `list(order?)`            | Lista departamentos, ordenados por `order` o `created_at` desc |
| `filter` | `filter(filters, order?)` | Filtra departamentos por objeto de condiciones                 |
| `get`    | `get(id)`                 | Obtiene un departamento por ID                                 |
| `create` | `create(data)`            | Crea un nuevo departamento                                     |
| `update` | `update(id, data)`        | Actualiza un departamento existente                            |
| `delete` | `delete(id)`              | Elimina un departamento por ID                                 |

**Ejemplo de uso:**

```javascript
import { Department } from "@/api/entities";

// Listar todos
const departments = await Department.list("-created_date");

// Filtrar
const filtered = await Department.filter({ id: "uuid-123" });

// Crear
await Department.create({ name: "Finanzas", description: "..." });

// Actualizar
await Department.update("uuid-123", { name: "Finanzas Actualizadas" });

// Eliminar
await Department.delete("uuid-123");
```

### `Risk`

Gestión de riesgos por departamento.

| Método   | Firma                     | Descripción                    |
| -------- | ------------------------- | ------------------------------ |
| `list`   | `list(order?)`            | Lista todos los riesgos        |
| `filter` | `filter(filters, order?)` | Filtra riesgos por condiciones |
| `get`    | `get(id)`                 | Obtiene un riesgo por ID       |
| `create` | `create(data)`            | Crea un nuevo riesgo           |
| `update` | `update(id, data)`        | Actualiza un riesgo existente  |
| `delete` | `delete(id)`              | Elimina un riesgo por ID       |

**Campos del objeto Risk:**

```javascript
{
    department_id: 'uuid',
    threat_type: 'Interna' | 'Externa',
    description: 'Descripción del riesgo',
    inherent_probability: 'Remoto (0-20%)' | ... ,
    inherent_impact: 'Insignificante' | ... ,
    inherent_level: 'Tolerable' | 'Bajo' | 'Medio' | 'Alto' | 'Intolerable',
    risk_strategy: 'Aceptar' | 'Reducir' | 'Transferir',
    mitigant_1: 'Descripción mitigante',
    mitigant_impact_1: 'Mitiga la probabilidad' | ... ,
    mitigant_2: '...',
    mitigant_impact_2: '...',
    mitigant_3: '...',
    mitigant_impact_3: '...',
    residual_probability: '...',
    residual_impact: '...',
    residual_level: '...',
    created_by_id: 'uuid'
}
```

### Riesgos críticos en la planeación (Fase 2)

La integración riesgos → plan no agrega entidades: usa estos métodos existentes de `entities.js` y la carga unificada de `src/api/strategyInputs.js`.

| Método                       | Firma                                            | Descripción                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Risk.listCritical`          | `listCritical({ perspective? })`                 | Riesgos del usuario con `inherent_score >= 13`, ordenados por gravedad. **Ninguna página lo llama directamente**: solo `loadStrategyInputs`, y solo si `includeRisks` es `true` (usuario con el módulo `risk`). Ante error de permisos o columnas faltantes devuelve `[]` y avisa en consola. |
| `loadStrategyInputs`         | `loadStrategyInputs({ includeRisks, extraSections })` | Devuelve `{ plan, sections, ratings, competitors, initiatives, risks, decisions }`; `decisions = { controls, objectives }` son las secciones `risk-controls` y `risk-objectives` de `plan_answers`. Las páginas la consumen a través del hook `useStrategyInputs`.                                   |
| `Initiative.list`            | `list(planId)`                                   | Filas completas, con `source_key` y `strategy_label` (`NULL` en las manuales). El estado de la pantalla de iniciativas nace **siempre** de aquí.                                                                                                                                                       |
| `Initiative.createFromSource` | `createFromSource(planId, rows)`                | **Única vía** por la que una iniciativa nace con `source_key`. Hace `upsert` con `onConflict: "plan_id,source_key"` e `ignoreDuplicates: true`: repetir el clic no duplica ni pisa ediciones. Exige `source_key` y `strategy_id` en cada fila.                                                        |
| `Initiative.upsertMany`      | `upsertMany(planId, rows)`                       | Autosave. Manda `source_key`/`strategy_label` solo si la fila trae la propiedad (supabase-js arma las columnas con la unión de claves de todas las filas: una fila sin la propiedad se guarda con `NULL`). Por eso las filas del estado deben venir de `list()`.                                   |
| `Initiative.remove`          | `remove(id)`                                     | Borrar una iniciativa de riesgo libera su `source_key`: el control vuelve a poder convertirse (nueva fila, nuevo id).                                                                                                                                                                                 |
| `PlanAnswer.set` / `remove` / `getSection` | `set(planId, section, key, value)` · `remove(planId, section, key)` · `getSection(planId, section)` | Confirmación "Lo tengo controlado" de un riesgo aceptado (sección `risk-objectives`).                                                                                                                                                                                              |

#### Contrato de las iniciativas de riesgo (`strategic_initiatives`)

| Campo             | Valor                                                                                            | Nota                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strategy_id`     | `'risk:<risk.id>'`                                                                               | Igual que el id del objetivo de riesgo; `riskInitiativesOf` agrupa por él.                                                                                                                       |
| `source_key`      | `'risk:<risk.id>:m<n>'` (control n = 1..3) · `'risk:<risk.id>:tpl:<clave>'` (plantilla)         | Solo nace en `createFromSource`. Índice único `(plan_id, source_key)`. Las iniciativas manuales llevan `NULL`.                                                                                     |
| `strategy_label`  | Descripción del riesgo                                                                           | Sobrevive si el riesgo deja de ser crítico o se borra: título del grupo en "Otras iniciativas", en el Excel y en el Score Card. Las manuales creadas bajo un objetivo de riesgo también lo llevan. |
| `title`           | Texto del control o de la plantilla                                                              | Editable.                                                                                                                                                                                          |
| `expected_result` | Plantilla → su texto; control → "Bajar el riesgo a nivel Medio o menor" (o el de Aceptar)        | Editable.                                                                                                                                                                                          |
| `area`            | Nombre de la perspectiva (`'Finanzas'`, `'Clientes'`, …) o `NULL`                                | Editable.                                                                                                                                                                                          |
| `owner`           | `NULL`                                                                                           | La matriz no guarda el nombre del responsable (solo Sí/No); el usuario lo escribe y mientras tanto sale el aviso `no-owner`.                                                                       |
| `start_date`      | Hoy (`localISODate()`, hora local)                                                               |                                                                                                                                                                                                    |
| `end_date`        | Hoy + 30 (Intolerable) · hoy + 60 (Alto)                                                         | Sugerencia; si el usuario la aleja más de 60 / 120 días sale el aviso `far`.                                                                                                                      |
| `budget`, `kpi`, `steps` | `NULL` (`kpi`: el de la plantilla si viene de plantilla)                                  |                                                                                                                                                                                                    |
| `position`        | `initiatives.length` al crear                                                                    | `upsertMany` lo reescribe con el índice en cada autosave.                                                                                                                                         |

#### `plan_answers` sección `risk-objectives` (`RISK_OBJECTIVES_SECTION`)

| `question_key`           | `answer`                           | Significado                                                                                                                                   | Escribe                                                                 | Borra                                                       |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `<risk.id>` (uuid tal cual) | `'acknowledged'` (`RISK_ACKNOWLEDGED`) | El usuario confirmó "Lo tengo controlado" para un riesgo crítico **Aceptar**. Sale de las alertas, no del plan.                             | `PlanAnswer.set(planId, RISK_OBJECTIVES_SECTION, riskId, RISK_ACKNOWLEDGED)` | `PlanAnswer.remove(planId, RISK_OBJECTIVES_SECTION, riskId)` |

Cualquier otro valor se trata como no confirmado. Si el riesgo cambia a Reducir/Transferir la fila queda sin efecto (no se borra; `accepted` manda). Si deja de ser crítico, queda huérfana sin efecto.

#### `plan_answers` sección `risk-controls` (`RISK_CONTROLS_SECTION`)

**Reservada: no se usa en la Fase 2.** La fuente de verdad de "este control ya es iniciativa" es `strategic_initiatives.source_key`. No escribir nada en esa sección.

#### Patrón "anexar, no reemplazar" tras `createFromSource`

`useAutosave.flush()` retorna de inmediato si hay un guardado en vuelo (no lo espera), así que reemplazar el estado con el resultado de `list()` pisaría lo que el usuario está tecleando. Al convertir un control o plantilla:

```javascript
await flush();                                              // mejor esfuerzo
await Initiative.createFromSource(planId, [row]);           // idempotente por (plan_id, source_key)
const created = (await Initiative.list(planId)).find((r) => r.source_key === key);
setInitiatives((prev) =>
  prev.some((p) => p.id === created.id) ? prev : [...prev, toFormRow(created)]   // anexar, nunca reemplazar
);
```

Nunca `setInitiatives(rows)` ni `rebase` del autosave. El autosave detecta la fila nueva y hace su `upsertMany` normal, que conserva `source_key`/`strategy_label` porque la fila viene de `list()`.

### `User`

Interacción con el usuario autenticado.

| Método       | Firma                | Descripción                                                                                 |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------- |
| `me`         | `me()`               | Retorna el usuario autenticado actual                                                       |
| `list`       | `list()`             | Lista todos los usuarios (solo admin). Ver [09 - Suspensión](./09-SUSPENSION-DE-CUENTAS.md) |
| `suspend`    | `suspend(userId)`    | Suspende una cuenta (solo admin). Ver [09 - Suspensión](./09-SUSPENSION-DE-CUENTAS.md)      |
| `reactivate` | `reactivate(userId)` | Reactiva una cuenta (solo admin). Ver [09 - Suspensión](./09-SUSPENSION-DE-CUENTAS.md)      |

**Retorno de `User.me()`:**

```javascript
{
    id: 'uuid',
    email: 'user@example.com',
    user_metadata: {
        full_name: 'Nombre',
        role: 'admin' | 'user'
    },
    raw_user_meta_data: {
        full_name: 'Nombre',
        role: 'admin' | 'user'
    }
}
```

### `InvitationCode`

Gestión de códigos de invitación (requiere rol admin para la mayoría de operaciones).

| Método     | Firma                    | Descripción                                       |
| ---------- | ------------------------ | ------------------------------------------------- |
| `list`     | `list(order?)`           | Lista todos los códigos                           |
| `get`      | `get(id)`                | Obtiene un código por ID                          |
| `create`   | `create(data)`           | Crea un nuevo código de invitación                |
| `delete`   | `delete(id)`             | Elimina un código                                 |
| `stats`    | `stats()`                | Retorna estadísticas (total, usados, disponibles) |
| `validate` | `validate(code, email)`  | Valida un código via RPC                          |
| `markUsed` | `markUsed(code, userId)` | Marca un código como usado via RPC                |

**Estadísticas (`InvitationCode.stats()`):**

```javascript
{
    total: 15,      // Total de códigos generados
    used: 8,        // Códigos ya utilizados
    available: 7    // Códigos disponibles
}
```

### `FinAnalysis`, `FinYear`, `FinLine`, `FinValue`

Entidades del módulo **Análisis Financiero** (`fin-analysis`, modelo MP-AFH1). Cada usuario tiene un solo análisis (`fin_analyses`, con `owner_id` y RLS "solo el dueño"); de él cuelgan los periodos (`fin_years`), los segmentos de negocio (`fin_lines`) y todas las cifras capturadas (`fin_values`, en **miles**). Las pantallas del módulo y el servidor MCP leen con estos métodos y calculan con los módulos puros de `src/config/finCalc.js`; nada calculado se guarda.

| Método | Firma | Descripción |
| --- | --- | --- |
| `FinAnalysis.getOrCreate` | `getOrCreate()` | Devuelve el análisis del usuario actual (`owner_id = auth.uid()`, el más antiguo); si no existe lo crea. Sin sesión fuerza el logout. **Punto de entrada de todas las pantallas del módulo.** |
| `FinAnalysis.update` | `update(analysisId, fields)` | Actualiza los datos generales (`company_name`, `country`, `main_activity`, `secondary_activities`, `currency`) y `updated_at`. |
| `FinYear.list` | `list(analysisId)` | Periodos ordenados por `year` asc: `{ id, year, months }` (`months` 1–12; `< 12` = periodo parcial). El "periodo anterior" de cada uno es el que lo precede en este orden. |
| `FinYear.add` | `add(analysisId, year, months = 12)` | Crea un periodo (único por `(analysis_id, year)`). |
| `FinYear.update` | `update(id, fields)` | Cambia `year` o `months`. |
| `FinYear.remove` | `remove(id)` | Borra el periodo; sus cifras caen en cascada (FK en `fin_values`). |
| `FinLine.list` | `list(analysisId)` | Segmentos de negocio ordenados por `position`, `created_at`: `{ id, name, position }`. |
| `FinLine.create` | `create(analysisId, name, position = 0)` | Nuevo segmento. |
| `FinLine.rename` | `rename(id, name)` | Cambia el nombre. |
| `FinLine.remove` | `remove(analysisId, id)` | Borra el segmento y sus cifras: una sola `delete` sobre `fin_values` con `section IN ('sales', 'segcost')` y `concept_key = id`, y luego la fila de `fin_lines`. |
| `FinValue.getSections` | `getSections(analysisId, sections)` | Cifras de varias secciones en una sola consulta, con la forma `{ [section]: { [conceptKey]: { [yearId]: amount } } }`. Con `sections` vacío devuelve `{}`. |
| `FinValue.saveRows` | `saveRows(analysisId, rows)` | `upsert` de `[{ year_id, section, concept_key, amount }]` con `onConflict: "analysis_id,year_id,section,concept_key"`; `amount` vacío → `null`. Lo llama `useAutosave` en las pantallas de captura. |

**Secciones (`fin_values.section`)** — las constantes viven en `src/config/finConfig.js`. En `income` y `cashflow` las cifras se capturan en positivo salvo las marcadas `signed` (utilidad +, pérdida o gasto −); en `balance` cada cuenta lleva su signo contable (`reservas` y `resultados_acumulados`, marcadas `signed`, van en negativo con déficit o pérdidas acumuladas):

| Sección | Constante | `concept_key` | Pantalla |
| --- | --- | --- | --- |
| `income` | `INCOME_SECTION` | `INCOME_INPUT_KEYS` (11): `ventas`, `costo`, `gasto_venta`, `gasto_admin`, `gasto_general`, `productos_financieros`, `gastos_financieros`, `utilidad_cambiaria` (signo), `otros_productos` (signo), `isr`, `ptu`; memo `INCOME_MEMO` (3): `depreciacion`, `reserva_cxc`, `reserva_inventarios` | Estado de Resultados |
| `balance` | `BALANCE_SECTION` | `ALL_BALANCE_KEYS` (27): `efectivo`, `clientes`, `otras_cxc`, `cxc_relacionadas`, `inventarios`, `pagos_anticipados`, `impuestos_recuperar`, `otros_circulantes`, `activos_fijos`, `otros_activos`, `activos_diferidos`, `anticipos`, `proveedores`, `cias_relacionadas`, `gastos_acumulados`, `impuestos_pagar`, `bancario_cp`, `porcion_circulante_lp`, `acreedores`, `otras_cxp`, `bancario_lp`, `pasivos_diferidos`, `capital_social`, `aportaciones_futuras`, `reservas` (signo), `revaluacion`, `resultados_acumulados` (signo). **`resultado_periodo` no se guarda**: es la utilidad neta del Estado de Resultados | Balance General |
| `cashflow` | `CASHFLOW_SECTION` | `ALL_CASHFLOW_KEYS` (5): `venta_activo_fijo` (positivo), `cambiaria_deuda_cp`, `cambiaria_deuda_lp`, `cambiaria_clientes` (signo), `ajuste_revaluacion` (positivo); solo en periodos con periodo anterior | Estado de cambios |
| `sales` | `SALES_SECTION` | `id` del segmento (`fin_lines.id`) | Segmentos |
| `segcost` | `SEGCOST_SECTION` | `id` del segmento (`fin_lines.id`) | Segmentos |
| `expenses` | `EXPENSES_SECTION` | `ALL_EXPENSE_KEYS` (22): los 20 de `EXPENSE_CONCEPTS` (`sueldos` … `menores`) + `EXPENSE_VIRTUAL` (`amortizaciones`, `otras_virtuales`) | Desglose del gasto |
| `seasonality` | `SEASONALITY_SECTION` | `m01` … `m12` (`SEASON_MONTHS`) | Estacionalidad |

Secciones que desaparecieron con el modelo MP-AFH1 (las borra la migración `supabase-fin-model-afh1.sql`): `cost:<lineId>`, `cashflow-annex`, `cashflow-direct`; claves que desaparecieron: `income.otros_operacion`, `balance.caja`, `balance.inversiones`, `balance.impuesto_diferido_activo`, `balance.provisiones`, `balance.impuesto_diferido_pasivo`, `balance.resultado_periodo` (ver [02 - Reglas de Negocio §7, F6](./02-REGLAS-DE-NEGOCIO.md)).

**Ejemplo de uso (pantalla calculada, sin captura):**

```javascript
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION } from "@/config/finConfig";
import { computeRatios, summarizeRatios } from "@/config/finCalc";

const a = await FinAnalysis.getOrCreate();
const [years, lines] = await Promise.all([FinYear.list(a.id), FinLine.list(a.id)]);
const sections = await FinValue.getSections(a.id, [INCOME_SECTION, BALANCE_SECTION, CASHFLOW_SECTION]);
const ratios = computeRatios({ sections, years }); // { [yearId]: { months, values, status, na, aux } }
const last = years[years.length - 1];
const resumen = summarizeRatios(ratios[last.id]);  // { verde, ambar, rojo, na, atencion }
```

Las razones, el EBITDA y el Estado de cambios no se guardan: se recalculan en cada carga a partir de estas secciones (ver [02 - Reglas de Negocio §7](./02-REGLAS-DE-NEGOCIO.md)). `lines` solo hace falta para `computeSegments({ sections, years, lines })`.

---

## Operaciones Comunes

### Patrón de ordenamiento

El parámetro `order` usa el formato:

- `"created_date"` → ascendente por fecha de creación
- `"-created_date"` → descendente (más recientes primero)

```javascript
// El prefijo "-" indica orden descendente
const risks = await Risk.list("-created_date");
```

### Patrón de filtros

```javascript
// Filtra por un campo
const deptRisks = await Risk.filter({ department_id: "uuid-123" });

// Múltiples filtros (AND)
const filtered = await Risk.filter({
  department_id: "uuid-123",
  threat_type: "Interna",
});
```

### Manejo de errores

Los métodos de las entidades lanzan excepciones en caso de error. Los componentes deben usar `try/catch`:

```javascript
try {
  await Risk.create(riskData);
  navigate("/allrisks");
} catch (error) {
  console.error("Error:", error);
  setError(t("errorCreatingRisk"));
}
```

---

## Integraciones (`src/api/integrations.js`)

Se exportan las siguientes integraciones de Supabase, que están disponibles pero **no se utilizan activamente** en el código actual:

| Integración                   | Propósito                          |
| ----------------------------- | ---------------------------------- |
| `Core`                        | Acceso directo al cliente Supabase |
| `InvokeLLM`                   | Invocación de modelos de lenguaje  |
| `SendEmail`                   | Envío de correos electrónicos      |
| `UploadFile`                  | Subida de archivos al storage      |
| `GenerateImage`               | Generación de imágenes             |
| `ExtractDataFromUploadedFile` | Extracción de datos de archivos    |
| `CreateFileSignedUrl`         | Creación de URLs firmadas          |
| `UploadPrivateFile`           | Subida de archivos privados        |

> **Nota:** Estas integraciones están disponibles como wrappers para futuras funcionalidades pero no están implementadas en la versión actual de la aplicación.

---

**Navegación:**
← [06 - Internacionalización](./06-INTERNACIONALIZACION.md) | [08 - Despliegue](./08-DESPLIEGUE.md) →
