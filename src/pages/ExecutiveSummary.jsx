import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Sparkles,
  Printer,
  ShieldCheck,
  Compass,
  Calculator,
  Info,
  RefreshCw,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { MODULES, canAccessModule } from "@/config/modules";
import { callIa, iaSavedResult, fmtUsd, IaError } from "@/api/ia";
import IaDisclaimer from "@/components/ia/IaDisclaimer";

// ============================================================
// Resumen ejecutivo con IA.
// ------------------------------------------------------------
// Página fuera de los módulos (el Layout la muestra en modo "launcher", sin
// menú lateral): pide a la Edge Function `ia` la acción `resumen_ejecutivo`,
// que junta la matriz de riesgos, la planeación estratégica y el análisis
// financiero del usuario en un documento redactado para el dueño o director.
// Al abrir se muestra el último resumen guardado (ia_resultados). "Generar" /
// "Volver a generar" lo piden SIN `force`: si los datos no cambiaron, el
// servidor devuelve la versión guardada (cached, sin costo) y aparece un botón
// secundario para forzar una nueva. Se imprime con `window.print()`: la
// cabecera, los botones y la barra superior del Layout se ocultan en papel.
// ============================================================

const KIND = "resumen_ejecutivo";
// Texto que manda la IA cuando un módulo no trae datos (ver actions/resumen.ts).
const SIN_DATOS = "sin información capturada";

// Las tres secciones del documento: el módulo de la app que las alimenta y
// sus colores (los mismos de src/config/modules.js). Las clases van
// completas para que Tailwind las encuentre.
const SECTIONS = [
  {
    key: "riesgos",
    moduleKey: "risk",
    label: "Matriz de riesgos",
    home: "Dashboard",
    icon: ShieldCheck,
    accent: "text-emerald-500",
    bg: "bg-emerald-500/15",
    dot: "bg-emerald-500",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "planeacion",
    moduleKey: "strategic",
    label: "Planeación estratégica",
    home: "StrategicPlanning",
    icon: Compass,
    accent: "text-blue-500",
    bg: "bg-blue-500/15",
    dot: "bg-blue-500",
    chip: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    key: "finanzas",
    moduleKey: "fin-analysis",
    label: "Análisis financiero",
    home: "FinAnalysisHome",
    icon: Calculator,
    accent: "text-cyan-500",
    bg: "bg-cyan-500/15",
    dot: "bg-cyan-500",
    chip: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];
const TRANSVERSAL = { key: "transversal", label: "Transversal", chip: "border-accent/40 bg-accent/10 text-accent" };

const sectionOf = (key) => SECTIONS.find((s) => s.key === key) || null;
const labelOf = (key) => sectionOf(key)?.label || (key === "transversal" ? TRANSVERSAL.label : String(key));

// En papel se quita el relleno del contenido (la barra superior del Layout ya
// se oculta desde Layout.jsx); el resto lo resuelven las utilidades `print:`.
const PRINT_CSS = `
@media print {
  main { padding: 0 !important; }
}`;

const Spinner = () => <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />;

// Chip de un módulo en la fila "qué cubre el resumen".
function ModuleChip({ section, allowed }) {
  const Icon = section.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-subtitle border ${
        allowed ? section.chip : "border-[var(--card-border)] text-muted opacity-70"
      }`}
      title={allowed ? "Incluido en el resumen" : "No tienes acceso a este módulo"}
    >
      {allowed ? <Icon className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
      {section.label}
    </span>
  );
}

ModuleChip.propTypes = {
  section: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    chip: PropTypes.string.isRequired,
  }).isRequired,
  allowed: PropTypes.bool.isRequired,
};

// Sección de un módulo dentro del documento: encabezado con icono, párrafo y
// puntos. Si la IA no tuvo datos, lo dice en una línea.
function ModuleSection({ section, data }) {
  const Icon = section.icon;
  const texto = String(data?.texto || "").trim();
  const puntos = Array.isArray(data?.puntos) ? data.puntos.filter((p) => String(p || "").trim()) : [];
  const empty = !texto || (texto.toLowerCase() === SIN_DATOS && puntos.length === 0);
  return (
    <section className="space-y-3 break-inside-avoid">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${section.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${section.accent}`} />
        </div>
        <h3 className="font-title text-lg">{section.label}</h3>
      </div>
      {empty ? (
        <p className="text-sm text-muted italic">Sin información capturada en este módulo.</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{texto}</p>
          {puntos.length > 0 && (
            <ul className="space-y-1.5">
              {puntos.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${section.dot} mt-2 flex-shrink-0`} />
                  <span className="leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

ModuleSection.propTypes = {
  section: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    accent: PropTypes.string.isRequired,
    bg: PropTypes.string.isRequired,
    dot: PropTypes.string.isRequired,
  }).isRequired,
  data: PropTypes.shape({
    texto: PropTypes.string,
    puntos: PropTypes.arrayOf(PropTypes.string),
  }),
};

// Tarjeta numerada de una prioridad a 90 días, con el chip del módulo.
function PriorityCard({ index, item }) {
  const tag = sectionOf(item.modulo) || TRANSVERSAL;
  return (
    <div className="rounded-2xl border border-[var(--card-border)] p-4 space-y-2 break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-7 h-7 rounded-full bg-accent/15 text-accent font-subtitle text-sm flex items-center justify-center flex-shrink-0">
            {index}
          </span>
          <h4 className="font-subtitle text-sm leading-snug pt-1">{item.titulo}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-subtitle border whitespace-nowrap flex-shrink-0 ${tag.chip}`}>
          {tag.label}
        </span>
      </div>
      {item.por_que && <p className="text-sm text-muted leading-relaxed">{item.por_que}</p>}
      {item.responsable_sugerido && (
        <p className="text-xs">
          <span className="text-muted">Responsable sugerido: </span>
          <span className="font-subtitle">{item.responsable_sugerido}</span>
        </p>
      )}
    </div>
  );
}

PriorityCard.propTypes = {
  index: PropTypes.number.isRequired,
  item: PropTypes.shape({
    titulo: PropTypes.string,
    por_que: PropTypes.string,
    responsable_sugerido: PropTypes.string,
    modulo: PropTypes.string,
  }).isRequired,
};

export default function ExecutiveSummary() {
  const { isAdmin, grantedModules, loading: accessLoading } = useModuleAccess();

  // doc = { result, generated_at, cached, usage, source: 'guardado' | 'nuevo' }
  const [doc, setDoc] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null); // { code, message }
  const [notice, setNotice] = useState("");
  const abortRef = useRef(null);

  // Al abrir: el último resumen guardado, si existe (no llama a la IA).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await iaSavedResult(KIND);
        if (alive && saved?.result) {
          setDoc({ result: saved.result, generated_at: saved.created_at, cached: false, usage: null, source: "guardado" });
        }
      } catch (err) {
        console.error("No se pudo leer el resumen guardado:", err);
      } finally {
        if (alive) setLoadingSaved(false);
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  // Sin `force`, el servidor devuelve la versión guardada si los datos no
  // cambiaron (cached:true, sin costo); con `force` redacta una nueva.
  const generate = useCallback(async (force = false) => {
    setGenerating(true);
    setError(null);
    setNotice("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await callIa("resumen_ejecutivo", force ? { force: true } : {}, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setDoc({
        result: res.result,
        generated_at: res.generated_at,
        cached: !!res.cached,
        usage: res.usage || null,
        source: "nuevo",
      });
      if (res.cached) {
        setNotice("Tus datos no han cambiado desde la última vez; se muestra la versión guardada (sin costo).");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof IaError) {
        setError({ code: err.code, message: err.message });
      } else {
        console.error(err);
        setError({ code: "desconocido", message: "No pudimos generar el resumen. Inténtalo de nuevo." });
      }
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  }, []);

  // Qué módulos tiene el usuario (el resumen solo cubre esos).
  const sections = SECTIONS.map((s) => ({
    ...s,
    allowed: canAccessModule(
      MODULES.find((m) => m.key === s.moduleKey),
      { isAdmin, grantedModules },
    ),
  }));
  const allowed = sections.filter((s) => s.allowed);
  const missing = sections.filter((s) => !s.allowed);

  const r = doc?.result || null;
  const hasDoc = !!r;
  const prioridades = Array.isArray(r?.prioridades_90_dias) ? r.prioridades_90_dias : [];
  const sinDatos = Array.isArray(r?.modulos_sin_datos) ? r.modulos_sin_datos.filter(Boolean) : [];
  const noConfigurado = error?.code === "no_configurado";
  const sinDatosError = error?.code === "sin_datos";
  // Si ya no hay datos que resumir, no se pinta el documento guardado: solo el
  // estado vacío.
  const showDoc = hasDoc && !sinDatosError;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 print:pb-0">
      <style>{PRINT_CSS}</style>

      {/* Header (no se imprime) */}
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <Link to={createPageUrl("ModuleLauncher")} title="Volver a los módulos">
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-title">Resumen ejecutivo</h1>
            <p className="text-muted">
              Un documento que junta tu matriz de riesgos, tu planeación y tus finanzas, listo para compartir.
            </p>
          </div>
        </div>
        {/* En móvil los botones pasan a su propia línea. */}
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <Button
            onClick={() => generate()}
            disabled={generating || loadingSaved}
            variant="outline"
            className="glass hover:border-accent font-subtitle flex-grow sm:flex-grow-0"
          >
            {generating ? (
              <>
                <Spinner /> Pensando…
              </>
            ) : hasDoc ? (
              <>
                <RefreshCw className="w-4 h-4" /> Volver a generar
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generar con IA
              </>
            )}
          </Button>
          {showDoc && (
            <Button
              onClick={() => window.print()}
              disabled={generating}
              variant="outline"
              className="glass hover:border-accent font-subtitle flex-grow sm:flex-grow-0"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          )}
        </div>
      </div>

      {/* Qué módulos cubre */}
      {!accessLoading && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs text-muted">Cubre los módulos a los que tienes acceso:</span>
          {sections.map((s) => (
            <ModuleChip key={s.key} section={s} allowed={s.allowed} />
          ))}
          {missing.length > 0 && allowed.length > 0 && (
            <span className="text-xs text-muted basis-full">
              No incluye {missing.map((s) => s.label.toLowerCase()).join(" ni ")}: no tienes acceso a{" "}
              {missing.length > 1 ? "esos módulos" : "ese módulo"}.
            </span>
          )}
        </div>
      )}

      {/* Aviso: se devolvió el guardado (y botón para forzar una versión nueva) */}
      {notice && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-sm flex flex-wrap items-center gap-2 print:hidden">
          <Info className="w-4 h-4 flex-shrink-0 text-accent" />
          <span className="flex-1 min-w-[12rem]">{notice}</span>
          <Button variant="ghost" size="sm" onClick={() => generate(true)} disabled={generating} className="font-subtitle">
            <RefreshCw className="w-4 h-4" /> Generar de nuevo de todos modos
          </Button>
        </div>
      )}

      {/* Errores */}
      {error && !sinDatosError && (
        <div
          className={`p-4 rounded-xl text-sm border print:hidden ${
            noConfigurado
              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-red-500/10 border-red-500/20 text-red-500"
          }`}
        >
          {error.message}
        </div>
      )}

      {/* Sin datos en ningún módulo */}
      {sinDatosError && (
        <Card className="glass print:hidden">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-accent/15 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <p className="font-subtitle">Aún no hay información para resumir</p>
            <p className="text-sm text-muted max-w-md mx-auto">
              Captura al menos un módulo (tus riesgos, tu plan estratégico o tus estados financieros) y vuelve
              aquí para generar el resumen.
            </p>
            {allowed.length > 0 && (
              <div className="flex justify-center gap-3 flex-wrap">
                {allowed.map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link key={s.key} to={createPageUrl(s.home)}>
                      <Button variant="outline" className="glass hover:border-accent font-subtitle">
                        <Icon className={`w-4 h-4 ${s.accent}`} /> {s.label} →
                      </Button>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cargando el guardado */}
      {loadingSaved && (
        <div className="flex items-center gap-3 text-sm text-muted print:hidden">
          <Spinner /> Buscando tu último resumen…
        </div>
      )}

      {/* Intro: todavía no hay resumen */}
      {!loadingSaved && !hasDoc && !generating && !sinDatosError && (
        <Card className="glass print:hidden">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted leading-relaxed">
                Con un clic, el asistente lee lo que ya capturaste en tus módulos y redacta un resumen ejecutivo:
                la situación general, una lectura por módulo, las <strong>prioridades para los próximos 90 días</strong>{" "}
                y un cierre. Puedes imprimirlo o guardarlo como PDF para tu cliente, tu equipo o tus socios.
              </p>
              <p className="text-xs text-muted">
                Se guarda el último resumen generado. Si tus datos no cambian, volver a pedirlo muestra la versión
                guardada sin costo; puedes forzar una nueva.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generando */}
      {generating && (
        <Card className="glass print:hidden">
          <CardContent className="p-6 flex items-center gap-3 text-sm">
            <Spinner />
            <span>
              <span className="font-subtitle">Pensando…</span>{" "}
              <span className="text-muted">Estamos leyendo tus módulos y redactando el documento; puede tardar un minuto.</span>
            </span>
          </CardContent>
        </Card>
      )}

      {/* Documento */}
      {showDoc && (
        <Card className={`glass transition-opacity ${generating ? "opacity-50" : ""}`}>
          <CardContent className="p-6 md:p-10 space-y-8">
            {/* Portada */}
            <header className="space-y-1 border-b border-[var(--card-border)] pb-5">
              <p className="text-xs uppercase tracking-wider text-accent font-subtitle">Resumen ejecutivo</p>
              <h2 className="text-2xl md:text-3xl font-title">{r.titulo || "Resumen ejecutivo"}</h2>
              {r.fecha_texto && <p className="text-sm text-muted">{r.fecha_texto}</p>}
            </header>

            {/* Resumen general */}
            <section className="space-y-2 break-inside-avoid">
              <h3 className="font-title text-lg">Resumen general</h3>
              <p className="text-sm leading-relaxed">{r.resumen_general}</p>
              {sinDatos.length > 0 && (
                <p className="text-xs text-muted flex items-start gap-2 pt-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    Sin información capturada en: {sinDatos.map(labelOf).join(", ")}. El resumen no{" "}
                    {sinDatos.length > 1 ? "los" : "lo"} considera.
                  </span>
                </p>
              )}
            </section>

            {/* Por módulo */}
            {SECTIONS.map((s) => (
              <ModuleSection key={s.key} section={s} data={r[s.key]} />
            ))}

            {/* Prioridades */}
            {prioridades.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-title text-lg">Prioridades para los próximos 90 días</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {prioridades.map((p, i) => (
                    <PriorityCard key={i} index={i + 1} item={p} />
                  ))}
                </div>
              </section>
            )}

            {/* Cierre */}
            {r.cierre && (
              <section className="border-l-2 border-accent pl-4 space-y-1 break-inside-avoid">
                <h3 className="font-title text-lg">Cierre</h3>
                <p className="text-sm leading-relaxed">{r.cierre}</p>
              </section>
            )}

            {/* Pie */}
            <footer className="space-y-1 pt-4 border-t border-[var(--card-border)]">
              <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                <IaDisclaimer generatedAt={doc.generated_at} cached={doc.cached} />
                {doc.usage && (
                  <span className="text-[11px] text-muted print:hidden">· costo aprox. {fmtUsd(doc.usage.cost_usd)}</span>
                )}
              </div>
              {doc.source === "guardado" && (
                <p className="text-[11px] text-muted print:hidden">
                  Es tu último resumen guardado. Si capturaste datos nuevos, usa «Volver a generar».
                </p>
              )}
            </footer>
          </CardContent>
        </Card>
      )}

      {/* Regreso (no se imprime) */}
      <div className="flex justify-start print:hidden">
        <Link to={createPageUrl("ModuleLauncher")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4" /> Volver a los módulos
          </Button>
        </Link>
      </div>
    </div>
  );
}
