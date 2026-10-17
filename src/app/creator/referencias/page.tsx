"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import PageHead from "@/components/PageHead";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";

const empty = { title: "", url: "", handle: "", format: "Reels", content: "", tags: "" };

export default function Referencias() {
  const { accounts } = useAccounts();
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const ai = useAI();

  const load = useCallback(async () => {
    const { data } = await createClient().from("references_lib").select("*").order("created_at", { ascending: false });
    setList(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    const analysis = await ai.run("reference", { ...f, account: accounts[0] });
    if (!analysis) return;
    const { data } = await createClient().from("references_lib").insert({
      title: f.title, url: f.url || null, handle: f.handle || null, format: f.format, content: f.content, analysis,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    }).select().single();
    setF(empty); await load(); if (data) setOpen(data.id);
  }
  async function del(id: string) { if (confirm("Excluir referência?")) { await createClient().from("references_lib").delete().eq("id", id); load(); } }
  async function toIdeas(r: any) {
    const a = r.analysis || {};
    await createClient().from("content_ideas").insert((a.adaptacoes || []).map((x: string) => ({ kind: "ideia", title: x.slice(0, 120), body: `Baseado na referência: ${r.title}\n\n${x}\n\n**Modelo de copy:**\n${a.modelo_de_copy || ""}`, format: r.format })));
    alert("Adaptações enviadas para a pauta.");
  }

  const filtered = list.filter((r) => !q || `${r.title} ${r.handle} ${(r.tags || []).join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead kicker="CREATOR" title="Referências" desc="Cole a legenda, transcrição ou descrição de um conteúdo que performou. A IA desmonta o gancho, a estrutura e gera um modelo de copy reutilizável." />

      <form onSubmit={analyze} className="card p-5 grid md:grid-cols-3 gap-4 mb-8">
        <div><label className="label">Título</label><input required className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Reels bastidores com 2M views" /></div>
        <div><label className="label">Perfil (@)</label><input className="input" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} placeholder="@referencia" /></div>
        <div><label className="label">Formato</label><select className="input" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>{["Reels", "Carrossel", "Foto", "Stories", "Anúncio", "YouTube/TikTok"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="md:col-span-2"><label className="label">Link</label><input type="url" className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://instagram.com/reel/…" /></div>
        <div><label className="label">Tags</label><input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="bastidores, humor" /></div>
        <div className="md:col-span-3"><label className="label">Conteúdo: legenda, texto dos slides ou transcrição da fala</label><textarea required className="input min-h-[140px]" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Cole aqui o texto. Quanto mais completo (fala + texto na tela + legenda), melhor a análise." /></div>
        {ai.error && <p className="md:col-span-3 text-danger text-sm">{ai.error}</p>}
        <div className="md:col-span-3 flex justify-end"><button disabled={ai.busy} className="btn btn-mint"><I.spark className="w-4 h-4" />{ai.busy ? "Analisando…" : "Analisar e salvar"}</button></div>
      </form>

      <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-display font-bold text-lg">Biblioteca <span className="text-fog font-normal text-sm">({list.length})</span></h2><input className="input max-w-xs" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="space-y-3">
        {filtered.map((r) => {
          const a = r.analysis || {};
          const isOpen = open === r.id;
          return (
            <div key={r.id} className={`card ${isOpen ? "border-mint-dim" : ""}`}>
              <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full text-left p-4 md:p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-panel2 grid place-items-center font-mono text-mint shrink-0">{a.nota ?? "–"}</div>
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{r.title}</p><p className="text-xs text-fog mt-0.5">{r.format}{r.handle ? ` · ${r.handle}` : ""} · {new Date(r.created_at).toLocaleDateString("pt-BR")}</p></div>
                <div className="hidden md:flex gap-1">{(r.tags || []).slice(0, 3).map((t: string) => <span key={t} className="chip">{t}</span>)}</div>
              </button>
              {isOpen && (
                <div className="px-4 md:px-5 pb-5 grid md:grid-cols-2 gap-5 border-t border-line pt-5">
                  <div className="space-y-4 text-sm">
                    <div><p className="label text-mint">Gancho</p><p>{a.gancho}</p></div>
                    <div><p className="label text-mint">Estrutura</p><ol className="list-decimal ml-5 space-y-1">{(a.estrutura || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>
                    <div><p className="label text-mint">Por que funciona</p><p>{a.por_que_funciona}</p></div>
                    <div className="flex flex-wrap gap-1">{(a.gatilhos || []).map((g: string) => <span key={g} className="chip chip-mint">{g}</span>)}</div>
                    {!!a.sinais_de_tendencia?.length && <div><p className="label text-mint">Sinais de tendência</p><ul className="list-disc ml-5">{a.sinais_de_tendencia.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
                  </div>
                  <div className="space-y-4 text-sm">
                    <div className="bg-panel2 rounded-xl p-4"><div className="flex items-center justify-between mb-2"><p className="label text-mint mb-0">Modelo de copy</p><CopyButton text={a.modelo_de_copy || ""} /></div><p className="whitespace-pre-wrap leading-relaxed">{a.modelo_de_copy}</p></div>
                    <div><p className="label text-mint">Adaptações para você</p><ul className="list-disc ml-5 space-y-1">{(a.adaptacoes || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => toIdeas(r)} className="btn btn-ghost btn-sm">Enviar adaptações à pauta</button>
                      <Link href={`/creator/copy?ref=${r.id}`} className="btn btn-ghost btn-sm">Escrever copy com essa estrutura</Link>
                      {r.url && <a href={r.url} target="_blank" className="btn btn-ghost btn-sm"><I.link className="w-3.5 h-3.5" />Abrir</a>}
                      <button onClick={() => del(r.id)} className="btn btn-ghost btn-sm"><I.trash className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && <p className="text-fog text-sm text-center py-8">Nenhuma referência ainda.</p>}
      </div>
    </>
  );
}
