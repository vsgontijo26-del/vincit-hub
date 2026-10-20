"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { aiFetch } from "@/lib/useAI";
import { useAccounts, fmt } from "@/lib/useAccounts";
import { FORMATS } from "@/lib/formats";
import { I } from "@/components/icons";

const TIPOS: Record<string, string> = { gancho: "Gancho", formato: "Formato", estrutura: "Estrutura", estetica: "Estética", tema: "Tema", serie: "Série / quadro", cta: "CTA", edicao: "Edição", estrategia: "Estratégia" };

export default function RefProfiles() {
  const { accounts } = useAccounts();
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ url: "", account_id: "", paste: "" });
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("ref_profiles").select("*").order("created_at", { ascending: false });
    setList(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!f.account_id && accounts[0]) setF((x) => ({ ...x, account_id: accounts[0].id })); }, [accounts, f.account_id]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const j = await aiFetch("/api/ref-profile", { url: f.url, account_id: f.account_id || undefined, paste: f.paste || undefined }, () => setMsg("Pedido na fila do Claude. Pode sair da página: a análise aparece aqui quando ficar pronta."));
      setMsg(null);
      setF({ ...f, url: "", paste: "" }); setShowPaste(false);
      await load(); openRow(j);
    } catch (e: any) { setErr(e.message); if (/Cole legendas|cole títulos/i.test(e.message)) setShowPaste(true); }
    setBusy(false);
  }
  function openRow(r: any) { setOpen(r); setSel(r.selected || []); setMsg(null); }
  async function saveSel() { await createClient().from("ref_profiles").update({ selected: sel }).eq("id", open.id); setMsg("Seleção salva."); load(); }
  async function toPlanner() {
    const items = (open.analysis?.itens || []).filter((x: any) => sel.includes(x.id));
    if (!items.length) return;
    await createClient().from("content_ideas").insert(items.map((x: any) => ({
      account_id: open.account_id, kind: "ideia", title: `${x.titulo} (ref. ${open.handle})`.slice(0, 120), format: x.tipo === "formato" ? null : null,
      body: `**Inspirado em:** ${open.title} (${open.url})\n\n**O que eles fazem:** ${x.o_que_eles_fazem}\n\n**Como adaptar:** ${x.como_adaptar}\n\n**Ideia pronta:** ${x.exemplo}${x.carta ? `\n\n**Carta:** ${FORMATS.find((c) => c.id === x.carta)?.name || x.carta}` : ""}`,
    })));
    await saveSel(); setMsg(`${items.length} ideia(s) enviadas ao Planejador.`);
  }
  async function del(r: any) { if (!confirm(`Excluir a análise de ${r.handle}?`)) return; await createClient().from("ref_profiles").delete().eq("id", r.id); setOpen(null); load(); }

  const a = open?.analysis || {};
  const items: any[] = a.itens || [];
  const byTipo = items.reduce((m: Record<string, any[]>, x) => ((m[x.tipo] ||= []).push(x), m), {});
  const snapItems: any[] = open?.snapshot?.items || [];

  return (
    <div className="space-y-6">
      <form onSubmit={analyze} className="card p-5">
        <p className="font-display font-bold text-lg">Roube como um artista</p>
        <p className="text-sm text-fog mb-4">Cole o link de um perfil do Instagram ou canal do YouTube. A IA estuda o estilo, os ganchos, formatos e temas que funcionam e devolve uma seleção adaptada ao seu briefing — você escolhe o que aproveitar.</p>
        <div className="grid md:grid-cols-[1fr_200px_auto] gap-3">
          <input required className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="instagram.com/perfil ou youtube.com/@canal" />
          <select className="input" value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}><option value="">Adaptar para…</option>{accounts.map((x) => <option key={x.id} value={x.id}>@{x.username}</option>)}</select>
          <button disabled={busy} className="btn btn-mint"><I.spark className="w-4 h-4" />{busy ? "Analisando… (até 1 min)" : "Analisar perfil"}</button>
        </div>
        <button type="button" onClick={() => setShowPaste(!showPaste)} className="text-xs text-fog hover:text-mint mt-3">{showPaste ? "− Ocultar material extra" : "+ Colar material extra (legendas, roteiros, transcrições)"}</button>
        {showPaste && <textarea className="input min-h-[120px] mt-2" value={f.paste} onChange={(e) => setF({ ...f, paste: e.target.value })} placeholder="Opcional no YouTube. No Instagram, é necessário quando o perfil não é profissional ou sua conta não está conectada à Meta." />}
        {err && <p className="text-danger text-sm mt-3">{err}</p>}
        <p className="text-[11px] text-fog mt-3">Instagram: leitura automática de perfis profissionais usando sua conta conectada à Meta. YouTube: últimos 15 vídeos do canal com visualizações.</p>
      </form>

      {!!list.length && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((r) => (
            <button key={r.id} onClick={() => openRow(r)} className={`card p-4 text-left flex items-center gap-3 hover:border-slate ${open?.id === r.id ? "border-mint-dim" : ""}`}>
              {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full bg-panel2 grid place-items-center text-mint font-bold">{(r.title || r.handle)[0]?.toUpperCase()}</div>}
              <div className="min-w-0 flex-1"><p className="font-semibold truncate">{r.title}</p><p className="text-xs text-fog">{r.platform === "youtube" ? "YouTube" : "Instagram"} · {r.followers ? `${fmt(r.followers)} seg. · ` : ""}{(r.selected || []).length} selecionado(s)</p></div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <section className="card p-5 md:p-6 border-mint-dim rise">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div><p className="font-display font-bold text-2xl">{open.title}</p><a href={open.url} target="_blank" rel="noopener noreferrer" className="text-xs text-fog hover:text-mint">{open.url} ↗</a></div>
            <button onClick={() => del(open)} className="btn btn-ghost btn-sm"><I.trash className="w-4 h-4" /></button>
          </div>
          <p className="leading-relaxed">{a.resumo}</p>

          {a.estilo && <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-5">{Object.entries(a.estilo).map(([k, v]) => <div key={k} className="bg-panel2 rounded-xl p-3"><p className="text-[10px] uppercase tracking-wide text-mint">{k.replace("_", " ")}</p><p className="text-sm mt-1">{String(v)}</p></div>)}</div>}
          {!!a.pilares?.length && <div className="flex flex-wrap gap-1.5 mt-4"><span className="text-xs text-fog mr-1 self-center">Pilares:</span>{a.pilares.map((p: string) => <span key={p} className="chip">{p}</span>)}</div>}

          {!!a.top_conteudos?.length && (
            <div className="mt-5"><p className="label text-mint">Conteúdos que mais performaram</p>
              <ul className="space-y-1.5">{a.top_conteudos.slice(0, 5).map((t: any, i: number) => { const it = snapItems[(t.n || 0) - 1]; return <li key={i} className="text-sm bg-panel2 rounded-lg px-3 py-2"><span className="text-fog">{it?.title?.slice(0, 90) || `Item ${t.n}`}</span>{it?.url && <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-mint ml-2">↗</a>}<p className="mt-0.5">{t.por_que}</p></li>; })}</ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-7 mb-3">
            <p className="font-display font-bold text-lg mr-auto">Escolha o que roubar <span className="text-fog font-normal text-sm">({sel.length}/{items.length})</span></p>
            <button onClick={() => setSel(sel.length === items.length ? [] : items.map((x) => x.id))} className="btn btn-ghost btn-sm">{sel.length === items.length ? "Limpar" : "Selecionar tudo"}</button>
            <button onClick={saveSel} className="btn btn-ghost btn-sm">Salvar seleção</button>
            <button disabled={!sel.length} onClick={toPlanner} className="btn btn-mint btn-sm">Enviar ao Planejador</button>
          </div>
          {msg && <p className="text-sm text-mint mb-3">{msg}</p>}
          <div className="space-y-5">
            {Object.entries(byTipo).map(([tipo, xs]) => (
              <div key={tipo}>
                <p className="text-[11px] uppercase tracking-widest text-fog mb-2">{TIPOS[tipo] || tipo}</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {(xs as any[]).map((x) => {
                    const on = sel.includes(x.id);
                    const card = FORMATS.find((c) => c.id === x.carta);
                    return (
                      <div key={x.id} onClick={() => setSel(on ? sel.filter((y) => y !== x.id) : [...sel, x.id])} className={`rounded-xl border p-4 cursor-pointer transition-colors ${on ? "border-mint bg-mint/5" : "border-line bg-panel2 hover:border-slate"}`}>
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 w-4 h-4 rounded border grid place-items-center text-[10px] shrink-0 ${on ? "bg-mint border-mint text-ink" : "border-slate"}`}>{on && "✓"}</span>
                          <div className="min-w-0 space-y-1.5 text-sm">
                            <p className="font-semibold">{x.titulo}</p>
                            <p className="text-fog"><b className="text-paper/80 font-medium">Eles:</b> {x.o_que_eles_fazem}</p>
                            <p><b className="text-mint font-medium">Você:</b> {x.como_adaptar}</p>
                            {x.exemplo && <p className="text-xs bg-ink/60 rounded-lg px-2.5 py-1.5">“{x.exemplo}”</p>}
                            {card && <Link onClick={(e) => e.stopPropagation()} href={`/creator/laboratorio?tab=criar&carta=${card.id}`} className="inline-block text-[11px] text-mint hover:underline">Carta {card.n} · {card.name} → criar no Laboratório</Link>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!!a.evitar?.length && <div className="mt-6 bg-danger/5 border border-danger/20 rounded-xl p-4"><p className="label text-danger">Não roube</p><ul className="list-disc ml-5 text-sm space-y-1">{a.evitar.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
        </section>
      )}
    </div>
  );
}
