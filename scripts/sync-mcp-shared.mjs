// Copia los módulos puros (sin React) que comparten la app y el servidor
// MCP a supabase/functions/_shared/app. Córrelo antes de desplegar la
// función: `npm run mcp:sync`. La fuente de verdad es src/config.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "supabase", "functions", "_shared", "app");
mkdirSync(dest, { recursive: true });
for (const f of [
  "finConfig.js",
  "finCalc.js",
  "strategicCatalog.js",
  "strategicCalc.js",
  "perspectives.js",
  "riskCalc.js",
]) {
  copyFileSync(join(root, "src", "config", f), join(dest, f));
  console.log("sincronizado", f);
}
