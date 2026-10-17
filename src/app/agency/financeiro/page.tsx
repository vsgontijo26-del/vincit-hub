"use client";
import { useMemo, useState } from "react";
import { useTable } from "@/lib/useTable";
import { brl, dtShort, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";
import { A } from "@/components/agency/icons";

const CAT_IN = ["Projeto", "Mensalidade / recorrente", "Aluguel de equipamento", "Outro"];
const CAT_OUT = ["Equipe / freelancer", "Equipamento", "Aluguel / estrutura", "Software", "Marketing", "Transporte", "Impostos", "Pró-labore", "Custo de projeto", "Outro"];

export default function Financeiro() {
  const t = useTable<any>("ag_transactions", { select: "*, ag_clients(name), ag_projects(title)", order: "due_date", asc: true });
  const clients = useTable<any>("ag_clients", { order: "name", asc: true });
  const projects = useTable<any>("ag_projects", { select: "id,title", order: "created_at" });
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filter, setFilter] = useState("todos");
  const [form, setForm] = useState<any>(null);
  const td = today();

  const shift = (n: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 15); setMonth(d.toISOString().slice(0, 7)); };
  const inMonth = t.rows.filter((x) => x.due_date?.startsWith(month));
  const k = useMemo(() => {
    const s = (f: (x: any) => boolean) => inMonth.filter(f).reduce((a, x) => a + Number(x.amount), 0);
    return { recebido: s((x) => x.kind === "entrada" && x.paid), receber: s((x) => x.kind === "entrada" && !x.paid), pago: s((x) => x.kind === "saida" && x.paid), pagar: s((x) => x.kind === "saida" && !x.paid) };
  }, [inMonth]);
  const overdueAll = t.rows.filter((x) => !x.paid && x.due_date < td);
  const list = (filter === "atrasados" ? overdueAll : inMonth).filter((x) => filter === "todos" || filter === "atrasados" || (filter === "entradas" ? x.kind === "entrada" : filter === "saidas" ? x.kind === "saida" : !x.paid));
  const cats: Record<string, number> = {};
  inMonth.filter((x) => x.kind === "saida").forEach((x) => { cats[x.category || "Outro"] = (cats[x.category || "Outro"] || 0) + Number(x.amount); });
  const catMax = Math.max(1, ...Object.values(cats));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const row = { ...form, amount: Number(form.amount) || 0, paid: !!form.paid, paid_at: form.paid ? form.paid_at || today() : null };
    const reps = Math.max(1, Number(form.repeat) || 1);
    delete row.repeat;
    for (let i = 0; i < (row.id ? 1 : reps); i++) {
      const d = new Date(row.due_date + "T12:00"); d.setMonth(d.getMonth() + i);
      await t.save({ ...row, due_date: d.toISOString().slice(0, 10), paid: i === 0 ? row.paid : false, paid_at: i === 0 ? row.paid_at : null, description: reps > 1 ? `${row.description} (${i + 1}/${reps})` : row.description });
    }
    setForm(null);
  }
  const fields = (kind: string) => [
    { key: "kind", label: "Tipo", type: "select" as const, options: [{ v: "entrada", l: "Entrada (receita)" }, { v: "saida", l: "Saída (despesa)" }] },
    { key: "amount", label: "Valor (R$)", type: "money" as const, required: true },
    { key: "description", label: "Descrição", required: true, span: 2 as const },
    { key: "category", label: "Categoria", type: "select" as const, options: kind === "saida" ? CAT_OUT : CAT_IN },
    { key: "due_date", label: "Vencimento", type: "date" as const, required: true },
    { key: "client_id", label: "Cliente", type: "select" as const, options: clients.rows.map((c) => ({ v: c.id, l: c.name })) },
    { key: "project_id", label: "Projeto", type: "select" as const, options: projects.rows.map((p) => ({ v: p.id, l: p.title })) },
    { key: "paid", label: kind === "saida" ? "Já foi pago" : "Já foi recebido", type: "checkbox" as const },
    ...(form?.id ? [] : [{ key: "repeat", label: "Repetir por N meses", type: "number" as const, placeholder: "1" }]),
  ];
  const label = new Date(month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHead kicker="AGENCY · 02 ANÁLISE" title="Financeiro" desc="Entradas, saídas, contas a receber e a pagar.">
        <button className="btn btn-ghost" onClick={() => setForm({ kind: "saida", due_date: today() })}>− Despesa</button>
        <button className="btn btn-mint" onClick={() => setForm({ kind: "entrada", due_date: today() })}><I.plus className="w-4 h-4" />Receita</button>
      </PageHead>

      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => shift(-1)} className="btn btn-ghost btn-sm"><A.chevL className="w-4 h-4" /></button>
        <p className="font-display font-bold text-lg capitalize w-48 text-center">{label}</p>
        <button onClick={() => shift(1)} className="btn btn-ghost btn-sm"><A.chevR className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[["Recebido", k.recebido, "text-mint"], ["A receber", k.receber, ""], ["Pago", k.pago, "text-danger"], ["A pagar", k.pagar, ""], ["Saldo previsto", k.recebido + k.receber - k.pago - k.pagar, k.recebido + k.receber - k.pago - k.pagar >= 0 ? "text-mint" : "text-danger"]].map(([n, v, c]) => (
          <div key={n as string} className="card p-4"><p className="text-xs text-fog">{n}</p><p className={`font-display text-xl md:text-2xl font-bold mt-1 tabular-nums ${c}`}>{brl(v)}</p></div>
        ))}
      </div>
      {!!overdueAll.length && <button onClick={() => setFilter("atrasados")} className="card w-full text-left px-4 py-3 mb-5 text-sm border-danger/40 text-danger flex items-center gap-2"><A.alert className="w-4 h-4" />{overdueAll.length} lançamento(s) vencido(s) sem baixa · {brl(overdueAll.reduce((a, x) => a + Number(x.amount) * (x.kind === "saida" ? -1 : 1), 0))}</button>}

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex gap-1 p-3 border-b border-line overflow-x-auto scroll-thin">{["todos", "entradas", "saidas", "pendentes", "atrasados"].map((f) => <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm capitalize ${filter === f ? "btn-mint" : "btn-ghost"}`}>{f === "saidas" ? "saídas" : f}</button>)}</div>
          <ul className="divide-y divide-line">
            {list.map((x) => {
              const late = !x.paid && x.due_date < td;
              return (
                <li key={x.id} className="flex items-center gap-3 px-4 py-3 hover:bg-panel2/40">
                  <button onClick={() => t.patch(x.id, { paid: !x.paid, paid_at: !x.paid ? today() : null })} title={x.paid ? "Desfazer baixa" : "Dar baixa"} className={`w-5 h-5 rounded-md border shrink-0 grid place-items-center text-[11px] ${x.paid ? "bg-mint border-mint text-black" : "border-line"}`}>{x.paid ? "✓" : ""}</button>
                  <button onClick={() => setForm(x)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate">{x.description}</p>
                    <p className="text-[11px] text-fog truncate">{[x.category, x.ag_clients?.name, x.ag_projects?.title].filter(Boolean).join(" · ") || "–"}</p>
                  </button>
                  <span className={`text-xs w-14 text-right ${late ? "text-danger" : "text-fog"}`}>{dtShort(x.due_date)}</span>
                  <span className={`font-mono text-sm w-28 text-right ${x.kind === "saida" ? "text-danger" : "text-mint"}`}>{x.kind === "saida" ? "−" : "+"}{brl(x.amount)}</span>
                </li>
              );
            })}
            {!list.length && <li className="text-fog text-sm text-center py-10">Nada por aqui.</li>}
          </ul>
        </section>
        <section className="card p-5 h-fit">
          <h2 className="font-display font-bold text-lg mb-4">Despesas por categoria</h2>
          {!Object.keys(cats).length ? <p className="text-fog text-sm">Sem despesas no mês.</p> : (
            <ul className="space-y-3">{Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <li key={c}><div className="flex justify-between text-sm mb-1"><span>{c}</span><span className="font-mono text-xs">{brl(v)}</span></div><div className="h-1.5 bg-panel2 rounded-full"><div className="h-full bg-danger/70 rounded-full" style={{ width: `${(v / catMax) * 100}%` }} /></div></li>
            ))}</ul>
          )}
        </section>
      </div>

      <Modal open={!!form} title={form?.id ? "Editar lançamento" : form?.kind === "saida" ? "Nova despesa" : "Nova receita"} onClose={() => setForm(null)}>
        <form onSubmit={submit}><Fields fields={fields(form?.kind)} value={form} onChange={setForm} />
          {t.error && <p className="text-danger text-sm mt-3">{t.error}</p>}
          <div className="flex justify-between mt-6">{form?.id ? <button type="button" className="btn btn-ghost" onClick={async () => { await t.remove(form.id); setForm(null); }}><I.trash className="w-4 h-4" /></button> : <span />}<button className="btn btn-mint">Salvar</button></div>
        </form>
      </Modal>
    </>
  );
}
