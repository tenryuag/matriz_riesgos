# 📋 Matriz de Riesgos — Resumen General

## Descripción del Proyecto

**Matriz de Riesgos** es una aplicación web profesional de gestión de riesgos organizacionales. Permite la identificación, evaluación, mitigación y seguimiento de riesgos por departamento, siguiendo la metodología estándar de matrices de riesgo (probabilidad × impacto).

## Propósito

El sistema está diseñado para que las organizaciones puedan:

- **Identificar** riesgos internos y externos por departamento
- **Evaluar** el riesgo inherente (antes de controles) y residual (después de mitigación)
- **Documentar** estrategias de mitigación con hasta 3 medidas por riesgo
- **Visualizar** el estado general de riesgos en un dashboard centralizado
- **Exportar** la información a Excel para reportes y auditorías
- **Controlar acceso** mediante roles (admin/user) y códigos de invitación

## Stack Tecnológico

| Componente        | Tecnología                                        |
| ----------------- | ------------------------------------------------- |
| **Frontend**      | React 18 + Vite 6                                 |
| **Estilos**       | TailwindCSS 3 + CSS personalizado (Glassmorphism) |
| **Routing**       | React Router DOM 7                                |
| **UI Components** | Radix UI + shadcn/ui                              |
| **Backend/BaaS**  | Supabase (Auth + Database + RLS + RPC)            |
| **Asistente de IA** | Claude (`claude-opus-5-5`) desde la Edge Function `ia` de Supabase; ver [IA.md](./IA.md) |
| **Gráficos**      | Recharts                                          |
| **Exportación**   | xlsx + file-saver                                 |
| **Animaciones**   | Framer Motion                                     |
| **Validación**    | Zod + React Hook Form                             |
| **Deploy**        | Vercel                                            |
| **Idiomas**       | Español (ES), Inglés (EN)                         |

## Arquitectura de Alto Nivel

```mermaid
graph TB
    subgraph "Cliente (React + Vite)"
        UI["UI Components<br/>(Radix/shadcn)"]
        Pages["Páginas<br/>(Dashboard, Departments, AddRisk, etc.)"]
        API["Capa API<br/>(entities.js)"]
        Auth["Autenticación<br/>(useAuth.js)"]
        i18n["Internacionalización<br/>(LanguageContext)"]
    end

    subgraph "Supabase (Backend)"
        SupaAuth["Supabase Auth"]
        DB["PostgreSQL"]
        RLS["Row Level Security"]
        RPC["Funciones RPC"]
    end

    Pages --> UI
    Pages --> API
    Pages --> i18n
    Pages --> Auth
    API --> SupaAuth
    API --> DB
    Auth --> SupaAuth
    DB --> RLS
    DB --> RPC
```

Dos piezas más viven del lado del servidor como **Edge Functions de Supabase** que verifican el JWT del usuario y leen con su RLS: el **servidor MCP** (`mcp`, para conversar con los datos desde Claude; [MCP.md](./MCP.md)) y el **asistente de IA** (`ia`, botones dentro de la app que llaman a Claude con la llave de la consultoría, sin chat; [IA.md](./IA.md)).

## Estructura de Directorios

```
tenryu-riesgos/
├── docs/                          # 📁 Documentación del proyecto
├── src/
│   ├── api/
│   │   ├── supabaseClient.js      # Configuración del cliente Supabase
│   │   ├── entities.js            # Modelos: Department, Risk, User, InvitationCode
│   │   ├── ia.js                  # Cliente del asistente de IA (Edge Function ia)
│   │   └── integrations.js        # Integraciones de Supabase (LLM, Email, etc.)
│   ├── components/
│   │   ├── ui/                    # Componentes UI reutilizables (shadcn/ui)
│   │   ├── ia/                    # IaDisclaimer: nota al pie de lo generado con IA
│   │   ├── GlobalErrorBoundary.jsx
│   │   └── LanguageContext.jsx    # Sistema de internacionalización
│   ├── hooks/
│   │   ├── useAuth.js             # Hook de autenticación
│   │   └── use-mobile.jsx         # Detección de dispositivo móvil
│   ├── lib/
│   │   └── utils.js               # Utilidades (normalización de niveles de riesgo)
│   ├── pages/
│   │   ├── index.jsx              # Router y definición de rutas
│   │   ├── Layout.jsx             # Layout principal + Login Screen
│   │   ├── Dashboard.jsx          # Dashboard con estadísticas
│   │   ├── Departments.jsx        # Lista de departamentos
│   │   ├── AddDepartment.jsx      # Crear/Editar departamento
│   │   ├── DepartmentRisks.jsx    # Riesgos por departamento
│   │   ├── AddRisk.jsx            # Crear/Editar riesgo
│   │   ├── AllRisks.jsx           # Matriz completa de riesgos
│   │   ├── ExecutiveSummary.jsx   # Resumen ejecutivo con IA (sin módulo, modo launcher)
│   │   ├── IaUsageAdmin.jsx       # Panel "Uso de IA" (Admin)
│   │   ├── InvitationCodes.jsx    # Gestión de códigos (Admin)
│   │   ├── AddInvitationCode.jsx  # Crear código de invitación
│   │   ├── Register.jsx           # Registro con código
│   │   ├── ForgotPassword.jsx     # Recuperación de contraseña
│   │   └── UpdatePassword.jsx     # Actualización de contraseña
│   ├── utils/
│   │   └── index.ts               # Utilidad createPageUrl
│   ├── App.jsx                    # Componente raíz
│   ├── main.jsx                   # Punto de entrada
│   ├── App.css
│   └── index.css                  # Estilos globales
├── supabase/functions/ia/         # Edge Function del asistente de IA (ver IA.md)
├── supabase-ia.sql                # Tablas ia_usage / ia_resultados + RPC del asistente
├── supabase-invitation-codes.sql  # Schema + funciones de invitation_codes
├── supabase-admin-rls-policies.sql# Políticas RLS para admins
├── supabase-fix-invitation-codes.sql # Fix de constraints
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json
└── .env                           # Variables de entorno (Supabase URL/Key)
```

## Flujo General de la Aplicación

```mermaid
flowchart TD
    A[Usuario accede a la app] --> B{¿Está autenticado?}
    B -- No --> C[Pantalla de Login]
    C --> D{¿Tiene cuenta?}
    D -- Sí --> E[Login con Email/Password]
    D -- No --> F[Registro con Código de Invitación]
    E --> G[Dashboard Principal]
    F --> G
    B -- Sí --> G

    G --> H[Ver Departamentos]
    G --> I[Ver Matriz de Riesgos]
    G --> J[Agregar Departamento]
    G --> K[Agregar Riesgo]

    H --> L[Ver Riesgos del Departamento]
    L --> M[Editar Riesgo]
    I --> N[Filtrar / Buscar]
    I --> O[Exportar a Excel]
    I --> P[Seleccionar y Eliminar]

    G --> Q{¿Es Admin?}
    Q -- Sí --> R[Gestión de Códigos de Invitación]
    R --> S[Generar Código]
    R --> T[Eliminar Código]
```

## Variables de Entorno

| Variable                 | Descripción                      |
| ------------------------ | -------------------------------- |
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase        |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase |

---

**Navegación de documentación:**

- [02 - Reglas de Negocio](./02-REGLAS-DE-NEGOCIO.md)
- [03 - Base de Datos](./03-BASE-DE-DATOS.md)
- [04 - Autenticación y Seguridad](./04-AUTENTICACION-Y-SEGURIDAD.md)
- [05 - Lógica del Frontend](./05-LOGICA-FRONTEND.md)
- [06 - Internacionalización](./06-INTERNACIONALIZACION.md)
- [07 - API y Entidades](./07-API-ENTIDADES.md)
- [08 - Despliegue](./08-DESPLIEGUE.md)
- [IA - Asistente de IA (Claude) dentro de la app](./IA.md)
- [MCP - Servidor MCP (conectar Claude a tu cuenta)](./MCP.md)
