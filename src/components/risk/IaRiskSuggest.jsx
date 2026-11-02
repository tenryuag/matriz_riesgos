import { useState } from "react";
import PropTypes from "prop-types";
import { Sparkles, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";
import { callIa, IaError } from "@/api/ia";
import IaDisclaimer from "@/components/ia/IaDisclaimer";
import { riskScore, levelKeyFromScore, labelForLevelKey } from "@/config/riskCalc";
import { PERSPECTIVE_BY_KEY } from "@/config/perspectives";
import { getRiskLevelColorClasses } from "@/lib/utils";

// ============================================================
// Asistente de IA al capturar un riesgo (acción `sugerir_riesgo`).
// ------------------------------------------------------------
// Se monta en AddRisk debajo de la descripción. Con la descripción (≥ 10
// caracteres) pide a la Edge Function `ia` una redacción mejorada, la
// evaluación inherente (tipo, perspectiva, probabilidad, impacto, estrategia),
// tres controles y el residual esperado. Cada bloque tiene su botón "Aplicar"
// que manda a `onApply(patch)` un objeto parcial de formData; el padre lo
// mezcla y recalcula niveles y grados de control (AddRisk.applyPatch).
// Los textos que genera la IA vienen en español; la interfaz usa t().
// ============================================================

const MIN_DESCRIPTION = 10;

// Etiquetas i18n de los catálogos (las mismas claves que usa AddRisk).
const CONTROL_TYPE_KEY = {
  "Control Preventivo": "controlPreventive",
  "Control Correctivo": "controlCorrective",
  "Control Detectivo": "controlDetective",
};
const PROCESS_TYPE_KEY = { Manual: "processManual", Automatizado: "processAutomated", Combinado: "processCombined" };
const THREAT_KEY = { Interna: "threatInternal", Externa: "threatExternal" };

const SPINNER = <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />;

export default function IaRiskSuggest({ formData, onApply, disabled = false, departmentName = "" }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // { code, message }
  const [response, setResponse] = useState(null); // { result, usage, cached, generated_at }
  const [applied, setApplied] = useState({}); // { wording, evaluation, controls, residual, control0.. }

  const description = String(formData?.description || "").trim();
  const hasDescription = description.length >= MIN_DESCRIPTION;
  const canAsk = hasDescription && !loading && !disabled;

  const ask = async () => {
    if (!canAsk) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callIa("sugerir_riesgo", {
        descripcion: description,
        ...(formData.perspective_key ? { perspectiva_key: formData.perspective_key } : {}),
        ...(formData.threat_type ? { tipo_amenaza: formData.threat_type } : {}),
        ...(departmentName ? { departamento: departmentName } : {}),
      });
      setResponse(res);
      setApplied({});
    } catch (err) {
      const known = err instanceof IaError;
      setError({ code: known ? err.code : "desconocido", message: known ? err.message : t("iaErrorGeneric") });
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    setResponse(null);
    setApplied({});
    setError(null);
  };

  const r = response?.result || null;
  const controles = Array.isArray(r?.controles) ? r.controles.slice(0, 3) : [];

  // ---------- parches para el formulario ----------
  const wordingPatch = () => ({ description: r.riesgo_redactado });
  const evaluationPatch = () => ({
    threat_type: r.tipo_amenaza,
    perspective_key: r.perspectiva_key,
    inherent_probability: r.probabilidad,
    inherent_impact: r.impacto,
    risk_strategy: r.estrategia,
  });
  // Un control ocupa la medida `n` (1..3): texto, qué mitiga, tipo de control
  // y de proceso. Documentado / evidencia / responsable / frecuencia quedan
  // para el usuario (son hechos de su empresa, no sugerencias).
  const controlPatch = (c, n) => ({
    [`mitigant_${n}`]: c.descripcion,
    [`mitigant_impact_${n}`]: c.mitiga,
    [`control_type_${n}`]: c.tipo_control,
    [`process_type_${n}`]: c.proceso,
  });
  const controlsPatch = () => Object.assign({}, ...controles.map((c, i) => controlPatch(c, i + 1)));
  const residualPatch = () => ({ residual_probability: r.residual_probabilidad, residual_impact: r.residual_impacto });

  const apply = (keys, patch) => {
    onApply(patch);
    setApplied((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, true])) }));
  };
  const applyAll = () =>
    apply(
      ["wording", "evaluation", "controls", "residual", ...controles.map((_, i) => `control${i}`)],
      { ...wordingPatch(), ...evaluationPatch(), ...controlsPatch(), ...residualPatch() }
    );

  // Siguiente medida de mitigación sin texto (1..3) o null si las tres están ocupadas.
  const nextEmptySlot = [1, 2, 3].find((n) => !String(formData?.[`mitigant_${n}`] || "").trim()) || null;

  // ---------- etiquetas ----------
  const levelChip = (prob, imp) => {
    const score = riskScore(prob, imp);
    const key = levelKeyFromScore(score);
    if (!key) return null;
    return (
      <Chip label={t("iaLevel")} className={getRiskLevelColorClasses()[key] || "glass"}>
        {labelForLevelKey(key, t)} · {score}
      </Chip>
    );
  };
  const perspective = r ? PERSPECTIVE_BY_KEY[r.perspectiva_key] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={ask}
          disabled={!canAsk}
          className="glass hover:border-accent font-subtitle"
          title={hasDescription ? undefined : t("iaNeedDescription")}
        >
          {loading ? SPINNER : <Sparkles className="w-4 h-4 text-accent" />}
          {loading ? t("iaThinking") : r ? t("iaSuggestAgain") : t("iaSuggestRisk")}
        </Button>
        <p className="text-xs text-muted">{hasDescription ? t("iaRiskHint") : t("iaNeedDescription")}</p>
      </div>

      {error && (
        <div
          className={`rounded-xl border text-sm p-3 ${
            error.code === "no_configurado"
              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-red-500/10 border-red-500/20 text-red-500"
          }`}
        >
          {error.message}
        </div>
      )}

      {r && (
        <Card className="glass border-accent/30">
          <CardContent className="p-4 sm:p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-subtitle flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  {t("iaSuggestionsTitle")}
                </p>
                <p className="text-xs text-muted mt-0.5">{t("iaRiskHint")}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={dismiss} className="text-muted">
                <X className="w-4 h-4" />
                {t("iaDismiss")}
              </Button>
            </div>

            {/* Redacción sugerida */}
            <Section
              title={t("iaSuggestedWording")}
              action={
                <ApplyButton
                  label={t("iaUseWording")}
                  doneLabel={t("iaApplied")}
                  done={!!applied.wording}
                  onClick={() => apply(["wording"], wordingPatch())}
                />
              }
            >
              <p className="text-sm border-l-2 border-accent pl-3">{r.riesgo_redactado}</p>
            </Section>

            {/* Evaluación sugerida */}
            <Section
              title={t("iaSuggestedEvaluation")}
              action={
                <ApplyButton
                  label={t("iaApplyEvaluation")}
                  doneLabel={t("iaApplied")}
                  done={!!applied.evaluation}
                  onClick={() => apply(["evaluation"], evaluationPatch())}
                />
              }
            >
              <div className="flex flex-wrap gap-2">
                <Chip label={t("iaThreatType")}>{THREAT_KEY[r.tipo_amenaza] ? t(THREAT_KEY[r.tipo_amenaza]) : r.tipo_amenaza}</Chip>
                <Chip label={t("iaPerspective")} className={perspective ? perspective.colorClasses.label : "glass"}>
                  {perspective ? perspective.label : r.perspectiva_key}
                </Chip>
                <Chip label={t("iaProbability")}>{t(r.probabilidad)}</Chip>
                <Chip label={t("iaImpact")}>{t(r.impacto)}</Chip>
                {levelChip(r.probabilidad, r.impacto)}
                <Chip label={t("iaStrategy")}>{t(`strategy${r.estrategia}`)}</Chip>
              </div>
              {r.justificacion && (
                <p className="text-sm text-muted">
                  <span className="font-subtitle">{t("iaJustification")}: </span>
                  {r.justificacion}
                </p>
              )}
            </Section>

            {/* Controles sugeridos */}
            {controles.length > 0 && (
              <Section
                title={t("iaSuggestedControls")}
                action={
                  <ApplyButton
                    label={t("iaApplyControls")}
                    doneLabel={t("iaApplied")}
                    done={!!applied.controls}
                    onClick={() => apply(["controls", ...controles.map((_, i) => `control${i}`)], controlsPatch())}
                  />
                }
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {controles.map((c, i) => (
                    <div key={i} className="glass rounded-xl p-3 flex flex-col gap-2">
                      <span className="text-xs font-subtitle text-accent">{t("iaControlN", { num: i + 1 })}</span>
                      <p className="text-sm flex-1">{c.descripcion}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip>{CONTROL_TYPE_KEY[c.tipo_control] ? t(CONTROL_TYPE_KEY[c.tipo_control]) : c.tipo_control}</Chip>
                        <Chip>{PROCESS_TYPE_KEY[c.proceso] ? t(PROCESS_TYPE_KEY[c.proceso]) : c.proceso}</Chip>
                        <Chip>{t(c.mitiga)}</Chip>
                      </div>
                      {c.responsable_sugerido && (
                        <p className="text-xs text-muted">
                          {t("iaSuggestedOwner")} {c.responsable_sugerido}
                        </p>
                      )}
                      <ApplyButton
                        label={nextEmptySlot ? t("iaUseControlIn", { num: nextEmptySlot }) : t("iaUseControl")}
                        doneLabel={t("iaApplied")}
                        done={!!applied[`control${i}`]}
                        disabled={!nextEmptySlot && !applied[`control${i}`]}
                        onClick={() => nextEmptySlot && apply([`control${i}`], controlPatch(c, nextEmptySlot))}
                      />
                    </div>
                  ))}
                </div>
                {!nextEmptySlot && <p className="text-xs text-muted">{t("iaNoEmptySlot")}</p>}
              </Section>
            )}

            {/* Residual sugerido */}
            <Section
              title={t("iaResidualSuggested")}
              action={
                <ApplyButton
                  label={t("iaApplyResidual")}
                  doneLabel={t("iaApplied")}
                  done={!!applied.residual}
                  onClick={() => apply(["residual"], residualPatch())}
                />
              }
            >
              <p className="text-xs text-muted">{t("iaResidualNote")}</p>
              <div className="flex flex-wrap gap-2">
                <Chip label={t("iaProbability")}>{t(r.residual_probabilidad)}</Chip>
                <Chip label={t("iaImpact")}>{t(r.residual_impacto)}</Chip>
                {levelChip(r.residual_probabilidad, r.residual_impacto)}
              </div>
            </Section>

            {r.nota && (
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-sm">
                <span className="font-subtitle">{t("iaNote")}: </span>
                {r.nota}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--card-border)]">
              <IaDisclaimer
                generatedAt={response.generated_at}
                cached={response.cached}
                text={t("iaDisclaimerShort")}
                className="flex-1 min-w-[12rem]"
              />
              <ApplyButton
                label={t("iaApplyAll")}
                doneLabel={t("iaApplied")}
                done={!!(applied.wording && applied.evaluation && applied.residual && (controles.length === 0 || applied.controls))}
                onClick={applyAll}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

IaRiskSuggest.propTypes = {
  formData: PropTypes.object.isRequired,
  onApply: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  departmentName: PropTypes.string,
};

// ---------- piezas internas ----------
function Section({ title, action, children }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-subtitle">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}
Section.propTypes = {
  title: PropTypes.node.isRequired,
  action: PropTypes.node,
  children: PropTypes.node,
};

function ApplyButton({ label, doneLabel, done = false, disabled = false, onClick }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`glass hover:border-accent font-subtitle ${done ? "border-green-500/40 text-green-600 dark:text-green-400" : ""}`}
    >
      {done && <Check className="w-4 h-4" />}
      {done ? doneLabel : label}
    </Button>
  );
}
ApplyButton.propTypes = {
  label: PropTypes.node.isRequired,
  doneLabel: PropTypes.node.isRequired,
  done: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

function Chip({ label, children, className = "glass" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-xs font-subtitle border px-2.5 py-1 ${className}`}>
      {label && <span className="font-normal opacity-70">{label}:</span>}
      {children}
    </span>
  );
}
Chip.propTypes = {
  label: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};
