"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import PageHead from "@/components/PageHead";
import Link from "next/link";
import { I } from "@/components/icons";
import { useAI } from "@/lib/useAI";
import { FORMATS } from "@/lib/formats";
import ContentDrawer from "@/components/creator/ContentDrawer";
import { isLate, useContentStatuses } from "@/lib/content";

export default function Pauta() {
  const { accounts } = useAccounts();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const { statuses } = useContentStatuses();
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
    setGen(null); if (r.posts[0]?.data) { const d = new Date(r.posts[0].data + "T12:00"); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }
    load();
  }

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data }, { data: cl }] = await Promise.all([
      s.from("content_ideas").select("*").is("archived_at", null).order("created_at", { ascending: false }),
      s.from("ag_clients").select("id,name,company").order("name"),
    ]);
    setItems(data || []); setClients(cl || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = items.filter((i) => !filter || i.account_id === filter);

  return (
    <>
      <PageHead kicker="CREATOR · 02 CRIAÇÃO" title="Planejador" desc="Calendário de conteúdo da semana ou do mês. Gere com IA a partir do briefing e da estratégia; cada conteúdo segue pelo Quadro de produção.">
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos os perfis</option>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
      </PageHead>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href={`/creator/producao${filter ? `?perfil=${filter}` : ""}`} className="btn btn-ghost btn-sm"><I.board className="w-4 h-4" />Quadro de produção</Link>
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
          <div className="md:col-span-4 flex justify-between items-center"><Link href="/creator/estrategia" className="text-xs text-fog hover:text-mint">Ainda sem estratégia? Monte primeiro →</Link><button disabled={ai.busy} className="btn btn-mint">{ai.queued ? "Na fila do Claude…" : ai.busy ? "Planejando…" : `Gerar ${gen.period === "mes" ? "mês" : "semana"}`}</button></div>
        </form>
      )}
      {(() => {
        const y = cursor.getFullYear(), m = cursor.getMonth(); const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, "0");
        const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d >= 1 && d <= days ? `${y}-${pad(m + 1)}-${pad(d)}` : null; });
        const FC: Record<string, string> = { Reels: "#6eefb6", Carrossel: "#7aa7ff", Stories: "#f5c84c", YouTube: "#ff6b6b", Foto: "#c084fc", Live: "#22d3ee" };
        return (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2"><button onClick={() => setCursor(new Date(y, m - 1, 1))} className="btn btn-ghost btn-sm">‹</button><p className="font-display font-bold capitalize w-44 text-center">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p><button onClick={() => setCursor(new Date(y, m + 1, 1))} className="btn btn-ghost btn-sm">›</button>
              <span className="text-xs text-fog ml-auto">{shown.filter((i) => !i.planned_for).length} ideias sem data no <Link href="/creator/producao" className="hover:text-mint">Quadro</Link>{shown.some((i) => isLate(i, statuses)) ? <span className="text-danger"> · {shown.filter((i) => isLate(i, statuses)).length} atrasado(s)</span> : null}</span></div>
            <div className="card overflow-hidden"><div className="grid grid-cols-7 border-b border-line">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <p key={d} className="text-[11px] text-fog text-center py-2 uppercase">{d}</p>)}</div>
              <div className="grid grid-cols-7">{cells.map((d, i) => (
                <div key={i} onDragOver={(e) => e.preventDefault()} onDrop={async () => { if (d && drag) { setItems((xs) => xs.map((x) => (x.id === drag ? { ...x, planned_for: d } : x))); await createClient().from("content_ideas").update({ planned_for: d }).eq("id", drag); setDrag(null); } }} className={`min-h-[104px] border-b border-r border-line/60 p-1.5 ${d ? "" : "bg-ink/40"}`}>
                  {d && <><p className="text-[11px] text-fog mb-1">{Number(d.slice(8))}</p><div className="space-y-1">{shown.filter((x) => x.planned_for === d).map((x) => (
                    <button key={x.id} draggable onDragStart={() => setDrag(x.id)} onClick={() => setSel(x)} title={statuses.find((st) => st.id === x.status_id)?.name} className={`w-full text-left text-[10px] md:text-[11px] rounded px-1.5 py-1 truncate flex items-center gap-1 ${x.status === "publicado" ? "opacity-50 line-through" : ""} ${isLate(x, statuses) ? "ring-1 ring-danger/70" : ""}`} style={{ background: (FC[x.format] || "#8a8f94") + "22", color: FC[x.format] || "#c9cdd1" }}><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statuses.find((st) => st.id === x.status_id)?.color || "#8a8f94" }} /><span className="truncate">{x.format ? `${x.format} · ` : ""}{x.title}</span></button>
                  ))}</div></>}
                </div>
              ))}</div></div>
          </div>
        );
      })()}
      {sel && <ContentDrawer item={sel} statuses={statuses} accounts={accounts} clients={clients} pillars={Array.from(new Set(items.map((i) => i.pillar).filter(Boolean))).sort()} assignees={Array.from(new Set(items.map((i) => i.assignee).filter(Boolean))).sort()} onClose={() => setSel(null)} onSaved={load} />}
    </>
  );
}
