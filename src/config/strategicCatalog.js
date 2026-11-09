// ============================================================
// Catálogo de la Planeación Estratégica (datos puros, sin React).
// Fuente única para las páginas de la app y para el servidor MCP
// (se copia a supabase/functions/_shared/app con `npm run mcp:sync`).
// Tomado del Excel "Software de Planeación Estratégica v2" y de su revisión
// "v2_FODA" (sep-2026): redacción del FODA, diagnóstico externo y situaciones
// financieras.
// ============================================================

// ---------- Secciones de plan_answers ----------
export const CUSTOMER_SECTION = "customer";
export const MARKET_SECTION = "market";
export const MKT_CONCL_SECTION = "market-conclusions";
export const OPP_SECTION = "opportunities";
export const OPP_CONCL_SECTION = "opportunity-conclusions";
export const FIN_SECTION = "financial-strategies";
export const FIN_SIT_SECTION = "financial-situations";
export const EXT_SECTION = "external-diagnosis";
export const RATING_SECTION = "summary-ratings";
export const compSection = (competitorId) => `market-comp:${competitorId}`;

// Secciones de catálogo que alimentan el motor (collectStrategies y
// buildFoda). Quien las consulta agrega además MARKET_SECTION (Blue Ocean),
// RATING_SECTION y las secciones de cada competidor (compSection).
export const PLAN_SOURCE_SECTIONS = [
  MKT_CONCL_SECTION,
  OPP_SECTION,
  OPP_CONCL_SECTION,
  FIN_SECTION,
  FIN_SIT_SECTION,
  EXT_SECTION,
];

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
// `label` es la estrategia (lo que se decide y se prioriza); `foda` es la
// redacción que aparece en el FODA según el lado en que quede: F (fortaleza)
// o D (debilidad). Redacciones de Mara (Excel v2_FODA, sep-2026); la del
// lado contrario se redactó en el mismo estilo para que ningún caso quede
// sin texto.
export const MKT_CATALOG = [
  {
    category: "Precio",
    items: [
      {
        key: "precio_valor",
        label: "Incrementar el valor vs el precio",
        foda: {
          F: "La relación valor-precio de la empresa es competitiva",
          D: "La relación valor-precio de la empresa requiere fortalecerse",
        },
      },
    ],
  },
  {
    category: "Servicio",
    items: [
      {
        key: "servicio_calidad",
        label: "Mejorar la calidad de servicio",
        foda: {
          F: "La calidad del servicio de la empresa cumple o supera el nivel esperado por el cliente",
          D: "La calidad del servicio de la empresa es inferior al nivel esperado por el cliente",
        },
      },
      {
        key: "servicio_encuestas",
        label: "Implementar encuestas de satisfacción a clientes",
        foda: {
          F: "La empresa mide sistemáticamente la satisfacción de sus clientes",
          D: "La empresa no mide sistemáticamente la satisfacción de sus clientes",
        },
      },
      {
        key: "servicio_resenas",
        label: "Solicitar reseñas y testimonios de clientes",
        foda: {
          F: "La empresa cuenta con un sistema para obtener reseñas y testimonios de sus clientes",
          D: "La empresa no cuenta con un sistema para obtener reseñas o testimonios de sus clientes",
        },
      },
    ],
  },
  {
    category: "Servicio post-venta",
    items: [
      {
        key: "postventa_retencion",
        label: "Mejorar el servicio post-venta para retener clientes",
        foda: {
          F: "La empresa cuenta con una estrategia de servicio postventa que le ayuda a retener clientes",
          D: "La empresa no cuenta con una estrategia suficiente de servicio postventa para retener clientes",
        },
      },
    ],
  },
  {
    category: "Entrega e imagen",
    items: [
      {
        key: "entrega_simple",
        label: "Hacer la entrega más simple para el cliente",
        foda: {
          F: "La empresa ofrece un proceso de compra o entrega más simple para el cliente",
          D: "El proceso de compra o entrega de la empresa es más complicado de lo que el cliente espera",
        },
      },
      {
        key: "entrega_comodo",
        label: "Hacer la entrega más cómoda para el cliente",
        foda: {
          F: "La empresa ofrece un proceso más cómodo para el cliente",
          D: "El proceso de compra o entrega de la empresa resulta poco cómodo para el cliente",
        },
      },
      {
        key: "entrega_riesgo",
        label: "Disminuir el riesgo para el cliente",
        foda: {
          F: "La empresa ofrece condiciones que reducen el riesgo percibido por el cliente",
          D: "El cliente percibe riesgos al comprar o recibir el producto o servicio de la empresa",
        },
      },
      {
        key: "entrega_tiempo",
        label: "Optimizar el tiempo y la forma de entrega",
        foda: {
          F: "La empresa tiene una ventaja en tiempo o condiciones de entrega",
          D: "La empresa no tiene una ventaja en tiempo ni en condiciones de entrega",
        },
      },
      {
        key: "entrega_imagen",
        label: "Fortalecer la imagen de la marca",
        foda: {
          F: "La empresa cuenta con una imagen de marca sólida",
          D: "La imagen de marca de la empresa requiere fortalecimiento",
        },
      },
    ],
  },
  {
    category: "Responsabilidad social",
    items: [
      {
        key: "rs_comunicacion",
        label: "Mejorar la comunicación de responsabilidad social",
        foda: {
          F: "La empresa comunica sus acciones de responsabilidad social",
          D: "La empresa comunica de forma insuficiente sus acciones de responsabilidad social",
        },
      },
    ],
  },
  {
    category: "Audiencia",
    items: [
      {
        key: "audiencia_incrementar",
        label: "Incrementar la audiencia",
        foda: {
          F: "La empresa cuenta con una audiencia suficiente para alcanzar sus objetivos comerciales",
          D: "La empresa tiene una audiencia insuficiente para alcanzar sus objetivos comerciales",
        },
      },
      {
        key: "audiencia_leads",
        label: "Incrementar los prospectos (leads)",
        foda: {
          F: "La empresa genera un volumen suficiente de leads para alcanzar sus objetivos comerciales",
          D: "La empresa genera un volumen insuficiente de leads para alcanzar sus objetivos comerciales",
        },
      },
    ],
  },
];

// ---------- Competidores → Oportunidades y Amenazas del FODA ----------
// Regla del Excel (Conclusiones del mercado): competencia mejor que la
// empresa = Amenaza; competencia peor que la empresa = Oportunidad. Cada
// regla mira UNA respuesta de la comparación por competidor; en el FODA se
// junta una sola línea por regla con los nombres de los competidores que la
// cumplen. Redacciones de Mara para el lado que trae el Excel; el contrario
// en el mismo estilo.
export const COMP_FODA_RULES = [
  { key: "precio", value: "Mayor", type: "O", text: "La competencia tiene un precio superior al de la empresa" },
  { key: "precio", value: "Menor", type: "A", text: "La competencia tiene un precio inferior al de la empresa" },
  { key: "servicio", value: "Mejor", type: "A", text: "La competencia ofrece una calidad de servicio superior" },
  { key: "servicio", value: "Peor", type: "O", text: "La competencia ofrece una calidad de servicio inferior a la de la empresa" },
  { key: "encuestas", value: "Sí", type: "A", text: "La competencia mide sistemáticamente la satisfacción de sus clientes" },
  { key: "encuestas", value: "No", type: "O", text: "La competencia no mide la satisfacción de sus clientes" },
  { key: "resenas", value: "Sí", type: "A", text: "La competencia cuenta con mayor evidencia social proveniente de sus clientes" },
  { key: "resenas", value: "No", type: "O", text: "La competencia no recaba reseñas ni testimonios de sus clientes" },
  { key: "postventa", value: "No", type: "O", text: "La competencia no ofrece servicio después de la venta" },
  { key: "postventa_mejor", value: "Sí", type: "A", text: "La competencia ofrece un servicio postventa superior" },
  { key: "postventa_mejor", value: "No", type: "O", text: "La competencia no ofrece un servicio postventa superior al de la empresa" },
  { key: "entrega_simple", value: "Sí", type: "A", text: "La competencia ofrece un proceso de compra o entrega más simple para el cliente" },
  { key: "entrega_simple", value: "No", type: "O", text: "La competencia no ofrece un proceso de compra o entrega más simple que el de la empresa" },
  { key: "entrega_comoda", value: "Sí", type: "A", text: "La competencia ofrece un proceso más cómodo para el cliente" },
  { key: "entrega_comoda", value: "No", type: "O", text: "La competencia no ofrece un proceso más cómodo que el de la empresa" },
  { key: "entrega_riesgo", value: "No", type: "A", text: "La competencia ofrece condiciones que reducen el riesgo percibido por el cliente" },
  { key: "entrega_riesgo", value: "Sí", type: "O", text: "Los clientes corren riesgos con la entrega de la competencia" },
  { key: "imagen", value: "Sí", type: "A", text: "La competencia tiene una imagen de marca superior" },
  { key: "imagen", value: "No", type: "O", text: "La competencia no tiene una imagen de marca superior a la de la empresa" },
  { key: "rs_comunica", value: "Sí", type: "A", text: "La competencia utiliza la responsabilidad social como elemento de diferenciación" },
  { key: "rs_comunica", value: "No", type: "O", text: "La competencia no comunica acciones de responsabilidad social" },
  { key: "mercado", value: "Más", type: "A", text: "La competencia tiene una participación de mercado mayor que la de la empresa" },
  { key: "mercado", value: "Menos", type: "O", text: "La competencia tiene una participación de mercado menor que la de la empresa" },
  { key: "redes", value: "Sí", type: "A", text: "La competencia tiene presencia activa en redes sociales" },
  { key: "redes", value: "No", type: "O", text: "La competencia no tiene presencia activa en redes sociales" },
  { key: "email_mkt", value: "Sí", type: "A", text: "La competencia hace marketing por correo electrónico" },
  { key: "email_mkt", value: "No", type: "O", text: "La competencia no hace marketing por correo electrónico" },
  { key: "publicidad", value: "Sí", type: "A", text: "La competencia invierte en publicidad pagada" },
  { key: "publicidad", value: "No", type: "O", text: "La competencia no invierte en publicidad pagada" },
  { key: "testimonios", value: "Sí", type: "A", text: "La competencia obtiene reseñas públicas en sus redes sociales" },
  { key: "testimonios", value: "No", type: "O", text: "La competencia no obtiene reseñas públicas en sus redes sociales" },
];

export const ALL_MKT_KEYS = MKT_CATALOG.flatMap((c) => c.items.map((i) => i.key));

// ---------- Análisis de oportunidades (Sí → fortaleza, No → debilidad) ----------
// `strategy` es lo que se prioriza; `foda` la redacción del FODA según el
// lado (F / D). `foda: null` = no aplica al FODA (regla de Mara: patentes y
// software); la estrategia sigue existiendo en el resumen. `situations`
// enlaza la palanca con situaciones financieras equivalentes: si alguna está
// marcada, en el FODA manda la situación y la palanca no se repite.
export const OPP_GROUPS = [
  {
    title: "Captación de valor",
    questions: [
      { key: "precios", q: "¿Has incrementado precios en el último año?", strategy: "Incrementar precios",
        foda: { F: "La empresa tiene capacidad de incrementar sus precios", D: "La empresa no ha logrado incrementar sus precios en el último año" } },
      { key: "percepcion", q: "¿Has hecho acciones este año para mejorar cómo perciben tu producto o servicio?", strategy: "Incrementar la percepción de valor",
        foda: { F: "La empresa realiza acciones para incrementar la percepción de valor de su oferta", D: "La empresa no realiza acciones para incrementar la percepción de valor de su oferta" } },
      { key: "costos_entrega", q: "¿Has reducido los costos de entrega de tu producto o servicio?", strategy: "Disminuir costos de entrega",
        foda: { F: "La empresa ha logrado reducir sus costos de entrega", D: "La empresa no ha logrado reducir sus costos de entrega" } },
      { key: "complementarios", q: "¿Ofreces productos o servicios complementarios y tus clientes compran más de uno?", strategy: "Ofrecer productos/servicios complementarios",
        foda: { F: "La empresa cuenta con una oferta complementaria que incrementa el valor por cliente", D: "La empresa no cuenta con una oferta complementaria suficiente para incrementar el valor por cliente" } },
      { key: "plan_b", q: "¿Ofreces una opción de menor costo para no perder al cliente (plan B)?", strategy: "Ofrecer producto/servicio de menor costo (Plan B)",
        foda: { F: "La empresa cuenta con una alternativa de menor costo para retener clientes que no pueden adquirir su oferta principal", D: "La empresa no cuenta con una alternativa de menor costo para retener clientes que no pueden adquirir su oferta principal" } },
      { key: "recompra", q: "¿Más de la mitad de tus clientes te vuelven a comprar?", strategy: "Ofrecer alternativas de recompra a clientes recurrentes",
        foda: { F: "La empresa cuenta con mecanismos para estimular la recompra de sus clientes", D: "La empresa no cuenta con mecanismos para estimular la recompra de sus clientes" } },
    ],
  },
  {
    title: "Confianza y redes",
    questions: [
      { key: "contenido", q: "¿Creas contenido en redes sociales? (publicaciones, newsletters, blogs, podcast)", strategy: "Creación de contenido",
        foda: { F: "La empresa cuenta con una estrategia de creación de contenido que fortalece su comunicación", D: "La empresa no cuenta con una estrategia suficiente de creación de contenido para fortalecer su comunicación" } },
      { key: "publicidad_masiva", q: "¿Pagas publicidad en prensa o medios masivos?", strategy: "Hacer publicidad en medios masivos",
        foda: { F: "La empresa utiliza medios masivos como parte de su estrategia de comunicación", D: "La empresa no utiliza medios masivos como parte de su estrategia de comunicación" } },
      { key: "influencers", q: "¿Pagas publicidad con influencers?", strategy: "Hacer publicidad con influencers",
        foda: { F: "La empresa utiliza influencers como canal de comunicación y captación", D: "La empresa no utiliza influencers como canal de comunicación y captación" } },
    ],
  },
  {
    title: "Audiencia",
    questions: [
      { key: "atraccion", q: "¿Tienes estrategias permanentes para atraer audiencia a tu empresa?", strategy: "Estrategias de atracción de clientes",
        foda: { F: "La empresa cuenta con estrategias permanentes para atraer nuevos clientes", D: "La empresa no cuenta con estrategias permanentes para atraer nuevos clientes" } },
      { key: "conversion", q: "¿Tienes estrategias para convertir tu audiencia en clientes potenciales?", strategy: "Estrategias de conversión",
        foda: { F: "La empresa cuenta con estrategias sistemáticas para convertir audiencia en clientes potenciales", D: "La empresa no cuenta con estrategias sistemáticas para convertir audiencia en clientes potenciales" } },
    ],
  },
  {
    title: "Palanca: capital financiero",
    questions: [
      { key: "liquidez", situations: ["sit_liquidez_crecimiento", "sit_f_liquidez"], q: "¿Tienes liquidez holgada para crecer más de un 20% al año?", strategy: "Mejorar la liquidez",
        foda: { F: "La empresa cuenta con liquidez suficiente para financiar un crecimiento superior al 20% anual", D: "La empresa no cuenta con liquidez suficiente para financiar un crecimiento superior al 20% anual" } },
      { key: "credito", q: "¿Tienes líneas de crédito disponibles para activos o capital de trabajo?", strategy: "Solicitar o incrementar líneas de crédito",
        foda: { F: "La empresa cuenta con líneas de crédito disponibles para financiar activos o capital de trabajo", D: "La empresa no cuenta con líneas de crédito disponibles para financiar activos o capital de trabajo" } },
      { key: "socios", q: "¿Tienes acceso a socios, accionistas o inversionistas?", strategy: "Atraer socios inversionistas",
        foda: { F: "La empresa cuenta con acceso a socios, accionistas o inversionistas", D: "La empresa no cuenta actualmente con acceso a socios, accionistas o inversionistas" } },
      { key: "family_friends", q: "¿Tienes acceso a préstamos de familiares o amigos?", strategy: "Obtener préstamos 'family and friends'",
        foda: { F: "La empresa cuenta con acceso a fuentes de financiamiento provenientes de familiares o amigos", D: "La empresa no cuenta con acceso a fuentes de financiamiento provenientes de familiares o amigos" } },
      { key: "ahorros", situations: ["sit_reservas_gastos", "sit_f_reservas"], q: "¿Tienes ahorros para soportar tu crecimiento del próximo año?", strategy: "Generar ahorros para crecimiento e imprevistos",
        foda: { F: "La empresa cuenta con reservas suficientes para financiar su crecimiento y enfrentar imprevistos", D: "La empresa no cuenta con reservas suficientes para financiar su crecimiento o enfrentar imprevistos" } },
      { key: "cartera", situations: ["sit_dependencia_clientes", "sit_f_cartera"], q: "¿Tienes una cartera de clientes diversificada?", strategy: "Diversificar la cartera de clientes",
        foda: { F: "La empresa cuenta con una cartera de clientes diversificada", D: "La empresa depende de una cartera de clientes poco diversificada" } },
      { key: "proveeduria", situations: ["sit_proveedores"], q: "¿Tienes diversificada tu proveeduría?", strategy: "Diversificar el portafolio de proveedores",
        foda: { F: "La empresa cuenta con una base de proveedores diversificada", D: "La empresa depende de una base de proveedores que no está suficientemente diversificada" } },
      { key: "reinversion", q: "¿Reinviertes en activos de forma permanente?", strategy: "Realizar inversiones en activos",
        foda: { F: "La empresa realiza reinversiones periódicas en los activos necesarios para sostener su crecimiento", D: "La empresa no realiza reinversiones periódicas en activos necesarios para sostener su crecimiento" } },
    ],
  },
  {
    title: "Palanca: capital social",
    questions: [
      { key: "alianzas", q: "¿Tienes alianzas con empresas que complementan tus productos o servicios?", strategy: "Generar alianzas con competidores complementarios",
        foda: { F: "La empresa cuenta con capacidad para generar alianzas con competidores que complementan su oferta", D: "La empresa no ha desarrollado alianzas con competidores que complementan su oferta" } },
      { key: "clientes_clave", q: "¿Tienes relaciones sólidas con clientes estratégicos?", strategy: "Generar alianzas con clientes estratégicos",
        foda: { F: "La empresa cuenta con relaciones estratégicas sólidas con sus clientes clave", D: "La empresa no cuenta con relaciones estratégicas suficientemente desarrolladas con clientes clave" } },
      { key: "comunidad", q: "¿Tienes comunidad en redes sociales?", strategy: "Construir comunidad en redes sociales",
        foda: { F: "La empresa cuenta con una comunidad propia desarrollada en redes sociales", D: "La empresa no cuenta con una comunidad propia suficientemente desarrollada en redes sociales" } },
      { key: "socios_estrategicos", q: "¿Tienes relaciones con posibles socios o inversionistas estratégicos?", strategy: "Generar alianzas con socios estratégicos",
        foda: { F: "La empresa cuenta con relaciones desarrolladas con posibles socios o inversionistas estratégicos", D: "La empresa no cuenta con relaciones estratégicas desarrolladas con posibles socios o inversionistas" } },
      { key: "proveedores_clave", q: "¿Tienes relaciones sólidas con proveedores estratégicos?", strategy: "Generar alianzas con proveedores estratégicos",
        foda: { F: "La empresa cuenta con relaciones sólidas con proveedores estratégicos", D: "La empresa no cuenta con relaciones sólidas con proveedores estratégicos" } },
    ],
  },
  {
    title: "Palanca: capital de conocimiento",
    questions: [
      { key: "info_interna", q: "¿Tienes información interna suficiente para tomar decisiones estratégicas?", strategy: "Generar información interna para decisiones",
        foda: { F: "La empresa cuenta con información interna suficiente para apoyar la toma de decisiones estratégicas", D: "La empresa no cuenta con información interna suficiente para apoyar la toma de decisiones estratégicas" } },
      { key: "info_mercado", q: "¿Tienes información suficiente de tu mercado?", strategy: "Obtener información del mercado",
        foda: { F: "La empresa cuenta con información suficiente de su mercado para tomar decisiones estratégicas", D: "La empresa no cuenta con información suficiente de su mercado para tomar decisiones estratégicas" } },
      { key: "info_competencia", q: "¿Tienes información suficiente de tu competencia?", strategy: "Obtener información de competidores",
        foda: { F: "La empresa cuenta con información suficiente sobre sus competidores", D: "La empresa no cuenta con información suficiente sobre sus competidores" } },
      { key: "patentes", q: "¿Tienes alguna patente?", strategy: "Tramitar patentes", foda: null },
      { key: "software", q: "¿Tienes algún software o aplicación propia?", strategy: "Desarrollar software / tecnología", foda: null },
      { key: "ia", q: "¿Usas inteligencia artificial en tu operación?", strategy: "Automatizar procesos con inteligencia artificial",
        foda: { F: "La empresa utiliza inteligencia artificial para automatizar o mejorar sus procesos", D: "La empresa no utiliza inteligencia artificial para automatizar o mejorar sus procesos" } },
    ],
  },
  {
    title: "Palanca: capital humano",
    questions: [
      { key: "talento", q: "¿Tienes un equipo talentoso?", strategy: "Construir un equipo talentoso",
        foda: { F: "La empresa cuenta con un equipo de colaboradores talentoso", D: "La empresa aún no cuenta con un equipo de colaboradores suficientemente talentoso" } },
      { key: "madurez", q: "¿Tienes un equipo maduro?", strategy: "Construir un equipo maduro",
        foda: { F: "El equipo de colaboradores tiene la madurez para operar con autonomía", D: "El equipo de colaboradores aún presenta oportunidades de madurez para operar con mayor autonomía" } },
      { key: "resultados", q: "¿Tu equipo está enfocado a resultados?", strategy: "Trabajar el enfoque a resultados del equipo",
        foda: { F: "La empresa cuenta con un equipo orientado al cumplimiento de resultados", D: "El equipo de la empresa no está suficientemente orientado al cumplimiento de resultados" } },
      { key: "compromiso", q: "¿Tu equipo está comprometido?", strategy: "Trabajar el compromiso del equipo",
        foda: { F: "La empresa cuenta con un equipo comprometido con la organización", D: "El equipo de la empresa no muestra un compromiso suficiente con la organización" } },
      { key: "formacion", q: "¿Inviertes en la capacitación de tu personal?", strategy: "Invertir en formación",
        foda: { F: "La empresa invierte en la formación y desarrollo de sus colaboradores", D: "La empresa no invierte lo suficiente en la formación y desarrollo de sus colaboradores" } },
      { key: "bienestar", q: "¿Incluyes medidas de bienestar en los indicadores de tus directivos?", strategy: "Adoptar medidas de bienestar para el equipo",
        foda: { F: "La empresa incorpora medidas de bienestar dentro de la gestión de sus colaboradores", D: "La empresa no incorpora medidas de bienestar en la gestión de sus colaboradores" } },
      { key: "gerencia", q: "¿Tu línea gerencial está enfocada a la estrategia del negocio?", strategy: "Desarrollar un equipo directivo enfocado a la estrategia",
        foda: { F: "La estructura gerencial o directiva está enfocada en la estrategia del negocio", D: "La estructura gerencial o directiva no está enfocada en la estrategia del negocio" } },
      { key: "metas", q: "¿Tus metas financieras están alineadas a los indicadores de tu equipo?", strategy: "Sistema de gestión con indicadores de productividad",
        foda: { F: "La empresa cuenta con un sistema que relaciona las metas financieras y estratégicas con indicadores de productividad", D: "La empresa no cuenta con un sistema que relacione las metas financieras y estratégicas con indicadores de productividad" } },
    ],
  },
  {
    title: "Tu producto o servicio",
    questions: [
      { key: "mejora_continua", q: "¿Tienes procesos de mejora continua para la calidad?", strategy: "Desarrollar procesos de mejora continua",
        foda: { F: "La empresa cuenta con procesos de mejora continua para fortalecer la calidad de sus productos o servicios", D: "La empresa no cuenta con procesos de mejora continua para la calidad de sus productos o servicios" } },
      { key: "ciclo_comercial", q: "¿Tienes identificado tu ciclo comercial (preventa, venta y posventa)?", strategy: "Desarrollar el ciclo comercial completo",
        foda: { F: "La empresa tiene desarrollado y gestionado su ciclo comercial de preventa, venta y posventa", D: "La empresa no tiene completamente desarrollado y gestionado su ciclo comercial de preventa, venta y posventa" } },
    ],
  },
];

export const ALL_OPP_KEYS = OPP_GROUPS.flatMap((g) => g.questions.map((q) => q.key));

// ---------- Estrategias financieras ----------
// Dos pasos (planes A y B del Excel v2_FODA combinados):
// 1. FIN_SITUATION_GROUPS: situaciones financieras que el usuario reconoce en
//    su empresa (sección FIN_SIT_SECTION, valor "Sí"). Van directo al FODA
//    con su propia redacción: type D = debilidad, F = fortaleza. `opposite`
//    marca la situación contraria (al marcar una se quita la otra).
// 2. FIN_GROUPS: decisiones (estrategias) por línea del estado de resultados
//    (sección FIN_SECTION, valor "D"). Son lo que se prioriza en el resumen y
//    llega al mapa y a las iniciativas. `situations` enlaza cada decisión con
//    las situaciones que resuelve: si alguna está marcada, en el FODA manda la
//    situación; si no, entra la decisión con su redacción `foda.D` (plan A).
export const FIN_SITUATION_GROUPS = [
  {
    title: "Ventas y clientes",
    items: [
      { key: "sit_ventas", type: "D", label: "Las ventas actuales son insuficientes para alcanzar los objetivos" },
      { key: "sit_dependencia_clientes", type: "D", label: "Existe alta dependencia de uno o pocos clientes", opposite: ["sit_f_cartera"] },
      { key: "sit_rentabilidad_producto", type: "D", label: "La empresa desconoce la rentabilidad por producto o servicio", opposite: ["sit_f_rentabilidad"] },
      { key: "sit_clientes_rentables", type: "D", label: "La empresa desconoce cuáles son sus clientes más rentables", opposite: ["sit_f_rentabilidad"] },
      { key: "sit_f_cartera", type: "F", label: "La empresa tiene una cartera de clientes diversificada", opposite: ["sit_dependencia_clientes"] },
      { key: "sit_f_rentabilidad", type: "F", label: "La empresa conoce la rentabilidad de sus productos y clientes", opposite: ["sit_rentabilidad_producto", "sit_clientes_rentables"] },
    ],
  },
  {
    title: "Liquidez y financiamiento",
    items: [
      { key: "sit_liquidez_crecimiento", type: "D", label: "La empresa no tiene suficiente liquidez para financiar su crecimiento", opposite: ["sit_f_liquidez"] },
      { key: "sit_reservas_gastos", type: "D", label: "La empresa no tiene reservas suficientes para cubrir gastos operativos", opposite: ["sit_f_reservas"] },
      { key: "sit_financiamiento_externo", type: "D", label: "La empresa depende de fuentes externas de financiamiento" },
      { key: "sit_reservas_reinversion", type: "D", label: "La empresa no cuenta con reservas para reinversión" },
      { key: "sit_cambiaria", type: "D", label: "La empresa tiene exposición cambiaria que no gestiona adecuadamente" },
      { key: "sit_costos_financieros", type: "D", label: "La empresa no controla adecuadamente sus costos financieros" },
      { key: "sit_f_liquidez", type: "F", label: "La empresa cuenta con liquidez suficiente para financiar su crecimiento", opposite: ["sit_liquidez_crecimiento"] },
      { key: "sit_f_reservas", type: "F", label: "La empresa tiene reservas suficientes para cubrir sus gastos operativos", opposite: ["sit_reservas_gastos"] },
      { key: "sit_f_estructura", type: "F", label: "La empresa tiene una estructura financiera sólida" },
    ],
  },
  {
    title: "Compras e inventarios",
    items: [
      { key: "sit_proveedores", type: "D", label: "La empresa tiene una base limitada de proveedores" },
      { key: "sit_costos_compra", type: "D", label: "La empresa tiene costos de compra superiores a los que podría obtener negociando" },
      { key: "sit_mermas", type: "D", label: "La empresa presenta mermas relevantes" },
      { key: "sit_rotacion", type: "D", label: "La empresa tiene baja rotación de inventarios" },
    ],
  },
  {
    title: "Gastos, personal e impuestos",
    items: [
      { key: "sit_gastos", type: "D", label: "La empresa tiene gastos operativos que puede reducir sin afectar la operación" },
      { key: "sit_personal", type: "D", label: "La empresa tiene una estructura de personal poco productiva" },
      { key: "sit_compensacion", type: "D", label: "La empresa tiene una estructura de compensación poco vinculada a productividad o resultados" },
      { key: "sit_control_gastos", type: "D", label: "La empresa no controla adecuadamente sus gastos" },
      { key: "sit_impuestos", type: "D", label: "La empresa no cuenta con una planeación para el pago de impuestos" },
    ],
  },
];

export const ALL_FIN_SITUATIONS = FIN_SITUATION_GROUPS.flatMap((g) => g.items);
export const ALL_FIN_SIT_KEYS = ALL_FIN_SITUATIONS.map((s) => s.key);

export const FIN_GROUPS = [
  {
    title: "Ventas e ingresos",
    guide: "¿Qué tienes que hacer para crecer más tus ventas?",
    items: [
      { key: "ventas_volumen", label: "Lograr mayor volumen de ventas", situations: ["sit_ventas"],
        foda: { D: "La empresa presenta un nivel de ventas insuficiente para alcanzar sus objetivos financieros y de crecimiento" } },
      { key: "ventas_modelos", label: "Diversificar en nuevos modelos de negocio", situations: [],
        foda: { D: "La empresa presenta una alta dependencia de su modelo de negocio actual como fuente de ingresos" } },
      { key: "ventas_utilidad_linea", label: "Conocer la utilidad por línea de producto para enfocarte en lo que deja más", situations: ["sit_rentabilidad_producto"],
        foda: { D: "La empresa no conoce con precisión la rentabilidad por línea de producto o servicio" } },
      { key: "ventas_clientes_rentables", label: "Conocer a tus clientes más rentables para protegerlos y venderles más", situations: ["sit_clientes_rentables"],
        foda: { D: "La empresa no identifica la rentabilidad de sus clientes ni gestiona comercialmente a sus clientes más rentables" } },
      { key: "ventas_aperturas", label: "Abrir nuevas sucursales o puntos de venta", situations: [],
        foda: { D: "La empresa tiene limitada su capacidad de crecimiento por falta de nuevos puntos de venta, unidades o ubicaciones" } },
      { key: "ventas_dependencia", label: "Dejar de depender de uno o pocos clientes", situations: ["sit_dependencia_clientes"],
        foda: { D: "Los ingresos de la empresa presentan una alta concentración en uno o pocos clientes" } },
      { key: "ventas_area_comercial", label: "Lanzar o crecer el área comercial", situations: [],
        foda: { D: "La empresa no cuenta con una estructura comercial suficiente para generar y gestionar sus ventas" } },
      { key: "ventas_metricas", label: "Definir métricas de productividad para el área comercial", situations: [],
        foda: { D: "La empresa no cuenta con indicadores suficientes para medir la productividad y efectividad de su área comercial" } },
    ],
  },
  {
    title: "Costo de ventas",
    guide: "¿Qué puedes hacer para comprar mejor (más barato y con mejor calidad)?",
    items: [
      { key: "costo_proveedores", label: "Ampliar la base de proveedores para comparar precios", situations: ["sit_proveedores"],
        foda: { D: "La empresa tiene una base limitada de proveedores, lo que reduce su capacidad de comparación y negociación" } },
      { key: "costo_volumen", label: "Negociar mejores precios por compras de volumen", situations: ["sit_costos_compra"],
        foda: { D: "La empresa no aprovecha suficientemente su volumen de compra para obtener mejores condiciones comerciales de sus proveedores" } },
      { key: "costo_mermas", label: "Medir y controlar las mermas", situations: ["sit_mermas"],
        foda: { D: "La empresa no mide o controla adecuadamente las mermas y su impacto en los costos" } },
      { key: "costo_inventarios", label: "Medir y controlar la rotación de inventarios", situations: ["sit_rotacion"],
        foda: { D: "La empresa no mide o gestiona adecuadamente la rotación de sus inventarios" } },
      { key: "costo_productividad", label: "Definir indicadores de efectividad (menos tiempo, más calidad, menos mermas)", situations: [],
        foda: { D: "La empresa no cuenta con indicadores suficientes para medir la productividad, tiempos, calidad y mermas de sus procesos" } },
    ],
  },
  {
    title: "Gastos operativos",
    guide: "¿Qué gastos puedes reducir o eliminar?",
    items: [
      { key: "gastos_eficientar", label: "Gestionar los gastos que se pueden eliminar o reducir", situations: ["sit_gastos"],
        foda: { D: "La empresa presenta gastos operativos que pueden reducirse o eliminarse sin afectar su operación" } },
      { key: "gastos_facturas", label: "Supervisar que los gastos estén comprobados con facturas", situations: ["sit_control_gastos"],
        foda: { D: "La empresa presenta deficiencias en el control y comprobación documental de sus gastos" } },
      { key: "gastos_personal_productivo", label: "Que el personal productivo sea más del 70% de tu equipo", situations: ["sit_personal"],
        foda: { D: "La estructura de personal presenta una proporción insuficiente de puestos directamente vinculados con la generación de valor o resultados" } },
      { key: "gastos_sueldo_variable", label: "Crecer el sueldo del personal sobre la base variable", situations: ["sit_compensacion"],
        foda: { D: "La estructura de compensación del personal tiene una alta proporción fija y una limitada vinculación con resultados o productividad" } },
      { key: "gastos_ahorro_4meses", label: "Generar ahorros para soportar 4 meses de gastos operativos", situations: ["sit_reservas_gastos"],
        foda: { D: "La empresa no cuenta con reservas de liquidez suficientes para cubrir cuatro meses de gastos operativos" } },
    ],
  },
  {
    title: "Gastos de financiamiento",
    guide: "¿Cómo puedes cuidar el costo de tu dinero?",
    items: [
      { key: "fin_excedentes", label: "Invertir los excedentes de efectivo", situations: [],
        foda: { D: "La empresa mantiene excedentes de efectivo sin una estrategia definida para generar rendimientos" } },
      { key: "fin_cambiarias", label: "Cuidar las pérdidas cambiarias", situations: ["sit_cambiaria"],
        foda: { D: "La empresa presenta exposición financiera a variaciones cambiarias sin mecanismos suficientes para gestionar ese riesgo" } },
      { key: "fin_comisiones", label: "Ahorrar en comisiones bancarias", situations: ["sit_costos_financieros"],
        foda: { D: "La empresa incurre en costos y comisiones bancarias que tienen oportunidad de optimización" } },
    ],
  },
  {
    title: "Impuestos",
    guide: "¿Estás preparado para tus obligaciones fiscales?",
    items: [
      { key: "imp_estrategias", label: "Definir estrategias adecuadas de pago de impuestos", situations: ["sit_impuestos"],
        foda: { D: "La empresa no cuenta con una planeación fiscal y financiera suficiente para gestionar eficientemente sus obligaciones tributarias" } },
      { key: "imp_ahorro_mensual", label: "Generar ahorros mensuales para el pago de impuestos", situations: ["sit_impuestos"],
        foda: { D: "La empresa no provisiona sistemáticamente los recursos necesarios para cubrir sus obligaciones fiscales" } },
    ],
  },
  {
    title: "Fondo de reserva",
    guide: "¿Tienes un colchón para crecer y reinvertir?",
    items: [
      { key: "reserva_reinversion", label: "Crear un fondo de reserva para reinversión", situations: ["sit_reservas_reinversion"],
        foda: { D: "La empresa no cuenta con un fondo de reserva destinado a financiar la reinversión" } },
      { key: "reserva_crecimiento", label: "Crear un fondo de reserva para crecimiento", situations: ["sit_liquidez_crecimiento"],
        foda: { D: "La empresa no cuenta con un fondo de reserva destinado a financiar su crecimiento" } },
    ],
  },
];

export const ALL_FIN_KEYS = FIN_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// ---------- Diagnóstico externo (Sí → Oportunidad o Amenaza) ----------
// Hoja "Diagnóstico Externo" del Excel v2_FODA. Cada pregunta que se responde
// "Sí" entra al FODA con su redacción (type O = oportunidad, A = amenaza), su
// `strategy` entra al resumen para priorizarse (y de ahí al mapa, en el
// carril `perspective`) y `initiative` es la iniciativa sugerida para el plan
// de acción. "No" o sin responder: no pasa nada.
export const EXT_GROUPS = [
  {
    title: "Mercado y demanda",
    questions: [
      { key: "ext_mercado_crece", q: "¿El tamaño de tu mercado está creciendo?", type: "O", perspective: "cliente",
        foda: "El mercado objetivo de la empresa presenta una tendencia de crecimiento",
        strategy: "Aprovechar el crecimiento del mercado objetivo",
        initiative: "Definir segmentos prioritarios y metas de captación" },
      { key: "ext_segmento_no_atendido", q: "¿Existe un segmento de clientes que actualmente no atiendes?", type: "O", perspective: "cliente",
        foda: "Existe un segmento de clientes con necesidades que actualmente no son atendidas por la empresa",
        strategy: "Desarrollar una oferta para el segmento identificado",
        initiative: "Definir propuesta de valor, canal y oferta para el segmento" },
      { key: "ext_habitos_compra", q: "¿Han cambiado los hábitos de compra de tus clientes?", type: "O", perspective: "cliente",
        foda: "Los hábitos de compra del mercado están cambiando y generan nuevas posibilidades para la empresa",
        strategy: "Adaptar la propuesta comercial a los nuevos hábitos de compra",
        initiative: "Analizar nuevos canales y ajustar la experiencia de compra" },
    ],
  },
  {
    title: "Competencia",
    questions: [
      { key: "ext_segmento_poca_competencia", q: "¿Existe algún segmento con competencia limitada?", type: "O", perspective: "competitiva",
        foda: "Existe un segmento del mercado con competencia limitada que la empresa puede atender",
        strategy: "Explorar el segmento con competencia limitada",
        initiative: "Validar demanda, propuesta y barreras de entrada" },
      { key: "ext_competidores_capacidades", q: "¿Tus competidores están incorporando capacidades que pueden afectar tu posición?", type: "A", perspective: "competitiva",
        foda: "Los competidores están desarrollando capacidades que pueden reducir la posición competitiva de la empresa",
        strategy: "Fortalecer las capacidades afectadas",
        initiative: "Definir acciones de diferenciación y respuesta competitiva" },
      { key: "ext_competidor_abandona", q: "¿Algún competidor está abandonando un segmento que tú puedes atender?", type: "O", perspective: "competitiva",
        foda: "La salida o reducción de participación de competidores genera espacio para que la empresa capture mercado",
        strategy: "Capturar la demanda disponible",
        initiative: "Diseñar una estrategia específica de captación" },
    ],
  },
  {
    title: "Tendencias del consumidor",
    questions: [
      { key: "ext_rapidez_personalizacion", q: "¿Los clientes están demandando mayor rapidez, comodidad o personalización?", type: "O", perspective: "cliente",
        foda: "El mercado muestra una mayor demanda de rapidez, comodidad o personalización",
        strategy: "Adaptar la oferta a las nuevas expectativas del cliente",
        initiative: "Rediseñar puntos de contacto y experiencia" },
      { key: "ext_sustitucion_categoria", q: "¿Los clientes están sustituyendo tu categoría por otra alternativa?", type: "A", perspective: "cliente",
        foda: "Los clientes están adoptando alternativas que pueden sustituir la oferta actual de la empresa",
        strategy: "Reducir el riesgo de sustitución",
        initiative: "Evaluar adaptación, diferenciación o nuevas ofertas" },
    ],
  },
  {
    title: "Tecnología",
    questions: [
      { key: "ext_tec_costos", q: "¿Existe tecnología que pueda reducir tus costos o mejorar tu productividad?", type: "O", perspective: "procesos",
        foda: "Existe tecnología disponible que puede mejorar la productividad o reducir costos de la empresa",
        strategy: "Incorporar tecnología con impacto financiero u operativo",
        initiative: "Evaluar soluciones, retorno de inversión y plan de implementación" },
      { key: "ext_tec_barreras", q: "¿Existe tecnología que esté reduciendo las barreras de entrada para nuevos competidores?", type: "A", perspective: "competitiva",
        foda: "La evolución tecnológica está reduciendo las barreras de entrada de nuevos competidores en el mercado",
        strategy: "Fortalecer las barreras competitivas de la empresa",
        initiative: "Desarrollar diferenciadores y capacidades difíciles de replicar" },
      { key: "ext_tec_ia", q: "¿La inteligencia artificial puede transformar alguna parte relevante de tu negocio?", type: "O", perspective: "procesos",
        foda: "La inteligencia artificial puede generar mejoras relevantes en procesos, experiencia o productividad",
        strategy: "Identificar aplicaciones prioritarias de inteligencia artificial",
        initiative: "Evaluar y priorizar casos de uso" },
    ],
  },
  {
    title: "Entorno económico",
    questions: [
      { key: "ext_eco_favorable", q: "¿Existen cambios económicos que puedan aumentar la demanda de tu oferta?", type: "O", perspective: "financiera",
        foda: "Existen condiciones económicas que pueden incrementar la demanda de la oferta de la empresa",
        strategy: "Aprovechar el cambio económico favorable",
        initiative: "Ajustar oferta, capacidad y estrategia comercial" },
      { key: "ext_eco_desfavorable", q: "¿Existen cambios económicos que puedan reducir el consumo de tu oferta?", type: "A", perspective: "financiera",
        foda: "Existen condiciones económicas que pueden reducir la demanda de la oferta de la empresa",
        strategy: "Preparar medidas para proteger ingresos y margen",
        initiative: "Definir escenarios y acciones de contingencia" },
    ],
  },
  {
    title: "Regulación",
    questions: [
      { key: "ext_reg_favorable", q: "¿Existe un cambio regulatorio que favorezca a empresas con tus capacidades actuales?", type: "O", perspective: "competitiva",
        foda: "Los cambios regulatorios generan una condición favorable para empresas con las capacidades actuales de la organización",
        strategy: "Aprovechar la ventaja derivada del cambio regulatorio",
        initiative: "Comunicar cumplimiento y adaptar la oferta" },
      { key: "ext_reg_costos", q: "¿Existe una nueva regulación que incremente tus costos o requisitos?", type: "A", perspective: "financiera",
        foda: "Los cambios regulatorios pueden incrementar los costos o requisitos de operación de la empresa",
        strategy: "Preparar la empresa para el nuevo entorno regulatorio",
        initiative: "Cuantificar impacto y definir plan de cumplimiento" },
    ],
  },
  {
    title: "Nuevos mercados y alianzas",
    questions: [
      { key: "ext_mercado_geografico", q: "¿Existe un mercado geográfico nuevo que puedas atender con capacidades actuales?", type: "O", perspective: "cliente",
        foda: "Existe un mercado geográfico adicional que la empresa puede atender utilizando capacidades existentes",
        strategy: "Expandirse hacia mercados geográficos seleccionados",
        initiative: "Validar mercado, canal, costos y modelo de entrada" },
      { key: "ext_alianzas", q: "¿Existen empresas complementarias con las que puedas generar alianzas?", type: "O", perspective: "competitiva",
        foda: "Existen empresas complementarias con las que la organización puede generar alianzas para ampliar su oferta o alcance",
        strategy: "Desarrollar alianzas estratégicas",
        initiative: "Identificar socios y diseñar propuestas conjuntas" },
      { key: "ext_nuevos_entrantes", q: "¿Existe riesgo de que nuevos competidores entren fácilmente a tu mercado?", type: "A", perspective: "competitiva",
        foda: "El mercado presenta condiciones que facilitan la entrada de nuevos competidores",
        strategy: "Fortalecer la posición competitiva de la empresa",
        initiative: "Identificar barreras, diferenciadores y ventajas defendibles" },
    ],
  },
  {
    title: "Sustitutos",
    questions: [
      { key: "ext_sustitutos", q: "¿Existe una alternativa que pueda sustituir tu producto o servicio?", type: "A", perspective: "competitiva",
        foda: "Existen alternativas que pueden sustituir la oferta actual de la empresa",
        strategy: "Reducir la vulnerabilidad frente a productos o servicios sustitutos",
        initiative: "Diferenciar la oferta y fortalecer la propuesta de valor" },
    ],
  },
];

export const ALL_EXT_QUESTIONS = EXT_GROUPS.flatMap((g) =>
  g.questions.map((q) => ({ ...q, category: g.title }))
);
export const ALL_EXT_KEYS = ALL_EXT_QUESTIONS.map((q) => q.key);

// ---------- Plantillas de iniciativa para riesgos críticos (Fase 2) ----------
// Se ofrecen cuando el riesgo no tiene controles en la matriz y, para los
// riesgos aceptados, siempre (son el mínimo que un riesgo crítico aceptado
// necesita: señal de alerta y plan de reacción).
export const RISK_INITIATIVE_TEMPLATES = {
  Reducir: [
    { key: "control",   title: "Definir un control preventivo y nombrar a su responsable",
      expected_result: "El control opera y alguien responde por él",            kpi: "Control documentado y en operación" },
    { key: "capacitar", title: "Capacitar al equipo para evitar que este riesgo ocurra",
      expected_result: "El equipo sabe cómo prevenirlo y qué hacer si ocurre",   kpi: "% del equipo capacitado" },
    { key: "alerta",    title: "Establecer un indicador de alerta temprana y revisarlo cada mes",
      expected_result: "Nos enteramos a tiempo, antes de que el riesgo nos pegue", kpi: "Indicador revisado cada mes" },
  ],
  Transferir: [
    { key: "poliza",    title: "Cotizar y contratar una póliza o contrato que cubra este riesgo",
      expected_result: "El riesgo queda cubierto por un tercero",                 kpi: "Póliza o contrato vigente" },
    { key: "clausulas", title: "Negociar cláusulas con proveedores o clientes que repartan el riesgo",
      expected_result: "Si el riesgo ocurre, la pérdida se reparte",              kpi: "Contratos con la cláusula firmada" },
    { key: "tercero",   title: "Respaldar la operación con un tercero (proveedor alterno o servicio externo)",
      expected_result: "La operación sigue aunque el riesgo ocurra",              kpi: "Proveedor o servicio alterno listo" },
  ],
  Aceptar: [
    { key: "senal",     title: "Definir la señal de alerta que avisa que el riesgo se materializó",
      expected_result: "Sabremos el mismo día que el riesgo ocurrió",              kpi: "Señal de alerta definida y vigilada" },
    { key: "reaccion",  title: "Escribir el plan de reacción y nombrar a quien lo ejecuta",
      expected_result: "Todos saben qué hacer y quién decide si ocurre",          kpi: "Plan de reacción escrito y comunicado" },
    { key: "revision",  title: "Revisar este riesgo cada mes y confirmar que sigue siendo aceptable",
      expected_result: "La decisión de aceptarlo sigue siendo correcta",          kpi: "Revisiones mensuales hechas" },
  ],
};
export const DEFAULT_RISK_TEMPLATE_STRATEGY = "Reducir";
export const templatesForStrategy = (strategy) =>
  RISK_INITIATIVE_TEMPLATES[strategy] || RISK_INITIATIVE_TEMPLATES[DEFAULT_RISK_TEMPLATE_STRATEGY];
