import { useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Grid2x2,
  Sparkles,
  Award,
  Wrench,
  Sprout,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStrategyInputs, LOAD_ERROR_TEXT } from "@/hooks/useStrategyInputs";
import RiskLevelChip from "@/components/strategy/RiskLevelChip";

// ============================================================
// FODA automático: se genera 100% de lo ya capturado en el módulo, con la
// redacción de la metodología (Excel v2_FODA); el detalle vive en buildFoda.
// - Fortalezas: "voy a mantener" (mercado + palancas) y situaciones
//   financieras favorables.
// - Debilidades: "voy a cambiar" (mercado + palancas, con prioridad),
//   situaciones financieras y decisiones financieras sin situación marcada.
// - Oportunidades: diagnóstico externo, competidores peores que la empresa
//   y las respuestas Blue Ocean (crear / incrementar).
// - Amenazas: diagnóstico externo y competidores mejores que la empresa.
// - Riesgos críticos de la matriz (Fase 2): los internos entran como
//   debilidades y los externos como amenazas, con su chip de nivel.
// ============================================================

// Motor compartido con el servidor MCP.
export { MARKET_SECTION } from "@/config/strategicCatalog";
export { buildFoda } from "@/config/strategicCalc";
import { buildFoda, mergeFodaWithRisks, riskObjectivesFrom } from "@/config/strategicCalc";

const PRIORITY_CHIP = {
  Alta: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
  Media: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/40",
  Baja: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-400/30",
};

export default function FodaAnalysis() {
  const { inputs, loading, error } = useStrategyInputs();
  const riskObjectives = useMemo(
    () => (inputs ? riskObjectivesFrom(inputs.risks, inputs.decisions) : []),
    [inputs]
  );
  const foda = useMemo(
    () =>
      inputs
        ? mergeFodaWithRisks(
            buildFoda({
              sections: inputs.sections,
              competitors: inputs.competitors,
              ratings: inputs.ratings,
            }),
            riskObjectives
          )
        : null,
    [inputs, riskObjectives]
  );
  const hasRisks = riskObjectives.length > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!foda) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("StrategicPlanning")}>
            <Button variant="ghost" size="icon" className="glass">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-title">FODA</h1>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error || LOAD_ERROR_TEXT}
        </div>
      </div>
    );
  }

  const quadrants = [
    {
      key: "fortalezas",
      title: "Fortalezas",
      friendly: "En qué somos buenos",
      icon: Award,
      accent: "text-green-600 dark:text-green-500",
      bg: "bg-green-500/15",
      border: "border-green-500/40",
      items: foda.fortalezas,
      empty: "Marca fortalezas ('voy a mantener') en las conclusiones, o situaciones favorables en Estrategias financieras.",
      editHref: "MarketConclusions",
      editLabel: "Editar en Conclusiones",
      links: [{ href: "FinancialStrategies", label: "Situaciones financieras" }],
    },
    {
      key: "oportunidades",
      title: "Oportunidades",
      friendly: "Lo que el entorno te ofrece",
      icon: Sprout,
      accent: "text-blue-600 dark:text-blue-500",
      bg: "bg-blue-500/15",
      border: "border-blue-500/40",
      items: foda.oportunidades,
      empty:
        "Responde el Diagnóstico externo, compara a tus competidores o escribe en 'Crear' e 'Incrementar' de Oportunidades del mercado.",
      editHref: "ExternalDiagnosis",
      editLabel: "Responder el Diagnóstico externo",
      links: [{ href: "MarketOpportunities", label: "Oportunidades del mercado" }],
    },
    {
      key: "debilidades",
      title: "Debilidades",
      friendly: hasRisks ? "Qué vamos a cambiar · incluye riesgos internos" : "Qué vamos a cambiar",
      icon: Wrench,
      accent: "text-orange-600 dark:text-orange-500",
      bg: "bg-orange-500/15",
      border: "border-orange-500/40",
      items: foda.debilidades,
      empty: "Marca debilidades ('voy a cambiar') en las conclusiones, o situaciones a resolver en Estrategias financieras.",
      editHref: "StrategicSummary",
      editLabel: "Priorizar en el Resumen",
    },
    {
      key: "amenazas",
      title: "Amenazas",
      friendly: hasRisks
        ? "Lo que te amenaza desde afuera · incluye riesgos externos"
        : "Lo que te amenaza desde afuera",
      icon: ShieldAlert,
      accent: "text-red-600 dark:text-red-500",
      bg: "bg-red-500/15",
      border: "border-red-500/40",
      items: foda.amenazas,
      empty: "Responde el Diagnóstico externo y compara a tus competidores en el análisis del mercado.",
      editHref: "ExternalDiagnosis",
      editLabel: "Responder el Diagnóstico externo",
      links: [{ href: "MarketAnalysis", label: "Editar competidores" }],
    },
  ];

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
          <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Grid2x2 className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-title">FODA</h1>
            <p className="text-muted">Fortalezas, Oportunidades, Debilidades y Amenazas — en una sola vista.</p>
          </div>
        </div>
      </div>

      {/* Se llena solo */}
      <Card className="glass">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            Este FODA se genera automáticamente con lo que ya capturaste, redactado como
            diagnóstico de tu empresa: tus conclusiones del mercado y de las palancas, tus
            situaciones financieras, tu diagnóstico externo, la comparación con tus
            competidores (si son mejores que tú es una amenaza; si son peores, una
            oportunidad) y tus respuestas Blue Ocean. Si cambias algo en esas pantallas,
            aquí se actualiza solo.
            {hasRisks &&
              " Tus riesgos Alto o Intolerable de la matriz también entran: los internos como debilidades y los externos como amenazas."}
          </p>
        </CardContent>
      </Card>

      {/* Matriz 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quadrants.map((q) => (
          <Card key={q.key} className={`glass border-2 ${q.border}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-11 h-11 ${q.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <q.icon className={`w-5 h-5 ${q.accent}`} />
                </div>
                <div className="flex-grow">
                  <h2 className="font-subtitle leading-tight">{q.title}</h2>
                  <p className="text-xs text-muted mt-0.5">{q.friendly}</p>
                </div>
                <span className={`text-lg font-title flex-shrink-0 ${q.accent}`}>
                  {q.items.length}
                </span>
              </div>

              {q.items.length === 0 ? (
                <p className="text-xs text-muted italic mb-3">{q.empty}</p>
              ) : (
                <ul className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
                  {q.items.map((item, i) => (
                    <li
                      key={item.id || i}
                      className="flex items-center justify-between gap-2 p-2.5 glass rounded-lg text-sm"
                      title={item.strategy ? `Estrategia: ${item.strategy}` : undefined}
                    >
                      <span className="flex-grow min-w-0">
                        {item.label}
                        {item.detail && (
                          <span className="block text-xs text-muted mt-0.5">{item.detail}</span>
                        )}
                      </span>
                      {item.tag && item.source !== "risk" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle border border-[var(--card-border)] text-muted flex-shrink-0">
                          {item.tag}
                        </span>
                      )}
                      {item.source === "risk" && (
                        <>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40 flex-shrink-0">
                            Riesgo crítico
                          </span>
                          <RiskLevelChip levelKey={item.level} />
                        </>
                      )}
                      {item.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-subtitle border flex-shrink-0 ${PRIORITY_CHIP[item.priority]}`}>
                          {item.priority}
                        </span>
                      )}
                      {item.kind && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                          {item.kind}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link
                  to={createPageUrl(q.editHref)}
                  className="inline-flex items-center gap-1.5 text-xs text-accent font-subtitle hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> {q.editLabel}
                </Link>
                {(q.links || []).map((l) => (
                  <Link
                    key={l.href}
                    to={createPageUrl(l.href)}
                    className="inline-flex items-center gap-1.5 text-xs text-accent font-subtitle hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> {l.label}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("ExternalDiagnosis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Diagnóstico externo
          </Button>
        </Link>
        <Link to={createPageUrl("StrategicSummary")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Resumen y priorización →
          </Button>
        </Link>
      </div>
    </div>
  );
}
