import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { NotebookPen, Plus, Trash2, CalendarPlus, ArrowRight, Info } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import { useMeasurement } from "@/hooks/useMeasurement";
import SaveStatusBar from "@/components/SaveStatusBar";
import DependencyHeader from "@/components/dependency/DependencyHeader";
import AutoTextarea from "@/components/dependency/AutoTextarea";
import CategoryChip from "@/components/dependency/CategoryChip";
import { FIELD_CLASS, measurementLabel } from "@/components/dependency/styles";
import { DepActivity, DepDiagnosis, newRowId } from "@/api/dependency";
import { LIMITS, activityHasContent, formatDay, formatDuration, toMinutes } from "@/config/dependencyCalc";

// Bitácora de actividades (hoja «Bitácora» del método). Una fila por
// actividad o bloque de trabajo: qué hiciste, con qué propósito y cuántos
// minutos. Se captura día por día y se guarda sola; las filas en blanco no se
// guardan. La columna «Clasificación IA» no se captura: la llena el
// asistente al analizar la semana (pantalla «Mapa de dependencia»).

const NO_DATE = "sin-fecha";

// Fecha local de hoy como AAAA-MM-DD (sin pasar por UTC).
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toState = (a) => ({
  id: a.id,
  activity_date: a.activity_date || null,
  description: a.description || "",
  purpose: a.purpose || "",
  minutes: a.minutes === null || a.minutes === undefined ? "" : String(a.minutes),
  position: a.position || 0,
});

const sumMinutes = (list) => list.reduce((s, r) => s + (toMinutes(r.minutes) ?? 0), 0);

function ActivityRow({ row, index, category, showCategory, onChange, onRemove, onEnter }) {
  const label = "md:hidden block text-xs text-muted mb-1";
  return (
    <div className="grid gap-2 md:grid-cols-[1.75rem_minmax(0,1.25fr)_minmax(0,1fr)_6.5rem_7.5rem_2.25rem] md:items-start p-3 md:p-0 rounded-2xl md:rounded-none border border-[var(--card-border)] md:border-0">
      <span className="hidden md:block text-xs text-muted pt-3 text-right">{index + 1}</span>
      <div>
        <label htmlFor={`act-${row.id}`} className={label}>
          Actividad específica
        </label>
        <AutoTextarea
          id={`act-${row.id}`}
          value={row.description}
          onChange={(v) => onChange(row.id, "description", v)}
          placeholder="Qué hiciste, con quién y sobre qué"
          maxLength={2000}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor={`pur-${row.id}`} className={label}>
          Propósito / resultado buscado
        </label>
        <AutoTextarea
          id={`pur-${row.id}`}
          value={row.purpose}
          onChange={(v) => onChange(row.id, "purpose", v)}
          placeholder="Para qué lo hiciste"
          maxLength={2000}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex items-end gap-3 md:block">
        <div className="w-28 md:w-auto">
          <label htmlFor={`min-${row.id}`} className={label}>
            Tiempo (min)
          </label>
          <input
            id={`min-${row.id}`}
            type="number"
            inputMode="numeric"
            min="0"
            max="1440"
            step="1"
            value={row.minutes}
            onChange={(e) => onChange(row.id, "minutes", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter(row.id);
              }
            }}
            placeholder="min"
            className={`${FIELD_CLASS} text-right`}
          />
        </div>
        {showCategory && (
          <div className="md:hidden pb-2.5">
            <CategoryChip category={category} />
          </div>
        )}
        <button
          type="button"
          data-edit
          onClick={() => onRemove(row)}
          className="md:hidden ml-auto p-2.5 rounded-xl hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
          aria-label="Quitar actividad"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="hidden md:block pt-2.5">{showCategory ? <CategoryChip category={category} /> : <span className="text-xs text-muted">—</span>}</div>
      <button
        type="button"
        data-edit
        onClick={() => onRemove(row)}
        className="hidden md:block p-2.5 rounded-xl hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
        aria-label="Quitar actividad"
        title="Quitar actividad"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

ActivityRow.propTypes = {
  row: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  category: PropTypes.string,
  showCategory: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onEnter: PropTypes.func.isRequired,
};

export default function DependencyLog() {
  const { list, measurement, loading: loadingMeasurement, error: measurementError, select } = useMeasurement();
  const measurementId = measurement?.id || null;
  const [rows, setRows] = useState([]);
  const [loadedId, setLoadedId] = useState(null);
  const [classification, setClassification] = useState(null);
  const [extraDays, setExtraDays] = useState([]); // días agregados que aún no tienen filas guardadas
  const [day, setDay] = useState(null);
  const [newDay, setNewDay] = useState(today());
  const [error, setError] = useState("");
  const saved = useRef(new Map());

  useEffect(() => {
    if (!measurementId) return undefined;
    let active = true;
    setError("");
    (async () => {
      try {
        const [acts, diagnosis] = await Promise.all([
          DepActivity.list(measurementId),
          DepDiagnosis.get(measurementId).catch(() => null),
        ]);
        if (!active) return;
        const mapped = acts.map(toState);
        saved.current = DepActivity.savedMap(mapped);
        setRows(mapped);
        setExtraDays([]);
        setClassification(diagnosis?.classification || null);
        const dates = [...new Set(mapped.map((r) => r.activity_date || NO_DATE))].sort();
        setDay(dates.includes(today()) ? today() : dates[dates.length - 1] || null);
        setLoadedId(measurementId);
      } catch (err) {
        if (!active) return;
        console.error("Error al cargar la bitácora:", err);
        setError("No pudimos cargar la bitácora. Intenta recargar la página.");
      }
    })();
    return () => {
      active = false;
    };
  }, [measurementId]);

  const ready = !!measurementId && loadedId === measurementId;

  const { status: saveStatus, flush } = useAutosave({
    data: rows,
    enabled: ready,
    onSave: () => DepActivity.sync(measurementId, rows, saved.current),
  });

  // Días con registros (más los recién agregados), en orden.
  const days = useMemo(() => {
    const set = new Set(extraDays);
    rows.forEach((r) => set.add(r.activity_date || NO_DATE));
    return [...set].sort((a, b) => (a === NO_DATE ? 1 : b === NO_DATE ? -1 : a < b ? -1 : 1));
  }, [rows, extraDays]);

  const byDay = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const key = r.activity_date || NO_DATE;
      (map[key] = map[key] || []).push(r);
    });
    Object.values(map).forEach((l) => l.sort((a, b) => a.position - b.position));
    return map;
  }, [rows]);

  const captured = rows.filter(activityHasContent);
  const realDays = days.filter((d) => d !== NO_DATE && (byDay[d] || []).some(activityHasContent)).length;
  const full = captured.length >= LIMITS.activities;
  const dayRows = (day && byDay[day]) || [];

  const focusRow = (id) => setTimeout(() => document.getElementById(`act-${id}`)?.focus(), 0);

  const addRow = (forDay = day) => {
    if (!forDay || full) return;
    const id = newRowId();
    setRows((prev) => [
      ...prev,
      {
        id,
        activity_date: forDay === NO_DATE ? null : forDay,
        description: "",
        purpose: "",
        minutes: "",
        position: prev.reduce((m, r) => Math.max(m, r.position), -1) + 1,
      },
    ]);
    focusRow(id);
  };

  const addDay = () => {
    if (!newDay) return;
    if (!days.includes(newDay)) setExtraDays((prev) => [...prev, newDay]);
    setDay(newDay);
    if (!(byDay[newDay] || []).length) addRow(newDay);
  };

  const handleChange = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleRemove = (row) => {
    if (activityHasContent(row) && !window.confirm("¿Quitar esta actividad de la bitácora?")) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  // Enter en el tiempo de la última fila del día: fila nueva, lista para escribir.
  const handleEnter = (id) => {
    const last = dayRows[dayRows.length - 1];
    if (last?.id === id) addRow();
    else {
      const next = dayRows[dayRows.findIndex((r) => r.id === id) + 1];
      if (next) focusRow(next.id);
    }
  };

  const handleSelect = useCallback(
    async (id) => {
      await flush();
      select(id);
    },
    [flush, select],
  );

  const loading = loadingMeasurement || (!!measurementId && !ready && !error);
  const showCategory = !!classification && Object.keys(classification).length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <DependencyHeader
        icon={NotebookPen}
        title="Bitácora"
        subtitle="Tus actividades de cinco días laborables, en el orden en que ocurren."
        list={list}
        measurement={measurement}
        onSelect={handleSelect}
      />

      {(measurementError || error) && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {measurementError || error}
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
              <p className="text-sm">Primero crea tu medición: ahí indicas de quién es el registro y de qué semana.</p>
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
            {/* Resumen de la semana */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="font-subtitle">{measurementLabel(measurement, list.indexOf(measurement))}</span>
              <span className="text-muted">
                {realDays} de {LIMITS.workDays} días · {captured.length}{" "}
                {captured.length === 1 ? "actividad" : "actividades"} · {formatDuration(sumMinutes(captured))} registrados
              </span>
            </div>

            <details className="glass rounded-2xl px-4 py-3 text-sm group">
              <summary className="cursor-pointer font-subtitle flex items-center gap-2 list-none">
                <Info className="w-4 h-4 text-accent" /> Cómo registrar para que el análisis sirva
              </summary>
              <ul className="mt-3 space-y-2 text-muted leading-relaxed list-disc pl-5">
                <li>
                  <strong className="text-foreground">Registra durante el día.</strong> Haz una pausa cada hora,
                  aproximadamente, para anotar lo que hiciste. Si una actividad se interrumpe y la retomas después,
                  registra cada bloque por separado.
                </li>
                <li>
                  <strong className="text-foreground">Describe con precisión.</strong> Evita «revisar pendientes»,
                  «dar seguimiento» o «ver temas». Ejemplo: «Revisé con el gerente de operaciones el atraso de
                  entregas de tres sucursales y definimos acciones para recuperar el programa».
                </li>
                <li>
                  <strong className="text-foreground">Anota el tiempo en minutos.</strong> Solo actividades
                  laborales: sin comidas, pausas ni traslados personales. Si hiciste dos cosas al mismo tiempo,
                  registra los minutos de cada una; al analizar podrás aclararlo.
                </li>
                <li>
                  <strong className="text-foreground">No cambies tu forma de trabajar</strong> para que el registro
                  se vea mejor, y no llenes la clasificación: la asigna el asistente.
                </li>
              </ul>
            </details>

            {/* Días */}
            <div className="flex flex-wrap items-stretch gap-2" data-view-control>
              {days.map((d) => {
                const dayList = (byDay[d] || []).filter(activityHasContent);
                const active = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    aria-pressed={active}
                    className={`px-3.5 py-2 rounded-xl text-left transition-colors border ${
                      active
                        ? "bg-accent/20 border-accent text-foreground"
                        : "glass hover:border-accent/60 text-foreground"
                    }`}
                  >
                    <span className="block text-sm font-subtitle first-letter:uppercase">
                      {d === NO_DATE ? "Sin fecha" : formatDay(d)}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {dayList.length === 0
                        ? "sin registros"
                        : `${formatDuration(sumMinutes(dayList))} · ${dayList.length}`}
                    </span>
                  </button>
                );
              })}
              <div data-edit className="flex items-center gap-2 glass rounded-xl px-2 py-1.5">
                <input
                  type="date"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  aria-label="Fecha del día que quieres agregar"
                  className="bg-transparent text-sm outline-none text-foreground px-1"
                />
                <Button variant="ghost" size="sm" onClick={addDay} disabled={!newDay} className="font-subtitle">
                  <CalendarPlus className="w-4 h-4 mr-1.5" /> Agregar día
                </Button>
              </div>
            </div>

            {/* Actividades del día */}
            {!day ? (
              <Card className="glass">
                <CardContent className="p-6 text-sm text-muted">
                  Elige la fecha de tu primer día de registro y presiona «Agregar día».
                </CardContent>
              </Card>
            ) : (
              <Card className="glass">
                <CardContent className="p-4 md:p-5 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-subtitle text-lg first-letter:uppercase">
                      {day === NO_DATE ? "Actividades sin fecha" : formatDay(day, true)}
                    </h2>
                    <span className="text-xs text-muted">
                      {formatDuration(sumMinutes(dayRows.filter(activityHasContent)))} en{" "}
                      {dayRows.filter(activityHasContent).length} actividades
                    </span>
                  </div>

                  {dayRows.length > 0 && (
                    <div className="hidden md:grid md:grid-cols-[1.75rem_minmax(0,1.25fr)_minmax(0,1fr)_6.5rem_7.5rem_2.25rem] gap-2 text-xs text-muted font-subtitle px-0.5">
                      <span />
                      <span>Actividad específica</span>
                      <span>Propósito / resultado buscado</span>
                      <span className="text-right">Tiempo (min)</span>
                      <span>Clasificación IA</span>
                      <span />
                    </div>
                  )}

                  <div className="space-y-3 md:space-y-2">
                    {dayRows.map((r, i) => (
                      <ActivityRow
                        key={r.id}
                        row={r}
                        index={i}
                        category={classification?.[r.id]}
                        showCategory={showCategory}
                        onChange={handleChange}
                        onRemove={handleRemove}
                        onEnter={handleEnter}
                      />
                    ))}
                  </div>

                  {dayRows.length === 0 && (
                    <p className="text-sm text-muted">Aún no hay actividades en este día.</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      data-edit
                      variant="outline"
                      onClick={() => addRow()}
                      disabled={full}
                      className="glass hover:border-accent font-subtitle"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Agregar actividad
                    </Button>
                    {full && (
                      <span className="text-xs text-muted">
                        Llegaste al máximo de {LIMITS.activities} actividades por medición.
                      </span>
                    )}
                    {showCategory && (
                      <span className="text-xs text-muted">
                        La clasificación es la del último análisis; si cambias registros, vuelve a analizar.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end print:hidden">
              <Link to={createPageUrl("DependencyDecisions")}>
                <Button variant="outline" className="glass hover:border-accent font-subtitle">
                  Decisiones que tomas <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            <SaveStatusBar status={saveStatus} onSaveNow={flush} />
          </>
        )
      )}
    </div>
  );
}
