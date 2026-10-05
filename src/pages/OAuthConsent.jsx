import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ShieldCheck, Plug, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";

// Pantalla de consentimiento OAuth 2.1 (conectores MCP).
// Supabase Auth manda aquí al usuario con ?authorization_id=… cuando un
// cliente MCP (Claude, Cursor, etc.) pide acceso. El usuario ve quién pide
// acceso y aprueba o rechaza; después se le regresa al cliente.
// Si no ha iniciado sesión, se guarda el id y se le lleva al login; Layout
// lo trae de regreso aquí al entrar.

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id");
  const [state, setState] = useState("loading"); // loading | ready | busy | error | missing
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setState("missing");
        return;
      }
      if (!supabase.auth.oauth?.getAuthorizationDetails) {
        setError("Esta versión de la app no incluye el soporte de conectores. Actualiza la aplicación.");
        setState("error");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        // Guardar el id y mandar al login; Layout regresa aquí tras entrar.
        try {
          sessionStorage.setItem("oauth_authorization_id", authorizationId);
        } catch (_) {
          // sin storage: el usuario tendrá que repetir la conexión
        }
        navigate("/", { replace: true });
        return;
      }
      const { data, error: err } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) {
        setError(err.message || "No pudimos obtener los datos de la solicitud.");
        setState("error");
        return;
      }
      // Si el usuario ya había autorizado a este cliente, Supabase devuelve
      // directamente la URL de regreso: no hace falta volver a preguntar.
      if (data && !("authorization_id" in data) && data.redirect_url) {
        window.location.assign(data.redirect_url);
        return;
      }
      setDetails(data);
      setState("ready");
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, navigate]);

  const finish = (data) => {
    const url = data?.redirect_url || data?.redirectUrl;
    if (url) {
      window.location.assign(url);
    } else {
      setState("done");
    }
  };

  const approve = async () => {
    setState("busy");
    const { data, error: err } = await supabase.auth.oauth.approveAuthorization(authorizationId);
    if (err) {
      setError(err.message || "No pudimos aprobar la conexión.");
      setState("error");
      return;
    }
    finish(data);
  };

  const deny = async () => {
    setState("busy");
    const { data, error: err } = await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (err) {
      setError(err.message || "No pudimos rechazar la conexión.");
      setState("error");
      return;
    }
    finish(data);
  };

  const client = details?.client || details;
  const clientName = client?.client_name || client?.name || "Una aplicación";
  const clientUri = client?.client_uri || client?.uri || null;
  const scopes = details?.scope ? String(details.scope).split(" ") : details?.scopes || [];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md glass rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-accent/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Plug className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-title">Conectar con tu cuenta</h1>
            <p className="text-sm text-muted-foreground">Autorización para una aplicación externa</p>
          </div>
        </div>

        {state === "loading" && <p className="text-sm text-muted-foreground">Verificando la solicitud…</p>}

        {state === "missing" && (
          <p className="text-sm text-muted-foreground">
            Falta el identificador de la solicitud. Vuelve a iniciar la conexión desde la aplicación que quieres conectar.
          </p>
        )}

        {state === "error" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {state === "done" && (
          <p className="text-sm text-muted-foreground">Listo. Ya puedes volver a la aplicación que pidió el acceso.</p>
        )}

        {(state === "ready" || state === "busy") && (
          <>
            <div className="p-4 rounded-xl glass space-y-2">
              <p className="text-sm">
                <strong>{clientName}</strong> quiere acceder a la información de tu cuenta en el software de Mara Pérez.
              </p>
              {clientUri && (
                <p className="text-xs text-muted-foreground break-all">{clientUri}</p>
              )}
              {scopes.length > 0 && (
                <p className="text-xs text-muted-foreground">Permisos solicitados: {scopes.join(", ")}</p>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <span>
                Solo podrá consultar tu propia información, únicamente de los módulos a los que tienes acceso, y nunca la
                de otros usuarios. En esta versión no puede modificar nada. Puedes revocar el acceso cuando quieras desde
                la aplicación que conectaste.
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={deny}
                disabled={state === "busy"}
                className="flex-1 glass hover:border-red-500 font-subtitle"
              >
                <X className="w-4 h-4 mr-2" /> Rechazar
              </Button>
              <Button
                onClick={approve}
                disabled={state === "busy"}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle"
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> {state === "busy" ? "Procesando…" : "Permitir"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
