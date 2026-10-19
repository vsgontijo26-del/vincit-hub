"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl, brlShort } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";
import { A } from "@/components/agency/icons";
import { useFinance, ACCOUNT_KINDS, todayBR } from "@/components/finance/useFinance";
import TxForm from "@/components/finance/TxForm";
import Charges from "@/components/finance/Charges";

const TABS = [["geral", "Visão geral"], ["lancamentos", "Lançamentos"], ["contas", "Contas & cartões"], ["categorias", "Categorias & orçamento"], ["cobrancas", "Cobranças"]] as const;
type Tab = (typeof TABS)[number][0];
const PALETTE = ["#6eefb6", "#7aa7ff", "#f5c84c", "#ff6b6b", "#c084fc", "#fb923c", "#22d3ee", "#a3e635", "#f472b6", "#8a8f94"];
const monthLabel = (m: string) => new Date(m + "-15T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const fmtDay = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

export default function Financeiro() {
  const fin = useFinance();
  const [tab, setTab] = useState<Tab>("geral");
  const [month, setMonth] = useState(todayBR().slice(0, 7));
  const [form, setForm] = useState<any>(null);
  const [fType, setFType] = useState("todos");
  const [fAcc, setFAcc] = useState("");
  const [fCat, setFCat] = useState("");
  const [q, setQ] = useState("");
  const [accForm, setAccForm] = useState<any>(null);
  const [catNew, setCatNew] = useState<any>({ name: "", kind: "saida", color: PALETTE[0] });
  const [chargePrefill, setChargePrefill] = useState<any>(null);
  const td = todayBR();

  useEffect(() => {
    const q2 = new URLSearchParams(location.search);
    const t = q2.get("tab") as Tab; if (TABS.some(([k]) => k === t)) setTab(t);
    const prop = q2.get("proposta");
    if (prop) createClient().from("ag_proposals").select("id,title,total,client_id").eq("id", prop).single().then(({ data }) => { if (data) { setTab("cobrancas"); setChargePrefill({ description: data.title, amount: String(data.total || ""), client_id: data.client_id || "", proposal_id: data.id }); } });
  }, []);
  const go = (t: Tab) => { setTab(t); const u = new URL(location.href); u.searchParams.set("tab", t); history.replaceState(null, "", u); };
  const shift = (n: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 15); setMonth(d.toISOString().slice(0, 7)); };

  const real = fin.tx.filter((t) => !t.transfer_id); // relatórios ignoram transferências
  const inMonth = real.filter((t) => t.due_date?.startsWith(month));
  const sum = (xs: any[]) => xs.reduce((a, x) => a + Number(x.amount), 0);
  const k = {
    receitas: sum(inMonth.filter((x) => x.kind === "entrada")), recebido: sum(inMonth.filter((x) => x.kind === "entrada" && x.paid)),
    despesas: sum(inMonth.filter((x) => x.kind === "saida")), pago: sum(inMonth.filter((x) => x.kind === "saida" && x.paid)),
  };
  const saldo = fin.accounts.filter((a) => a.kind !== "cartao" && !a.archived).reduce((a, x) => a + fin.balanceOf(x), 0);
  const overdue = real.filter((x) => !x.paid && x.due_date < td);
  const in7 = new Date(Date.now() + 7 * 864e5 - 3 * 3600e3).toISOString().slice(0, 10);
  const upcoming = real.filter((x) => !x.paid && x.due_date >= td && x.due_date <= in7);
  const months6 = Array.from({ length: 6 }, (_, i) => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 6 + i, 15).toISOString().slice(0, 7); });
  const series = months6.map((m) => ({ m, in: sum(real.filter((x) => x.kind === "entrada" && x.due_date?.startsWith(m))), out: sum(real.filter((x) => x.kind === "saida" && x.due_date?.startsWith(m))) }));
  const sMax = Math.max(1, ...series.flatMap((s) => [s.in, s.out]));
  const byCat = (kind: string) => { const o: Record<string, number> = {}; inMonth.filter((x) => x.kind === kind).forEach((x) => { o[x.category || "Sem categoria"] = (o[x.category || "Sem categoria"] || 0) + Number(x.amount); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const catColor = (name: string) => fin.categories.find((c) => c.name === name)?.color || "#8a8f94";
  const budgets = fin.categories.filter((c) => c.kind === "saida" && Number(c.budget) > 0).map((c) => ({ ...c, spent: sum(inMonth.filter((x) => x.kind === "saida" && x.category === c.name)) }));

  const list = useMemo(() => inMonth.concat(fin.tx.filter((t) => t.transfer_id && t.due_date?.startsWith(month)))
    .filter((x) => (fType === "todos" || (fType === "entradas" ? x.kind === "entrada" && !x.transfer_id : fType === "saidas" ? x.kind === "saida" && !x.transfer_id : fType === "pendentes" ? !x.paid : fType === "transferencias" ? !!x.transfer_id : true))
      && (!fAcc || x.account_id === fAcc) && (!fCat || x.category === fCat) && (!q || `${x.description} ${x.ag_clients?.name || ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.due_date.localeCompare(b.due_date)), [inMonth, fin.tx, month, fType, fAcc, fCat, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const days: string[] = Array.from(new Set<string>(list.map((x) => x.due_date)));

  async function togglePaid(x: any) {
    await createClient().from("ag_transactions").update({ paid: !x.paid, paid_at: !x.paid ? td : null }).eq("id", x.id);
    fin.reload();
  }
  async function saveAcc(e: React.FormEvent) {
    e.preventDefault();
    const { id, created_at, owner_id, ...row } = accForm;
    const data = { ...row, opening_balance: Number(row.opening_balance) || 0, credit_limit: row.kind === "cartao" ? Number(row.credit_limit) || null : null, closing_day: row.kind === "cartao" ? Number(row.closing_day) || 1 : null, due_day: row.kind === "cartao" ? Number(row.due_day) || 10 : null };
    const s = createClient();
    id ? await s.from("fin_accounts").update(data).eq("id", id) : await s.from("fin_accounts").insert(data);
    setAccForm(null); fin.reload();
  }
  async function payInvoice(a: any, due: string) {
    const items = fin.tx.filter((t) => t.account_id === a.id && t.kind === "saida" && !t.paid && t.due_date === due);
    await createClient().from("ag_transactions").update({ paid: true, paid_at: td }).in("id", items.map((x) => x.id));
    fin.reload();
  }
  async function addCat(e: React.FormEvent) { e.preventDefault(); if (!catNew.name.trim()) return; await createClient().from("fin_categories").insert({ ...catNew, name: catNew.name.trim() }); setCatNew({ ...catNew, name: "" }); fin.reload(); }
  async function updCat(c: any, v: any) { await createClient().from("fin_categories").update(v).eq("id", c.id); fin.reload(); }
  async function delCat(c: any) { if (!confirm(`Excluir a categoria ${c.name}? Os lançamentos mantêm o nome.`)) return; await createClient().from("fin_categories").delete().eq("id", c.id); fin.reload(); }

  const MonthNav = () => (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)} className="btn btn-ghost btn-sm"><A.chevL className="w-4 h-4" /></button>
      <p className="font-display font-bold capitalize w-44 text-center">{monthLabel(month)}</p>
      <button onClick={() => shift(1)} className="btn btn-ghost btn-sm"><A.chevR className="w-4 h-4" /></button>
    </div>
  );

  return (
    <>
      <PageHead kicker="GESTOR · 02 COMERCIAL" title="Financeiro" desc="Contas, cartões, categorias com orçamento, lançamentos recorrentes e parcelados, relatórios e cobranças com Pix para o cliente.">
        <button className="btn btn-ghost" onClick={() => setForm({ kind: "saida", due_date: td, account_id: fin.accounts[0]?.id })}>− Despesa</button>
        <button className="btn btn-mint" onClick={() => setForm({ kind: "entrada", due_date: td, account_id: fin.accounts[0]?.id })}><I.plus className="w-4 h-4" />Receita</button>
      </PageHead>
      <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">{TABS.map(([k2, l]) => <button key={k2} onClick={() => go(k2)} className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k2 ? "border-mint text-mint" : "border-transparent text-fog hover:text-paper"}`}>{l}</button>)}</div>

      {tab === "geral" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><MonthNav />{!!overdue.length && <button onClick={() => { go("lancamentos"); setFType("pendentes"); }} className="chip text-danger border-danger/40">{overdue.length} lançamento(s) atrasado(s) · {brl(sum(overdue))}</button>}</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4"><p className="text-xs text-fog">Saldo em contas</p><p className={`font-display text-2xl font-bold mt-1 ${saldo < 0 ? "text-danger" : ""}`}>{brl(saldo)}</p></div>
            <div className="card p-4"><p className="text-xs text-fog">Receitas do mês</p><p className="font-display text-2xl font-bold mt-1 text-mint">{brl(k.receitas)}</p><p className="text-[11px] text-fog mt-1">{brl(k.recebido)} recebido</p></div>
            <div className="card p-4"><p className="text-xs text-fog">Despesas do mês</p><p className="font-display text-2xl font-bold mt-1 text-danger">{brl(k.despesas)}</p><p className="text-[11px] text-fog mt-1">{brl(k.pago)} pago</p></div>
            <div className="card p-4"><p className="text-xs text-fog">Resultado previsto</p><p className={`font-display text-2xl font-bold mt-1 ${k.receitas - k.despesas < 0 ? "text-danger" : ""}`}>{brl(k.receitas - k.despesas)}</p><p className="text-[11px] text-fog mt-1">{k.receitas ? `margem ${(((k.receitas - k.despesas) / k.receitas) * 100).toFixed(0)}%` : "–"}</p></div>
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            <section className="card p-5 lg:col-span-2">
              <p className="font-display font-bold mb-4">Receitas × despesas · 6 meses</p>
              <div className="flex items-end gap-3 h-44">{series.map((s) => (
                <div key={s.m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-1 h-36 w-full justify-center">
                    <div title={brl(s.in)} className="w-1/3 max-w-5 rounded-t bg-mint" style={{ height: `${(s.in / sMax) * 100}%` }} />
                    <div title={brl(s.out)} className="w-1/3 max-w-5 rounded-t bg-danger/80" style={{ height: `${(s.out / sMax) * 100}%` }} />
                  </div>
                  <p className={`text-[10px] capitalize ${s.m === month ? "text-mint" : "text-fog"}`}>{new Date(s.m + "-15").toLocaleDateString("pt-BR", { month: "short" })}</p>
                  <p className={`text-[10px] font-mono ${s.in - s.out < 0 ? "text-danger" : "text-fog"}`}>{brlShort(s.in - s.out)}</p>
                </div>
              ))}</div>
            </section>
            <section className="card p-5">
              <p className="font-display font-bold mb-3">Próximos 7 dias</p>
              {!upcoming.length ? <p className="text-sm text-fog">Nada a pagar ou receber.</p> : <ul className="space-y-2">{upcoming.slice(0, 8).map((x) => <li key={x.id} className="flex items-center gap-2 text-sm"><span className="text-[11px] text-fog w-14">{fmtDay(x.due_date).split(",")[0]}</span><span className="truncate flex-1">{x.description}</span><span className={`font-mono text-xs ${x.kind === "saida" ? "text-danger" : "text-mint"}`}>{x.kind === "saida" ? "−" : "+"}{brlShort(Number(x.amount))}</span></li>)}</ul>}
            </section>
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            {(["saida", "entrada"] as const).map((kind) => (
              <section key={kind} className="card p-5">
                <p className="font-display font-bold mb-3">{kind === "saida" ? "Despesas" : "Receitas"} por categoria</p>
                {!byCat(kind).length ? <p className="text-sm text-fog">Sem lançamentos no mês.</p> : (() => { const rows = byCat(kind); const tot = rows.reduce((a, [, v]) => a + v, 0); return (
                  <>
                    <div className="flex h-3 rounded-full overflow-hidden mb-3">{rows.map(([c, v]) => <div key={c} style={{ width: `${(v / tot) * 100}%`, background: catColor(c) }} title={c} />)}</div>
                    <ul className="space-y-1.5">{rows.map(([c, v]) => <li key={c} className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full" style={{ background: catColor(c) }} /><span className="flex-1 truncate">{c}</span><span className="text-[11px] text-fog">{((v / tot) * 100).toFixed(0)}%</span><span className="font-mono text-xs w-20 text-right">{brlShort(v)}</span></li>)}</ul>
                  </>
                ); })()}
              </section>
            ))}
            <section className="card p-5">
              <div className="flex justify-between items-center mb-3"><p className="font-display font-bold">Orçamento do mês</p><button onClick={() => go("categorias")} className="text-xs text-fog hover:text-mint">Definir</button></div>
              {!budgets.length ? <p className="text-sm text-fog">Defina limites por categoria para receber alertas quando estiver perto de estourar.</p> : <ul className="space-y-3">{budgets.map((b) => { const p = (b.spent / Number(b.budget)) * 100; return (
                <li key={b.id}><div className="flex justify-between text-sm mb-1"><span>{b.name}</span><span className={`font-mono text-xs ${p > 100 ? "text-danger" : p > 80 ? "text-[#f5c84c]" : "text-fog"}`}>{brlShort(b.spent)} / {brlShort(Number(b.budget))}</span></div><div className="h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: p > 100 ? "#ff6b6b" : p > 80 ? "#f5c84c" : "#6eefb6" }} /></div></li>
              ); })}</ul>}
            </section>
          </div>
        </div>
      )}

      {tab === "lancamentos" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <MonthNav />
            <input className="input !py-1.5 !w-44" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input !py-1.5 !w-auto" value={fAcc} onChange={(e) => setFAcc(e.target.value)}><option value="">Todas as contas</option>{fin.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select className="input !py-1.5 !w-auto" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="">Todas as categorias</option>{fin.categories.map((c) => <option key={c.id}>{c.name}</option>)}</select>
            <button onClick={() => setForm({ kind: "transferencia", due_date: td })} className="btn btn-ghost btn-sm ml-auto">⇄ Transferência</button>
          </div>
          <div className="flex gap-1 mb-4 overflow-x-auto">{[["todos", "Todos"], ["entradas", "Receitas"], ["saidas", "Despesas"], ["pendentes", "Pendentes"], ["transferencias", "Transferências"]].map(([k2, l]) => <button key={k2} onClick={() => setFType(k2)} className={`btn btn-sm ${fType === k2 ? "btn-mint" : "btn-ghost"}`}>{l}</button>)}</div>
          <div className="card overflow-hidden">
            {days.map((d) => (
              <div key={d}>
                <p className={`px-4 py-2 text-[11px] uppercase tracking-wide bg-panel2/60 ${d < td ? "text-fog" : d === td ? "text-mint" : "text-fog"}`}>{fmtDay(d)}</p>
                <ul className="divide-y divide-line/60">{list.filter((x) => x.due_date === d).map((x) => { const late = !x.paid && x.due_date < td; const acc = fin.accounts.find((a) => a.id === x.account_id); return (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2/40">
                    <span className="w-8 h-8 rounded-full grid place-items-center text-xs shrink-0" style={{ background: (x.transfer_id ? "#8a8f94" : catColor(x.category)) + "22", color: x.transfer_id ? "#8a8f94" : catColor(x.category) }}>{x.transfer_id ? "⇄" : (x.category || "?")[0]}</span>
                    <button onClick={() => setForm({ ...x })} className="flex-1 min-w-0 text-left"><p className="text-sm truncate">{x.description}</p><p className="text-[11px] text-fog truncate">{[x.category, acc?.name, x.ag_clients?.name].filter(Boolean).join(" · ")}{x.recurrence_group && !x.installment ? " · fixa" : ""}</p></button>
                    <span className={`font-mono text-sm ${x.transfer_id ? "text-fog" : x.kind === "saida" ? "text-danger" : "text-mint"}`}>{x.transfer_id ? "" : x.kind === "saida" ? "−" : "+"}{brl(Number(x.amount))}</span>
                    {!x.transfer_id && <button onClick={() => togglePaid(x)} title={x.paid ? "Desfazer" : x.kind === "saida" ? "Marcar como pago" : "Marcar como recebido"} className={`text-[11px] px-2 py-1 rounded-md border whitespace-nowrap ${x.paid ? "border-mint/40 text-mint" : late ? "border-danger/50 text-danger" : "border-line text-fog hover:text-paper"}`}>{x.paid ? (x.kind === "saida" ? "Pago" : "Recebido") : late ? "Atrasado" : "Pendente"}</button>}
                  </li>
                ); })}</ul>
              </div>
            ))}
            {!days.length && <p className="text-fog text-sm text-center py-10">Nenhum lançamento.</p>}
          </div>
          {!!list.length && <p className="text-xs text-fog mt-3 text-right">Receitas {brl(sum(list.filter((x) => x.kind === "entrada" && !x.transfer_id)))} · Despesas {brl(sum(list.filter((x) => x.kind === "saida" && !x.transfer_id)))}</p>}
        </div>
      )}

      {tab === "contas" && (
        <div>
          <div className="flex justify-between items-center mb-4"><p className="text-sm text-fog">Saldo total em contas: <b className="text-paper">{brl(saldo)}</b></p><button onClick={() => setAccForm({ name: "", kind: "corrente", color: PALETTE[1], opening_balance: 0 })} className="btn btn-mint btn-sm"><I.plus className="w-4 h-4" />Nova conta ou cartão</button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fin.accounts.filter((a) => !a.archived).map((a) => {
              const bal = fin.balanceOf(a);
              const invoices = a.kind === "cartao" ? Array.from(new Set(fin.tx.filter((t) => t.account_id === a.id && t.kind === "saida" && !t.paid).map((t) => t.due_date))).sort() : [];
              return (
                <div key={a.id} className="card p-5" style={{ borderTop: `3px solid ${a.color}` }}>
                  <div className="flex justify-between items-start"><div><p className="font-semibold">{a.name}</p><p className="text-xs text-fog">{ACCOUNT_KINDS[a.kind]}</p></div><button onClick={() => setAccForm({ ...a })} className="text-xs text-fog hover:text-mint">Editar</button></div>
                  {a.kind === "cartao" ? (
                    <>
                      <p className="font-display text-2xl font-bold mt-3 text-danger">{brl(-bal)}</p>
                      <p className="text-[11px] text-fog">em aberto{a.credit_limit ? ` · limite disponível ${brl(Number(a.credit_limit) + bal)}` : ""} · fecha dia {a.closing_day}, vence dia {a.due_day}</p>
                      {a.credit_limit && <div className="h-1.5 bg-panel2 rounded-full overflow-hidden mt-2"><div className="h-full bg-danger/80" style={{ width: `${Math.min(100, (-bal / Number(a.credit_limit)) * 100)}%` }} /></div>}
                      {invoices.slice(0, 3).map((due) => { const v = sum(fin.tx.filter((t) => t.account_id === a.id && t.kind === "saida" && !t.paid && t.due_date === due)); return (
                        <div key={due} className="flex items-center gap-2 mt-3 text-sm bg-panel2 rounded-lg px-3 py-2"><span className="flex-1">Fatura {new Date(due + "T12:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })} · vence {new Date(due + "T12:00").toLocaleDateString("pt-BR")}</span><span className="font-mono text-xs">{brl(v)}</span><button onClick={() => payInvoice(a, due)} className="text-[11px] text-mint hover:underline">Pagar</button></div>
                      ); })}
                    </>
                  ) : <p className={`font-display text-2xl font-bold mt-3 ${bal < 0 ? "text-danger" : ""}`}>{brl(bal)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "categorias" && (
        <div className="grid lg:grid-cols-2 gap-5">
          {(["saida", "entrada"] as const).map((kind) => (
            <section key={kind} className="card p-5">
              <p className="font-display font-bold mb-1">{kind === "saida" ? "Categorias de despesa" : "Categorias de receita"}</p>
              {kind === "saida" && <p className="text-xs text-fog mb-3">Defina um orçamento mensal para acompanhar o limite na visão geral.</p>}
              <ul className="space-y-1.5 mt-3">
                {fin.categories.filter((c) => c.kind === kind).map((c) => { const spent = sum(inMonth.filter((x) => x.kind === kind && x.category === c.name)); return (
                  <li key={c.id} className="flex items-center gap-2 bg-panel2 rounded-lg px-3 py-2">
                    <input type="color" value={c.color} onChange={(e) => updCat(c, { color: e.target.value })} className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
                    <input className="flex-1 bg-transparent outline-none text-sm" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && updCat(c, { name: e.target.value.trim() })} />
                    <span className="text-[11px] text-fog font-mono">{brlShort(spent)}</span>
                    {kind === "saida" && <input type="number" className="input !py-1 !w-28 text-xs" placeholder="Orçamento" defaultValue={c.budget ?? ""} onBlur={(e) => updCat(c, { budget: e.target.value ? Number(e.target.value) : null })} />}
                    <button onClick={() => delCat(c)} className="text-fog hover:text-danger"><I.trash className="w-3.5 h-3.5" /></button>
                  </li>
                ); })}
              </ul>
              <form onSubmit={(e) => { setCatNew({ ...catNew, kind }); addCat(e); }} className="flex gap-2 mt-3"><input className="input !py-1.5" placeholder="Nova categoria" value={catNew.kind === kind ? catNew.name : ""} onFocus={() => setCatNew({ ...catNew, kind })} onChange={(e) => setCatNew({ ...catNew, kind, name: e.target.value })} /><button className="btn btn-mint btn-sm"><I.plus className="w-4 h-4" /></button></form>
            </section>
          ))}
        </div>
      )}

      {tab === "cobrancas" && <Charges fin={fin} prefill={chargePrefill} />}

      {form && <TxForm init={form} fin={fin} onClose={() => setForm(null)} />}

      <Modal open={!!accForm} title={accForm?.id ? "Editar conta" : "Nova conta ou cartão"} onClose={() => setAccForm(null)}>
        {accForm && <form onSubmit={saveAcc} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Nome</label><input required className="input" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} placeholder="Ex.: Inter PJ, Nubank PJ, Caixa" /></div>
            <div><label className="label">Tipo</label><select className="input" value={accForm.kind} onChange={(e) => setAccForm({ ...accForm, kind: e.target.value })}>{Object.entries(ACCOUNT_KINDS).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}</select></div>
            {accForm.kind === "cartao" ? <div><label className="label">Limite (R$)</label><input type="number" className="input" value={accForm.credit_limit ?? ""} onChange={(e) => setAccForm({ ...accForm, credit_limit: e.target.value })} /></div>
              : <div><label className="label">Saldo inicial (R$)</label><input type="number" step="0.01" className="input" value={accForm.opening_balance} onChange={(e) => setAccForm({ ...accForm, opening_balance: e.target.value })} /></div>}
            {accForm.kind === "cartao" && <><div><label className="label">Dia de fechamento</label><input type="number" min={1} max={28} className="input" value={accForm.closing_day ?? ""} onChange={(e) => setAccForm({ ...accForm, closing_day: e.target.value })} /></div><div><label className="label">Dia de vencimento</label><input type="number" min={1} max={28} className="input" value={accForm.due_day ?? ""} onChange={(e) => setAccForm({ ...accForm, due_day: e.target.value })} /></div></>}
            <div className="col-span-2"><label className="label">Cor</label><div className="flex gap-1.5 flex-wrap">{PALETTE.map((c) => <button type="button" key={c} onClick={() => setAccForm({ ...accForm, color: c })} className={`w-7 h-7 rounded-full border-2 ${accForm.color === c ? "border-paper" : "border-transparent"}`} style={{ background: c }} />)}</div></div>
          </div>
          <div className="flex justify-between pt-2">{accForm.id ? <button type="button" onClick={async () => { await createClient().from("fin_accounts").update({ archived: true }).eq("id", accForm.id); setAccForm(null); fin.reload(); }} className="btn btn-ghost btn-sm">Arquivar</button> : <span />}<button className="btn btn-mint">Salvar</button></div>
        </form>}
      </Modal>
    </>
  );
}
