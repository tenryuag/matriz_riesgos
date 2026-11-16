import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "@/api/supabaseClient";
import { ModuleAccess, Company } from "@/api/entities";

// Contexto de acceso por módulo.
//
// El acceso (rol admin + módulos concedidos) se carga UNA sola vez a nivel
// raíz y se comparte con toda la app. Así el selector de módulos y la guardia
// de rutas leen exactamente el mismo dato: antes cada uno lo cargaba por su
// cuenta y, al navegar, se volvía a consultar, provocando que a veces el
// selector mostrara un módulo que la guardia luego negaba.
//
// El rol se lee de getSession() (JWT local, sin red) — la misma fuente que
// usa el RLS.

const EMPTY = {
  user: null,
  isAdmin: false,
  grantedModules: [],
  company: null, // { id, name } de la empresa del usuario
  companyRole: null, // 'admin' | 'member' dentro de su empresa
  moduleLevels: {}, // { risk: 'edit', strategic: 'view' }
  hasCompanies: false, // la base ya trabaja por empresas
};

const ModuleAccessContext = createContext({
  ...EMPTY,
  loading: true,
  refresh: () => {},
  canEditModule: () => true,
});

export function ModuleAccessProvider({ children }) {
  const [state, setState] = useState({ ...EMPTY, loading: true });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      const user = session?.user || null;
      // El rol vive en app_metadata (solo el servidor lo escribe); user_metadata
      // lo edita el propio usuario y no sirve para seguridad.
      const admin = user?.app_metadata?.role === "admin";

      // Empresa, papel dentro de ella y módulos con su nivel (ver / editar).
      // Si la base aún no tiene empresas, se usa el acceso por usuario.
      let modules = [];
      let company = null;
      let companyRole = null;
      let moduleLevels = {};
      let hasCompanies = false;
      if (session) {
        try {
          const access = await Company.myAccess();
          hasCompanies = true;
          company = access?.company || null;
          companyRole = access?.role || null;
          moduleLevels = access?.modules || {};
          modules = Object.keys(moduleLevels);
        } catch {
          if (!admin) {
            try {
              modules = await ModuleAccess.myModules();
              moduleLevels = Object.fromEntries(modules.map((k) => [k, "edit"]));
            } catch (err) {
              console.error("Error al cargar módulos concedidos:", err);
            }
          }
        }
      }
      setState({
        user,
        isAdmin: admin,
        grantedModules: modules,
        company,
        companyRole,
        moduleLevels,
        hasCompanies,
        loading: false,
      });
    } catch (error) {
      console.error("Error al cargar acceso por módulo:", error);
      setState({ ...EMPTY, loading: false });
    }
  }, []);

  useEffect(() => {
    load();
    // Recarga cuando el usuario inicia o cierra sesión (no en cada navegación).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        load();
      }
    });
    return () => sub?.subscription?.unsubscribe();
  }, [load]);

  // ¿Puede editar en este módulo? Los administradores de la plataforma, sí;
  // los demás, según el nivel que les dio su empresa.
  const canEditModule = useCallback(
    (moduleKey) => state.isAdmin || state.moduleLevels[moduleKey] !== "view",
    [state.isAdmin, state.moduleLevels],
  );

  return (
    <ModuleAccessContext.Provider value={{ ...state, refresh: load, canEditModule }}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

// Hook para leer el acceso por módulo desde cualquier componente.
export function useModuleAccess() {
  return useContext(ModuleAccessContext);
}
