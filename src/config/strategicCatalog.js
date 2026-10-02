// ============================================================
// Catálogo de la Planeación Estratégica (datos puros, sin React).
// Fuente única para las páginas de la app y para el servidor MCP
// (se copia a supabase/functions/_shared/app con `npm run mcp:sync`).
// Tomado del Excel "Software de Planeación Estratégica v2".
// ============================================================

// ---------- Secciones de plan_answers ----------
export const CUSTOMER_SECTION = "customer";
export const MARKET_SECTION = "market";
export const MKT_CONCL_SECTION = "market-conclusions";
export const OPP_SECTION = "opportunities";
export const OPP_CONCL_SECTION = "opportunity-conclusions";
export const FIN_SECTION = "financial-strategies";
export const RATING_SECTION = "summary-ratings";
export const compSection = (competitorId) => `market-comp:${competitorId}`;

// ---------- Análisis del cliente (9 preguntas abiertas) ----------
export const CUSTOMER_QUESTIONS = [
  {
    key: "dolores",
    q: "¿Qué problemas o dolores de tus clientes resuelve tu producto o servicio?",
    help: "Piensa en lo que le molesta o le complica la vida a tu cliente y que tú le solucionas.",
  },
  {
    key: "deseos",
    q: "¿Qué deseos o sueños de tus clientes atiende tu producto o servicio?",
    help: "Lo que tu cliente quiere lograr o cómo quiere sentirse.",
  },
  {
    key: "metas_funcionales",
    q: "¿Cuáles son las metas funcionales que resuelve tu producto o servicio?",
    help: "Meta funcional = ¿a dónde quiere llegar tu cliente? ¿qué quiere hacer con tu producto?",
  },
  {
    key: "metas_emocionales",
    q: "¿Cuáles son las metas emocionales que quiere resolver tu cliente?",
    help: "Meta emocional = ¿cómo se sentirá cuando cumpla sus metas funcionales?",
  },
  {
    key: "deseos_basicos",
    q: "¿Cuáles son los deseos básicos de tu cliente?",
    help: "Por ejemplo: tranquilidad, seguridad, familia, estatus, ahorrar, crecer, poder.",
  },
  {
    key: "objeciones_exterior",
    q: "¿Qué objeciones tienen tus clientes por cosas de afuera?",
    help: "Aspectos externos: la economía, el gobierno, el mercado, la incertidumbre, etc.",
  },
  {
    key: "objeciones_producto",
    q: "¿Qué objeciones tienen tus clientes con tu producto o servicio?",
    help: "Por ejemplo: el precio, la entrega, el uso, el servicio post-venta.",
  },
  {
    key: "promesa",
    q: "¿Cuál es la promesa de transformación de tu producto o servicio para el cliente?",
    help: "Una buena promesa toca sus dolores, deseos y metas — y le facilita la vida.",
  },
  {
    key: "comunicacion",
    q: "¿Tu forma de comunicarte con tus clientes toma en cuenta todo lo anterior?",
    help: "Revisa si tus mensajes y publicidad reflejan lo que respondiste arriba.",
  },
];

// ---------- Análisis del mercado: preguntas por competidor ----------
export const COMP_GROUPS = [
  {
    title: "Precio",
    questions: [
      { key: "precio", type: "choice", options: ["Mayor", "Menor", "Igual"], q: "¿Su precio es mayor o menor que el tuyo?" },
    ],
  },
  {
    title: "Servicio",
    questions: [
      { key: "servicio", type: "choice", options: ["Mejor", "Peor", "Igual"], q: "¿Su servicio es mejor o peor que el tuyo?" },
      { key: "servicio_detalle", type: "text", q: "¿En qué es mejor o peor?" },
      { key: "encuestas", type: "choice", options: ["Sí", "No"], q: "¿Hace encuestas de satisfacción a sus clientes?" },
      { key: "resenas", type: "choice", options: ["Sí", "No"], q: "¿Recaba reseñas o testimonios de clientes?" },
    ],
  },
  {
    title: "Servicio post-venta",
    questions: [
      { key: "postventa", type: "choice", options: ["Sí", "No"], q: "¿Ofrece algún servicio después de la venta?" },
      { key: "postventa_mejor", type: "choice", options: ["Sí", "No"], q: "¿Su post-venta es mejor que el tuyo?" },
      { key: "postventa_detalle", type: "text", q: "¿En qué es mejor o más deficiente?" },
    ],
  },
  {
    title: "Entrega e imagen",
    questions: [
      { key: "entrega_simple", type: "choice", options: ["Sí", "No"], q: "¿Su proceso de entrega es más simple que el tuyo?" },
      { key: "entrega_comoda", type: "choice", options: ["Sí", "No"], q: "¿Su entrega es más cómoda para el cliente?" },
      { key: "entrega_riesgo", type: "choice", options: ["Sí", "No"], q: "¿El cliente corre algún riesgo con su entrega?" },
      { key: "entrega_riesgo_detalle", type: "text", q: "Si respondiste que sí, ¿cuál es ese riesgo?" },
      { key: "imagen", type: "choice", options: ["Sí", "No"], q: "¿Su imagen de marca es mejor que la tuya?" },
      { key: "rs_comunica", type: "choice", options: ["Sí", "No"], q: "¿Comunica alguna estrategia de respeto al medio ambiente?" },
    ],
  },
  {
    title: "Mercado",
    questions: [
      { key: "mercado", type: "choice", options: ["Más", "Menos", "Igual"], q: "¿Tiene más o menos mercado que tú?" },
      { key: "ventajas", type: "text", q: "¿Cuáles son sus principales ventajas?" },
      { key: "desventajas", type: "text", q: "¿Cuáles son sus principales desventajas?" },
    ],
  },
  {
    title: "Audiencia y publicidad",
    questions: [
      { key: "redes", type: "choice", options: ["Sí", "No"], q: "¿Promueve sus productos en redes sociales?" },
      { key: "redes_cuales", type: "text", q: "¿Qué redes utiliza?" },
      { key: "email_mkt", type: "choice", options: ["Sí", "No"], q: "¿Envía correos de marketing?" },
      { key: "publicidad", type: "choice", options: ["Sí", "No"], q: "¿Paga publicidad?" },
      { key: "testimonios", type: "choice", options: ["Sí", "No"], q: "¿Obtiene reseñas públicas en sus redes?" },
    ],
  },
];

export const ALL_COMP_KEYS = COMP_GROUPS.flatMap((g) => g.questions.map((q) => q.key));

// Preguntas Blue Ocean (globales del mercado).
export const OCEAN_QUESTIONS = [
  { key: "bo_eliminar", label: "Eliminar", q: "¿Qué cosas que ofrece la competencia se pueden eliminar porque el mercado ya no las valora?" },
  { key: "bo_reducir", label: "Reducir", q: "¿Qué cosas se pueden reducir porque el mercado no las valora tanto?" },
  { key: "bo_crear", label: "Crear", q: "¿Qué se podría crear — algo que nadie ofrece — que haría una gran diferencia en el mercado?" },
  { key: "bo_incrementar", label: "Incrementar", q: "¿Qué cosas se pueden incrementar porque el mercado las valora mucho (aunque nadie las ofrezca)?" },
];

// ---------- Conclusiones del mercado (F = mantener, D = cambiar) ----------
export const MKT_CATALOG = [
  {
    category: "Precio",
    items: [{ key: "precio_valor", label: "Incrementar el valor vs el precio" }],
  },
  {
    category: "Servicio",
    items: [
      { key: "servicio_calidad", label: "Mejorar la calidad de servicio" },
      { key: "servicio_encuestas", label: "Implementar encuestas de satisfacción a clientes" },
      { key: "servicio_resenas", label: "Solicitar reseñas y testimonios de clientes" },
    ],
  },
  {
    category: "Servicio post-venta",
    items: [
      { key: "postventa_retencion", label: "Mejorar el servicio post-venta para retener clientes" },
    ],
  },
  {
    category: "Entrega e imagen",
    items: [
      { key: "entrega_simple", label: "Hacer la entrega más simple para el cliente" },
      { key: "entrega_comodo", label: "Hacer la entrega más cómoda para el cliente" },
      { key: "entrega_riesgo", label: "Disminuir el riesgo para el cliente" },
      { key: "entrega_tiempo", label: "Optimizar el tiempo y la forma de entrega" },
      { key: "entrega_imagen", label: "Fortalecer la imagen de la marca" },
    ],
  },
  {
    category: "Responsabilidad social",
    items: [
      { key: "rs_comunicacion", label: "Mejorar la comunicación de responsabilidad social" },
    ],
  },
  {
    category: "Audiencia",
    items: [
      { key: "audiencia_incrementar", label: "Incrementar la audiencia" },
      { key: "audiencia_leads", label: "Incrementar los prospectos (leads)" },
    ],
  },
];

export const ALL_MKT_KEYS = MKT_CATALOG.flatMap((c) => c.items.map((i) => i.key));

// ---------- Análisis de oportunidades (Sí → fortaleza, No → debilidad) ----------
export const OPP_GROUPS = [
  {
    title: "Captación de valor",
    questions: [
      { key: "precios", q: "¿Has incrementado precios en el último año?", strategy: "Incrementar precios" },
      { key: "percepcion", q: "¿Has hecho acciones este año para mejorar cómo perciben tu producto o servicio?", strategy: "Incrementar la percepción de valor" },
      { key: "costos_entrega", q: "¿Has reducido los costos de entrega de tu producto o servicio?", strategy: "Disminuir costos de entrega" },
      { key: "complementarios", q: "¿Ofreces productos o servicios complementarios y tus clientes compran más de uno?", strategy: "Ofrecer productos/servicios complementarios" },
      { key: "plan_b", q: "¿Ofreces una opción de menor costo para no perder al cliente (plan B)?", strategy: "Ofrecer producto/servicio de menor costo (Plan B)" },
      { key: "recompra", q: "¿Más de la mitad de tus clientes te vuelven a comprar?", strategy: "Ofrecer alternativas de recompra a clientes recurrentes" },
    ],
  },
  {
    title: "Confianza y redes",
    questions: [
      { key: "contenido", q: "¿Creas contenido en redes sociales? (publicaciones, newsletters, blogs, podcast)", strategy: "Creación de contenido" },
      { key: "publicidad_masiva", q: "¿Pagas publicidad en prensa o medios masivos?", strategy: "Hacer publicidad en medios masivos" },
      { key: "influencers", q: "¿Pagas publicidad con influencers?", strategy: "Hacer publicidad con influencers" },
    ],
  },
  {
    title: "Audiencia",
    questions: [
      { key: "atraccion", q: "¿Tienes estrategias permanentes para atraer audiencia a tu empresa?", strategy: "Estrategias de atracción de clientes" },
      { key: "conversion", q: "¿Tienes estrategias para convertir tu audiencia en clientes potenciales?", strategy: "Estrategias de conversión" },
    ],
  },
  {
    title: "Palanca: capital financiero",
    questions: [
      { key: "liquidez", q: "¿Tienes liquidez holgada para crecer más de un 20% al año?", strategy: "Mejorar la liquidez" },
      { key: "credito", q: "¿Tienes líneas de crédito disponibles para activos o capital de trabajo?", strategy: "Solicitar o incrementar líneas de crédito" },
      { key: "socios", q: "¿Tienes acceso a socios, accionistas o inversionistas?", strategy: "Atraer socios inversionistas" },
      { key: "family_friends", q: "¿Tienes acceso a préstamos de familiares o amigos?", strategy: "Obtener préstamos 'family and friends'" },
      { key: "ahorros", q: "¿Tienes ahorros para soportar tu crecimiento del próximo año?", strategy: "Generar ahorros para crecimiento e imprevistos" },
      { key: "cartera", q: "¿Tienes una cartera de clientes diversificada?", strategy: "Diversificar la cartera de clientes" },
      { key: "proveeduria", q: "¿Tienes diversificada tu proveeduría?", strategy: "Diversificar el portafolio de proveedores" },
      { key: "reinversion", q: "¿Reinviertes en activos de forma permanente?", strategy: "Realizar inversiones en activos" },
    ],
  },
  {
    title: "Palanca: capital social",
    questions: [
      { key: "alianzas", q: "¿Tienes alianzas con empresas que complementan tus productos o servicios?", strategy: "Generar alianzas con competidores complementarios" },
      { key: "clientes_clave", q: "¿Tienes relaciones sólidas con clientes estratégicos?", strategy: "Generar alianzas con clientes estratégicos" },
      { key: "comunidad", q: "¿Tienes comunidad en redes sociales?", strategy: "Construir comunidad en redes sociales" },
      { key: "socios_estrategicos", q: "¿Tienes relaciones con posibles socios o inversionistas estratégicos?", strategy: "Generar alianzas con socios estratégicos" },
      { key: "proveedores_clave", q: "¿Tienes relaciones sólidas con proveedores estratégicos?", strategy: "Generar alianzas con proveedores estratégicos" },
    ],
  },
  {
    title: "Palanca: capital de conocimiento",
    questions: [
      { key: "info_interna", q: "¿Tienes información interna suficiente para tomar decisiones estratégicas?", strategy: "Generar información interna para decisiones" },
      { key: "info_mercado", q: "¿Tienes información suficiente de tu mercado?", strategy: "Obtener información del mercado" },
      { key: "info_competencia", q: "¿Tienes información suficiente de tu competencia?", strategy: "Obtener información de competidores" },
      { key: "patentes", q: "¿Tienes alguna patente?", strategy: "Tramitar patentes" },
      { key: "software", q: "¿Tienes algún software o aplicación propia?", strategy: "Desarrollar software / tecnología" },
      { key: "ia", q: "¿Usas inteligencia artificial en tu operación?", strategy: "Automatizar procesos con inteligencia artificial" },
    ],
  },
  {
    title: "Palanca: capital humano",
    questions: [
      { key: "talento", q: "¿Tienes un equipo talentoso?", strategy: "Construir un equipo talentoso" },
      { key: "madurez", q: "¿Tienes un equipo maduro?", strategy: "Construir un equipo maduro" },
      { key: "resultados", q: "¿Tu equipo está enfocado a resultados?", strategy: "Trabajar el enfoque a resultados del equipo" },
      { key: "compromiso", q: "¿Tu equipo está comprometido?", strategy: "Trabajar el compromiso del equipo" },
      { key: "formacion", q: "¿Inviertes en la capacitación de tu personal?", strategy: "Invertir en formación" },
      { key: "bienestar", q: "¿Incluyes medidas de bienestar en los indicadores de tus directivos?", strategy: "Adoptar medidas de bienestar para el equipo" },
      { key: "gerencia", q: "¿Tu línea gerencial está enfocada a la estrategia del negocio?", strategy: "Desarrollar un equipo directivo enfocado a la estrategia" },
      { key: "metas", q: "¿Tus metas financieras están alineadas a los indicadores de tu equipo?", strategy: "Sistema de gestión con indicadores de productividad" },
    ],
  },
  {
    title: "Tu producto o servicio",
    questions: [
      { key: "mejora_continua", q: "¿Tienes procesos de mejora continua para la calidad?", strategy: "Desarrollar procesos de mejora continua" },
      { key: "ciclo_comercial", q: "¿Tienes identificado tu ciclo comercial (preventa, venta y posventa)?", strategy: "Desarrollar el ciclo comercial completo" },
    ],
  },
];

export const ALL_OPP_KEYS = OPP_GROUPS.flatMap((g) => g.questions.map((q) => q.key));

// ---------- Estrategias financieras (F = ya lo haces, D = por implementar) ----------
export const FIN_GROUPS = [
  {
    title: "Ventas e ingresos",
    guide: "¿Qué tienes que hacer para crecer más tus ventas?",
    items: [
      { key: "ventas_volumen", label: "Lograr mayor volumen de ventas" },
      { key: "ventas_modelos", label: "Diversificar en nuevos modelos de negocio" },
      { key: "ventas_utilidad_linea", label: "Conocer la utilidad por línea de producto para enfocarte en lo que deja más" },
      { key: "ventas_clientes_rentables", label: "Conocer a tus clientes más rentables para protegerlos y venderles más" },
      { key: "ventas_aperturas", label: "Abrir nuevas sucursales o puntos de venta" },
      { key: "ventas_dependencia", label: "Dejar de depender de uno o pocos clientes" },
      { key: "ventas_area_comercial", label: "Lanzar o crecer el área comercial" },
      { key: "ventas_metricas", label: "Definir métricas de productividad para el área comercial" },
    ],
  },
  {
    title: "Costo de ventas",
    guide: "¿Qué puedes hacer para comprar mejor (más barato y con mejor calidad)?",
    items: [
      { key: "costo_proveedores", label: "Ampliar la base de proveedores para comparar precios" },
      { key: "costo_volumen", label: "Negociar mejores precios por compras de volumen" },
      { key: "costo_mermas", label: "Medir y controlar las mermas" },
      { key: "costo_inventarios", label: "Medir y controlar la rotación de inventarios" },
      { key: "costo_productividad", label: "Definir indicadores de efectividad (menos tiempo, más calidad, menos mermas)" },
    ],
  },
  {
    title: "Gastos operativos",
    guide: "¿Qué gastos puedes reducir o eliminar?",
    items: [
      { key: "gastos_eficientar", label: "Gestionar los gastos que se pueden eliminar o reducir" },
      { key: "gastos_facturas", label: "Supervisar que los gastos estén comprobados con facturas" },
      { key: "gastos_personal_productivo", label: "Que el personal productivo sea más del 70% de tu equipo" },
      { key: "gastos_sueldo_variable", label: "Crecer el sueldo del personal sobre la base variable" },
      { key: "gastos_ahorro_4meses", label: "Generar ahorros para soportar 4 meses de gastos operativos" },
    ],
  },
  {
    title: "Gastos de financiamiento",
    guide: "¿Cómo puedes cuidar el costo de tu dinero?",
    items: [
      { key: "fin_excedentes", label: "Invertir los excedentes de efectivo" },
      { key: "fin_cambiarias", label: "Cuidar las pérdidas cambiarias" },
      { key: "fin_comisiones", label: "Ahorrar en comisiones bancarias" },
    ],
  },
  {
    title: "Impuestos",
    guide: "¿Estás preparado para tus obligaciones fiscales?",
    items: [
      { key: "imp_estrategias", label: "Definir estrategias adecuadas de pago de impuestos" },
      { key: "imp_ahorro_mensual", label: "Generar ahorros mensuales para el pago de impuestos" },
    ],
  },
  {
    title: "Fondo de reserva",
    guide: "¿Tienes un colchón para crecer y reinvertir?",
    items: [
      { key: "reserva_reinversion", label: "Crear un fondo de reserva para reinversión" },
      { key: "reserva_crecimiento", label: "Crear un fondo de reserva para crecimiento" },
    ],
  },
];

export const ALL_FIN_KEYS = FIN_GROUPS.flatMap((g) => g.items.map((i) => i.key));
