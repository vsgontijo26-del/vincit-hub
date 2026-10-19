"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GIcon({ className = "w-5 h-5" }: { className?: string }) {
  // ícone genérico de calendário
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /><path d="M8 14h3v3H8z" fill="currentColor" stroke="none" /></svg>;
}

export default function GoogleSettings() {
  const [st, setSt] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("google_status");
    setSt(data || { connected: false });
  }, []);
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("google") === "ok") setMsg({ t: "Google Agenda conectado. Seus compromissos futuros estão sendo enviados.", ok: true });
    if (q.get("google_erro")) setMsg({ t: q.get("google_erro")! });
    if (q.get("google") === "ok") {
      fetch("/api/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).then(() => load());
    }
    if (q.get("google") || q.get("google_erro")) window.history.replaceState(null, "", window.location.pathname + "#google");
  }, [load]);

  async function pref(k: "push" | "pull", v: boolean) {
    setSt({ ...st, [k]: v });
    await fetch("/api/google/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [k]: v }) });
    if (k === "push" && v) syncAll();
  }
  async function syncAll() {
    setBusy("sync"); setMsg(null);
    const r = await fetch("/api/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).then((x) => x.json()).catch(() => null);
    setBusy(null);
    if (r?.skipped === "not_connected") setMsg({ t: "Conexão com o Google expirou. Conecte de novo." });
    else if (r?.ok) setMsg({ t: `${r.sent ?? 0} compromisso(s) enviados ao Google Agenda.`, ok: true });
    else if (r) setMsg({ t: r.errors?.[0] || r.error || "Não foi possível sincronizar." });
    load();
  }
  async function disconnect() {
    setBusy("off");
    await fetch("/api/google/disconnect", { method: "POST" });
    setBusy(null); setMsg({ t: "Google Agenda desconectado. Os eventos já enviados continuam no seu Google.", ok: true }); load();
  }

  const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) => (
    <label className="flex items-start gap-3 cursor-pointer py-2">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`mt-0.5 w-9 h-5 rounded-full relative shrink-0 transition-colors ${on ? "bg-mint" : "bg-line"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-paper transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className="text-sm">{label}<span className="block text-xs text-fog">{hint}</span></span>
    </label>
  );

  return (
    <section id="google" className="card p-5 scroll-mt-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-panel2 grid place-items-center text-mint shrink-0"><GIcon /></span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold">Google Agenda</p>
          <p className="text-xs text-fog mt-0.5">Sincronize a Agenda do GESTOR com o seu Google Agenda.</p>
        </div>
      </div>

      {!st ? <p className="text-sm text-fog mt-4">Carregando…</p> : st.connected ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-panel2 rounded-xl px-3 py-2.5">
            <p className="text-sm"><span className="inline-block w-2 h-2 rounded-full bg-mint mr-2" />Conectado{st.email ? <> como <b>{st.email}</b></> : ""}</p>
            <p className="text-[11px] text-fog">{st.last_sync_at ? "Último envio " + new Date(st.last_sync_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Ainda sem envio"}</p>
          </div>
          {st.last_error && <p className="text-xs text-danger mt-2">{st.last_error}</p>}
          <div className="mt-2 divide-y divide-line">
            <Toggle on={!!st.push} onChange={(v) => pref("push", v)} label="Enviar compromissos para o Google" hint="Ao criar, editar ou excluir na Agenda, a mudança vai para o seu Google Agenda (inclusive repetições)." />
            <Toggle on={!!st.pull} onChange={(v) => pref("pull", v)} label="Mostrar eventos do Google na Agenda" hint="Seus eventos do Google aparecem no calendário do VINCIT (somente leitura)." />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={syncAll} disabled={!!busy || !st.push} className="btn btn-ghost btn-sm">{busy === "sync" ? "Enviando…" : "Enviar todos agora"}</button>
            <button onClick={disconnect} disabled={!!busy} className="btn btn-ghost btn-sm text-danger">Desconectar</button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <ul className="text-xs text-fog space-y-1 mb-4 list-disc pl-4">
            <li>Compromissos criados no VINCIT vão automaticamente para o Google.</li>
            <li>Eventos do Google aparecem na sua Agenda do VINCIT.</li>
            <li>Você pode desconectar quando quiser.</li>
          </ul>
          <a href="/api/google/connect" className="btn btn-mint w-full">Conectar Google Agenda</a>
        </div>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.ok ? "text-mint" : "text-danger"}`}>{msg.t}</p>}
    </section>
  );
}
