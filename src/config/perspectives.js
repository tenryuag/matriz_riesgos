// ============================================================
// Catálogo de PERSPECTIVAS (modelo Balanced Scorecard).
// Es el mismo eje para los tres módulos: la Matriz de Riesgos se
// organiza por perspectiva (en lugar de departamentos inventados por el
// usuario), el mapa estratégico las usa como carriles y el módulo
// financiero las usará para leer riesgos por perspectiva.
//
// Módulo PURO: sin React, sin alias "@/", imports relativos con .js.
// Se copia al servidor MCP con `npm run mcp:sync`.
//
// Las claves (key) son las mismas que los carriles LANES del mapa
// estratégico y las que guarda strategicCalc.perspectiveFor; NO cambiarlas.
// Las clases Tailwind (colorClasses) son las que ya usaba el mapa:
// financiera dorado (accent) · cliente rosa · competitiva azul · equipo verde.
// Los iconos de lucide son componentes React, por eso aquí solo va el
// nombre (iconName) y la pantalla resuelve el componente.
// ============================================================

export const PERSPECTIVES = [
  {
    key: "financiera",
    label: "Finanzas",
    lane: "financiera",
    iconName: "Banknote",
    short: "Lo que puede pegarle directo a tu dinero.",
    help:
      "Todo lo que puede pegarle directo a tu dinero: que no te paguen a tiempo, " +
      "quedarte sin efectivo para la nómina, que suba el dólar, una multa del SAT. " +
      "Pregúntate: ¿qué podría dejarme sin caja o comerme la utilidad?",
    examples: [
      {
        description: "Un cliente grande se atrasa en sus pagos y la cartera vencida crece.",
        threat_type: "Externa",
      },
      {
        description: "Debo en dólares pero vendo en pesos: si sube el dólar, la deuda se encarece.",
        threat_type: "Externa",
      },
      {
        description: "Toda la operación depende de un solo banco (cuentas, crédito y nómina).",
        threat_type: "Interna",
      },
    ],
    // Conceptos del Análisis Financiero que este tipo de riesgo suele mover.
    // Balance: caja, clientes, otras_cxc, bancario_cp, porcion_circulante_lp,
    // bancario_lp, impuestos_pagar · Estado de resultados: gastos_financieros,
    // utilidad_cambiaria, isr, ptu · Gastos: seguros.
    finConcepts: [
      "caja",
      "clientes",
      "otras_cxc",
      "bancario_cp",
      "porcion_circulante_lp",
      "bancario_lp",
      "impuestos_pagar",
      "gastos_financieros",
      "utilidad_cambiaria",
      "isr",
      "ptu",
      "seguros",
    ],
    colorClasses: {
      label: "bg-accent/20 text-accent border-accent/40",
      bubble: "bg-accent/15 border-accent/45 hover:border-accent",
      text: "text-accent",
      bg: "bg-accent/15",
      border: "border-accent/40",
    },
  },
  {
    key: "cliente",
    label: "Clientes",
    lane: "cliente",
    iconName: "Users",
    short: "Lo que puede hacer que vendas menos o pierdas clientes.",
    help:
      "Lo que puede hacer que vendas menos o pierdas clientes: depender de uno o dos " +
      "grandes, quejas sin atender, un competidor que baja precios, mala imagen. " +
      "Pregúntate: ¿qué haría que mis clientes dejen de comprarme?",
    examples: [
      {
        description: "El cliente que concentra el 40% de las ventas se va con la competencia.",
        threat_type: "Externa",
      },
      {
        description: "La demanda cae en temporada baja y las ventas no alcanzan para los gastos fijos.",
        threat_type: "Externa",
      },
      {
        description: "Reseñas negativas y quejas sin respuesta dañan la imagen del negocio.",
        threat_type: "Interna",
      },
    ],
    // "sales" es la sección completa de ventas (una clave por línea de negocio).
    // Balance: clientes, anticipos · Gastos: marketing, representacion, logistica.
    finConcepts: ["sales", "clientes", "anticipos", "marketing", "representacion", "logistica"],
    colorClasses: {
      label: "bg-rose-500/20 text-rose-500 border-rose-500/40",
      bubble: "bg-rose-500/15 border-rose-500/45 hover:border-rose-500",
      text: "text-rose-500",
      bg: "bg-rose-500/15",
      border: "border-rose-500/40",
    },
  },
  {
    key: "competitiva",
    label: "Procesos y competitividad",
    lane: "competitiva",
    iconName: "Rocket",
    short: "Cómo haces las cosas por dentro y qué te hace mejor o peor que la competencia.",
    help:
      "Cómo haces las cosas por dentro y lo que te hace mejor o peor que la competencia: " +
      "proveedores, maquinaria, sistemas, inventarios, permisos. " +
      "Pregúntate: ¿qué podría detener, retrasar o encarecer mi operación?",
    examples: [
      {
        description: "Dependo de un solo proveedor: si falla, me quedo sin materia prima.",
        threat_type: "Externa",
      },
      {
        description: "Se descompone una máquina clave y no hay refacciones ni plan B.",
        threat_type: "Interna",
      },
      {
        description: "Un ciberataque o un virus deja al negocio sin acceso al sistema y a su información.",
        threat_type: "Externa",
      },
    ],
    // Costo de ventas: materia_prima, indirectos, fletes, subcontratados ·
    // Balance: inventarios, proveedores, activos_fijos · Gastos: tecnologia,
    // mantenimiento, suministros, innovacion, logistica.
    finConcepts: [
      "materia_prima",
      "indirectos",
      "fletes",
      "subcontratados",
      "inventarios",
      "proveedores",
      "activos_fijos",
      "tecnologia",
      "mantenimiento",
      "suministros",
      "innovacion",
      "logistica",
    ],
    colorClasses: {
      label: "bg-blue-500/20 text-blue-500 border-blue-500/40",
      bubble: "bg-blue-500/15 border-blue-500/45 hover:border-blue-500",
      text: "text-blue-500",
      bg: "bg-blue-500/15",
      border: "border-blue-500/40",
    },
  },
  {
    key: "equipo",
    label: "Equipo y talento",
    lane: "equipo",
    iconName: "HeartHandshake",
    short: "Tu gente: quién sabe hacer qué, y qué pasa si falta.",
    help:
      "Tu gente: que se vaya alguien clave y nadie sepa hacer su trabajo, falta de " +
      "capacitación, rotación alta, conflictos laborales. " +
      "Pregúntate: ¿qué pasa si mañana falta alguien?",
    examples: [
      {
        description: "La única persona que conoce el sistema renuncia y nadie más sabe operarlo.",
        threat_type: "Interna",
      },
      {
        description: "Un exempleado presenta una demanda laboral.",
        threat_type: "Externa",
      },
      {
        description: "El contador se va y no hay quien lo reemplace ni quien sepa dónde está todo.",
        threat_type: "Interna",
      },
    ],
    // Costo de ventas: mano_obra · Gastos: sueldos, prestaciones, bonos,
    // honorarios, capacitacion, outsourcing, legales · Balance: provisiones,
    // gastos_acumulados.
    finConcepts: [
      "mano_obra",
      "sueldos",
      "prestaciones",
      "bonos",
      "honorarios",
      "capacitacion",
      "outsourcing",
      "legales",
      "provisiones",
      "gastos_acumulados",
    ],
    colorClasses: {
      label: "bg-green-500/20 text-green-600 dark:text-green-500 border-green-500/40",
      bubble: "bg-green-500/15 border-green-500/45 hover:border-green-500",
      text: "text-green-600 dark:text-green-500",
      bg: "bg-green-500/15",
      border: "border-green-500/40",
    },
  },
];

// Claves en orden Balanced Scorecard (lo financiero arriba, el equipo abajo).
export const PERSPECTIVE_KEYS = PERSPECTIVES.map((p) => p.key);

// Acceso directo por clave: PERSPECTIVE_BY_KEY.cliente.label → "Clientes".
export const PERSPECTIVE_BY_KEY = Object.fromEntries(PERSPECTIVES.map((p) => [p.key, p]));

export const isPerspectiveKey = (k) =>
  typeof k === "string" && Object.prototype.hasOwnProperty.call(PERSPECTIVE_BY_KEY, k);

// Carriles del mapa estratégico, derivados del catálogo. Misma forma que
// usaba StrategicMap (key, title, desc, label, bubble) salvo el icono: aquí
// va iconName (string) y la pantalla lo cambia por el componente de lucide.
export const LANES = PERSPECTIVES.map((p) => ({
  key: p.key,
  title: p.label,
  desc: p.short,
  iconName: p.iconName,
  label: p.colorClasses.label,
  bubble: p.colorClasses.bubble,
}));

// ---------- Sugerencia de perspectiva para un departamento ----------
// Heurística por palabras clave para el asistente de migración (Fase 1):
// propone a qué perspectiva se parece más un departamento por su nombre.
// Devuelve la clave o null si no hay coincidencia (el usuario decide).

// Quita acentos y pasa a minúsculas: "Atención a Clientes" → "atencion a clientes".
const normalizeText = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Cada entrada: { key, stems, words }. `stems` se comparan por prefijo de
// palabra (venta → ventas); `words` deben coincidir completas (ti, rh) o,
// si llevan espacio, aparecer como frase dentro del nombre.
// El orden importa: se devuelve la primera perspectiva que coincide.
const DEPARTMENT_HINTS = [
  {
    key: "cliente",
    stems: ["venta", "vende", "comercial", "marketing", "mercadotec", "atencion", "cliente", "publicidad"],
    words: ["servicio al cliente", "servicio a clientes", "post venta", "postventa", "crm"],
  },
  {
    key: "financiera",
    stems: ["finanz", "financ", "contab", "contad", "tesorer", "cobranz", "credito", "fiscal", "impuesto"],
    words: ["cuentas por cobrar", "cuentas por pagar", "caja"],
  },
  {
    key: "competitiva",
    stems: [
      "operac", "operativ", "produc", "manufactur", "planta", "tecnolog", "sistema", "informatic",
      "calidad", "compra", "abastec", "logist", "almacen", "inventario", "mantenim", "legal",
      "juridic", "ingenier", "proyecto", "desarrollo",
    ],
    words: ["ti", "it", "tics", "tic"],
  },
  {
    key: "equipo",
    stems: ["talento", "nomina", "capacitac", "reclutam", "personal"],
    words: ["rh", "rrhh", "recursos humanos", "capital humano", "gente", "cultura"],
  },
];

export function suggestPerspectiveForDepartment(name) {
  const text = normalizeText(name);
  if (!text) return null;
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  for (const hint of DEPARTMENT_HINTS) {
    const byStem = hint.stems.some((stem) => tokens.some((tk) => tk.startsWith(stem)));
    const byWord = hint.words.some((w) =>
      w.includes(" ") ? text.includes(w) : tokens.includes(w)
    );
    if (byStem || byWord) return hint.key;
  }
  return null;
}
