// Selector inline de perspectiva para un riesgo crítico que aún no la tiene.
// Guarda directo en la matriz (Risk.setPerspective) sin salir de la pantalla
// de planeación: Mara pidió que asignar la perspectiva no mande al riesgo de
// origen. Avisa al padre con onSaved(key) para que recargue sus insumos.
import { useState } from "react";
import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";
import { Risk } from "@/api/entities";
import PerspectivePicker from "@/components/perspectives/PerspectivePicker";

export default function InlinePerspectivePicker({
  riskId,
  value = null,
  onSaved,
  label = "¿A qué perspectiva corresponde este riesgo?",
  className = "",
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (key) => {
    if (!riskId || saving) return;
    setSaving(true);
    setError("");
    try {
      await Risk.setPerspective(riskId, key);
      // Se espera la recarga de quien nos monta para que los chips no se
      // rehabiliten (sin selección) mientras el riesgo cambia de lugar.
      await onSaved?.(key);
    } catch (err) {
      console.error("Error al asignar perspectiva:", err);
      setError("No se pudo guardar la perspectiva. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs text-muted flex items-center gap-1.5">
        {label}
        {saving && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Loader2 className="w-3 h-3 animate-spin" /> guardando…
          </span>
        )}
      </p>
      <PerspectivePicker value={value} onChange={choose} variant="chips" disabled={saving} showHelp={false} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

InlinePerspectivePicker.propTypes = {
  riskId: PropTypes.string.isRequired,
  value: PropTypes.string,
  onSaved: PropTypes.func,
  label: PropTypes.string,
  className: PropTypes.string,
};
