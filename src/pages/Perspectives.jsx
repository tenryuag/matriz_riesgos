// ============================================================
// Pantalla "Perspectivas": entrada principal del módulo de riesgos.
// Una tarjeta por perspectiva (orden Balanced Scorecard) con explicación,
// ejemplos para "tomar" y conteos (total · críticos · sin puntaje).
// Datos: Risk.list() (RLS: solo los del usuario); conteos con
// countByPerspective y progreso de migración con migrationProgress.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Risk } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { Plus, Eye, ChevronDown, ChevronUp, HelpCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { PERSPECTIVES } from "@/config/perspectives";
import { countByPerspective, migrationProgress } from "@/lib/perspectiveView";
import { iconForPerspective } from "@/components/perspectives/perspectiveIcons";
import MigrationBanner from "@/components/perspectives/MigrationBanner";

export default function Perspectives() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  // true cuando falló la carga; el texto se resuelve al pintar (t puede cambiar de idioma).
  const [loadFailed, setLoadFailed] = useState(false);
  // Ayuda "¿Qué va aquí?" desplegada por perspectiva (cerrada por defecto).
  const [helpOpen, setHelpOpen] = useState({});
  // Ejemplos desplegados en móvil cuando la perspectiva ya tiene riesgos.
  const [examplesOpen, setExamplesOpen] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const list = await Risk.list("-created_date");
      setRisks(list || []);
    } catch (err) {
      console.error("Error loading perspectives:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts = countByPerspective(risks);
  const progress = migrationProgress(risks);

  const toggle = (setter, key) => setter((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* En móvil el botón ☰ del Layout es fijo arriba a la izquierda: dejarle espacio */}
        <div className="pl-12 lg:pl-0">
          <h1 className="text-3xl font-title mb-2">{t("perspTitle")}</h1>
          <p className="text-muted">{t("perspSubtitle")}</p>
        </div>
        <Link to={createPageUrl("AddRisk")} className="w-full md:w-auto">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            {t("newRisk")}
          </Button>
        </Link>
      </div>

      {/* Error de carga con reintento */}
      {loadFailed && (
        <Alert variant="destructive" className="bg-red-500/20 border-red-400/30 text-red-200">
          <AlertDescription className="flex flex-col md:flex-row md:items-center gap-3">
            <span className="flex-1">{t("perspLoadError")}</span>
            <Button variant="outline" size="sm" onClick={loadData} className="glass hover:border-accent w-full md:w-auto">
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Aviso de migración (solo si hay riesgos sin perspectiva) */}
      {!loading && !loadFailed && <MigrationBanner count={progress.unassigned} />}

      {/* Cuadrícula de perspectivas: esqueletos al cargar; con error solo
          se muestra el Alert de arriba (no tarjetas en cero que lo contradigan) */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERSPECTIVES.map((p) => (
            <div key={p.key} className="glass rounded-3xl p-6 animate-pulse h-64" />
          ))}
        </div>
      ) : !loadFailed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERSPECTIVES.map((p) => {
            const Icon = iconForPerspective(p.key);
            const { total, critical, unscored } = counts[p.key];
            const isHelpOpen = !!helpOpen[p.key];
            // En móvil, con riesgos ya capturados, los ejemplos se pliegan
            // para no alargar la pantalla; en escritorio siempre se ven.
            const examplesCollapsible = isMobile && total > 0;
            const showExamples = !examplesCollapsible || !!examplesOpen[p.key];

            return (
              <Card key={p.key} className={`glass border-l-4 ${p.colorClasses.border} transition-all duration-300`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${p.colorClasses.bg}`}>
                      <Icon className={`w-6 h-6 ${p.colorClasses.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-subtitle text-lg">{p.label}</h2>
                      <p className="text-sm text-muted">{p.short}</p>
                    </div>
                  </div>

                  {/* ¿Qué va aquí? */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => toggle(setHelpOpen, p.key)}
                      aria-expanded={isHelpOpen}
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      <HelpCircle className="w-4 h-4" />
                      {t("perspWhatGoesHere")}
                      {isHelpOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isHelpOpen && <p className="text-sm text-muted mt-2">{p.help}</p>}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Conteos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass rounded-xl p-3 flex items-center gap-2">
                      <span className="text-sm">{t("perspTotalRisks", { count: total })}</span>
                    </div>
                    <div>
                      <div
                        className={`rounded-xl p-3 flex items-center gap-2 ${
                          critical > 0 ? "bg-red-500/20 border border-red-400/30" : "glass"
                        }`}
                      >
                        {critical > 0 && <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                        <span className={`text-sm ${critical > 0 ? "text-red-400" : ""}`}>
                          {t("perspCriticalCount", { count: critical })}
                        </span>
                      </div>
                      {critical > 0 && (
                        <p className="text-[11px] text-muted mt-1">{t("perspCriticalHint")}</p>
                      )}
                    </div>
                  </div>
                  {unscored > 0 && (
                    <p className="text-xs text-muted">{t("perspUnscoredCount", { count: unscored })}</p>
                  )}
                  {total === 0 && (
                    <p className="text-sm text-muted italic">{t("perspEmptyCard")}</p>
                  )}

                  {/* Ejemplos típicos */}
                  <div className="space-y-2">
                    {examplesCollapsible ? (
                      <button
                        type="button"
                        onClick={() => toggle(setExamplesOpen, p.key)}
                        aria-expanded={showExamples}
                        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-accent font-subtitle"
                      >
                        {t("perspExamplesTitle")}
                        {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    ) : (
                      <h3 className="text-xs uppercase tracking-wider text-accent font-subtitle">
                        {t("perspExamplesTitle")}
                      </h3>
                    )}
                    {showExamples &&
                      p.examples.map((ex, i) => (
                        <div key={i} className="glass rounded-xl p-3 flex items-start justify-between gap-3">
                          <p className="text-sm">{ex.description}</p>
                          <Link to={createPageUrl(`AddRisk?perspective=${p.key}&example=${i}`)} className="flex-shrink-0">
                            <Button variant="ghost" size="sm" className="text-accent">
                              {t("perspTakeExample")}
                            </Button>
                          </Link>
                        </div>
                      ))}
                  </div>

                  {/* Pie de tarjeta */}
                  <div className="flex gap-2 pt-2">
                    <Link to={createPageUrl(`PerspectiveRisks?key=${p.key}`)} className="flex-1">
                      <Button variant="outline" className="w-full glass hover:border-accent">
                        <Eye className="w-4 h-4 mr-2" />
                        {t("perspViewRisks")}
                      </Button>
                    </Link>
                    <Link to={createPageUrl(`AddRisk?perspective=${p.key}`)}>
                      <Button size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90" aria-label={t("newRisk")}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pie de página: asistente (permanente) y departamentos (anterior) */}
      <p className="text-sm text-muted text-center">
        <Link to={createPageUrl("PerspectiveMigration")} className="text-accent hover:underline">
          {t("perspReviewMigration")}
        </Link>
        <span className="mx-2">·</span>
        {t("perspFooterLegacy")}{" "}
        <Link to={createPageUrl("Departments")} className="text-accent hover:underline">
          {t("perspDepartmentsLegacy")}
        </Link>
      </p>
    </div>
  );
}
