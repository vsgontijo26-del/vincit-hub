"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";
import { cardDueDate, todayBR } from "./useFinance";

const uuid = () => (crypto as any).randomUUID();
const addMonths = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x.toISOString().slice(0, 10); };

export default function TxForm({ init, fin, onClose }: { init: any; fin: any; onClose: () => void }) {
  const [f, setF] = useState<any>({ repeat: "nao", times: 2, purchase: init.due_date || todayBR(), ...init });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isTransfer = f.kind === "transferencia";
  const acc = fin.accounts.find((a: any) => a.id === f.account_id);
  const isCard = acc?.kind === "cartao";
  const cats = fin.categories.filter((c: any) => c.kind === f.kind);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const amount = Number(String(f.amount).replace(",", "."));
    if (!amount || amount <= 0) return setErr("Informe o valor.");
    if (!f.description?.trim() && !isTransfer) return setErr("Informe a descrição.");
    setBusy(true);
    const s = createClient();
    try {
      if (isTransfer) {
        if (!f.account_id || !f.to_account_id || f.account_id === f.to_account_id) throw new Error("Escolha contas de origem e destino diferentes.");
        const tid = uuid(); const date = f.due_date || todayBR();
        const to = fin.accounts.find((a: any) => a.id === f.to_account_id);
        const { error } = await s.from("ag_transactions").insert([
          { kind: "saida", amount, description: f.description || `Transferência para ${to?.name}`, category: "Transferência", account_id: f.account_id, due_date: date, paid: true, paid_at: date, transfer_id: tid },
          { kind: "entrada", amount, description: f.description || `Transferência de ${acc?.name}`, category: "Transferência", account_id: f.to_account_id, due_date: date, paid: true, paid_at: date, transfer_id: tid },
        ]);
        if (error) throw error;
      } else {
        const base: any = { kind: f.kind, description: f.description.trim(), category: f.category || null, account_id: f.account_id || null, client_id: f.client_id || null, project_id: f.project_id || null, notes: f.notes || null };
        const firstDue = isCard ? cardDueDate(f.purchase || todayBR(), acc.closing_day || 1, acc.due_day || 10) : f.due_date || todayBR();
        if (f.id) {
          const { error } = await s.from("ag_transactions").update({ ...base, amount, due_date: firstDue, paid: !!f.paid, paid_at: f.paid ? f.paid_at || todayBR() : null }).eq("id", f.id);
          if (error) throw error;
        } else {
          const n = f.repeat === "nao" ? 1 : Math.max(2, Math.min(120, Number(f.times) || 2));
          const group = n > 1 ? uuid() : null;
          const each = f.repeat === "parcelado" ? Math.round((amount / n) * 100) / 100 : amount;
          const rows = Array.from({ length: n }, (_, i) => ({
            ...base, recurrence_group: group, amount: f.repeat === "parcelado" && i === n - 1 ? Math.round((amount - each * (n - 1)) * 100) / 100 : each,
            due_date: addMonths(firstDue, i), installment: f.repeat === "parcelado" ? `${i + 1}/${n}` : null,
            description: f.repeat === "parcelado" ? `${base.description} (${i + 1}/${n})` : base.description,
            paid: i === 0 && !isCard ? !!f.paid : false, paid_at: i === 0 && f.paid && !isCard ? f.paid_at || todayBR() : null,
          }));
          const { error } = await s.from("ag_transactions").insert(rows);
          if (error) throw error;
        }
      }
      await fin.reload(); onClose();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  async function del(all = false) {
    const s = createClient();
    if (f.transfer_id) await s.from("ag_transactions").delete().eq("transfer_id", f.transfer_id);
    else if (all && f.recurrence_group) await s.from("ag_transactions").delete().eq("recurrence_group", f.recurrence_group).eq("paid", false);
    else await s.from("ag_transactions").delete().eq("id", f.id);
    await fin.reload(); onClose();
  }

  const title = f.id ? "Editar lançamento" : isTransfer ? "Transferência entre contas" : f.kind === "saida" ? "Nova despesa" : "Nova receita";
  return (
    <Modal open title={title} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {!f.id && <div className="grid grid-cols-3 gap-1 bg-panel2 rounded-lg p-1">{[["entrada", "Receita"], ["saida", "Despesa"], ["transferencia", "Transferência"]].map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, kind: k, category: "" })} className={`rounded-md py-1.5 text-sm ${f.kind === k ? (k === "entrada" ? "bg-mint text-ink" : k === "saida" ? "bg-danger text-ink" : "bg-paper text-ink") : "text-fog"}`}>{l}</button>)}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Valor (R$)</label><input autoFocus inputMode="decimal" className="input text-2xl font-display font-bold" value={f.amount ?? ""} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" /></div>
          <div className="col-span-2"><label className="label">Descrição</label><input className="input" value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={isTransfer ? "Opcional" : "Ex.: Edição vídeo institucional"} /></div>
          <div><label className="label">{isTransfer ? "De" : "Conta / cartão"}</label><select className="input" value={f.account_id || ""} onChange={(e) => setF({ ...f, account_id: e.target.value })}><option value="">–</option>{fin.accounts.filter((a: any) => !a.archived && (!isTransfer || a.kind !== "cartao") && (f.kind !== "entrada" || a.kind !== "cartao")).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          {isTransfer ? <div><label className="label">Para</label><select className="input" value={f.to_account_id || ""} onChange={(e) => setF({ ...f, to_account_id: e.target.value })}><option value="">–</option>{fin.accounts.filter((a: any) => !a.archived && a.kind !== "cartao").map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            : <div><label className="label">Categoria</label><select className="input" value={f.category || ""} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">–</option>{cats.map((c: any) => <option key={c.id}>{c.name}</option>)}</select></div>}
          {isCard ? <div><label className="label">Data da compra</label><input type="date" className="input" value={f.purchase} onChange={(e) => setF({ ...f, purchase: e.target.value })} /><p className="text-[11px] text-fog mt-1">Fatura que vence em {new Date(cardDueDate(f.purchase || todayBR(), acc.closing_day || 1, acc.due_day || 10) + "T12:00").toLocaleDateString("pt-BR")}</p></div>
            : <div><label className="label">{isTransfer ? "Data" : "Vencimento"}</label><input type="date" className="input" value={f.due_date || ""} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>}
          {!isTransfer && !isCard && <div className="flex items-end"><label className="flex items-center gap-2 text-sm pb-3 cursor-pointer"><input type="checkbox" className="accent-[#6eefb6]" checked={!!f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />{f.kind === "saida" ? "Já paguei" : "Já recebi"}</label></div>}
          {!isTransfer && <>
            <div><label className="label">Cliente</label><select className="input" value={f.client_id || ""} onChange={(e) => setF({ ...f, client_id: e.target.value })}><option value="">–</option>{fin.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Projeto</label><select className="input" value={f.project_id || ""} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">–</option>{fin.projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          </>}
          {!f.id && !isTransfer && <div className="col-span-2 bg-panel2 rounded-xl p-3">
            <div className="flex flex-wrap gap-1">{[["nao", "Única"], ["fixa", "Fixa mensal"], ["parcelado", "Parcelada"]].map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, repeat: k })} className={`btn btn-sm ${f.repeat === k ? "btn-mint" : "btn-ghost"}`}>{l}</button>)}</div>
            {f.repeat !== "nao" && <div className="flex items-center gap-2 mt-2 text-sm"><input type="number" min={2} max={120} className="input !py-1.5 !w-20" value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} /><span className="text-fog">{f.repeat === "fixa" ? "meses (repete o mesmo valor)" : `parcelas de ${(Number(String(f.amount).replace(",", ".")) / (Number(f.times) || 2) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}</span></div>}
          </div>}
          <div className="col-span-2"><label className="label">Observações</label><input className="input" value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        {err && <p className="text-danger text-sm">{err}</p>}
        <div className="flex justify-between gap-2">
          <div className="flex gap-2">{f.id && <><button type="button" onClick={() => del(false)} className="btn btn-ghost btn-sm"><I.trash className="w-4 h-4" /></button>{f.recurrence_group && <button type="button" onClick={() => del(true)} className="btn btn-ghost btn-sm text-xs">Excluir pendentes da série</button>}</>}</div>
          <button disabled={busy} className="btn btn-mint">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}
