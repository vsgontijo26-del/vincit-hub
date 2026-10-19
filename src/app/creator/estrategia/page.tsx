"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts, fmt } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { briefingProgress } from "@/lib/briefing";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

const LV: Record<string, string> = { alto: "#6eefb6", medio: "#f5c84c", baixo: "#8a8f94" };

export default function Estrategia() {
  const { accounts } = useAccounts();
  const [accId, setAccId] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [cur, setCur] = useState<any>(null);
  const [f, setF] = useState({ goal: "", horizon: 90, resources: "" });
  const [showNew, setShowNew] = useState(false);
  const ai = useAI();
  const acc = accounts.find((a) => a.id === accId);

  useEffect(() => { if (!accId && accounts[0]) setAccId(accounts[0].id); }, [accounts, accId]);
  const load = useCallback(async () => {
    if (!accId) return;
    const { data } = await createClient().from("growth_plans").select("*").eq("account_id", accId).order("created_at", { ascending: false });
    setPlans(data || []); setCur((data || [])[0] || null); setShowNew(!(data || []).length);
  }, [accId]);
  useEffect(() => { load(); }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const r = await ai.run<any>("growth_plan", { account: acc, goal: f.goal, horizon: f.horizon, resources: f.resources });
    if (!r) return;
    const { data } = await createClient().from("growth_plans").insert({ account_id: accId, horizon: f.horizon, goal: f.goal || r.meta?.principal, plan: r }).select().single();
    setShowNew(false); await load(); if (data) setCur(data);
  }
  async function toggle(id: string) {
    const done = cur.done.includes(id) ? cur.done.filter((x: string) => x !== id) : [...cur.done, id];
    setCur({ ...cur, done });
    await createClient().from("growth_plans").update({ done }).eq("id", cur.id);
  }
  async function del() { if (!confirm("Excluir esta estratégia?")) return; await createClient().from("growth_plans").delete().eq("id", cur.id); load(); }

  const p = cur?.plan || {};
  const allActions: any[] = (p.fases || []).flatMap((x: any) => x.acoes || []);
  const pct = allActions.length ? Math.round((cur.done.filter((d: string) => allActions.some((a) => a.id === d)).length / allActions.length) * 100) : 0;
  const strategyText = cur ? `Meta: ${p.meta?.principal || ""}. Posicionamento: ${p.posicionamento || ""}. Cadência: ${p.cadencia?.semana || ""}. Mix: ${p.cadencia?.mix || ""}. Séries: ${(p.series || []).map((s: any) => s.nome).join(", ")}.` : "";

  return (
    <>
      <PageHead kicker="CREATOR · 03 CRESCIMENTO" title="Estratégia de crescimento" desc="Plano de 30/60/90 dias feito a partir do briefing e das métricas do perfil: meta, KPIs, alavancas, fases com checklist, cadência e rotina." />
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={accId} onChange={(e) => setAccId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
        {acc && <span className="text-xs text-fog">{fmt(acc.followers_count)} seguidores · briefing {briefingProgress(acc.briefing)}% {briefingProgress(acc.briefing) < 50 && <Link href="/creator/perfis?tab=briefing" className="text-mint underline ml-1">complete para um plano melhor</Link>}</span>}
        {plans.length > 1 && <select className="input !w-auto ml-auto" value={cur?.id || ""} onChange={(e) => setCur(plans.find((x) => x.id === e.target.value))}>{plans.map((x) => <option key={x.id} value={x.id}>{new Date(x.created_at).toLocaleDateString("pt-BR")} · {x.horizon} dias</option>)}</select>}
        <button onClick={() => setShowNew(!showNew)} className={`btn btn-sm ${plans.length > 1 ? "" : "ml-auto"} btn-mint`}><I.spark className="w-4 h-4" />Nova estratégia</button>
      </div>

      {showNew && (
        <form onSubmit={generate} className="card p-5 mb-6 grid md:grid-cols-[1fr_140px] gap-3 rise">
          <div><label className="label">Meta (opcional)</label><input className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Ex.: chegar a 10 mil seguidores e 15 pedidos de orçamento por mês" /></div>
          <div><label className="label">Horizonte</label><select className="input" value={f.horizon} onChange={(e) => setF({ ...f, horizon: Number(e.target.value) })}>{[30, 60, 90, 180].map((h) => <option key={h} value={h}>{h} dias</option>)}</select></div>
          <div className="md:col-span-2"><label className="label">Tempo e recursos para o período (opcional)</label><input className="input" value={f.resources} onChange={(e) => setF({ ...f, resources: e.target.value })} placeholder="Ex.: 6h/semana, 1 diária de gravação por mês, editor próprio" /></div>
          {ai.error && <p className="md:col-span-2 text-danger text-sm">{ai.error}</p>}
          <div className="md:col-span-2 flex justify-end"><button disabled={ai.busy || !acc} className="btn btn-mint">{ai.busy ? "Montando a estratégia… (até 1 min)" : "Gerar estratégia"}</button></div>
        </form>
      )}

      {cur && (
        <div className="space-y-5">
          <section className="card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl"><p className="label text-mint">Diagnóstico</p><p className="leading-relaxed">{p.diagnostico}</p>
                {p.posicionamento && <p className="mt-4 font-display text-xl leading-snug">“{p.posicionamento}”</p>}</div>
              <div className="w-40"><div className="flex justify-between text-xs mb-1"><span className="text-fog">Execução</span><span className="font-mono text-mint">{pct}%</span></div><div className="h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-mint" style={{ width: `${pct}%` }} /></div>
                <button onClick={del} className="text-[11px] text-fog hover:text-danger mt-3">Excluir estratégia</button></div>
            </div>
          </section>

          {p.meta && <section className="card p-5"><p className="label text-mint">Meta</p><p className="font-semibold">{p.meta.principal}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">{(p.meta.kpis || []).map((k: any, i: number) => <div key={i} className="bg-panel2 rounded-xl p-3"><p className="text-xs text-fog">{k.nome}</p><p className="font-display font-bold text-lg mt-1">{k.atual} → <span className="text-mint">{k.alvo}</span></p><p className="text-[11px] text-fog mt-1">{k.como_medir}</p></div>)}</div></section>}

          <div className="grid lg:grid-cols-3 gap-4">
            {(p.fases || []).map((ph: any, i: number) => (
              <section key={i} className="card p-5">
                <p className="font-mono text-[11px] text-mint">FASE {i + 1}</p>
                <p className="font-display font-bold mt-1">{ph.titulo}</p>
                <p className="text-sm text-fog mt-1 mb-3">{ph.foco}</p>
                <ul className="space-y-1.5">{(ph.acoes || []).map((a: any) => { const on = cur.done.includes(a.id); return (
                  <li key={a.id}><label className="flex items-start gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-[#6eefb6] mt-1" checked={on} onChange={() => toggle(a.id)} /><span className={on ? "line-through text-fog" : ""}>{a.texto}</span></label></li>
                ); })}</ul>
              </section>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {!!p.alavancas?.length && <section className="card p-5"><p className="label text-mint">Alavancas de crescimento</p>
              <ul className="space-y-2">{p.alavancas.map((a: any, i: number) => <li key={i} className="bg-panel2 rounded-xl p-3 text-sm"><div className="flex items-center gap-2 mb-1"><b>{a.nome}</b><span className="text-[10px] px-1.5 rounded" style={{ background: LV[a.impacto] + "22", color: LV[a.impacto] }}>impacto {a.impacto}</span><span className="text-[10px] text-fog">esforço {a.esforco}</span></div>{a.acao}</li>)}</ul></section>}
            <section className="card p-5 space-y-4">
              {p.cadencia && <div><p className="label text-mint">Cadência</p><p className="text-sm">{p.cadencia.semana}</p><p className="text-sm text-fog mt-1">Mix: {p.cadencia.mix}</p>{!!p.cadencia.melhores_formatos?.length && <div className="flex flex-wrap gap-1 mt-2">{p.cadencia.melhores_formatos.map((x: string) => <span key={x} className="chip">{x}</span>)}</div>}</div>}
              {!!p.series?.length && <div><p className="label text-mint">Séries / quadros</p><ul className="space-y-1.5 text-sm">{p.series.map((s: any, i: number) => <li key={i}><b>{s.nome}</b> <span className="text-fog">({s.frequencia})</span> — {s.ideia}</li>)}</ul></div>}
              {!!p.rotina_diaria?.length && <div><p className="label text-mint">Rotina diária</p><ul className="list-disc ml-5 text-sm space-y-1">{p.rotina_diaria.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>}
              {!!p.riscos?.length && <div><p className="label text-danger">Riscos</p><ul className="list-disc ml-5 text-sm space-y-1 text-fog">{p.riscos.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>}
            </section>
          </div>

          <div className="card p-5 flex flex-wrap items-center gap-3 border-mint-dim">
            <p className="flex-1 min-w-[220px] text-sm">Transforme a estratégia em conteúdo: gere o calendário da semana ou do mês já alinhado à meta, cadência e séries.</p>
            <Link href={`/creator/pauta?gerar=1&perfil=${accId}&estrategia=${encodeURIComponent(strategyText)}`} className="btn btn-mint btn-sm"><I.board className="w-4 h-4" />Planejar conteúdo</Link>
          </div>
        </div>
      )}
      {!cur && !showNew && <p className="text-fog text-sm text-center py-10">Nenhuma estratégia ainda.</p>}
    </>
  );
}
