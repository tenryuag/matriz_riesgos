import React from "react";
import { CheckCircle2, AlertTriangle, Save, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";

// Barra fija inferior que muestra el estado del autoguardado.
// El botón "Guardar ahora" es opcional: el guardado ocurre solo, pero da
// tranquilidad a quien quiere confirmarlo con un click.
export default function SaveStatusBar({ status, onSaveNow }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-80 z-30 glass-darker border-t border-[var(--card-border)]">
      <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <span className="text-sm flex items-center gap-2">
          {status === "saving" && (
            <>
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-muted">Guardando…</span>
            </>
          )}
          {status === "pending" && (
            <>
              <Cloud className="w-4 h-4 text-muted" />
              <span className="text-muted">Guardando en unos segundos…</span>
            </>
          )}
          {status === "saved" && (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-500">Guardado automáticamente</span>
            </>
          )}
          {status === "error" && (
            <>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-red-500">
                No se pudo guardar. Revisa tu conexión e intenta con el botón.
              </span>
            </>
          )}
          {status === "idle" && (
            <>
              <Cloud className="w-4 h-4 text-muted" />
              <span className="text-muted">Tus cambios se guardan automáticamente</span>
            </>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveNow}
          className="glass hover:border-accent font-subtitle flex-shrink-0"
        >
          <Save className="w-4 h-4 mr-2" /> Guardar ahora
        </Button>
      </div>
    </div>
  );
}
