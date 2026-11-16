import { createContext, useContext, useEffect, useRef } from "react";
import PropTypes from "prop-types";

// Modo «solo ver»: el usuario puede entrar al módulo pero no editarlo (permiso
// que le dio su empresa). El Layout envuelve cada página con <ReadOnlyZone>:
//
//   · Los controles de captura (campos, listas, casillas) quedan deshabilitados.
//   · Lo marcado con `data-edit` (botones de agregar, borrar, guardar,
//     importar…) y los enlaces a pantallas de alta desaparecen.
//   · Lo marcado con `data-edit-disable` (opciones que muestran la respuesta
//     elegida) se queda visible pero sin poder cambiarse.
//   · Los filtros y buscadores de las pantallas de consulta siguen sirviendo.
//
// La base de datos rechaza cualquier escritura de todos modos; esto es para
// que la persona vea solo lo que sí puede hacer.

const ReadOnlyContext = createContext(false);

// ¿La página actual está en «solo ver»?
export function useReadOnly() {
  return useContext(ReadOnlyContext);
}

// Componentes que solo sirven para editar: no se muestran en «solo ver».
export function hideWhenReadOnly(Component) {
  function EditOnly(props) {
    const readOnly = useReadOnly();
    return readOnly ? null : <Component {...props} />;
  }
  EditOnly.displayName = `EditOnly(${Component.displayName || Component.name || "Component"})`;
  return EditOnly;
}

const CAPTURE_CONTROLS =
  'input, textarea, select, button[role="combobox"], button[role="checkbox"], button[role="switch"], button[role="radio"], [data-edit-disable]';

export const READ_ONLY_CSS = `
  .readonly-module [data-edit],
  .readonly-module a[href="/addrisk"],
  .readonly-module a[href^="/addrisk?department"],
  .readonly-module a[href^="/addrisk?perspective"],
  .readonly-module a[href^="/adddepartment"],
  .readonly-module a[href^="/perspectivemigration"] { display: none !important; }
  .readonly-module [data-edit-disable] { cursor: default; }
  .readonly-module input:disabled,
  .readonly-module textarea:disabled,
  .readonly-module select:disabled { opacity: 1; cursor: default; }
`;

export function ReadOnlyZone({ active, keepInputs = false, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!active || keepInputs || !root) return undefined;
    const lock = () => {
      root.querySelectorAll(CAPTURE_CONTROLS).forEach((el) => {
        if (!el.disabled && !el.closest("[data-view-control]")) el.disabled = true;
      });
    };
    lock();
    // Las páginas pintan sus campos al cargar los datos y React puede volver a
    // habilitarlos (p. ej. al terminar un guardado): se vuelve a bloquear.
    const observer = new MutationObserver(lock);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    return () => observer.disconnect();
  }, [active, keepInputs]);

  return (
    <ReadOnlyContext.Provider value={!!active}>
      <div ref={ref} className={active ? "readonly-module" : undefined}>
        {children}
      </div>
    </ReadOnlyContext.Provider>
  );
}
ReadOnlyZone.propTypes = {
  active: PropTypes.bool,
  // Pantallas de consulta: sus campos son filtros y buscadores, no captura.
  keepInputs: PropTypes.bool,
  children: PropTypes.node,
};
