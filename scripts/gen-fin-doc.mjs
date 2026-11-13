// Genera el documento "Cómo se calcula" del Análisis Financiero a partir del
// mismo catálogo que usa la app (src/config/finConfig.js), para que fórmulas
// y rangos de color nunca se desfasen de lo que el usuario ve en pantalla.
//
//   node scripts/gen-fin-doc.mjs
//     → docs/Como_se_calcula_Analisis_Financiero.html   (documento completo)
//   node scripts/gen-fin-doc.mjs --fragment <ruta>
//     → además escribe el contenido sin <html>/<body> (para publicarlo como página)
//
// Vuelve a correrlo cada vez que cambien RATIO_DEFS, sus bandas o las reglas
// de comparación.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RATIO_GROUPS, RATIO_DEFS, RATIO_BY_KEY, INCOME_ROWS, BALANCE_GROUPS, formatRatio } from "../src/config/finConfig.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (def, v) => esc(formatRatio(def, v));

// Texto de las tres bandas de color de un indicador.
function bands(def) {
  if (!def.semaforo) return null;
  if (def.statusFrom) {
    const from = RATIO_BY_KEY[def.statusFrom];
    return { inherit: `Toma el color de «${esc(from?.label || def.statusFrom)}»` };
  }
  const b = def.bands;
  if (!b) return null;
  if (def.better === "higher") {
    return {
      verde: `${fmt(def, b.greenMin)} o más`,
      ambar: `De ${fmt(def, b.amberMin)} a menos de ${fmt(def, b.greenMin)}`,
      rojo: `Menos de ${fmt(def, b.amberMin)}`,
    };
  }
  if (def.better === "lower") {
    return {
      verde: `Hasta ${fmt(def, b.greenMax)}`,
      ambar: `Más de ${fmt(def, b.greenMax)} y hasta ${fmt(def, b.amberMax)}`,
      rojo: `Más de ${fmt(def, b.amberMax)}`,
    };
  }
  if (def.better === "range") {
    return {
      verde: `De ${fmt(def, b.green[0])} a ${fmt(def, b.green[1])}`,
      ambar: `De ${fmt(def, b.amber[0])} a ${fmt(def, b.amber[1])}, fuera del verde`,
      rojo: `Menos de ${fmt(def, b.amber[0])} o más de ${fmt(def, b.amber[1])}`,
    };
  }
  return null;
}

// Cómo se pinta la flecha de Tendencia de un indicador.
function trend(def) {
  const dir = def.trendBetter || def.better;
  const colored = def.semaforo || def.trendBetter;
  if (dir !== "higher" && dir !== "lower") return { text: "Flecha gris: solo indica si subió o bajó", cls: "gris" };
  if (!colored) return { text: "Flecha gris: solo indica si subió o bajó", cls: "gris" };
  return dir === "higher"
    ? { text: "Verde si sube, roja si baja", cls: "sube" }
    : { text: "Verde si baja, roja si sube", cls: "baja" };
}

function ratioTable(group) {
  const defs = RATIO_DEFS.filter((d) => d.group === group.key);
  const rows = defs
    .map((d) => {
      const b = bands(d);
      const t = trend(d);
      let color;
      if (!d.semaforo) color = `<td colspan="3" class="info">Informativo: se muestra la cifra, sin color</td>`;
      else if (b?.inherit) color = `<td colspan="3" class="info">${b.inherit}</td>`;
      else color = `<td class="b verde">${b.verde}</td><td class="b ambar">${b.ambar}</td><td class="b rojo">${b.rojo}</td>`;
      return `<tr>
  <th scope="row"><span class="ind">${esc(d.label)}</span><span class="what">${esc(d.what)}</span></th>
  <td class="formula">${esc(d.formula)}</td>
  ${color}
  <td class="trend ${t.cls}">${t.text}</td>
</tr>`;
    })
    .join("\n");
  const n = defs.filter((d) => d.semaforo).length;
  return `<section id="${group.key}" class="grupo">
<h3>${esc(group.title)}</h3>
<p class="q">${esc(group.question)} <span class="count">${defs.length} indicadores, ${n} con color</span></p>
<div class="scroll"><table class="razones">
<thead><tr><th scope="col">Indicador</th><th scope="col">Fórmula</th><th scope="col" class="h verde">Verde · Sano</th><th scope="col" class="h ambar">Ámbar · En vigilancia</th><th scope="col" class="h rojo">Rojo · Atender</th><th scope="col">Flecha de tendencia</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
</section>`;
}

const nTotal = RATIO_DEFS.length;
const nColor = RATIO_DEFS.filter((d) => d.semaforo).length;
const nCuentas = BALANCE_GROUPS.reduce((s, g) => s + g.items.length, 0);
const nCapturas = INCOME_ROWS.filter((r) => r.type === "input").length;
const hoy = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

const style = `
/* Documento de referencia: una columna de lectura y tablas anchas con scroll propio. */
:root {
  --bg: #f7f8f8; --surface: #ffffff; --fg: #17232a; --muted: #5a6b74; --line: #d9e0e3;
  --accent: #0b6e7f; --accent-soft: #e2f1f3;
  --verde: #1a7f4b; --verde-bg: #e3f4ea; --ambar: #8a5a00; --ambar-bg: #fdf0cf; --rojo: #b3261e; --rojo-bg: #fbe4e2;
  --font-display: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  --font-body: "Inter", "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #11181c; --surface: #19232a; --fg: #e6edf0; --muted: #9fb0b8; --line: #2c3a42;
  --accent: #5cc4d4; --accent-soft: #17323a;
  --verde: #6ad49a; --verde-bg: #153524; --ambar: #f0c463; --ambar-bg: #3a2d0c; --rojo: #ff9a92; --rojo-bg: #3d1a18;
  color-scheme: dark;
} }
:root[data-theme="dark"] {
  --bg: #11181c; --surface: #19232a; --fg: #e6edf0; --muted: #9fb0b8; --line: #2c3a42;
  --accent: #5cc4d4; --accent-soft: #17323a;
  --verde: #6ad49a; --verde-bg: #153524; --ambar: #f0c463; --ambar-bg: #3a2d0c; --rojo: #ff9a92; --rojo-bg: #3d1a18;
  color-scheme: dark;
}
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 15px; line-height: 1.6; }
.page { max-width: 1120px; margin: 0 auto; padding-block: 40px 72px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 40px; }
.prose { max-width: 72ch; display: flex; flex-direction: column; gap: 12px; }
h1, h2, h3 { font-family: var(--font-display); text-wrap: balance; line-height: 1.2; margin: 0; }
h1 { font-size: 2.1rem; letter-spacing: -0.01em; }
h2 { font-size: 1.45rem; padding-top: 8px; border-top: 2px solid var(--fg); }
h3 { font-size: 1.1rem; }
p, ul, ol, dl { margin: 0; }
ul, ol { padding-left: 1.2em; display: flex; flex-direction: column; gap: 6px; }
.eyebrow { font-size: 0.75rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
.lede { font-size: 1.05rem; color: var(--muted); }
.meta { font-size: 0.82rem; color: var(--muted); }
section.bloque { display: flex; flex-direction: column; gap: 18px; }
nav.toc { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 0.9rem; }
nav.toc a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; }
nav.toc a:hover, nav.toc a:focus-visible { border-bottom-color: var(--accent); outline: none; }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 0.86rem; }
th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }
thead th { font-family: var(--font-display); font-size: 0.78rem; letter-spacing: 0.03em; white-space: nowrap; background: var(--accent-soft); }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
table.razones { min-width: 980px; }
table.razones th[scope="row"] { width: 24%; font-weight: 400; }
.ind { display: block; font-weight: 600; }
.what { display: block; color: var(--muted); font-size: 0.8rem; margin-top: 2px; }
.formula { font-family: var(--font-mono); font-size: 0.78rem; width: 22%; }
.b, .h { font-variant-numeric: tabular-nums; }
.h.verde, .b.verde { color: var(--verde); } .h.ambar, .b.ambar { color: var(--ambar); } .h.rojo, .b.rojo { color: var(--rojo); }
.b.verde { background: var(--verde-bg); } .b.ambar { background: var(--ambar-bg); } .b.rojo { background: var(--rojo-bg); }
.info { color: var(--muted); font-style: italic; }
.trend { font-size: 0.8rem; width: 13%; }
.trend.gris { color: var(--muted); }
.grupo { display: flex; flex-direction: column; gap: 8px; }
.q { color: var(--muted); font-size: 0.9rem; }
.count { white-space: nowrap; font-size: 0.78rem; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; margin-left: 6px; }
table.simple { min-width: 560px; }
table.simple td:first-child, table.simple th:first-child { width: 34%; font-weight: 600; }
table.simple td.formula { width: auto; }
.nota { border-left: 3px solid var(--accent); padding: 4px 0 4px 14px; color: var(--muted); font-size: 0.9rem; max-width: 72ch; }
.chip { display: inline-block; padding: 0 7px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.chip.verde { background: var(--verde-bg); color: var(--verde); } .chip.ambar { background: var(--ambar-bg); color: var(--ambar); } .chip.rojo { background: var(--rojo-bg); color: var(--rojo); }
code { font-family: var(--font-mono); font-size: 0.85em; }
@media print { .page { padding-block: 0; } .scroll { overflow: visible; border: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
`;

const body = `
<div class="page">
<header class="prose">
  <p class="eyebrow">Análisis Financiero · modelo MP-AFH1</p>
  <h1>Cómo se calcula cada cifra</h1>
  <p class="lede">De dónde sale cada número del módulo, con qué fórmula, y qué regla decide si un indicador se pinta en verde, ámbar o rojo.</p>
  <p class="meta">Generado el ${hoy} desde el mismo catálogo que usa la aplicación: lo que dice aquí es lo que se ve en pantalla.</p>
</header>

<nav class="toc" aria-label="Contenido">
  <a href="#convenciones">Convenciones</a>
  <a href="#resultados">Estado de Resultados</a>
  <a href="#variaciones">Variaciones y colores</a>
  <a href="#balance">Balance</a>
  <a href="#cambios">EBITDA y Estado de cambios</a>
  <a href="#colores">Colores de las razones</a>
  <a href="#razones">Las ${nTotal} razones</a>
  <a href="#cortes">Cortes y comparativos</a>
  <a href="#pendientes">Por definir</a>
</nav>

<section class="bloque" id="convenciones">
  <h2>Convenciones</h2>
  <div class="prose">
    <ul>
      <li><strong>Cifras en miles</strong> de la moneda de la empresa, tal como vienen en los estados financieros del contador.</li>
      <li><strong>Lo único que se captura</strong> son ${nCapturas} renglones del Estado de Resultados, 3 partidas que no son efectivo, ${nCuentas} cuentas del Balance y 5 datos complementarios del Estado de cambios. Todo lo demás se calcula; nada calculado se guarda.</li>
      <li><strong>Signos.</strong> Costos, gastos e impuestos se capturan en positivo y la aplicación los resta. Solo la utilidad o pérdida cambiaria y los otros productos o gastos llevan signo. En el Balance, reservas y resultados acumulados van en negativo cuando hay déficit o pérdidas.</li>
      <li><strong>Periodos parciales.</strong> Un corte parcial trae cifras acumuladas del año, por ejemplo de enero a junio. Los estados financieros lo muestran tal cual, sin anualizar.</li>
      <li><strong>Anualizar</strong> significa llevar el parcial a 12 meses: cifra × 12 ÷ meses del corte. Se usa solo para comparar un parcial contra un año completo y en crecimiento en ventas, ROA y ROE.</li>
      <li><strong>Días.</strong> Las rotaciones usan saldos al cierre del periodo, sin promedios, y un año comercial de 30 días por mes: 360 días el año completo, 180 un semestre.</li>
    </ul>
  </div>
</section>

<section class="bloque" id="resultados">
  <h2>Estado de Resultados</h2>
  <div class="scroll"><table class="simple">
    <thead><tr><th scope="col">Renglón calculado</th><th scope="col">Fórmula</th></tr></thead>
    <tbody>
      <tr><td>Utilidad bruta</td><td class="formula">Ventas − Costo de ventas</td></tr>
      <tr><td>Gasto operativo</td><td class="formula">Gasto de venta + Gasto de administración + Gastos operativos en general</td></tr>
      <tr><td>Resultado de operación</td><td class="formula">Utilidad bruta − Gasto operativo</td></tr>
      <tr><td>Resultado integral de financiamiento</td><td class="formula">Productos financieros − Gastos financieros + Utilidad (pérdida) cambiaria</td></tr>
      <tr><td>Resultado antes de impuestos</td><td class="formula">Resultado de operación + Resultado integral de financiamiento + Otros productos (gastos)</td></tr>
      <tr><td>Utilidad neta</td><td class="formula">Resultado antes de impuestos − ISR − PTU</td></tr>
      <tr><td>% de ventas de cualquier renglón</td><td class="formula">Renglón ÷ Ventas</td></tr>
    </tbody>
  </table></div>
  <p class="nota">La depreciación y las reservas de cuentas por cobrar y de inventarios se anotan al pie. No cambian los totales del Estado de Resultados, porque ya están dentro del gasto operativo; las usan el EBITDA y el Estado de cambios.</p>
</section>

<section class="bloque" id="variaciones">
  <h2>Variaciones y colores en el Estado de Resultados</h2>
  <div class="prose">
    <p>Bajo cada subtotal hay tres líneas. Las dos últimas comparan el periodo contra el cierre del año anterior.</p>
  </div>
  <div class="scroll"><table class="simple">
    <thead><tr><th scope="col">Línea</th><th scope="col">Cómo se calcula</th></tr></thead>
    <tbody>
      <tr><td>% de ventas</td><td class="formula">Renglón ÷ Ventas del mismo periodo</td></tr>
      <tr><td>Cambio en monto</td><td class="formula">(Actual − Anterior) ÷ valor absoluto del Anterior. Si alguno de los dos periodos es parcial, ambos se llevan a 12 meses antes de comparar y se marca «anualizado».</td></tr>
      <tr><td>Cambio % de ventas</td><td class="formula">% de ventas actual − % de ventas anterior, en puntos porcentuales (pp). Nunca se anualiza, porque es una proporción.</td></tr>
    </tbody>
  </table></div>
  <div class="scroll"><table class="simple">
    <thead><tr><th scope="col">Tipo de renglón</th><th scope="col">Qué va en verde</th></tr></thead>
    <tbody>
      <tr><td>Utilidades y resultados</td><td>Que suba el monto y que suba su porcentaje sobre ventas.</td></tr>
      <tr><td>Costos y gastos</td><td>Que baje el monto y que baje su porcentaje sobre ventas. Cada línea lleva su propio color: un gasto puede subir en monto, en rojo, y pesar menos sobre las ventas, en verde. Eso indica que la empresa es más eficiente.</td></tr>
      <tr><td>Resultado integral de financiamiento</td><td>Cuando es un costo neto en ambos periodos se lee como costo: si su tamaño baja, flecha hacia abajo en verde. Si es positivo, se lee como una utilidad.</td></tr>
    </tbody>
  </table></div>
</section>

<section class="bloque" id="balance">
  <h2>Balance General</h2>
  <div class="scroll"><table class="simple">
    <thead><tr><th scope="col">Cifra</th><th scope="col">Fórmula</th></tr></thead>
    <tbody>
      <tr><td>Total activo</td><td class="formula">Activo circulante + Activo no circulante</td></tr>
      <tr><td>Total pasivo</td><td class="formula">Pasivo circulante + Pasivo a largo plazo</td></tr>
      <tr><td>Resultado neto del periodo</td><td class="formula">Utilidad neta del Estado de Resultados. No se captura.</td></tr>
      <tr><td>Total capital contable</td><td class="formula">Cuentas de capital + Resultado neto del periodo</td></tr>
      <tr><td>Verificación</td><td class="formula">Total activo − (Total pasivo + Total capital) debe ser 0</td></tr>
      <tr><td>% de cada cuenta</td><td class="formula">Cuenta ÷ Total activo</td></tr>
      <tr><td>Variación de los totales</td><td class="formula">(Actual − Anterior) ÷ valor absoluto del Anterior, sin anualizar: un saldo es una foto a la fecha.</td></tr>
    </tbody>
  </table></div>
</section>

<section class="bloque" id="cambios">
  <h2>EBITDA y Estado de cambios</h2>
  <div class="prose">
    <p>El Estado de cambios reproduce la hoja «Conciliaciones» del modelo. Compara el Balance de un periodo contra el del cierre anterior, con la convención (+) fuente de efectivo y (−) aplicación. Por eso no existe para el primer periodo.</p>
  </div>
  <div class="scroll"><table class="simple">
    <thead><tr><th scope="col">Cifra</th><th scope="col">Fórmula</th></tr></thead>
    <tbody>
      <tr><td>UAFIRDA / EBITDA</td><td class="formula">Resultado de operación + Depreciación y amortización + Reservas de cuentas por cobrar e inventarios + Ajustes por partidas diferidas</td></tr>
      <tr><td>Inversión neta en capital de trabajo</td><td class="formula">Cambio en clientes, inventarios, proveedores, pagos anticipados, intercompañías, anticipos de clientes y gastos acumulados. Un activo que baja libera efectivo; un pasivo que sube también.</td></tr>
      <tr><td>Flujo de operación</td><td class="formula">EBITDA + Inversión neta en capital de trabajo</td></tr>
      <tr><td>Efectivo generado por la operación</td><td class="formula">Flujo de operación + Impuestos causados + Costo integral de financiamiento pagado</td></tr>
      <tr><td>Efectivo generado por inversión</td><td class="formula">Inversión en activo fijo (CAPEX) + Cambio en otros activos</td></tr>
      <tr><td>Financiamiento externo</td><td class="formula">Cambio en deuda bancaria de corto y largo plazo, acreedores, otras cuentas por cobrar y por pagar, otros ingresos y diferidos</td></tr>
      <tr><td>Aportaciones (retiros) de los accionistas</td><td class="formula">Cambio en capital social y aportaciones + Dividendos, que salen del cambio en reservas y resultados acumulados</td></tr>
      <tr><td>Efectivo generado en el periodo</td><td class="formula">Operación + Inversión + Financiamiento externo + Accionistas</td></tr>
      <tr><td>Verificación</td><td class="formula">Efectivo inicial + Efectivo generado en el periodo debe ser igual al efectivo del Balance</td></tr>
    </tbody>
  </table></div>
</section>

<section class="bloque" id="colores">
  <h2>Cómo se decide el color de una razón</h2>
  <div class="prose">
    <p>De las ${nTotal} razones, ${nColor} llevan color y ${nTotal - nColor} son informativas: muestran la cifra sin juzgarla. El color depende solo del valor del indicador en ese periodo y de sus rangos, que aparecen en las tablas de abajo.</p>
    <ul>
      <li><span class="chip verde">Verde · Sano</span> el valor está en el rango sano.</li>
      <li><span class="chip ambar">Ámbar · En vigilancia</span> está en el rango intermedio.</li>
      <li><span class="chip rojo">Rojo · Atender</span> está fuera de ambos.</li>
    </ul>
    <p>Hay tres tipos de rango: indicadores donde más es mejor, como la liquidez; donde menos es mejor, como los días clientes; y de banda, como los días proveedores, donde lo sano es un intervalo.</p>
    <p><strong>Lectura rápida.</strong> Los contadores «Sanos», «En vigilancia» y «Por atender» cuentan cuántos de los ${nColor} indicadores con color caen en cada uno en el último periodo. «Lo que más llama la atención» lista primero todos los rojos y después los ámbar.</p>
    <p><strong>Flecha de tendencia.</strong> Compara el último periodo contra el cierre del año anterior. La flecha apunta hacia donde se movió el valor. Va en verde si el movimiento es bueno para ese indicador y en rojo si es malo; en los informativos sin dirección definida va en gris.</p>
    <p><strong>Casos sin valor que sí llevan color.</strong> Con capital contable negativo o cero, el apalancamiento, el apalancamiento financiero y el ROE no se pueden calcular y se marcan en rojo. Con EBITDA negativo o cero, Pasivo total / EBITDA y Pasivo financiero / EBITDA se marcan en rojo. Sin deuda con costo, Pasivo financiero / EBITDA se marca en verde.</p>
  </div>
</section>

<section class="bloque" id="razones">
  <h2>Las ${nTotal} razones financieras</h2>
  ${RATIO_GROUPS.map(ratioTable).join("\n")}
</section>

<section class="bloque" id="cortes">
  <h2>Cortes dentro del año y comparativos</h2>
  <div class="prose">
    <p>Un año puede tener varios cortes: parciales acumulados, por ejemplo a junio y a octubre, y el cierre de 12 meses. Cada corte conserva sus propias cifras. Para actualizar un parcial se agrega un corte nuevo; el anterior queda como historial.</p>
    <p>Las tablas muestran un periodo por año, el corte más reciente. Todos los cálculos que necesitan un periodo anterior usan la <strong>base</strong> del corte: el cierre del año anterior.</p>
  </div>
  <div class="scroll"><table class="simple">
    <thead><tr><th scope="col">Comparación</th><th scope="col">Regla</th></tr></thead>
    <tbody>
      <tr><td>Contra el cierre del año anterior</td><td>Es la comparación de todas las tablas. El parcial se lleva a 12 meses para compararlo con el año completo.</td></tr>
      <tr><td>Contra el corte anterior del mismo año</td><td>Octubre contra junio. Como octubre trae más meses acumulados, el cambio en monto compara ambos llevados a 12 meses: mide si el ritmo del año mejoró. Los porcentajes sobre ventas, los días y las razones se comparan directo.</td></tr>
      <tr><td>Contra el mismo corte del año anterior</td><td>Octubre de este año contra octubre del pasado. Mismos meses, sin anualizar nada. Es la comparación que mejor respeta la estacionalidad.</td></tr>
    </tbody>
  </table></div>
  <p class="nota">El bloque Flujo de efectivo no se compara entre cortes: cada cifra es el flujo de ese periodo contra su cierre anterior.</p>
</section>

<section class="bloque" id="pendientes">
  <h2>Por definir con el mentor</h2>
  <div class="prose">
    <ul>
      <li><strong>Rangos de color.</strong> Los rangos de las tablas son de referencia general para PyMEs mexicanas. Si algún rango de Liquidez, Solvencia o Rentabilidad debe cambiar, basta indicar los nuevos límites de verde y ámbar por indicador.</li>
      <li><strong>Tendencia en Flujo de efectivo.</strong> Hoy sus flechas van en gris. Falta decidir si la columna se quita en ese bloque.</li>
      <li><strong>Parcial contra año completo.</strong> Hoy se anualiza. Falta confirmar que así debe quedar.</li>
    </ul>
  </div>
</section>
</div>
`;

const head = `<title>Cálculos del Análisis Financiero</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@500;600&display=swap">
<style>${style}</style>`;

const full = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<style>body { margin: 0; }</style>
</head>
<body>
${body}
</body>
</html>
`;

const out = join(root, "docs", "Como_se_calcula_Analisis_Financiero.html");
writeFileSync(out, full);
console.log("escrito", out);
const i = process.argv.indexOf("--fragment");
if (i !== -1 && process.argv[i + 1]) {
  writeFileSync(process.argv[i + 1], `${head}\n${body}`);
  console.log("escrito", process.argv[i + 1]);
}
