import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Waypoints, NotebookPen, MessagesSquare, ChevronRight, Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMeasurement } from "@/hooks/useMeasurement";
import { useReadOnly } from "@/components/ReadOnlyContext";
import DependencyHeader from "@/components/dependency/DependencyHeader";
import { FIELD_CLASS, measurementLabel } from "@/components/dependency/styles";
import { DepActivity, DepDecision, DepDiagnosis } from "@/api/dependency";
import { LIMITS, buildInput, dailySummary, formatDuration, inputHash } from "@/config/dependencyCalc";

// Inicio del módulo Mapa de dependencia (VIA · Modo Director · Semana 1).
// Aquí se crea la medición (de quién es el registro y de qué semana) y se ve
// el avance de sus tres pasos: bitácora, decisiones y mapa. Una empresa puede
// tener varias mediciones: el método compara la línea base al inicio y al
// cierre del programa.

// Orientación del método (hoja «Instrucciones» de la plantilla).
const GUIDE = [
  {
    title: "Propósito",
    text: "Registrar cómo utilizas tu tiempo y qué decisiones, autorizaciones o problemas requieren tu intervención. Esta información permite comprender cómo funciona hoy la empresa y dónde se concentra tu participación.",
  },
  {
    title: "Qué debes llenar",
    text: "Durante cinco días laborables, completa únicamente la Bitácora y las Decisiones que tomas. La línea base y el mapa no se llenan: la app calcula las cifras y el asistente clasifica tus actividades y redacta el diagnóstico.",
  },
  {
    title: "Qué incluir y qué no",
    text: "Incluye todas las actividades laborales, incluso las breves o repetitivas. No cambies tu forma de trabajar para que el registro se vea mejor. No elimines, delegues ni reorganices actividades durante esta semana como parte del ejercicio.",
  },
  {
    title: "Alcance",
    text: "Esta semana buscamos observar tu situación actual, no cambiarla. No necesitas decidir todavía qué actividades transferir, qué personas deberían asumirlas ni cómo reorganizar tu empresa. Ese trabajo se realizará después, a partir de la evidencia.",
  },
];

const EMPTY_FORM = { person_name: "", job_title: "", title: "" };

function MeasurementForm({ values, onChange, idPrefix }) {
  const label = "block text-xs text-muted mb-1";
  const field = (key, text, placeholder) => (
    <div>
      <label htmlFor={`${idPrefix}-${key}`} className={label}>
        {text}
      </label>
      <input
        id={`${idPrefix}-${key}`}
        type="text"
        value={values[key] || ""}
        onChange={(e) => onChange(key, e.target.value)}
        onBlur={(e) => onChange(key, e.target.value, true)}
        maxLength={200}
        placeholder={placeholder}
        className={FIELD_CLASS}
      />
    </div>
  );
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {field("person_name", "Nombre", "De quién es el registro")}
      {field("job_title", "Puesto", "Ej. Dirección general")}
      {field("title", "Semana", "Ej. 17 al 21 de noviembre de 2026")}
    </div>
  );
}
MeasurementForm.propTypes = {
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  idPrefix: PropTypes.string.isRequired,
};

function Step({ number, icon: Icon, title, detail, done, to }) {
  return (
    <Link to={createPageUrl(to)} className="block group">
      <Card className="glass h-full transition-colors group-hover:border-accent/60">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-violet-500" />
          </div>
          <div className="min-w-0 flex-grow">
            <p className="text-xs text-muted font-subtitle">Paso {number}</p>
            <h3 className="font-subtitle">{title}</h3>
            <p className={`text-sm mt-1 flex items-start gap-1.5 ${done ? "text-green-600 dark:text-green-500" : "text-muted"}`}>
              {done ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span>{detail}</span>
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 mt-2 group-hover:text-accent" />
        </CardContent>
      </Card>
    </Link>
  );
}
Step.propTypes = {
  number: PropTypes.number.isRequired,
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  done: PropTypes.bool,
  to: PropTypes.string.isRequired,
};

export default function DependencyHome() {
  const { list, measurement, loading, error, select, create, save, remove } = useMeasurement();
  const readOnly = useReadOnly();
  const measurementId = measurement?.id || null;
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [progress, setProgress] = useState(null); // { id, input, diagnosis, hash }

  useEffect(() => {
    setDraft({
      person_name: measurement?.person_name || "",
      job_title: measurement?.job_title || "",
      title: measurement?.title || "",
    });
    // Solo al cambiar de medición: mientras se escribe manda el estado local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementId]);

  // Avance de la medición abierta.
  useEffect(() => {
    if (!measurementId) return undefined;
    let active = true;
    (async () => {
      try {
        const [activities, decisions, diagnosis] = await Promise.all([
          DepActivity.list(measurementId),
          DepDecision.list(measurementId),
          DepDiagnosis.get(measurementId),
        ]);
        const input = buildInput({ measurement, activities, decisions });
        const hash = await inputHash(input);
        if (active) setProgress({ id: measurementId, input, diagnosis, hash });
      } catch (err) {
        console.error("Error al cargar el avance:", err);
      }
    })();
    return () => {
      active = false;
    };
    // El avance depende de los registros, no de los datos de la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementId, measurement?.notes, measurement?.simultaneous, measurement?.job_title, measurement?.title]);

  const steps = useMemo(() => {
    if (!progress || progress.id !== measurementId) return null;
    const { input, diagnosis, hash } = progress;
    const days = dailySummary(input.bitacora).filter((d) => d.fecha).length;
    const logMinutes = input.bitacora.reduce((s, a) => s + (a.minutos ?? 0), 0);
    const decMinutes = input.decisiones.reduce((s, d) => s + (d.minutos ?? 0), 0);
    const stale = !!diagnosis && !!hash && diagnosis.input_hash !== hash;
    let mapDetail = "Cuando termines de registrar, analiza tu semana.";
    let mapDone = false;
    if (diagnosis?.status === "listo" && !stale) {
      mapDone = true;
      const when = diagnosis.generated_at ? new Date(diagnosis.generated_at) : null;
      mapDetail = when
        ? `Listo: generado el ${when.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}.`
        : "Listo.";
    } else if (diagnosis?.status === "listo") {
      mapDetail = "Tus registros cambiaron después del diagnóstico: vuelve a analizar.";
    } else if (diagnosis?.status === "preguntas" && !stale) {
      mapDetail = "Faltan tus respuestas a las preguntas de validación.";
    } else if (diagnosis?.status === "clasificado" && !stale) {
      mapDetail = "El análisis quedó a medias: continúalo.";
    }
    return {
      log: {
        done: days >= LIMITS.workDays,
        detail:
          input.bitacora.length === 0
            ? "Aún sin registros."
            : `${input.bitacora.length} ${input.bitacora.length === 1 ? "actividad" : "actividades"} · ${days} de ${LIMITS.workDays} días · ${formatDuration(logMinutes)}`,
      },
      decisions: {
        done: input.decisiones.length > 0,
        detail:
          input.decisiones.length === 0
            ? "Aún sin registros."
            : `${input.decisiones.length} ${input.decisiones.length === 1 ? "registro" : "registros"} · ${formatDuration(decMinutes)}`,
      },
      map: { done: mapDone, detail: mapDetail },
    };
  }, [progress, measurementId]);

  const guard = async (fn) => {
    setWorking(true);
    setActionError("");
    try {
      await fn();
    } catch (err) {
      console.error("Mapa de dependencia:", err);
      setActionError("No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.");
    }
    setWorking(false);
  };

  // Los datos de la medición se guardan al salir de cada campo.
  const handleDraft = (key, value, commit = false) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (commit && (measurement?.[key] || "") !== value.trim()) guard(() => save({ [key]: value.trim() }));
  };

  const handleCreate = () =>
    guard(async () => {
      await create(newForm);
      setCreating(false);
      setNewForm(EMPTY_FORM);
    });

  const handleRemove = () => {
    const name = measurementLabel(measurement, list.indexOf(measurement));
    if (!window.confirm(`Se borrará «${name}» con su bitácora, sus decisiones y su diagnóstico. ¿Continuar?`)) return;
    guard(() => remove(measurement.id));
  };

  const startNew = () => {
    // Lo normal es una segunda medición de la misma persona.
    setNewForm({ person_name: measurement?.person_name || "", job_title: measurement?.job_title || "", title: "" });
    setCreating(true);
  };

  const guide = (
    <Card className="glass">
      <CardContent className="p-6 grid gap-5 md:grid-cols-2">
        {GUIDE.map((g) => (
          <div key={g.title}>
            <h3 className="text-xs uppercase tracking-[0.12em] font-subtitle text-accent mb-1">{g.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{g.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <DependencyHeader
        icon={Waypoints}
        title="Mapa de dependencia"
        subtitle="Modo Director · Semana 1. Radiografía de cómo usas tu tiempo y qué decisiones llegan a ti."
        list={list}
        measurement={measurement}
        onSelect={select}
        back={false}
      />

      {(error || actionError) && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error || actionError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : !measurement ? (
        !error && (
          <>
            {guide}
            <Card className="glass border-accent/40">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="font-subtitle text-lg">Empieza tu registro</h2>
                  <p className="text-sm text-muted">
                    {readOnly
                      ? "Aún no hay mediciones. Quien tenga permiso de edición puede crear la primera."
                      : "Indica de quién es el registro y de qué semana. Después podrás capturar tu bitácora desde la computadora o el celular."}
                  </p>
                </div>
                <MeasurementForm
                  idPrefix="first"
                  values={newForm}
                  onChange={(k, v) => setNewForm((prev) => ({ ...prev, [k]: v }))}
                />
                <Button data-edit onClick={handleCreate} disabled={working} className="font-subtitle">
                  <Plus className="w-4 h-4 mr-2" /> Crear mi medición
                </Button>
              </CardContent>
            </Card>
          </>
        )
      ) : (
        <>
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-subtitle text-lg">Datos de la medición</h2>
                  <p className="text-sm text-muted">Aparecen en el encabezado del documento final.</p>
                </div>
                <div className="flex flex-wrap gap-2" data-edit>
                  <Button variant="outline" size="sm" onClick={startNew} disabled={working} className="glass hover:border-accent font-subtitle">
                    <Plus className="w-4 h-4 mr-1.5" /> Nueva medición
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    disabled={working}
                    className="text-muted hover:text-red-500 font-subtitle"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Borrar
                  </Button>
                </div>
              </div>
              <MeasurementForm idPrefix="current" values={draft} onChange={handleDraft} />
            </CardContent>
          </Card>

          {creating && (
            <Card className="glass border-accent/40">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="font-subtitle text-lg">Nueva medición</h2>
                  <p className="text-sm text-muted">
                    Otra semana de registro, por ejemplo al cierre del programa, para compararla con la primera. La
                    actual se conserva.
                  </p>
                </div>
                <MeasurementForm
                  idPrefix="new"
                  values={newForm}
                  onChange={(k, v) => setNewForm((prev) => ({ ...prev, [k]: v }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button data-edit onClick={handleCreate} disabled={working} className="font-subtitle">
                    Crear medición
                  </Button>
                  <Button variant="ghost" onClick={() => setCreating(false)} className="font-subtitle">
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Step
              number={1}
              icon={NotebookPen}
              title="Bitácora"
              to="DependencyLog"
              done={steps?.log.done}
              detail={steps?.log.detail || "Tus actividades de cinco días laborables."}
            />
            <Step
              number={2}
              icon={MessagesSquare}
              title="Decisiones que tomas"
              to="DependencyDecisions"
              done={steps?.decisions.done}
              detail={steps?.decisions.detail || "Lo que otras personas llevaron a tu atención."}
            />
            <Step
              number={3}
              icon={Waypoints}
              title="Mapa de dependencia"
              to="DependencyMap"
              done={steps?.map.done}
              detail={steps?.map.detail || "Línea base y diagnóstico."}
            />
          </div>

          {guide}
        </>
      )}
    </div>
  );
}
