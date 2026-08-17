import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Plus,
  Compass,
  Search,
  Map,
  TrendingUp,
  FileText,
  LineChart,
  BarChart3,
  Ticket,
  Users,
  BookOpen,
  Settings,
  LayoutGrid,
  Calculator,
  Globe,
  ClipboardCheck,
  Sprout,
  ListChecks,
  Banknote,
  ListOrdered,
  Filter,
  ClipboardList,
  Trophy
} from "lucide-react";

// ============================================================
// Registro central de módulos de la aplicación.
//
// Cada módulo agrupa las pantallas (páginas) que le pertenecen. Este registro
// alimenta tanto el selector de módulos (ModuleLauncher) como el menú lateral,
// que ahora se acota a las páginas del módulo activo.
//
// - key: identificador único del módulo. Se usará también para el control de
//   acceso por usuario (Fase 2).
// - status: 'ready' (disponible) | 'in-development' (aún no desarrollado).
// - adminOnly: solo visible para administradores.
// - home: página a la que entra el módulo desde el selector.
// - pages: elementos del menú lateral dentro del módulo. `external` marca un
//   enlace que abre en pestaña nueva (ej. la documentación HTML).
// ============================================================

export const MODULES = [
  {
    key: "risk",
    nameKey: "moduleRisk",
    descKey: "moduleRiskDesc",
    icon: ShieldCheck,
    accent: "text-emerald-500",
    bg: "bg-emerald-500/15",
    status: "ready",
    home: "Dashboard",
    pages: [
      { pageKey: "Dashboard", nameKey: "dashboard", icon: LayoutDashboard },
      { pageKey: "Departments", nameKey: "departments", icon: Building2 },
      { pageKey: "AllRisks", nameKey: "allRisks", icon: ShieldCheck },
      { pageKey: "AddRisk", nameKey: "addRisk", icon: Plus },
      // Páginas del módulo que no aparecen en el menú (se llega a ellas desde
      // otras pantallas), pero deben mantener el menú del módulo activo.
      { pageKey: "DepartmentRisks", hidden: true },
      { pageKey: "AddDepartment", hidden: true },
    ],
  },
  {
    // Análisis financiero: distinto de la planeación financiera. Va antes de
    // la planeación estratégica en el flujo. Aún sin desarrollar.
    key: "fin-analysis",
    nameKey: "moduleFinAnalysis",
    descKey: "moduleFinAnalysisDesc",
    icon: Calculator,
    accent: "text-cyan-500",
    bg: "bg-cyan-500/15",
    status: "in-development",
    home: "ModuleInDevelopment",
    pages: [],
  },
  {
    key: "strategic",
    nameKey: "moduleStrategic",
    descKey: "moduleStrategicDesc",
    icon: Compass,
    accent: "text-purple-500",
    bg: "bg-purple-500/15",
    status: "ready",
    home: "StrategicPlanning",
    // Secciones plegables del menú lateral (los items con `group` se agrupan
    // bajo estos encabezados; el grupo de la página activa se abre solo).
    groups: [
      { key: "analysis", nameKey: "navGroupAnalysis" },
      { key: "strategy", nameKey: "navGroupStrategy" },
      { key: "action", nameKey: "navGroupAction" },
    ],
    pages: [
      { pageKey: "StrategicPlanning", nameKey: "navStrategicHome", icon: Compass },
      { pageKey: "CustomerAnalysis", nameKey: "navCustomerAnalysis", icon: Users, group: "analysis" },
      { pageKey: "MarketAnalysis", nameKey: "navMarketAnalysis", icon: Globe, group: "analysis" },
      { pageKey: "MarketConclusions", nameKey: "navMarketConclusions", icon: ClipboardCheck, group: "analysis" },
      { pageKey: "OpportunityAnalysis", nameKey: "navOpportunityAnalysis", icon: Sprout, group: "analysis" },
      { pageKey: "OpportunityConclusions", nameKey: "navOpportunityConclusions", icon: ListChecks, group: "analysis" },
      { pageKey: "FinancialStrategies", nameKey: "navFinancialStrategies", icon: Banknote, group: "analysis" },
      { pageKey: "StrategicSummary", nameKey: "navStrategicSummary", icon: ListOrdered, group: "strategy" },
      { pageKey: "StrategicMap", nameKey: "navStrategicMap", icon: Map, group: "strategy" },
      { pageKey: "StrategicMapCalibrated", nameKey: "navStrategicMapCalibrated", icon: Filter, group: "strategy" },
      { pageKey: "StrategicInitiatives", nameKey: "navStrategicInitiatives", icon: ClipboardList, group: "action" },
      { pageKey: "ScoreCard", nameKey: "navScoreCard", icon: Trophy, group: "action" },
      // Mockups anteriores; accesibles por URL sin aparecer en el menú.
      { pageKey: "SwotAnalysis", hidden: true },
      { pageKey: "BusinessAnalysis", hidden: true },
    ],
  },
  {
    key: "financial",
    nameKey: "moduleFinancial",
    descKey: "moduleFinancialDesc",
    icon: TrendingUp,
    accent: "text-orange-500",
    bg: "bg-orange-500/15",
    status: "in-development",
    home: "FinanceDashboard",
    pages: [
      { pageKey: "FinanceDashboard", nameKey: "navFinancialPlanning", icon: TrendingUp },
      { pageKey: "FinancialCurrent", nameKey: "navFinCurrent", icon: FileText },
      { pageKey: "FinancialProjection", nameKey: "navFinProjection", icon: LineChart },
      { pageKey: "FinancialHistory", nameKey: "navFinHistory", icon: BarChart3 },
    ],
  },
  {
    key: "admin",
    nameKey: "moduleAdmin",
    descKey: "moduleAdminDesc",
    icon: Settings,
    accent: "text-accent",
    bg: "bg-accent/15",
    status: "ready",
    adminOnly: true,
    home: "InvitationCodes",
    pages: [
      { pageKey: "InvitationCodes", nameKey: "invitationCodes", icon: Ticket },
      { pageKey: "UserManagement", nameKey: "userManagement", icon: Users },
      { pageKey: "ModuleAccess", nameKey: "moduleAccessNav", icon: LayoutGrid },
      { pageKey: "Documentation", nameKey: "documentation", icon: BookOpen, external: "/documentacion.html" },
      { pageKey: "AddInvitationCode", hidden: true },
    ],
  },
];

// Devuelve el módulo que contiene una página dada (o null si no pertenece a
// ninguno, ej. el propio selector de módulos).
export function findModuleByPage(pageName) {
  return MODULES.find((m) => m.pages.some((p) => p.pageKey === pageName)) || null;
}

// ¿El usuario tiene acceso a este módulo?
// - Los administradores tienen acceso a todos los módulos.
// - Los módulos adminOnly solo son para administradores.
// - Para el resto, el acceso depende de los módulos concedidos al usuario
//   (Fase 2). `grantedModules` es un arreglo de keys (ej. ['risk','strategic']).
export function canAccessModule(module, { isAdmin, grantedModules = [] }) {
  if (!module) return false;
  if (isAdmin) return true;
  if (module.adminOnly) return false;
  return grantedModules.includes(module.key);
}

// Devuelve los módulos visibles para el usuario, según su rol y los módulos
// que se le concedieron.
export function getVisibleModules({ isAdmin, grantedModules = [] }) {
  return MODULES.filter((m) => canAccessModule(m, { isAdmin, grantedModules }));
}

// Lista de módulos que un admin puede asignar a un usuario: todos menos los
// adminOnly (esos van implícitos con el rol de administrador).
export function getAssignableModules() {
  return MODULES.filter((m) => !m.adminOnly);
}
