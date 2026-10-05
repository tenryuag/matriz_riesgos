// El acceso por módulo ahora vive en un contexto que se carga una sola vez a
// nivel raíz y se comparte con toda la app (ver ModuleAccessContext). Este
// archivo se mantiene para no romper los imports existentes.
export { useModuleAccess } from "@/components/ModuleAccessContext";
