"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { BRIEFING, briefingProgress, type BField } from "@/lib/briefing";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

function Chips({ value, onChange, ph }: { value: string[]; onChange: (v: string[]) => void; ph?: string }) {
  const [t, setT] = useState("");
  const add = () => { const v = t.trim().replace(/,$/, ""); if (v && !value.includes(v)) onChange([...value, v]); setT(""); };
  return (
    <div className="input !p-1.5 flex flex-wrap gap-1.5 min-h-[42px]">
      {value.map((x) => <span key={x} className="flex items-center gap-1 text-xs bg-panel2 border border-line rounded-full pl-2.5 pr-1 py-0.5">{x}<button type="button" onClick={() => onChange(value.filter((y) => y !== x))} className="text-fog hover:text-danger px-1">×</button></span>)}
      <input className="flex-1 min-w-[140px] bg-transparent outline-none text-sm px-1.5" value={t} placeholder={value.length ? "" : ph} onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !t && value.length) onChange(value.slice(0, -1)); }} onBlur={add} />
    </div>
  );
}

function Field({ f, v, set }: { f: BField; v: any; set: (k: string, v: any) => void }) {
  return (
    <div className={f.type === "textarea" || f.type === "chips" || f.type === "multi" ? "md:col-span-2" : ""}>
      <label className="label">{f.l}</label>
      {f.type === "textarea" ? <textarea className="input min-h-[84px]" defaultValue={v || ""} placeholder={f.ph} onBlur={(e) => e.target.value !== (v || "") && set(f.k, e.target.value)} />
        : f.type === "chips" ? <Chips value={v || []} onChange={(x) => set(f.k, x)} ph={f.ph} />
        : f.type === "multi" ? <div className="flex flex-wrap gap-1.5">{f.options!.map((o) => { const on = (v || []).includes(o); return <button type="button" key={o} onClick={() => set(f.k, on ? v.filter((x: string) => x !== o) : [...(v || []), o])} className={`btn btn-sm ${on ? "btn-mint" : "btn-ghost"}`}>{o}</button>; })}</div>
        : f.type === "select" ? <select className="input" value={v || ""} onChange={(e) => set(f.k, e.target.value)}><option value="">–</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
        : <input className="input" defaultValue={v || ""} placeholder={f.ph} onBlur={(e) => e.target.value !== (v || "") && set(f.k, e.target.value)} />}
      {f.help && <p className="text-[11px] text-fog mt-1">{f.help}</p>}
    </div>
  );
}

export default function Briefing() {
  const { accounts, loading, reload } = useAccounts();
  const [accId, setAccId] = useState("");
  const [b, setB] = useState<any>({});
  const [voice, setVoice] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [sec, setSec] = useState(BRIEFING[0].k);
  const [dump, setDump] = useState("");
  const [showAI, setShowAI] = useState(false);
  const ai = useAI();
  const timer = useRef<any>(null);
  const acc = accounts.find((a) => a.id === accId);

  useEffect(() => {
    if (!accId && accounts.length) {
      const q = new URLSearchParams(location.search).get("perfil");
      setAccId(accounts.find((a) => a.id === q)?.id || accounts[0].id);
    }
  }, [accounts, accId]);
  useEffect(() => { if (acc) { setB(acc.briefing || {}); setVoice(acc.brand_voice || ""); setState("idle"); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accId, accounts.length]);

  function persist(next: any, nextVoice = voice) {
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await createClient().from("ig_accounts").update({ briefing: next, brand_voice: nextVoice || null, briefing_updated_at: new Date().toISOString(), niche: next.nicho || acc?.niche || null }).eq("id", accId);
      setState("saved");
    }, 700);
  }
  const set = (k: string, v: any) => { const n = { ...b, [k]: v }; setB(n); persist(n); };

  async function fillAI() {
    const r = await ai.run<any>("briefing_draft", { text: dump, account: acc, current: b });
    if (!r) return;
    // só preenche o que está vazio
    const n = { ...b };
    for (const s of BRIEFING) for (const f of s.fields) {
      const cur = n[f.k]; const empty = Array.isArray(cur) ? !cur.length : !(cur && String(cur).trim());
      if (empty && r[f.k] != null && (Array.isArray(r[f.k]) ? r[f.k].length : String(r[f.k]).trim())) n[f.k] = r[f.k];
    }
    setB(n); persist(n); setShowAI(false); setDump("");
  }

  const pct = briefingProgress(b);
  const secPct = (k: string) => { const s = BRIEFING.find((x) => x.k === k)!; return Math.round((s.fields.filter((f) => { const v = b[f.k]; return Array.isArray(v) ? v.length : v && String(v).trim(); }).length / s.fields.length) * 100); };
  const cur = BRIEFING.find((s) => s.k === sec)!;

  if (!loading && !accounts.length) return (
    <>
      <PageHead kicker="CREATOR · BASE" title="Briefing" desc="O DNA de cada perfil para a IA criar com intenção." />
      <div className="card p-10 text-center"><p className="font-display text-xl font-bold">Cadastre um perfil primeiro</p><Link href="/creator/perfis" className="btn btn-mint mt-5 inline-flex">Ir para Perfis <I.arrow className="w-4 h-4" /></Link></div>
    </>
  );

  return (
    <>
      <PageHead kicker="CREATOR · BASE" title="Briefing" desc="O DNA de cada perfil: negócio, público, mercado, estilo e recursos. Tudo que for preenchido aqui entra automaticamente nas análises, tendências, referências, formatos e no Laboratório." />

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={accId} onChange={(e) => setAccId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>
        <div className="flex-1 min-w-[180px]">
          <div className="flex justify-between text-xs mb-1.5"><span className="text-fog">Briefing preenchido</span><span className="font-mono text-mint">{pct}%</span></div>
          <div className="h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-mint rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
        <span className="text-xs text-fog w-20 text-right">{state === "saving" ? "Salvando…" : state === "saved" ? "Salvo ✓" : ""}</span>
        <button onClick={() => setShowAI(!showAI)} className="btn btn-ghost btn-sm"><I.spark className="w-4 h-4" />Preencher com IA</button>
      </div>

      {showAI && (
        <div className="card p-5 mb-5 border-mint-dim rise">
          <p className="font-display font-bold">Preencher a partir de um texto</p>
          <p className="text-xs text-fog mb-3">Cole a bio, texto do site, apresentação comercial, anotações de reunião… A IA preenche só os campos que estão vazios; revise depois.</p>
          <textarea className="input min-h-[140px]" value={dump} onChange={(e) => setDump(e.target.value)} placeholder="Cole aqui qualquer material sobre o negócio e o público." />
          <div className="flex justify-end gap-2 mt-3">{ai.error && <p className="text-danger text-sm mr-auto">{ai.error}</p>}<button disabled={ai.busy || dump.length < 40} onClick={fillAI} className="btn btn-mint btn-sm">{ai.busy ? "Lendo…" : "Preencher campos vazios"}</button></div>
        </div>
      )}

      {acc && (
        <div className="grid lg:grid-cols-[220px_1fr] gap-5" key={accId}>
          <nav className="card p-2 self-start lg:sticky lg:top-4 flex lg:flex-col gap-1 overflow-x-auto">
            {BRIEFING.map((s, i) => (
              <button key={s.k} onClick={() => setSec(s.k)} className={`text-left rounded-lg px-3 py-2.5 whitespace-nowrap ${sec === s.k ? "bg-mint/10 text-mint" : "hover:bg-panel2"}`}>
                <div className="flex items-center justify-between gap-3"><span className="text-sm"><span className="font-mono text-[10px] text-fog mr-2">{String(i + 1).padStart(2, "0")}</span>{s.l}</span><span className={`text-[10px] font-mono ${secPct(s.k) === 100 ? "text-mint" : "text-fog"}`}>{secPct(s.k)}%</span></div>
              </button>
            ))}
            <button onClick={() => setSec("voz")} className={`text-left rounded-lg px-3 py-2.5 whitespace-nowrap text-sm ${sec === "voz" ? "bg-mint/10 text-mint" : "hover:bg-panel2"}`}><span className="font-mono text-[10px] text-fog mr-2">06</span>Voz da marca</button>
          </nav>

          <section className="card p-5 md:p-6" key={sec}>
            {sec === "voz" ? (
              <>
                <p className="font-display font-bold text-xl">Voz da marca</p>
                <p className="text-sm text-fog mb-4">Como a marca escreve. A IA segue isso em legendas, roteiros e respostas. Dá para gerar a partir de textos seus na página Desempenho do perfil.</p>
                <textarea className="input min-h-[200px]" defaultValue={voice} placeholder="Ex.: tom próximo e confiante, frases curtas, fala 'a gente', sem emojis, nunca usa 'top' ou 'incrível'…" onBlur={(e) => { setVoice(e.target.value); persist(b, e.target.value); }} />
              </>
            ) : (
              <>
                <p className="font-display font-bold text-xl">{cur.l}</p>
                <p className="text-sm text-fog mb-5">{cur.d}</p>
                <div className="grid md:grid-cols-2 gap-4">{cur.fields.map((f) => <Field key={f.k} f={f} v={b[f.k]} set={set} />)}</div>
                <div className="flex justify-between mt-6">
                  <span />
                  {BRIEFING.findIndex((s) => s.k === sec) < BRIEFING.length - 1
                    ? <button onClick={() => setSec(BRIEFING[BRIEFING.findIndex((s) => s.k === sec) + 1].k)} className="btn btn-ghost btn-sm">Próxima seção <I.arrow className="w-4 h-4" /></button>
                    : <button onClick={() => setSec("voz")} className="btn btn-ghost btn-sm">Voz da marca <I.arrow className="w-4 h-4" /></button>}
                </div>
              </>
            )}
          </section>
        </div>
      )}
      <p className="text-xs text-fog mt-4">Salva sozinho a cada alteração. <button onClick={reload} className="underline hover:text-mint">Recarregar</button></p>
    </>
  );
}
