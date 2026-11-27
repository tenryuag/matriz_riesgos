import { supabase, getActingCompany } from "./supabaseClient";
import { handleQueryError } from "./authHelpers";
import { activityHasContent, decisionHasContent, toMinutes } from "@/config/dependencyCalc";

// ============================================================
// Mapa de dependencia (módulo `dependency`): acceso a datos.
// ------------------------------------------------------------
// Tablas dep_measurements (una medición = una semana de una persona),
// dep_activities (bitácora), dep_decisions (decisiones que tomas) y
// dep_diagnoses (resultado del análisis; solo lectura, lo escribe la función
// `ia`). La base decide qué se ve: la empresa propia o, en modo mentor, la
// del cliente (encabezado x-company-id que agrega supabaseClient). Por eso
// aquí no se filtra por empresa ni por usuario.
// ============================================================

const MEASUREMENT_FIELDS = ["title", "person_name", "job_title", "notes", "simultaneous"];

const textOrNull = (v) => {
  const s = (v === null || v === undefined ? "" : String(v)).trim();
  return s === "" ? null : s;
};

export const DepMeasurement = {
  // Mediciones de la empresa en la que se trabaja, de la más antigua a la más nueva.
  async list() {
    const { data, error } = await supabase
      .from("dep_measurements")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) handleQueryError(error);
    return data || [];
  },

  // La empresa la pone la base (la propia o la del cliente en modo mentor).
  async create(fields = {}) {
    const row = {
      title: textOrNull(fields.title),
      person_name: textOrNull(fields.person_name),
      job_title: textOrNull(fields.job_title),
    };
    const { data, error } = await supabase.from("dep_measurements").insert([row]).select();
    if (error) handleQueryError(error);
    return data?.[0] || null;
  },

  async update(id, fields) {
    const row = { updated_at: new Date().toISOString() };
    MEASUREMENT_FIELDS.forEach((k) => {
      if (fields[k] === undefined) return;
      row[k] = k === "simultaneous" ? !!fields[k] : textOrNull(fields[k]);
    });
    const { error } = await supabase.from("dep_measurements").update(row).eq("id", id);
    if (error) handleQueryError(error);
    return true;
  },

  // Borra la medición con su bitácora, sus decisiones y su diagnóstico.
  async remove(id) {
    const { error } = await supabase.from("dep_measurements").delete().eq("id", id);
    if (error) handleQueryError(error);
    return true;
  },
};

// Guarda una lista editable (bitácora o decisiones) mandando solo lo que
// cambió: así el historial de cambios registra ediciones reales y no cada
// autoguardado.
//   rows   filas en pantalla (cada una con su `id`, generado en el navegador)
//   saved  Map(id → fila serializada) de lo que ya está en la base; se
//          actualiza aquí mismo al terminar
// Las filas en blanco no se guardan; una fila guardada que queda en blanco o
// se quita de la pantalla se borra.
async function syncRows(table, measurementId, rows, saved, { toRow, hasContent }) {
  const now = new Date().toISOString();
  const keep = new Map();
  rows.forEach((r) => {
    if (hasContent(r)) keep.set(r.id, toRow(r));
  });
  const dirty = [...keep.entries()].filter(([id, row]) => saved.get(id) !== JSON.stringify(row));
  const gone = [...saved.keys()].filter((id) => !keep.has(id));

  if (dirty.length > 0) {
    const payload = dirty.map(([id, row]) => ({ id, measurement_id: measurementId, ...row, updated_at: now }));
    const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
    if (error) handleQueryError(error);
    dirty.forEach(([id, row]) => saved.set(id, JSON.stringify(row)));
  }
  if (gone.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", gone);
    if (error) handleQueryError(error);
    gone.forEach((id) => saved.delete(id));
  }
  return true;
}

async function listRows(table, measurementId) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("measurement_id", measurementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) handleQueryError(error);
  return data || [];
}

// Fila de bitácora tal como se guarda.
const activityRow = (r) => ({
  activity_date: r.activity_date || null,
  description: textOrNull(r.description),
  purpose: textOrNull(r.purpose),
  minutes: toMinutes(r.minutes),
  position: Number(r.position) || 0,
});

// Fila de «Decisiones que tomas» tal como se guarda.
const decisionRow = (r) => ({
  decision_date: r.decision_date || null,
  requester: textOrNull(r.requester),
  description: textOrNull(r.description),
  intervention: r.intervention || null,
  reason: r.reason || null,
  minutes: toMinutes(r.minutes),
  position: Number(r.position) || 0,
});

// Lo ya guardado, para comparar en el siguiente autoguardado.
const savedMap = (rows, toRow) => new Map(rows.map((r) => [r.id, JSON.stringify(toRow(r))]));

export const DepActivity = {
  list: (measurementId) => listRows("dep_activities", measurementId),
  savedMap: (rows) => savedMap(rows, activityRow),
  sync: (measurementId, rows, saved) =>
    syncRows("dep_activities", measurementId, rows, saved, { toRow: activityRow, hasContent: activityHasContent }),
};

export const DepDecision = {
  list: (measurementId) => listRows("dep_decisions", measurementId),
  savedMap: (rows) => savedMap(rows, decisionRow),
  sync: (measurementId, rows, saved) =>
    syncRows("dep_decisions", measurementId, rows, saved, { toRow: decisionRow, hasContent: decisionHasContent }),
};

export const DepDiagnosis = {
  // Diagnóstico vigente de la medición, o null si aún no se analiza.
  async get(measurementId) {
    const { data, error } = await supabase
      .from("dep_diagnoses")
      .select("*")
      .eq("measurement_id", measurementId)
      .limit(1);
    if (error) handleQueryError(error);
    return data?.[0] || null;
  },
};

// ---------- medición en la que se está trabajando ----------
// Se recuerda por pestaña y por empresa (en modo mentor, la del cliente),
// para que el menú lateral abra la misma medición en las tres pantallas.
const currentKey = () => `dep-measurement:${getActingCompany()?.id || "own"}`;

export function getCurrentMeasurementId() {
  try {
    return sessionStorage.getItem(currentKey());
  } catch {
    return null;
  }
}

export function setCurrentMeasurementId(id) {
  try {
    if (id) sessionStorage.setItem(currentKey(), id);
    else sessionStorage.removeItem(currentKey());
  } catch {
    /* sin sessionStorage se abre la medición más reciente */
  }
}

// Identificador para una fila nueva (la base acepta el que mande la app).
export function newRowId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
  );
}
