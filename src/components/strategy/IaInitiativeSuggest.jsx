import { useState } from "react";
import PropTypes from "prop-types";
import { Sparkles, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { callIa, IaError } from "@/api/ia";
import IaDisclaimer from "@/components/ia/IaDisclaimer";
import { localISODate, addDays } from "@/config/strategicCalc";

// ============================================================
// Iniciativas sugeridas con IA para un objetivo de prioridad alta (una
// debilidad calificada o un riesgo crítico). Pide a la Edge Function `ia`
// (acción `sugerir_iniciativa`) dos borradores y los muestra como tarjetas;
// "Agregar al plan" entrega al padre los campos ya listos para una fila de
// iniciativa (onAdd). No guarda nada por su cuenta.
//
//   <IaInitiativeSuggest
//     objective={{ id, label, tipo: 'debilidad'|'riesgo', perspectiva?, estrategia?, nivel?, controles?, fuente? }}
//     existingTitles={["…"]}      // títulos que ya tiene el objetivo (para no repetir)
//     onAdd={(fields) => …}       // { title, expected_result, area, owner, kpi, budget, steps, start_date, end_date }
//   />
// ============================================================

const OPTION_TAG = ["Rápida y de bajo costo", "Más completa"];

const fmtMxn = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

const budgetText = (v) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= 0 ? fmtMxn(n) : "Sin estimar";
};

const weeksText = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return "Sin definir";
  return n === 1 ? "1 semana" : `${n} semanas`;
};

// Borrador de la IA → campos de la fila de iniciativa de la página.
// Fechas: inicio hoy; término hoy + plazo_semanas × 7. Pasos numerados, uno
// por línea (así los espera el campo "Plan de trabajo").
const initiativeFieldsFrom = (ini) => {
  const today = localISODate();
  const weeks = Math.round(Number(ini?.plazo_semanas));
  const end = Number.isFinite(weeks) && weeks > 0 ? addDays(today, weeks * 7) : null;
  const budget = Number(ini?.presupuesto_mxn);
  const steps = (Array.isArray(ini?.pasos) ? ini.pasos : [])
    .map((p) => String(p ?? "").replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");
  return {
    title: String(ini?.titulo ?? "").trim(),
    expected_result: String(ini?.resultado_esperado ?? "").trim(),
    area: String(ini?.area ?? "").trim(),
    owner: String(ini?.responsable ?? "").trim(),
    kpi: String(ini?.kpi ?? "").trim(),
    budget:
      ini?.presupuesto_mxn != null && Number.isFinite(budget) && budget >= 0 ? String(Math.round(budget)) : "",
    steps,
    start_date: today,
    end_date: end || "",
  };
};

const FALLBACK_ERROR = "No pudimos completar la petición. Inténtalo de nuevo.";

export default function IaInitiativeSuggest({ objective, existingTitles = [], onAdd }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // { code, message }
  const [response, setResponse] = useState(null); // { result, usage, cached, generated_at }
  const [added, setAdded] = useState([]); // índices ya agregados al plan

  const suggest = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callIa("sugerir_iniciativa", {
        objetivo: objective,
        existentes: existingTitles,
      });
      setResponse(data);
      setAdded([]);
    } catch (err) {
      const ia = err instanceof IaError;
      setError({ code: ia ? err.code : "desconocido", message: ia ? err.message : FALLBACK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  const add = (ini, idx) => {
    onAdd(initiativeFieldsFrom(ini));
    setAdded((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
  };

  const close = () => {
    setResponse(null);
    setError(null);
    setAdded([]);
  };

  const errorBlock = error && (
    <div
      className={
        error.code === "no_configurado"
          ? "p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-600 dark:text-amber-400 text-sm"
          : "p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
      }
    >
      {error.message}
    </div>
  );

  if (!response) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="glass hover:border-accent font-subtitle"
          disabled={loading}
          onClick={suggest}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Pensando…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-accent" /> Sugerir iniciativa con IA
            </>
          )}
        </Button>
        {errorBlock}
      </div>
    );
  }

  const list = Array.isArray(response?.result?.iniciativas) ? response.result.iniciativas : [];

  return (
    <Card className="glass border-accent/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="flex-grow min-w-0">
            <p className="font-subtitle text-sm">Iniciativas sugeridas</p>
            <p className="text-xs text-muted">
              Dos opciones para empezar: agrégalas y ajústalas a tu empresa.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-muted" onClick={close}>
            <X className="w-4 h-4" /> Cerrar
          </Button>
        </div>

        {list.length === 0 && (
          <p className="text-sm text-muted">La IA no devolvió sugerencias. Cierra e inténtalo de nuevo.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((ini, idx) => {
            const done = added.includes(idx);
            const pasos = Array.isArray(ini?.pasos) ? ini.pasos : [];
            return (
              <div key={idx} className="p-4 glass rounded-xl flex flex-col gap-3">
                <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-subtitle border border-accent/40 bg-accent/10 text-accent">
                  {OPTION_TAG[idx] || `Opción ${idx + 1}`}
                </span>
                <p className="font-subtitle text-sm">{ini?.titulo}</p>
                <div className="text-xs space-y-1">
                  <p>
                    <span className="text-muted">Resultado esperado:</span> {ini?.resultado_esperado}
                  </p>
                  <p>
                    <span className="text-muted">KPI:</span> {ini?.kpi}
                  </p>
                  <p>
                    <span className="text-muted">Plazo:</span> {weeksText(ini?.plazo_semanas)}
                    {" · "}
                    <span className="text-muted">Presupuesto:</span> {budgetText(ini?.presupuesto_mxn)}
                  </p>
                  <p>
                    <span className="text-muted">Área:</span> {ini?.area}
                    {" · "}
                    <span className="text-muted">Responsable:</span> {ini?.responsable}
                  </p>
                </div>
                {pasos.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1">Plan de trabajo</p>
                    <ol className="list-decimal pl-5 text-sm space-y-0.5">
                      {pasos.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {ini?.por_que && <p className="text-xs text-muted italic">{ini.por_que}</p>}
                <div className="mt-auto pt-1">
                  {done ? (
                    <span className="inline-flex items-center text-sm font-subtitle text-green-600 dark:text-green-400">
                      Agregada ✓
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="glass hover:border-accent font-subtitle w-full sm:w-auto"
                      onClick={() => add(ini, idx)}
                    >
                      <Plus className="w-4 h-4" /> Agregar al plan
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <IaDisclaimer generatedAt={response.generated_at} cached={!!response.cached} />
      </CardContent>
    </Card>
  );
}

IaInitiativeSuggest.propTypes = {
  objective: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    tipo: PropTypes.oneOf(["debilidad", "riesgo"]).isRequired,
    perspectiva: PropTypes.string,
    estrategia: PropTypes.string,
    nivel: PropTypes.string,
    controles: PropTypes.arrayOf(PropTypes.string),
    fuente: PropTypes.string,
  }).isRequired,
  existingTitles: PropTypes.arrayOf(PropTypes.string),
  onAdd: PropTypes.func.isRequired,
};
