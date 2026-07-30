import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { ModuleAccess } from "@/api/entities";

// Carga el rol (admin) y los módulos concedidos al usuario actual.
// Se usa para decidir qué módulos mostrar en el selector y para proteger
// el acceso a las páginas de cada módulo.
//
// El rol se lee de la sesión LOCAL (getSession), no de getUser(): getUser hace
// una llamada de red que se valida contra el servidor y puede fallar por rate
// limit si se llama varias veces; ese fallo, con nuestro manejo endurecido,
// terminaba marcando al admin como "no autenticado" y cerrando la sesión.
// getSession lee el JWT ya guardado en el navegador, sin red, y es la misma
// fuente que usa el RLS (auth.jwt() -> user_metadata -> role).
export function useModuleAccess() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [grantedModules, setGrantedModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const meta = data?.session?.user?.user_metadata || {};
        const admin = meta.role === "admin";

        // Los admins ven todo; evitamos consultar la tabla de accesos.
        let modules = [];
        if (!admin && data?.session) {
          try {
            modules = await ModuleAccess.myModules();
          } catch (err) {
            // Si la tabla aún no existe o falla la consulta, no bloqueamos por un
            // error de carga: simplemente sin módulos concedidos.
            console.error("Error al cargar módulos concedidos:", err);
            modules = [];
          }
        }

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
