import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StrategicPlan, Competitor } from "@/api/entities";
import {
  ArrowLeft,
  Globe,
  Info,
  Plus,
  Trash2,
  ChevronDown,
  Building2,
  Leaf,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import { COMP_GROUPS, ALL_COMP_KEYS } from "@/config/strategicCatalog";

const GLOBAL_SECTION = "market";
const compSection = (id) => `market-comp:${id}`;
const MAX_COMPETITORS = 5;




// Botonera de opciones (Sí/No, Mayor/Menor, etc.) — más amigable que un select.
function Choice({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? "" : opt)}
          className={`px-4 py-1.5 rounded-full text-sm font-subtitle border transition-all ${
            value === opt
              ? "bg-accent text-accent-foreground border-accent"
              : "glass border-[var(--card-border)] hover:border-accent"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

Choice.propTypes = {
  value: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default function MarketAnalysis() {
  const [planId, setPlanId] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  // answers: { [section]: { [question_key]: answer } }
  const [answers, setAnswers] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await StrategicPlan.getOrCreate();
      const comps = await Competitor.list(plan.id);
      const sections = [GLOBAL_SECTION, ...comps.map((c) => compSection(c.id))];
      const stored = await StrategicPlan.getAnswersForSections(plan.id, sections);
      setPlanId(plan.id);
      setCompetitors(comps);
      setAnswers(stored);
      if (comps.length > 0) setExpandedId(comps[0].id);
    } catch (err) {
      console.error("Error al cargar el análisis del mercado:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setAnswer = (section, key, value) => {
    setAnswers((prev) => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: value },
    }));
  };

  // Autoguardado: persiste ~1.5 s después del último cambio, guardando solo
  // las secciones vigentes (global + competidores existentes). De la sección
  // global NO se re-suben las claves bo_* (Blue Ocean): se editan en
  // Oportunidades del mercado y aquí solo se leen, así no se pisan.
  const { status: saveStatus, flush } = useAutosave({
    data: answers,
    enabled: !loading && !!planId,
    onSave: async () => {
      const valid = new Set([GLOBAL_SECTION, ...competitors.map((c) => compSection(c.id))]);
      const toSave = {};
      Object.entries(answers).forEach(([section, values]) => {
        if (!valid.has(section)) return;
        toSave[section] =
          section === GLOBAL_SECTION
            ? Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith("bo_")))
            : values;
      });
      await StrategicPlan.saveSections(planId, toSave);
    },
  });

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !planId || competitors.length >= MAX_COMPETITORS) return;
    setError("");
    try {
      const comp = await Competitor.create(planId, name, competitors.length);
      setCompetitors((prev) => [...prev, comp]);
      setNewName("");
      setExpandedId(comp.id);
    } catch (err) {
      console.error("Error al agregar competidor:", err);
      setError("No se pudo agregar el competidor. Intenta de nuevo.");
    }
  };

  const handleRename = async (id, name) => {
    const clean = name.trim();
    if (!clean) return;
    setCompetitors((prev) => prev.map((c) => (c.id === id ? { ...c, name: clean } : c)));
    try {
      await Competitor.rename(id, clean);
    } catch (err) {
      console.error("Error al renombrar competidor:", err);
    }
  };

  const handleDelete = async (comp) => {
    if (!window.confirm(`¿Quitar a "${comp.name}" y sus respuestas?`)) return;
    setError("");
    try {
      await Competitor.remove(planId, comp.id);
      setCompetitors((prev) => prev.filter((c) => c.id !== comp.id));
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[compSection(comp.id)];
        return next;
      });
    } catch (err) {
      console.error("Error al eliminar competidor:", err);
      setError("No se pudo quitar el competidor. Intenta de nuevo.");
    }
  };

  const answeredForComp = (id) => {
    const values = answers[compSection(id)] || {};
    return ALL_COMP_KEYS.filter((k) => (values[k] || "").trim()).length;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Globe className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Análisis del mercado</h1>
            <p className="text-muted">Compara tu negocio con tus principales competidores.</p>
          </div>
        </div>
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
                Agrega hasta {MAX_COMPETITORS} competidores — los que tienen más mercado que tú
                o los que han crecido fuerte — y responde las preguntas de cada uno. Lo que
                captures alimenta tus conclusiones y las amenazas y oportunidades de tu FODA.
                Todo se guarda solo. En el siguiente paso encontrarás las 4 preguntas para
                detectar oportunidades que nadie está aprovechando.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competidores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-title">Tus competidores</h2>
          <span className="text-sm text-muted">{competitors.length} de {MAX_COMPETITORS}</span>
        </div>

        {competitors.length === 0 && (
          <Card className="glass">
            <CardContent className="p-8 text-center text-muted">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Aún no agregas competidores. Empieza con el que más mercado te quita.</p>
            </CardContent>
          </Card>
        )}

        {competitors.map((comp) => {
          const section = compSection(comp.id);
          const values = answers[section] || {};
          const open = expandedId === comp.id;
          const answered = answeredForComp(comp.id);
          return (
            <Card key={comp.id} className="glass overflow-hidden">
              {/* Encabezado del competidor */}
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : comp.id)}
                className="w-full flex items-center gap-3 p-5 text-left hover:bg-[var(--table-row-hover)] transition-colors"
              >
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-grow min-w-0">
                  <span className="font-subtitle block truncate">{comp.name}</span>
                  <span className="text-xs text-muted">
                    {answered} de {ALL_COMP_KEYS.length} preguntas respondidas
                  </span>
                </div>
                <div className="w-20 h-1.5 glass rounded-full overflow-hidden flex-shrink-0 hidden sm:block">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${(answered / ALL_COMP_KEYS.length) * 100}%` }}
                  />
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {/* Cuerpo expandible */}
              {open && (
                <CardContent className="px-5 pb-5 pt-0 space-y-6">
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      defaultValue={comp.name}
                      onBlur={(e) => handleRename(comp.id, e.target.value)}
                      className="flex-grow p-2.5 rounded-xl glass text-foreground text-sm outline-none focus:border-accent"
                      aria-label="Nombre del competidor"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(comp)}
                      className="text-red-500 hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                      title="Quitar competidor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {COMP_GROUPS.map((group) => (
                    <div key={group.title}>
                      <h3 className="font-subtitle text-sm text-accent uppercase tracking-wide mb-3">
                        {group.title}
                      </h3>
                      <div className="space-y-4">
                        {group.questions.map((item) => (
                          <div key={item.key}>
                            <label className="text-sm block mb-2">{item.q}</label>
                            {item.type === "choice" ? (
                              <Choice
                                value={values[item.key] || ""}
                                options={item.options}
                                onChange={(v) => setAnswer(section, item.key, v)}
                              />
                            ) : (
                              <input
                                type="text"
                                value={values[item.key] || ""}
                                onChange={(e) => setAnswer(section, item.key, e.target.value)}
                                placeholder="Escribe tu respuesta…"
                                className="w-full p-2.5 rounded-xl glass text-foreground text-sm placeholder:text-muted outline-none focus:border-accent"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Agregar competidor */}
        {competitors.length < MAX_COMPETITORS && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Nombre del competidor…"
              className="flex-grow p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
            <Button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
            >
              <Plus className="w-4 h-4 mr-2" /> Agregar
            </Button>
          </div>
        )}
      </div>

      {/* Tu propia responsabilidad social (las preguntas Blue Ocean viven en
          "Oportunidades del mercado", el siguiente paso del recorrido) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center">
            <Leaf className="w-5 h-5 text-green-600 dark:text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-title">Tu responsabilidad social</h2>
            <p className="text-sm text-muted">
              Ya comparaste a tu competencia en este punto; ahora tú.
            </p>
          </div>
        </div>

        <Card className="glass">
          <CardContent className="p-5">
            <label className="text-sm block mb-2">
              ¿Tú tienes y comunicas una estrategia de respeto al medio ambiente?
            </label>
            <Choice
              value={(answers[GLOBAL_SECTION] || {}).rs_propia || ""}
              options={["Sí", "No"]}
              onChange={(v) => setAnswer(GLOBAL_SECTION, "rs_propia", v)}
            />
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Siguiente paso del recorrido */}
      <div className="flex justify-end">
        <Link to={createPageUrl("MarketOpportunities")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Oportunidades del mercado →
          </Button>
        </Link>
      </div>

      {/* Barra de estado del autoguardado */}
      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
