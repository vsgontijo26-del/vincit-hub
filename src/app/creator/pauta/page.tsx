"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import PageHead from "@/components/PageHead";
import Markdown from "@/components/Markdown";
import Link from "next/link";
import { I } from "@/components/icons";
import { useAI } from "@/lib/useAI";
import { FORMATS } from "@/lib/formats";

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
  const [view, setView] = useState<"quadro" | "calendario">("calendario");
  const [gen, setGen] = useState<any>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const ai = useAI();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("perfil")) setFilter(q.get("perfil")!);
    if (q.get("gerar")) setGen({ period: "semana", start: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), formats: ["Reels", "Carrossel", "Stories"], frequency: "", focus: "", strategy: q.get("estrategia") || "", account_id: q.get("perfil") || "" });
  }, []);
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const acc = accounts.find((a) => a.id === (gen.account_id || filter)) || accounts[0];
    const r = await ai.run<any>("content_calendar", { ...gen, account: acc });
    if (!r?.posts?.length) return;
    await createClient().from("content_ideas").insert(r.posts.map((x: any) => ({
      account_id: acc?.id || null, kind: "plano", status: "backlog", title: (x.titulo || "").slice(0, 120), format: x.formato, planned_for: x.data, pillar: x.pilar, card: x.carta, hook: x.gancho,
      body: `**Gancho:** ${x.gancho}\n\n**Tipo:** ${x.tipo} · **Pilar:** ${x.pilar}${x.carta ? ` · **Carta:** ${FORMATS.find((c) => c.id === x.carta)?.name || x.carta}` : ""}\n\n**Estrutura:**\n${x.roteiro}\n\n**CTA:** ${x.cta}`,
    })));
    setGen(null); setView("calendario"); if (r.posts[0]?.data) { const d = new Date(r.posts[0].data + "T12:00"); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }
    load();
  }

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
      <PageHead kicker="CREATOR · 02 CRIAÇÃO" title="Planejador" desc="Calendário de conteúdo da semana ou do mês. Gere com IA a partir do briefing e da estratégia, ou junte o que salvou de tendências, referências e do Laboratório.">
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos os perfis</option>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
      </PageHead>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-panel2 rounded-lg p-0.5">{(["calendario", "quadro"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm rounded-md ${view === v ? "bg-ink text-mint" : "text-fog"}`}>{v === "calendario" ? "Calendário" : "Quadro"}</button>)}</div>
        <button onClick={() => setGen(gen ? null : { period: "semana", start: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), formats: ["Reels", "Carrossel", "Stories"], frequency: "", focus: "", strategy: "", account_id: filter || accounts[0]?.id || "" })} className="btn btn-mint btn-sm ml-auto"><I.spark className="w-4 h-4" />Gerar plano com IA</button>
      </div>
      {gen && (
        <form onSubmit={generate} className="card p-5 mb-5 grid md:grid-cols-4 gap-3 rise border-mint-dim">
          <div><label className="label">Perfil</label><select className="input" value={gen.account_id} onChange={(e) => setGen({ ...gen, account_id: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select></div>
          <div><label className="label">Período</label><div className="flex gap-1">{[["semana", "Semana"], ["mes", "Mês"]].map(([k, l]) => <button type="button" key={k} onClick={() => setGen({ ...gen, period: k })} className={`btn btn-sm flex-1 ${gen.period === k ? "btn-mint" : "btn-ghost"}`}>{l}</button>)}</div></div>
          <div><label className="label">Começa em</label><input type="date" className="input" value={gen.start} onChange={(e) => setGen({ ...gen, start: e.target.value })} /></div>
          <div><label className="label">Frequência</label><input className="input" value={gen.frequency} onChange={(e) => setGen({ ...gen, frequency: e.target.value })} placeholder="Ex.: 4 posts/semana" /></div>
          <div className="md:col-span-2"><label className="label">Formatos</label><div className="flex flex-wrap gap-1">{["Reels", "Carrossel", "Stories", "YouTube", "Foto"].map((x) => { const on = gen.formats.includes(x); return <button type="button" key={x} onClick={() => setGen({ ...gen, formats: on ? gen.formats.filter((y: string) => y !== x) : [...gen.formats, x] })} className={`btn btn-sm ${on ? "btn-mint" : "btn-ghost"}`}>{x}</button>; })}</div></div>
          <div className="md:col-span-2"><label className="label">Foco do período</label><input className="input" value={gen.focus} onChange={(e) => setGen({ ...gen, focus: e.target.value })} placeholder="Ex.: lançamento do pacote mensal, autoridade, crescimento" /></div>
          {gen.strategy && <p className="md:col-span-4 text-xs text-fog bg-panel2 rounded-lg p-2.5">Seguindo a estratégia: {gen.strategy}</p>}
          {ai.error && <p className="md:col-span-4 text-danger text-sm">{ai.error}</p>}
          <div className="md:col-span-4 flex justify-between items-center"><Link href="/creator/estrategia" className="text-xs text-fog hover:text-mint">Ainda sem estratégia? Monte primeiro →</Link><button disabled={ai.busy} className="btn btn-mint">{ai.busy ? "Planejando…" : `Gerar ${gen.period === "mes" ? "mês" : "semana"}`}</button></div>
        </form>
      )}
      {view === "calendario" && (() => {
        const y = cursor.getFullYear(), m = cursor.getMonth(); const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, "0");
        const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d >= 1 && d <= days ? `${y}-${pad(m + 1)}-${pad(d)}` : null; });
        const FC: Record<string, string> = { Reels: "#6eefb6", Carrossel: "#7aa7ff", Stories: "#f5c84c", YouTube: "#ff6b6b", Foto: "#c084fc", Live: "#22d3ee" };
        return (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2"><button onClick={() => setCursor(new Date(y, m - 1, 1))} className="btn btn-ghost btn-sm">‹</button><p className="font-display font-bold capitalize w-44 text-center">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p><button onClick={() => setCursor(new Date(y, m + 1, 1))} className="btn btn-ghost btn-sm">›</button>
              <span className="text-xs text-fog ml-auto">{shown.filter((i) => !i.planned_for).length} ideias sem data no Quadro</span></div>
            <div className="card overflow-hidden"><div className="grid grid-cols-7 border-b border-line">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <p key={d} className="text-[11px] text-fog text-center py-2 uppercase">{d}</p>)}</div>
              <div className="grid grid-cols-7">{cells.map((d, i) => (
                <div key={i} onDragOver={(e) => e.preventDefault()} onDrop={async () => { if (d && drag) { setItems((xs) => xs.map((x) => (x.id === drag ? { ...x, planned_for: d } : x))); await createClient().from("content_ideas").update({ planned_for: d }).eq("id", drag); setDrag(null); } }} className={`min-h-[104px] border-b border-r border-line/60 p-1.5 ${d ? "" : "bg-ink/40"}`}>
                  {d && <><p className="text-[11px] text-fog mb-1">{Number(d.slice(8))}</p><div className="space-y-1">{shown.filter((x) => x.planned_for === d).map((x) => (
                    <button key={x.id} draggable onDragStart={() => setDrag(x.id)} onClick={() => setSel(x)} className={`w-full text-left text-[10px] md:text-[11px] rounded px-1.5 py-1 truncate block ${x.status === "publicado" ? "opacity-50 line-through" : ""}`} style={{ background: (FC[x.format] || "#8a8f94") + "22", color: FC[x.format] || "#c9cdd1" }}>{x.format ? `${x.format} · ` : ""}{x.title}</button>
                  ))}</div></>}
                </div>
              ))}</div></div>
          </div>
        );
      })()}
      {view === "quadro" && <>
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
      </>}

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
            <div className="flex flex-wrap gap-2 mt-4">
              <Link href={`/creator/laboratorio?tab=criar${sel.card ? `&carta=${sel.card}` : ""}${sel.format ? `&format=${encodeURIComponent(sel.format === "YouTube" ? "YouTube" : sel.format)}` : ""}`} className="btn btn-ghost btn-sm"><I.flask className="w-4 h-4" />Desenvolver no Laboratório</Link>
              <Link href="/creator/automacoes?tab=agendar" className="btn btn-ghost btn-sm">Agendar publicação</Link>
            </div>
            <div className="flex justify-between mt-6"><button onClick={del} className="btn btn-ghost"><I.trash className="w-4 h-4" />Excluir</button><button onClick={saveSel} className="btn btn-mint">Salvar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
