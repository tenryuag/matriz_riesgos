import { useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Compass,
  ArrowRight,
  ChevronRight,
  Building,
  Globe,
  Map,
  Users,
  CheckCircle2,
  ClipboardCheck,
  Sprout,
  ListChecks,
  Banknote,
  ListOrdered,
  Filter,
  ClipboardList,
  Trophy,
  Grid2x2,
  Award,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  CalendarClock,
  Wallet,
  Crosshair,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStrategyInputs } from "@/hooks/useStrategyInputs";
import {
  localISODate,
  riskObjectivesFrom,
  riskInitiativeWarnings,
  summarizeRiskWarnings,
  focusItems,
  mergeFodaWithRisks,
  riskCountIn,
} from "@/config/strategicCalc";
import RiskLevelChip from "@/components/strategy/RiskLevelChip";
import { QUESTIONS as CUSTOMER_QUESTIONS, SECTION as CUSTOMER_SECTION } from "./CustomerAnalysis";
import { collectStrategies, scoreFor, priorityFor } from "./StrategicSummary";
import { buildFoda } from "./FodaAnalysis";

// ============================================================
// Inicio del módulo: dashboard ejecutivo de toma de decisiones.
// Todo se calcula de los datos capturados; el recorrido por fases queda
// al final en versión compacta para navegar.
// Fase 2: los riesgos críticos de la matriz entran como objetivos de
// prioridad alta (foco, alertas, mini FODA y destino de "Continuar").
// ============================================================

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

// Recorrido compacto (navegación por fases).
const PHASES = [
  {
    n: 1,
    title: "Análisis",
    screens: [
      { key: "CustomerAnalysis", name: "Análisis del cliente", icon: Users },
      { key: "MarketAnalysis", name: "Análisis del mercado", icon: Globe },
      { key: "MarketConclusions", name: "Conclusiones del mercado", icon: ClipboardCheck },
      { key: "OpportunityAnalysis", name: "Análisis de oportunidades", icon: Sprout },
      { key: "OpportunityConclusions", name: "Conclusión de oportunidades", icon: ListChecks },
      { key: "FinancialStrategies", name: "Estrategias financieras", icon: Banknote },
    ],
  },
  {
    n: 2,
    title: "Estrategia",
    screens: [
      { key: "Foda", name: "FODA", icon: Grid2x2 },
      { key: "StrategicSummary", name: "Resumen y priorización", icon: ListOrdered },
      { key: "StrategicMap", name: "Mapa estratégico", icon: Map },
      { key: "StrategicMapCalibrated", name: "Mapa calibrado", icon: Filter },
    ],
  },
  {
    n: 3,
    title: "Plan de acción",
    screens: [
      { key: "StrategicInitiatives", name: "Iniciativas estratégicas", icon: ClipboardList },
      { key: "ScoreCard", name: "Score Card ejecutivo", icon: Trophy },
    ],
  },
];

// Estado de cada fila de "Tu foco ahora" (focusItems de strategicCalc).
function focusStatusFor(item) {
  if (item.status === "planned") {
    return (
      <span className="text-xs text-muted flex-shrink-0">{item.initiativeCount} iniciativa(s)</span>
    );
  }
  if (item.status === "accepted") {
    return <span className="text-xs text-muted flex-shrink-0">Aceptado</span>;
  }
  if (item.status === "accepted-unconfirmed") {
    return (
      <span className="text-xs text-amber-500 font-subtitle flex-shrink-0">
        Aceptado · sin confirmar ⚠
      </span>
    );
  }
  return <span className="text-xs text-orange-500 font-subtitle flex-shrink-0">Sin plan ⚠</span>;
}

export default function StrategicPlanning() {
  const { inputs, loading, error } = useStrategyInputs({ extraSections: [CUSTOMER_SECTION] });
  const riskObjectives = useMemo(
    () => (inputs ? riskObjectivesFrom(inputs.risks, inputs.decisions) : []),
    [inputs]
  );
  const today = localISODate();

  const data = useMemo(() => {
    if (!inputs) return null;
    const { sections, ratings, initiatives, competitors: comps } = inputs;

    const customer = sections[CUSTOMER_SECTION] || {};
    const customerAnswered = CUSTOMER_QUESTIONS.filter(
      (q) => (customer[q.key] || "").trim()
    ).length;

    const { weaknesses } = collectStrategies(sections);
    const scored = weaknesses.map((w) => {
      const score = scoreFor(ratings, w.id);
      return { ...w, score, priority: priorityFor(score) };
    });
    const alta = scored
      .filter((w) => w.priority === "Alta")
      .sort((a, b) => a.score - b.score);
    const unrated = scored.filter((w) => w.score == null).length;

    const initByStrategy = {};
    initiatives.forEach((it) => {
      initByStrategy[it.strategy_id] = (initByStrategy[it.strategy_id] || 0) + 1;
    });
    const altaWithPlan = alta.map((w) => ({
      ...w,
      initiativeCount: initByStrategy[w.id] || 0,
    }));
    const altaNoPlan = altaWithPlan.filter((w) => w.initiativeCount === 0).length;

    const budget = initiatives.reduce((s, r) => s + (Number(r.budget) || 0), 0);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const overdue = initiatives.filter(
      (it) => it.end_date && new Date(it.end_date) < now
    ).length;
    const endingSoon = initiatives.filter((it) => {
      if (!it.end_date) return false;
      const dt = new Date(it.end_date);
      return dt >= now && dt <= in30;
    }).length;

    // Riesgos críticos (Fase 2)
    const warnings = riskInitiativeWarnings(riskObjectives, initiatives, today);
    const riskLines = summarizeRiskWarnings(warnings);
    const riskNoPlan = warnings.filter((w) => w.type === "no-plan").length;
    const riskUnconfirmed = warnings.filter((w) => w.type === "accepted-unconfirmed").length;
    const focus = focusItems(riskObjectives, altaWithPlan, initiatives);
    const foda = mergeFodaWithRisks(
      buildFoda({ sections, competitors: comps, ratings }),
      riskObjectives
    );

    return {
      customerAnswered,
      scored,
      alta: altaWithPlan,
      altaNoPlan,
      unrated,
      fCount: foda.fortalezas.length,
      dCount: scored.length,
      initiativeCount: initiatives.length,
      budget,
      overdue,
      endingSoon,
      foda,
      riskLines,
      riskNoPlan,
      riskUnconfirmed,
      focus,
    };
  }, [inputs, riskObjectives, today]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse h-28" />
          ))}
        </div>
        <div className="glass rounded-3xl p-6 animate-pulse h-48" />
      </div>
    );
  }

  const d = data;

  // A dónde lleva "Continuar": el siguiente paso que aporta más valor.
  // Quien no ha empezado el análisis va primero al análisis; con algo de
  // análisis, los riesgos críticos sin plan van antes que priorizar debilidades.
  const continueTarget = !d
    ? { key: "CustomerAnalysis", label: "Empezar" }
    : d.dCount === 0 && d.customerAnswered === 0
      ? { key: "CustomerAnalysis", label: "Empezar" }
      : d.riskNoPlan > 0
        ? { key: "StrategicInitiatives", label: "Planear riesgos" }
        : d.dCount === 0
          ? d.customerAnswered < CUSTOMER_QUESTIONS.length
            ? { key: "CustomerAnalysis", label: "Continuar" }
            : { key: "MarketAnalysis", label: "Continuar" }
          : d.unrated > 0
            ? { key: "StrategicSummary", label: "Priorizar" }
            : d.altaNoPlan > 0
              ? { key: "StrategicInitiatives", label: "Planear" }
              : { key: "ScoreCard", label: "Ver Score Card" };

  const alerts = [];
  if (d) {
    // Riesgos primero
    d.riskLines.forEach((l) => alerts.push({ label: l.label, href: l.href, hash: l.hash }));
    if (d.overdue > 0)
      alerts.push({ label: `${d.overdue} iniciativa(s) con fecha de término vencida`, href: "StrategicInitiatives" });
    if (d.altaNoPlan > 0)
      alerts.push({ label: `${d.altaNoPlan} objetivo(s) de prioridad alta sin plan de acción`, href: "StrategicInitiatives" });
    if (d.endingSoon > 0)
      alerts.push({ label: `${d.endingSoon} iniciativa(s) terminan en los próximos 30 días`, href: "ScoreCard" });
    if (d.unrated > 0)
      alerts.push({ label: `${d.unrated} debilidad(es) sin calificar en el resumen`, href: "StrategicSummary" });
  }

  const focus = d?.focus ?? { items: [], hidden: 0, total: 0 };
  const sinPlan = d ? d.riskNoPlan + d.altaNoPlan : 0;
  const porConfirmar = d?.riskUnconfirmed ?? 0;

  const fodaMini = d
    ? [
        { title: "Fortalezas", count: d.foda.fortalezas.length, icon: Award, cls: "text-green-600 dark:text-green-500" },
        { title: "Oportunidades", count: d.foda.oportunidades.length, icon: Sprout, cls: "text-blue-600 dark:text-blue-500" },
        { title: "Debilidades", count: d.foda.debilidades.length, risks: riskCountIn(d.foda.debilidades), icon: Wrench, cls: "text-orange-600 dark:text-orange-500" },
        { title: "Amenazas", count: d.foda.amenazas.length, risks: riskCountIn(d.foda.amenazas), icon: ShieldAlert, cls: "text-red-600 dark:text-red-500" },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Compass className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-title mb-1">Planeación Estratégica</h1>
              <p className="text-lg text-muted">
                Tu tablero ejecutivo: dónde estás, qué es urgente y qué sigue.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
              <Building className="w-4 h-4 text-accent" />
              <span className="font-subtitle text-sm">Tenryu Corp.</span>
            </div>
            <Link to={createPageUrl(continueTarget.key)}>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-subtitle text-sm">
                {continueTarget.label}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-subtitle text-muted uppercase tracking-wide">Fortalezas</span>
              <Award className="w-4 h-4 text-green-600 dark:text-green-500" />
            </div>
            <div className="text-3xl font-title">{d?.fCount ?? 0}</div>
            <p className="text-xs text-muted mt-1">a mantener</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-subtitle text-muted uppercase tracking-wide">Debilidades</span>
              <Wrench className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-3xl font-title">{d?.dCount ?? 0}</div>
            <p className="text-xs text-muted mt-1">
              {d && d.unrated > 0 ? `${d.unrated} sin calificar` : "todas calificadas"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-accent/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-subtitle text-muted uppercase tracking-wide">Tu foco</span>
              <Crosshair className="w-4 h-4 text-accent" />
            </div>
            <div className="text-3xl font-title text-accent">{focus.total}</div>
            <p className="text-xs text-muted mt-1">
              {sinPlan > 0 || porConfirmar > 0 ? (
                <>
                  {sinPlan > 0 && <span className="text-orange-500">{sinPlan} sin plan</span>}
                  {sinPlan > 0 && porConfirmar > 0 && " · "}
                  {porConfirmar > 0 && (
                    <span className="text-amber-500">{porConfirmar} por confirmar</span>
                  )}
                </>
              ) : (
                "prioridad alta"
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-subtitle text-muted uppercase tracking-wide">Plan de acción</span>
              <Wallet className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-title">{d ? money.format(d.budget) : "$0"}</div>
            <p className="text-xs text-muted mt-1">
              {d?.initiativeCount ?? 0} iniciativa(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {alerts.length > 0 ? (
        <Card className="glass border-amber-400/40">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="font-subtitle text-sm uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Requiere tu atención
              </h2>
            </div>
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link
                    to={createPageUrl(a.href) + (a.hash || "")}
                    className="flex items-center justify-between gap-2 p-2.5 glass rounded-lg text-sm hover:border-accent transition-all"
                  >
                    <span>{a.label}</span>
                    <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        d && (d.dCount > 0 || riskObjectives.length > 0) && (
          <div className="flex items-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/10 px-5 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />
            <p className="text-sm">Sin pendientes urgentes. Tu plan está al día.</p>
          </div>
        )
      )}

      {/* Tu foco ahora */}
      {d && focus.items.length > 0 && (
        <Card className="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-accent" />
                <h2 className="font-subtitle text-sm uppercase tracking-wide text-accent">
                  Tu foco ahora
                </h2>
              </div>
              <Link to={createPageUrl("StrategicMapCalibrated")} className="text-xs text-accent font-subtitle hover:underline">
                Ver mapa calibrado →
              </Link>
            </div>
            <ul className="space-y-2">
              {focus.items.map((item, i) => (
                <li key={item.id}>
                  <Link
                    to={
                      item.kind === "risk"
                        ? createPageUrl("StrategicInitiatives") + "#risk-" + item.riskId
                        : createPageUrl("StrategicInitiatives")
                    }
                    className="flex flex-wrap items-center gap-3 p-3 glass rounded-xl text-sm hover:border-accent transition-all"
                  >
                    <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-subtitle flex-shrink-0">
                      {i + 1}
                    </span>
                    {item.kind === "risk" && <RiskLevelChip levelKey={item.level} />}
                    <span className="flex-grow">{item.label}</span>
                    {focusStatusFor(item)}
                    <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
            {focus.hidden > 0 && (
              <p className="text-xs text-muted mt-2">
                +{focus.hidden} más en el mapa calibrado.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mini FODA */}
      {d && (
        <Card className="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Grid2x2 className="w-4 h-4 text-accent" />
                <h2 className="font-subtitle text-sm uppercase tracking-wide text-accent">FODA</h2>
              </div>
              <Link to={createPageUrl("Foda")} className="text-xs text-accent font-subtitle hover:underline">
                Ver completo →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {fodaMini.map((q) => (
                <Link
                  key={q.title}
                  to={createPageUrl("Foda")}
                  className="p-3 glass rounded-xl hover:border-accent transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <q.icon className={`w-4 h-4 ${q.cls}`} />
                    <span className="text-xs text-muted">{q.title}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-2xl font-title ${q.cls}`}>{q.count}</span>
                    {q.risks > 0 && (
                      <span className="text-[10px] text-muted">incl. {q.risks} riesgo(s)</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recorrido compacto */}
      <div>
        <h2 className="text-xl font-title mb-4">El recorrido completo</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PHASES.map((phase) => (
            <Card key={phase.n} className="glass">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-title text-sm flex-shrink-0">
                    {phase.n}
                  </span>
                  <h3 className="font-subtitle">{phase.title}</h3>
                </div>
                <ul className="space-y-1">
                  {phase.screens.map((s) => (
                    <li key={s.key}>
                      <Link
                        to={createPageUrl(s.key)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-[var(--table-row-hover)] transition-colors group"
                      >
                        <s.icon className="w-4 h-4 text-muted group-hover:text-accent flex-shrink-0" />
                        <span className="flex-grow">{s.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Nota calendario cuando hay iniciativas al día */}
      {d && d.initiativeCount > 0 && d.overdue === 0 && d.endingSoon === 0 && (
        <p className="text-xs text-muted flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5" />
          Ninguna iniciativa vence en los próximos 30 días.
        </p>
      )}
    </div>
  );
}
