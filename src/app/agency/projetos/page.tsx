"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { PROJECT_STAGES, PROJECT_TYPES, brlShort, dtShort, today, stageLabel } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";

const REVIEW: Record<string, [string, string]> = { pendente: ["Aguardando cliente", "chip"], aprovado: ["Aprovado", "chip chip-mint"], alteracao: ["Pediu alteração", "chip text-danger border-danger/40"] };

export default function Projetos() {
  const router = useRouter();
  const p = useTable<any>("ag_projects", { select: "*, ag_clients(name)", order: "due_date", asc: true });
  const clients = useTable<any>("ag_clients", { order: "name", asc: true });
  const team = useTable<any>("ag_team", { order: "name", asc: true });
  const [form, setForm] = useState<any>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [view, setView] = useState<"quadro" | "lista">("quadro");
  const t = today();

  async function move(id: string, stage: string) {
    const prj = p.rows.find((x) => x.id === id);
    if (!prj || prj.stage === stage) return;
    await p.patch(id, { stage, ...(stage === "entregue" ? { delivered_at: new Date().toISOString() } : {}) });
    await createClient().from("ag_project_events").insert({ project_id: id, kind: "status", text: `Etapa: ${stageLabel(prj.stage)} → ${stageLabel(stage)}` });
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const saved: any = await p.save({ ...form });
    if (saved) { setForm(null); router.push(`/agency/projetos/${saved.id}`); }
  }

  const fields = [
    { key: "title", label: "Nome do projeto", required: true, span: 2 as const },
    { key: "client_id", label: "Cliente", type: "select" as const, options: clients.rows.map((c) => ({ v: c.id, l: c.name })) },
    { key: "type", label: "Tipo", type: "select" as const, options: PROJECT_TYPES },
    { key: "value", label: "Valor (R$)", type: "money" as const },
    { key: "responsible", label: "Responsável", type: "select" as const, options: team.rows.map((m) => m.name) },
    { key: "shoot_date", label: "Data da captação", type: "date" as const },
    { key: "due_date", label: "Prazo de entrega", type: "date" as const },
    { key: "description", label: "Briefing / descrição", type: "textarea" as const },
  ];

  return (
    <>
      <PageHead kicker="GESTOR · 01 OPERAÇÃO" title="Projetos" desc="Do briefing à entrega. Arraste os cards entre as etapas; cada mudança fica registrada no histórico.">
        <div className="flex rounded-lg border border-line overflow-hidden">{(["quadro", "lista"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-3 py-2 text-xs capitalize ${view === v ? "bg-mint text-black font-semibold" : "text-fog"}`}>{v}</button>)}</div>
        <button className="btn btn-mint" onClick={() => setForm({ stage: "briefing" })}><I.plus className="w-4 h-4" />Novo projeto</button>
      </PageHead>
      {p.error && <p className="text-danger text-sm mb-4">{p.error}</p>}

      {view === "quadro" ? (
        <div className="grid grid-flow-col auto-cols-[minmax(250px,1fr)] gap-3 overflow-x-auto scroll-thin pb-4 -mx-4 px-4 md:mx-0 md:px-0">
          {PROJECT_STAGES.map((s) => {
            const col = p.rows.filter((x) => x.stage === s.k);
            const total = col.reduce((a, x) => a + Number(x.value || 0), 0);
            return (
              <div key={s.k} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, s.k)} className="bg-panel/60 border border-line rounded-2xl p-3 min-h-[420px]">
                <div className="flex items-center justify-between px-1 mb-3"><p className="font-display font-bold text-sm">{s.l}</p><span className="font-mono text-[11px] text-fog">{col.length}{total ? ` · ${brlShort(total)}` : ""}</span></div>
                <div className="space-y-2">
                  {col.map((x) => {
                    const late = x.due_date && x.due_date < t && x.stage !== "entregue";
                    const rv = REVIEW[x.review_status];
                    return (
                      <Link key={x.id} href={`/agency/projetos/${x.id}`} draggable onDragStart={() => setDrag(x.id)} onDragEnd={() => setDrag(null)}
                        className="block bg-panel2 border border-line rounded-xl p-3 hover:border-mint-dim">
                        <p className="text-sm font-medium leading-snug">{x.title}</p>
                        <p className="text-xs text-fog mt-1">{x.ag_clients?.name || "Sem cliente"}{x.type ? ` · ${x.type}` : ""}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-2.5">
                          {x.due_date && <span className={`chip ${late ? "text-danger border-danger/40" : ""}`}>{late ? "Atrasado · " : ""}{dtShort(x.due_date)}</span>}
                          {x.responsible && <span className="chip">{x.responsible}</span>}
                          {rv && <span className={rv[1]}>{rv[0]}</span>}
                          {x.revisions > 0 && <span className="chip">{x.revisions} refação</span>}
                        </div>
                        <div className="flex gap-1 mt-2 lg:hidden" onClick={(e) => e.preventDefault()}>
                          <select className="input !py-1 !text-xs" value={x.stage} onChange={(e) => move(x.id, e.target.value)}>{PROJECT_STAGES.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}</select>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-left text-fog text-xs border-b border-line">{["Projeto", "Cliente", "Etapa", "Responsável", "Prazo", "Valor"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>{p.rows.map((x) => (
              <tr key={x.id} className="border-b border-line/60 hover:bg-panel2/50 cursor-pointer" onClick={() => router.push(`/agency/projetos/${x.id}`)}>
                <td className="p-3">{x.title}</td><td className="p-3 text-fog">{x.ag_clients?.name || "–"}</td><td className="p-3"><span className="chip">{stageLabel(x.stage)}</span></td>
                <td className="p-3 text-fog">{x.responsible || "–"}</td><td className={`p-3 ${x.due_date && x.due_date < t && x.stage !== "entregue" ? "text-danger" : "text-fog"}`}>{dtShort(x.due_date)}</td><td className="p-3 font-mono text-xs">{brlShort(x.value)}</td>
              </tr>))}</tbody>
          </table>
          {!p.rows.length && <p className="text-fog text-sm text-center py-10">Nenhum projeto ainda.</p>}
        </div>
      )}

      <Modal open={!!form} title="Novo projeto" onClose={() => setForm(null)}>
        <form onSubmit={create}>
          <Fields fields={fields} value={form} onChange={setForm} />
          <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-mint">Criar projeto</button></div>
        </form>
      </Modal>
    </>
  );
}
