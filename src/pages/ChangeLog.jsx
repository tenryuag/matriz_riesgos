import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, History, GraduationCap, Plus, Pencil, Trash2 } from "lucide-react";
import { Company } from "@/api/entities";
import { MODULES } from "@/config/modules";
import {
  INCOME_ROWS,
  INCOME_MEMO,
  BALANCE_GROUPS,
  CASHFLOW_INPUTS,
  EXPENSE_CONCEPTS,
  EXPENSE_VIRTUAL,
  SEASON_MONTHS,
  yearLabel,
} from "@/config/finConfig";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/components/LanguageContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";

// Historial de cambios de la empresa: quién cambió qué dato y cuándo. Los
// cambios hechos por un mentor se distinguen, para que el cliente vea qué le
// corrigieron. Lo arma la base (trigger log_change) en cada guardado.

// Los textos salen de las traducciones (LanguageContext): aquí van sus claves.
const TABLE_LABEL_KEY = {
  risks: "changeLogTableRisks",
  departments: "changeLogTableDepartments",
  strategic_plans: "changeLogTableStrategicPlans",
  plan_answers: "changeLogTablePlanAnswers",
  competitors: "changeLogTableCompetitors",
  strategic_initiatives: "changeLogTableInitiatives",
  fin_analyses: "changeLogTableFinAnalyses",
  fin_years: "changeLogTableFinYears",
  fin_lines: "changeLogTableFinLines",
  fin_values: "changeLogTableFinValues",
};

const FIN_SECTION_LABEL_KEY = {
  income: "changeLogFinIncome",
  balance: "changeLogFinBalance",
  cashflow: "changeLogFinCashflow",
  sales: "changeLogFinSales",
  segcost: "changeLogFinSegcost",
  expenses: "changeLogFinExpenses",
  seasonality: "changeLogFinSeasonality",
};

// Nombre legible de cada concepto financiero, por su clave. Viene del catálogo
// del módulo financiero, que solo está en español.
const FIN_CONCEPT_LABEL = Object.fromEntries(
  [
    ...INCOME_ROWS,
    ...INCOME_MEMO,
    ...BALANCE_GROUPS.flatMap((g) => g.items),
    ...CASHFLOW_INPUTS,
    ...EXPENSE_CONCEPTS,
    ...EXPENSE_VIRTUAL,
    ...SEASON_MONTHS,
  ]
    .filter((c) => c?.key && c?.label)
    .map((c) => [c.key, c.label]),
);

const ACTION = {
  insert: { labelKey: "changeLogActionInsert", icon: Plus, cls: "text-emerald-500 bg-emerald-500/15" },
  update: { labelKey: "changeLogActionUpdate", icon: Pencil, cls: "text-accent bg-accent/15" },
  delete: { labelKey: "changeLogActionDelete", icon: Trash2, cls: "text-red-500 bg-red-500/15" },
};

function showValue(v, t, numberFmt) {
  if (v === null || v === undefined || v === "") return t("changeLogValueEmpty");
  if (typeof v === "number") return numberFmt.format(v);
  if (typeof v === "boolean") return t(v ? "changeLogValueYes" : "changeLogValueNo");
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

// A qué registro se refiere el cambio, en palabras.
function describeRow(entry, t) {
  const k = entry.row_key || {};
  const tableKey = TABLE_LABEL_KEY[entry.table_name];
  const table = tableKey ? t(tableKey) : entry.table_name;
  if (entry.table_name === "fin_values") {
    const sectionKey = FIN_SECTION_LABEL_KEY[k.section];
    const section = sectionKey ? t(sectionKey) : k.section;
    const concept =
      FIN_CONCEPT_LABEL[k.concept_key] || (k.section?.startsWith("s") ? t("changeLogSegment") : k.concept_key);
    const period = k.year ? yearLabel({ year: k.year, months: k.months ?? 12 }) : "";
    return [section, concept, period].filter(Boolean).join(" · ");
  }
  if (entry.table_name === "fin_years") {
    return `${table} ${k.year ? yearLabel({ year: k.year, months: k.months ?? 12 }) : ""}`.trim();
  }
  if (entry.table_name === "plan_answers") {
    return [table, k.section, k.question_key].filter(Boolean).join(" · ");
  }
  return k.label ? `${table}: ${k.label}` : table;
}

export default function ChangeLog() {
  const { t, language } = useLanguage();
  // Fechas y cifras en el idioma activo.
  const locale = language === "en" ? "en-US" : "es-MX";
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const { actingCompany, company } = useModuleAccess();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyMentor, setOnlyMentor] = useState(false);
  const [moduleKey, setModuleKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await Company.changes({ limit: 300, onlyMentor }));
    } finally {
      setLoading(false);
    }
  }, [onlyMentor]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = moduleKey ? entries.filter((e) => e.module_key === moduleKey) : entries;
  const moduleName = (key) => {
    const mod = MODULES.find((m) => m.key === key);
    return mod ? t(mod.nameKey) : key;
  };
  const modulesInLog = [...new Set(entries.map((e) => e.module_key))];
  const companyName = actingCompany?.name || company?.name;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6">
      <Link
        to={createPageUrl(actingCompany ? "ModuleLauncher" : "Company")}
        className="inline-flex items-center text-sm text-muted hover:text-accent"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />{" "}
        {t(actingCompany ? "companyBackToModules" : "changeLogBackToCompany")}
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
          <History className="w-7 h-7 text-accent" />
        </div>
        <div className="flex-grow min-w-0">
          <h1 className="font-title text-3xl">{t("changeLogTitle")}</h1>
          <p className="text-sm text-muted">
            {companyName ? `${companyName} · ` : ""}
            {t("changeLogSubtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 glass rounded-xl px-3 py-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={onlyMentor}
            onChange={(e) => setOnlyMentor(e.target.checked)}
            className="accent-[var(--accent-color,#d4af37)]"
          />
          {t("changeLogOnlyMentors")}
        </label>
        {modulesInLog.length > 1 && (
          <select
            aria-label={t("changeLogModule")}
            value={moduleKey}
            onChange={(e) => setModuleKey(e.target.value)}
            className="glass rounded-xl px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="">{t("changeLogAllModules")}</option>
            {modulesInLog.map((k) => (
              <option key={k} value={k}>
                {moduleName(k)}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : shown.length === 0 ? (
            <p className="text-center text-muted py-14 px-6">
              {t(onlyMentor ? "changeLogEmptyMentor" : "changeLogEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--card-border)]">
              {shown.map((e) => {
                const act = ACTION[e.action] || ACTION.update;
                const Icon = act.icon;
                const fields = Object.entries(e.changes || {});
                return (
                  <li key={e.id} className="p-4 sm:px-6 flex gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${act.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-subtitle">{e.actor_name}</span>
                        {e.actor_role === "mentor" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
                            <GraduationCap className="w-3 h-3" /> {t("changeLogMentorBadge")}
                          </span>
                        )}
                        <span className="text-xs text-muted">
                          {dateFmt.format(new Date(e.created_at))} · {moduleName(e.module_key)}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5">
                        <span className="text-muted">{t(act.labelKey)}</span> {describeRow(e, t)}
                      </p>
                      {e.action === "update" && (
                        <ul className="mt-1.5 space-y-1 text-sm">
                          {fields.map(([field, { old: before, new: after }]) => (
                            <li key={field} className="flex flex-wrap items-baseline gap-x-2">
                              {fields.length > 1 || e.table_name !== "fin_values" ? (
                                <span className="text-xs text-muted">{field}:</span>
                              ) : null}
                              <span className="line-through text-muted break-words">
                                {showValue(before, t, numberFmt)}
                              </span>
                              <span className="text-muted">→</span>
                              <span className="font-subtitle break-words">{showValue(after, t, numberFmt)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {e.action !== "update" && e.table_name === "fin_values" && fields.length > 0 && (
                        <p className="text-sm font-subtitle mt-0.5">{showValue(e.changes.amount, t, numberFmt)}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
