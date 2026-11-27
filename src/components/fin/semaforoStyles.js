// Colores y etiquetas del semáforo de las razones financieras. Los colores
// van en pares claro/oscuro para que funcionen en ambos temas. Viven aparte
// de los componentes para que otras pantallas los usen sin importar el punto
// ni la etiqueta.
export const STATUS_STYLES = {
  verde: { dot: "bg-green-500", text: "text-green-600 dark:text-green-500", label: "Sano" },
  ambar: { dot: "bg-amber-400", text: "text-amber-600 dark:text-amber-400", label: "Vigilar" },
  rojo: { dot: "bg-red-500", text: "text-red-500", label: "Atender" },
  na: { dot: "bg-muted-foreground/40", text: "text-muted", label: "No aplica" },
};

// Normaliza el estatus a una clave de STATUS_STYLES (null → 'na').
export function statusKey(status) {
  return status ?? "na";
}
