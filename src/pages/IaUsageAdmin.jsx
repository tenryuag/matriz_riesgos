import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  CalendarDays,
  Activity,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { iaStatus, IaUsage, fmtUsd, IA_ERROR_MESSAGES } from "@/api/ia";

// ============================================================
// Panel de administración "Uso de IA": estado del asistente (¿hay llave?,
// modelo, topes), gasto acumulado, resumen por usuario y últimas llamadas.
// Solo lee: iaStatus() (Edge Function `ia`, acción `estado`),
// IaUsage.byUser() (RPC ia_usage_by_user, solo admins) e IaUsage.recent(50)
// (tabla ia_usage con RLS: el admin ve todo; los demás, lo suyo).
// ============================================================

// Etiqueta en español de cada acción registrada en ia_usage.
const ACTION_LABELS = {
  interpretar_informe: "Interpretación del informe",
  extraer_estados: "Lectura de PDF",
  sugerir_riesgo: "Sugerencia de riesgo",
  sugerir_iniciativa: "Iniciativa sugerida",
  resumen_ejecutivo: "Resumen ejecutivo",
  estado: "Estado del asistente",
};
const actionLabel = (a) => ACTION_LABELS[a] || a || "—";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtInt = (v) => num(v).toLocaleString("es-MX");
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
};
const fmtSec = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${(n / 1000).toFixed(1)} s`;
};

// Chip de estado (verde / ámbar / rojo / neutro), mismo patrón que el resto
// de la app: rounded-full text-xs font-subtitle border.
const CHIP_TONES = {
  green: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-500",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  red: "border-red-500/40 bg-red-500/10 text-red-500",
  muted: "border-[var(--card-border)] glass text-muted",
};

function Chip({ tone = "muted", icon: Icon, children, className = "", title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border whitespace-nowrap ${CHIP_TONES[tone] || CHIP_TONES.muted} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      {children}
    </span>
  );
}
Chip.propTypes = {
  tone: PropTypes.oneOf(["green", "amber", "red", "muted"]),
  icon: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
  title: PropTypes.string,
};

// Tarjeta de cifra grande (gasto total, llamadas, etc.).
function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="glass">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted text-xs font-subtitle uppercase tracking-wide">
          <Icon className="w-4 h-4 text-accent" />
          {label}
        </div>
        <p className="text-2xl md:text-3xl font-title mt-2 break-words">{value}</p>
        {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  hint: PropTypes.node,
};

// Dato pequeño etiqueta → valor dentro de la tarjeta de estado.
function Dato({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-muted font-subtitle uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{children}</p>
    </div>
  );
}
Dato.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
  </div>
);

const TH = "text-left py-3 px-4 font-subtitle text-muted whitespace-nowrap";
const TH_R = "text-right py-3 px-4 font-subtitle text-muted whitespace-nowrap";
const TR = "border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]";

export default function IaUsageAdmin() {
  const { isAdmin } = useModuleAccess();
  const [status, setStatus] = useState(null); // respuesta de iaStatus()
  const [byUser, setByUser] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageError, setUsageError] = useState(null); // falló ia_usage / RPC
  const [byUserFailed, setByUserFailed] = useState(false); // falló en concreto la RPC por usuario
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setUsageError(null);
    setByUserFailed(false);
    // En paralelo y de forma independiente: si la función `ia` no responde,
    // las tablas igual se muestran (y al revés).
    const [st, bu, rc] = await Promise.allSettled([
      iaStatus(),
      IaUsage.byUser(),
      IaUsage.recent(50),
    ]);

    if (st.status === "fulfilled" && st.value) {
      setStatus(st.value);
    } else {
      if (st.status === "rejected") console.error("Error al consultar el estado de IA:", st.reason);
      setStatus({ ok: false, error: "desconocido", configurado: false });
    }

    setByUser(bu.status === "fulfilled" && Array.isArray(bu.value) ? bu.value : []);
    setByUserFailed(bu.status === "rejected");
    setRecent(rc.status === "fulfilled" && Array.isArray(rc.value) ? rc.value : []);
    if (bu.status === "rejected" || rc.status === "rejected") {
      const err = bu.status === "rejected" ? bu.reason : rc.reason;
      console.error("Error al cargar el uso de IA:", err);
      setUsageError(err?.message || String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Totales calculados del agregado por usuario.
  const totals = useMemo(() => {
    const t = { calls: 0, calls30: 0, cost: 0, cost30: 0, avg: null };
    byUser.forEach((r) => {
      t.calls += num(r.calls);
      t.calls30 += num(r.calls_30d);
      t.cost += num(r.cost_usd);
      t.cost30 += num(r.cost_30d_usd);
    });
    t.avg = t.calls > 0 ? t.cost / t.calls : null;
    return t;
  }, [byUser]);

  // user_id → { email, name } para etiquetar las últimas llamadas.
  const userById = useMemo(() => {
    const m = {};
    byUser.forEach((r) => {
      m[r.user_id] = { email: r.email, name: r.full_name };
    });
    return m;
  }, [byUser]);

  const q = search.trim().toLowerCase();
  const matches = (email, name) =>
    !q ||
    (email && email.toLowerCase().includes(q)) ||
    (name && name.toLowerCase().includes(q));
  const filteredUsers = byUser.filter((r) => matches(r.email, r.full_name));
  const filteredRecent = recent.filter((r) => {
    const u = userById[r.user_id];
    return matches(u?.email, u?.name);
  });

  // Estado del asistente.
  const limites = status?.limites || null;
  const uso = status?.uso || null;
  const global30 = uso ? num(uso.global_30d_usd) : totals.cost30;
  const tope = limites ? num(limites.mensual_usd) : 0;
  const pct = tope > 0 ? Math.min(100, (global30 / tope) * 100) : 0;
  const barTone = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-accent";

  const renderEstado = () => {
    if (!status) return <Spinner />;
    if (status.ok === false) {
      const detalle = IA_ERROR_MESSAGES[status.error] || IA_ERROR_MESSAGES.desconocido;
      return (
        <div className="space-y-3">
          <Chip tone="red" icon={AlertTriangle}>Sin respuesta</Chip>
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            No pudimos consultar el estado del asistente: {detalle} Verifica que la función{" "}
            <code className="font-mono text-xs">ia</code> esté desplegada en Supabase → Edge Functions.
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          {status.configurado ? (
            <Chip tone="green" icon={CheckCircle2}>Configurado</Chip>
          ) : (
            <Chip tone="amber" icon={AlertTriangle}>Sin llave de API</Chip>
          )}
          {status.version && <span className="text-[11px] text-muted">Función ia v{status.version}</span>}
        </div>

        {!status.configurado && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              El asistente no puede responder hasta que exista la llave. Registra el secreto{" "}
              <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> en Supabase → Edge Functions → Secrets.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Modelo">
            <span className="font-mono text-xs">{status.modelo || "—"}</span>
          </Dato>
          <Dato label="Tope diario por usuario">
            {limites ? (
              <>
                {fmtUsd(limites.diario_usd)} · {fmtInt(limites.llamadas_dia)} llamadas
              </>
            ) : (
              "—"
            )}
          </Dato>
          <Dato label="Tope mensual global">{limites ? fmtUsd(limites.mensual_usd) : "—"}</Dato>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2">
            <span className="text-muted">Uso global en los últimos 30 días</span>
            <span className="font-subtitle">
              {fmtUsd(global30)}
              {tope > 0 && (
                <span className="text-muted font-normal">
                  {" "}de {fmtUsd(tope)} ({Math.round(pct)} %)
                </span>
              )}
            </span>
          </div>
          <div className="w-full h-2 glass rounded-full overflow-hidden">
            <div className={`h-full ${barTone} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {uso ? (
            <p className="text-[11px] text-muted mt-2">
              Tus últimas 24 h: {fmtUsd(uso.usuario_24h_usd)} · {fmtInt(uso.usuario_24h_llamadas)} llamadas
              {limites ? ` (tope ${fmtUsd(limites.diario_usd)} · ${fmtInt(limites.llamadas_dia)})` : ""}.
            </p>
          ) : (
            <p className="text-[11px] text-muted mt-2">
              La función no pudo leer el uso acumulado. ¿Ya se ejecutó supabase-ia.sql?
            </p>
          )}
        </div>
      </div>
    );
  };

  const errorBlock = (
    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
      <p className="font-subtitle">No pudimos cargar el uso. ¿Ya se ejecutó supabase-ia.sql?</p>
      {usageError && <p className="text-xs mt-1 opacity-80 break-words">{usageError}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-title">Uso de IA</h1>
            <p className="text-muted">Cuánto ha gastado el asistente y quién lo usa.</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="glass hover:border-accent font-subtitle"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* 1. Estado del asistente */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-subtitle">Estado del asistente</CardTitle>
        </CardHeader>
        <CardContent>{renderEstado()}</CardContent>
      </Card>

      {loading ? (
        <Card className="glass">
          <CardContent>
            <Spinner />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2. Cifras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Wallet}
              label="Gasto total"
              value={fmtUsd(totals.cost)}
              hint={`${fmtInt(totals.calls)} llamadas en total`}
            />
            <StatCard
              icon={CalendarDays}
              label="Gasto 30 días"
              value={fmtUsd(totals.cost30)}
              hint="Suma de las llamadas de los últimos 30 días"
            />
            <StatCard
              icon={Activity}
              label="Llamadas 30 días"
              value={fmtInt(totals.calls30)}
              hint={`${fmtInt(byUser.length)} ${byUser.length === 1 ? "usuario" : "usuarios"} con uso registrado`}
            />
            <StatCard
              icon={Coins}
              label="Costo promedio"
              value={totals.avg == null ? "—" : fmtUsd(totals.avg)}
              hint="Por llamada, sobre el total histórico"
            />
          </div>

          {usageError && errorBlock}

          {/* Buscador */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por correo o nombre…"
              className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
          </div>

          {/* 3. Por usuario */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="font-subtitle">Gasto por usuario</CardTitle>
            </CardHeader>
            <CardContent>
              {byUser.length === 0 ? (
                <p className="text-center text-muted py-10">
                  {byUserFailed && isAdmin
                    ? "No pudimos obtener el resumen por usuario. ¿Ya se ejecutó supabase-ia.sql?"
                    : recent.length > 0
                      ? "El resumen por usuario solo lo ven los administradores."
                      : "Aún no hay llamadas registradas. Cuando alguien use el asistente, aparecerán aquí."}
                </p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-muted py-10">Ningún usuario coincide con la búsqueda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--card-border)]">
                        <th className={TH}>Usuario</th>
                        <th className={TH_R}>Llamadas</th>
                        <th className={TH_R}>Llamadas 30 d</th>
                        <th className={TH_R}>Gasto</th>
                        <th className={TH_R}>Gasto 30 d</th>
                        <th className={TH}>Última vez</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((r) => (
                        <tr key={r.user_id} className={TR}>
                          <td className="py-3 px-4">
                            <div className="font-subtitle">{r.full_name || "—"}</div>
                            <div className="text-xs text-muted">{r.email || r.user_id}</div>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">{fmtInt(r.calls)}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{fmtInt(r.calls_30d)}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-subtitle">{fmtUsd(r.cost_usd)}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{fmtUsd(r.cost_30d_usd)}</td>
                          <td className="py-3 px-4 text-muted whitespace-nowrap">{fmtDate(r.last_call)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Últimas llamadas */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="font-subtitle">
                Últimas llamadas{" "}
                <span className="text-xs text-muted font-normal">(máximo 50)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-center text-muted py-10">Sin llamadas registradas todavía.</p>
              ) : filteredRecent.length === 0 ? (
                <p className="text-center text-muted py-10">Ninguna llamada coincide con la búsqueda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--card-border)]">
                        <th className={TH}>Fecha</th>
                        <th className={TH}>Usuario</th>
                        <th className={TH}>Acción</th>
                        <th className={TH_R}>Tokens entrada / salida</th>
                        <th className={TH_R}>Costo</th>
                        <th className={TH_R}>Duración</th>
                        <th className={TH}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecent.map((r) => {
                        const u = userById[r.user_id];
                        return (
                          <tr key={r.id} className={TR}>
                            <td className="py-2.5 px-3 text-muted whitespace-nowrap">{fmtDate(r.created_at)}</td>
                            <td className="py-2.5 px-3">
                              {u ? (
                                <>
                                  <div className="font-subtitle">{u.name || "—"}</div>
                                  <div className="text-[11px] text-muted hidden xl:block">{u.email}</div>
                                </>
                              ) : (
                                <span className="font-mono text-xs text-muted" title={r.user_id}>
                                  {String(r.user_id || "").slice(0, 8)}…
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div>{actionLabel(r.action)}</div>
                              {r.model && <div className="text-[11px] text-muted font-mono hidden xl:block">{r.model}</div>}
                            </td>
                            <td
                              className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap"
                              title={`Caché: ${fmtInt(r.cache_read_tokens)} leídos · ${fmtInt(r.cache_write_tokens)} escritos`}
                            >
                              {fmtInt(r.input_tokens)} / {fmtInt(r.output_tokens)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtUsd(r.cost_usd)}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtSec(r.duration_ms)}</td>
                            <td className="py-2.5 px-3">
                              {r.ok ? (
                                <Chip tone="green" icon={CheckCircle2}>OK</Chip>
                              ) : (
                                <Chip tone="red" icon={AlertTriangle} title={IA_ERROR_MESSAGES[r.error_code]}>
                                  {r.error_code || "error"}
                                </Chip>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
