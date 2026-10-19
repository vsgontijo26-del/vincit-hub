"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { I } from "@/components/icons";

const empty = { id: "", account_id: "", name: "", trigger_type: "comment", keywords: "", media_id: "", public_reply: "", dm_message: "", dm_link: "", offer: "" };

export default function QuickRules() {
  const { accounts } = useAccounts();
  const [list, setList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const ai = useAI();

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: a }, { data: l }] = await Promise.all([
      s.from("automations").select("*, ig_accounts(username)").order("created_at", { ascending: false }),
      s.from("automation_logs").select("*, automations(name)").order("created_at", { ascending: false }).limit(30),
    ]);
    setList(a || []); setLogs(l || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!form?.account_id) return setPosts([]);
    createClient().from("ig_posts").select("ig_media_id,caption,posted_at,media_type").eq("account_id", form.account_id).order("posted_at", { ascending: false }).limit(30).then(({ data }) => setPosts(data || []));
  }, [form?.account_id]);

  const connected = accounts.filter((a) => a.connected);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const row = {
      account_id: form.account_id, name: form.name, trigger_type: form.trigger_type,
      keywords: form.keywords.split(",").map((k: string) => k.trim()).filter(Boolean),
      media_id: form.trigger_type === "comment" ? form.media_id || null : null,
      public_reply: form.trigger_type === "comment" ? form.public_reply || null : null,
      dm_message: form.dm_message || null, dm_link: form.dm_link || null,
    };
    if (!row.public_reply && !row.dm_message) return setErr("Defina ao menos uma resposta pública ou uma mensagem de direct.");
    const s = createClient();
    const { error } = form.id ? await s.from("automations").update(row).eq("id", form.id) : await s.from("automations").insert(row);
    if (error) return setErr(error.message);
    setForm(null); load();
  }
  async function toggle(a: any) { await createClient().from("automations").update({ active: !a.active }).eq("id", a.id); load(); }
  async function del(a: any) { if (confirm(`Excluir "${a.name}"?`)) { await createClient().from("automations").delete().eq("id", a.id); load(); } }
  async function suggest() {
    const acc = accounts.find((a) => a.id === form.account_id);
    const r = await ai.run<any>("automation_copy", { account: acc, keyword: form.keywords.split(",")[0] || "QUERO", offer: form.offer || form.name, link: form.dm_link });
    if (r) setForm({ ...form, public_reply: r.public_reply || form.public_reply, dm_message: r.dm_message || form.dm_message });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><p className="text-sm text-fog max-w-xl">Regras simples de uma resposta: comentou ou mandou a palavra, recebe a resposta pública e um direct. Para conversas com várias etapas, use Fluxos.</p>
        <button className="btn btn-mint" onClick={() => setForm({ ...empty, account_id: connected[0]?.id || accounts[0]?.id || "" })} disabled={!accounts.length}><I.plus className="w-4 h-4" />Nova automação</button>
      </div>

      {!connected.length && (
        <div className="card px-4 py-3 mb-6 text-sm text-fog">
          As automações só disparam em perfis <span className="text-paper">conectados via Meta</span>. Você já pode montar os fluxos; eles começam a rodar assim que o perfil for conectado e o app da Meta aprovado.
        </div>
      )}

      {form && (
        <form onSubmit={save} className="card p-5 md:p-6 mb-8 border-mint-dim rise">
          <h2 className="font-display font-bold text-lg mb-5">{form.id ? "Editar automação" : "Nova automação"}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Nome</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: E-book de roteiro" /></div>
            <div><label className="label">Perfil</label>
              <select required className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value, media_id: "" })}>
                {accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}{a.connected ? "" : " (manual)"}</option>)}
              </select></div>
            <div><label className="label">Gatilho</label>
              <div className="grid grid-cols-2 gap-2">
                {[["comment", "Comentário no post"], ["dm", "Mensagem no direct"]].map(([v, l]) => (
                  <button type="button" key={v} onClick={() => setForm({ ...form, trigger_type: v })} className={`btn btn-sm py-2.5 ${form.trigger_type === v ? "btn-mint" : "btn-ghost"}`}>{l}</button>
                ))}
              </div></div>
            <div><label className="label">Palavras-chave (separe por vírgula; vazio = qualquer {form.trigger_type === "comment" ? "comentário" : "mensagem"})</label><input className="input" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="QUERO, eu quero, link" /></div>
            {form.trigger_type === "comment" && (
              <div className="md:col-span-2"><label className="label">Post</label>
                <select className="input" value={form.media_id} onChange={(e) => setForm({ ...form, media_id: e.target.value })}>
                  <option value="">Todos os posts</option>
                  {posts.map((p) => <option key={p.ig_media_id} value={p.ig_media_id}>{p.posted_at?.slice(0, 10)} · {p.media_type} · {(p.caption || "").slice(0, 70)}</option>)}
                </select></div>
            )}
            <div className="md:col-span-2 bg-panel2 rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1"><label className="label">O que a pessoa recebe? (para a IA escrever as mensagens)</label><input className="input" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="Ex.: checklist gratuito de roteiro para Reels" /></div>
              <button type="button" onClick={suggest} disabled={ai.busy} className="btn btn-ghost"><I.spark className="w-4 h-4" />{ai.busy ? "Escrevendo…" : "Escrever com IA"}</button>
            </div>
            {ai.error && <p className="md:col-span-2 text-danger text-sm">{ai.error}</p>}
            {form.trigger_type === "comment" && <div className="md:col-span-2"><label className="label">Resposta pública no comentário</label><input className="input" value={form.public_reply} onChange={(e) => setForm({ ...form, public_reply: e.target.value })} placeholder="Te mandei no direct! 📩" /></div>}
            <div className="md:col-span-2"><label className="label">Mensagem do direct</label><textarea className="input" value={form.dm_message} onChange={(e) => setForm({ ...form, dm_message: e.target.value })} placeholder="Oi! Aqui está o material que você pediu…" /></div>
            <div className="md:col-span-2"><label className="label">Link (opcional, vai no fim do direct)</label><input type="url" className="input" value={form.dm_link} onChange={(e) => setForm({ ...form, dm_link: e.target.value })} placeholder="https://" /></div>
          </div>
          {err && <p className="text-danger text-sm mt-4">{err}</p>}
          <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-mint">Salvar</button></div>
        </form>
      )}

      {!list.length && !form ? (
        <div className="card p-10 text-center"><I.bolt className="w-8 h-8 text-mint mx-auto" /><p className="font-display text-xl font-bold mt-3">Nenhuma automação</p><p className="text-fog text-sm mt-1">Exemplo clássico: “Comenta QUERO que eu te mando o link no direct”.</p></div>
      ) : (
        <div className="space-y-3 mb-10">
          {list.map((a) => (
            <div key={a.id} className="card p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
              <button onClick={() => toggle(a)} className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${a.active ? "bg-mint" : "bg-line"}`} aria-label="Ativar">
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-ink transition-all ${a.active ? "left-[22px]" : "left-0.5"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-fog mt-1">@{a.ig_accounts?.username} · {a.trigger_type === "comment" ? (a.media_id ? "comentário em 1 post" : "comentário em qualquer post") : "mensagem no direct"}</p>
                <div className="flex flex-wrap gap-1 mt-2">{a.keywords?.length ? a.keywords.map((k: string) => <span key={k} className="chip chip-mint">{k}</span>) : <span className="chip">qualquer texto</span>}</div>
              </div>
              <div className="text-right shrink-0"><p className="font-mono text-lg">{a.runs_count}</p><p className="text-[11px] text-fog">disparos</p></div>
              <div className="flex gap-2 shrink-0">
                <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...a, keywords: (a.keywords || []).join(", "), media_id: a.media_id || "", public_reply: a.public_reply || "", dm_message: a.dm_message || "", dm_link: a.dm_link || "", offer: "" })}>Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => del(a)}><I.trash className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card p-5">
        <h2 className="font-display font-bold mb-3">Últimos disparos</h2>
        {!logs.length ? <p className="text-fog text-sm">Nenhum disparo ainda.</p> : (
          <ul className="divide-y divide-line text-sm">
            {logs.map((l) => (
              <li key={l.id} className="py-2.5 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${l.status === "ok" ? "bg-mint" : "bg-danger"}`} />
                <span className="text-fog text-xs w-32 shrink-0">{new Date(l.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="truncate flex-1">{l.from_username ? `@${l.from_username}: ` : ""}{l.text}</span>
                <span className="text-xs text-fog hidden md:block truncate max-w-[220px]">{l.automations?.name} · {l.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
