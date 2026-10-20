"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import PageHead from "@/components/PageHead";
import AccountSelect from "@/components/AccountSelect";
import { I } from "@/components/icons";

const urg: Record<string, string> = { alta: "text-mint border-mint-dim bg-mint/10", media: "text-paper", baixa: "text-fog" };

export default function Tendencias() {
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [f, setF] = useState({ niche: "", audience: "", focus: "Reels e carrosséis" });
  const [res, setRes] = useState<any>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const ai = useAI();
  const acc = accounts.find((a) => a.id === accountId);

  useEffect(() => { if (acc?.niche && !f.niche) setF((x) => ({ ...x, niche: acc.niche })); }, [acc]);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setSaved(new Set());
    const r = await ai.run("trends", { ...f, account: acc });
    if (r) setRes(r);
  }
  async function save(t: any, i: number) {
    await createClient().from("content_ideas").insert({ account_id: accountId || null, kind: "tendencia", title: t.titulo, format: t.formato, body: `**Gancho:** ${t.gancho}\n\n**Por que está em alta:** ${t.por_que}\n\n**Como aplicar:** ${t.ideia}` });
    setSaved(new Set([...saved, i]));
  }

  return (
    <>
      <PageHead kicker="CREATOR · 01 ANÁLISE" title="Tendências" desc="A IA pesquisa na web o que está em alta agora no seu nicho e transforma em pautas aplicáveis." />
      <form onSubmit={go} className="card p-5 grid md:grid-cols-4 gap-4 mb-8">
        <div><label className="label">Perfil</label><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} /></div>
        <div><label className="label">Nicho / tema</label><input required className="input" value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} placeholder="produção audiovisual para marcas" /></div>
        <div><label className="label">Público</label><input className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="donos de pequenas empresas" /></div>
        <div><label className="label">Foco</label><input className="input" value={f.focus} onChange={(e) => setF({ ...f, focus: e.target.value })} /></div>
        <div className="md:col-span-4 flex justify-end"><button disabled={ai.busy} className="btn btn-mint"><I.trend className="w-4 h-4" />{ai.queued ? "Na fila do Claude…" : ai.busy ? "Pesquisando na web… (até 1 min)" : "Buscar tendências"}</button></div>
      </form>
      {ai.error && <div className="card px-4 py-3 mb-5 text-sm text-danger border-danger/40">{ai.error}</div>}

      {res && (
        <>
          <div className="card p-5 mb-5 border-mint-dim bg-mint/[.03] rise"><p className="text-xs text-mint font-mono uppercase tracking-widest mb-2">Cenário</p><p className="text-[15px] leading-relaxed">{res.resumo}</p></div>
          <div className="grid md:grid-cols-2 gap-4">
            {(res.tendencias || []).map((t: any, i: number) => (
              <article key={i} className="card p-5 flex flex-col rise" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-center gap-2 mb-3"><span className="chip">{t.formato}</span><span className={`chip ${urg[t.urgencia] || ""}`}>urgência {t.urgencia}</span></div>
                <h3 className="font-display font-bold text-lg leading-snug">{t.titulo}</h3>
                <p className="text-sm text-fog mt-2">{t.por_que}</p>
                <div className="bg-panel2 rounded-lg p-3 mt-4"><p className="text-[11px] text-fog mb-1">Gancho</p><p className="text-sm font-medium">“{t.gancho}”</p></div>
                <p className="text-sm mt-3 flex-1">{t.ideia}</p>
                <button onClick={() => save(t, i)} disabled={saved.has(i)} className="btn btn-ghost btn-sm mt-4 self-start">{saved.has(i) ? "Salvo na pauta ✓" : "Salvar na pauta"}</button>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
