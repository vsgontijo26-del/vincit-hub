"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { aiFetch } from "@/lib/useAI";
import { useAccounts, fmt } from "@/lib/useAccounts";
import { AXES, axisLabel } from "@/lib/diagnostico";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

const STEPS = [
  { n: "1", t: "Diagnóstico", d: "Onde o perfil está hoje", href: "" },
  { n: "2", t: "Estratégia", d: "O que fazer em 30/60/90 dias", href: "/creator/estrategia" },
  { n: "3", t: "Implementação", d: "Quais conteúdos e quando", href: "/creator/pauta" },
];

function Score({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs text-fog font-mono">sem informação</span>;
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="h-2 flex-1 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-mint" style={{ width: `${v * 10}%` }} /></div>
      <span className="font-mono text-sm text-mint">{v}</span>
    </div>
  );
}

export default function Diagnostico() {
  const { accounts } = useAccounts();
  const [accId, setAccId] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [cur, setCur] = useState<any>(null);
  const [noTable, setNoTable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const acc = accounts.find((a) => a.id === accId);

  useEffect(() => { if (!accId && accounts[0]) setAccId(accounts[0].id); }, [accounts, accId]);
  const load = useCallback(async () => {
    if (!accId) return;
    const { data, error } = await createClient().from("profile_diagnoses").select("*").eq("account_id", accId).order("created_at", { ascending: false });
    setNoTable(!!error);
    setList(data || []); setCur((data || [])[0] || null); setSel([]); setMsg(null);
  }, [accId]);
  useEffect(() => { load(); }, [load]);

  async function run() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const j = await aiFetch("/api/ai/diagnostico", { account_id: accId }, () => setMsg("Pedido na fila do Claude. Pode sair da página: o Raio-X fica salvo aqui quando ficar pronto."));
      setMsg(null);
      const row = { id: j.id, created_at: j.created_at, result: j.result, inputs: j.inputs, account_id: accId };
      if (j.saved) await load(); else { setList([row, ...list]); setNoTable(true); setCur(row); setSel([]); }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function toPauta() {
    const recs = (cur.result.eixos || []).flatMap((e: any) => (e.recomendacoes || []).map((x: any) => ({ ...x, axis: e.key }))).filter((x: any) => sel.includes(x.id));
    if (!recs.length) return;
    const rows = recs.map((x: any) => ({
      account_id: accId, kind: "diagnostico", title: x.titulo.slice(0, 120), format: x.formato || null, pillar: x.pilar || null, hook: x.gancho || null,
      body: `**Eixo:** ${axisLabel(x.axis)}\n\n**Por quê:** ${x.porque || ""}\n\n**Gancho:** ${x.gancho || ""}\n\n_Raio-X de ${new Date(cur.created_at).toLocaleDateString("pt-BR")}_`,
    }));
    const sb = createClient();
    const { error } = await sb.from("content_ideas").insert(rows.map((r: any, i: number) => ({ ...r, axis: recs[i].axis, diagnosis_id: cur.id || null })));
    if (error) { const { error: e2 } = await sb.from("content_ideas").insert(rows); if (e2) { setMsg(`Não consegui salvar: ${e2.message}`); return; } }
    setMsg(`${rows.length} ideia(s) enviadas ao Planejador.`); setSel([]);
  }
  async function del() { if (!cur?.id || !confirm("Excluir esta versão do diagnóstico?")) return; await createClient().from("profile_diagnoses").delete().eq("id", cur.id); load(); }

  const r = cur?.result || {};
  const inp = cur?.inputs || {};
  const prev = cur ? list[list.findIndex((x) => x === cur || (x.id && x.id === cur.id)) + 1] : null;
  const prevNota = (k: string) => prev?.result?.eixos?.find((e: any) => e.key === k)?.nota ?? null;
  const scored = (r.eixos || []).filter((e: any) => e.nota != null);
  const media = scored.length ? Math.round((scored.reduce((a: number, e: any) => a + e.nota, 0) / scored.length) * 10) / 10 : null;

  return (
    <>
      <PageHead kicker="CREATOR · 03 CRESCIMENTO" title="Raio-X do perfil" desc="Diagnóstico estratégico do perfil, do mercado e do nicho em 5 eixos de crescimento. Usa só dados reais: métricas, briefing, referências e pesquisa de mercado." />

      <div className="grid md:grid-cols-3 gap-2 mb-5">
        {STEPS.map((s, i) => {
          const body = (<><p className="font-mono text-[11px] text-mint">ETAPA {s.n}</p><p className="font-display font-bold">{s.t}</p><p className="text-xs text-fog">{s.d}</p></>);
          return s.href ? <Link key={s.n} href={s.href} className="card p-4 hover:border-mint-dim">{body}</Link> : <div key={s.n} className={`card p-4 ${i === 0 ? "border-mint-dim bg-mint/[.04]" : ""}`}>{body}</div>;
        })}
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={accId} onChange={(e) => setAccId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
        {acc && <span className="text-xs text-fog">{fmt(acc.followers_count)} seguidores</span>}
        {list.length > 1 && <select className="input !w-auto ml-auto" value={list.indexOf(cur)} onChange={(e) => { setCur(list[Number(e.target.value)]); setSel([]); }}>{list.map((x, i) => <option key={x.id || i} value={i}>{new Date(x.created_at).toLocaleDateString("pt-BR")}</option>)}</select>}
        <button onClick={run} disabled={busy || !acc} className={`btn btn-sm btn-mint ${list.length > 1 ? "" : "ml-auto"}`}><I.spark className="w-4 h-4" />{busy ? "Analisando perfil e mercado… (até 2 min)" : cur ? "Refazer diagnóstico" : "Fazer diagnóstico"}</button>
      </div>
      {!accounts.length && <p className="text-fog text-sm text-center py-10">Cadastre um perfil em <Link href="/creator/perfis" className="text-mint underline">Perfis & briefing</Link> para fazer o diagnóstico.</p>}
      {err && <div className="card px-4 py-3 mb-5 text-sm text-danger border-danger/40">{err}</div>}
      {noTable && cur && <div className="card px-4 py-3 mb-5 text-sm text-fog">O histórico de versões ainda está sendo preparado no banco: este diagnóstico aparece agora, mas não fica salvo para comparar depois.</div>}

      {cur && (
        <div className="space-y-5">
          <section className="card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="label text-mint">Resumo</p><p className="leading-relaxed">{r.resumo}</p>
                {!!r.prioridades?.length && <><p className="label text-mint mt-4">Prioridades</p><ol className="list-decimal ml-5 text-sm space-y-1">{r.prioridades.map((p: string, i: number) => <li key={i}>{p}</li>)}</ol></>}
              </div>
              <div className="text-right">
                <p className="text-xs text-fog">Nota média ({scored.length} de 5 eixos)</p>
                <p className="font-display text-4xl font-extrabold text-mint">{media ?? "–"}</p>
                <p className="text-[11px] text-fog mt-2">{inp.posts?.n ?? 0} posts · briefing {inp.briefing_pct ?? 0}% · {(inp.referencias?.perfis ?? 0) + (inp.referencias?.biblioteca ?? 0)} referências</p>
                {cur.id && <button onClick={del} className="text-[11px] text-fog hover:text-danger mt-2">Excluir versão</button>}
              </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            {AXES.map((a) => {
              const e = (r.eixos || []).find((x: any) => x.key === a.key) || {};
              const pn = prevNota(a.key);
              return (
                <section key={a.key} className="card p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div><p className="font-display font-bold">{a.label}</p><p className="text-xs text-fog">{a.q}</p></div>
                    <div className="text-right"><Score v={e.nota ?? null} />{pn != null && e.nota != null && e.nota !== pn && <p className={`text-[11px] font-mono mt-1 ${e.nota > pn ? "text-mint" : "text-danger"}`}>{e.nota > pn ? "+" : ""}{Math.round((e.nota - pn) * 10) / 10} desde a versão anterior</p>}</div>
                  </div>
                  {e.nota == null ? (
                    <p className="text-sm text-fog">Falta {a.needs} para avaliar este eixo. <Link href={a.fix[1]} className="text-mint underline">{a.fix[0]}</Link></p>
                  ) : (
                    <>
                      {e.evidencia && <p className="text-sm bg-panel2 rounded-lg p-3">{e.evidencia}</p>}
                      <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
                        {!!e.pontos_fortes?.length && <div><p className="text-[11px] text-mint mb-1">Pontos fortes</p><ul className="list-disc ml-4 space-y-0.5">{e.pontos_fortes.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
                        {!!e.lacunas?.length && <div><p className="text-[11px] text-danger mb-1">Lacunas</p><ul className="list-disc ml-4 space-y-0.5">{e.lacunas.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
                      </div>
                      {!!e.recomendacoes?.length && <div className="mt-4"><p className="text-[11px] text-fog mb-1">Recomendações de conteúdo</p><ul className="space-y-1.5">{e.recomendacoes.map((x: any) => (
                        <li key={x.id}><label className="flex items-start gap-2 text-sm cursor-pointer bg-panel2 rounded-lg p-2.5">
                          <input type="checkbox" className="accent-[var(--color-mint)] mt-1" checked={sel.includes(x.id)} onChange={() => setSel(sel.includes(x.id) ? sel.filter((s) => s !== x.id) : [...sel, x.id])} />
                          <span><b>{x.titulo}</b> <span className="text-fog text-xs">· {x.formato}{x.pilar ? ` · ${x.pilar}` : ""}</span>{x.gancho && <span className="block text-xs mt-0.5">“{x.gancho}”</span>}{x.porque && <span className="block text-xs text-fog mt-0.5">{x.porque}</span>}</span>
                        </label></li>
                      ))}</ul></div>}
                    </>
                  )}
                </section>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {r.nicho && <section className="card p-5"><p className="label text-mint">Nicho</p>
              {r.nicho.posicionamento_atual && <p className="text-sm"><span className="text-fog">Hoje: </span>{r.nicho.posicionamento_atual}</p>}
              {r.nicho.lacuna && <p className="text-sm mt-2"><span className="text-fog">Espaço livre: </span>{r.nicho.lacuna}</p>}
              {!!r.nicho.oportunidades?.length && <ul className="list-disc ml-5 text-sm space-y-1 mt-3">{r.nicho.oportunidades.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>}
            </section>}
            <section className="card p-5"><p className="label text-mint">Mercado</p>
              {r.mercado ? <>
                <p className="text-sm">{r.mercado.resumo}</p>
                {!!r.mercado.sinais?.length && <ul className="space-y-1.5 text-sm mt-3">{r.mercado.sinais.map((s: any, i: number) => <li key={i}>{s.texto} <a href={s.fonte} target="_blank" rel="noopener noreferrer" className="text-mint text-xs underline">fonte</a></li>)}</ul>}
              </> : <p className="text-sm text-fog">Sem informação: informe o nicho no <Link href="/creator/perfis?tab=briefing" className="text-mint underline">briefing</Link> para a pesquisa de mercado.</p>}
            </section>
          </div>

          {r.evolucao && <section className="card p-5"><p className="label text-mint">Evolução desde a versão anterior</p><p className="text-sm">{r.evolucao}</p></section>}

          <div className="card p-5 flex flex-wrap items-center gap-3 border-mint-dim sticky bottom-4">
            <p className="flex-1 min-w-[220px] text-sm">{msg || (sel.length ? `${sel.length} recomendação(ões) selecionada(s).` : "Selecione recomendações para virar ideias na pauta, ou siga para a estratégia.")}</p>
            <button onClick={toPauta} disabled={!sel.length} className="btn btn-ghost btn-sm"><I.board className="w-4 h-4" />Enviar para a pauta</button>
            <Link href={`/creator/estrategia?perfil=${accId}&novo=1`} className="btn btn-mint btn-sm"><I.trend className="w-4 h-4" />Montar estratégia</Link>
          </div>
        </div>
      )}
      {acc && !cur && !busy && <p className="text-fog text-sm text-center py-10">Nenhum diagnóstico deste perfil ainda.</p>}
    </>
  );
}
