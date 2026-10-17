"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import Markdown from "@/components/Markdown";
import { I } from "@/components/icons";

export default function Perfil() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [acc, setAcc] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [diag, setDiag] = useState("");
  const [edit, setEdit] = useState(false);
  const [sort, setSort] = useState<"recent" | "eng">("recent");
  const [voiceEdit, setVoiceEdit] = useState(false);
  const [samples, setSamples] = useState("");
  const ai = useAI();

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: a }, { data: p }] = await Promise.all([
      s.from("ig_accounts").select("*").eq("id", id).single(),
      s.from("ig_posts").select("*").eq("account_id", id).order("posted_at", { ascending: false }),
    ]);
    setAcc(a); setPosts(p || []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setSyncing(true); setMsg(null);
    const r = await fetch("/api/meta/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account_id: id }) });
    const j = await r.json();
    setMsg(r.ok ? `${j.posts} posts sincronizados.` : j.error);
    setSyncing(false); load();
  }
  async function save() {
    await createClient().from("ig_accounts").update({ niche: acc.niche, goals: acc.goals, followers_count: acc.followers_count, brand_voice: acc.brand_voice || null }).eq("id", id);
    setEdit(false);
  }
  async function remove() {
    if (!confirm(`Remover @${acc.username} do CREATOR? Posts e automações dele também serão removidos.`)) return;
    await createClient().from("ig_accounts").delete().eq("id", id);
    router.push("/creator/perfis");
  }
  async function diagnose() {
    const r = await ai.run<{ text: string }>("profile_diagnosis", { account: acc, posts });
    if (r) setDiag(r.text);
  }
  async function saveDiag() {
    await createClient().from("content_ideas").insert({ account_id: id, kind: "diagnostico", title: `Diagnóstico @${acc.username} · ${new Date().toLocaleDateString("pt-BR")}`, body: diag });
    setMsg("Diagnóstico salvo na pauta.");
  }

  async function genVoice() {
    const r = await ai.run<{ text: string }>("brand_voice", { account: acc, samples });
    if (r) { setAcc({ ...acc, brand_voice: r.text }); await createClient().from("ig_accounts").update({ brand_voice: r.text }).eq("id", id); setVoiceEdit(false); }
  }
  async function saveVoice() { await createClient().from("ig_accounts").update({ brand_voice: acc.brand_voice || null }).eq("id", id); setVoiceEdit(false); }

  if (!acc) return <p className="text-fog">Carregando…</p>;
  const perf = (p: any) => p.plays ?? p.reach ?? null;
  const vals = posts.map(perf).filter((v: any) => v != null).sort((a: number, b: number) => a - b);
  const median = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
  const xMed = (p: any) => (median && perf(p) != null ? perf(p) / median : null);

  const eng = (p: any) => (p.like_count || 0) + (p.comments_count || 0) + (p.saved || 0) + (p.shares || 0);
  const avgEng = posts.length ? posts.reduce((a, p) => a + eng(p), 0) / posts.length : null;
  const reachPosts = posts.filter((p) => p.reach);
  const avgReach = reachPosts.length ? reachPosts.reduce((a, p) => a + p.reach, 0) / reachPosts.length : null;
  const engRate = avgEng != null && acc.followers_count ? (avgEng / acc.followers_count) * 100 : null;
  const byType: Record<string, { n: number; e: number }> = {};
  posts.forEach((p) => { const k = p.media_type || "?"; byType[k] ??= { n: 0, e: 0 }; byType[k].n++; byType[k].e += eng(p); });
  const sorted = sort === "eng" ? [...posts].sort((a, b) => eng(b) - eng(a)) : posts;

  return (
    <>
      <Link href="/creator/perfis" className="inline-flex items-center gap-2 text-sm text-fog hover:text-paper mb-6"><I.back className="w-4 h-4" />Perfis & marca</Link>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 rise">
        <div className="flex items-center gap-4">
          {acc.profile_picture_url ? <img src={acc.profile_picture_url} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-mint/40" /> : <div className="w-16 h-16 rounded-full bg-panel2 grid place-items-center font-display text-2xl font-bold text-mint">{acc.username[0]?.toUpperCase()}</div>}
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">@{acc.username}</h1>
            <p className="text-fog text-sm">{acc.name || acc.niche || "Perfil"}{acc.last_synced_at && ` · sincronizado ${new Date(acc.last_synced_at).toLocaleString("pt-BR")}`}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {acc.connected && <button onClick={sync} disabled={syncing} className="btn btn-ghost"><I.refresh className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando…" : "Sincronizar"}</button>}
          <button onClick={diagnose} disabled={ai.busy} className="btn btn-mint"><I.spark className="w-4 h-4" />{ai.busy ? "Analisando…" : "Diagnóstico com IA"}</button>
        </div>
      </div>
      {msg && <div className="card px-4 py-3 mb-5 text-sm text-mint border-mint-dim">{msg}</div>}
      {ai.error && <div className="card px-4 py-3 mb-5 text-sm text-danger border-danger/40">{ai.error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[["Seguidores", fmt(acc.followers_count)], ["Posts analisados", fmt(posts.length)], ["Engaj. médio/post", fmt(avgEng && Math.round(avgEng))], ["Taxa de engajamento", engRate != null ? engRate.toFixed(2) + "%" : "–"], ["Alcance médio", fmt(avgReach && Math.round(avgReach))]].map(([k, v]) => (
          <div key={k} className="card p-4"><p className="text-xs text-fog">{k}</p><p className="font-display text-2xl font-bold mt-1.5 tabular-nums">{v}</p></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-display font-bold">Contexto do perfil</h2><button className="text-xs text-fog hover:text-mint" onClick={() => (edit ? save() : setEdit(true))}>{edit ? "Salvar" : "Editar"}</button></div>
          {edit ? (
            <div className="space-y-3">
              <div><label className="label">Nicho</label><input className="input" value={acc.niche || ""} onChange={(e) => setAcc({ ...acc, niche: e.target.value })} /></div>
              <div><label className="label">Objetivos</label><textarea className="input" value={acc.goals || ""} onChange={(e) => setAcc({ ...acc, goals: e.target.value })} /></div>
              {!acc.connected && <div><label className="label">Seguidores</label><input type="number" className="input" value={acc.followers_count || ""} onChange={(e) => setAcc({ ...acc, followers_count: Number(e.target.value) || null })} /></div>}
              <button onClick={remove} className="text-xs text-danger flex items-center gap-1"><I.trash className="w-3.5 h-3.5" />Remover perfil</button>
            </div>
          ) : (
            <div className="text-sm space-y-2"><p><span className="text-fog">Nicho:</span> {acc.niche || "não definido"}</p><p><span className="text-fog">Objetivos:</span> {acc.goals || "não definidos"}</p><p className="text-xs text-fog pt-2">A IA usa esse contexto em todas as análises.</p></div>
          )}
        </section>
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-display font-bold mb-3">Desempenho por formato</h2>
          {!Object.keys(byType).length ? <p className="text-fog text-sm">Sem posts sincronizados.</p> : (
            <div className="space-y-3">
              {Object.entries(byType).map(([k, v]) => {
                const max = Math.max(...Object.values(byType).map((x) => x.e / x.n));
                const avg = v.e / v.n;
                return (
                  <div key={k}>
                    <div className="flex justify-between text-sm mb-1"><span>{k} <span className="text-fog text-xs">({v.n})</span></span><span className="font-mono text-mint">{fmt(Math.round(avg))}</span></div>
                    <div className="h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-mint rounded-full" style={{ width: `${(avg / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-2"><h2 className="font-display font-bold">Voz da marca</h2><button className="text-xs text-fog hover:text-mint" onClick={() => (voiceEdit ? saveVoice() : setVoiceEdit(true))}>{voiceEdit ? "Salvar" : acc.brand_voice ? "Editar" : "Definir"}</button></div>
        {voiceEdit ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Como a marca escreve (a IA segue isso em tudo)</label><textarea className="input min-h-[150px]" value={acc.brand_voice || ""} onChange={(e) => setAcc({ ...acc, brand_voice: e.target.value })} placeholder="Ex.: tom próximo e confiante, frases curtas, fala 'a gente', sem emojis, nunca usa 'top' ou 'incrível'…" /></div>
            <div><label className="label">Ou gere a partir de 3 textos seus</label><textarea className="input min-h-[150px]" value={samples} onChange={(e) => setSamples(e.target.value)} placeholder="Cole 3 legendas ou roteiros que tenham a cara da marca." />
              <button type="button" disabled={ai.busy || samples.length < 80} onClick={genVoice} className="btn btn-ghost btn-sm mt-2"><I.spark className="w-3.5 h-3.5" />{ai.busy ? "Lendo…" : "Extrair voz da marca"}</button></div>
          </div>
        ) : <p className="text-sm whitespace-pre-wrap">{acc.brand_voice || <span className="text-fog">Ainda não definida. Com ela, legendas, roteiros e respostas saem com o jeito da marca.</span>}</p>}
      </section>

      {diag && (
        <section className="card p-6 mb-6 border-mint-dim rise">
          <div className="flex items-center justify-between mb-2"><h2 className="font-display font-bold text-lg text-mint">Diagnóstico</h2><button onClick={saveDiag} className="btn btn-ghost btn-sm">Salvar na pauta</button></div>
          <Markdown text={diag} />
        </section>
      )}

      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold">Posts</h2>
          <div className="flex gap-1">{(["recent", "eng"] as const).map((s) => <button key={s} onClick={() => setSort(s)} className={`btn btn-sm ${sort === s ? "btn-mint" : "btn-ghost"}`}>{s === "recent" ? "Recentes" : "Mais engajamento"}</button>)}</div>
        </div>
        {!posts.length ? <p className="text-fog text-sm py-6 text-center">{acc.connected ? "Clique em Sincronizar para puxar os posts." : "Perfis manuais não têm posts automáticos. Conecte via Meta para métricas reais."}</p> : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[860px]">
              <thead><tr className="text-left text-fog text-xs border-b border-line">{["Post", "Formato", "Data", "x mediana", "Curtidas", "Coment.", "Salvos", "Compart.", "Alcance", "Views", "Compart./alc."].map((h) => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 hover:bg-panel2/50">
                    <td className="py-2.5 pr-3"><a href={p.permalink} target="_blank" className="flex items-center gap-2.5 max-w-[280px]">{p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-9 h-9 rounded object-cover" /> : <div className="w-9 h-9 rounded bg-panel2" />}<span className="truncate">{p.caption || "(sem legenda)"}</span></a></td>
                    <td className="pr-3 text-fog text-xs">{p.media_type}</td>
                    <td className="pr-3 text-fog text-xs whitespace-nowrap">{p.posted_at?.slice(0, 10)}</td>
                    <td className="pr-3 font-mono text-xs">{xMed(p) != null ? <span className={xMed(p)! >= 2 ? "text-mint font-semibold" : xMed(p)! < 0.5 ? "text-fog" : ""}>{xMed(p)!.toFixed(1)}x</span> : "–"}</td>
                    {[p.like_count, p.comments_count, p.saved, p.shares, p.reach, p.plays].map((v, i) => <td key={i} className="pr-3 font-mono text-xs">{fmt(v)}</td>)}
                    <td className="pr-3 font-mono text-xs">{p.reach && p.shares != null ? `${((p.shares / p.reach) * 100).toFixed(1)}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
