"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl, calcService, type Item } from "@/lib/agency";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";

const CATS = ["Vídeo institucional", "Conteúdo mensal", "Evento", "Aulas / EAD", "Edição", "Comercial / anúncio", "Fotografia", "Outro"];
const UNITS = ["diária", "hora", "unidade", "vídeo", "mês", "pacote"];

export default function ServicesCatalog() {
  const [list, setList] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [defaults, setDefaults] = useState({ margin: 30, tax: 0 });
  const [ed, setEd] = useState<any>(null);
  const [cat, setCat] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: sv }, { data: pr }, { data: st }] = await Promise.all([
      s.from("ag_services").select("*").order("position").order("created_at"),
      s.from("ag_price_items").select("*").order("category").order("name"),
      s.from("ag_settings").select("default_margin,default_tax").maybeSingle(),
    ]);
    setList(sv || []); setPrices(pr || []);
    if (st) setDefaults({ margin: Number(st.default_margin) || 30, tax: Number(st.default_tax) || 0 });
  }, []);
  useEffect(() => { load(); }, [load]);

  const items: Item[] = ed?.items || [];
  const calc = ed ? calcService(items, ed.margin, ed.tax, ed.useFixed ? ed.fixed_price : null) : null;
  const setItem = (i: number, v: Partial<Item>) => setEd({ ...ed, items: items.map((x, j) => (j === i ? { ...x, ...v } : x)) });

  function openNew() { setErr(null); setEd({ name: "", category: CATS[0], description: "", deliverables: "", deadline_days: "", items: [], margin: defaults.margin, tax: defaults.tax, fixed_price: null, useFixed: false, active: true }); }
  function openEdit(s: any) { setErr(null); setEd({ ...s, useFixed: s.fixed_price != null }); }
  function dup(s: any) { setErr(null); const { id, created_at, ...rest } = s; setEd({ ...rest, name: `${s.name} (cópia)`, useFixed: s.fixed_price != null }); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!ed.name.trim()) return setErr("Dê um nome ao serviço.");
    if (!items.length && !ed.useFixed) return setErr("Adicione itens de custo ou defina um preço fixo.");
    const row = { name: ed.name.trim(), category: ed.category, description: ed.description || null, deliverables: ed.deliverables || null, deadline_days: Number(ed.deadline_days) || null, items, margin: Number(ed.margin) || 0, tax: Number(ed.tax) || 0, fixed_price: ed.useFixed ? Number(ed.fixed_price) || null : null, active: ed.active !== false, updated_at: new Date().toISOString() };
    const s = createClient();
    const { error } = ed.id ? await s.from("ag_services").update(row).eq("id", ed.id) : await s.from("ag_services").insert({ ...row, position: list.length });
    if (error) return setErr(error.message);
    setEd(null); load();
  }
  async function del() { if (!confirm(`Excluir o serviço "${ed.name}"?`)) return; await createClient().from("ag_services").delete().eq("id", ed.id); setEd(null); load(); }

  const shown = list.filter((s) => !cat || s.category === cat);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setCat("")} className={`btn btn-sm ${!cat ? "btn-mint" : "btn-ghost"}`}>Todos {list.length}</button>
        {CATS.filter((c) => list.some((s) => s.category === c)).map((c) => <button key={c} onClick={() => setCat(c)} className={`btn btn-sm ${cat === c ? "btn-mint" : "btn-ghost"}`}>{c}</button>)}
        <button onClick={openNew} className="btn btn-mint btn-sm ml-auto"><I.plus className="w-4 h-4" />Novo serviço</button>
      </div>

      {!list.length ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl font-bold">Cadastre seus serviços uma vez e monte propostas em segundos</p>
          <p className="text-fog text-sm mt-2 max-w-xl mx-auto">Cada serviço junta os custos (equipe, equipamento, edição…) da tabela de insumos, aplica sua margem e impostos e chega no preço final. Na proposta, é só escolher o serviço.</p>
          <button onClick={openNew} className="btn btn-mint mt-5"><I.plus className="w-4 h-4" />Criar primeiro serviço</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((s) => {
            const c = calcService(s.items || [], s.margin, s.tax, s.fixed_price);
            return (
              <div key={s.id} className={`card p-5 flex flex-col ${s.active ? "" : "opacity-50"}`}>
                <p className="text-[11px] uppercase tracking-wide text-fog">{s.category}</p>
                <button onClick={() => openEdit(s)} className="font-display font-bold text-lg text-left hover:text-mint mt-1">{s.name}</button>
                {s.description && <p className="text-sm text-fog mt-1 line-clamp-2">{s.description}</p>}
                <p className="font-display text-2xl font-bold mt-4">{brl(c.price)}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fog mt-1">
                  <span>custo {brl(c.cost)}</span>
                  <span className={c.profitPct >= 20 ? "text-mint" : c.profitPct > 0 ? "text-[#f5c84c]" : "text-danger"}>lucro {brl(c.profit)} ({c.profitPct.toFixed(0)}%)</span>
                  {s.deadline_days && <span>{s.deadline_days} dias</span>}
                </div>
                <div className="flex gap-2 mt-auto pt-4"><button onClick={() => openEdit(s)} className="btn btn-ghost btn-sm flex-1">Editar</button><button onClick={() => dup(s)} className="btn btn-ghost btn-sm" title="Duplicar"><I.copy className="w-4 h-4" /></button></div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!ed} title={ed?.id ? `Serviço · ${ed.name}` : "Novo serviço"} onClose={() => setEd(null)} wide>
        {ed && calc && (
          <form onSubmit={save} className="space-y-5">
            <div className="grid md:grid-cols-[1fr_200px_120px] gap-3">
              <div><label className="label">Nome do serviço</label><input className="input" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} placeholder="Ex.: Vídeo institucional 60s" /></div>
              <div><label className="label">Categoria</label><select className="input" value={ed.category || ""} onChange={(e) => setEd({ ...ed, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Prazo (dias)</label><input type="number" className="input" value={ed.deadline_days || ""} onChange={(e) => setEd({ ...ed, deadline_days: e.target.value })} /></div>
              <div className="md:col-span-3 grid md:grid-cols-2 gap-3">
                <div><label className="label">O que é / escopo (vai para a proposta)</label><textarea className="input min-h-[80px]" value={ed.description || ""} onChange={(e) => setEd({ ...ed, description: e.target.value })} placeholder="Roteiro, 1 diária de captação com 2 câmeras, edição com trilha licenciada…" /></div>
                <div><label className="label">Entregáveis</label><textarea className="input min-h-[80px]" value={ed.deliverables || ""} onChange={(e) => setEd({ ...ed, deliverables: e.target.value })} placeholder={"- 1 vídeo 60s em 4K\n- 3 cortes verticais\n- 2 rodadas de ajuste"} /></div>
              </div>
            </div>

            <div className="bg-panel2 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="font-display font-bold mr-auto">Composição de custos</p>
                <select className="input !w-auto !py-1.5 text-sm" value="" onChange={(e) => { const pr = prices.find((x) => x.id === e.target.value); if (pr) setEd({ ...ed, items: [...items, { name: pr.name, category: pr.category, unit: pr.unit, qty: 1, days: 1, price: Number(pr.price), cost: Number(pr.cost || 0) }] }); }}>
                  <option value="">+ Insumo da tabela</option>{prices.map((p) => <option key={p.id} value={p.id}>{p.name} · {brl(Number(p.price))}/{p.unit}</option>)}
                </select>
                <button type="button" onClick={() => setEd({ ...ed, items: [...items, { name: "", unit: "unidade", qty: 1, days: 1, price: 0, cost: 0 }] })} className="btn btn-ghost btn-sm">+ Item avulso</button>
              </div>
              {items.length ? (
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
                  <thead><tr className="text-left text-[11px] text-fog"><th className="font-normal pb-1">Item</th><th className="font-normal pb-1 w-16">Qtd</th><th className="font-normal pb-1 w-16">× Dias</th><th className="font-normal pb-1 w-24">Preço un.</th><th className="font-normal pb-1 w-24">Custo un.</th><th className="font-normal pb-1 w-24 text-right">Subtotal</th><th /></tr></thead>
                  <tbody>{items.map((it, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-1.5 pr-2"><input className="input !py-1 text-sm" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} /></td>
                      <td className="pr-2"><input type="number" className="input !py-1 text-sm" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} /></td>
                      <td className="pr-2"><input type="number" className="input !py-1 text-sm" value={it.days || 1} onChange={(e) => setItem(i, { days: Number(e.target.value) })} /></td>
                      <td className="pr-2"><input type="number" className="input !py-1 text-sm" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) })} /></td>
                      <td className="pr-2"><input type="number" className="input !py-1 text-sm" value={it.cost || 0} onChange={(e) => setItem(i, { cost: Number(e.target.value) })} /></td>
                      <td className="text-right font-mono text-xs">{brl((it.qty || 0) * (it.days || 1) * (it.price || 0))}</td>
                      <td className="pl-2"><button type="button" onClick={() => setEd({ ...ed, items: items.filter((_, j) => j !== i) })} className="text-fog hover:text-danger"><I.trash className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <p className="text-sm text-fog">Adicione os insumos que compõem o serviço (equipe, equipamentos, edição, deslocamento…). Ou defina um preço fixo abaixo.</p>}
              <p className="text-[11px] text-fog mt-2">Preço = quanto você cobra pelo insumo. Custo = quanto você paga (cachê, aluguel). Os insumos ficam na aba Insumos.</p>
            </div>

            <div className="grid md:grid-cols-[1fr_300px] gap-4">
              <div className="grid grid-cols-2 gap-3 content-start">
                <div><label className="label">Margem (%)</label><input type="number" className="input" value={ed.margin} onChange={(e) => setEd({ ...ed, margin: e.target.value })} /></div>
                <div><label className="label">Impostos (%)</label><input type="number" className="input" value={ed.tax} onChange={(e) => setEd({ ...ed, tax: e.target.value })} /></div>
                <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-[var(--color-mint)]" checked={!!ed.useFixed} onChange={(e) => setEd({ ...ed, useFixed: e.target.checked, fixed_price: e.target.checked ? Math.round(calc.suggested) : null })} />Usar preço fixo (arredondado ou de mercado)</label>
                {ed.useFixed && <div className="col-span-2"><label className="label">Preço fixo (R$)</label><input type="number" className="input" value={ed.fixed_price ?? ""} onChange={(e) => setEd({ ...ed, fixed_price: e.target.value })} /><p className="text-[11px] text-fog mt-1">Sugerido pela composição: {brl(calc.suggested)}</p></div>}
                <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-[var(--color-mint)]" checked={ed.active !== false} onChange={(e) => setEd({ ...ed, active: e.target.checked })} />Disponível nas propostas</label>
              </div>
              <div className="card p-4 space-y-1.5 text-sm">
                {[["Base dos insumos", calc.base], ["Custo real", calc.cost], ["Impostos", calc.taxValue]].map(([k, v]) => <div key={k as string} className="flex justify-between"><span className="text-fog">{k}</span><span className="font-mono">{brl(v as number)}</span></div>)}
                <div className="flex justify-between border-t border-line pt-2 mt-2"><span className="font-semibold">Preço final</span><span className="font-display font-bold text-xl text-mint">{brl(calc.price)}</span></div>
                <div className="flex justify-between"><span className="text-fog">Lucro</span><span className={`font-mono ${calc.profitPct >= 20 ? "text-mint" : calc.profitPct > 0 ? "text-[#f5c84c]" : "text-danger"}`}>{brl(calc.profit)} · {calc.profitPct.toFixed(0)}%</span></div>
                {calc.profitPct < 15 && <p className="text-[11px] text-[#f5c84c] pt-1">Lucro abaixo de 15%: revise margem, custos ou preço.</p>}
              </div>
            </div>

            {err && <p className="text-danger text-sm">{err}</p>}
            <div className="flex justify-between">{ed.id ? <button type="button" onClick={del} className="btn btn-ghost btn-sm"><I.trash className="w-4 h-4" /></button> : <span />}<button className="btn btn-mint">Salvar serviço</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
