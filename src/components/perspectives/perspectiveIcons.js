// ============================================================
// Iconos de las 4 perspectivas (lucide-react 0.475.0).
// El catálogo (src/config/perspectives.js, puro y sincronizado al MCP) solo
// guarda el nombre del icono (iconName); aquí se resuelve el componente.
// ============================================================
import { Banknote, Users, Rocket, HeartHandshake, Layers } from "lucide-react";
import { PERSPECTIVE_BY_KEY } from "@/config/perspectives";

export const PERSPECTIVE_ICONS = { Banknote, Users, Rocket, HeartHandshake };

// Clave desconocida o sin icono → Layers (genérico).
export function iconForPerspective(key) {
  const name = PERSPECTIVE_BY_KEY[key]?.iconName;
  return PERSPECTIVE_ICONS[name] || Layers;
}
