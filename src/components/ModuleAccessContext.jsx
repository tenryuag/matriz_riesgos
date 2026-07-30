import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "@/api/supabaseClient";
import { ModuleAccess } from "@/api/entities";

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

const ModuleAccessContext = createContext({
  user: null,
  isAdmin: false,
  grantedModules: [],
  loading: true,
  refresh: () => {},
});

export function ModuleAccessProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    isAdmin: false,
    grantedModules: [],
    loading: true,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      const user = session?.user || null;
      const meta = user?.user_metadata || {};
      const admin = meta.role === "admin";

      let modules = [];
      if (session && !admin) {
        try {
          modules = await ModuleAccess.myModules();
        } catch (err) {
          console.error("Error al cargar módulos concedidos:", err);
          modules = [];
        }
      }
      setState({ user, isAdmin: admin, grantedModules: modules, loading: false });
    } catch (error) {
      console.error("Error al cargar acceso por módulo:", error);
      setState({ user: null, isAdmin: false, grantedModules: [], loading: false });
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

  return (
    <ModuleAccessContext.Provider value={{ ...state, refresh: load }}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

// Hook para leer el acceso por módulo desde cualquier componente.
export function useModuleAccess() {
  return useContext(ModuleAccessContext);
}
