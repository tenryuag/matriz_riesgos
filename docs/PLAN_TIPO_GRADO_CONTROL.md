# Plan de Cambios: Agregar "Tipo de Control" y "Grado de Control"

## Análisis del Excel (Hoja: Ejemplo matriz automática)

### Columna "Tipo de Control" (Col AK)
Es un campo **de selección** dentro de cada mitigante con 3 opciones:
- **Control Preventivo**
- **Control Correctivo**
- **Control Detectivo**

### Columna "Grado de Control" (Col AZ)
Es un campo **calculado automáticamente** basado en 6 sub-criterios del mitigante. La fórmula asigna un puntaje a cada criterio y según el total clasifica el control:

| Sub-criterio | Valores posibles | Puntaje |
|---|---|---|
| Tipo de Control | Preventivo=0.30, Correctivo=0.05, Detectivo=0.15 |
| ¿Control documentado? | Sí=0.10, No=0.01 |
| Tipo de procesos | Manual=0.10, Automatizado=0.40, Combinado=0.25 |
| ¿Genera evidencia auditable? | Sí=0.10, No=0.01 |
| ¿Tiene responsable? | Sí=0.10, No=0.01 |
| ¿Se ejecuta con frecuencia? | Sí=0.10, No=0.01 |

**Total** = Suma de los 6 puntajes

**Clasificación del Grado:**
- Total = 1.10 → **"Fuerte"**
- Total ≥ 0.70 → **"Medio"**
- Total < 0.70 → **"Débil"**

> **Nota:** Para que "Grado de Control" se calcule correctamente, se necesitan los 6 sub-campos. Si solo se agrega "Tipo de Control" sin los demás, el Grado no se puede calcular automáticamente.

---

## Archivos a Modificar

### 1. Base de Datos (Supabase) — SQL Migration
Agregar **8 columnas nuevas por cada mitigante** (×3 mitigantes = 24 columnas) a la tabla `risks`:

```sql
-- Para cada mitigante (1, 2, 3):
ALTER TABLE risks ADD COLUMN control_type_1 TEXT;         -- Tipo de Control
ALTER TABLE risks ADD COLUMN control_documented_1 TEXT;    -- ¿Documentado?
ALTER TABLE risks ADD COLUMN process_type_1 TEXT;          -- Tipo de procesos
ALTER TABLE risks ADD COLUMN control_evidence_1 TEXT;      -- ¿Genera evidencia?
ALTER TABLE risks ADD COLUMN control_responsible_1 TEXT;    -- ¿Tiene responsable?
ALTER TABLE risks ADD COLUMN control_frequency_1 TEXT;     -- ¿Se ejecuta con frecuencia?
ALTER TABLE risks ADD COLUMN control_grade_1 TEXT;         -- Grado de Control (calculado en frontend)

-- Repetir para _2 y _3
```

### 2. `src/pages/AddRisk.jsx` — Formulario de Creación/Edición

**Cambios:**
- Agregar constantes para las nuevas opciones:
  ```js
  const CONTROL_TYPES = ["Control Preventivo", "Control Correctivo", "Control Detectivo"];
  const PROCESS_TYPES = ["Manual", "Automatizado", "Combinado"];
  const YES_NO = ["Sí", "No"];
  ```

- Agregar los nuevos campos al `formData` inicial (para cada mitigante 1, 2, 3):
  ```js
  control_type_1: "", control_documented_1: "", process_type_1: "",
  control_evidence_1: "", control_responsible_1: "", control_frequency_1: "",
  control_grade_1: "",
  // ...repetir para _2 y _3
  ```

- Agregar función de cálculo automático del Grado de Control:
  ```js
  const calculateControlGrade = (num) => {
    // Suma los puntajes de los 6 sub-criterios
    // Devuelve "Fuerte", "Medio" o "Débil"
  };
  ```

- Modificar el `handleChange` para recalcular el grado cuando cambie cualquier sub-criterio

- Agregar los campos UI dentro de cada bloque de mitigante (el bloque `[1,2,3].map(...)`) con los 6 selects + indicador visual del Grado

### 3. `src/pages/AllRisks.jsx` — Tabla de Matriz de Riesgos

**Cambios:**
- Agregar 2 columnas nuevas por mitigante en la tabla: "Tipo de Control" y "Grado de Control"
- Agregar color coding para el Grado de Control:
  - Fuerte → Verde
  - Medio → Amarillo/Ámbar
  - Débil → Rojo
- Actualizar el `exportToExcel` para incluir los nuevos campos en la exportación

### 4. `src/pages/DepartmentRisks.jsx` — Vista por Departamento

**Cambios:**
- Opcionalmente agregar columnas de Tipo de Control y Grado de Control en la tabla simplificada

### 5. `src/components/LanguageContext.jsx` — Traducciones

**Agregar claves ES/EN:**
```js
// Español
controlType: "Tipo de Control",
controlPreventive: "Control Preventivo",
controlCorrective: "Control Correctivo",
controlDetective: "Control Detectivo",
controlDocumented: "¿Control documentado?",
processType: "Tipo de procesos",
processManual: "Manual",
processAutomated: "Automatizado",
processCombined: "Combinado",
controlEvidence: "¿Genera evidencia auditable?",
controlResponsible: "¿Tiene responsable?",
controlFrequency: "¿Se ejecuta con frecuencia?",
controlGrade: "Grado de Control",
gradeStrong: "Fuerte",
gradeMedium: "Medio",
gradeWeak: "Débil",
yes: "Sí",
no: "No",

// English equivalents...
```

### 6. `src/pages/Dashboard.jsx` — Dashboard (Opcional)

**Cambios posibles:**
- Agregar estadísticas de distribución de Grado de Control (cuántos Fuerte/Medio/Débil)

---

## Resumen Visual del Cambio en el Formulario

Actualmente cada bloque de mitigante tiene:
```
┌─ Medida de Mitigación N ─────────────┐
│  [Descripción del mitigante]         │
│  [Tipo de mitigación ▼]             │
└──────────────────────────────────────┘
```

Después del cambio:
```
┌─ Medida de Mitigación N ─────────────────────────────┐
│  [Descripción del mitigante]                         │
│  [Tipo de mitigación ▼]                             │
│                                                       │
│  ── Evaluación del Control ──                         │
│  [Tipo de Control ▼]    [¿Documentado? ▼]           │
│  [Tipo de procesos ▼]   [¿Evidencia? ▼]            │
│  [¿Responsable? ▼]      [¿Frecuencia? ▼]           │
│                                                       │
│  Grado de Control: ████ FUERTE ████                  │
└───────────────────────────────────────────────────────┘
```

---

## Orden de Implementación Sugerido

1. Ejecutar SQL migration en Supabase (agregar columnas)
2. Agregar traducciones en LanguageContext
3. Modificar AddRisk.jsx (formulario + lógica de cálculo)
4. Modificar AllRisks.jsx (tabla + exportación Excel)
5. Modificar DepartmentRisks.jsx (opcional, tabla simplificada)
6. Testing y verificación
