"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import PageHead from "@/components/PageHead";
import Markdown from "@/components/Markdown";
import { I } from "@/components/icons";

const COLS = [
  { k: "backlog", l: "Ideias" },
  { k: "produzindo", l: "Produzindo" },
  { k: "agendado", l: "Agendado" },
  { k: "publicado", l: "Publicado" },
];

export default function Pauta() {
  const { accounts } = useAccounts();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [nw, setNw] = useState("");
  const [drag, setDrag] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("content_ideas").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function move(id: string, status: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    await createClient().from("content_ideas").update({ status }).eq("id", id);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!nw.trim()) return;
    await createClient().from("content_ideas").insert({ title: nw.trim(), kind: "ideia", account_id: filter || null });
    setNw(""); load();
  }
  async function saveSel() {
    await createClient().from("content_ideas").update({ title: sel.title, body: sel.body, format: sel.format, planned_for: sel.planned_for || null, account_id: sel.account_id || null }).eq("id", sel.id);
    setSel(null); load();
  }
  async function del() { await createClient().from("content_ideas").delete().eq("id", sel.id); setSel(null); load(); }

  const shown = items.filter((i) => !filter || i.account_id === filter);

  return (
    <>
      <PageHead kicker="CREATOR · 04 EXECUÇÃO" title="Planejador" desc="Tudo que você salvou de tendências, referências e copy. Arraste entre as colunas.">
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos os perfis</option>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
      </PageHead>
      <form onSubmit={add} className="flex gap-2 mb-6"><input className="input" value={nw} onChange={(e) => setNw(e.target.value)} placeholder="Nova ideia rápida…" /><button className="btn btn-mint"><I.plus className="w-4 h-4" />Adicionar</button></form>

      <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 overflow-x-auto scroll-thin pb-4">
        {COLS.map((c) => {
          const col = shown.filter((i) => i.status === c.k);
          return (
            <div key={c.k} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, c.k)} className="bg-panel/60 border border-line rounded-2xl p-3 min-h-[300px]">
              <div className="flex items-center justify-between px-1 mb-3"><p className="font-display font-bold text-sm">{c.l}</p><span className="font-mono text-xs text-fog">{col.length}</span></div>
              <div className="space-y-2">
                {col.map((it) => (
                  <div key={it.id} draggable onDragStart={() => setDrag(it.id)} onDragEnd={() => setDrag(null)} onClick={() => setSel(it)}
                    className="bg-panel2 border border-line rounded-xl p-3 cursor-grab hover:border-mint-dim active:cursor-grabbing">
                    <p className="text-sm leading-snug">{it.title}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="chip">{it.kind}</span>
                      {it.format && <span className="chip">{it.format}</span>}
                      {it.planned_for && <span className="chip chip-mint">{new Date(it.planned_for + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                    </div>
                    <div className="flex gap-1 mt-2 lg:hidden">
                      {COLS.filter((x) => x.k !== c.k).map((x) => <button key={x.k} onClick={(e) => { e.stopPropagation(); move(it.id, x.k); }} className="text-[10px] text-fog border border-line rounded px-1.5 py-0.5">→ {x.l}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" onClick={() => setSel(null)}>
          <div className="w-full max-w-xl h-full bg-panel border-l border-line p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5"><span className="chip">{sel.kind}</span><button className="text-fog text-sm hover:text-paper" onClick={() => setSel(null)}>Fechar</button></div>
            <label className="label">Título</label><input className="input mb-4" value={sel.title} onChange={(e) => setSel({ ...sel, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div><label className="label">Formato</label><select className="input" value={sel.format || ""} onChange={(e) => setSel({ ...sel, format: e.target.value })}><option value="">–</option>{["Reels", "YouTube", "Carrossel", "Foto", "Stories", "Live"].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="label">Data</label><input type="date" className="input" value={sel.planned_for || ""} onChange={(e) => setSel({ ...sel, planned_for: e.target.value })} /></div>
              <div><label className="label">Perfil</label><select className="input" value={sel.account_id || ""} onChange={(e) => setSel({ ...sel, account_id: e.target.value })}><option value="">–</option>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select></div>
            </div>
            <label className="label">Conteúdo</label>
            <textarea className="input min-h-[220px] font-mono text-xs" value={sel.body || ""} onChange={(e) => setSel({ ...sel, body: e.target.value })} />
            {sel.body && <div className="mt-4 bg-panel2 rounded-xl p-4"><p className="label">Pré-visualização</p><Markdown text={sel.body} /></div>}
            <div className="flex justify-between mt-6"><button onClick={del} className="btn btn-ghost"><I.trash className="w-4 h-4" />Excluir</button><button onClick={saveSel} className="btn btn-mint">Salvar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
