"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/agency";
import { chargeAmount } from "@/lib/pix";
import Modal from "@/components/agency/Modal";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";
import { todayBR } from "./useFinance";

const ST: Record<string, { l: string; c: string }> = { pendente: { l: "Em aberto", c: "#f5c84c" }, vencida: { l: "Vencida", c: "#ff6b6b" }, informado: { l: "Pagamento informado", c: "#7aa7ff" }, pago: { l: "Paga", c: "#6eefb6" }, cancelado: { l: "Cancelada", c: "#8a8f94" } };
const addMonths = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };
const fmtD = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export default function Charges({ fin, prefill }: { fin: any; prefill?: any }) {
  const [f, setF] = useState<any>(null);
  const [created, setCreated] = useState<any[] | null>(null);
  const [filter, setFilter] = useState("abertas");
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const td = todayBR();
  useEffect(() => setOrigin(location.origin), []);
  useEffect(() => { if (prefill) openNew(prefill); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [prefill]);

  const stOf = (c: any) => (c.status === "pendente" && c.due_date < td ? "vencida" : c.status);
  const link = (c: any) => `${origin}/c/${c.public_token}`;
  const list = fin.charges.filter((c: any) => filter === "todas" || (filter === "abertas" ? ["pendente", "informado"].includes(c.status) : filter === "vencidas" ? stOf(c) === "vencida" : c.status === filter));
  const sum = (fn: (c: any) => boolean) => fin.charges.filter(fn).reduce((a: number, c: any) => a + Number(c.amount), 0);

  function openNew(p: any = {}) {
    const s = fin.settings || {};
    setErr(null); setCreated(null);
    setF({ client_id: "", description: "", amount: "", due_date: addMonths(td, 0), installments: 1, methods: ["pix"], pix_key: s.pix_key || "", pix_name: s.pix_name || s.company_name || "", pix_city: s.pix_city || "", payment_link: "", bank_info: s.bank_info || "", fine_pct: s.fine_pct ?? 2, interest_pct: s.interest_pct ?? 1, discount_value: 0, discount_days: 0, account_id: fin.accounts.find((a: any) => a.kind !== "cartao")?.id || "", saveDefaults: !s.pix_key, ...p });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const amount = Number(String(f.amount).replace(",", "."));
    if (!f.description?.trim() || !amount) return setErr("Preencha descrição e valor.");
    if (f.methods.includes("pix") && !f.pix_key) return setErr("Informe a chave Pix.");
    if (f.methods.includes("link") && !f.payment_link) return setErr("Informe o link de pagamento.");
    if (!f.methods.length) return setErr("Escolha ao menos uma forma de pagamento.");
    const s = createClient();
    const client = fin.clients.find((c: any) => c.id === f.client_id);
    const n = Math.max(1, Math.min(24, Number(f.installments) || 1));
    const each = Math.round((amount / n) * 100) / 100;
    const group = n > 1 ? (crypto as any).randomUUID() : null;
    const rows = Array.from({ length: n }, (_, i) => ({
      client_id: f.client_id || null, project_id: f.project_id || null, proposal_id: f.proposal_id || null, account_id: f.account_id || null,
      description: f.description.trim(), amount: i === n - 1 ? Math.round((amount - each * (n - 1)) * 100) / 100 : each, due_date: addMonths(f.due_date, i),
      methods: f.methods, pix_key: f.pix_key || null, pix_name: f.pix_name || null, pix_city: f.pix_city || null, payment_link: f.payment_link || null, bank_info: f.bank_info || null,
      fine_pct: Number(f.fine_pct) || 0, interest_pct: Number(f.interest_pct) || 0, discount_value: Number(f.discount_value) || 0, discount_days: Number(f.discount_days) || 0,
      installment: n > 1 ? `${i + 1}/${n}` : null, group_id: group, customer_name: client?.name || f.customer_name || null, customer_email: client?.email || null, customer_phone: client?.phone || f.customer_phone || null,
    }));
    const { data, error } = await s.from("fin_charges").insert(rows).select();
    if (error) return setErr(error.message);
    if (f.saveDefaults) {
      const { data: { user } } = await s.auth.getUser();
      await s.from("ag_settings").upsert({ owner_id: user!.id, pix_key: f.pix_key, pix_name: f.pix_name, pix_city: f.pix_city, bank_info: f.bank_info, fine_pct: Number(f.fine_pct) || 0, interest_pct: Number(f.interest_pct) || 0 }, { onConflict: "owner_id" });
    }
    setCreated(data || []); await fin.reload();
  }
  async function confirm(c: any) {
    const s = createClient();
    const date = todayBR();
    const value = Math.round(chargeAmount(c, c.status === "informado" && c.informed_at ? c.informed_at.slice(0, 10) : date).value * 100) / 100;
    const { data: tx } = await s.from("ag_transactions").insert({ kind: "entrada", amount: value, description: `${c.description}${c.installment ? ` (${c.installment})` : ""}`, category: "Projetos", account_id: c.account_id, client_id: c.client_id, project_id: c.project_id, due_date: c.due_date, paid: true, paid_at: date, charge_id: c.id }).select().single();
    await s.from("fin_charges").update({ status: "pago", paid_at: date, transaction_id: tx?.id || null }).eq("id", c.id);
    fin.reload();
  }
  async function setStatus(c: any, status: string) { await createClient().from("fin_charges").update({ status }).eq("id", c.id); fin.reload(); }
  function whats(c: any) {
    const st = stOf(c); const v = chargeAmount(c, td);
    const msg = st === "vencida"
      ? `Olá${c.customer_name ? `, ${c.customer_name.split(" ")[0]}` : ""}! Tudo bem? A cobrança "${c.description}" venceu em ${fmtD(c.due_date)}. Valor atualizado: ${brl(v.value)}. Você pode pagar por aqui: ${link(c)}`
      : c.due_date === td ? `Olá${c.customer_name ? `, ${c.customer_name.split(" ")[0]}` : ""}! Passando para lembrar que "${c.description}" vence hoje (${brl(v.value)}). Link para pagamento: ${link(c)}`
      : `Olá${c.customer_name ? `, ${c.customer_name.split(" ")[0]}` : ""}! Segue a cobrança de "${c.description}" no valor de ${brl(v.value)}, com vencimento em ${fmtD(c.due_date)}. Pague por Pix ou pelo link: ${link(c)}`;
    const phone = (c.customer_phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone ? (phone.length <= 11 ? "55" + phone : phone) : ""}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[["Em aberto", sum((c) => c.status === "pendente" && c.due_date >= td)], ["Vencidas", sum((c) => c.status === "pendente" && c.due_date < td)], ["Pagamento informado", sum((c) => c.status === "informado")], ["Recebido no mês", sum((c) => c.status === "pago" && (c.paid_at || "").startsWith(td.slice(0, 7)))]].map(([k, v], i) => (
          <div key={k as string} className="card p-4"><p className="text-xs text-fog">{k}</p><p className={`font-display text-xl md:text-2xl font-bold mt-1 ${i === 1 && v ? "text-danger" : i === 3 ? "text-mint" : ""}`}>{brl(v as number)}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[["abertas", "Abertas"], ["vencidas", "Vencidas"], ["informado", "Informadas"], ["pago", "Pagas"], ["cancelado", "Canceladas"], ["todas", "Todas"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? "btn-mint" : "btn-ghost"}`}>{l}</button>)}
        <button onClick={() => openNew()} className="btn btn-mint btn-sm ml-auto"><I.plus className="w-4 h-4" />Nova cobrança</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-fog text-xs border-b border-line">{["Cobrança", "Vencimento", "Valor", "Status", ""].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((c: any) => { const st = stOf(c); return (
              <tr key={c.id} className="border-b border-line/60 hover:bg-panel2/40">
                <td className="p-3"><p className="font-medium">{c.description}{c.installment ? <span className="text-fog font-normal"> · {c.installment}</span> : ""}</p><p className="text-xs text-fog">{c.ag_clients?.name || c.customer_name || "Sem cliente"}{c.viewed_at ? " · visualizada" : ""}{c.payer_note ? ` · “${c.payer_note}”` : ""}</p></td>
                <td className={`p-3 text-xs ${st === "vencida" ? "text-danger" : "text-fog"}`}>{fmtD(c.due_date)}</td>
                <td className="p-3 font-mono">{brl(Number(c.amount))}</td>
                <td className="p-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: ST[st].c + "22", color: ST[st].c }}>{ST[st].l}</span></td>
                <td className="p-3 text-right whitespace-nowrap">
                  <CopyButton text={link(c)} label="Link" />
                  <a href={link(c)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm ml-1">Ver</a>
                  {["pendente", "informado"].includes(c.status) && <><button onClick={() => whats(c)} className="btn btn-ghost btn-sm ml-1">WhatsApp</button><button onClick={() => confirm(c)} className="btn btn-mint btn-sm ml-1">Confirmar recebimento</button><button onClick={() => setStatus(c, "cancelado")} className="text-fog hover:text-danger ml-2 text-xs">Cancelar</button></>}
                </td>
              </tr>
            ); })}
            {!list.length && <tr><td colSpan={5} className="p-10 text-center text-fog">Nenhuma cobrança aqui.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-fog mt-3">Cada cobrança gera uma página com Pix copia e cola + QR Code com o valor (multa, juros e desconto aplicados automaticamente). O cliente pode avisar que pagou; você confirma e o valor entra no financeiro. Para cartão e boleto, cole o link de pagamento do seu banco ou gateway.</p>

      <Modal open={!!f} title={created ? "Cobrança criada" : "Nova cobrança"} onClose={() => { setF(null); setCreated(null); }} wide>
        {f && (created ? (
          <div className="space-y-3">
            {created.map((c) => (
              <div key={c.id} className="bg-panel2 rounded-xl p-3 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]"><p className="text-sm font-semibold">{c.description}{c.installment ? ` · ${c.installment}` : ""}</p><p className="text-xs text-fog">{brl(Number(c.amount))} · vence {fmtD(c.due_date)}</p></div>
                <CopyButton text={link(c)} label="Copiar link" /><button onClick={() => whats(c)} className="btn btn-ghost btn-sm">Enviar no WhatsApp</button><a href={link(c)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Abrir</a>
              </div>
            ))}
            <div className="flex justify-end"><button onClick={() => { setF(null); setCreated(null); }} className="btn btn-mint">Pronto</button></div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div><label className="label">Cliente</label><select className="input" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}><option value="">–</option>{fin.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="md:col-span-2"><label className="label">Descrição</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Vídeo institucional — 50% de entrada" /></div>
              <div><label className="label">Valor total (R$)</label><input inputMode="decimal" className="input font-display font-bold text-lg" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
              <div><label className="label">1º vencimento</label><input type="date" className="input" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
              <div><label className="label">Parcelas</label><select className="input" value={f.installments} onChange={(e) => setF({ ...f, installments: e.target.value })}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x de ${brl((Number(String(f.amount).replace(",", ".")) || 0) / n)}`}</option>)}</select></div>
              <div><label className="label">Recebe na conta</label><select className="input" value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>{fin.accounts.filter((a: any) => a.kind !== "cartao").map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="label">Projeto</label><select className="input" value={f.project_id || ""} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">–</option>{fin.projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            </div>
            <div className="bg-panel2 rounded-xl p-4 space-y-3">
              <p className="font-display font-bold">Formas de pagamento</p>
              <div className="flex flex-wrap gap-2">{[["pix", "Pix (QR Code)"], ["link", "Link de cartão/boleto"], ["transferencia", "Transferência"]].map(([k, l]) => { const on = f.methods.includes(k); return <button type="button" key={k} onClick={() => setF({ ...f, methods: on ? f.methods.filter((x: string) => x !== k) : [...f.methods, k] })} className={`btn btn-sm ${on ? "btn-mint" : "btn-ghost"}`}>{l}</button>; })}</div>
              {f.methods.includes("pix") && <div className="grid md:grid-cols-3 gap-3"><div><label className="label">Chave Pix</label><input className="input" value={f.pix_key} onChange={(e) => setF({ ...f, pix_key: e.target.value })} placeholder="CNPJ, e-mail, telefone ou aleatória" /></div><div><label className="label">Nome do recebedor</label><input className="input" value={f.pix_name} onChange={(e) => setF({ ...f, pix_name: e.target.value })} /></div><div><label className="label">Cidade</label><input className="input" value={f.pix_city} onChange={(e) => setF({ ...f, pix_city: e.target.value })} /></div></div>}
              {f.methods.includes("link") && <div><label className="label">Link de pagamento (cartão/boleto)</label><input className="input" value={f.payment_link} onChange={(e) => setF({ ...f, payment_link: e.target.value })} placeholder="Link gerado no seu banco, Asaas, Mercado Pago…" /></div>}
              {f.methods.includes("transferencia") && <div><label className="label">Dados bancários</label><textarea className="input min-h-[70px]" value={f.bank_info} onChange={(e) => setF({ ...f, bank_info: e.target.value })} placeholder={"Banco, agência, conta, titular, CNPJ"} /></div>}
              <label className="flex items-center gap-2 text-xs text-fog cursor-pointer"><input type="checkbox" className="accent-[var(--color-mint)]" checked={!!f.saveDefaults} onChange={(e) => setF({ ...f, saveDefaults: e.target.checked })} />Salvar esses dados como padrão</label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="label">Multa após vencer (%)</label><input type="number" step="0.1" className="input" value={f.fine_pct} onChange={(e) => setF({ ...f, fine_pct: e.target.value })} /></div>
              <div><label className="label">Juros ao mês (%)</label><input type="number" step="0.1" className="input" value={f.interest_pct} onChange={(e) => setF({ ...f, interest_pct: e.target.value })} /></div>
              <div><label className="label">Desconto (R$)</label><input type="number" step="0.01" className="input" value={f.discount_value} onChange={(e) => setF({ ...f, discount_value: e.target.value })} /></div>
              <div><label className="label">Até quantos dias antes</label><input type="number" className="input" value={f.discount_days} onChange={(e) => setF({ ...f, discount_days: e.target.value })} /></div>
            </div>
            {err && <p className="text-danger text-sm">{err}</p>}
            <div className="flex justify-end"><button className="btn btn-mint">Gerar cobrança</button></div>
          </form>
        ))}
      </Modal>
    </div>
  );
}
