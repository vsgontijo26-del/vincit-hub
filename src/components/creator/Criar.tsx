"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import AccountSelect from "@/components/AccountSelect";
import Markdown from "@/components/Markdown";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";
import { FORMATS, DELIVERY_FORMATS, FORMAT_MIDIA, MIDIAS } from "@/lib/formats";

export default function Criar() {
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [refs, setRefs] = useState<any[]>([]);
  const [f, setF] = useState({ topic: "", format: "Reels", goal: "Engajamento", tone: "Direto e confiante", keyword: "", refId: "", card: "" });
  const [out, setOut] = useState("");
  const [saved, setSaved] = useState(false);
  const ai = useAI();

  useEffect(() => {
    createClient().from("references_lib").select("id,title,analysis").order("created_at", { ascending: false }).then(({ data }) => setRefs(data || []));
    const r = new URLSearchParams(location.search).get("ref");
    if (r) setF((x) => ({ ...x, refId: r }));
    const c = new URLSearchParams(location.search).get("carta");
    if (c) setF((x) => ({ ...x, card: c }));
    const fm = new URLSearchParams(location.search).get("format");
    if (fm && DELIVERY_FORMATS.includes(fm)) setF((x) => ({ ...x, format: fm }));
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setSaved(false);
    const ref = refs.find((r) => r.id === f.refId);
    const reference = ref ? `Gancho: ${ref.analysis?.gancho}\nEstrutura: ${(ref.analysis?.estrutura || []).join(" > ")}\nModelo: ${ref.analysis?.modelo_de_copy}` : "";
    const r = await ai.run<{ text: string }>("copy", { ...f, reference, format_card: FORMATS.find((x) => x.id === f.card)?.name, account: accounts.find((a) => a.id === accountId) });
    if (r) setOut(r.text);
  }
  async function save() {
    await createClient().from("content_ideas").insert({ account_id: accountId || null, kind: "copy", title: f.topic.slice(0, 120), format: f.format, body: out });
    setSaved(true);
  }

  const opt = (k: keyof typeof f, values: string[]) => <select className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{values.map((v) => <option key={v}>{v}</option>)}</select>;

  return (
    <>
      <div className="grid lg:grid-cols-5 gap-5">
        <form onSubmit={go} className="lg:col-span-2 card p-5 space-y-4 h-fit">
          <div><label className="label">Perfil</label><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} /></div>
          <div><label className="label">Tema do conteúdo</label><textarea required className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="3 erros que deixam o vídeo da sua empresa com cara de amador" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Formato</label><select className="input" value={f.format} onChange={(e) => { const format = e.target.value; const card = FORMATS.find((x) => x.id === f.card); setF({ ...f, format, card: card && !card.fmt.includes(FORMAT_MIDIA[format]) ? "" : f.card }); }}>{DELIVERY_FORMATS.map((v) => <option key={v} value={v}>{v === "YouTube" ? "YouTube (vídeo longo)" : v}</option>)}</select></div>
            <div><label className="label">Objetivo</label>{opt("goal", ["Engajamento", "Alcance / viral", "Autoridade", "Gerar leads", "Venda"])}</div>
          </div>
          <div><label className="label">Tom</label>{opt("tone", ["Direto e confiante", "Educativo", "Bem-humorado", "Inspirador", "Bastidores / pessoal"])}</div>
          <div><label className="label">Palavra-chave de automação (opcional)</label><input className="input" value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} placeholder="ROTEIRO" /></div>
          <div><label className="label">Usar estrutura de referência</label>
            <select className="input" value={f.refId} onChange={(e) => setF({ ...f, refId: e.target.value })}><option value="">Nenhuma</option>{refs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></div>
          <div><label className="label">Formato criativo (carta)</label>
            <select className="input" value={f.card} onChange={(e) => setF({ ...f, card: e.target.value })}><option value="">Deixar a IA escolher</option>{FORMATS.filter((x) => x.fmt.includes(FORMAT_MIDIA[f.format])).map((x) => <option key={x.id} value={x.id}>{x.n}. {x.name}</option>)}</select>
            <p className="text-[11px] text-fog mt-1">Mostrando só cartas de {MIDIAS[FORMAT_MIDIA[f.format]].l.toLowerCase()}.</p></div>
          <button disabled={ai.busy} className="btn btn-mint w-full"><I.pen className="w-4 h-4" />{ai.queued ? "Na fila do Claude…" : ai.busy ? "Escrevendo…" : "Gerar conteúdo"}</button>
          {ai.error && <p className="text-danger text-sm">{ai.error}</p>}
        </form>
        <section className="lg:col-span-3 card p-6 min-h-[420px]">
          {!out ? (
            <div className="h-full grid place-items-center text-center text-fog text-sm"><div><I.pen className="w-8 h-8 mx-auto mb-3 text-line" />O resultado aparece aqui.</div></div>
          ) : (
            <>
              <div className="flex justify-end gap-2 mb-2"><CopyButton text={out} label="Copiar tudo" /><button onClick={save} disabled={saved} className="btn btn-ghost btn-sm">{saved ? "Salvo ✓" : "Salvar na pauta"}</button></div>
              <Markdown text={out} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
