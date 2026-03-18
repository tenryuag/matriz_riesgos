# 🔍 Auditoría UX/UI — Ecosistema de Aplicaciones Mara Pérez

> **Auditor:** Senior UX/UI Auditor & Product Strategist  
> **Fecha:** 2026-03-10  
> **Alcance:** Matriz de Riesgos (Gold Standard), Planeación Empresarial, Análisis Financiero, Planeación Financiera  
> **Metodología:** Door3, Gluo, UXPin + Heurísticas de Jakob Nielsen

---

## 1. Definición de Objetivos y KPIs

### 1.1 Objetivo Estratégico
Consolidar las 4 aplicaciones de mentoría y productividad empresarial en un ecosistema unificado con navegación coherente, identidad visual consistente y experiencia de usuario fluida que reduzca la fricción y aumente la retención.

### 1.2 KPIs de Éxito

| KPI | Baseline Actual | Meta |
|-----|-----------------|------|
| Tiempo para completar una tarea clave (e.g. registrar un riesgo) | ~5 min (estimado: 8 secciones de formulario) | ≤ 3 min |
| Tasa de abandono en tablas de largo scroll | Alta (tabla de 22+ columnas) | Reducción del 50% |
| Ratio de contraste WCAG AA | Parcial (glassmorphism compromete legibilidad) | 100% AA en textos |
| Tiempo de onboarding para nueva app módulo | N/A (apps independientes) | ≤ 2 min gracias a navegación unificada |
| Consistencia del sistema de diseño | ~60% (discrepancias tipográficas y de color) | ≥ 95% |

---

## 2. Evaluación Heurística (Jakob Nielsen — 10 Reglas)

### H1: Visibilidad del Estado del Sistema ⚠️ MEDIO

**Hallazgos:**
- ✅ **Positivo:** Loading states con skeleton screens en Dashboard y AllRisks
- ✅ **Positivo:** Spinner de carga durante login
- ⚠️ **Alerta:** No hay feedback de progreso al enviar formulario de riesgo (AddRisk.jsx) — el usuario no sabe si la operación tuvo éxito hasta redirección
- ⚠️ **Alerta:** Sin indicador de progreso al exportar Excel en matrices grandes
- ❌ **Crítico:** Ausencia de toast/snackbar de confirmación tras operaciones CRUD exitosas

**Recomendación:**
Implementar un sistema de notificaciones toast (e.g. Sonner) para feedback inmediato en todas las operaciones CRUD. Prioridad: **ALTA**.

---

### H2: Coincidencia entre el Sistema y el Mundo Real ✅ BAJO RIESGO

**Hallazgos:**
- ✅ Terminología profesional de gestión de riesgos correctamente aplicada (Probabilidad × Impacto, Inherente/Residual)
- ✅ Escala de colores intuitiva (verde → rojo) para niveles de riesgo
- ✅ Soporte bilingüe (ES/EN) bien implementado via LanguageContext
- ⚠️ Menor: La label "Tipo de amenaza" podría ser más descriptiva para usuarios novatos

**Recomendación:** Agregar tooltips informativos en campos especializados. Prioridad: **BAJA**.

---

### H3: Control y Libertad del Usuario ⚠️ MEDIO

**Hallazgos:**
- ✅ Formulario de riesgo permite edición de todos los campos
- ✅ Eliminación en lote con confirmación
- ⚠️ **Alerta:** Sin función "Deshacer" (undo) tras eliminar un riesgo — la acción es destructiva e irreversible
- ⚠️ **Alerta:** No hay opción de "Guardar como borrador" en formularios largos
- ❌ **Crítico:** `window.confirm()` nativo para confirmaciones de eliminación — rompe la estética glassmorphism y no es customizable

**Recomendación:**
- Reemplazar `window.confirm()` con modales personalizados (el componente `jdpqO` Component/Modal ya existe en el .pen)
- Implementar soft-delete con opción de restauración
- Prioridad: **ALTA**

---

### H4: Consistencia y Estándares ❌ ALTO RIESGO

**Hallazgos:**

#### Tipografía — Discrepancia crítica vs Brand Book
| Elemento | Brand Book | Implementación Actual |
|----------|------------|----------------------|
| Título decorativo | Pinyon Script | Frank Ruhl Libre |
| Títulos (H1-H3) | Montserrat Bold | Frank Ruhl Libre 700 |
| Subtítulos | Montserrat | Avenir Next Bold |
| Body text | Montserrat Light | Avenir Next Light 300 |

> [!CAUTION]
> La tipografía actual **no coincide con el Brand Book**. Las fuentes Pinyon Script y Montserrat del manual de identidad no están implementadas. Se usan Frank Ruhl Libre (serif) y Avenir Next (sans-serif), que crean una identidad visual diferente.

#### Paleta de Colores
| Elemento | Brand Book | Implementación |
|----------|------------|----------------|
| Color primario/acento | #C8972B (dorado oscuro) | #DDBF5A (dorado claro) |
| Color secundario/texto | #3C3C3B (gris oscuro) | #121212 (dark) / #FAF7F6 (light) |

> [!WARNING]
> El acento dorado implementado (#DDBF5A) es más claro y saturado que el del Brand Book (#C8972B). Esto afecta el reconocimiento de marca.

#### Botones inconsistentes
- El .pen define 6 variantes de botón (Primary, Secondary, Outline, Ghost, Destructive, Icon)
- En código se mezclan clases ad-hoc (`bg-accent`, `glass`, `button-glass`) que no mapean 1:1 a los componentes del design system
- Los botones del sidebar usan `nav-glass` (clase custom), no los componentes de botón estándar

**Recomendación:**
1. Decidir si se adoptan las fuentes del Brand Book o se actualiza el Brand Book
2. Unificar el color acento a una sola tonalidad
3. Mapear todas las variantes de botón al sistema de componentes del .pen
4. Prioridad: **ALTA**

---

### H5: Prevención de Errores ⚠️ MEDIO

**Hallazgos:**
- ✅ Campos requeridos marcados correctamente en AddRisk
- ✅ Validación de email/password en login
- ⚠️ Sin validación en tiempo real (los errores solo aparecen al enviar)
- ⚠️ El formulario de riesgo no advierte sobre campos opcionales que podrían afectar el análisis (e.g. "Sin probabilidad/impacto, el nivel de riesgo quedará como 'Sin clasificar'")
- ❌ Los selects no muestran guía contextual sobre qué significa cada nivel de probabilidad/impacto

**Recomendación:**
- Agregar inline validation y helper text contextual
- Agregar warnings cuando campos clave están vacíos
- Prioridad: **MEDIA**

---

### H6: Reconocimiento vs Recuerdo ⚠️ MEDIO

**Hallazgos:**
- ✅ Sidebar con iconos + labels ayuda a la navegación
- ✅ Breadcrumbs disponibles en el design system (pero no implementados en código)
- ⚠️ En la tabla de AllRisks (22+ columnas), el usuario pierde contexto al hacer scroll horizontal — las columnas de identificación (Departamento, Descripción) desaparecen
- ⚠️ No hay indicadores de "estado de completitud" en el formulario de riesgo

**Recomendación:**
- Implementar columnas fijas (sticky) en tablas para Departamento y Descripción
- Agregar breadcrumbs funcionales para navegación contextual
- Agregar stepper/progress indicator en AddRisk
- Prioridad: **ALTA**

---

### H7: Flexibilidad y Eficiencia de Uso ⚠️ MEDIO

**Hallazgos:**
- ✅ Filtros combinados (departamento + nivel + búsqueda) en AllRisks
- ✅ Exportación Excel
- ⚠️ Sin atajos de teclado
- ⚠️ Sin vista alternativa de la tabla (e.g. vista de tarjetas para móvil)
- ⚠️ Sin búsqueda global desde la sidebar

**Recomendación:**
- Implementar el componente SearchBar (`U3FPG`) del .pen en la sidebar
- Agregar vista responsive de tarjetas como alternativa a la tabla
- Prioridad: **MEDIA**

---

### H8: Diseño Estético y Minimalista ✅ BAJO RIESGO (con reservas)

**Hallazgos:**
- ✅ **Excelente:** El sistema glassmorphism es visualmente sofisticado y profesional
- ✅ **Excelente:** Tema claro/oscuro bien implementado
- ✅ Uso efectivo de espaciado y jerarquía visual
- ⚠️ La tabla de riesgos completa (22+ cols) contradice el minimalismo — demasiada información condensada
- ⚠️ Los badges de nivel de riesgo tienen 5 combinaciones de color que pueden resultar excesivas en una sola vista

**Recomendación:**
- Considerar vista colapsable/expandible para las columnas de mitigantes
- Agrupar las 3 secciones de mitigantes en un acordeón o drawer
- Prioridad: **MEDIA**

---

### H9: Ayuda para Reconocer, Diagnosticar y Recuperarse de Errores ❌ ALTO RIESGO

**Hallazgos:**
- ✅ Mensajes de error en login (credenciales inválidas, cuenta suspendida)
- ❌ **Crítico:** Los mensajes de error en operaciones CRUD son genéricos (`console.error` + `alert()`)
- ❌ Error de eliminación usa `alert(t('errorDeleting'))` — no ofrece contexto ni pasos de recuperación
- ❌ Sin página de error 404 personalizada
- ❌ Sin manejo visual de errores de red/timeout

**Recomendación:**
- Implementar componentes Alert del .pen (`QxPAm` Success, `lFEQD` Error, `dTH63` Warning, `E5T0X` Info)
- Agregar ErrorBoundary mejorado con opción de reintentar
- Prioridad: **ALTA**

---

### H10: Ayuda y Documentación ❌ ALTO RIESGO

**Hallazgos:**
- ❌ Sin sistema de ayuda in-app
- ❌ Sin onboarding/tutorial para usuarios nuevos
- ❌ Sin tooltips explicativos en conceptos de gestión de riesgos
- ❌ Sin sección FAQ o guía de uso

**Recomendación:**
- Implementar un tour de bienvenida (e.g. React Joyride) para usuarios nuevos
- Agregar tooltips en campos especializados
- Crear una sección de ayuda/FAQ accesible desde la sidebar
- Prioridad: **MEDIA** (impacto alto pero esfuerzo considerable)

---

## 3. Diagnóstico de Accesibilidad y Marca

### 3.1 WCAG 2.1 — Evaluación de Contraste

| Elemento | Fondo | Texto/Icono | Ratio Estimado | WCAG AA |
|----------|-------|-------------|----------------|---------|
| Texto body en dark mode | #121212 | #FAF7F6 | ~18:1 | ✅ Pass |
| Texto muted en dark | #121212 | rgba(250,247,246,0.7) | ~10:1 | ✅ Pass |
| Acento dorado en dark bg | #121212 | #DDBF5A | ~8.5:1 | ✅ Pass |
| **Glass card en dark** | rgba(250,247,246,0.12) | #FAF7F6 | **~3.5:1** | ⚠️ **Borderline** |
| **Glass card en light** | rgba(255,255,255,0.25) | #121212 | **~4.2:1** | ⚠️ **Borderline** |
| Placeholder en input-glass | var(--input-bg) | var(--foreground-muted) | **~3.8:1** | ❌ **Fail** |
| Button-glass texto | rgba(221,191,90,0.8) | #121212 | ~7:1 | ✅ Pass |

> [!IMPORTANT]
> El efecto **glassmorphism reduce el contraste** al superponer semi-transparencias. Los textos sobre fondos `glass` (0.12-0.25 opacidad) pueden caer por debajo del ratio mínimo 4.5:1, especialmente para usuarios con baja visión. Solución: aumentar opacidad de fondo `glass` a mínimo 0.4, o agregar text-shadow sutil.

### 3.2 Otros Hallazgos de Accesibilidad

| Criterio | Estado |
|----------|--------|
| Navegación por teclado (Tab/Enter) | ⚠️ Parcial — sidebar links sí, botones custom no siempre |
| Focus indicators | ⚠️ Solo en inputs (`:focus` con border-color accent), falta en nav items |
| Skip-to-content link | ❌ Ausente |
| ARIA labels en iconos | ⚠️ Falta en muchos icon-only buttons |
| Responsive (mobile-first) | ✅ Sidebar colapsable, grids responsivos |
| Touch target size (48x48px mínimo) | ⚠️ Algunos botones son menores en móvil |
| Screen reader support | ❌ No testeado, tooltips y labels parciales |

### 3.3 Brecha de Identidad Visual

```
BRAND BOOK                    APP IMPLEMENTADA
─────────────────              ─────────────────
Pinyon Script (decorativo)  ≠  Frank Ruhl Libre (serif display)  
Montserrat (body)           ≠  Avenir Next (sans-serif)
#C8972B (dorado)            ≠  #DDBF5A (dorado más claro)
#3C3C3B (gris)              ≈  #121212 (negro) / #FAF7F6 (crema)
```

**Impacto:** Baja reconocibilidad de marca entre las apps y los materiales impresos/digitales del Brand Book.

---

## 4. Análisis de Flujo y Perfiles de Usuario

### 4.1 User Persona

| Atributo | Detalle |
|----------|---------|
| **Nombre** | "Líder Empresarial" — ejemplo: Director de operaciones |
| **Edad** | 35-55 años |
| **Perfil técnico** | Medio-bajo (no es developer, usa herramientas empresariales) |
| **Objetivo** | Estructurar su empresa, tomar decisiones basadas en datos |
| **Dolor primario** | Caos organizacional; necesita orden y visibilidad |
| **Contexto de uso** | Desktop (oficina) y tablet (reuniones) |
| **Expectativa** | Herramienta que se sienta "premium" y profesional |

### 4.2 Mapa de Recorrido del Usuario (Matriz de Riesgos)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐
│  1. LOGIN   │───▸│ 2. DASHBOARD │───▸│ 3. DEPARTAMENTO │───▸│ 4. ADD RISK   │
│  Credencial │    │  KPIs + Stats│    │  Ver riesgos    │    │  Formulario   │
│  + Registro │    │  Quick nav   │    │  por depto.     │    │  8 secciones  │
└─────────────┘    └──────────────┘    └─────────────────┘    └───────────────┘
                          │                                          │
                          ▼                                          ▼
                   ┌──────────────┐                          ┌───────────────┐
                   │ 5. ALL RISKS │                          │ 6. CONCLUSIÓN │
                   │ Tabla 22+cols│                          │ Nivel/Score   │
                   │ Filter/Sort  │                          │ calculado     │
                   │ Export Excel │                          └───────────────┘
                   └──────────────┘
```

### 4.3 Puntos de Abandono Identificados

| Punto | Pantalla | Causa Raíz | Severidad |
|-------|----------|------------|-----------|
| **PA-1** | AddRisk | Formulario largo (8 secciones) sin indicador de progreso | 🔴 Alta |
| **PA-2** | AllRisks | Tabla de 22+ columnas con scroll horizontal extenso | 🔴 Alta |
| **PA-3** | AddRisk | Sin guardado parcial / borrador — perder datos si sale | 🟠 Media |
| **PA-4** | Login | Sin onboarding post-registro, usuario llega a dashboard vacío | 🟡 Media |
| **PA-5** | Departments | No es evidente cómo llegar a "agregar riesgo" desde un departamento | 🟡 Baja |

---

## 5. Lista de Verificación del Sistema de Diseño

### 5.1 Componentes del .pen vs Uso en Código

| Componente (.pen) | ID | ¿Usado en Código? | Nota |
|-------------------|----|--------------------|------|
| Button/Primary | `JjXup` | ✅ Parcial | Se usa `bg-accent` ad-hoc |
| Button/Secondary | `7ueBv` | ⚠️ Mixto | Clases custom en vez de componente |
| Button/Destructive | `dZQFQ` | ✅ En AllRisks delete | CSS ad-hoc pero funcional |
| Input/Text | `VtLUy` | ✅ Via shadcn Input | Decorado con `.input-glass` |
| Input/Select | `TCu2k` | ✅ Via shadcn Select | Decorado con `.input-glass` |
| Card | `xidGs` | ✅ Via shadcn Card | `.glass` class overlay |
| Table/Wrapper | `FvnCQ` | ✅ Via shadcn Table | `.table-glass` class |
| Modal | `jdpqO` | ❌ No usado | Se usa `window.confirm()` |
| Alert/Success | `QxPAm` | ❌ No usado | `console.error()` + `alert()` |
| Alert/Error | `lFEQD` | ❌ No usado | — |
| Breadcrumb/* | `EH6RT`/`ieLlb` | ❌ No usado | Sin breadcrumbs en app |
| SearchBar | `U3FPG` | ❌ No usado | Búsqueda es un Input plain |
| MetricCard | `dhXtR` | ❌ No usado | Cards del dashboard son custom |
| Pagination/* | `qJivV`/`Rmbl0` | ❌ No usado | Sin paginación en tablas |
| Badge/* | `i0fIt`-`W7lE7` | ⚠️ Parcial | Badges de nivel son inline CSS |
| Avatar | `81BXQ` | ❌ No usado | Sidebar muestra texto, no avatar |
| Tabs | `lGeEh` | ❌ No usado | — |
| Dropdown | `V3ti7` | ❌ No usado | — |
| List/Item | `beGDk` | ❌ No usado | Department list es custom |
| Sidebar | `exyDh` | ⚠️ Parcial | Sidebar exists pero es custom JSX |

> [!WARNING]
> De los 47 componentes del design system en el .pen, solo ~12 están realmente implementados en código, y de esos, la mayoría usa clases CSS ad-hoc que no mapean 1:1 al diseño del componente.

---

## 6. Priorización de Recomendaciones

### 🔴 Impacto ALTO (Implementar primero)

| # | Recomendación | Heurística | Esfuerzo |
|---|---------------|------------|----------|
| R1 | **Columnas sticky en tablas** — Fijar Departamento + Descripción en scroll horizontal | H6 | Bajo |
| R2 | **Reemplazar `window.confirm()` con Component/Modal** del .pen | H3, H4 | Bajo |
| R3 | **Sistema de notificaciones toast** para feedback CRUD | H1, H9 | Medio |
| R4 | **Resolver discrepancia tipográfica** — Adoptar Montserrat o actualizar Brand Book | H4 | Bajo |
| R5 | **Unificar color acento** — #C8972B (Brand Book) o #DDBF5A (actual) | H4 | Bajo |
| R6 | **Stepper/progress en AddRisk** — Dividir formulario en pasos | H6 | Medio |
| R7 | **Paginación en tablas** usando Pagination component del .pen | H7 | Medio |

### 🟠 Impacto MEDIO

| # | Recomendación | Heurística | Esfuerzo |
|---|---------------|------------|----------|
| R8 | Implementar Breadcrumbs funcionales | H6 | Bajo |
| R9 | Agregar MetricCard del .pen en Dashboard | H4 | Bajo |
| R10 | Mejorar contraste glassmorphism (opacidad ≥ 0.4) | WCAG | Bajo |
| R11 | Inline validation en formularios | H5 | Medio |
| R12 | SearchBar global en sidebar | H7 | Medio |
| R13 | Vista de tarjetas alternativa para AllRisks en móvil | H7 | Alto |
| R14 | Implementar componentes Alert para errores | H9 | Bajo |

### 🟢 Impacto BAJO (Nice to have)

| # | Recomendación | Heurística | Esfuerzo |
|---|---------------|------------|----------|
| R15 | Tour de onboarding para usuarios nuevos | H10 | Alto |
| R16 | Tooltips informativos en campos especializados | H2, H10 | Bajo |
| R17 | Atajos de teclado para power users | H7 | Medio |
| R18 | Skip-to-content link para accesibilidad | WCAG | Bajo |
| R19 | ARIA labels en todos los icon-only buttons | WCAG | Bajo |
| R20 | Dark/Light mode persistence ya existe ✅ | — | — |

---

## 7. Propuesta de Consolidación — 4 Apps en 1

### 7.1 Aclaración de Módulos

| App Original | Módulo Propuesto | Función |
|-------------|------------------|---------|
| **Matriz de Riesgos** | 📊 Riesgos | Identificar, evaluar y mitigar riesgos |
| **Planeación Empresarial** | 📋 Planeación | Visión, misión, FODA, cronogramas |
| **Análisis Financiero** | 📈 Análisis Financiero | Datos históricos, ratios, diagnóstico |
| **Planeación Financiera** | 🎯 Proyecciones | Proyecciones, presupuestos, escenarios |

> [!IMPORTANT]
> **Análisis Financiero** y **Planeación Financiera** son módulos **distintos**: uno mira hacia atrás (datos históricos) y otro hacia adelante (proyecciones). No deben fusionarse en una sola sección.

### 7.2 Arquitectura de Navegación Unificada

```
┌─────────────────────────────────────────────────┐
│  SIDEBAR UNIFICADA                              │
│                                                 │
│  🏠 Dashboard General                          │
│  ─ Vista 360° de todos los módulos              │
│                                                 │
│  📊 RIESGOS                                    │
│  ├── Panel de Riesgos                           │
│  ├── Departamentos                              │
│  ├── Matriz Completa                            │
│  └── + Agregar Riesgo                           │
│                                                 │
│  📋 PLANEACIÓN                                 │
│  ├── Diagnóstico (FODA)                         │
│  ├── Plan Estratégico                           │
│  ├── Cronograma                                 │
│  └── Objetivos / OKRs                           │
│                                                 │
│  📈 ANÁLISIS FINANCIERO                        │
│  ├── Estados Financieros                        │
│  ├── Ratios e Indicadores                       │
│  ├── Análisis de Tendencias                     │
│  └── Diagnóstico Financiero                     │
│                                                 │
│  🎯 PROYECCIONES                               │
│  ├── Presupuesto                                │
│  ├── Flujo de Caja Proyectado                   │
│  ├── Escenarios (Optimista/Pesimista)           │
│  └── Metas Financieras                          │
│                                                 │
│  ─────────────────                              │
│  ⚙️ Admin (si es admin)                        │
│  ├── Códigos de Invitación                      │
│  ├── Gestión de Usuarios                        │
│  └── Configuración                              │
│                                                 │
│  👤 Perfil | 🌙 Tema | 🌐 Idioma | 🚪 Salir   │
└─────────────────────────────────────────────────┘
```

### 7.3 Dashboard General (Vista 360°)

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard General — "Centro de Mando"                  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Riesgos  │ │Planeación│ │ Análisis │ │Proyección│   │
│  │ 12 altos │ │ 3 metas  │ │ROI: 8.2% │ │ Meta: 1M │   │
│  │ 45 total │ │pendientes│ │Margen:24%│ │ Real:720K│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  ┌─── Semáforo de Salud ──┐  ┌─── Alertas ──────────┐  │
│  │  🟢 Riesgos: Estable   │  │  ⚠️ 3 riesgos altos  │  │
│  │  🟡 Plan: 2 retrasados │  │  ⚠️ ROI en descenso   │  │
│  │  🟢 Finanzas: OK       │  │  ✅ Margen estable     │  │
│  │  🔴 Proyección: Alerta │  │                       │  │
│  └────────────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 7.4 Principios de Consolidación

1. **Login unificado** — Una sola autenticación para los 4 módulos
2. **Navegación por secciones** — Usar la sidebar con secciones colapsables (Component/Nav/SectionTitle `Lyr9R` del .pen)
3. **Dashboard 360° como landing** — Primera pantalla tras login muestra KPIs de todos los módulos
4. **Datos compartidos** — Departamentos, usuarios y configuración son comunes
5. **Branding consistente** — Todas las secciones usan el mismo design system
6. **Roles y permisos** — Extensible: un usuario podría tener acceso solo a ciertos módulos

---

## 8. Hallazgos Específicos por Pantalla

### 8.1 Login Screen
- ✅ Split-screen desktop es moderno y profesional
- ✅ Responsive bien implementado (panel izquierdo se oculta en mobile)
- ⚠️ Show/hide password usa React Feather (`react-feather`) mientras el resto usa Lucide — inconsistencia de icon library
- ⚠️ Link "Forgot Password" usa `.text-foreground-muted` que no es una variable CSS válida (debería ser `var(--foreground-muted)`)

### 8.2 Dashboard
- ✅ Layout de 4 tarjetas es claro y escaneable
- ✅ Lista de departamentos recientes con acceso directo
- ⚠️ No usa el componente MetricCard (`dhXtR`) del .pen — usa Cards de shadcn
- ⚠️ Sin gráficos visuales (la distribución por nivel es solo barras de progreso)

### 8.3 AllRisks (Tabla Principal)
- ❌ **Pain Point #1:** 22+ columnas en una tabla horizontal — carga cognitiva excesiva
- ❌ Sin paginación — todas las filas se renderizan a la vez
- ⚠️ Encabezados de tabla con `rowSpan`/`colSpan` son complejos pero funcionales
- ⚠️ Los colores de badges usan clases TailwindCSS hardcodeadas, no variables del tema
- ✅ Filtros combinados bien implementados

### 8.4 AddRisk (Formulario)
- ⚠️ Formulario muy largo sin indicador de progreso
- ⚠️ Las 3 secciones de mitigantes son repetitivas — podrían usar un patrón de "agregar mitigante"
- ✅ Cálculo automático de nivel de riesgo funciona correctamente
- ✅ Edición inline de riesgo existente (via query param `?id=`)

### 8.5 Sidebar/Navigation
- ✅ Glassmorphism atractivo con efecto blur
- ✅ Active state claro (dorado sólido)
- ⚠️ El nombre "Gestión del Riesgo" está hardcodeado en español (no usa i18n)
- ⚠️ Sin búsqueda global
- ⚠️ El componente Sidebar (`exyDh`) del .pen no se usa

---

## 9. Resumen Ejecutivo

| Área | Estado | Score |
|------|--------|-------|
| Estética visual | 🟢 Excelente (glassmorphism premium) | 8/10 |
| Consistencia de marca | 🔴 Deficiente (fuentes y colores no coinciden) | 4/10 |
| Usabilidad de tablas | 🔴 Deficiente (scroll excesivo, sin paginación) | 3/10 |
| Formularios | 🟡 Aceptable (funcional pero largo) | 6/10 |
| Accesibilidad WCAG | 🟡 Parcial (contraste glassmorphism) | 5/10 |
| Sistema de navegación | 🟢 Bueno (sidebar funcional) | 7/10 |
| Feedback al usuario | 🔴 Deficiente (sin toasts, modals nativos) | 3/10 |
| Design system utilización | 🟡 Baja (~25% componentes usados) | 4/10 |
| Preparación para consolidación | 🟡 Moderada (arquitectura extensible) | 6/10 |
| **Score Global** | | **5.1/10** |

### Prioridades de Acción Inmediata
1. 🔴 Resolver discrepancia de tipografía y colores vs Brand Book
2. 🔴 Refactorizar tabla AllRisks (sticky cols + paginación + vista alternativa)
3. 🔴 Implementar sistema de notificaciones y modals del design system
4. 🟠 Agregar stepper en formulario AddRisk
5. 🟠 Mejorar contraste WCAG en glassmorphism
6. 🟢 Diseñar arquitectura de navegación para consolidación

---

**Próximo paso:** Diseño del flujo de pantallas en el archivo `.pen` con la propuesta de consolidación → ver `untitled.pen`.
