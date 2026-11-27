// Prueba la base de STAGING por su API pública, como la usa la app. La corre
// `npm run db:staging:preparar`, que antes crea dos cuentas temporales (una
// empresa cliente con un análisis financiero mínimo y su mentora) y después
// las borra. Solo lee.
//   STAGING_URL, STAGING_KEY  dirección y llave pública de la rama
//   QA_PASSWORD               contraseña de las dos cuentas temporales
//   OTRA_EMPRESA              una empresa real de la copia: nadie de fuera debe verla
//   ORIGEN                    dirección del sitio de staging (para el permiso del navegador)
const URL_ = process.env.STAGING_URL;
const KEY = process.env.STAGING_KEY;
const PASS = process.env.QA_PASSWORD;
const OTHER = process.env.OTRA_EMPRESA || null;
const ORIGIN = process.env.ORIGEN || "https://staging--matrizriesgos.netlify.app";
if (!URL_ || !KEY || !PASS) {
  console.error("Faltan STAGING_URL, STAGING_KEY o QA_PASSWORD");
  process.exit(1);
}
if (URL_.includes("hcmeoducjqudokfhhvyc")) {
  console.error("Esa dirección es la de producción: esta prueba es solo para la rama.");
  process.exit(1);
}

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`    ${ok ? "OK   " : "FALLA"} ${name}${detail ? " — " + detail : ""}`);
};
const note = (text) => console.log(`    ·     ${text}`);

async function login(email) {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASS }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? body.access_token : null;
}
const headers = (token, company) => ({
  apikey: KEY,
  Authorization: `Bearer ${token || KEY}`,
  ...(company ? { "x-company-id": company } : {}),
});
// Cuántas filas de una tabla ve esa sesión (reglas de seguridad incluidas).
async function count(token, table, company = null) {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: { ...headers(token, company), Prefer: "count=exact", Range: "0-0" },
  });
  const total = (res.headers.get("content-range") || "").split("/")[1];
  return res.status < 400 && total !== undefined && total !== "*" ? Number(total) : `error ${res.status}`;
}
async function rpc(token, fn, args = {}, company = null) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...headers(token, company), "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return res.ok ? res.json() : null;
}
const sees = async (token, tables, company = null) =>
  Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await count(token, t, company)])));
const same = (got, want) => Object.keys(want).every((k) => got[k] === want[k]);
const show = (got) => Object.entries(got).map(([k, v]) => `${k} ${v}`).join(", ");

const RISK = ["risks", "departments"];
const PLAN = ["strategic_plans", "plan_answers", "strategic_initiatives"];
const FIN = ["fin_analyses", "fin_years", "fin_values"];
const ALL = [...RISK, ...PLAN, ...FIN];
const zeros = (tables) => Object.fromEntries(tables.map((t) => [t, 0]));
const ones = (tables) => Object.fromEntries(tables.map((t) => [t, 1]));

{
  const s = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } }).then((r) => r.json()).catch(() => ({}));
  check("el registro está abierto y no pide confirmar el correo (como en producción)", s.disable_signup === false && s.mailer_autoconfirm === true,
    `registro ${s.disable_signup ? "cerrado" : "abierto"}, confirmación de correo ${s.mailer_autoconfirm ? "apagada" : "ENCENDIDA"}`);
}
{
  // Sin sesión, con la llave pública que va dentro del sitio: no se lee nada.
  const got = await sees(null, [...ALL, "companies", "invitation_codes", "user_module_access"]);
  check("sin iniciar sesión no se lee ningún dato", Object.values(got).every((v) => v === 0 || typeof v === "string"), show(got));
}
{
  // El navegador pregunta antes si puede mandar el encabezado del modo mentor.
  const res = await fetch(`${URL_}/rest/v1/fin_analyses`, {
    method: "OPTIONS",
    headers: { Origin: ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "apikey,authorization,x-company-id" },
  }).catch(() => null);
  const allowed = (res?.headers.get("access-control-allow-headers") || "").toLowerCase();
  check("el navegador puede mandar el encabezado x-company-id desde el sitio de staging",
    !!res && res.status < 400 && (allowed === "*" || allowed.includes("x-company-id")), res ? `respuesta ${res.status}` : "sin conexión");
}

const client = await login("qa.staging.cliente@example.com");
check("una cuenta nueva entra con su contraseña", !!client);
let company = null;
if (client) {
  const access = await rpc(client, "my_access");
  company = access?.company?.id || null;
  check("empresa cliente: administra su empresa, con Gestión del Riesgo y Análisis Financiero",
    !!company && access.company.name === "QA Cliente, S.A." && access.modules?.risk === "edit" && access.modules?.["fin-analysis"] === "edit" && !access.modules?.strategic,
    JSON.stringify(access?.modules));
  const got = await sees(client, [...ALL, "companies"]);
  check("empresa cliente: ve su análisis y nada de las demás empresas", same(got, { ...zeros([...RISK, ...PLAN]), ...ones(FIN), companies: 1 }), show(got));
  const panel = await rpc(client, "admin_companies");
  check("empresa cliente: no puede abrir el panel de la plataforma", panel?.error === "UNAUTHORIZED");
}

const mentor = await login("qa.staging.mentora@example.com");
check("la mentora entra con su contraseña", !!mentor);
if (mentor && company) {
  const own = await sees(mentor, ALL);
  check("mentora, en su propia empresa: no ve datos del cliente", same(own, zeros(ALL)), show(own));
  const list = await rpc(mentor, "mentor_companies");
  check("mentora: el cliente aparece en «Empresas que acompañas»", JSON.stringify(list || "").includes(company));
  // Lo que en local no se podía probar: que el servidor hospedado deje pasar
  // el encabezado x-company-id hasta la base.
  const got = await sees(mentor, ALL, company);
  check("mentora, en modo mentor (encabezado x-company-id): solo el Análisis Financiero del cliente", same(got, { ...zeros([...RISK, ...PLAN]), ...ones(FIN) }), show(got));
  if (OTHER) {
    const other = await sees(mentor, ALL, OTHER);
    check("mentora, pidiendo una empresa que no acompaña: no ve nada", same(other, zeros(ALL)), show(other));
  }
}

// Informativo: las funciones las despliega Tenryu.
if (client) {
  const res = await fetch(`${URL_}/functions/v1/ia`, {
    method: "POST",
    headers: { ...headers(client), "Content-Type": "application/json" },
    body: JSON.stringify({ action: "estado" }),
  }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  if (!res || !body?.version) note(`función ia: sin respuesta útil (${res ? res.status : "sin conexión"}); hay que desplegarla en la rama`);
  else note(`función ia: versión ${body.version}${body.version === "1.1.0" ? "" : " — falta desplegar la 1.1.0 (modo mentor)"}`);
}

console.log(failed ? `    ${failed} comprobaciones fallaron` : "    Todo en orden");
process.exit(failed ? 1 : 0);
