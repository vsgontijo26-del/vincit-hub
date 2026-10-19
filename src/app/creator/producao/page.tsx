"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";
import ContentDrawer from "@/components/creator/ContentDrawer";
import StatusSettings from "@/components/creator/StatusSettings";
import { FORMAT_LIST, MAX_REVISIONS, blockers, isLate, shortDate, useContentStatuses } from "@/lib/content";

export default function Producao() {
  const { accounts } = useAccounts();
  const { statuses, reload: reloadStatuses } = useContentStatuses();
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [f, setF] = useState({ account: "", client: "", assignee: "", pillar: "", format: "", archived: false });
  const [sel, setSel] = useState<any>(null);
  const [nw, setNw] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [warn, setWarn] = useState<{ title: string; list: string[] } | null>(null);
  const [cfg, setCfg] = useState(false);

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data }, { data: cl }] = await Promise.all([
      s.from("content_ideas").select("*").order("planned_for", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      s.from("ag_clients").select("id,name,company").order("name"),
    ]);
    setItems(data || []); setClients(cl || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const q = new URLSearchParams(location.search); if (q.get("perfil")) setF((x) => ({ ...x, account: q.get("perfil")! })); }, []);
  // abre um conteúdo direto pelo link (?c=id), vindo do Planejador ou de Seu dia
  useEffect(() => { const id = new URLSearchParams(location.search).get("c"); if (id && items.length && !sel) { const it = items.find((x) => x.id === id); if (it) setSel(it); } }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = items.filter((i) => (f.archived ? !!i.archived_at : !i.archived_at) && (!f.account || i.account_id === f.account) && (!f.client || i.client_id === f.client) && (!f.assignee || i.assignee === f.assignee) && (!f.pillar || i.pillar === f.pillar) && (!f.format || i.format === f.format));
  const assignees = useMemo(() => Array.from(new Set(items.map((i) => i.assignee).filter(Boolean))).sort(), [items]);
  const pillars = useMemo(() => Array.from(new Set(items.map((i) => i.pillar).filter(Boolean))).sort(), [items]);
  const late = shown.filter((i) => isLate(i, statuses)).length;

  async function move(id: string, statusId: string) {
    const it = items.find((x) => x.id === id); if (!it || it.status_id === statusId) return;
    const b = blockers(it, statuses, statusId);
    if (b.length) { setWarn({ title: it.title, list: b }); return; }
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status_id: statusId } : x)));
    await createClient().from("content_ideas").update({ status_id: statusId }).eq("id", id);
    load();
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!nw.trim()) return;
    await createClient().from("content_ideas").insert({ title: nw.trim(), kind: "ideia", account_id: f.account || accounts[0]?.id || null, client_id: f.client || null, assignee: f.assignee || null, status_id: statuses[0]?.id });
    setNw(""); load();
  }

  return (
    <>
      <PageHead kicker="Creator · 02 Criação" title="Quadro de produção" desc="Todo conteúdo da ideia ao post publicado. Arraste entre os status; o quadro avisa o que falta para avançar.">
        <button onClick={() => setCfg(true)} className="btn btn-ghost btn-sm">Editar status</button>
      </PageHead>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="input !w-auto" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}><option value="">Todos os perfis</option>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
        {clients.length > 0 && <select className="input !w-auto" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}</select>}
        {assignees.length > 0 && <select className="input !w-auto" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}><option value="">Todos os responsáveis</option>{assignees.map((a) => <option key={a}>{a}</option>)}</select>}
        {pillars.length > 0 && <select className="input !w-auto" value={f.pillar} onChange={(e) => setF({ ...f, pillar: e.target.value })}><option value="">Todos os pilares</option>{pillars.map((x) => <option key={x}>{x}</option>)}</select>}
        <select className="input !w-auto" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="">Todos os formatos</option>{FORMAT_LIST.map((x) => <option key={x}>{x}</option>)}</select>
        <button onClick={() => setF({ ...f, archived: !f.archived })} className={`btn btn-sm ${f.archived ? "btn-mint" : "btn-ghost"}`}>Arquivados</button>
        {late > 0 && <span className="text-sm text-danger ml-auto">{late} atrasado{late > 1 ? "s" : ""}</span>}
      </div>

      {!f.archived && <form onSubmit={add} className="flex gap-2 mb-5"><input className="input" value={nw} onChange={(e) => setNw(e.target.value)} placeholder="Nova ideia rápida…" /><button className="btn btn-mint"><I.plus className="w-4 h-4" />Adicionar</button></form>}

      {warn && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm flex items-start justify-between gap-3 rise">
          <p><span className="font-semibold">“{warn.title}” ainda não pode avançar.</span> <span className="text-fog">Falta: {warn.list.join(", ")}.</span></p>
          <button onClick={() => setWarn(null)} className="text-fog hover:text-paper shrink-0">Fechar</button>
        </div>
      )}

      {!statuses.length ? <p className="text-fog">Carregando…</p> : (
        <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-x-auto scroll-thin pb-4">
          {statuses.map((c) => {
            const col = shown.filter((i) => i.status_id === c.id);
            return (
              <div key={c.id} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag, c.id); setDrag(null); }} className="bg-panel/60 border border-line rounded-2xl p-2.5 min-h-[360px]">
                <div className="flex items-center gap-2 px-1 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <p className="font-display font-bold text-sm truncate">{c.name}</p>
                  {c.optional && <span className="text-[10px] text-fog">opcional</span>}
                  <span className="font-mono text-xs text-fog ml-auto">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((it) => {
                    const acc = accounts.find((a) => a.id === it.account_id);
                    const cl = clients.find((x) => x.id === it.client_id);
                    const lt = isLate(it, statuses);
                    const idx = statuses.findIndex((x) => x.id === c.id);
                    const next = statuses[idx + 1];
                    return (
                      <div key={it.id} draggable onDragStart={() => setDrag(it.id)} onDragEnd={() => setDrag(null)} onClick={() => setSel(it)}
                        className={`bg-panel2 border rounded-xl p-3 cursor-grab hover:border-mint-dim active:cursor-grabbing ${lt ? "border-danger/50" : "border-line"}`}>
                        <p className="text-sm leading-snug">{it.title}</p>
                        <p className="text-[11px] text-fog mt-1 truncate">{acc ? `@${acc.username}` : "Sem perfil"}{cl ? ` · ${cl.company || cl.name}` : ""}{it.assignee ? ` · ${it.assignee}` : ""}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {it.format && <span className="chip">{it.format}</span>}
                          {it.pillar && <span className="chip">{it.pillar}</span>}
                          {it.planned_for && <span className="chip" style={lt ? { color: "#ff6b6b" } : undefined}>{lt ? "Atrasado · " : ""}{shortDate(it.planned_for)}</span>}
                          {it.approval === "pendente" && <span className="chip" style={{ color: "#f5c84c" }}>Com o cliente</span>}
                          {it.approval === "ajuste" && <span className="chip" style={{ color: "#ff6b6b" }}>Ajuste</span>}
                          {it.revisions > 0 && <span className="chip" style={it.revisions > MAX_REVISIONS ? { color: "#ff6b6b" } : undefined}>Rev. {it.revisions}/{MAX_REVISIONS}</span>}
                          {it.publish_error && <span className="chip" style={{ color: "#ff6b6b" }}>Falha ao publicar</span>}
                          {/^https?:\/\//i.test(it.post_url || "") && <a href={it.post_url} target="_blank" onClick={(e) => e.stopPropagation()} className="chip chip-mint">Ver post ↗</a>}
                        </div>
                        {next && !f.archived && <button onClick={(e) => { e.stopPropagation(); move(it.id, next.id); }} className="text-[10px] text-fog border border-line rounded px-1.5 py-0.5 mt-2 hover:text-mint">→ {next.name}</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sel && <ContentDrawer item={sel} statuses={statuses} accounts={accounts} clients={clients} pillars={pillars} assignees={assignees} onClose={() => setSel(null)} onSaved={load} />}
      {cfg && <StatusSettings open={cfg} onClose={() => setCfg(false)} statuses={statuses} items={items} onChanged={() => { reloadStatuses(); load(); }} />}
    </>
  );
}
