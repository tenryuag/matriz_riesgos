import { useState, useEffect } from "react";
import { User, ModuleAccess } from "@/api/entities";

// Carga el rol (admin) y los módulos concedidos al usuario actual.
// Se usa para decidir qué módulos mostrar en el selector y para proteger
// el acceso a las páginas de cada módulo.
export function useModuleAccess() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [grantedModules, setGrantedModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const currentUser = await User.me();
        const role =
          currentUser?.user_metadata?.role ||
          currentUser?.raw_user_meta_data?.role ||
          "user";
        const admin = role === "admin";

        // Los admins ven todo; evitamos una consulta innecesaria.
        const modules = admin ? [] : await ModuleAccess.myModules();

        if (active) {
          setIsAdmin(admin);
          setGrantedModules(modules);
        }
      } catch (error) {
        console.error("Error al cargar acceso por módulo:", error);
        if (active) {
          setIsAdmin(false);
          setGrantedModules([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { isAdmin, grantedModules, loading };
}
