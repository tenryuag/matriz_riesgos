import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan, Initiative } from "@/api/entities";
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
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { perspectiveFor, LANES } from "./StrategicMap";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  RATING_SECTION,
  SUMMARY_SOURCE_SECTIONS,
  collectStrategies,
  scoreFor,
  priorityFor,
} from "./StrategicSummary";

// ============================================================
// Iniciativas estratégicas: la estrategia se convierte en plan de acción.
// - Visión / Misión / Valores de la empresa (encabezado del plan).
// - Por cada objetivo (estrategia de prioridad ALTA del mapa calibrado),
//   el usuario captura iniciativas con área, responsable, fechas, KPI,
//   presupuesto y pasos del plan de trabajo.
// ============================================================

const emptyInitiative = (planId, strategyId) => ({
  id: crypto.randomUUID(),
  plan_id: planId,
  strategy_id: strategyId,
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

const FIELD_CLS =
  "w-full p-2.5 rounded-xl glass text-foreground text-sm placeholder:text-muted outline-none focus:border-accent";

export default function StrategicInitiatives() {
  const [planId, setPlanId] = useState(null);
  const [vmv, setVmv] = useState({ vision: "", mission: "", core_values: "" });
  const [initiatives, setInitiatives] = useState([]);
  const [objectives, setObjectives] = useState([]); // estrategias prioridad ALTA
  const [allLabels, setAllLabels] = useState({}); // id → label (para huérfanas)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const [sections, rows] = await Promise.all([
        StrategicPlan.getAnswersForSections(plan.id, [
          ...SUMMARY_SOURCE_SECTIONS,
          RATING_SECTION,
        ]),
        Initiative.list(plan.id),
      ]);
      const ratings = sections[RATING_SECTION] || {};
      const { weaknesses } = collectStrategies(sections);
      const labels = {};
      weaknesses.forEach((w) => (labels[w.id] = w.label));
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
      setInitiatives(
        rows.map((r) => ({
          ...r,
          start_date: r.start_date || "",
          end_date: r.end_date || "",
          budget: r.budget == null ? "" : String(r.budget),
          expected_result: r.expected_result || "",
          area: r.area || "",
          owner: r.owner || "",
          kpi: r.kpi || "",
          steps: r.steps || "",
        }))
      );
    } catch (err) {
      console.error("Error al cargar iniciativas:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (id, field, value) => {
    setInitiatives((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const addInitiative = (strategyId) => {
    setInitiatives((prev) => [...prev, emptyInitiative(planId, strategyId)]);
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
  const { status: saveStatus, flush } = useAutosave({
    data: { vmv, initiatives },
    enabled: !loading && !!planId,
    onSave: async () => {
      await Promise.all([
        StrategicPlan.update(planId, vmv),
        Initiative.upsertMany(planId, initiatives),
      ]);
    },
  });

  // Exporta la identidad + todas las iniciativas a un archivo de Excel,
  // agrupadas por perspectiva (como la hoja original del Excel).
  const handleExport = () => {
    const daysBetween = (start, end) => {
      if (!start || !end) return "";
      const d = Math.round((new Date(end) - new Date(start)) / 86400000);
      return d >= 0 ? d : "";
    };

    const laneTitle = (strategyId) => {
      const key = perspectiveFor({ id: strategyId });
      return LANES.find((l) => l.key === key)?.title || "";
    };

    const rows = [...initiatives].sort((a, b) => {
      const laneIdx = (sid) =>
        LANES.findIndex((l) => l.key === perspectiveFor({ id: sid }));
      const diff = laneIdx(a.strategy_id) - laneIdx(b.strategy_id);
      if (diff !== 0) return diff;
      return (allLabels[a.strategy_id] || "").localeCompare(allLabels[b.strategy_id] || "");
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
        laneTitle(it.strategy_id),
        allLabels[it.strategy_id] || it.strategy_id,
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
  const altaIds = new Set(objectives.map((o) => o.id));
  const orphanGroups = {};
  initiatives
    .filter((it) => !altaIds.has(it.strategy_id))
    .forEach((it) => {
      if (!orphanGroups[it.strategy_id]) orphanGroups[it.strategy_id] = [];
      orphanGroups[it.strategy_id].push(it);
    });

  const renderInitiativeCard = (it) => (
    <div key={it.id} className="p-4 glass rounded-xl space-y-3">
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

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
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
        {objectives.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-8 text-center text-muted space-y-3">
              <p className="text-sm">
                Aún no hay estrategias de prioridad alta. Califica tus debilidades en el
                resumen para definir tus objetivos.
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
                <p className="font-subtitle text-sm mb-4">{allLabels[sid] || sid}</p>
                <div className="space-y-3">{list.map(renderInitiativeCard)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
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
