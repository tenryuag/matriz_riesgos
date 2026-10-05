import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FinAnalysis, FinYear, FinLine, FinValue } from "@/api/entities";
import { ArrowLeft, TrendingUp, Info, Plus, Trash2, Pencil, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/useAutosave";
import SaveStatusBar from "@/components/SaveStatusBar";
import {
  SALES_SECTION,
  yearLabel,
  fmtMiles,
  fmtPct,
  toNumber,
  sumValues,
} from "@/config/finConfig";

// Ventas históricas por línea de negocio. Las líneas son dinámicas (agrega
// las que tu empresa tenga); los totales y variaciones se calculan solos.

export default function FinAnalysisSales() {
  const [analysis, setAnalysis] = useState(null);
  const [years, setYears] = useState([]);
  const [lines, setLines] = useState([]);
  const [values, setValues] = useState({}); // { [lineId]: { [yearId]: "monto" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLine, setNewLine] = useState("");
  const [editingLine, setEditingLine] = useState(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await FinAnalysis.getOrCreate();
      const [ys, ls, stored] = await Promise.all([
        FinYear.list(a.id),
        FinLine.list(a.id),
        FinValue.getSections(a.id, [SALES_SECTION]),
      ]);
      const sales = stored[SALES_SECTION] || {};
      const map = {};
      ls.forEach((l) => {
        map[l.id] = {};
        ys.forEach((y) => {
          const v = sales[l.id]?.[y.id];
          map[l.id][y.id] = v == null ? "" : String(v);
        });
      });
      setAnalysis(a);
      setYears(ys);
      setLines(ls);
      setValues(map);
    } catch (err) {
      console.error("Error al cargar las ventas:", err);
      setError("No pudimos cargar la información. Intenta recargar la página.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: saveStatus, flush } = useAutosave({
    data: values,
    enabled: !loading && !!analysis,
    onSave: async () => {
      const rows = [];
      Object.entries(values).forEach(([lineId, byYear]) => {
        Object.entries(byYear).forEach(([yearId, amount]) => {
          rows.push({
            year_id: yearId,
            section: SALES_SECTION,
            concept_key: lineId,
            amount: toNumber(amount),
          });
        });
      });
      await FinValue.saveRows(analysis.id, rows);
    },
  });

  const handleCell = (lineId, yearId, value) => {
    setValues((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [yearId]: value },
    }));
  };

  const handleAddLine = async () => {
    const name = newLine.trim();
    if (!name || !analysis) return;
    try {
      const created = await FinLine.create(analysis.id, name, lines.length);
      if (created) {
        setLines((prev) => [...prev, created]);
        setValues((prev) => ({ ...prev, [created.id]: {} }));
        setNewLine("");
      }
    } catch (err) {
      console.error("Error al crear la línea:", err);
      setError("No pudimos crear la línea de negocio. Intenta de nuevo.");
    }
  };

  const handleRename = async (id) => {
    const name = editingName.trim();
    setEditingLine(null);
    if (!name) return;
    try {
      await FinLine.rename(id, name);
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    } catch (err) {
      console.error("Error al renombrar la línea:", err);
      setError("No pudimos renombrar la línea. Intenta de nuevo.");
    }
  };

  const handleRemoveLine = async (line) => {
    const ok = window.confirm(
      `¿Eliminar la línea "${line.name}"? Se borrarán también sus ventas y costos capturados.`
    );
    if (!ok) return;
    try {
      await FinLine.remove(analysis.id, line.id);
      setLines((prev) => prev.filter((l) => l.id !== line.id));
      setValues((prev) => {
        const next = { ...prev };
        delete next[line.id];
        return next;
      });
    } catch (err) {
      console.error("Error al eliminar la línea:", err);
      setError("No pudimos eliminar la línea. Intenta de nuevo.");
    }
  };

  // Totales por año y crecimiento contra el año anterior.
  const totals = years.map((y) => sumValues(lines.map((l) => values[l.id]?.[y.id])));
  const growth = totals.map((t, i) =>
    i === 0 || !totals[i - 1] ? null : t / totals[i - 1] - 1
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-3xl p-8 animate-pulse h-24" />
        <div className="glass rounded-3xl p-6 animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinAnalysisHome")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Ventas</h1>
            <p className="text-muted">Tus ventas históricas por línea de negocio, en miles.</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <Card className="glass">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Agrega tus <strong>líneas de negocio</strong> (productos o servicios que
            agrupan tus ingresos) y captura las ventas reales de cada año{" "}
            <strong>en miles</strong>. Si tienes muchas, agrúpalas en las más
            relevantes. Los totales y el crecimiento se calculan solos, y estas
            ventas alimentan el Estado de Resultados automáticamente.
          </p>
        </CardContent>
      </Card>

      {years.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted">
              Primero define los años a analizar en Datos generales.
            </p>
            <Link to={createPageUrl("FinAnalysisData")}>
              <Button variant="outline" className="glass hover:border-accent font-subtitle">
                Ir a Datos generales →
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Agregar línea */}
          <div className="flex gap-3">
            <input
              type="text"
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLine()}
              placeholder="Nombre de la línea de negocio, ej. Consultoría"
              className="flex-grow p-3 rounded-xl glass text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
            <Button
              onClick={handleAddLine}
              disabled={!newLine.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle flex-shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" /> Agregar
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted italic p-4 glass rounded-xl">
              Aún no hay líneas de negocio. Agrega la primera arriba — si tu empresa
              no separa por líneas, crea una sola con el nombre de tu negocio.
            </p>
          ) : (
            <Card className="glass">
              <CardContent className="p-4 overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left p-2 font-subtitle">Línea de negocio</th>
                      {years.map((y) => (
                        <th key={y.id} className="text-right p-2 font-subtitle whitespace-nowrap">
                          {yearLabel(y)}
                          {y.months < 12 && (
                            <span className="block text-[10px] font-normal text-muted">parcial</span>
                          )}
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-card-border/50">
                        <td className="p-2 min-w-[160px]">
                          {editingLine === line.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingName}
                                autoFocus
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleRename(line.id)}
                                className="w-full p-1.5 rounded-lg glass text-foreground outline-none focus:border-accent"
                              />
                              <button
                                onClick={() => handleRename(line.id)}
                                className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 dark:text-green-500"
                                title="Guardar nombre"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span>{line.name}</span>
                              <button
                                onClick={() => {
                                  setEditingLine(line.id);
                                  setEditingName(line.name);
                                }}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted hover:text-accent transition-opacity"
                                title="Renombrar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        {years.map((y) => (
                          <td key={y.id} className="p-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={values[line.id]?.[y.id] ?? ""}
                              onChange={(e) => handleCell(line.id, y.id, e.target.value)}
                              placeholder="0"
                              className="w-full min-w-[90px] p-2 rounded-lg glass text-foreground placeholder:text-muted/60 outline-none focus:border-accent text-right"
                            />
                          </td>
                        ))}
                        <td className="p-1.5">
                          <button
                            onClick={() => handleRemoveLine(line)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                            title="Eliminar línea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Totales */}
                    <tr className="font-subtitle">
                      <td className="p-2">Ventas totales</td>
                      {years.map((y, i) => (
                        <td key={y.id} className="p-2 text-right whitespace-nowrap">
                          {fmtMiles.format(totals[i])}
                        </td>
                      ))}
                      <td />
                    </tr>
                    {/* Crecimiento */}
                    <tr className="text-xs text-muted">
                      <td className="p-2">Crecimiento vs año anterior</td>
                      {years.map((y, i) => (
                        <td key={y.id} className="p-2 text-right">
                          {growth[i] == null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                growth[i] >= 0
                                  ? "text-green-600 dark:text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {fmtPct(growth[i])}
                            </span>
                          )}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between gap-3 flex-wrap">
        <Link to={createPageUrl("FinAnalysisData")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> Datos generales
          </Button>
        </Link>
        <Link to={createPageUrl("FinAnalysisCosts")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            Siguiente: Costo de ventas →
          </Button>
        </Link>
      </div>

      <SaveStatusBar status={saveStatus} onSaveNow={flush} />
    </div>
  );
}
