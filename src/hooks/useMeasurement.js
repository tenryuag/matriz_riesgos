import { useCallback, useEffect, useState } from "react";
import { DepMeasurement, getCurrentMeasurementId, setCurrentMeasurementId } from "@/api/dependency";

// Mediciones del Mapa de dependencia y la que está abierta. La elegida se
// recuerda por pestaña (ver api/dependency.js), así las pantallas del módulo
// abren la misma; si no hay ninguna elegida, se abre la más reciente.
//
//   list         todas las mediciones de la empresa
//   measurement  la abierta (o null si aún no hay ninguna)
//   select(id)   abre otra
//   create(f)    crea una y la abre
//   save(f)      guarda campos de la abierta (y actualiza la lista)
//   remove(id)   borra una medición con todos sus registros
export function useMeasurement() {
  const [list, setList] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await DepMeasurement.list();
      const stored = getCurrentMeasurementId();
      const pick = rows.find((r) => r.id === stored) || rows[rows.length - 1] || null;
      setList(rows);
      setCurrentId(pick?.id || null);
      setCurrentMeasurementId(pick?.id || null);
    } catch (err) {
      console.error("Error al cargar las mediciones:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const select = useCallback((id) => {
    setCurrentMeasurementId(id);
    setCurrentId(id);
  }, []);

  const create = useCallback(
    async (fields) => {
      const row = await DepMeasurement.create(fields);
      if (row) {
        setList((prev) => [...prev, row]);
        select(row.id);
      }
      return row;
    },
    [select],
  );

  const save = useCallback(
    async (fields) => {
      if (!currentId) return;
      setList((prev) => prev.map((m) => (m.id === currentId ? { ...m, ...fields } : m)));
      await DepMeasurement.update(currentId, fields);
    },
    [currentId],
  );

  const remove = useCallback(
    async (id) => {
      await DepMeasurement.remove(id);
      const rest = list.filter((m) => m.id !== id);
      setList(rest);
      if (id === currentId) select(rest[rest.length - 1]?.id || null);
    },
    [list, currentId, select],
  );

  const measurement = list.find((m) => m.id === currentId) || null;
  return { list, measurement, loading, error, select, create, save, remove, reload: load };
}
