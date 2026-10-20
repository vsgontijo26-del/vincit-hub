"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_STAGES, brl, dtShort, stageLabel } from "@/lib/agency";
import CopyButton from "@/components/CopyButton";

const REVIEW: Record<string, string> = { pendente: "Aguardando cliente", aprovado: "Aprovado", alteracao: "Pediu alteração" };
const MAX_REV = 3;

/** Painel do projeto no topo da lista de tarefas: cliente, datas, etapa, financeiro, entrega, aprovação, revisões e equipamentos */
export default function ProjectPanel({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const [p, setP] = useState<any>(null);
  const [tx, setTx] = useState<any[]>([]);
  const [bk, setBk] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [origin, setOrigin] = useState("");
  const s = () => createClient();
  const load = useCallback(async () => {
    const c = createClient();
    const [a, b, e] = await Promise.all([
      c.from("ag_projects").select("*, ag_clients(name)").eq("id", id).single(),
      c.from("ag_transactions").select("kind,amount,paid").eq("project_id", id),
      c.from("ag_bookings").select("ag_equipment(name)").eq("project_id", id),
    ]);
    setP(a.data); setUrl(a.data?.delivery_url || ""); setTx(b.data || []); setBk(e.data || []);
  }, [id]);
  useEffect(() => { load(); setOrigin(location.origin); }, [load]);
  if (!p) return <div className="card p-5 mb-6 text-sm text-fog">Carregando projeto…</div>;

  const log = (kind: string, text: string) => s().from("ag_project_events").insert({ project_id: id, kind, text });
  async function setStage(stage: string) {
    if (stage === p.stage) return;
    await s().from("ag_projects").update({ stage, ...(stage === "entregue" ? { delivered_at: new Date().toISOString() } : {}) }).eq("id", id);
    await log("status", `Etapa: ${stageLabel(p.stage)} → ${stageLabel(stage)}`); load(); onChanged?.();
  }
  async function saveUrl() { if (url !== (p.delivery_url || "")) { await s().from("ag_projects").update({ delivery_url: url || null }).eq("id", id); load(); } }
  async function sendReview() {
    if (!url) return alert("Cole o link de entrega antes de enviar para aprovação.");
    await s().from("ag_projects").update({ delivery_url: url, review_status: "pendente", stage: "revisao" }).eq("id", id);
    await log("entrega", `Nova versão enviada para aprovação${p.revisions ? ` (v${p.revisions + 1})` : ""}`); load(); onChanged?.();
  }
  async function approveManual() {
    await s().from("ag_projects").update({ review_status: "aprovado" }).eq("id", id);
    await log("aprovacao", "Aprovação marcada manualmente"); load();
  }

  const ins = tx.filter((t) => t.kind === "entrada");
  const paid = ins.filter((t) => t.paid);
  const rev = Number(p.revisions) || 0;
  const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="min-w-0"><p className="text-xs text-fog mb-1">{label}</p><div className="text-[15px] truncate">{children}</div></div>
  );

  return (
    <section className="card p-5 mb-6 rise">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 pb-4 border-b border-line">
        <Cell label="Cliente">{p.ag_clients?.name || "Sem cliente"}</Cell>
        <Cell label="Tipo · valor">{p.type || "Projeto"}{Number(p.value) ? ` · ${brl(p.value)}` : ""}</Cell>
        <Cell label="Captação">{p.shoot_date ? dtShort(p.shoot_date) : "—"}</Cell>
        <Cell label="Entrega"><span className={p.due_date && p.due_date < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) && p.stage !== "entregue" ? "text-danger" : ""}>{p.due_date ? dtShort(p.due_date) : "—"}</span></Cell>
        <Cell label="Etapa">
          <select className="bg-transparent text-[13px] border border-[#f5c84c66] text-[#f5c84c] rounded-full px-2 py-0.5 outline-none" value={p.stage} onChange={(e) => setStage(e.target.value)}>
            {PROJECT_STAGES.map((x) => <option key={x.k} value={x.k} className="bg-panel text-paper">{x.l}</option>)}
          </select>
        </Cell>
        <Cell label="Financeiro">{ins.length ? `${paid.length} de ${ins.length} parcela${ins.length > 1 ? "s" : ""} paga${paid.length === 1 ? "" : "s"}` : "Sem recebimentos"}</Cell>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4 items-start">
        <div className="xl:col-span-1 min-w-0">
          <p className="text-xs text-fog mb-1">Link de entrega</p>
          <input className="input !py-1.5" placeholder="Cole o link do Drive ou Frame.io" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={saveUrl} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-fog mb-1">Aprovação do cliente</p>
          {p.review_status && REVIEW[p.review_status]
            ? <p className="text-[15px]"><span className={p.review_status === "aprovado" ? "text-mint" : p.review_status === "alteracao" ? "text-danger" : ""}>{REVIEW[p.review_status]}</span>
                {p.review_status === "pendente" && <> · <CopyButton text={`${origin}/r/${p.review_token}`} label="copiar link" /></>}
                {p.review_status !== "aprovado" && <> · <button onClick={approveManual} className="text-mint hover:underline">marcar aprovado</button></>}</p>
            : <p className="text-[15px]">Opcional · <button onClick={sendReview} className="text-mint hover:underline">enviar link público</button> · <button onClick={approveManual} className="text-fog hover:text-paper">marcar aprovado</button></p>}
        </div>
        <div>
          <p className="text-xs text-fog mb-1.5">Revisões</p>
          <div className="flex gap-1">{Array.from({ length: MAX_REV }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < rev ? (rev > MAX_REV ? "bg-danger" : "bg-[#f5c84c]") : "bg-panel2"}`} />)}</div>
          <p className={`text-xs mt-1.5 ${rev > MAX_REV ? "text-danger" : "text-fog"}`}>{rev} de {MAX_REV}{rev > MAX_REV ? " · passou do limite" : ""}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-fog mb-1">Equipamentos</p>
          <p className="text-[15px] truncate">{bk.map((b) => b.ag_equipment?.name).filter(Boolean).join(", ") || "—"}</p>
          <Link href={`/projetos/${id}`} className="text-xs text-fog hover:text-mint">Abrir projeto completo →</Link>
        </div>
      </div>
    </section>
  );
}
