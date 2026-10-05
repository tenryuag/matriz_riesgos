// ============================================================
// Asistente de migración: convierte departamentos en perspectivas (Fase 1).
// Un clic por departamento, con Deshacer, progreso y asignación de riesgos
// sueltos (sin departamento o huérfanos). Nada se borra ni se renombra.
// El estado "listo"/"pendiente" de cada fila sale SIEMPRE de la base de
// datos (departments.perspective_key + riesgos con esa clave), no de memoria.
// ============================================================
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Risk, Department } from "@/api/entities";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Search,
  Undo2,
  Edit,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import { getRiskLevelColorClasses } from "@/lib/utils";
import { levelKeyOf, labelForLevelKey } from "@/config/riskCalc";
import {
  migrationProgress,
  groupByDepartment,
  looseUnassigned,
  isUnscored,
} from "@/lib/perspectiveView";
import PerspectiveBadge from "@/components/perspectives/PerspectiveBadge";
import PerspectivePicker from "@/components/perspectives/PerspectivePicker";

// Quita una clave de un objeto de estado sin mutarlo.
const without = (obj, id) => {
  const next = { ...obj };
  delete next[id];
  return next;
};

// Spinner pequeño con el patrón que ya usan AddRisk y AddDepartment.
const Spinner = () => (
  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
);

export default function PerspectiveMigration() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [risks, setRisks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // SOLO lo que el usuario eligió a mano: { [departmentId]: key }.
  // No se inicializa con la sugerencia; se limpia tras Asignar/Deshacer.
  const [selection, setSelection] = useState({});
  // { [departmentId]: 'assign' | 'undo' }
  const [busy, setBusy] = useState({});
  // { [riskId]: true } para los riesgos sueltos
  const [looseBusy, setLooseBusy] = useState({});
  // Clave i18n del error al guardar/recargar (vacío = sin error); se traduce al pintar
  const [error, setError] = useState("");
  // Filtro por nombre de departamento (solo con más de 10 filas)
  const [search, setSearch] = useState("");

  // Recarga riesgos y departamentos. El progreso y las filas se recalculan
  // de estos datos: nunca se llevan contadores a mano.
  // initial=true (carga inicial / Reintentar): un fallo sustituye la pantalla
  // por el Alert de carga. En las recargas tras Asignar/Deshacer se conservan
  // los datos previos y el fallo se avisa en el Alert inline.
  const loadData = useCallback(async (initial = false) => {
    try {
      const [risksList, departmentsList] = await Promise.all([
        Risk.list("-created_date"),
        Department.list("name"),
      ]);
      setRisks(risksList || []);
      setDepartments(departmentsList || []);
      setLoadError(false);
    } catch (e) {
      console.error("Error loading migration data:", e);
      if (initial) setLoadError(true);
      else setError("perspLoadError");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const retry = () => {
    setLoading(true);
    loadData(true);
  };

  const progress = useMemo(() => migrationProgress(risks), [risks]);
  const rows = useMemo(() => groupByDepartment(risks, departments), [risks, departments]);
  const loose = useMemo(() => looseUnassigned(risks, departments), [risks, departments]);

  // Filas visibles: con más de 10 departamentos se filtra por nombre.
  const showSearch = rows.length > 10;
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!showSearch || !term) return rows;
    return rows.filter((row) => String(row.department.name || "").toLowerCase().includes(term));
  }, [rows, search, showSearch]);

  // Valor mostrado y usado al asignar: la elección manual si existe; si no,
  // la sugerencia (mapa guardado o heurística). null = ningún chip.
  const chosen = (id, row) => (selection[id] !== undefined ? selection[id] : row.suggestion);

  const clearSelection = (id) => setSelection((s) => without(s, id));

  // Asignar: 1) mapa del departamento, 2) riesgos sin perspectiva.
  // Si falla el paso 2, la fila sigue pendiente con sugerencia = mapa y
  // reintentar es idempotente.
  const handleAssign = async (row) => {
    const dept = row.department;
    const key = chosen(dept.id, row);
    if (!key || busy[dept.id]) return;
    setError("");
    setBusy((b) => ({ ...b, [dept.id]: "assign" }));
    try {
      await Department.setPerspective(dept.id, key);          // 1) mapa
      await Risk.assignPerspectiveByDepartment(dept.id, key); // 2) riesgos sin perspectiva
    } catch (e) {
      console.error("Error assigning perspective:", e);
      setError("perspSaveError");
    } finally {
      // busy se mantiene hasta terminar la recarga: así no hay ventana para
      // un segundo clic con la fila aún "pendiente".
      clearSelection(dept.id);
      await loadData();
      setBusy((b) => without(b, dept.id));
    }
  };

  // Deshacer: 1) riesgos con esa clave → NULL, 2) mapa → NULL.
  // Si falla el paso 2, los riesgos ya están en NULL y la fila vuelve a
  // pendiente con la sugerencia = mapa guardado (reintentable).
  const handleUndo = async (row) => {
    const dept = row.department;
    if (!row.assignedKey || busy[dept.id]) return;
    setError("");
    setBusy((b) => ({ ...b, [dept.id]: "undo" }));
    try {
      await Risk.undoPerspectiveByDepartment(dept.id, row.assignedKey); // 1) riesgos
      await Department.setPerspective(dept.id, null);                   // 2) mapa
    } catch (e) {
      console.error("Error undoing perspective:", e);
      setError("perspSaveError");
    } finally {
      clearSelection(dept.id);
      await loadData();
      setBusy((b) => without(b, dept.id));
    }
  };

  // Riesgo suelto: un clic en el chip = asignado de inmediato.
  const assignLoose = async (riskId, key) => {
    if (!key || looseBusy[riskId]) return;
    setError("");
    setLooseBusy((b) => ({ ...b, [riskId]: true }));
    try {
      await Risk.setPerspective(riskId, key);
    } catch (e) {
      console.error("Error assigning loose risk:", e);
      setError("perspSaveError");
    } finally {
      await loadData();
      setLooseBusy((b) => without(b, riskId));
    }
  };

  // Píldora de nivel inherente (o "Sin puntaje").
  const renderLevelPill = (risk) => {
    if (isUnscored(risk)) {
      return (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs glass text-muted">
          {t("perspUnscored")}
        </span>
      );
    }
    const levelKey = levelKeyOf(risk, "inherent");
    const classes = getRiskLevelColorClasses()[levelKey] || "glass";
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${classes}`}>
        {labelForLevelKey(levelKey, t)}
      </span>
    );
  };

  // ---------- Fila de departamento ----------
  const renderRow = (row) => {
    const dept = row.department;
    const id = dept.id;
    const state = busy[id];
    const value = chosen(id, row);
    const manual = selection[id] !== undefined;

    return (
      <div key={id} className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
        {/* Izquierda: nombre y estado */}
        <div className="flex items-start gap-3 md:w-64 md:flex-shrink-0 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="font-subtitle break-words">{dept.name}</div>
            {row.status === "pending" && (
              <div className="text-xs text-muted">
                {t("pmigPendingCount", { count: row.unassigned.length })}
              </div>
            )}
            {row.status === "done" && (
              <div className="text-xs text-muted flex flex-wrap items-center gap-1.5 mt-0.5">
                <span>{t("pmigDone", { count: row.assignedCount })}</span>
                <PerspectiveBadge perspectiveKey={row.assignedKey} />
              </div>
            )}
            {row.status === "complete" && (
              <div className="text-xs text-muted inline-flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                {t("pmigComplete")}
              </div>
            )}
          </div>
        </div>

        {/* Centro: chips (solo pendientes) */}
        <div className="flex-1 min-w-0">
          {row.status === "pending" && (
            <div className="space-y-2">
              {!manual && row.suggestion && (
                <div className="text-xs text-accent">{t("pmigSuggested")}</div>
              )}
              {!manual && !row.suggestion && (
                <div className="text-xs text-muted">{t("pmigChoose")}</div>
              )}
              <PerspectivePicker
                variant="chips"
                value={value}
                onChange={(k) => setSelection((s) => ({ ...s, [id]: k }))}
                disabled={!!state}
              />
            </div>
          )}
        </div>

        {/* Derecha: acción */}
        <div className="w-full md:w-auto md:flex-shrink-0 flex flex-col items-stretch md:items-end gap-1">
          {row.status === "pending" && (
            <Button
              onClick={() => handleAssign(row)}
              disabled={!value || !!state}
              className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto"
            >
              {state === "assign" ? (
                <>
                  <Spinner />
                  {t("pmigAssigning")}
                </>
              ) : (
                t("pmigAssign", { count: row.unassigned.length })
              )}
            </Button>
          )}
          {row.status === "done" && (
            <>
              <Button
                variant="outline"
                onClick={() => handleUndo(row)}
                disabled={!!state}
                className="glass hover:border-accent w-full md:w-auto"
              >
                {state === "undo" ? (
                  <>
                    <Spinner />
                    {t("pmigUndoing")}
                  </>
                ) : (
                  <>
                    <Undo2 className="w-4 h-4 mr-2" />
                    {t("pmigUndo")}
                  </>
                )}
              </Button>
              <div className="text-[11px] text-muted md:text-right">
                {t("pmigUndoHint", { count: row.assignedCount })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ---------- Fila de riesgo suelto ----------
  const renderLooseRow = (risk) => (
    <div key={risk.id} className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
      <div className="md:w-72 md:flex-shrink-0 min-w-0 space-y-1.5">
        <p className="text-sm line-clamp-2 break-words">{risk.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          {renderLevelPill(risk)}
          <span className="text-xs text-muted">{t("perspNoDepartment")}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <PerspectivePicker
          variant="chips"
          value={null}
          disabled={!!looseBusy[risk.id]}
          onChange={(k) => assignLoose(risk.id, k)}
        />
      </div>
      <div className="w-full md:w-auto md:flex-shrink-0">
        <Link to={createPageUrl(`AddRisk?id=${risk.id}`)} className="block">
          <Button variant="outline" className="glass hover:border-accent w-full md:w-auto">
            <Edit className="w-4 h-4 mr-2" />
            {t("edit")}
          </Button>
        </Link>
      </div>
    </div>
  );

  // ---------- Encabezado (común a todos los estados con datos) ----------
  const header = (
    <div className="flex items-start gap-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(createPageUrl("Perspectives"))}
        className="glass flex-shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-title">{t("pmigTitle")}</h1>
        <p className="text-muted">{t("pmigSubtitle")}</p>
        <p className="text-xs text-muted mt-1">{t("pmigNothingLost")}</p>
      </div>
    </div>
  );

  // ---------- Estados de pantalla ----------
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="glass rounded-3xl p-8">
          <div className="w-48 h-8 bg-gray-500/20 rounded mb-4"></div>
          <div className="w-64 h-4 bg-gray-500/20 rounded"></div>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="w-full h-2 bg-gray-500/20 rounded-full mb-3"></div>
          <div className="w-40 h-4 bg-gray-500/20 rounded"></div>
        </div>
        <div className="glass rounded-3xl p-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl p-4 h-20"></div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <Alert variant="destructive" className="bg-red-500/20 border-red-400/30 text-red-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col md:flex-row md:items-center gap-3">
            <span className="flex-1">{t("perspLoadError")}</span>
            <Button variant="outline" onClick={retry} className="glass hover:border-accent w-full md:w-auto">
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (progress.total === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="glass rounded-3xl p-8 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p className="text-muted mb-6">{t("noRisksRegistered")}</p>
          <Link to={createPageUrl("AddRisk")}>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto">
              {t("registerFirstRisk")}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Progreso (sticky para listas largas). En móvil baja para no quedar
          bajo el botón ☰ fijo del Layout. El indicador usa var(--accent)
          directo: --accent es hex y bg-accent (hsl(var(--accent))) no pinta. */}
      <Card className="glass rounded-3xl p-6 sticky top-16 lg:top-0 z-10 space-y-3">
        <Progress value={progress.pct} className="h-2 [&>div]:bg-[var(--accent)]" />
        <p className="text-sm text-muted">
          {t("pmigProgress", { assigned: progress.assigned, total: progress.total })}
        </p>
      </Card>

      {/* Todo listo */}
      {progress.unassigned === 0 && (
        <Card className="glass rounded-3xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-subtitle mb-6">{t("pmigAllDone")}</h2>
          <Link to={createPageUrl("Perspectives")}>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto">
              {t("pmigGoPerspectives")}
            </Button>
          </Link>
        </Card>
      )}

      {/* Error al guardar */}
      {error && (
        <Alert variant="destructive" className="bg-red-500/20 border-red-400/30 text-red-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      )}

      {/* Tus departamentos */}
      <Card className="glass rounded-3xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <h2 className="text-xl font-subtitle flex-1">{t("pmigDepartmentsTitle")}</h2>
          {showSearch && (
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder={t("pmigSearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 input-glass"
              />
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-muted text-center py-6">{t("pmigNoDepartments")}</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-muted text-center py-6">{t("noDepartmentsFound")}</p>
        ) : (
          <div className="space-y-3">{visibleRows.map(renderRow)}</div>
        )}
      </Card>

      {/* Riesgos sin departamento (incluye huérfanos) */}
      {loose.length > 0 && (
        <Card className="glass rounded-3xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-subtitle">{t("pmigLooseTitle")}</h2>
            <p className="text-sm text-muted">{t("pmigLooseDesc")}</p>
          </div>
          <div className="space-y-3">{loose.map(renderLooseRow)}</div>
        </Card>
      )}

      {/* Pie */}
      <div className="text-center text-sm text-muted">
        <Link to={createPageUrl("Departments")} className="hover:text-accent underline">
          {t("perspDepartmentsLegacy")}
        </Link>
      </div>
    </div>
  );
}
