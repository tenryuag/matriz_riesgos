
import React, { createContext, useState, useContext, useEffect } from 'react';

const translations = {
  es: {
    // General
    loading: "Cargando...",
    cancel: "Cancelar",
    save: "Guardar",
    edit: "Editar",
    delete: "Eliminar",
    view: "Ver",
    actions: "Acciones",
    search: "Buscar...",
    seeAll: "Ver todos",
    noDescription: "Sin descripción",
    confirmDelete: "¿Seguro que deseas eliminar {count} riesgo(s)?",
    errorDeleting: "Error al eliminar los riesgos.",
    deleting: "Eliminando...",
    
    // Niveles de Riesgo
    intolerable: "Intolerable",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
    tolerable: "Tolerable",
    unclassified: "Sin clasificar",

    // Layout & Login
    riskManagement: "Matriz de Riesgos",
    professionalManagement: "Gestión Profesional",
    dashboard: "Dashboard",
    departments: "Departamentos",
    allRisks: "Matriz de Riesgos",
    addRisk: "Agregar Riesgo",
    lightMode: "Modo Claro",
    darkMode: "Modo Oscuro",
    logout: "Cerrar Sesión",
    
    // New Login Translations
    loginWelcomeTitle: "Bienvenido de Vuelta",
    loginWelcomeSubtitle: "Ingresa a tu sistema de gestión de riesgos",
    loginHeroSubtitle: "Sistema profesional para la identificación, evaluación y gestión integral de riesgos organizacionales",
    loginButton: "Iniciar Sesión",
    loginButtonLoading: "Iniciando Sesión...",
    loginDisclaimer: "Al iniciar sesión, aceptas que tus datos se mantendrán privados y seguros",
    
    // Login Features
    loginFeature1Title: "Acceso Seguro",
    loginFeature1Description: "Autenticación con tu cuenta Google de forma segura y rápida",
    loginFeature2Title: "Datos Privados",
    loginFeature2Description: "Tu información está protegida con cifrado de nivel empresarial",
    loginFeature3Title: "Matriz Profesional",
    loginFeature3Description: "Herramientas avanzadas para la gestión completa de riesgos",

    // Dashboard
    welcome: "¡Bienvenido, {name}!",
    dashboardHeaderSubtitle: "Gestiona los riesgos de tu organización de manera profesional",
    newRisk: "Nuevo Riesgo",
    active: "Activos",
    totalRisks: "Riesgos Totales",
    identified: "Identificados",
    highRisks: "Riesgos Altos",
    immediateAttention: "Atención inmediata",
    lowRisks: "Riesgos Bajos",
    underControl: "Bajo control",
    recentDepartments: "Departamentos Recientes",
    noDepartmentsRegistered: "No hay departamentos registrados",
    createFirstDepartment: "Crear primer departamento",
    riskDistribution: "Distribución de Riesgos",
    noRisksRegistered: "No hay riesgos registrados",
    registerFirstRisk: "Registrar primer riesgo",

    // Departments Page
    departmentsTitle: "Departamentos",
    departmentsSubtitle: "Gestiona los departamentos y sus riesgos asociados",
    newDepartment: "Nuevo Departamento",
    totalRisksLabel: "Riesgos Totales",
    highRisksLabel: "Riesgos Altos",
    viewRisks: "Ver Riesgos",
    noDepartmentsFound: "No hay departamentos",
    noDepartmentsFoundSubtitle: "Comienza creando tu primer departamento para gestionar los riesgos",
    
    // AddDepartment Page
    addDepartmentTitle: "Nuevo Departamento",
    addDepartmentSubtitle: "Crea un nuevo departamento para gestionar riesgos",
    editDepartmentTitle: "Editar Departamento",
    editDepartmentSubtitle: "Actualiza los detalles del departamento",
    departmentInfo: "Información del Departamento",
    departmentNameLabel: "Nombre del Departamento *",
    departmentNamePlaceholder: "Ej: Recursos Humanos, IT, Finanzas...",
    descriptionLabel: "Descripción (Opcional)",
    descriptionPlaceholder: "Describe las funciones principales del departamento...",
    creating: "Creando...",
    createDepartment: "Crear Departamento",
    errorRequiredName: "El nombre del departamento es obligatorio",
    errorCreatingDepartment: "Error al crear el departamento. Intenta nuevamente.",
    errorUpdatingDepartment: "Error al actualizar el departamento. Intenta nuevamente.",
    departmentNotFound: "Departamento no encontrado.",

    // Risk Pages (General)
    riskInfo: "Información Básica",
    departmentLabel: "Departamento *",
    departmentPlaceholder: "Selecciona departamento",
    threatTypeLabel: "Tipo de Amenaza *",
    threatTypePlaceholder: "Selecciona tipo",
    threatInternal: "Interna",
    threatExternal: "Externa",
    riskDescriptionLabel: "Descripción del Riesgo *",
    riskDescriptionPlaceholder: "Describe detalladamente el riesgo...",
    inherentRiskEval: "Evaluación de Riesgo Inherente",
    inherentProbability: "Probabilidad Inherente",
    inherentImpact: "Impacto Inherente",
    selectProbability: "Selecciona probabilidad",
    selectImpact: "Selecciona impacto",
    inherentRiskLevel: "Nivel de Riesgo Inherente:",
    strategyAndMitigation: "Estrategia y Mitigación",
    managementStrategy: "Estrategia de Manejo",
    selectStrategy: "Selecciona estrategia",
    strategyAceptar: "Aceptar",
    strategyReducir: "Reducir",
    strategyTransferir: "Transferir",
    strategyEvitar: "Evitar",
    mitigationMeasure: "Medida de Mitigación {num}",
    mitigationDescription: "Describe la medida {num}...",
    mitigationImpact: "Impacto esperado...",
    selectMitigationImpact: "Selecciona el tipo de mitigación...",
    "Mitiga la probabilidad": "Mitiga la probabilidad",
    "Mitiga el impacto": "Mitiga el impacto",
    "Mitiga la probabilidad e impacto": "Mitiga la probabilidad e impacto",
    residualRisk: "Riesgo Residual",
    residualProbability: "Probabilidad Residual",
    residualImpact: "Impacto Residual",
    residualRiskLevel: "Nivel de Riesgo Residual:",
    saving: "Guardando...",
    saveChanges: "Guardar Cambios",
    registerRisk: "Registrar Riesgo",
    errorRequiredFields: "Por favor completa todos los campos obligatorios (*)",
    errorSavingRisk: "Error al guardar el riesgo. Intenta nuevamente.",
    riskNotFound: "Riesgo no encontrado.",
    dataLoadError: "No se pudieron cargar los datos necesarios.",

    // AddRisk Page
    addRiskTitle: "Registrar Nuevo Riesgo",
    addRiskSubtitle: "Documenta y evalúa un riesgo organizacional",
    editRiskTitle: "Editar Riesgo",
    editRiskSubtitle: "Actualiza los detalles del riesgo",

    // DepartmentRisks Page
    departmentRiskManagement: "Gestión de riesgos del departamento",
    filtersAndSearch: "Filtros y Búsqueda",
    searchRisksPlaceholder: "Buscar riesgos...",
    riskLevelLabel: "Nivel de riesgo",
    allLevels: "Todos los niveles",
    allThreats: "Todas las amenazas",
    riskList: "Lista de Riesgos ({count})",
    tableDescription: "Descripción",
    tableType: "Tipo",
    tableInherentLevel: "Nivel Inherente",
    tableResidualLevel: "Nivel Residual",
    tableStrategy: "Estrategia",
    noRisksFound: "No se encontraron riesgos",
    noRisksInDepartment: "No hay riesgos registrados en este departamento",
    noRisksMatchFilters: "No hay riesgos que coincidan con los filtros",
    
    // AllRisks Page
    allRisksTitle: "Matriz de Riesgos",
    allRisksSubtitle: "Vista centralizada de todos los riesgos de la organización",
    deleteSelected: "Eliminar ({count})",
    searchAllPlaceholder: "Buscar por área, descripción...",
    allDepartments: "Todos los departamentos",
    showingRisks: "Mostrando {count} de {total} riesgos",
    tableDepartment: "Departamento",
    tableThreatType: "Tipo Amenaza",
    tableInherentProb: "Probabilidad",
    tableInherentImp: "Impacto",
    tableInherentLvl: "Nivel",
    tableHandling: "Manejo",
    tableMitigant1: "Mitigante 1",
    tableMitigant2: "Mitigante 2", 
    tableMitigant3: "Mitigante 3",
    tableImpact: "Impacto",
    tableImpact1: "Impacto 1",
    tableImpact2: "Impacto 2", 
    tableImpact3: "Impacto 3",
    tableResidualProb: "Probabilidad",
    tableResidualImp: "Impacto",
    tableResidualLvl: "Nivel",
    
    // Probabilidades e Impactos (enums)
    "Remoto (0-20%)": "Remoto (0-20%)",
    "Improbable (21-40%)": "Improbable (21-40%)",
    "Ocasional (41-60%)": "Ocasional (41-60%)",
    "Probable (61-80%)": "Probable (61-80%)",
    "Frecuente (81-100%)": "Frecuente (81-100%)",
    "Insignificante": "Insignificante",
    "Menor": "Menor",
    "Crítico": "Crítico",
    "Mayor": "Mayor",
    "Catastrófico": "Catastrófico",
  },
  en: {
    // General
    loading: "Loading...",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    view: "View",
    actions: "Actions",
    search: "Search...",
    seeAll: "See all",
    noDescription: "No description",
    confirmDelete: "Are you sure you want to delete {count} risk(s)?",
    errorDeleting: "Error deleting risks.",
    deleting: "Deleting...",
    
    // Risk Levels
    intolerable: "Intolerable",
    high: "High",
    medium: "Medium",
    low: "Low",
    tolerable: "Tolerable",
    unclassified: "Unclassified",

    // Layout & Login
    riskManagement: "Risk Manager",
    professionalManagement: "Professional Management",
    dashboard: "Dashboard",
    departments: "Departments",
    allRisks: "Risk Matrix",
    addRisk: "Add Risk",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",
    logout: "Log Out",
    
    // New Login Translations
    loginWelcomeTitle: "Welcome Back",
    loginWelcomeSubtitle: "Access your risk management system",
    loginHeroSubtitle: "Professional system for comprehensive identification, evaluation, and management of organizational risks",
    loginButton: "Sign In",
    loginButtonLoading: "Signing In...",
    loginDisclaimer: "By logging in, you agree that your data will be kept private and secure",
    
    // Login Features
    loginFeature1Title: "Secure Access",
    loginFeature1Description: "Safe and fast authentication with your Google account",
    loginFeature2Title: "Private Data",
    loginFeature22Description: "Your information is protected with enterprise-grade encryption",
    loginFeature3Title: "Professional Matrix",
    loginFeature3Description: "Advanced tools for comprehensive risk management",

    // Dashboard
    welcome: "Welcome, {name}!",
    dashboardHeaderSubtitle: "Manage your organization's risks professionally.",
    newRisk: "New Risk",
    active: "Active",
    totalRisks: "Total Risks",
    identified: "Identified",
    highRisks: "High Risks",
    immediateAttention: "Immediate attention",
    lowRisks: "Low Risks",
    underControl: "Under control",
    recentDepartments: "Recent Departments",
    noDepartmentsRegistered: "No departments registered.",
    createFirstDepartment: "Create first department",
    riskDistribution: "Risk Distribution",
    noRisksRegistered: "No risks registered.",
    registerFirstRisk: "Register first risk",

    // Departments Page
    departmentsTitle: "Departments",
    departmentsSubtitle: "Manage departments and their associated risks.",
    newDepartment: "New Department",
    totalRisksLabel: "Total Risks",
    highRisksLabel: "High Risks",
    viewRisks: "View Risks",
    noDepartmentsFound: "No departments found",
    noDepartmentsFoundSubtitle: "Start by creating your first department to manage risks.",
    
    // AddDepartment Page
    addDepartmentTitle: "New Department",
    addDepartmentSubtitle: "Create a new department to manage risks.",
    editDepartmentTitle: "Edit Department",
    editDepartmentSubtitle: "Update the department's details.",
    departmentInfo: "Department Information",
    departmentNameLabel: "Department Name *",
    departmentNamePlaceholder: "E.g., Human Resources, IT, Finance...",
    descriptionLabel: "Description (Optional)",
    descriptionPlaceholder: "Describe the main functions of the department...",
    creating: "Creating...",
    createDepartment: "Create Department",
    errorRequiredName: "Department name is required.",
    errorCreatingDepartment: "Error creating department. Please try again.",
    errorUpdatingDepartment: "Error updating department. Please try again.",
    departmentNotFound: "Department not found.",

    // Risk Pages (General)
    riskInfo: "Basic Information",
    departmentLabel: "Department *",
    departmentPlaceholder: "Select department",
    threatTypeLabel: "Threat Type *",
    threatTypePlaceholder: "Select type",
    threatInternal: "Internal",
    threatExternal: "External",
    riskDescriptionLabel: "Risk Description *",
    riskDescriptionPlaceholder: "Describe the risk in detail...",
    inherentRiskEval: "Inherent Risk Assessment",
    inherentProbability: "Inherent Probability",
    inherentImpact: "Inherent Impact",
    selectProbability: "Select probability",
    selectImpact: "Select impact",
    inherentRiskLevel: "Inherent Risk Level:",
    strategyAndMitigation: "Strategy and Mitigation",
    managementStrategy: "Management Strategy",
    selectStrategy: "Select strategy",
    strategyAceptar: "Accept",
    strategyReducir: "Reduce",
    strategyTransferir: "Transfer",
    strategyEvitar: "Avoid",
    mitigationMeasure: "Mitigation Measure {num}",
    mitigationDescription: "Describe measure {num}...",
    mitigationImpact: "Expected impact...",
    selectMitigationImpact: "Select mitigation type...",
    "Mitiga la probabilidad": "Mitigates probability",
    "Mitiga el impacto": "Mitigates impact",
    "Mitiga la probabilidad e impacto": "Mitigates probability and impact",
    residualRisk: "Residual Risk",
    residualProbability: "Residual Probability",
    residualImpact: "Residual Impact",
    residualRiskLevel: "Residual Risk Level:",
    saving: "Saving...",
    saveChanges: "Save Changes",
    registerRisk: "Register Risk",
    errorRequiredFields: "Please complete all required fields (*)",
    errorSavingRisk: "Error saving risk. Please try again.",
    riskNotFound: "Risk not found.",
    dataLoadError: "Could not load necessary data.",

    // AddRisk Page
    addRiskTitle: "Register New Risk",
    addRiskSubtitle: "Document and evaluate an organizational risk.",
    editRiskTitle: "Edit Risk",
    editRiskSubtitle: "Update the details of the risk.",

    // DepartmentRisks Page
    departmentRiskManagement: "Risk management for the department",
    filtersAndSearch: "Filters and Search",
    searchRisksPlaceholder: "Search risks...",
    riskLevelLabel: "Risk level",
    allLevels: "All levels",
    threatTypeLabel: "Threat type",
    allThreats: "All threats",
    riskList: "Risk List ({count})",
    tableDescription: "Description",
    tableType: "Type",
    tableInherentLevel: "Inherent Level",
    tableResidualLevel: "Residual Level",
    tableStrategy: "Strategy",
    noRisksFound: "No risks found",
    noRisksInDepartment: "No risks registered in this department.",
    noRisksMatchFilters: "No risks match the filters.",

    // AllRisks Page
    allRisksTitle: "Risk Matrix",
    allRisksSubtitle: "Centralized view of all organizational risks.",
    deleteSelected: "Delete ({count})",
    searchAllPlaceholder: "Search by area, description...",
    allDepartments: "All departments",
    showingRisks: "Showing {count} of {total} risks",
    tableDepartment: "Department",
    tableThreatType: "Threat Type",
    tableInherentProb: "Probability",
    tableInherentImp: "Impact",
    tableInherentLvl: "Level",
    tableHandling: "Handling",
    tableMitigant1: "Mitigant 1",
    tableMitigant2: "Mitigant 2",
    tableMitigant3: "Mitigant 3", 
    tableImpact: "Impact",
    tableImpact1: "Impact 1",
    tableImpact2: "Impact 2",
    tableImpact3: "Impact 3",
    tableResidualProb: "Probability",
    tableResidualImp: "Impact",
    tableResidualLvl: "Level",
    
    // Probabilities & Impacts (enums)
    "Remoto (0-20%)": "Remote (0-20%)",
    "Improbable (21-40%)": "Unlikely (21-40%)",
    "Ocasional (41-60%)": "Occasional (41-60%)",
    "Probable (61-80%)": "Likely (61-80%)",
    "Frecuente (81-100%)": "Frequent (81-100%)",
    "Insignificante": "Insignificant",
    "Menor": "Minor",
    "Crítico": "Critical",
    "Mayor": "Major",
    "Catastrófico": "Catastrophic",
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('es');

  useEffect(() => {
    const savedLang = localStorage.getItem('app-language') || 'es';
    setLanguage(savedLang);
  }, []);

  const changeLanguage = (lang) => {
    localStorage.setItem('app-language', lang);
    setLanguage(lang);
  };

  const t = (key, replacements = {}) => {
    let text = translations[language][key] || key;
    Object.keys(replacements).forEach(rKey => {
      text = text.replace(`{${rKey}}`, replacements[rKey]);
    });
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
