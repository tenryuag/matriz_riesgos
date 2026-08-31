import React, { useState, useEffect } from "react";
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
import { StrategicPlan, Competitor, Initiative } from "@/api/entities";
import { QUESTIONS as CUSTOMER_QUESTIONS, SECTION as CUSTOMER_SECTION } from "./CustomerAnalysis";
import {
  RATING_SECTION,
  SUMMARY_SOURCE_SECTIONS,
  collectStrategies,
  scoreFor,
  priorityFor,
} from "./StrategicSummary";
import { buildFoda, MARKET_SECTION } from "./FodaAnalysis";

// ============================================================
// Inicio del módulo: dashboard ejecutivo de toma de decisiones.
// Todo se calcula de los datos capturados; el recorrido por fases queda
// al final en versión compacta para navegar.
// ============================================================

const compSection = (id) => `market-comp:${id}`;

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

export default function StrategicPlanning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const plan = await StrategicPlan.getOrCreate();
        const [comps, initiatives] = await Promise.all([
          Competitor.list(plan.id),
          Initiative.list(plan.id),
        ]);
        const sections = await StrategicPlan.getAnswersForSections(plan.id, [
          CUSTOMER_SECTION,
          ...SUMMARY_SOURCE_SECTIONS,
          RATING_SECTION,
          MARKET_SECTION,
          ...comps.map((c) => compSection(c.id)),
        ]);

        const ratings = sections[RATING_SECTION] || {};
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
        const today = new Date();
        const in30 = new Date(today.getTime() + 30 * 86400000);
        const overdue = initiatives.filter(
          (it) => it.end_date && new Date(it.end_date) < today
        ).length;
        const endingSoon = initiatives.filter((it) => {
          if (!it.end_date) return false;
          const d = new Date(it.end_date);
          return d >= today && d <= in30;
        }).length;

        const foda = buildFoda({ sections, competitors: comps, ratings });

        if (active) {
          setData({
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
          });
        }
      } catch (err) {
        console.error("Error al cargar el dashboard:", err);
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
  const continueTarget = !d
    ? { key: "CustomerAnalysis", label: "Empezar" }
    : d.dCount === 0
      ? d.customerAnswered < CUSTOMER_QUESTIONS.length
        ? { key: "CustomerAnalysis", label: d.customerAnswered > 0 ? "Continuar" : "Empezar" }
        : { key: "MarketAnalysis", label: "Continuar" }
      : d.unrated > 0
        ? { key: "StrategicSummary", label: "Priorizar" }
        : d.altaNoPlan > 0
          ? { key: "StrategicInitiatives", label: "Planear" }
          : { key: "ScoreCard", label: "Ver Score Card" };

  const alerts = [];
  if (d) {
    if (d.overdue > 0)
      alerts.push({ label: `${d.overdue} iniciativa(s) con fecha de término vencida`, href: "StrategicInitiatives" });
    if (d.altaNoPlan > 0)
      alerts.push({ label: `${d.altaNoPlan} objetivo(s) de prioridad alta sin plan de acción`, href: "StrategicInitiatives" });
    if (d.endingSoon > 0)
      alerts.push({ label: `${d.endingSoon} iniciativa(s) terminan en los próximos 30 días`, href: "ScoreCard" });
    if (d.unrated > 0)
      alerts.push({ label: `${d.unrated} debilidad(es) sin calificar en el resumen`, href: "StrategicSummary" });
  }

  const fodaMini = d
    ? [
        { title: "Fortalezas", count: d.foda.fortalezas.length, icon: Award, cls: "text-green-600 dark:text-green-500" },
        { title: "Oportunidades", count: d.foda.oportunidades.length, icon: Sprout, cls: "text-blue-600 dark:text-blue-500" },
        { title: "Debilidades", count: d.foda.debilidades.length, icon: Wrench, cls: "text-orange-600 dark:text-orange-500" },
        { title: "Amenazas", count: d.foda.amenazas.length, icon: ShieldAlert, cls: "text-red-600 dark:text-red-500" },
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
            <div className="text-3xl font-title text-accent">{d?.alta.length ?? 0}</div>
            <p className="text-xs text-muted mt-1">
              {d && d.altaNoPlan > 0 ? (
                <span className="text-orange-500">{d.altaNoPlan} sin plan</span>
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
                    to={createPageUrl(a.href)}
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
        d && d.dCount > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/10 px-5 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />
            <p className="text-sm">Sin pendientes urgentes. Tu plan está al día.</p>
          </div>
        )
      )}

      {/* Tu foco ahora */}
      {d && d.alta.length > 0 && (
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
              {d.alta.slice(0, 5).map((w, i) => (
                <li key={w.id}>
                  <Link
                    to={createPageUrl("StrategicInitiatives")}
                    className="flex items-center gap-3 p-3 glass rounded-xl text-sm hover:border-accent transition-all"
                  >
                    <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-subtitle flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-grow">{w.label}</span>
                    {w.initiativeCount > 0 ? (
                      <span className="text-xs text-muted flex-shrink-0">
                        {w.initiativeCount} iniciativa(s)
                      </span>
                    ) : (
                      <span className="text-xs text-orange-500 font-subtitle flex-shrink-0">
                        Sin plan ⚠
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
            {d.alta.length > 5 && (
              <p className="text-xs text-muted mt-2">
                +{d.alta.length - 5} más en el mapa calibrado.
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
                  <span className={`text-2xl font-title ${q.cls}`}>{q.count}</span>
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
