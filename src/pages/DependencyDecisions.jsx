import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { MessagesSquare, Plus, Trash2, ArrowRight, Info } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import { useMeasurement } from "@/hooks/useMeasurement";
import SaveStatusBar from "@/components/SaveStatusBar";
import DependencyHeader from "@/components/dependency/DependencyHeader";
import AutoTextarea from "@/components/dependency/AutoTextarea";
import { FIELD_CLASS, measurementLabel } from "@/components/dependency/styles";
import { DepDecision, newRowId } from "@/api/dependency";
import {
  INTERVENTIONS,
  LIMITS,
  REASONS,
  decisionHasContent,
  formatDuration,
  toMinutes,
} from "@/config/dependencyCalc";

// «Decisiones que tomas» (hoja del mismo nombre del método): decisiones,
// autorizaciones, problemas o solicitudes de ayuda que otras personas
// llevaron a la atención del empresario durante la semana. Se guarda sola;
// las filas en blanco no se guardan. Sus minutos nunca se suman a los de la
// bitácora.

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toState = (d) => ({
  id: d.id,
  decision_date: d.decision_date || "",
  requester: d.requester || "",
  description: d.description || "",
  intervention: d.intervention || "",
  reason: d.reason || "",
  minutes: d.minutes === null || d.minutes === undefined ? "" : String(d.minutes),
  position: d.position || 0,
});

function DecisionRow({ row, index, onChange, onRemove }) {
  const label = "block text-xs text-muted mb-1";
  const set = (field) => (e) => onChange(row.id, field, e?.target ? e.target.value : e);
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted font-subtitle">Registro {index + 1}</span>
        <button
          type="button"
          data-edit
          onClick={() => onRemove(row)}
          className="p-2 rounded-xl hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
          aria-label="Quitar registro"
          title="Quitar registro"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <label htmlFor={`dd-${row.id}`} className={label}>
            Fecha
          </label>
          <input
            id={`dd-${row.id}`}
            type="date"
            value={row.decision_date}
            onChange={set("decision_date")}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`dr-${row.id}`} className={label}>
            Área / persona que solicita ayuda
          </label>
          <input
            id={`dr-${row.id}`}
            type="text"
            value={row.requester}
            onChange={set("requester")}
            maxLength={300}
            placeholder="Quién acudió a ti"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`ds-${row.id}`} className={label}>
            Situación o decisión solicitada
          </label>
          <AutoTextarea
            id={`ds-${row.id}`}
            value={row.description}
            onChange={set("description")}
            maxLength={2000}
            minRows={1}
            placeholder="Qué te pidieron resolver, decidir o autorizar"
            className={FIELD_CLASS}
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
        <div>
          <label htmlFor={`di-${row.id}`} className={label}>
            Tipo de intervención requerida
          </label>
          <select id={`di-${row.id}`} value={row.intervention} onChange={set("intervention")} className={FIELD_CLASS}>
            <option value="">Elige lo que realmente hiciste</option>
            {INTERVENTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`dw-${row.id}`} className={label}>
            ¿Por qué llegó a ti?
          </label>
          <select id={`dw-${row.id}`} value={row.reason} onChange={set("reason")} className={FIELD_CLASS}>
            <option value="">Si no lo sabes, déjalo en blanco</option>
            {REASONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`dm-${row.id}`} className={label}>
            Tiempo invertido (min)
          </label>
          <input
            id={`dm-${row.id}`}
            type="number"
            inputMode="numeric"
            min="0"
            max="1440"
            step="1"
            value={row.minutes}
            onChange={set("minutes")}
            placeholder="min"
            className={`${FIELD_CLASS} text-right`}
          />
        </div>
      </div>
    </div>
  );
}

DecisionRow.propTypes = {
  row: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default function DependencyDecisions() {
  const { list, measurement, loading: loadingMeasurement, error: measurementError, select } = useMeasurement();
  const measurementId = measurement?.id || null;
  const [rows, setRows] = useState([]);
  const [loadedId, setLoadedId] = useState(null);
  const [error, setError] = useState("");
  const saved = useRef(new Map());

  useEffect(() => {
    if (!measurementId) return undefined;
    let active = true;
    setError("");
    (async () => {
      try {
        const data = await DepDecision.list(measurementId);
        if (!active) return;
        const mapped = data.map(toState);
        saved.current = DepDecision.savedMap(mapped);
        setRows(mapped);
        setLoadedId(measurementId);
      } catch (err) {
        if (!active) return;
        console.error("Error al cargar las decisiones:", err);
        setError("No pudimos cargar las decisiones. Intenta recargar la página.");
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
    onSave: () => DepDecision.sync(measurementId, rows, saved.current),
  });

  const captured = rows.filter(decisionHasContent);
  const full = captured.length >= LIMITS.decisions;
  const ordered = [...rows].sort((a, b) => a.position - b.position);

  const addRow = () => {
    if (full) return;
    const id = newRowId();
    setRows((prev) => {
      const last = [...prev].sort((a, b) => a.position - b.position).pop();
      return [
        ...prev,
        {
          id,
          // La fecha del registro anterior: lo normal es capturar varios del mismo día.
          decision_date: last?.decision_date || today(),
          requester: "",
          description: "",
          intervention: "",
          reason: "",
          minutes: "",
          position: prev.reduce((m, r) => Math.max(m, r.position), -1) + 1,
        },
      ];
    });
    setTimeout(() => document.getElementById(`dr-${id}`)?.focus(), 0);
  };

  const handleChange = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleRemove = (row) => {
    if (decisionHasContent(row) && !window.confirm("¿Quitar este registro?")) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const handleSelect = useCallback(
    async (id) => {
      await flush();
      select(id);
    },
    [flush, select],
  );

  const loading = loadingMeasurement || (!!measurementId && !ready && !error);
  const totalMinutes = captured.reduce((s, r) => s + (toMinutes(r.minutes) ?? 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <DependencyHeader
        icon={MessagesSquare}
        title="Decisiones que tomas"
        subtitle="Lo que otras personas llevaron a tu atención durante la misma semana."
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="font-subtitle">{measurementLabel(measurement, list.indexOf(measurement))}</span>
              <span className="text-muted">
                {captured.length} {captured.length === 1 ? "registro" : "registros"} · {formatDuration(totalMinutes)}{" "}
                invertidos
              </span>
            </div>

            <details className="glass rounded-2xl px-4 py-3 text-sm">
              <summary className="cursor-pointer font-subtitle flex items-center gap-2 list-none">
                <Info className="w-4 h-4 text-accent" /> Qué registrar aquí
              </summary>
              <ul className="mt-3 space-y-2 text-muted leading-relaxed list-disc pl-5">
                <li>
                  Las decisiones, autorizaciones, problemas o solicitudes de ayuda que otras personas llevaron a tu
                  atención. Describe lo que ocurrió tal como sucede hoy.
                </li>
                <li>
                  <strong className="text-foreground">Tipo de intervención:</strong> elige lo que realmente hiciste,
                  no lo que crees que debiste hacer.
                </li>
                <li>
                  <strong className="text-foreground">No juzgues ni justifiques.</strong> No necesitas decidir si esa
                  situación debería llegar a ti ni quién tendría que resolverla: el análisis buscará los patrones.
                </li>
                <li>Si no conoces un dato, déjalo en blanco en lugar de inventarlo.</li>
              </ul>
            </details>

            <div className="space-y-3">
              {ordered.map((r, i) => (
                <DecisionRow key={r.id} row={r} index={i} onChange={handleChange} onRemove={handleRemove} />
              ))}
            </div>

            {rows.length === 0 && (
              <Card className="glass">
                <CardContent className="p-6 text-sm text-muted">
                  Aún no hay registros. Agrega uno cada vez que alguien acuda a ti para que decidas, autorices o
                  resuelvas algo.
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  data-edit
                  variant="outline"
                  onClick={addRow}
                  disabled={full}
                  className="glass hover:border-accent font-subtitle"
                >
                  <Plus className="w-4 h-4 mr-2" /> Agregar registro
                </Button>
                {full && (
                  <span className="text-xs text-muted">
                    Llegaste al máximo de {LIMITS.decisions} registros por medición.
                  </span>
                )}
              </div>
              <Link to={createPageUrl("DependencyMap")}>
                <Button variant="outline" className="glass hover:border-accent font-subtitle">
                  Mapa de dependencia <ArrowRight className="w-4 h-4 ml-2" />
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
