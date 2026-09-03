import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Calculator,
  ArrowRight,
  ChevronRight,
  Building,
  TrendingUp,
  Layers,
  Receipt,
  FileText,
  Scale,
  Waves,
  Gauge,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import {
  SALES_SECTION,
  EXPENSES_SECTION,
  sumValues,
} from "@/config/finConfig";

// Inicio del módulo de Análisis Financiero: qué es, en qué vas y el recorrido.

const STEPS = [
  {
    key: "FinAnalysisData",
    name: "Datos generales",
    desc: "Tu empresa y los años a analizar.",
    icon: Building,
    ready: true,
  },
  {
    key: "FinAnalysisSales",
    name: "Ventas",
    desc: "Ventas históricas por línea de negocio.",
    icon: TrendingUp,
    ready: true,
  },
  {
    key: "FinAnalysisCosts",
    name: "Costo de ventas",
    desc: "Lo que cuesta producir o entregar cada línea.",
    icon: Layers,
    ready: true,
  },
  {
    key: "FinAnalysisExpenses",
    name: "Gastos de operación",
    desc: "Los gastos para operar el negocio.",
    icon: Receipt,
    ready: true,
  },
  {
    key: null,
    name: "Estado de Resultados",
    desc: "Utilidades, EBITDA y márgenes — se calculará solo.",
    icon: FileText,
    ready: false,
  },
  {
    key: null,
    name: "Balance General",
    desc: "Activo, pasivo y capital con validación automática.",
    icon: Scale,
    ready: false,
  },
  {
    key: null,
    name: "Flujo de efectivo",
    desc: "Estado de cambios (automático) y flujo directo.",
    icon: Waves,
    ready: false,
  },
  {
    key: null,
    name: "Razones financieras",
    desc: "18 indicadores con semáforo y explicación simple.",
    icon: Gauge,
    ready: false,
  },
];

export default function FinAnalysisHome() {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await FinAnalysis.getOrCreate();
        const [years, lines, stored] = await Promise.all([
          FinYear.list(a.id),
          FinLine.list(a.id),
          FinValue.getSections(a.id, [SALES_SECTION, EXPENSES_SECTION]),
        ]);
        const sales = stored[SALES_SECTION] || {};
        const hasSales = lines.some((l) =>
          years.some((y) => sales[l.id]?.[y.id] != null)
        );
        const expenses = stored[EXPENSES_SECTION] || {};
        const hasExpenses = Object.values(expenses).some((byYear) =>
          Object.values(byYear).some((v) => v != null)
        );
        const lastYear = years[years.length - 1];
        const lastSales = lastYear
          ? sumValues(lines.map((l) => sales[l.id]?.[lastYear.id]))
          : 0;
        if (active) {
          setMeta({
            company: a.company_name,
            yearCount: years.length,
            lineCount: lines.length,
            hasSales,
            hasExpenses,
            lastSales,
          });
        }
      } catch (err) {
        console.error("Error al cargar el inicio del análisis financiero:", err);
        if (active) setMeta(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const stepMeta = (key) => {
    if (!meta) return null;
    switch (key) {
      case "FinAnalysisData":
        return meta.yearCount > 0
          ? `${meta.yearCount} año(s) definidos`
          : "Empieza aquí";
      case "FinAnalysisSales":
        return meta.lineCount > 0
          ? `${meta.lineCount} línea(s) de negocio`
          : null;
      case "FinAnalysisCosts":
        return null;
      case "FinAnalysisExpenses":
        return meta.hasExpenses ? "Con captura" : null;
      default:
        return null;
    }
  };

  const continueTarget = !meta || meta.yearCount === 0
    ? { key: "FinAnalysisData", label: "Empezar" }
    : meta.lineCount === 0 || !meta.hasSales
      ? { key: "FinAnalysisSales", label: "Continuar" }
      : !meta.hasExpenses
        ? { key: "FinAnalysisExpenses", label: "Continuar" }
        : { key: "FinAnalysisExpenses", label: "Revisar captura" };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="glass rounded-3xl p-8 animate-pulse h-28" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calculator className="w-7 h-7 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-3xl font-title mb-1">Análisis Financiero</h1>
              <p className="text-lg text-muted">
                Entiende los números históricos de tu empresa antes de planear.
              </p>
            </div>
          </div>
          <Link to={createPageUrl(continueTarget.key)}>
            <button className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-subtitle text-sm flex-shrink-0">
              {continueTarget.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Qué es */}
      <Card className="glass">
        <CardContent className="p-6">
          <h2 className="font-subtitle text-lg mb-2">¿Qué es esto?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Aquí capturas la información financiera histórica de tu empresa —
            ventas, costos, gastos, y más adelante el estado de resultados y el
            balance — y el módulo calcula por ti los totales, márgenes e
            indicadores. Es la fotografía de dónde estás parado, y será la base de
            la Planeación Financiera. Todo se guarda automáticamente y las cifras
            se capturan <strong>en miles</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Recorrido */}
      <div>
        <h2 className="text-xl font-title mb-4">El recorrido</h2>
        <div className="space-y-2">
          {STEPS.map((s, i) => {
            const extra = s.ready ? stepMeta(s.key) : null;
            const inner = (
              <div
                className={`flex items-center gap-4 p-4 glass rounded-2xl transition-all ${
                  s.ready ? "hover:border-accent" : "opacity-60"
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-cyan-500/15 text-cyan-500 flex items-center justify-center font-title text-sm flex-shrink-0">
                  {i + 1}
                </span>
                <s.icon className="w-5 h-5 text-muted flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-subtitle">{s.name}</span>
                    {!s.ready && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-subtitle bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/30">
                        <Clock className="w-3 h-3" /> Próximamente
                      </span>
                    )}
                    {extra && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-subtitle bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        {extra}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{s.desc}</p>
                </div>
                {s.ready && <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
              </div>
            );
            return s.ready ? (
              <Link key={s.name} to={createPageUrl(s.key)} className="block">
                {inner}
              </Link>
            ) : (
              <div key={s.name}>{inner}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
