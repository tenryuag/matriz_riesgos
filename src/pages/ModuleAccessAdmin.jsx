import React, { useState, useEffect } from "react";
import { User, ModuleAccess } from "@/api/entities";
import { getAssignableModules } from "@/config/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";
import { LayoutGrid, Search, Check, ShieldCheck, Save } from "lucide-react";

// Pantalla de administrador: asigna qué módulos puede ver cada usuario.
// Los administradores tienen acceso a todo automáticamente (no se editan aquí).
export default function ModuleAccessAdmin() {
  const { t } = useLanguage();
  const assignable = getAssignableModules();

  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState({}); // userId -> Set(moduleKeys) editable
  const [saved, setSaved] = useState({}); // userId -> Set(moduleKeys) persistido
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResult, accessRows] = await Promise.all([
        User.list(),
        ModuleAccess.listAll(),
      ]);
      const list = usersResult?.users || [];
      const map = {};
      accessRows.forEach((r) => {
        if (!map[r.user_id]) map[r.user_id] = new Set();
        map[r.user_id].add(r.module_key);
      });
      // Asegura una entrada por usuario.
      list.forEach((u) => {
        if (!map[u.id]) map[u.id] = new Set();
      });
      setUsers(list);
      setSaved(cloneMap(map));
      setDraft(cloneMap(map));
    } catch (error) {
      console.error("Error al cargar accesos:", error);
    }
    setLoading(false);
  };

  const cloneMap = (m) => {
    const out = {};
    Object.keys(m).forEach((k) => (out[k] = new Set(m[k])));
    return out;
  };

  const toggle = (userId, key) => {
    setDraft((prev) => {
      const next = cloneMap(prev);
      if (!next[userId]) next[userId] = new Set();
      if (next[userId].has(key)) next[userId].delete(key);
      else next[userId].add(key);
      return next;
    });
  };

  const isDirty = (userId) => {
    const a = draft[userId] || new Set();
    const b = saved[userId] || new Set();
    if (a.size !== b.size) return true;
    for (const k of a) if (!b.has(k)) return true;
    return false;
  };

  const saveUser = async (userId) => {
    setSavingId(userId);
    try {
      const keys = Array.from(draft[userId] || []);
      await ModuleAccess.setUserModules(userId, keys);
      setSaved((prev) => {
        const next = cloneMap(prev);
        next[userId] = new Set(keys);
        return next;
      });
    } catch (error) {
      console.error("Error al guardar módulos:", error);
      window.alert(t("moduleAccessSaveError"));
    }
    setSavingId(null);
  };

  const isUserAdmin = (u) =>
    (u.role || u.user_metadata?.role || u.raw_user_meta_data?.role) === "admin";

  const q = search.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      !q ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center flex-shrink-0">
          <LayoutGrid className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-title">{t("moduleAccessTitle")}</h1>
          <p className="text-muted">{t("moduleAccessSubtitle")}</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-foreground placeholder:text-muted outline-none focus:border-accent"
        />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-subtitle">{t("moduleAccessMatrix")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-muted">{t("tableUser") || "Usuario"}</th>
                    {assignable.map((m) => (
                      <th key={m.key} className="text-center py-3 px-3 font-subtitle text-muted whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <m.icon className={`w-4 h-4 ${m.accent}`} />
                          <span className="text-xs">{t(m.nameKey)}</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-center py-3 px-4 font-subtitle text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const admin = isUserAdmin(u);
                    const set = draft[u.id] || new Set();
                    return (
                      <tr key={u.id} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                        <td className="py-3 px-4">
                          <div className="font-subtitle">{u.full_name || "—"}</div>
                          <div className="text-xs text-muted">{u.email}</div>
                        </td>

                        {admin ? (
                          <td colSpan={assignable.length} className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-subtitle border border-accent/40 bg-accent/10 text-accent">
                              <ShieldCheck className="w-3.5 h-3.5" /> {t("moduleAccessAllAdmin")}
                            </span>
                          </td>
                        ) : (
                          assignable.map((m) => {
                            const on = set.has(m.key);
                            return (
                              <td key={m.key} className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggle(u.id, m.key)}
                                  className={`w-6 h-6 rounded-md border inline-flex items-center justify-center transition-colors ${
                                    on
                                      ? "bg-accent border-accent text-accent-foreground"
                                      : "glass border-[var(--card-border)] hover:border-accent"
                                  }`}
                                  aria-pressed={on}
                                  title={t(m.nameKey)}
                                >
                                  {on && <Check className="w-4 h-4" />}
                                </button>
                              </td>
                            );
                          })
                        )}

                        <td className="py-3 px-4 text-center">
                          {!admin && (
                            <Button
                              size="sm"
                              onClick={() => saveUser(u.id)}
                              disabled={!isDirty(u.id) || savingId === u.id}
                              className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
                            >
                              {savingId === u.id ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <><Save className="w-4 h-4 mr-1.5" /> {t("save")}</>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center text-muted py-10">{t("moduleAccessNoUsers")}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
