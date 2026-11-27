// Estilos y textos compartidos de las pantallas del Mapa de dependencia.

export const FIELD_CLASS =
  "w-full p-2.5 rounded-xl glass text-sm text-foreground placeholder:text-muted/60 outline-none focus:border-accent";

// Un color por clasificación (chip de la bitácora y barras de la línea base).
export const CATEGORY_STYLES = {
  direccion: {
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
    bar: "bg-amber-500",
  },
  gestion: {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40",
    bar: "bg-sky-500",
  },
  supervision: {
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    bar: "bg-emerald-500",
  },
  operacion: {
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
    bar: "bg-slate-500",
  },
};

// Nombre con el que se muestra una medición en listas y encabezados.
export function measurementLabel(m, index = 0) {
  if (!m) return "";
  const title = (m.title || "").trim() || `Medición ${index + 1}`;
  const person = (m.person_name || "").trim();
  return person ? `${title} · ${person}` : title;
}
