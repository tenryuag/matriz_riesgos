import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan, Initiative, PlanAnswer } from "@/api/entities";
import { RISK_OBJECTIVES_SECTION } from "@/api/strategyInputs";
import {
  ArrowLeft,
  ClipboardList,
  Info,
  Plus,
  Trash2,
  Compass,
  Target,
  Gem,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { perspectiveFor, LANES } from "./StrategicMap";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import { useStrategyInputs } from "@/hooks/useStrategyInputs";
import SaveStatusBar from "@/components/SaveStatusBar";
import RiskWarningsCard from "@/components/strategy/RiskWarningsCard";
import RiskObjectiveBadges from "@/components/strategy/RiskObjectiveBadges";
import { collectStrategies, scoreFor, priorityFor } from "./StrategicSummary";
import {
  RISK_ACKNOWLEDGED,
  riskObjectivesFrom,
  localISODate,
  riskInitiativeWarnings,
  controlSourceKey,
  templateSourceKey,
  initiativeFromControl,
  initiativeFromTemplate,
  riskInitiativesOf,
  existingForSource,
  orphanLabelFor,
  isRiskObjectiveId,
  objectivesById,
  templatesFor,
} from "@/config/strategicCalc";

// ============================================================
// Iniciativas estratégicas: la estrategia se convierte en plan de acción.
// - Visión / Misión / Valores de la empresa (encabezado del plan).
// - Por cada objetivo (estrategia de prioridad ALTA del mapa calibrado y,
//   desde la Fase 2, cada riesgo crítico de la matriz), el usuario captura
//   iniciativas con área, responsable, fechas, KPI, presupuesto y pasos del
//   plan de trabajo. Los controles de un riesgo (o una plantilla por
//   estrategia) se convierten en iniciativa con un clic, de forma
//   idempotente por (plan_id, source_key).
// ============================================================

const emptyInitiative = (planId, strategyId, strategyLabel = null) => ({
  id: crypto.randomUUID(),
  plan_id: planId,
  strategy_id: strategyId,
  strategy_label: strategyLabel,
  title: "",
  expected_result: "",
  area: "",
  owner: "",
  start_date: "",
  end_date: "",
  budget: "",
  kpi: "",
  steps: "",
});

// Fila de Initiative.list() → fila editable. Conserva `...r`, por tanto
// `source_key` y `strategy_label` (el autosave los re-sube tal cual).
const toFormRow = (r) => ({
  ...r,
  start_date: r.start_date || "",
  end_date: r.end_date || "",
  budget: r.budget == null ? "" : String(r.budget),
  expected_result: r.expected_result || "",
  area: r.area || "",
  owner: r.owner || "",
  kpi: r.kpi || "",
  steps: r.steps || "",
});

const FIELD_CLS =
  "w-full p-2.5 rounded-xl glass text-foreground text-sm placeholder:text-muted outline-none focus:border-accent";

const SMALL_CHIP = "px-2 py-0.5 rounded-full text-[10px] font-subtitle border flex-shrink-0";
const GRADE_CHIP = {
  Fuerte: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
  Medio: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/40",
  Débil: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40",
};

const scrollToId = (domId) =>
  document.getElementById(domId)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function StrategicInitiatives() {
  const { inputs, loading, error: loadError, risksEnabled } = useStrategyInputs();
  const today = localISODate();

  const [planId, setPlanId] = useState(null);
  const [vmv, setVmv] = useState({ vision: "", mission: "", core_values: "" });
  const [initiatives, setInitiatives] = useState([]);
  const [objectives, setObjectives] = useState([]); // debilidades prioridad ALTA
  const [allLabels, setAllLabels] = useState({}); // id → label (para huérfanas)
  const [ack, setAck] = useState({}); // plan_answers 'risk-objectives'
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [scrollTo, setScrollTo] = useState(null);

  // Hidratación única: las recargas silenciosas del hook no pisan lo tecleado.
  useEffect(() => {
    if (!inputs || hydrated) return;
    const { plan, sections, ratings, risks, decisions } = inputs;
    const { weaknesses } = collectStrategies(sections);
    const labels = {};
    weaknesses.forEach((w) => (labels[w.id] = w.label));
    riskObjectivesFrom(risks, decisions).forEach((o) => (labels[o.id] = o.label));
    const alta = weaknesses.filter(
      (w) => priorityFor(scoreFor(ratings, w.id)) === "Alta"
    );
    setPlanId(plan.id);
    setVmv({
      vision: plan.vision || "",
      mission: plan.mission || "",
      core_values: plan.core_values || "",
    });
    setObjectives(alta);
    setAllLabels(labels);
    setInitiatives((inputs.initiatives || []).map(toFormRow));
    setAck({ ...(decisions?.objectives || {}) });
    setHydrated(true);
  }, [inputs, hydrated]);

  // Riesgos críticos como objetivos; la confirmación se refleja sin recargar.
  const riskObjectives = useMemo(
    () => (inputs ? riskObjectivesFrom(inputs.risks, { objectives: ack }) : []),
    [inputs, ack]
  );

  const warnings = riskInitiativeWarnings(riskObjectives, initiatives, today);
  const byInitiative = {};
  warnings.forEach((w) => {
    if (!w.initiativeId) return;
    if (!byInitiative[w.initiativeId]) byInitiative[w.initiativeId] = [];
    byInitiative[w.initiativeId].push(w);
  });

  // Desplazamiento por hash (#risk-<id> / #initiative-<id>) al terminar de cargar.
  useEffect(() => {
    if (!hydrated) return;
    const hash = window.location.hash;
    if (hash) scrollToId(hash.slice(1));
  }, [hydrated]);

  // Desplazamiento a la iniciativa recién creada (en el render siguiente).
  useEffect(() => {
    if (!scrollTo) return;
    scrollToId(`initiative-${scrollTo}`);
    setScrollTo(null);
  }, [scrollTo]);

  const setField = (id, field, value) => {
    setInitiatives((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const addInitiative = (strategyId, label = null) => {
    setInitiatives((prev) => [...prev, emptyInitiative(planId, strategyId, label)]);
  };

  const removeInitiative = async (it) => {
    if (!window.confirm("¿Quitar esta iniciativa y su plan de trabajo?")) return;
    setInitiatives((prev) => prev.filter((x) => x.id !== it.id));
    try {
      await Initiative.remove(it.id);
    } catch (err) {
      // Si aún no estaba guardada en la BD, el delete simplemente no borra nada.
      console.error("Error al eliminar iniciativa:", err);
    }
  };

  // Autoguardado: visión/misión/valores + todas las iniciativas.
  // Línea base = datos ya hidratados → cero guardado espurio al abrir.
  const { status: saveStatus, flush } = useAutosave({
    data: { vmv, initiatives },
    enabled: hydrated && !!planId,
    onSave: async () => {
      await Promise.all([
        StrategicPlan.update(planId, vmv),
        Initiative.upsertMany(planId, initiatives),
      ]);
    },
  });

  // Convierte un control de la matriz (o una plantilla) en iniciativa.
  // Idempotente por (plan_id, source_key). Tras crear, se ANEXA solo la fila
  // creada (tal como la devuelve list()); nunca se reemplaza el estado, para
  // no pisar ediciones en vuelo.
  const adopt = async (objective, { control, template }) => {
    const key = control
      ? controlSourceKey(objective.id, control.n)
      : templateSourceKey(objective.id, template.key);
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    try {
      await flush(); // mejor esfuerzo: si hay guardado en vuelo, retorna sin esperar
      const row = control
        ? initiativeFromControl(objective, control, today, initiatives.length)
        : initiativeFromTemplate(objective, template, today, initiatives.length);
      await Initiative.createFromSource(planId, [row]);
      const created = (await Initiative.list(planId)).find((r) => r.source_key === key);
      if (!created) throw new Error("La iniciativa no apareció tras crearla");
      const formRow = toFormRow(created);
      setInitiatives((prev) =>
        prev.some((p) => p.id === formRow.id) ? prev : [...prev, formRow]
      );
      setScrollTo(formRow.id);
    } catch (err) {
      console.error("Error al crear la iniciativa:", err);
      setError("No pudimos crear la iniciativa. Intenta de nuevo.");
    } finally {
      setBusyKey(null);
    }
  };

  const acknowledge = async (objective) => {
    try {
      await PlanAnswer.set(planId, RISK_OBJECTIVES_SECTION, objective.riskId, RISK_ACKNOWLEDGED);
      setAck((p) => ({ ...p, [objective.riskId]: RISK_ACKNOWLEDGED }));
    } catch (err) {
      console.error("Error al guardar la confirmación:", err);
      setError("No pudimos guardar tu confirmación. Intenta de nuevo.");
    }
  };

  const unacknowledge = async (objective) => {
    try {
      await PlanAnswer.remove(planId, RISK_OBJECTIVES_SECTION, objective.riskId);
      setAck((p) => {
        const n = { ...p };
        delete n[objective.riskId];
        return n;
      });
    } catch (err) {
      console.error("Error al quitar la confirmación:", err);
      setError("No pudimos guardar tu confirmación. Intenta de nuevo.");
    }
  };

  // Exporta la identidad + todas las iniciativas a un archivo de Excel,
  // agrupadas por perspectiva (como la hoja original del Excel).
  const handleExport = () => {
    const daysBetween = (start, end) => {
      if (!start || !end) return "";
      const d = Math.round((new Date(end) - new Date(start)) / 86400000);
      return d >= 0 ? d : "";
    };

    // Los objetivos de riesgo llevan su perspectiva en el objeto completo;
    // si ya no son críticos (o no tienen perspectiva) van a "Sin perspectiva".
    const byId = objectivesById([...riskObjectives, ...objectives]);
    const laneKey = (it) =>
      byId[it.strategy_id]
        ? perspectiveFor(byId[it.strategy_id])
        : isRiskObjectiveId(it.strategy_id)
          ? null
          : perspectiveFor({ id: it.strategy_id });
    const laneTitle = (it) =>
      LANES.find((l) => l.key === laneKey(it))?.title ||
      (isRiskObjectiveId(it.strategy_id) ? "Sin perspectiva" : "");
    const laneIdx = (it) => {
      const idx = LANES.findIndex((l) => l.key === laneKey(it));
      return idx < 0 ? LANES.length : idx; // sin perspectiva al final
    };
    const objectiveLabel = (it) => {
      const sid = it.strategy_id;
      return isRiskObjectiveId(sid)
        ? `Riesgo crítico: ${allLabels[sid] || it.strategy_label || sid}`
        : allLabels[sid] || sid;
    };

    const rows = [...initiatives].sort((a, b) => {
      const diff = laneIdx(a) - laneIdx(b);
      if (diff !== 0) return diff;
      return objectiveLabel(a).localeCompare(objectiveLabel(b));
    });

    const header = [
      "Perspectiva", "Objetivo estratégico", "Iniciativa", "Resultado esperado",
      "Área responsable", "Responsable", "Fecha inicio", "Fecha término",
      "Días", "Presupuesto (MXN)", "KPI", "Plan de trabajo",
    ];

    const aoa = [
      ["PLAN ESTRATÉGICO · INICIATIVAS"],
      [],
      ["Visión", vmv.vision || ""],
      ["Misión", vmv.mission || ""],
      ["Valores", vmv.core_values || ""],
      [],
      header,
      ...rows.map((it) => [
        laneTitle(it),
        objectiveLabel(it),
        it.title || "",
        it.expected_result || "",
        it.area || "",
        it.owner || "",
        it.start_date || "",
        it.end_date || "",
        daysBetween(it.start_date, it.end_date),
        it.budget === "" || it.budget == null ? "" : Number(it.budget),
        it.kpi || "",
        it.steps || "",
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 42 }, { wch: 32 }, { wch: 32 }, { wch: 18 },
      { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 7 }, { wch: 16 },
      { wch: 28 }, { wch: 48 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Iniciativas");

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const d = new Date();
    const filename = `iniciativas_estrategicas_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.xlsx`;
    saveAs(blob, filename);
  };

  // Iniciativas cuyo objetivo ya no es prioridad alta (no se ocultan).
  const altaIds = new Set([
    ...objectives.map((o) => o.id),
    ...riskObjectives.map((o) => o.id),
  ]);
  const orphanGroups = {};
  initiatives
    .filter((it) => !altaIds.has(it.strategy_id))
    .forEach((it) => {
      if (!orphanGroups[it.strategy_id]) orphanGroups[it.strategy_id] = [];
      orphanGroups[it.strategy_id].push(it);
    });

  const warningText = (w) => {
    if (w.type === "far") {
      return `Termina en ${w.days} días. Para un riesgo ${w.levelLabel.toLowerCase()} se sugiere cerrarla en ${w.limit} días o menos.`;
    }
    if (w.type === "no-owner") {
      return w.responsibleInMatrix
        ? "Escribe el nombre del responsable (en la matriz indicaste que este control sí tiene uno)."
        : "Sin responsable.";
    }
    return w.message;
  };

  const renderInitiativeCard = (it) => (
    <div key={it.id} id={`initiative-${it.id}`} className="p-4 glass rounded-xl space-y-3">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={it.title}
          onChange={(e) => setField(it.id, "title", e.target.value)}
          placeholder="Nombre de la iniciativa (ej. Capacitar al equipo)…"
          className={`${FIELD_CLS} font-subtitle`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeInitiative(it)}
          className="text-red-500 hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
          title="Quitar iniciativa"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div>
        <label className="text-xs text-muted block mb-1">
          ¿Cómo sabremos que fue un éxito? (resultado esperado)
        </label>
        <input
          type="text"
          value={it.expected_result}
          onChange={(e) => setField(it.id, "expected_result", e.target.value)}
          placeholder="Ej. Evaluación de clientes mayor a 9.0"
          className={FIELD_CLS}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Área responsable</label>
          <input type="text" value={it.area} onChange={(e) => setField(it.id, "area", e.target.value)} placeholder="Ej. Operaciones" className={FIELD_CLS} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Responsable</label>
          <input type="text" value={it.owner} onChange={(e) => setField(it.id, "owner", e.target.value)} placeholder="Ej. Jefe de operaciones" className={FIELD_CLS} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Fecha de inicio</label>
          <input type="date" value={it.start_date} onChange={(e) => setField(it.id, "start_date", e.target.value)} className={FIELD_CLS} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Fecha de término</label>
          <input type="date" value={it.end_date} onChange={(e) => setField(it.id, "end_date", e.target.value)} className={FIELD_CLS} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Presupuesto (MXN)</label>
          <input type="number" min="0" value={it.budget} onChange={(e) => setField(it.id, "budget", e.target.value)} placeholder="0" className={FIELD_CLS} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Indicador de éxito (KPI)</label>
          <input type="text" value={it.kpi} onChange={(e) => setField(it.id, "kpi", e.target.value)} placeholder="Ej. 100% del personal capacitado" className={FIELD_CLS} />
        </div>
      </div>

      {byInitiative[it.id]?.length > 0 && (
        <div className="space-y-1">
          {byInitiative[it.id].map((w) => (
            <p
              key={`${w.type}-${it.id}`}
              className="text-xs flex items-start gap-1.5 text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{warningText(w)}</span>
            </p>
          ))}
        </div>
      )}

      <div>
        <label className="text-xs text-muted block mb-1">
          Plan de trabajo (los pasos, uno por línea)
        </label>
        <textarea
          value={it.steps}
          onChange={(e) => setField(it.id, "steps", e.target.value)}
          rows={3}
          placeholder={"1. Diseñar el plan\n2. Implementarlo\n3. Evaluar resultados"}
          className={`${FIELD_CLS} resize-y`}
        />
      </div>
    </div>
  );

  // Botón "Convertir en iniciativa" / "Ya en tu plan ↓" para un control o
  // una plantilla de un objetivo de riesgo.
  const renderAdoptButton = (objective, key, payload) => {
    const existing = existingForSource(initiatives, key);
    if (existing) {
      return (
        <Button
          type="button"
          variant="ghost"
          className="text-accent w-full sm:w-auto"
          onClick={() => scrollToId(`initiative-${existing.id}`)}
        >
          Ya en tu plan ↓
        </Button>
      );
    }
    const busy = busyKey === key;
    return (
      <Button
        type="button"
        variant="outline"
        className="glass hover:border-accent font-subtitle w-full sm:w-auto"
        disabled={busy}
        onClick={() => adopt(objective, payload)}
      >
        <Plus className="w-4 h-4 mr-2" /> {busy ? "Creando…" : "Convertir en iniciativa"}
      </Button>
    );
  };

  const renderTemplates = (o) => {
    const templates = templatesFor(o);
    const verb = o.strategy === "Transferir" ? "transferir" : "reducir";
    return (
      <div className="space-y-2">
        <p className="text-xs font-subtitle uppercase tracking-wide text-muted">
          {o.accepted ? "Lo mínimo para un riesgo aceptado" : `Sugerencias para ${verb} este riesgo`}
        </p>
        <p className="text-xs text-muted">
          {o.accepted
            ? "Un riesgo crítico aceptado necesita al menos una señal de alerta y un plan de reacción. Elige las sugerencias que te falten; después podrás editarlas."
            : "Este riesgo no tiene controles en tu matriz. Elige una o varias sugerencias para empezar; después podrás editarlas."}
        </p>
        {templates.map((t) => (
          <div
            key={t.key}
            className="p-3 glass rounded-xl flex flex-col sm:flex-row sm:items-center gap-2"
          >
            <div className="flex-grow">
              <p className="text-sm">{t.title}</p>
              <p className="text-xs text-muted">{t.expected_result}</p>
            </div>
            {renderAdoptButton(o, templateSourceKey(o.id, t.key), { template: t })}
          </div>
        ))}
      </div>
    );
  };

  const renderRiskCard = (o) => {
    const list = riskInitiativesOf(o.id, initiatives);
    return (
      <Card
        key={o.id}
        id={`risk-${o.riskId}`}
        className={`glass border-2 ${o.level === "INTOLERABLE" ? "border-red-500/30" : "border-orange-500/30"}`}
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <p className="font-subtitle text-sm flex-grow">{o.label}</p>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-subtitle border border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0 self-start">
              Prioridad alta
            </span>
          </div>

          <RiskObjectiveBadges objective={o} />

          <p className="text-xs text-muted">
            Estrategia: {o.strategy || "Sin definir"}
            {o.residualLabel
              ? ` · Después de controles: ${o.residualLabel}`
              : " · Sin nivel después de controles"}
            {" · Prioridad alta por definición: no necesita calificación."}
          </p>

          {o.accepted && !o.acknowledged && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm space-y-3">
              <p>
                Decidiste aceptar este riesgo. Un riesgo crítico aceptado al menos necesita una
                señal de alerta y un plan de reacción. Si ya los tienes, confírmalo; si no,
                convierte las sugerencias de abajo en iniciativas.
              </p>
              <Button
                type="button"
                variant="outline"
                className="glass hover:border-accent font-subtitle w-full sm:w-auto"
                onClick={() => acknowledge(o)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Lo tengo controlado
              </Button>
            </div>
          )}
          {o.accepted && o.acknowledged && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-green-600 dark:text-green-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Confirmaste que lo tienes controlado. Este riesgo ya no aparece en las alertas.
              </span>
              <button
                type="button"
                onClick={() => unacknowledge(o)}
                className="text-accent hover:underline"
              >
                Quitar confirmación
              </button>
            </div>
          )}

          {o.controls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-subtitle uppercase tracking-wide text-muted">
                Controles de tu matriz
              </p>
              {o.controls.map((c) => (
                <div
                  key={c.n}
                  className="p-3 glass rounded-xl flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="flex-grow space-y-1.5">
                    <p className="text-sm">{c.text}</p>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {c.impact && <span className={`${SMALL_CHIP} glass`}>{c.impact}</span>}
                      {c.grade && (
                        <span className={`${SMALL_CHIP} ${GRADE_CHIP[c.grade] || "glass"}`}>
                          Control {c.grade}
                        </span>
                      )}
                      <span className={`${SMALL_CHIP} glass text-muted`}>
                        {c.hasResponsible
                          ? "Tiene responsable en la matriz"
                          : "Sin responsable en la matriz"}
                      </span>
                    </div>
                  </div>
                  {renderAdoptButton(o, controlSourceKey(o.id, c.n), { control: c })}
                </div>
              ))}
            </div>
          )}

          {(o.controls.length === 0 || o.accepted) && renderTemplates(o)}

          <div className="space-y-3">
            {list.map(renderInitiativeCard)}
            <button
              type="button"
              onClick={() => addInitiative(o.id, o.label)}
              className="w-full flex items-center justify-center gap-2 p-3 glass rounded-xl text-accent hover:bg-accent/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-subtitle">
                {list.length === 0 ? "Agregar la primera iniciativa" : "Agregar otra iniciativa"}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <Link
              to={createPageUrl(`AddRisk?id=${o.riskId}`)}
              className="inline-flex items-center gap-1.5 text-accent font-subtitle hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Corregir probabilidad e impacto en la matriz →
            </Link>
            {!o.perspective && (
              <Link
                to={createPageUrl(`AddRisk?id=${o.riskId}`)}
                className="inline-flex items-center gap-1.5 text-accent font-subtitle hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Asignar perspectiva →
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Esqueleto también en el render intermedio entre "inputs llegó" y la
  // hidratación (useEffect): si no, se pintan un instante los avisos y los
  // estados vacíos con initiatives = [] y planId = null.
  if (loading || (!hydrated && !loadError)) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  const shownError = loadError || error;

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-grow">
          <div className="w-12 h-12 bg-blue-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Iniciativas estratégicas</h1>
            <p className="text-muted">Convierte tu estrategia en un plan de acción concreto.</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={initiatives.length === 0}
          variant="outline"
          className="glass hover:border-accent font-subtitle flex-shrink-0 disabled:opacity-40"
          title={initiatives.length === 0 ? "Agrega iniciativas para exportar" : "Descargar como Excel"}
        >
          <Download className="w-4 h-4 mr-2" /> Exportar a Excel
        </Button>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-subtitle text-lg mb-1">¿Qué hago aquí?</h2>
              <p className="text-sm text-muted leading-relaxed">
                Define primero la identidad de tu empresa (visión, misión y valores). Después,
                por cada objetivo de <span className="font-subtitle">prioridad alta</span> de tu
                mapa calibrado, agrega las iniciativas que lo harán realidad: quién lo hace,
                para cuándo, con qué presupuesto y cómo medirás el éxito.
                {riskObjectives.length > 0 &&
                  " Los riesgos Alto o Intolerable de tu matriz aparecen primero: son prioridad alta por definición. Convierte sus controles en iniciativas con un clic."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avisos sobre riesgos (nunca bloquean) */}
      <RiskWarningsCard warnings={warnings} />

      {/* Visión / Misión / Valores */}
      <Card className="glass">
        <CardContent className="p-6 space-y-4">
          <h2 className="font-subtitle text-sm text-accent uppercase tracking-wide">
            La identidad de tu empresa
          </h2>
          <div>
            <label className="text-sm flex items-center gap-2 mb-1.5">
              <Compass className="w-4 h-4 text-accent" /> Visión
              <span className="text-xs text-muted">— ¿a dónde quieres llegar?</span>
            </label>
            <textarea
              value={vmv.vision}
              onChange={(e) => setVmv((p) => ({ ...p, vision: e.target.value }))}
              rows={2}
              placeholder="Ej. Ser la empresa líder de nuestro sector en la región para 2030…"
              className={`${FIELD_CLS} resize-y`}
            />
          </div>
          <div>
            <label className="text-sm flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-accent" /> Misión
              <span className="text-xs text-muted">— ¿para qué existes hoy?</span>
            </label>
            <textarea
              value={vmv.mission}
              onChange={(e) => setVmv((p) => ({ ...p, mission: e.target.value }))}
              rows={2}
              placeholder="Ej. Ofrecer a nuestros clientes… con calidad y servicio extraordinarios…"
              className={`${FIELD_CLS} resize-y`}
            />
          </div>
          <div>
            <label className="text-sm flex items-center gap-2 mb-1.5">
              <Gem className="w-4 h-4 text-accent" /> Valores
              <span className="text-xs text-muted">— ¿qué principios te guían?</span>
            </label>
            <textarea
              value={vmv.core_values}
              onChange={(e) => setVmv((p) => ({ ...p, core_values: e.target.value }))}
              rows={2}
              placeholder="Ej. Honestidad, servicio, mejora continua…"
              className={`${FIELD_CLS} resize-y`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Objetivos de prioridad alta */}
      <div className="space-y-5">
        <h2 className="text-xl font-title">Tus objetivos de prioridad alta</h2>
        {risksEnabled && riskObjectives.length === 0 && (
          <p className="text-xs text-muted -mt-3">
            Ningún riesgo de tu matriz es Alto o Intolerable. Si alguno sube de nivel, aparecerá
            aquí como objetivo.
          </p>
        )}

        {riskObjectives.map(renderRiskCard)}

        {objectives.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-8 text-center text-muted space-y-3">
              <p className="text-sm">
                {riskObjectives.length > 0
                  ? "Aún no hay debilidades de prioridad alta. Califícalas en el resumen para sumarlas a tu plan."
                  : "Aún no hay estrategias de prioridad alta. Califica tus debilidades en el resumen para definir tus objetivos."}
              </p>
              <Link to={createPageUrl("StrategicSummary")} className="text-accent text-sm font-subtitle hover:underline">
                Ir al resumen y priorización →
              </Link>
            </CardContent>
          </Card>
        ) : (
          objectives.map((obj) => {
            const list = initiatives.filter((it) => it.strategy_id === obj.id);
            return (
              <Card key={obj.id} className="glass">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <p className="font-subtitle text-sm flex-grow">{obj.label}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-subtitle border border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0">
                      Prioridad alta
                    </span>
                  </div>
                  <div className="space-y-3">
                    {list.map(renderInitiativeCard)}
                    <button
                      type="button"
                      onClick={() => addInitiative(obj.id)}
                      className="w-full flex items-center justify-center gap-2 p-3 glass rounded-xl text-accent hover:bg-accent/10 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-subtitle">
                        {list.length === 0 ? "Agregar la primera iniciativa" : "Agregar otra iniciativa"}
                      </span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Iniciativas de objetivos que ya no son prioridad alta */}
      {Object.keys(orphanGroups).length > 0 && (
        <div className="space-y-5">
          <h2 className="text-xl font-title">Otras iniciativas</h2>
          <p className="text-sm text-muted -mt-3">
            Estas iniciativas pertenecen a objetivos que ya no son de prioridad alta. Se
            conservan por si cambias tus calificaciones.
          </p>
          {Object.entries(orphanGroups).map(([sid, list]) => (
            <Card key={sid} className="glass">
              <CardContent className="p-6">
                <p className="font-subtitle text-sm mb-1">
                  {allLabels[sid] || orphanLabelFor(list) || sid}
                </p>
                {isRiskObjectiveId(sid) && (
                  <p className="text-xs text-muted">
                    {risksEnabled
                      ? "Este riesgo ya no es Alto ni Intolerable en tu matriz (o fue eliminado). Sus iniciativas se conservan."
                      : "Estas iniciativas vienen de tu matriz de riesgos."}
                  </p>
                )}
                <div className="space-y-3 mt-4">{list.map(renderInitiativeCard)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {shownError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {shownError}
        </div>
      )}

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("StrategicMapCalibrated")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Mapa calibrado
          </Button>
        </Link>
        <Link to={createPageUrl("ScoreCard")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Score Card →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
