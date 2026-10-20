"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROPOSAL_STATUS, brl, calcProposal, calcService, type Item } from "@/lib/agency";
import { useAI } from "@/lib/useAI";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";
import { A } from "@/components/agency/icons";

const UNITS = ["diária", "hora", "unidade", "vídeo", "mês", "pacote"];

export default function Proposta() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [saved, setSaved] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [brief, setBrief] = useState("");
  const ai = useAI();

  useEffect(() => {
    setOrigin(location.origin);
    const s = createClient();
    Promise.all([
      s.from("ag_proposals").select("*").eq("id", id).single(),
      s.from("ag_clients").select("id,name,company,segment").order("name"),
      s.from("ag_price_items").select("*").order("category").order("name"),
      s.from("ag_services").select("*").eq("active", true).order("position"),
    ]).then(([a, b, c, d]) => { setP(a.data); setClients(b.data || []); setPrices(c.data || []); setServices(d.data || []); });
  }, [id]);

  const items: Item[] = p?.items || [];
  const calc = useMemo(() => calcProposal(items, p?.margin, p?.tax, p?.discount), [p]);
  const upd = (v: any) => { setP({ ...p, ...v }); setSaved(false); };
  const setItem = (i: number, v: Partial<Item>) => upd({ items: items.map((x, j) => (j === i ? { ...x, ...v } : x)) });
  function addService(id: string) {
    const sv = services.find((x) => x.id === id); if (!sv) return;
    const c = calcService(sv.items || [], sv.margin, sv.tax, sv.fixed_price);
    const add = (cur: string | null, txt: string | null) => (txt ? (cur ? `${cur}\n\n${txt}` : txt) : cur);
    upd({
      items: [...items, { name: sv.name, unit: "pacote", qty: 1, days: 1, price: Math.round(c.price * 100) / 100, cost: Math.round(c.cost * 100) / 100, final: true, tax: Number(sv.tax) || 0, service_id: sv.id }],
      title: p.title && p.title !== "Nova proposta" ? p.title : sv.name,
      scope: add(p.scope, sv.description ? `${sv.name}: ${sv.description}` : null),
      deliverables: add(p.deliverables, sv.deliverables),
      timeline: p.timeline || (sv.deadline_days ? `Entrega em até ${sv.deadline_days} dias após a aprovação e o recebimento dos materiais.` : p.timeline),
    });
  }

  async function save(extra: any = {}) {
    const row = { ...p, ...extra, total: Math.round(calc.total * 100) / 100 };
    const { id: _id, owner_id, public_token, created_at, ...rest } = row;
    if (rest.client_id === "") rest.client_id = null;
    const { error } = await createClient().from("ag_proposals").update(rest).eq("id", id);
    if (error) setMsg(error.message); else { setP(row); setSaved(true); }
    return !error;
  }
  async function send() { if (await save({ status: p.status === "rascunho" ? "enviada" : p.status })) setMsg("Proposta pronta para enviar. Copie o link abaixo."); }
  async function writeAI() {
    const client = clients.find((c) => c.id === p.client_id);
    const r = await ai.run<any>("proposal_text", { title: p.title, client, brief, items: items.map((x) => `${x.qty}x ${x.name} (${x.days || 1} ${x.unit || ""})`).join("; "), total: brl(calc.total) });
    if (r) upd({ intro: r.intro ?? p.intro, scope: r.scope ?? p.scope, deliverables: r.deliverables ?? p.deliverables, timeline: r.timeline ?? p.timeline, payment_terms: r.payment_terms ?? p.payment_terms });
  }
  async function toProject() {
    const s = createClient();
    const { data } = await s.from("ag_projects").insert({ title: p.title, client_id: p.client_id, proposal_id: p.id, value: p.total, description: [p.scope, p.deliverables].filter(Boolean).join("\n\n") }).select().single();
    if (data) {
      if (p.deal_id) await s.from("ag_deals").update({ stage: "ganho" }).eq("id", p.deal_id);
      router.push(`/projetos/${data.id}`);
    }
  }
  async function del() { if (!confirm("Excluir proposta?")) return; await createClient().from("ag_proposals").delete().eq("id", id); router.push("/agency/propostas"); }

  if (!p) return <p className="text-fog">Carregando…</p>;
  const link = `${origin}/p/${p.public_token}`;
  const ta = (k: string, label: string, ph: string, rows = 4) => (
    <div><label className="label">{label}</label><textarea className="input" rows={rows} value={p[k] || ""} placeholder={ph} onChange={(e) => upd({ [k]: e.target.value })} /></div>
  );

  return (
    <>
      <Link href="/agency/propostas" className="inline-flex items-center gap-2 text-sm text-fog hover:text-paper mb-6"><I.back className="w-4 h-4" />Propostas</Link>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <input className="bg-transparent font-display text-3xl md:text-4xl font-extrabold tracking-tight outline-none border-b border-transparent focus:border-mint w-full" value={p.title} onChange={(e) => upd({ title: e.target.value })} />
        <div className="flex gap-2 shrink-0 items-center">
          {p?.status === "aceita" && <Link href={`/agency/financeiro?tab=cobrancas&proposta=${p.id}`} className="btn btn-ghost btn-sm">Gerar cobrança</Link>}
          <span className={`chip ${p.status === "aceita" ? "chip-mint" : ""}`}>{PROPOSAL_STATUS[p.status]}</span>
          <button className="btn btn-ghost" onClick={() => save()} disabled={saved}>{saved ? "Salvo" : "Salvar"}</button>
          <button className="btn btn-mint" onClick={send}><A.ext className="w-4 h-4" />Gerar link</button>
        </div>
      </div>
      {msg && <div className="card px-4 py-3 mb-4 text-sm text-mint border-mint-dim flex justify-between">{msg}<button onClick={() => setMsg(null)} className="text-fog">×</button></div>}
      {p.status !== "rascunho" && (
        <div className="card p-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-xs text-fog mb-1">Link da proposta para o cliente</p><code className="text-xs text-mint break-all">{link}</code>
            {p.accepted_at && <p className="text-sm text-mint mt-2">Aceita por {p.accepted_name} em {new Date(p.accepted_at).toLocaleString("pt-BR")}</p>}
            {!p.accepted_at && p.viewed_at && <p className="text-xs text-fog mt-2">Visualizada em {new Date(p.viewed_at).toLocaleString("pt-BR")}</p>}</div>
          <div className="flex gap-2 shrink-0"><CopyButton text={link} label="Copiar" /><a href={link} target="_blank" className="btn btn-ghost btn-sm">Ver como cliente</a>{p.status === "aceita" && <button onClick={toProject} className="btn btn-mint btn-sm">Criar projeto</button>}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="card p-5">
            <div className="grid md:grid-cols-2 gap-4 mb-1">
              <div><label className="label">Cliente</label><select className="input" value={p.client_id || ""} onChange={(e) => upd({ client_id: e.target.value })}><option value="">–</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}</select></div>
              <div><label className="label">Validade (dias)</label><input type="number" className="input" value={p.validity_days ?? 15} onChange={(e) => upd({ validity_days: Number(e.target.value) })} /></div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4"><h2 className="font-display font-bold text-lg mr-auto">Calculadora de orçamento</h2>
              <select className="input !w-auto border-mint-dim" value="" onChange={(e) => addService(e.target.value)}>
                <option value="">+ Serviço do catálogo</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name} · {brl(calcService(x.items || [], x.margin, x.tax, x.fixed_price).price)}</option>)}
              </select>
              <select className="input !w-auto" value="" onChange={(e) => { const pr = prices.find((x) => x.id === e.target.value); if (pr) upd({ items: [...items, { name: pr.name, category: pr.category, unit: pr.unit, qty: 1, days: 1, price: Number(pr.price), cost: Number(pr.cost || 0) }] }); }}>
                <option value="">+ Insumo</option>{prices.map((x) => <option key={x.id} value={x.id}>{x.category} · {x.name} ({brl(x.price)}/{x.unit})</option>)}
              </select></div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm min-w-[620px]">
                <thead><tr className="text-left text-fog text-xs">{["Item", "Unid.", "Qtd", "Diárias", "Preço un.", "Subtotal", ""].map((h) => <th key={h} className="pb-2 pr-2 font-normal">{h}</th>)}</tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="align-top">
                      <td className="pr-2 pb-2"><input className="input !py-2" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />{it.final && <p className="text-[10px] text-mint mt-0.5">Serviço do catálogo · preço final (sem margem/imposto extra)</p>}</td>
                      <td className="pr-2 pb-2 w-24"><select className="input !py-2" value={it.unit || "unidade"} onChange={(e) => setItem(i, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></td>
                      <td className="pr-2 pb-2 w-16"><input type="number" className="input !py-2" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} /></td>
                      <td className="pr-2 pb-2 w-16"><input type="number" className="input !py-2" value={it.days ?? 1} onChange={(e) => setItem(i, { days: Number(e.target.value) })} /></td>
                      <td className="pr-2 pb-2 w-28"><input type="number" step="0.01" className="input !py-2" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) })} /></td>
                      <td className="pr-2 pb-2 pt-2.5 font-mono text-xs whitespace-nowrap">{brl((it.qty || 0) * (it.days || 1) * (it.price || 0))}</td>
                      <td className="pb-2 pt-2"><button onClick={() => upd({ items: items.filter((_, j) => j !== i) })} className="text-fog hover:text-danger"><I.trash className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-ghost btn-sm mt-1" onClick={() => upd({ items: [...items, { name: "", unit: "diária", qty: 1, days: 1, price: 0 }] })}><I.plus className="w-3.5 h-3.5" />Item avulso</button>
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div><label className="label">Margem (%)</label><input type="number" className="input" value={p.margin ?? 0} onChange={(e) => upd({ margin: Number(e.target.value) })} /></div>
              <div><label className="label">Impostos (%)</label><input type="number" className="input" value={p.tax ?? 0} onChange={(e) => upd({ tax: Number(e.target.value) })} /></div>
              <div><label className="label">Desconto (R$)</label><input type="number" step="0.01" className="input" value={p.discount ?? 0} onChange={(e) => upd({ discount: Number(e.target.value) })} /></div>
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-end bg-panel2 rounded-xl p-4">
              <div className="flex-1"><label className="label">Contexto para a IA (opcional)</label><input className="input" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ex.: vídeo de 2 min para lançamento, tom sofisticado, entrega em 20 dias" /></div>
              <button onClick={writeAI} disabled={ai.busy} className="btn btn-ghost"><I.spark className="w-4 h-4" />{ai.busy ? "Escrevendo…" : "Escrever textos com IA"}</button>
            </div>
            {ai.error && <p className="text-danger text-sm">{ai.error}</p>}
            {ta("intro", "Apresentação", "Uma abertura pessoal para o cliente…", 3)}
            {ta("scope", "Escopo do projeto", "O que será feito…")}
            {ta("deliverables", "Entregáveis", "1 vídeo de até 2 min em 4K; 3 cortes verticais para Reels…")}
            {ta("timeline", "Cronograma", "Pré-produção: 5 dias · Captação: 1 diária · Edição: 10 dias…", 3)}
            {ta("payment_terms", "Pagamento", "50% na aprovação, 50% na entrega. PIX ou boleto.", 3)}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5 lg:sticky lg:top-6">
            <h2 className="font-display font-bold text-lg mb-4">Resumo</h2>
            <dl className="space-y-2 text-sm">
              {[["Custo de itens (tabela)", calc.base], [`Margem (${p.margin || 0}%)`, calc.marginValue], [`Impostos (${p.tax || 0}%)`, calc.taxValue], ["Desconto", -(Number(p.discount) || 0)]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between"><dt className="text-fog">{k}</dt><dd className="font-mono">{brl(v)}</dd></div>
              ))}
            </dl>
            <div className="border-t border-line mt-4 pt-4"><p className="text-xs text-fog">Total para o cliente</p><p className="font-display text-4xl font-extrabold text-mint tabular-nums">{brl(calc.total)}</p></div>
            {calc.cost > 0 && <p className="text-xs text-fog mt-3">Custo interno estimado {brl(calc.cost)} · lucro estimado <span className="text-paper">{brl(calc.profit)}</span></p>}
            <div className="flex gap-2 mt-5"><button onClick={() => save()} className="btn btn-mint flex-1" disabled={saved}>{saved ? "Tudo salvo" : "Salvar"}</button><button onClick={del} className="btn btn-ghost"><I.trash className="w-4 h-4" /></button></div>
            {p.status !== "aceita" && p.status !== "rascunho" && <button onClick={() => save({ status: "recusada" })} className="text-xs text-fog hover:text-danger mt-3">Marcar como recusada</button>}
          </section>
        </aside>
      </div>
    </>
  );
}
