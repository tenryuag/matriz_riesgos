// Comprueba la base de STAGING por su API, con las cuentas de demostración:
// que cada una entra con su contraseña y ve exactamente lo que le toca. Solo
// lee. Lo corre `npm run db:staging:preparar`; a mano:
//   STAGING_URL=… STAGING_KEY=… DEMO_PASSWORD=… node scripts/check-staging.mjs
// Las cantidades esperadas salen de supabase-seed-staging.sql.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const URL_ = process.env.STAGING_URL;
const KEY = process.env.STAGING_KEY;
const PASS = process.env.DEMO_PASSWORD;
if (!URL_ || !KEY || !PASS) {
  console.error("Faltan STAGING_URL, STAGING_KEY o DEMO_PASSWORD");
  process.exit(1);
}
if (URL_.includes("hcmeoducjqudokfhhvyc")) {
  console.error("Esa dirección es la de producción: esta comprobación es solo para la rama.");
  process.exit(1);
}

const seed = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../supabase-seed-staging.sql"), "utf8");
const expected = Object.fromEntries([...seed.matchAll(/^-- ([a-z_]+): (\d+) filas$/gm)].map((m) => [m[1], Number(m[2])]));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${name}${detail ? " — " + detail : ""}`);
};
const note = (text) => console.log(`  ·     ${text}`);

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
  Authorization: `Bearer ${token}`,
  ...(company ? { "x-company-id": company } : {}),
});
// Cuántas filas de una tabla ve esa sesión (RLS incluido).
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

const MODULES = ["risks", "departments", "strategic_plans", "plan_answers", "strategic_initiatives", "fin_analyses", "fin_years", "fin_values"];
const all = Object.fromEntries(MODULES.map((t) => [t, expected[t] ?? 0]));
const none = Object.fromEntries(MODULES.map((t) => [t, 0]));
const fin = ["fin_analyses", "fin_years", "fin_values"];

console.log("Base de staging, vista por las cuentas demo");
{
  const s = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } }).then((r) => r.json()).catch(() => ({}));
  check("el registro está abierto y no pide confirmar el correo (como en producción)", s.disable_signup === false && s.mailer_autoconfirm === true,
    `registro ${s.disable_signup ? "cerrado" : "abierto"}, confirmación de correo ${s.mailer_autoconfirm ? "apagada" : "ENCENDIDA"}`);
}

const admin = await login("demo.admin@example.com");
check("demo.admin entra con la contraseña", !!admin);
let company = null;
if (admin) {
  const access = await rpc(admin, "my_access");
  company = access?.company?.id || null;
  check("demo.admin: su empresa con los tres módulos", !!company && ["risk", "strategic", "fin-analysis"].every((m) => access.modules?.[m] === "edit"), access?.company?.name || "sin empresa");
  const got = await sees(admin, MODULES);
  check("demo.admin: ve el ejemplo completo", same(got, all), show(got));
  const ia = await count(admin, "ia_resultados");
  check("demo.admin: informe y resumen de IA guardados", ia === (expected.ia_resultados ?? 0), `${ia}`);
}

const ana = await login("demo.ana@example.com");
check("demo.ana entra con la contraseña", !!ana);
if (ana) {
  const access = await rpc(ana, "my_access");
  const got = await sees(ana, MODULES);
  check("demo.ana: ve todo, con permiso de «solo ver»", same(got, all) && Object.values(access?.modules || {}).every((l) => l === "view"), JSON.stringify(access?.modules));
}

const invitada = await login("demo.invitacion@example.com");
check("demo.invitacion entra con la contraseña", !!invitada);
if (invitada) {
  const got = await sees(invitada, MODULES);
  check("demo.invitacion: sin módulos asignados no ve nada", same(got, none), show(got));
}

const mentora = await login("demo.mentora@example.com");
check("demo.mentora entra con la contraseña", !!mentora);
if (mentora && company) {
  const own = await sees(mentora, MODULES);
  check("demo.mentora, en su propia empresa: no ve datos del cliente", same(own, none), show(own));
  const list = await rpc(mentora, "mentor_companies");
  check("demo.mentora: la empresa aparece en «Empresas que acompañas»", JSON.stringify(list || "").includes(company));
  // Lo que en local no se podía probar: que el servidor hospedado deje pasar
  // el encabezado x-company-id hasta la base.
  const got = await sees(mentora, MODULES, company);
  const want = { ...none, ...Object.fromEntries(fin.map((t) => [t, expected[t] ?? 0])) };
  check("demo.mentora, en modo mentor (encabezado x-company-id): solo Análisis Financiero del cliente", same(got, want), show(got));
}

const plataforma = await login("demo.plataforma@example.com");
check("demo.plataforma entra con la contraseña", !!plataforma);
if (plataforma) {
  const panel = await rpc(plataforma, "admin_companies");
  const names = JSON.stringify(panel || "");
  check("demo.plataforma: el panel «Empresas» lista las tres empresas", ["Metalmecánica del Bajío", "Consultoría Marta Ruiz", "Paula Admin"].every((n) => names.includes(n)));
}

// Informativo: las funciones las despliega Tenryu.
if (admin) {
  const res = await fetch(`${URL_}/functions/v1/ia`, {
    method: "POST",
    headers: { ...headers(admin), "Content-Type": "application/json" },
    body: JSON.stringify({ action: "estado" }),
  }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  if (!res || !body?.version) note(`función ia: sin respuesta útil (${res ? res.status : "sin conexión"}); hay que desplegarla en la rama`);
  else note(`función ia: versión ${body.version}${body.version === "1.1.0" ? "" : " — falta desplegar la 1.1.0 (modo mentor)"}`);
}

console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodo en orden");
process.exit(failed ? 1 : 0);
