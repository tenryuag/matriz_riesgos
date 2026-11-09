import { useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, ShieldAlert, Info, CircleDashed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStrategyInputs } from "@/hooks/useStrategyInputs";
import { riskObjectivesFrom } from "@/config/strategicCalc";
import RiskObjectiveBadges from "@/components/strategy/RiskObjectiveBadges";
import InlinePerspectivePicker from "@/components/strategy/InlinePerspectivePicker";

// ============================================================
// Riesgos de la matriz: los riesgos críticos (nivel inherente Alto o
// Intolerable) que entran a la planeación como objetivos de prioridad alta.
// Antes se mezclaban con las estrategias en "Resumen y priorización"; Mara
// pidió verlos aparte, con la explicación de que vienen de la matriz. Aquí
// también se les asigna perspectiva sin ir a la matriz.
// ============================================================

function Counter({ value, label, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm ${className}`}>
      <span className="font-subtitle">{value}</span> {label}
    </span>
  );
}

Counter.propTypes = {
  value: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default function StrategicRisks() {
  const { inputs, loading, error, reload, risksEnabled } = useStrategyInputs();
  const riskObjectives = useMemo(
    () => (inputs ? riskObjectivesFrom(inputs.risks, inputs.decisions) : []),
    [inputs]
  );

  const intolerable = riskObjectives.filter((o) => o.level === "INTOLERABLE").length;
  const high = riskObjectives.filter((o) => o.level === "HIGH").length;
  const unassigned = riskObjectives.filter((o) => !o.perspective).length;

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-3xl p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("StrategicPlanning")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Riesgos de la matriz</h1>
            <p className="text-muted">Tus riesgos críticos, ya dentro de tu plan.</p>
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
                Estos riesgos no vienen de las pantallas de planeación: vienen de tu{" "}
                <span className="text-foreground font-subtitle">Matriz de Riesgos</span>, y son los
                que clasificaste como Alto o Intolerable. Entran a tu plan como{" "}
                <span className="text-green-600 dark:text-green-500 font-subtitle">prioridad alta</span>{" "}
                sin que los califiques: por su gravedad, atenderlos no puede esperar. Si crees que
                alguno está sobreestimado, corrige su probabilidad e impacto en la matriz. Aquí les
                asignas la perspectiva que les toca y pasas a planear sus controles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {!error && !risksEnabled && (
        <Card className="glass">
          <CardContent className="p-8 text-center text-muted space-y-2">
            <p className="text-sm">
              No tienes acceso al módulo de Matriz de Riesgos, así que aquí no hay riesgos que
              mostrar. Tu planeación sigue funcionando con tus estrategias.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && risksEnabled && riskObjectives.length === 0 && (
        <Card className="glass">
          <CardContent className="p-8 text-center text-muted space-y-3">
            <p className="text-sm">
              No hay riesgos Alto o Intolerable en tu matriz; cuando los haya, aparecerán aquí
              automáticamente.
            </p>
            <Link to={createPageUrl("AllRisks")} className="text-accent text-sm font-subtitle hover:underline">
              Ir a la Matriz de Riesgos →
            </Link>
          </CardContent>
        </Card>
      )}

      {!error && risksEnabled && riskObjectives.length > 0 && (
        <>
          {/* Contadores */}
          <div className="flex flex-wrap gap-3">
            <Counter value={riskObjectives.length} label={riskObjectives.length === 1 ? "riesgo crítico" : "riesgos críticos"} className="text-red-600 dark:text-red-400" />
            <Counter value={intolerable} label={intolerable === 1 ? "intolerable" : "intolerables"} />
            <Counter value={high} label={high === 1 ? "alto" : "altos"} />
            <Counter
              value={unassigned}
              label="sin perspectiva"
              className={unassigned > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted"}
            />
          </div>

          {/* Una tarjeta por riesgo */}
          <div className="space-y-3">
            {riskObjectives.map((o) => (
              <Card key={o.id} id={`risk-${o.riskId}`} className="glass">
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm font-subtitle break-words">{o.label}</p>
                      <RiskObjectiveBadges objective={o} />
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border flex-shrink-0 border-green-500/50 bg-green-500/15 text-green-600 dark:text-green-400"
                      title={`Prioridad alta por la gravedad del riesgo (puntaje ${o.score} de 25)`}
                    >
                      Prioridad alta · por su gravedad
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Estrategia: {o.strategy || "Sin definir"} · Controles: {o.controls.length || "ninguno"}
                    {o.residualLabel ? ` · Después de controles: ${o.residualLabel}` : ""}
                  </p>
                  {o.controls.length > 0 && (
                    <ul className="text-xs text-muted space-y-1 list-disc pl-5">
                      {o.controls.map((c) => (
                        <li key={c.n}>{c.text}</li>
                      ))}
                    </ul>
                  )}
                  {!o.perspective && (
                    <div className="p-3 rounded-xl border border-dashed border-amber-400/50 bg-amber-400/5">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-subtitle flex items-center gap-1.5 mb-2">
                        <CircleDashed className="w-3.5 h-3.5" /> Sin perspectiva: no puede ubicarse en el mapa estratégico
                      </p>
                      <InlinePerspectivePicker riskId={o.riskId} value={o.perspective} onSaved={reload} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs">
                    <Link
                      to={createPageUrl("StrategicInitiatives") + "#risk-" + o.riskId}
                      className="text-accent font-subtitle hover:underline"
                    >
                      {o.controls.length > 0 ? "Planear sus controles →" : "Planear este riesgo →"}
                    </Link>
                    <Link
                      to={createPageUrl(`AddRisk?id=${o.riskId}`)}
                      className="text-accent font-subtitle hover:underline"
                    >
                      Ver en la matriz →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Navegación del recorrido */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("StrategicSummary")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Resumen y priorización
          </Button>
        </Link>
        <Link to={createPageUrl("StrategicMap")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Mapa estratégico →
          </Button>
        </Link>
      </div>
    </div>
  );
}
