"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { FORMATS, CATS, DECKS, MIDIAS, DELIVERY_FORMATS, FORMAT_MIDIA, REFS, TRELLO, refLabel, type Cat, type Deck, type Format, type Midia } from "@/lib/formats";
import { EXAMPLES } from "@/lib/formats-examples";
import PageHead from "@/components/PageHead";
import AccountSelect from "@/components/AccountSelect";
import Markdown from "@/components/Markdown";
import CopyButton from "@/components/CopyButton";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";

const KEY = "vh.formatos.feitos.v2";
const MIDIA_LABEL: Record<Midia, string> = { curto: "Curto", longo: "YouTube", carrossel: "Carrossel" };

export default function Formatos() {
  const { accounts } = useAccounts();
  const [cat, setCat] = useState<Cat | "">("");
  const [q, setQ] = useState("");
  const [deck, setDeck] = useState<Deck | "">("");
  const [midia, setMidia] = useState<Midia | "">("");
  const [sugFmt, setSugFmt] = useState("");
  const [sug, setSug] = useState({ topic: "", out: "" });
  const sugAI = useAI();
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
  function open(x: Format) { setSel(x); setOut(""); setSaved(false); setF((p) => ({ ...p, card2: "", format: x.fmt.includes(FORMAT_MIDIA[p.format]) ? p.format : DELIVERY_FORMATS.find((d) => x.fmt.includes(FORMAT_MIDIA[d]))! })); }
  function draw() { const base = list.length ? list : FORMATS; const pool = base.filter((x) => !done.includes(x.n)); const pick = pool.length ? pool : base; open(pick[Math.floor(Math.random() * pick.length)]); }

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

  async function suggest(e: React.FormEvent) {
    e.preventDefault();
    const r = await sugAI.run<{ text: string }>("format_suggest", { topic: sug.topic, account: accounts[0] });
    if (r) setSug({ ...sug, out: r.text });
  }

  const list = FORMATS.filter((x) => (!cat || x.cat === cat) && (!deck || x.deck === deck) && (!midia || x.fmt.includes(midia)) && (!q || `${x.name} ${x.essence} ${x.why} ${x.source || ""}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHead kicker="CREATOR · 02 CRIAÇÃO" title="Formatos criativos" desc={`${FORMATS.length} cartas de ideação, ganchos, copy, storytelling, formatos de vídeo, cinema e estratégia para fugir do mais do mesmo. Estude o porquê, aplique ao seu tema com a IA e combine cartas.`} />

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="flex justify-between text-xs mb-1.5"><span className="text-fog">Cartas que você já aplicou</span><span className="font-mono text-mint">{done.length}/{FORMATS.length}</span></div>
          <div className="h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-mint rounded-full transition-all" style={{ width: `${(done.length / FORMATS.length) * 100}%` }} /></div>
        </div>
        <button onClick={draw} className="btn btn-mint btn-sm"><I.spark className="w-4 h-4" />Sortear carta</button>
        <a href="/banco-criativo-vincit.pdf" target="_blank" className="btn btn-ghost btn-sm">Guia completo (PDF)</a>
      </div>

      <form onSubmit={suggest} className="card p-4 mb-5">
        <p className="font-display font-bold">Não sabe qual carta usar?</p>
        <p className="text-xs text-fog mb-3">Descreva o tema e a IA indica 3 combinações de cartas com a ideia de cada uma.</p>
        <div className="flex flex-col sm:flex-row gap-2"><select className="input sm:!w-48" value={sugFmt} onChange={(e) => setSugFmt(e.target.value)}><option value="">Qualquer formato</option>{DELIVERY_FORMATS.map((d) => <option key={d} value={d}>{d === "YouTube" ? "YouTube (longo)" : d}</option>)}</select><input required className="input" value={sug.topic} onChange={(e) => setSug({ ...sug, topic: e.target.value })} placeholder="Ex.: mostrar que vídeo institucional pode ser emocionante" /><button disabled={sugAI.busy} className="btn btn-mint btn-sm whitespace-nowrap"><I.spark className="w-4 h-4" />{sugAI.busy ? "Pensando…" : "Sugerir"}</button></div>
        {sugAI.error && <p className="text-danger text-sm mt-2">{sugAI.error}</p>}
        {sug.out && <div className="mt-4 border-t border-line pt-4"><Markdown text={sug.out} /></div>}
      </form>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-fog mr-1">Mídia</span>
        <button onClick={() => setMidia("")} className={`btn btn-sm ${!midia ? "btn-mint" : "btn-ghost"}`}>Todas</button>
        {(Object.keys(MIDIAS) as Midia[]).map((k) => <button key={k} onClick={() => setMidia(k)} className={`btn btn-sm ${midia === k ? "btn-mint" : "btn-ghost"}`} title={MIDIAS[k].d}>{MIDIAS[k].l}<span className="opacity-60">{FORMATS.filter((x) => x.fmt.includes(k)).length}</span></button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-fog mr-1">Fonte</span>
        <button onClick={() => setDeck("")} className={`btn btn-sm ${!deck ? "btn-mint" : "btn-ghost"}`}>Todas as fontes</button>
        {(Object.keys(DECKS) as Deck[]).map((k) => <button key={k} onClick={() => setDeck(k)} className={`btn btn-sm ${deck === k ? "btn-mint" : "btn-ghost"}`}>{DECKS[k]}</button>)}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setCat("")} className={`btn btn-sm ${!cat ? "btn-mint" : "btn-ghost"}`}>Todas</button>
        {(Object.keys(CATS) as Cat[]).map((k) => <button key={k} onClick={() => setCat(k)} className={`btn btn-sm ${cat === k ? "btn-mint" : "btn-ghost"}`}><span className="w-2 h-2 rounded-full" style={{ background: CATS[k].c }} />{CATS[k].l}<span className="opacity-60">{FORMATS.filter((x) => x.cat === k && (!deck || x.deck === deck) && (!midia || x.fmt.includes(midia))).length}</span></button>)}
        <input className="input !py-1.5 !w-48 ml-auto" placeholder="Buscar carta…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {cat && <p className="text-sm text-fog mb-4">{CATS[cat].d}</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {list.map((x, i) => (
          <button key={x.id} onClick={() => open(x)} className="card p-4 text-left hover:border-slate transition-colors rise relative overflow-hidden" style={{ animationDelay: `${Math.min(i, 16) * 0.02}s` }}>
            <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: CATS[x.cat].c }} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-fog">CARTA {String(x.n).padStart(2, "0")}</span>
              {done.includes(x.n) ? <span className="text-mint text-xs">✓ feita</span> : <span className="text-[10px] text-fog">{x.deck === "hannah" ? "Hannah" : "VINCIT"}</span>}
            </div>
            <p className="font-display font-bold text-lg mt-2 leading-tight">{x.name}</p>
            <p className="text-sm text-fog mt-1.5 line-clamp-3">{x.essence}</p>
            <div className="flex items-center justify-between gap-2 mt-3">
              <p className="text-[10px] uppercase tracking-wide" style={{ color: CATS[x.cat].c }}>{CATS[x.cat].l}</p>
              <div className="flex gap-1">{x.fmt.map((m) => <span key={m} className="text-[9px] px-1.5 py-0.5 rounded border border-line text-fog">{MIDIA_LABEL[m]}</span>)}</div>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!sel} title={sel ? `Carta ${sel.n} · ${sel.name}` : ""} onClose={() => setSel(null)} wide>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip" style={{ color: CATS[sel.cat].c, borderColor: CATS[sel.cat].c + "55" }}>{CATS[sel.cat].l}</span>
              {sel.fmt.map((m) => <span key={m} className="chip" title={MIDIAS[m].d}>{MIDIAS[m].l}</span>)}
              {sel.source && <span className="text-xs text-fog">Fonte: {sel.source}</span>}
              <button onClick={() => toggleDone(sel.n)} className={`btn btn-sm ${done.includes(sel.n) ? "btn-mint" : "btn-ghost"}`}>{done.includes(sel.n) ? "✓ Já apliquei" : "Marcar como aplicada"}</button>
            </div>
            <p className="font-display text-xl leading-snug">{sel.essence}</p>
            <div className="grid md:grid-cols-2 gap-5 text-sm">
              <div><p className="label text-mint">Por que funciona</p><p className="leading-relaxed">{sel.why}</p></div>
              <div><p className="label text-mint">Como aplicar</p><ul className="list-disc ml-5 space-y-1.5">{sel.how.map((h, i) => <li key={i}>{h}</li>)}</ul></div>
            </div>
            {EXAMPLES[sel.id] && <div className="bg-panel2 rounded-xl p-4">
              <p className="label text-mint">Exemplo de roteiro</p>
              <ol className="space-y-2 mt-2">{EXAMPLES[sel.id].map(([st, tx], i) => <li key={i} className="grid grid-cols-[22px_1fr] gap-2 text-sm"><span className="font-mono text-[11px] text-mint pt-0.5">{String(i + 1).padStart(2, "0")}</span><span><b className="font-semibold">{st}</b><span className="text-fog"> — </span>{tx}</span></li>)}</ol>
            </div>}
            {!!sel.combo?.length && <div><p className="label">Combina com</p><div className="flex flex-wrap gap-1.5">{sel.combo.map((n) => { const c = FORMATS.find((x) => x.n === n)!; return <button key={n} onClick={() => open(c)} className="chip hover:text-mint">{n}. {c.name}</button>; })}</div></div>}

            <div><p className="label">Referências</p><div className="flex flex-wrap gap-1.5">
              {(REFS[sel.n] || []).map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="chip hover:text-mint"><I.link className="w-3 h-3" />{refLabel(u)} {i + 1}</a>)}
              {!REFS[sel.n] && !TRELLO[sel.n] && <span className="text-xs text-fog">Busque exemplos: <a className="text-mint hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(sel.name)}`}>Instagram</a> · <a className="text-mint hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(sel.name + " exemplo")}`}>YouTube</a></span>}
              {TRELLO[sel.n] && <a href={TRELLO[sel.n]} target="_blank" rel="noopener noreferrer" className="chip hover:text-mint"><I.link className="w-3 h-3" />Carta original no Trello</a>}
            </div></div>
            <form onSubmit={apply} className="bg-panel2 rounded-xl p-4 grid md:grid-cols-2 gap-3">
              <p className="md:col-span-2 font-display font-bold">Aplicar ao meu tema</p>
              <div className="md:col-span-2"><label className="label">Tema</label><input required className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Ex.: por que vídeo institucional não precisa ser chato" /></div>
              <div><label className="label">Formato</label><select className="input" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>{DELIVERY_FORMATS.filter((d) => sel.fmt.includes(FORMAT_MIDIA[d])).map((x) => <option key={x} value={x}>{x === "YouTube" ? "YouTube (vídeo longo)" : x}</option>)}</select></div>
              <div><label className="label">Combinar com (opcional)</label><select className="input" value={f.card2} onChange={(e) => setF({ ...f, card2: e.target.value })}><option value="">Só esta carta</option>{FORMATS.filter((x) => x.id !== sel.id).sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.n}. {x.name}</option>)}</select></div>
              <div><label className="label">Objetivo</label><select className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>{["Alcance e conexão", "Autoridade", "Gerar leads", "Venda", "Comunidade"].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="label">Perfil</label><AccountSelect accounts={accounts} value={f.accountId} onChange={(v) => setF({ ...f, accountId: v })} /></div>
              <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                <Link href={`/creator/laboratorio?tab=criar&carta=${sel.id}&format=${encodeURIComponent(f.format)}`} className="btn btn-ghost btn-sm">Abrir no Laboratório</Link>
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
