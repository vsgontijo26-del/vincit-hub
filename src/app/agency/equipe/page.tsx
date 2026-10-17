"use client";
import { useState } from "react";
import { useTable } from "@/lib/useTable";
import { brl, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";

const fields = [
  { key: "name", label: "Nome", required: true },
  { key: "role", label: "Função", placeholder: "Editor, cinegrafista, produtor…" },
  { key: "email", label: "E-mail", type: "email" as const },
  { key: "phone", label: "WhatsApp" },
  { key: "day_rate", label: "Diária / cachê (R$)", type: "money" as const },
  { key: "active", label: "Ativo", type: "checkbox" as const },
];

export default function Equipe() {
  const m = useTable<any>("ag_team", { order: "name", asc: true });
  const tasks = useTable<any>("ag_tasks", { select: "assignee,done,done_at,due_date" });
  const projects = useTable<any>("ag_projects", { select: "responsible,stage,due_date,revisions" });
  const [form, setForm] = useState<any>(null);
  const td = today();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  async function submit(e: React.FormEvent) { e.preventDefault(); if (await m.save(form)) setForm(null); }

  return (
    <>
      <PageHead kicker="AGENCY" title="Equipe" desc="Quem faz parte do time, diárias e produtividade dos últimos 30 dias.">
        <button className="btn btn-mint" onClick={() => setForm({ active: true })}><I.plus className="w-4 h-4" />Adicionar pessoa</button>
      </PageHead>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {m.rows.map((x) => {
          const mine = tasks.rows.filter((t) => t.assignee === x.name);
          const doneMonth = mine.filter((t) => t.done && t.done_at && t.done_at >= since).length;
          const openT = mine.filter((t) => !t.done).length;
          const late = mine.filter((t) => !t.done && t.due_date && t.due_date < td).length;
          const prj = projects.rows.filter((p) => p.responsible === x.name);
          const active = prj.filter((p) => p.stage !== "entregue").length;
          const onTime = mine.filter((t) => t.done).length ? Math.round((mine.filter((t) => t.done && (!t.due_date || (t.done_at || "").slice(0, 10) <= t.due_date)).length / mine.filter((t) => t.done).length) * 100) : null;
          return (
            <button key={x.id} onClick={() => setForm(x)} className={`card p-5 text-left hover:border-mint transition-colors ${x.active ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-mint/15 text-mint grid place-items-center font-display font-bold">{x.name.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase()}</div>
                <div className="min-w-0"><p className="font-semibold truncate">{x.name}</p><p className="text-xs text-fog">{x.role || "–"}{x.day_rate ? ` · ${brl(x.day_rate)}` : ""}</p></div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-5 text-center">
                {[["Feitas 30d", doneMonth], ["Abertas", openT], ["Atrasadas", late], ["Projetos", active]].map(([k, v]) => (
                  <div key={k as string} className="bg-panel2 rounded-lg py-2"><p className={`font-mono text-sm ${k === "Atrasadas" && Number(v) > 0 ? "text-danger" : ""}`}>{v}</p><p className="text-[10px] text-fog">{k}</p></div>
                ))}
              </div>
              {onTime != null && <p className="text-[11px] text-fog mt-3">No prazo: <span className="text-paper">{onTime}%</span> das tarefas concluídas</p>}
            </button>
          );
        })}
        {!m.rows.length && !m.loading && <p className="text-fog text-sm col-span-full text-center py-10">Adicione você e o time para atribuir tarefas e projetos.</p>}
      </div>
      <Modal open={!!form} title={form?.id ? form.name : "Nova pessoa"} onClose={() => setForm(null)}>
        <form onSubmit={submit}><Fields fields={fields} value={form} onChange={setForm} />
          <div className="flex justify-between mt-6">{form?.id ? <button type="button" className="btn btn-ghost" onClick={async () => { await m.remove(form.id); setForm(null); }}><I.trash className="w-4 h-4" /></button> : <span />}<button className="btn btn-mint">Salvar</button></div></form>
      </Modal>
    </>
  );
}
