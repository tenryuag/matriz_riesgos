import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { callIa, iaSavedResult, IaError, fmtUsd } from "@/api/ia";
import IaDisclaimer from "@/components/ia/IaDisclaimer";
import { SemaforoDot, STATUS_STYLES } from "@/components/fin/Semaforo";

// Explicación con IA del Informe financiero (acción `interpretar_informe`).
// Al abrir muestra el diagnóstico guardado si existe. El botón pide uno nuevo
// SIN `force`: si las cifras no cambiaron, el servidor devuelve la versión
// guardada (cached, sin costo) y aparece un botón secundario para forzar una
// nueva. La tarjeta se imprime junto con los cuadros; los botones no.

// Chip de salud general: reutiliza los colores del semáforo de las razones.
const SALUD = {
  sana: { status: "verde", label: "Sana" },
  vigilar: { status: "ambar", label: "Vigilar" },
  atender: { status: "rojo", label: "Atender" },
};

const Spinner = () => <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />;

function SaludChip({ salud }) {
  const s = SALUD[salud] || SALUD.vigilar;
  const style = STATUS_STYLES[s.status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-subtitle border border-[var(--card-border)] whitespace-nowrap ${style.text}`}
    >
      <SemaforoDot status={s.status} />
      Salud general: {s.label}
    </span>
  );
}

SaludChip.propTypes = {
  salud: PropTypes.oneOf(["sana", "vigilar", "atender"]),
};

// Lista de hallazgos (fortalezas o alertas) con punto de color por renglón.
function Hallazgos({ titulo, items, vacio, status }) {
  return (
    <div className="space-y-2">
      <h3 className="font-subtitle text-sm">{titulo}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={`${it.clave || it.indicador}-${i}`} className="flex items-start gap-2 text-sm">
              <SemaforoDot status={status(it)} className="mt-1.5" />
              <div className="min-w-0">
                <p className="leading-relaxed">
                  <span className="font-subtitle">{it.indicador}</span>
                  {it.indicador && it.texto ? ": " : ""}
                  {it.texto}
                </p>
                {it.accion && (
                  <p className="text-xs text-muted italic mt-0.5">Acción: {it.accion}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

Hallazgos.propTypes = {
  titulo: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      indicador: PropTypes.string,
      clave: PropTypes.string,
      texto: PropTypes.string,
      accion: PropTypes.string,
      semaforo: PropTypes.string,
    })
  ).isRequired,
  vacio: PropTypes.string.isRequired,
  status: PropTypes.func.isRequired,
};

const list = (v) => (Array.isArray(v) ? v : []);

export default function IaInterpretacion({ ready = false }) {
  const [result, setResult] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [cached, setCached] = useState(false); // solo cuando el servidor responde cached:true
  const [source, setSource] = useState(null); // 'guardado' (leído al abrir) | 'nuevo' (respuesta del servidor)
  const [usage, setUsage] = useState(null);
  const [checking, setChecking] = useState(false); // buscando el guardado
  const [loading, setLoading] = useState(false); // llamando a la IA
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Al abrir, si hay cifras, mostramos la última explicación guardada (sin
  // gastar). Si la consulta falla solo dejamos el botón: no es un error del
  // usuario.
  useEffect(() => {
    if (!ready) return undefined;
    let active = true;
    setChecking(true);
    (async () => {
      try {
        const saved = await iaSavedResult("informe");
        if (active && saved?.result) {
          setResult(saved.result);
          setGeneratedAt(saved.created_at);
          setCached(false);
          setSource("guardado");
          setUsage(null);
        }
      } catch (err) {
        console.warn("No se pudo leer la explicación guardada:", err);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ready]);

  // Sin `force`, el servidor devuelve la versión guardada si las cifras no
  // cambiaron (cached:true, sin costo); con `force` genera una nueva.
  const generate = async (force = false) => {
    setLoading(true);
    setError(null);
    setNotice("");
    try {
      const res = await callIa("interpretar_informe", force ? { force: true } : {});
      if (!mounted.current) return;
      setResult(res.result);
      setGeneratedAt(res.generated_at);
      setCached(!!res.cached);
      setSource("nuevo");
      setUsage(res.usage || null);
      if (res.cached) {
        setNotice("Tus datos no han cambiado desde la última vez; se muestra la versión guardada (sin costo).");
      }
    } catch (err) {
      if (!mounted.current) return;
      console.error("interpretar_informe:", err);
      setError(err instanceof IaError ? err : new IaError("desconocido"));
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  if (!ready) return null;

  const fortalezas = list(result?.fortalezas);
  const alertas = list(result?.alertas);
  const tendencias = list(result?.tendencias);
  const preguntas = list(result?.preguntas_contador);
  const informative = error?.code === "no_configurado";

  return (
    <Card className={`glass border-accent/30 ${result ? "break-inside-avoid" : "print:hidden"}`}>
      <CardContent className="p-6 space-y-5">
        {/* Cabecera: título + botón */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0 print:hidden">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="font-subtitle text-lg">{result?.titulo || "Explicación con IA"}</h2>
              <p className="text-xs text-muted">
                {result?.periodo_analizado ||
                  "Un diagnóstico en lenguaje llano de tus cifras: qué va bien, qué atender y qué preguntarle a tu contador."}
              </p>
            </div>
          </div>
          <Button
            onClick={() => generate()}
            disabled={loading || checking}
            variant="outline"
            className="glass hover:border-accent font-subtitle flex-shrink-0 print:hidden"
          >
            {loading ? (
              <>
                <Spinner /> Pensando…
              </>
            ) : result ? (
              <>
                <RefreshCw className="w-4 h-4" /> Volver a generar
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Explicar con IA
              </>
            )}
          </Button>
        </div>

        {notice && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <p className="text-xs text-muted">{notice}</p>
            <Button variant="ghost" size="sm" onClick={() => generate(true)} disabled={loading} className="font-subtitle">
              <RefreshCw className="w-4 h-4" /> Generar de nuevo de todos modos
            </Button>
          </div>
        )}

        {error && (
          <div
            className={`p-3 rounded-xl text-sm print:hidden ${
              informative
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-red-500/10 border border-red-500/20 text-red-500"
            }`}
          >
            {error.message}
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <SaludChip salud={result.salud_general} />
            </div>

            {result.resumen && <p className="text-sm leading-relaxed">{result.resumen}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Hallazgos
                titulo="Fortalezas"
                items={fortalezas}
                vacio="Sin fortalezas destacadas en este periodo."
                status={() => "verde"}
              />
              <Hallazgos
                titulo="Alertas"
                items={alertas}
                vacio="Ningún indicador requiere atención especial."
                status={(a) => (a.semaforo === "rojo" ? "rojo" : "ambar")}
              />
            </div>

            {tendencias.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-subtitle text-sm">Tendencias</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
                  {tendencias.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {preguntas.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-subtitle text-sm">Preguntas para tu contador</h3>
                <ol className="list-decimal pl-5 space-y-1 text-sm leading-relaxed">
                  {preguntas.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
              </div>
            )}

            {result.conclusion && (
              <div className="border-l-2 border-accent pl-3">
                <h3 className="font-subtitle text-sm mb-1">Conclusión</h3>
                <p className="text-sm leading-relaxed">{result.conclusion}</p>
              </div>
            )}

            <div className="flex flex-wrap items-start gap-x-1 pt-1 border-t border-[var(--card-border)]">
              <IaDisclaimer generatedAt={generatedAt} cached={cached} className="pt-2" />
              {usage && (
                <span className="text-[11px] text-muted pt-2 print:hidden">
                  · costo aprox. {fmtUsd(usage.cost_usd)}
                </span>
              )}
              {source === "guardado" && (
                <p className="text-[11px] text-muted basis-full print:hidden">
                  Es tu última explicación guardada. Si capturaste datos nuevos, vuelve a generarla.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

IaInterpretacion.propTypes = {
  ready: PropTypes.bool,
};
