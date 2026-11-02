import { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Sparkles, Upload, FileText, Image as ImageIcon, X, AlertTriangle, Info, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FinValue } from "@/api/entities";
import { callIa, fileToBase64, IaError } from "@/api/ia";
import IaDisclaimer from "@/components/ia/IaDisclaimer";
import {
  INCOME_SECTION,
  BALANCE_SECTION,
  INCOME_ROWS,
  INCOME_MEMO,
  INCOME_MEMO_TITLE,
  BALANCE_GROUPS,
  yearLabel,
  fmtMiles,
  toNumber,
} from "@/config/finConfig";
import { computeIncome, computeBalance } from "@/config/finCalc";

// ============================================================
// Importar estados financieros desde PDF / foto con el asistente de IA.
// ------------------------------------------------------------
// Paso 1: el usuario sube el Estado de Resultados y/o el Balance General que
// emite su contador (hasta 4 archivos, 8 MB en total). Paso 2: la acción
// `extraer_estados` devuelve las cifras EN MILES ya mapeadas a nuestras
// cuentas, una entrada por periodo del documento; aquí se muestran junto a
// las cifras ya guardadas y el usuario elige en qué ejercicio guardar cada
// periodo y qué filas tomar (las que no tienen valor actual vienen marcadas;
// las que lo sobrescribirían, no). Paso 3: FinValue.saveRows con lo marcado.
// `section` solo decide qué tabla se muestra primero: se importan ambas.
// ============================================================

const MAX_FILES = 4;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // tope de la API por imagen
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
// Diferencia (en miles) a partir de la cual dos cifras se consideran distintas.
const TOLERANCE = 0.5;

// Filas de cada tabla, en el orden del estado financiero.
const INCOME_TABLE_ROWS = [
  ...INCOME_ROWS.filter((r) => r.type === "input").map((r) => ({ key: r.key, label: r.label, hint: r.hint })),
  ...INCOME_MEMO.map((m) => ({ key: m.key, label: m.label, group: INCOME_MEMO_TITLE })),
];
const BALANCE_TABLE_ROWS = BALANCE_GROUPS.flatMap((g) => g.items.map((i) => ({ key: i.key, label: i.label, group: g.title })));

const SECTIONS = {
  income: { id: "income", key: INCOME_SECTION, title: "Estado de Resultados", field: "estado_resultados", rows: INCOME_TABLE_ROWS },
  balance: { id: "balance", key: BALANCE_SECTION, title: "Balance General", field: "balance", rows: BALANCE_TABLE_ROWS },
};

const UNIT_LABEL = { pesos: "pesos (convertidas a miles)", miles: "miles", millones: "millones (convertidas a miles)", desconocida: "no identificada" };

const fmtSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const round1 = (v) => Math.round(v * 10) / 10;
const fmtAmount = (v) => (v == null ? "—" : fmtMiles.format(round1(v)));
const monthsText = (m) => `${m} ${m === 1 ? "mes" : "meses"}`;

// Ejercicio del usuario que corresponde a un periodo del documento: mismo
// año y, si hay varios (anual + parcial), el de los mismos meses.
function matchYear(years, periodo) {
  if (periodo?.anio == null) return "";
  const same = years.filter((y) => y.year === periodo.anio);
  if (same.length === 0) return "";
  return (same.find((y) => y.months === periodo.meses) || same[0]).id;
}

// Comprobación con las cifras leídas: utilidad neta y totales del balance
// calculados como lo hace la app (periodo ficticio "doc").
function checkFigures(periodo) {
  const fake = [{ id: "doc", year: periodo.anio ?? 0, months: periodo.meses || 12 }];
  const toSection = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, { doc: v }]));
  const sections = { [INCOME_SECTION]: toSection(periodo.estado_resultados), [BALANCE_SECTION]: toSection(periodo.balance) };
  const hasIncome = Object.values(periodo.estado_resultados || {}).some((v) => v != null);
  const hasBalance = Object.values(periodo.balance || {}).some((v) => v != null);
  const inc = computeIncome({ sections, years: fake }).doc;
  const bal = computeBalance({ sections, years: fake }).doc;
  return {
    utilidadNeta: hasIncome ? inc.utilidadNeta : null,
    totalActivo: hasBalance ? bal.totalActivo : null,
    totalPasivoCapital: hasBalance ? bal.totalPasivoCapital : null,
  };
}

const differs = (a, b) => a != null && b != null && Math.abs(a - b) > TOLERANCE;

// Un renglón de la comprobación: lo que dice el documento vs. lo calculado.
function CheckRow({ label, doc, calc }) {
  if (doc == null && calc == null) return null;
  const bad = differs(doc, calc);
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap text-xs">
      <span className="text-muted">{label}</span>
      <span className={`whitespace-nowrap ${bad ? "text-amber-600 dark:text-amber-400" : ""}`}>
        documento {fmtAmount(doc)} · con las cifras leídas {fmtAmount(calc)}
        {bad && " ≠"}
      </span>
    </div>
  );
}

CheckRow.propTypes = {
  label: PropTypes.string.isRequired,
  doc: PropTypes.number,
  calc: PropTypes.number,
};

export default function ImportStatementsDialog({ open, onOpenChange, analysisId, years, section = "income", onImported }) {
  const [step, setStep] = useState("files"); // 'files' | 'result'
  const [files, setFiles] = useState([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null); // IaError
  const [response, setResponse] = useState(null); // { result, usage, cached, generated_at }
  const [current, setCurrent] = useState({}); // { income: { key: { yearId: amount } }, balance: {...} }
  const [targets, setTargets] = useState({}); // { [idx]: yearId | "" }
  const [overrides, setOverrides] = useState({}); // { [idx]: { [sectionId]: { [key]: bool } } }
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // Al abrir: estado limpio y cifras ya guardadas (para la columna "Actual").
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStep("files");
    setFiles([]);
    setReading(false);
    setError(null);
    setResponse(null);
    setTargets({});
    setOverrides({});
    setSaving(false);
    setCurrent({});
    if (analysisId) {
      FinValue.getSections(analysisId, [INCOME_SECTION, BALANCE_SECTION])
        .then((stored) => {
          if (alive) setCurrent(stored || {});
        })
        .catch((err) => console.error("Error al cargar las cifras actuales:", err));
    }
    return () => {
      alive = false;
    };
  }, [open, analysisId]);

  // ---------- paso 1: archivos ----------
  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    if (incoming.length === 0) return;
    setError(null);
    setFiles((prev) => {
      const next = [...prev];
      incoming.forEach((f) => {
        if (!next.some((p) => p.name === f.name && p.size === f.size)) next.push(f);
      });
      return next;
    });
  };
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const { totalBytes, problems } = useMemo(() => {
    const total = files.reduce((s, f) => s + f.size, 0);
    const list = [];
    if (files.length > MAX_FILES) list.push(`Máximo ${MAX_FILES} archivos (elegiste ${files.length}).`);
    if (total > MAX_TOTAL_BYTES) list.push(`Los archivos pesan ${fmtSize(total)}; el límite es 8 MB en total.`);
    files.forEach((f) => {
      if (!ALLOWED_TYPES.has(f.type)) list.push(`"${f.name}": formato no admitido. Usa PDF, JPG, PNG o WebP.`);
      else if (f.type !== "application/pdf" && f.size > MAX_IMAGE_BYTES) list.push(`"${f.name}": cada imagen debe pesar menos de 5 MB.`);
    });
    return { totalBytes: total, problems: list };
  }, [files]);

  const canRead = files.length > 0 && problems.length === 0 && !reading && years.length > 0;

  const handleRead = async () => {
    if (!canRead) return;
    setError(null);
    setReading(true);
    try {
      const archivos = await Promise.all(
        files.map(async (f) => ({ nombre: f.name, tipo: f.type, base64: await fileToBase64(f) }))
      );
      const anios = years.map((y) => ({ id: y.id, year: y.year, months: y.months }));
      const res = await callIa("extraer_estados", { archivos, anios });
      const periodos = res?.result?.periodos || [];
      const t = {};
      periodos.forEach((p, i) => {
        t[i] = matchYear(years, p);
      });
      setTargets(t);
      setOverrides({});
      setResponse(res);
      setStep("result");
    } catch (err) {
      console.error("Error al leer los estados financieros:", err);
      setError(err instanceof IaError ? err : new IaError("desconocido"));
    }
    setReading(false);
  };

  // ---------- paso 2: revisión ----------
  const periodos = response?.result?.periodos || [];
  const result = response?.result;

  const currentValue = (sec, key, yearId) => (yearId ? toNumber(current?.[sec.key]?.[key]?.[yearId]) : null);

  // Marcada por defecto: hay cifra en el documento y no hay valor actual.
  // Si ya hay valor (igual o distinto), "Sobrescribir" empieza apagado.
  const isChecked = (idx, sec, key, yearId, docValue) => {
    if (docValue == null || !yearId) return false;
    const o = overrides[idx]?.[sec.id]?.[key];
    if (typeof o === "boolean") return o;
    return currentValue(sec, key, yearId) == null;
  };

  const toggle = (idx, sec, key, value) =>
    setOverrides((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), [sec.id]: { ...(prev[idx]?.[sec.id] || {}), [key]: !!value } },
    }));

  const setAll = (idx, sec, periodo, value) =>
    setOverrides((prev) => {
      const next = {};
      sec.rows.forEach((r) => {
        if (periodo[sec.field]?.[r.key] != null) next[r.key] = value;
      });
      return { ...prev, [idx]: { ...(prev[idx] || {}), [sec.id]: next } };
    });

  const changeTarget = (idx, yearId) => {
    setTargets((prev) => ({ ...prev, [idx]: yearId }));
    setOverrides((prev) => ({ ...prev, [idx]: {} }));
  };

  // Filas a guardar (las marcadas de los periodos con ejercicio elegido). Si
  // dos periodos apuntan al mismo ejercicio, gana el que aparece después.
  // Se recalcula en cada render: son a lo más 4 periodos × 41 cuentas.
  const collectRows = () => {
    const byKey = new Map();
    const seen = new Set();
    const dup = new Set();
    periodos.forEach((p, idx) => {
      const yearId = targets[idx];
      if (!yearId) return;
      if (seen.has(yearId)) dup.add(yearId);
      seen.add(yearId);
      Object.values(SECTIONS).forEach((sec) => {
        sec.rows.forEach((r) => {
          const v = p[sec.field]?.[r.key];
          if (v == null || !isChecked(idx, sec, r.key, yearId, v)) return;
          byKey.set(`${yearId}|${sec.key}|${r.key}`, { year_id: yearId, section: sec.key, concept_key: r.key, amount: round1(v) });
        });
      });
    });
    return { rowsToSave: Array.from(byKey.values()), duplicatedYears: Array.from(dup) };
  };
  const { rowsToSave, duplicatedYears } = collectRows();

  const handleSave = async () => {
    if (rowsToSave.length === 0 || !analysisId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await FinValue.saveRows(analysisId, rowsToSave);
      onOpenChange(false);
      if (onImported) onImported();
    } catch (err) {
      console.error("Error al guardar las cifras importadas:", err);
      setError(new IaError("desconocido", "No pudimos guardar las cifras. Inténtalo de nuevo."));
    }
    setSaving(false);
  };

  const orderedSections = section === "balance" ? [SECTIONS.balance, SECTIONS.income] : [SECTIONS.income, SECTIONS.balance];
  const yearById = Object.fromEntries(years.map((y) => [y.id, y]));

  const errorBlock = error && (
    <div
      className={`p-3 rounded-xl text-sm border ${
        error.code === "no_configurado"
          ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
          : "bg-red-500/10 border-red-500/20 text-red-500"
      }`}
    >
      {error.message}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !reading && !saving && onOpenChange(o)}>
      <DialogContent className="glass w-[calc(100vw-1rem)] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-title text-xl">
            <Sparkles className="w-5 h-5 text-accent" /> Importar desde PDF
          </DialogTitle>
          <DialogDescription className="text-muted">
            Sube el Estado de Resultados y el Balance General que emite tu contador (PDF o foto). La IA lee
            las cifras y tú las revisas antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {step === "files" && (
          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer?.files);
              }}
              disabled={reading}
              className="w-full rounded-2xl border border-dashed border-[var(--card-border)] hover:border-accent transition-colors p-6 text-center space-y-2 disabled:opacity-60"
            >
              <Upload className="w-6 h-6 mx-auto text-accent" />
              <span className="block text-sm font-subtitle">Elegir archivos</span>
              <span className="block text-xs text-muted">PDF, JPG, PNG o WebP · hasta {MAX_FILES} archivos y 8 MB en total</span>
            </button>

            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 rounded-xl glass px-3 py-2 text-sm">
                    {f.type === "application/pdf" ? (
                      <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-accent flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 truncate">{f.name}</span>
                    <span className="text-xs text-muted whitespace-nowrap">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      disabled={reading}
                      aria-label={`Quitar ${f.name}`}
                      className="text-muted hover:text-foreground disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                <li className="text-[11px] text-muted px-1">
                  {files.length} {files.length === 1 ? "archivo" : "archivos"} · {fmtSize(totalBytes)} de 8 MB
                </li>
              </ul>
            )}

            {problems.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm space-y-1">
                {problems.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            )}

            {errorBlock}

            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <p className="text-[11px] text-muted flex items-start gap-1.5 max-w-sm">
                <Info className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                <span>
                  Las cifras se convierten a miles y se mapean a las cuentas de la app; nada se guarda hasta
                  que confirmes.
                </span>
              </p>
              <Button
                variant="outline"
                className="glass hover:border-accent font-subtitle"
                onClick={handleRead}
                disabled={!canRead}
              >
                {reading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    Leyendo el documento…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Leer con IA
                  </>
                )}
              </Button>
              {reading && <p className="text-[11px] text-muted basis-full text-right">Espera a que termine para cerrar.</p>}
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-5">
            {/* Cabecera: lo detectado y las advertencias */}
            <div className="rounded-2xl glass p-4 space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-subtitle border border-[var(--card-border)]">
                  Unidad del documento: {UNIT_LABEL[result.unidad_detectada] || UNIT_LABEL.desconocida}
                </span>
                {result.moneda_detectada && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-subtitle border border-[var(--card-border)]">
                    Moneda: {result.moneda_detectada}
                  </span>
                )}
                {result.empresa_detectada && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-subtitle border border-[var(--card-border)] truncate max-w-full">
                    Empresa: {result.empresa_detectada}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-subtitle border border-[var(--card-border)]">
                  {periodos.length} {periodos.length === 1 ? "periodo" : "periodos"}
                </span>
              </div>
              {result.advertencias?.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {result.advertencias.map((a, i) => (
                    <li key={`${i}-${a}`} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {periodos.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
                No encontramos cifras de estados financieros en los archivos. Revisa que sean el Estado de
                Resultados o el Balance General y vuelve a intentarlo.
              </div>
            )}

            {periodos.map((p, idx) => {
              const yearId = targets[idx] || "";
              const target = yearById[yearId];
              const check = checkFigures(p);
              return (
                <div key={`${p.etiqueta}-${idx}`} className="rounded-2xl border border-[var(--card-border)] p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-subtitle">{p.etiqueta || (p.anio != null ? String(p.anio) : `Periodo ${idx + 1}`)}</p>
                      <p className="text-xs text-muted">
                        {p.anio != null ? `Cierre ${p.anio}` : "Año no identificado"} · {monthsText(p.meses)}
                      </p>
                    </div>
                    <label className="text-sm flex items-center gap-2 flex-wrap">
                      <span className="text-muted text-xs">Guardar en el ejercicio:</span>
                      <select
                        value={yearId}
                        onChange={(e) => changeTarget(idx, e.target.value)}
                        className="p-2 rounded-xl glass text-foreground outline-none focus:border-accent bg-transparent text-sm"
                      >
                        <option value="">No importar</option>
                        {years.map((y) => (
                          <option key={y.id} value={y.id}>
                            {yearLabel(y)}
                            {y.months < 12 ? ` (parcial, ${monthsText(y.months)})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {target && target.months !== p.meses && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                      <span>
                        El documento cubre {monthsText(p.meses)} y el ejercicio elegido tiene {monthsText(target.months)}.
                        Revisa que sea el periodo correcto.
                      </span>
                    </p>
                  )}

                  {yearId ? (
                    orderedSections.map((sec) => {
                      const rows = sec.rows.filter((r) => p[sec.field]?.[r.key] != null);
                      if (rows.length === 0) {
                        return (
                          <p key={sec.id} className="text-xs text-muted">
                            {sec.title}: el documento no trae cifras de este estado.
                          </p>
                        );
                      }
                      const checkedCount = rows.filter((r) => isChecked(idx, sec, r.key, yearId, p[sec.field][r.key])).length;
                      let lastGroup = null;
                      return (
                        <div key={sec.id} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-xs font-subtitle uppercase tracking-wide text-muted">{sec.title}</p>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="text-muted">
                                {checkedCount} de {rows.length} marcadas
                              </span>
                              <button type="button" className="text-accent hover:underline" onClick={() => setAll(idx, sec, p, true)}>
                                Todas
                              </button>
                              <button type="button" className="text-accent hover:underline" onClick={() => setAll(idx, sec, p, false)}>
                                Ninguna
                              </button>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[520px]">
                              <thead>
                                <tr className="border-b border-[var(--card-border)] text-xs">
                                  <th className="text-left p-1.5 font-subtitle">Cuenta</th>
                                  <th className="text-right p-1.5 font-subtitle whitespace-nowrap">Actual</th>
                                  <th className="text-right p-1.5 font-subtitle whitespace-nowrap">Del documento</th>
                                  <th className="text-center p-1.5 font-subtitle whitespace-nowrap">Sobrescribir</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r) => {
                                  const docValue = p[sec.field][r.key];
                                  const cur = currentValue(sec, r.key, yearId);
                                  const checked = isChecked(idx, sec, r.key, yearId, docValue);
                                  const same = cur != null && !differs(cur, docValue);
                                  const showGroup = r.group && r.group !== lastGroup;
                                  lastGroup = r.group || lastGroup;
                                  return [
                                    showGroup ? (
                                      <tr key={`g-${r.group}`}>
                                        <td colSpan={4} className="pt-2 pb-0.5 px-1.5 text-[10px] uppercase tracking-wide text-muted">
                                          {r.group}
                                        </td>
                                      </tr>
                                    ) : null,
                                    <tr key={r.key} className={`border-b border-[var(--card-border)] ${checked ? "" : "text-muted"}`}>
                                      <td className="p-1.5">
                                        {r.label}
                                        {r.hint && <span className="block text-[10px] text-muted">{r.hint}</span>}
                                      </td>
                                      <td className="p-1.5 text-right whitespace-nowrap">{fmtAmount(cur)}</td>
                                      <td className={`p-1.5 text-right whitespace-nowrap ${docValue < 0 ? "text-red-500" : ""}`}>
                                        {fmtAmount(docValue)}
                                        {same && <span className="block text-[10px] text-muted">sin cambio</span>}
                                      </td>
                                      <td className="p-1.5 text-center">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(v) => toggle(idx, sec, r.key, v)}
                                          aria-label={`${cur == null ? "Guardar" : "Sobrescribir"} ${r.label}`}
                                        />
                                      </td>
                                    </tr>,
                                  ];
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted">
                      Elige un ejercicio para ver y marcar las cifras de este periodo.
                    </p>
                  )}

                  {/* Comprobación */}
                  {(p.comprobacion?.utilidad_neta_documento != null ||
                    p.comprobacion?.total_activo_documento != null ||
                    p.comprobacion?.total_pasivo_capital_documento != null ||
                    check.utilidadNeta != null ||
                    check.totalActivo != null) && (
                    <div className="rounded-xl glass p-3 space-y-1">
                      <p className="text-[11px] font-subtitle uppercase tracking-wide text-muted">Comprobación (miles)</p>
                      <CheckRow label="Utilidad neta" doc={p.comprobacion?.utilidad_neta_documento} calc={check.utilidadNeta} />
                      <CheckRow label="Total activo" doc={p.comprobacion?.total_activo_documento} calc={check.totalActivo} />
                      <CheckRow label="Total pasivo + capital" doc={p.comprobacion?.total_pasivo_capital_documento} calc={check.totalPasivoCapital} />
                      <p className="text-[10px] text-muted pt-1">
                        La utilidad neta y los totales no se importan: la app los calcula con las cuentas que guardes.
                        Si no coinciden, probablemente falta o sobra alguna cuenta.
                      </p>
                    </div>
                  )}

                  {p.notas?.length > 0 && (
                    <ul className="space-y-0.5">
                      {p.notas.map((n, i) => (
                        <li key={`${i}-${n}`} className="text-[11px] text-muted flex items-start gap-1.5">
                          <Info className="w-3 h-3 mt-px flex-shrink-0" />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {duplicatedYears.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                <span>
                  Varios periodos apuntan al mismo ejercicio ({duplicatedYears.map((id) => yearLabel(yearById[id])).join(", ")}):
                  se guardará el que aparece más abajo.
                </span>
              </p>
            )}

            {errorBlock}

            <IaDisclaimer generatedAt={response.generated_at} cached={response.cached} />

            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <Button
                variant="outline"
                className="glass hover:border-accent font-subtitle"
                onClick={() => {
                  setStep("files");
                  setError(null);
                }}
                disabled={saving}
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </Button>
              <Button
                variant="outline"
                className="glass hover:border-accent font-subtitle"
                onClick={handleSave}
                disabled={saving || rowsToSave.length === 0}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    Guardando…
                  </>
                ) : (
                  `Guardar cifras seleccionadas${rowsToSave.length > 0 ? ` (${rowsToSave.length})` : ""}`
                )}
              </Button>
              {saving && <p className="text-[11px] text-muted basis-full text-right">Espera a que termine para cerrar.</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

ImportStatementsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  analysisId: PropTypes.string,
  years: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      year: PropTypes.number.isRequired,
      months: PropTypes.number.isRequired,
    })
  ).isRequired,
  section: PropTypes.oneOf(["income", "balance"]),
  onImported: PropTypes.func,
};
