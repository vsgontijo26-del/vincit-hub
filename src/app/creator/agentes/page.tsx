"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { AGENTS } from "@/lib/agents";
import PageHead from "@/components/PageHead";
import AccountSelect from "@/components/AccountSelect";
import Markdown from "@/components/Markdown";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";

export default function Agentes() {
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [sel, setSel] = useState(AGENTS[0].id);
  const [input, setInput] = useState("");
  const [out, setOut] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const ai = useAI();
  const ag = AGENTS.find((a) => a.id === sel)!;

  async function run(e: React.FormEvent) {
    e.preventDefault(); setSaved(false);
    const r = await ai.run<{ text: string }>("agent", { agent: sel, input, account: accounts.find((a) => a.id === accountId) });
    if (r) setOut({ ...out, [sel]: r.text });
  }
  async function save() {
    await createClient().from("content_ideas").insert({ account_id: accountId || null, kind: ag.id === "plano" ? "plano" : "copy", title: `${ag.name}: ${input.slice(0, 90)}`, body: out[sel] });
    setSaved(true);
  }

  return (
    <>
      <PageHead kicker="CREATOR" title={`${AGENTS.length} agentes`} desc="Um time de especialistas de IA, cada um numa área da produção de conteúdo. Escolha o agente, dê o contexto e use o resultado." />
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2 mb-6">
        {AGENTS.map((a, i) => (
          <button key={a.id} onClick={() => { setSel(a.id); setSaved(false); }} className={`rounded-xl border p-3 text-left transition-colors rise ${sel === a.id ? "border-mint bg-mint/10" : "border-line bg-panel hover:border-slate"}`} style={{ animationDelay: `${i * 0.03}s` }}>
            <p className="font-mono text-[10px] text-fog">{String(i + 1).padStart(2, "0")}</p>
            <p className={`font-display font-bold text-sm mt-1 ${sel === a.id ? "text-mint" : ""}`}>{a.name}</p>
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-5">
        <form onSubmit={run} className="lg:col-span-2 card p-5 space-y-4 h-fit">
          <div><p className="font-display font-bold text-xl">{ag.name}{ag.web && <span className="chip chip-mint ml-2 align-middle">pesquisa na web</span>}</p><p className="text-fog text-sm">{ag.role}</p></div>
          <div><label className="label">Perfil</label><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} /></div>
          <div><label className="label">Contexto</label><textarea required className="input min-h-[160px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder={ag.placeholder} /></div>
          <button disabled={ai.busy} className="btn btn-mint w-full"><I.spark className="w-4 h-4" />{ai.busy ? "Trabalhando…" : `Acionar ${ag.name}`}</button>
          {ai.error && <p className="text-danger text-sm">{ai.error}</p>}
        </form>
        <section className="lg:col-span-3 card p-6 min-h-[420px]">
          {!out[sel] ? <div className="h-full grid place-items-center text-center text-fog text-sm"><div><I.spark className="w-8 h-8 mx-auto mb-3 text-line" />O resultado do agente aparece aqui.</div></div> : (
            <>
              <div className="flex justify-end gap-2 mb-2"><CopyButton text={out[sel]} label="Copiar" /><button onClick={save} disabled={saved} className="btn btn-ghost btn-sm">{saved ? "Salvo ✓" : "Salvar na pauta"}</button></div>
              <Markdown text={out[sel]} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
