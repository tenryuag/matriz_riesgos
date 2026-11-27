import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Waypoints, Sparkles, Printer, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMeasurement } from "@/hooks/useMeasurement";
import { useReadOnly } from "@/components/ReadOnlyContext";
import DependencyHeader from "@/components/dependency/DependencyHeader";
import AutoTextarea from "@/components/dependency/AutoTextarea";
import CategoryChip from "@/components/dependency/CategoryChip";
import IaDisclaimer from "@/components/ia/IaDisclaimer";
import { CATEGORY_STYLES, FIELD_CLASS } from "@/components/dependency/styles";
import { DepActivity, DepDecision, DepDiagnosis } from "@/api/dependency";
import { callIa, IaError, fmtUsd } from "@/api/ia";
import {
  CATEGORIES,
  INTERVENTION_BY_KEY,
  LIMITS,
  MAP_SECTIONS,
  buildInput,
  decisionsByType,
  formatDuration,
  formatPct,
  inputHash,
  precheck,
} from "@/config/dependencyCalc";

// Mapa de dependencia: el resultado de la semana. Aquí se pide el análisis
// (acción `mapa_dependencia` del asistente) y se lee el documento:
//
//   1. Antes de analizar: revisión de los registros y aclaraciones.
//   2. Preguntas de validación (de cero a tres, se contestan o se saltan en
//      un solo paso; lo que no se conteste queda como dato a validar).
//   3. Línea base (las fórmulas del método, calculadas por la app) con la
//      interpretación de cada clasificación, y los seis apartados del mapa.
//
// El documento es una foto: guarda las cifras que leyó el asistente. Si los
// registros cambian después, se avisa y se ofrece volver a analizar.
// Imprimir → «Guardar como PDF» entrega el documento sin los controles.

const PHASES = {
  clasificar: "Clasificando tus actividades…",
  redactar: "Redactando tu mapa de dependencia…",
  reclasificar: "Tus respuestas cambiaron la clasificación de algunas actividades. Redactando con la línea base recalculada…",
  corregir: "Revisando la redacción contra las reglas del método…",
};

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0" />
);

// Párrafos separados por una línea en blanco.
function Paragraphs({ text }) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => (
      <p key={i} className="leading-relaxed">
        {p}
      </p>
    ));
}
Paragraphs.propTypes = { text: PropTypes.string };

// Lo que conviene revisar antes de gastar un análisis.
function Checks({ checks }) {
  if (checks.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-green-600 dark:text-green-500">
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> Tus registros están completos para el análisis.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {checks.map((c, i) => (
        <li
          key={`${c.code}-${i}`}
          className={`flex items-start gap-2 ${c.level === "bloqueo" ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}
Checks.propTypes = { checks: PropTypes.array.isRequired };

// Línea base, parte 2: decisiones por tipo de intervención. Se puede ver
// antes del análisis (no depende de la clasificación).
function DecisionsTable({ rows, total, untyped }) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-card-border text-left">
              <th className="p-2 font-subtitle">Tipo de intervención</th>
              <th className="p-2 font-subtitle text-right">Cantidad</th>
              <th className="p-2 font-subtitle text-right whitespace-nowrap">Tiempo invertido (h y min)</th>
              <th className="p-2 font-subtitle text-right whitespace-nowrap">% del tiempo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.clave} className="border-b border-card-border/50">
                <td className="p-2">{INTERVENTION_BY_KEY[r.clave]?.label || r.clave}</td>
                <td className="p-2 text-right">{r.cantidad}</td>
                <td className="p-2 text-right whitespace-nowrap">{formatDuration(r.minutos)}</td>
                <td className="p-2 text-right">{formatPct(r.pct)}</td>
              </tr>
            ))}
            <tr className="bg-accent/10 font-subtitle">
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{total.cantidad}</td>
              <td className="p-2 text-right whitespace-nowrap">{formatDuration(total.minutos)}</td>
              <td className="p-2 text-right">{formatPct(total.pct)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {untyped.cantidad > 0 && (
        <p className="text-xs text-muted">
          {untyped.cantidad === 1 ? "Un registro no indica" : `${untyped.cantidad} registros no indican`} el tipo de
          intervención: su tiempo cuenta en el total, pero no en las filas.
        </p>
      )}
    </div>
  );
}
DecisionsTable.propTypes = {
  rows: PropTypes.array.isRequired,
  total: PropTypes.object.isRequired,
  untyped: PropTypes.object.isRequired,
};

// Línea base, parte 1: % del tiempo por clasificación + interpretación.
function TimeDistribution({ baseline, interpretations }) {
  const byKey = Object.fromEntries(baseline.tiempo.filas.map((f) => [f.clave, f]));
  return (
    <div className="space-y-4">
      {CATEGORIES.map((c) => {
        const f = byKey[c.key] || { pct: 0 };
        return (
          <div key={c.key} className="grid gap-x-5 gap-y-2 md:grid-cols-[12rem_minmax(0,1fr)] break-inside-avoid">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <CategoryChip category={c.key} />
                <span className="font-title text-xl tabular-nums">{formatPct(f.pct)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
                <div
                  className={`h-full rounded-full ${CATEGORY_STYLES[c.key].bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, f.pct * 100))}%`, printColorAdjust: "exact" }}
                />
              </div>
            </div>
            <p className="text-sm leading-relaxed">{interpretations?.[c.key]}</p>
          </div>
        );
      })}
    </div>
  );
}
TimeDistribution.propTypes = {
  baseline: PropTypes.object.isRequired,
  interpretations: PropTypes.object,
};

export default function DependencyMap() {
  const { list, measurement, loading: loadingMeasurement, error: measurementError, select, save } = useMeasurement();
  const readOnly = useReadOnly();
  const measurementId = measurement?.id || null;
  const [records, setRecords] = useState(null); // { id, activities, decisions }
  const [diagnosis, setDiagnosis] = useState(null);
  const [notes, setNotes] = useState("");
  const [simultaneous, setSimultaneous] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [hash, setHash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Registros y diagnóstico de la medición abierta.
  useEffect(() => {
    if (!measurementId) return undefined;
    let active = true;
    setLoadError("");
    setError(null);
    (async () => {
      try {
        const [activities, decisions, diag] = await Promise.all([
          DepActivity.list(measurementId),
          DepDecision.list(measurementId),
          DepDiagnosis.get(measurementId),
        ]);
        if (!active) return;
        setRecords({ id: measurementId, activities, decisions });
        setDiagnosis(diag);
        setAnswers((diag?.questions || []).map((q) => q.respuesta || ""));
      } catch (err) {
        if (!active) return;
        console.error("Error al cargar el mapa de dependencia:", err);
        setLoadError("No pudimos cargar la información. Intenta recargar la página.");
      }
    })();
    return () => {
      active = false;
    };
  }, [measurementId]);

  // Aclaraciones de la medición (se editan aquí, antes de analizar).
  useEffect(() => {
    setNotes(measurement?.notes || "");
    setSimultaneous(!!measurement?.simultaneous);
    // Solo al cambiar de medición: mientras se escribe manda el estado local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementId]);

  const ready = !!measurementId && records?.id === measurementId;

  const input = useMemo(() => {
    if (!ready) return null;
    return buildInput({
      measurement: { ...measurement, notes, simultaneous },
      activities: records.activities,
      decisions: records.decisions,
    });
  }, [ready, measurement, notes, simultaneous, records]);

  const checks = useMemo(() => (input ? precheck(input) : []), [input]);
  const blocked = checks.some((c) => c.level === "bloqueo");
  const liveDecisions = useMemo(() => (input ? decisionsByType(input.decisiones) : null), [input]);

  // Huella de los registros actuales, para saber si el diagnóstico guardado
  // sigue correspondiendo a ellos.
  useEffect(() => {
    if (!input) {
      setHash(null);
      return undefined;
    }
    let active = true;
    inputHash(input).then((h) => {
      if (active) setHash(h);
    });
    return () => {
      active = false;
    };
  }, [input]);

  const stale = !!diagnosis && !!hash && diagnosis.input_hash !== hash;
  const status = diagnosis && !stale ? diagnosis.status : diagnosis?.status === "listo" ? "listo" : null;
  const result = diagnosis?.status === "listo" ? diagnosis.result : null;
  const questions = status === "preguntas" ? diagnosis.questions || [] : [];

  const saveNotes = useCallback(async () => {
    if ((measurement?.notes || "") === notes.trim() && !!measurement?.simultaneous === simultaneous) return;
    await save({ notes: notes.trim(), simultaneous });
  }, [measurement, notes, simultaneous, save]);

  // Pide el análisis y repite mientras el servidor diga que falta un paso
  // (cada petición hace una sola llamada a la IA).
  const run = async (options = {}) => {
    if (busy || !measurementId) return;
    setBusy(true);
    setError(null);
    try {
      await saveNotes();
      let params = { measurement_id: measurementId, ...options };
      let stage = options.respuestas || (status === "clasificado" && !options.reiniciar) ? "redactar" : "clasificar";
      for (let i = 0; i < 5; i += 1) {
        setPhase(stage);
        const res = await callIa("mapa_dependencia", params);
        const next = await DepDiagnosis.get(measurementId);
        if (!mounted.current) return;
        setDiagnosis(next);
        setAnswers((next?.questions || []).map((q) => q.respuesta || ""));
        const r = res.result || {};
        if (r.estado !== "clasificado") break;
        stage = r.corrigiendo ? "corregir" : r.reclasificadas ? "reclasificar" : "redactar";
        params = { measurement_id: measurementId };
      }
    } catch (err) {
      if (!mounted.current) return;
      console.error("mapa_dependencia:", err);
      setError(err instanceof IaError ? err : new IaError("desconocido"));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setPhase(null);
      }
    }
  };

  const reanalyze = () => {
    if (!stale && !window.confirm("Se generará un diagnóstico nuevo que sustituye al actual. ¿Continuar?")) return;
    run(stale ? {} : { reiniciar: true });
  };

  // El PDF toma su nombre del título de la página.
  const print = () => {
    const previous = document.title;
    const who = (measurement?.person_name || "").trim();
    document.title = ["VIA Mapa de Dependencia", who, (measurement?.title || "").trim()].filter(Boolean).join(" - ");
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const loading = loadingMeasurement || (!!measurementId && !ready && !loadError);
  const informative = error?.code === "no_configurado";
  const generatedAt = diagnosis?.generated_at || null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 print:pb-0 print:space-y-4">
      <DependencyHeader
        icon={Waypoints}
        title="Mapa de dependencia"
        subtitle="La línea base de tu semana y el diagnóstico de dónde se concentra tu intervención."
        list={list}
        measurement={measurement}
        onSelect={select}
      >
        {result && (
          <Button onClick={print} variant="outline" className="glass hover:border-accent font-subtitle w-full sm:w-auto">
            <Printer className="w-4 h-4 mr-2" /> Imprimir o guardar en PDF
          </Button>
        )}
      </DependencyHeader>

      {(measurementError || loadError) && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {measurementError || loadError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : !measurement ? (
        !measurementError && (
          <Card className="glass">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm">Aún no hay una medición. Crea la tuya y registra tu semana para obtener el mapa.</p>
              <Link to={createPageUrl("DependencyHome")}>
                <Button className="font-subtitle">
                  Ir al inicio del módulo <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )
      ) : (
        ready && (
          <>
            {/* Avance del análisis */}
            {busy && (
              <div className="glass rounded-2xl px-4 py-3 flex items-start gap-3 text-sm print:hidden" role="status">
                <Spinner />
                <div>
                  <p className="font-subtitle">{PHASES[phase] || "Trabajando…"}</p>
                  <p className="text-xs text-muted">Puede tardar uno o dos minutos. No cierres esta pantalla.</p>
                </div>
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

            {/* Los registros cambiaron después del diagnóstico */}
            {stale && result && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="flex-grow min-w-[14rem]">
                  Tus registros o aclaraciones cambiaron después de este diagnóstico: el documento muestra el análisis
                  anterior.
                </span>
                <Button data-edit size="sm" onClick={reanalyze} disabled={busy || blocked} className="font-subtitle print:hidden">
                  <RefreshCw className="w-4 h-4 mr-2" /> Volver a analizar
                </Button>
              </div>
            )}

            {/* 1. Antes de analizar */}
            {(!status || (stale && result)) && (
              <Card className="glass print:hidden">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h2 className="font-subtitle text-lg">Antes de analizar</h2>
                    <p className="text-sm text-muted">
                      {input.bitacora.length} {input.bitacora.length === 1 ? "actividad" : "actividades"} en la
                      bitácora y {input.decisiones.length}{" "}
                      {input.decisiones.length === 1 ? "registro" : "registros"} en «Decisiones que tomas».
                    </p>
                  </div>
                  <Checks checks={checks} />
                  <div className="space-y-2">
                    <label htmlFor="dep-notes" className="block text-sm font-subtitle">
                      Aclaraciones para el análisis <span className="text-muted font-normal">(opcional)</span>
                    </label>
                    <AutoTextarea
                      id="dep-notes"
                      value={notes}
                      onChange={setNotes}
                      onBlur={() => saveNotes().catch((e) => console.error(e))}
                      maxLength={4000}
                      placeholder="Por ejemplo: qué actividades hiciste al mismo tiempo, si fue una semana atípica o si faltó registrar algún día."
                      className={FIELD_CLASS}
                    />
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simultaneous}
                        onChange={(e) => {
                          setSimultaneous(e.target.checked);
                          save({ notes: notes.trim(), simultaneous: e.target.checked }).catch((err) => console.error(err));
                        }}
                        className="mt-1 accent-[rgb(221,191,90)]"
                      />
                      <span>
                        Registré actividades que hice al mismo tiempo.
                        <span className="block text-xs text-muted">
                          Los minutos acumulados no se leerán como horas de jornada.
                        </span>
                      </span>
                    </label>
                  </div>
                  {!(stale && result) && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button data-edit onClick={() => run()} disabled={busy || blocked} className="font-subtitle">
                        {busy ? <Spinner /> : <Sparkles className="w-4 h-4" />}
                        <span className="ml-2">Analizar mi semana</span>
                      </Button>
                      <span className="text-xs text-muted">
                        El asistente clasifica tus actividades, puede hacerte hasta {LIMITS.questions} preguntas y
                        redacta el mapa.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 2. Preguntas de validación */}
            {status === "preguntas" && (
              <Card className="glass border-accent/40 print:hidden">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h2 className="font-subtitle text-lg">Antes de redactar tu mapa</h2>
                    <p className="text-sm text-muted">
                      Tus actividades ya están clasificadas. {questions.length === 1 ? "Esta respuesta puede" : "Estas respuestas pueden"}{" "}
                      cambiar el diagnóstico. Si no conoces alguna, déjala en blanco: quedará como dato a validar.
                    </p>
                  </div>
                  <ol className="space-y-5">
                    {questions.map((q, i) => (
                      <li key={i} className="space-y-2">
                        <label htmlFor={`dep-q-${i}`} className="block">
                          <span className="font-subtitle">
                            {i + 1}. {q.pregunta}
                          </span>
                          {q.contexto && <span className="block text-xs text-muted mt-1">{q.contexto}</span>}
                        </label>
                        <AutoTextarea
                          id={`dep-q-${i}`}
                          value={answers[i] || ""}
                          onChange={(v) => setAnswers((prev) => questions.map((_, j) => (j === i ? v : prev[j] || "")))}
                          maxLength={LIMITS.answerLength}
                          placeholder="Tu respuesta"
                          className={FIELD_CLASS}
                        />
                      </li>
                    ))}
                  </ol>
                  {readOnly ? (
                    <p className="text-sm text-muted">Quien tenga permiso de edición debe responder para continuar.</p>
                  ) : (
                    <Button
                      data-edit
                      onClick={() => run({ respuestas: questions.map((_, i) => answers[i] || "") })}
                      disabled={busy}
                      className="font-subtitle"
                    >
                      {busy ? <Spinner /> : <Sparkles className="w-4 h-4" />}
                      <span className="ml-2">Generar mi mapa</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* El análisis quedó a medias (se cerró la pantalla o falló un paso) */}
            {status === "clasificado" && !busy && (
              <Card className="glass border-accent/40 print:hidden">
                <CardContent className="p-6 flex flex-wrap items-center gap-4">
                  <p className="text-sm flex-grow min-w-[14rem]">
                    Tus actividades ya están clasificadas; falta redactar el mapa.
                  </p>
                  <Button data-edit onClick={() => run()} className="font-subtitle">
                    <Sparkles className="w-4 h-4 mr-2" /> Continuar el análisis
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 3. Documento */}
            {result ? (
              <article className="space-y-6 print:space-y-4">
                <header className="space-y-1 border-b border-accent/50 pb-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent font-subtitle">Modo Director · Semana 1</p>
                  <h2 className="text-2xl font-title">VIA Mapa de Dependencia</h2>
                  <p className="text-sm text-muted">
                    {[measurement.person_name, measurement.job_title, measurement.title].filter(Boolean).join(" · ") ||
                      "Medición sin datos de la persona"}
                  </p>
                </header>

                <Card className="glass">
                  <CardContent className="p-6 space-y-5">
                    <div>
                      <h3 className="font-subtitle text-lg">Línea base · Distribución del tiempo registrado</h3>
                      <p className="text-xs text-muted">
                        Porcentaje de los minutos declarados en la bitácora ({result.linea_base.tiempo.actividades}{" "}
                        actividades, {formatDuration(result.linea_base.tiempo.total_minutos)}).
                        {measurement.simultaneous
                          ? " Hubo actividades simultáneas: el tiempo acumulado no equivale a horas de jornada."
                          : ""}
                      </p>
                    </div>
                    <TimeDistribution baseline={result.linea_base} interpretations={result.interpretaciones} />
                  </CardContent>
                </Card>

                <Card className="glass break-inside-avoid">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="font-subtitle text-lg">Línea base · Decisiones que tomas por tipo de intervención</h3>
                      <p className="text-xs text-muted">
                        El tiempo de las decisiones se reporta aparte: no se suma al de la bitácora.
                      </p>
                    </div>
                    <DecisionsTable
                      rows={result.linea_base.decisiones.filas}
                      total={result.linea_base.decisiones.total}
                      untyped={result.linea_base.decisiones.sin_tipo}
                    />
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <h3 className="font-subtitle text-lg">Mapa de dependencia</h3>
                      <p className="text-xs text-muted">
                        Síntesis ejecutiva de tu situación actual y de las condiciones que generan dependencia.
                      </p>
                    </div>
                    {MAP_SECTIONS.map((s, i) => (
                      <section key={s.key} className="space-y-2">
                        <h4 className="text-xs uppercase tracking-[0.12em] font-subtitle text-accent">
                          {i + 1}. {s.title}
                        </h4>
                        {s.key === "datos_a_validar" ? (
                          (result.mapa.datos_a_validar || []).length > 0 ? (
                            <ol className="list-decimal pl-5 space-y-1.5 text-sm leading-relaxed max-w-[75ch]">
                              {result.mapa.datos_a_validar.map((d, j) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-muted">Sin datos pendientes de validar.</p>
                          )
                        ) : (
                          <div className="space-y-3 text-sm max-w-[75ch]">
                            <Paragraphs text={result.mapa[s.key]} />
                          </div>
                        )}
                      </section>
                    ))}
                  </CardContent>
                </Card>

                {(diagnosis.questions || []).length > 0 && (
                  <details className="glass rounded-2xl px-4 py-3 text-sm print:hidden">
                    <summary className="cursor-pointer font-subtitle">Preguntas de validación y tus respuestas</summary>
                    <ol className="mt-3 space-y-3 list-decimal pl-5">
                      {diagnosis.questions.map((q, i) => (
                        <li key={i}>
                          <p>{q.pregunta}</p>
                          <p className="text-muted">{q.respuesta || "Sin respuesta: quedó como dato a validar."}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                {(result.avisos || []).length > 0 && (
                  <details className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm print:hidden">
                    <summary className="cursor-pointer font-subtitle">
                      Revisión automática: {result.avisos.length === 1 ? "un punto" : `${result.avisos.length} puntos`}{" "}
                      de la redacción por revisar
                    </summary>
                    <ul className="mt-3 space-y-1.5 list-disc pl-5 text-muted">
                      {result.avisos.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <footer className="flex flex-wrap items-start gap-x-1 gap-y-2 pt-1 border-t border-[var(--card-border)]">
                  <IaDisclaimer generatedAt={generatedAt} className="pt-2 basis-full" />
                  <p className="text-[11px] text-muted basis-full">
                    Método VIA Mapa de Dependencia, versión {diagnosis.prompt_version || "—"}
                    {Number(diagnosis.cost_usd) > 0 && (
                      <span className="print:hidden"> · costo aprox. {fmtUsd(diagnosis.cost_usd)}</span>
                    )}
                  </p>
                  {!stale && (
                    <div className="basis-full print:hidden">
                      <Button data-edit variant="ghost" size="sm" onClick={reanalyze} disabled={busy} className="font-subtitle">
                        <RefreshCw className="w-4 h-4 mr-2" /> Volver a analizar
                      </Button>
                    </div>
                  )}
                </footer>
              </article>
            ) : (
              /* Sin diagnóstico todavía: lo que ya se puede calcular */
              liveDecisions &&
              liveDecisions.records > 0 && (
                <Card className="glass print:hidden">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="font-subtitle text-lg">Decisiones que tomas por tipo de intervención</h3>
                      <p className="text-xs text-muted">
                        Esta parte de la línea base no necesita análisis: se calcula con lo que llevas registrado.
                      </p>
                    </div>
                    <DecisionsTable
                      rows={liveDecisions.rows.map((r) => ({ clave: r.key, cantidad: r.count, minutos: r.minutes, pct: r.pct }))}
                      total={{ cantidad: liveDecisions.total.count, minutos: liveDecisions.total.minutes, pct: liveDecisions.total.pct }}
                      untyped={{ cantidad: liveDecisions.untyped.count, minutos: liveDecisions.untyped.minutes }}
                    />
                  </CardContent>
                </Card>
              )
            )}
          </>
        )
      )}
    </div>
  );
}
