"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { FORMATS, CATS, type Cat, type Format } from "@/lib/formats";
import PageHead from "@/components/PageHead";
import AccountSelect from "@/components/AccountSelect";
import Markdown from "@/components/Markdown";
import CopyButton from "@/components/CopyButton";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";

const KEY = "vh.formatos.feitos";

export default function Formatos() {
  const { accounts } = useAccounts();
  const [cat, setCat] = useState<Cat | "">("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Format | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [f, setF] = useState({ topic: "", format: "Reels", goal: "Alcance e conexão", card2: "", accountId: "" });
  const [out, setOut] = useState("");
  const [saved, setSaved] = useState(false);
  const ai = useAI();

  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  function toggleDone(n: number) {
    const v = done.includes(n) ? done.filter((x) => x !== n) : [...done, n];
    setDone(v); try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
  }
  function open(x: Format) { setSel(x); setOut(""); setSaved(false); setF((p) => ({ ...p, card2: "" })); }
  function draw() { const pool = FORMATS.filter((x) => !done.includes(x.n)); const list = pool.length ? pool : FORMATS; open(list[Math.floor(Math.random() * list.length)]); }

  async function apply(e: React.FormEvent) {
    e.preventDefault(); if (!sel) return; setSaved(false);
    const r = await ai.run<{ text: string }>("format_apply", { card: sel.id, card2: f.card2 || undefined, topic: f.topic, format: f.format, goal: f.goal, account: accounts.find((a) => a.id === f.accountId) });
    if (r) setOut(r.text);
  }
  async function save() {
    if (!sel) return;
    await createClient().from("content_ideas").insert({ account_id: f.accountId || null, kind: "copy", title: `${sel.name}: ${f.topic.slice(0, 90)}`, format: f.format, body: out });
    setSaved(true);
  }

  const list = FORMATS.filter((x) => (!cat || x.cat === cat) && (!q || `${x.name} ${x.essence} ${x.why}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHead kicker="CREATOR" title="Formatos criativos" desc="32 cartas para fugir do mais do mesmo: estude o porquê, aplique ao seu tema com a IA e combine cartas. Baseado no desafio de Hannah Franklin." />

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="flex justify-between text-xs mb-1.5"><span className="text-fog">Seu desafio de 32 cartas</span><span className="font-mono text-mint">{done.length}/32</span></div>
          <div className="h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-mint rounded-full transition-all" style={{ width: `${(done.length / 32) * 100}%` }} /></div>
        </div>
        <button onClick={draw} className="btn btn-mint btn-sm"><I.spark className="w-4 h-4" />Sortear carta</button>
        <a href="/formatos-criativos-vincit.pdf" target="_blank" className="btn btn-ghost btn-sm">Guia em PDF</a>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setCat("")} className={`btn btn-sm ${!cat ? "btn-mint" : "btn-ghost"}`}>Todas</button>
        {(Object.keys(CATS) as Cat[]).map((k) => <button key={k} onClick={() => setCat(k)} className={`btn btn-sm ${cat === k ? "btn-mint" : "btn-ghost"}`}><span className="w-2 h-2 rounded-full" style={{ background: CATS[k].c }} />{CATS[k].l}</button>)}
        <input className="input !py-1.5 !w-48 ml-auto" placeholder="Buscar carta…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {cat && <p className="text-sm text-fog mb-4">{CATS[cat].d}</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {list.map((x, i) => (
          <button key={x.id} onClick={() => open(x)} className="card p-4 text-left hover:border-slate transition-colors rise relative overflow-hidden" style={{ animationDelay: `${Math.min(i, 16) * 0.02}s` }}>
            <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: CATS[x.cat].c }} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-fog">CARTA {String(x.n).padStart(2, "0")}</span>
              {done.includes(x.n) ? <span className="text-mint text-xs">✓ feita</span> : <span className="text-[10px] text-fog">sem. {x.week}</span>}
            </div>
            <p className="font-display font-bold text-lg mt-2 leading-tight">{x.name}</p>
            <p className="text-sm text-fog mt-1.5 line-clamp-3">{x.essence}</p>
            <p className="text-[10px] uppercase tracking-wide mt-3" style={{ color: CATS[x.cat].c }}>{CATS[x.cat].l}</p>
          </button>
        ))}
      </div>

      <Modal open={!!sel} title={sel ? `Carta ${sel.n} · ${sel.name}` : ""} onClose={() => setSel(null)} wide>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip" style={{ color: CATS[sel.cat].c, borderColor: CATS[sel.cat].c + "55" }}>{CATS[sel.cat].l}</span>
              <button onClick={() => toggleDone(sel.n)} className={`btn btn-sm ${done.includes(sel.n) ? "btn-mint" : "btn-ghost"}`}>{done.includes(sel.n) ? "✓ Já apliquei" : "Marcar como aplicada"}</button>
            </div>
            <p className="font-display text-xl leading-snug">{sel.essence}</p>
            <div className="grid md:grid-cols-2 gap-5 text-sm">
              <div><p className="label text-mint">Por que funciona</p><p className="leading-relaxed">{sel.why}</p></div>
              <div><p className="label text-mint">Como aplicar</p><ul className="list-disc ml-5 space-y-1.5">{sel.how.map((h, i) => <li key={i}>{h}</li>)}</ul></div>
            </div>
            {!!sel.combo?.length && <div><p className="label">Combina com</p><div className="flex flex-wrap gap-1.5">{sel.combo.map((n) => { const c = FORMATS.find((x) => x.n === n)!; return <button key={n} onClick={() => open(c)} className="chip hover:text-mint">{n}. {c.name}</button>; })}</div></div>}

            <form onSubmit={apply} className="bg-panel2 rounded-xl p-4 grid md:grid-cols-2 gap-3">
              <p className="md:col-span-2 font-display font-bold">Aplicar ao meu tema</p>
              <div className="md:col-span-2"><label className="label">Tema</label><input required className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Ex.: por que vídeo institucional não precisa ser chato" /></div>
              <div><label className="label">Formato</label><select className="input" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>{["Reels", "Carrossel", "Stories", "Foto"].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="label">Combinar com (opcional)</label><select className="input" value={f.card2} onChange={(e) => setF({ ...f, card2: e.target.value })}><option value="">Só esta carta</option>{FORMATS.filter((x) => x.id !== sel.id).map((x) => <option key={x.id} value={x.id}>{x.n}. {x.name}</option>)}</select></div>
              <div><label className="label">Objetivo</label><select className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>{["Alcance e conexão", "Autoridade", "Gerar leads", "Venda", "Comunidade"].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="label">Perfil</label><AccountSelect accounts={accounts} value={f.accountId} onChange={(v) => setF({ ...f, accountId: v })} /></div>
              <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                <Link href={`/creator/copy?carta=${sel.id}`} className="btn btn-ghost btn-sm">Abrir no Copy & roteiro</Link>
                <button disabled={ai.busy} className="btn btn-mint btn-sm"><I.spark className="w-4 h-4" />{ai.busy ? "Criando…" : "Gerar roteiro com a carta"}</button>
              </div>
              {ai.error && <p className="md:col-span-2 text-danger text-sm">{ai.error}</p>}
            </form>
            {out && (
              <div className="border border-mint-dim rounded-xl p-4">
                <div className="flex justify-end gap-2 mb-2"><CopyButton text={out} label="Copiar" /><button onClick={save} disabled={saved} className="btn btn-ghost btn-sm">{saved ? "Salvo ✓" : "Salvar na pauta"}</button></div>
                <Markdown text={out} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
