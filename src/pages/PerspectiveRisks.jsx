// ============================================================
// Riesgos de UNA perspectiva (equivalente a DepartmentRisks por perspectiva).
// Ruta: /perspectiverisks?key=<financiera|cliente|competitiva|equipo>.
// Clave inválida o ausente → redirige a Perspectivas.
// Datos: Risk.filter({ perspective_key }) + Department.list() (nombre del
// departamento). Orden en cliente con sortRisks ("Sin puntaje" al final).
// ============================================================
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Department, Risk } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, Filter, Search, Edit, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/components/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getRiskLevelColorClasses } from "@/lib/utils";
import { PERSPECTIVE_BY_KEY, isPerspectiveKey } from "@/config/perspectives";
import { LEVEL_KEYS, levelKeyOf, hasResidual, currentLevelKey, labelForLevelKey } from "@/config/riskCalc";
import { inherentScoreOf, isCriticalRisk, sortRisks } from "@/lib/perspectiveView";
import { iconForPerspective } from "@/components/perspectives/perspectiveIcons";

// Niveles del filtro, del más grave al más leve.
const LEVEL_FILTER_KEYS = [...LEVEL_KEYS].reverse();

export default function PerspectiveRisks() {
  const navigate = useNavigate();
  // La query se lee del router (no de window.location) para que cambiar solo
  // ?key= (Atrás/Adelante, enlaces entre perspectivas) vuelva a cargar datos.
  const { search } = useLocation();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [perspectiveKey, setPerspectiveKey] = useState(null);
  const [risks, setRisks] = useState([]);
  const [departmentMap, setDepartmentMap] = useState({});
  const [loading, setLoading] = useState(true);
  // true cuando falló la carga; el texto se resuelve al pintar.
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [threatTypeFilter, setThreatTypeFilter] = useState("all");
  const [sortMode, setSortMode] = useState("scoreDesc");

  const loadData = useCallback(async () => {
    const urlParams = new URLSearchParams(search);
    const key = urlParams.get("key");
    if (!isPerspectiveKey(key)) {
      navigate(createPageUrl("Perspectives"));
      return;
    }
    setPerspectiveKey(key);
    setLoading(true);
    setLoadFailed(false);
    try {
      const [risksList, departmentsList] = await Promise.all([
        Risk.filter({ perspective_key: key }),
        Department.list(),
      ]);
      const map = (departmentsList || []).reduce((acc, d) => {
        acc[d.id] = d.name;
        return acc;
      }, {});
      setRisks(sortRisks(risksList || [], "scoreDesc"));
      setDepartmentMap(map);
    } catch (err) {
      console.error("Error loading perspective risks:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [navigate, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtros + orden, en cliente. El nivel se compara con el nivel VIGENTE
  // (residual si lo capturó, si no inherente), nunca con el texto guardado.
  const filteredRisks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = risks.filter(
      (risk) =>
        (term === "" || (risk.description || "").toLowerCase().includes(term)) &&
        (levelFilter === "all" || currentLevelKey(risk) === levelFilter) &&
        (threatTypeFilter === "all" || risk.threat_type === threatTypeFilter)
    );
    return sortRisks(filtered, sortMode);
  }, [risks, searchTerm, levelFilter, threatTypeFilter, sortMode]);

  const perspective = perspectiveKey ? PERSPECTIVE_BY_KEY[perspectiveKey] : null;
  const levelColors = getRiskLevelColorClasses();

  // Nombre del departamento o "Sin departamento" (nulo o huérfano).
  const departmentName = (risk) => (risk.department_id && departmentMap[risk.department_id]) || null;

  const levelPill = (levelKey) =>
    levelKey && levelKey !== "UNCLASSIFIED" ? (
      <span className={`px-2 py-1 rounded-full text-xs border ${levelColors[levelKey] || "glass"}`}>
        {labelForLevelKey(levelKey, t)}
      </span>
    ) : null;

  const threatPill = (risk) => (
    <span
      className={`px-2 py-1 rounded-full text-xs border ${
        risk.threat_type === "Interna"
          ? "bg-blue-500 text-[#121212] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30"
          : "bg-teal-500 text-[#121212] dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-400/30"
      }`}
    >
      {t(risk.threat_type === "Interna" ? "threatInternal" : "threatExternal")}
    </span>
  );

  const scoreCell = (risk) => {
    const score = inherentScoreOf(risk);
    return score == null ? (
      <span className="text-xs text-muted italic">{t("perspUnscored")}</span>
    ) : (
      <span className="font-subtitle">{score}</span>
    );
  };

  const goEdit = (risk) => navigate(createPageUrl(`AddRisk?id=${risk.id}`));

  if (loading || !perspective) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="glass rounded-3xl p-8">
          <div className="w-48 h-8 bg-gray-500/20 rounded mb-4"></div>
          <div className="w-32 h-4 bg-gray-500/20 rounded"></div>
        </div>
        <div className="glass rounded-3xl p-8 h-40"></div>
      </div>
    );
  }

  const Icon = iconForPerspective(perspective.key);
  const addUrl = createPageUrl(`AddRisk?perspective=${perspective.key}`);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Perspectives"))}
            className="glass flex-shrink-0"
            aria-label={t("perspectives")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${perspective.colorClasses.bg}`}>
                <Icon className={`w-6 h-6 ${perspective.colorClasses.text}`} />
              </div>
              <h1 className="text-3xl font-title">{perspective.label}</h1>
            </div>
            <p className="text-muted">{perspective.help}</p>
          </div>
        </div>
        <Button onClick={() => navigate(addUrl)} className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {t("newRisk")}
        </Button>
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

      {!loadFailed && risks.length === 0 ? (
        /* Vacío: la perspectiva aún no tiene riesgos */
        <Card className="glass">
          <CardContent className="text-center py-12">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${perspective.colorClasses.bg}`}>
              <Icon className={`w-10 h-10 ${perspective.colorClasses.text}`} />
            </div>
            <p className="text-muted mb-6">{t("perspNoRisksIn")}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button onClick={() => navigate(addUrl)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                {t("newRisk")}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(createPageUrl(`AddRisk?perspective=${perspective.key}&example=0`))}
                className="glass hover:border-accent"
              >
                {t("perspTakeExample")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        !loadFailed && (
          <>
            {/* Filtros */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="font-subtitle flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  {t("filtersAndSearch")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
                    <Input
                      placeholder={t("searchRisksPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 input-glass"
                    />
                  </div>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="input-glass">
                      <SelectValue placeholder={t("riskLevelLabel")} />
                    </SelectTrigger>
                    <SelectContent className="glass dark:bg-zinc-900 dark:text-white">
                      <SelectItem value="all">{t("allLevels")}</SelectItem>
                      {LEVEL_FILTER_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {labelForLevelKey(k, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={threatTypeFilter} onValueChange={setThreatTypeFilter}>
                    <SelectTrigger className="input-glass">
                      <SelectValue placeholder={t("threatTypeLabel")} />
                    </SelectTrigger>
                    <SelectContent className="glass dark:bg-zinc-900 dark:text-white">
                      <SelectItem value="all">{t("allThreats")}</SelectItem>
                      <SelectItem value="Interna">{t("threatInternal")}</SelectItem>
                      <SelectItem value="Externa">{t("threatExternal")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortMode} onValueChange={setSortMode}>
                    <SelectTrigger className="input-glass">
                      <SelectValue placeholder={t("perspSortLabel")} />
                    </SelectTrigger>
                    <SelectContent className="glass dark:bg-zinc-900 dark:text-white">
                      <SelectItem value="scoreDesc">{t("perspSortScoreDesc")}</SelectItem>
                      <SelectItem value="scoreAsc">{t("perspSortScoreAsc")}</SelectItem>
                      <SelectItem value="recent">{t("perspSortRecent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="font-subtitle">{t("riskList", { count: filteredRisks.length })}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredRisks.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <h3 className="text-xl font-subtitle mb-2">{t("noRisksFound")}</h3>
                    <p>{t("noRisksMatchFilters")}</p>
                  </div>
                ) : isMobile ? (
                  /* Móvil: tarjetas */
                  <div className="space-y-3">
                    {filteredRisks.map((risk) => {
                      const dept = departmentName(risk);
                      const residualKey = hasResidual(risk) ? levelKeyOf(risk, "residual") : null;
                      return (
                        <div
                          key={risk.id}
                          className={`glass rounded-2xl p-4 flex items-start gap-3 ${isCriticalRisk(risk) ? "bg-red-500/5" : ""}`}
                        >
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-sm line-clamp-2">{risk.description}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {threatPill(risk)}
                              <span className="px-2 py-1 rounded-full text-xs border glass inline-flex items-center gap-1">
                                <span className="text-muted">{t("perspScore")}:</span> {scoreCell(risk)}
                              </span>
                              {levelPill(levelKeyOf(risk, "inherent"))}
                              {levelPill(residualKey)}
                            </div>
                            <p className="text-xs text-muted">{dept || t("perspNoDepartment")}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 text-muted hover:glass flex-shrink-0"
                            onClick={() => goEdit(risk)}
                            aria-label={t("edit")}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Escritorio: tabla */
                  <div className="overflow-x-auto">
                    <Table className="table-glass">
                      <TableHeader>
                        <TableRow className="border-card-border hover:bg-transparent">
                          <TableHead>{t("tableDescription")}</TableHead>
                          <TableHead>{t("tableType")}</TableHead>
                          <TableHead>{t("perspScore")}</TableHead>
                          <TableHead>{t("tableInherentLevel")}</TableHead>
                          <TableHead>{t("tableResidualLevel")}</TableHead>
                          <TableHead>{t("tableDepartment")}</TableHead>
                          <TableHead>{t("tableStrategy")}</TableHead>
                          <TableHead>{t("actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRisks.map((risk) => {
                          const dept = departmentName(risk);
                          return (
                            <TableRow
                              key={risk.id}
                              className={`border-card-border hover:bg-gray-500/5 ${isCriticalRisk(risk) ? "bg-red-500/5" : ""}`}
                            >
                              <TableCell className="max-w-xs truncate text-muted">{risk.description}</TableCell>
                              <TableCell>{threatPill(risk)}</TableCell>
                              <TableCell>{scoreCell(risk)}</TableCell>
                              <TableCell>{levelPill(levelKeyOf(risk, "inherent"))}</TableCell>
                              <TableCell>
                                {hasResidual(risk) ? levelPill(levelKeyOf(risk, "residual")) : <span className="text-muted">—</span>}
                              </TableCell>
                              <TableCell>
                                {dept ? dept : <span className="text-muted">{t("perspNoDepartment")}</span>}
                              </TableCell>
                              <TableCell className="text-muted">
                                {risk.risk_strategy ? t(`strategy${risk.risk_strategy}`) : "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-8 h-8 text-muted hover:glass"
                                  onClick={() => goEdit(risk)}
                                  aria-label={t("edit")}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  );
}
