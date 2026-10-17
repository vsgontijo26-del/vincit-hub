"use client";
import Link from "next/link";
import { useState } from "react";
import { useTable } from "@/lib/useTable";
import { dtShort, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

const PRI: Record<string, string> = { alta: "text-danger border-danger/40", media: "", baixa: "opacity-60" };

export default function Tarefas() {
  const t = useTable<any>("ag_tasks", { select: "*, ag_projects(id,title)", order: "due_date", asc: true });
  const team = useTable<any>("ag_team", { order: "name", asc: true });
  const projects = useTable<any>("ag_projects", { select: "id,title,stage", order: "created_at" });
  const [nw, setNw] = useState({ title: "", assignee: "", due_date: "", project_id: "", priority: "media" });
  const [who, setWho] = useState("");
  const [showDone, setShowDone] = useState(false);
  const td = today();

  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!nw.title.trim()) return;
    await t.save({ ...nw }); setNw({ ...nw, title: "" });
  }
  const rows = t.rows.filter((x) => !who || x.assignee === who);
  const open = rows.filter((x) => !x.done);
  const groups: [string, any[], string][] = [
    ["Atrasadas", open.filter((x) => x.due_date && x.due_date < td), "text-danger"],
    ["Hoje", open.filter((x) => x.due_date === td), "text-mint"],
    ["Próximas", open.filter((x) => x.due_date && x.due_date > td), ""],
    ["Sem data", open.filter((x) => !x.due_date), "text-fog"],
  ];
  const done = rows.filter((x) => x.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));

  const Row = ({ x }: { x: any }) => (
    <li className="flex items-center gap-3 bg-panel2 rounded-xl px-3 py-2.5">
      <input type="checkbox" checked={x.done} onChange={() => t.patch(x.id, { done: !x.done, done_at: !x.done ? new Date().toISOString() : null })} className="accent-[#6eefb6] w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${x.done ? "line-through text-fog" : ""}`}>{x.title}</p>
        {x.ag_projects && <Link href={`/agency/projetos/${x.ag_projects.id}`} className="text-[11px] text-fog hover:text-mint">{x.ag_projects.title}</Link>}
      </div>
      {x.priority && x.priority !== "media" && <span className={`chip ${PRI[x.priority]}`}>{x.priority}</span>}
      {x.assignee && <span className="chip hidden sm:inline-flex">{x.assignee}</span>}
      <span className={`text-xs w-12 text-right ${!x.done && x.due_date && x.due_date < td ? "text-danger" : "text-fog"}`}>{dtShort(x.due_date)}</span>
      <button onClick={() => t.remove(x.id)} className="text-fog hover:text-danger"><I.trash className="w-3.5 h-3.5" /></button>
    </li>
  );

  return (
    <>
      <PageHead kicker="AGENCY" title="Tarefas" desc="O to-do da produtora, por pessoa e por projeto." />
      <form onSubmit={add} className="card p-3 grid grid-cols-2 md:grid-cols-[1fr_150px_150px_140px_110px_auto] gap-2 mb-5">
        <input className="input col-span-2 md:col-span-1" placeholder="O que precisa ser feito?" value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} />
        <select className="input" value={nw.assignee} onChange={(e) => setNw({ ...nw, assignee: e.target.value })}><option value="">Responsável</option>{team.rows.map((m) => <option key={m.id}>{m.name}</option>)}</select>
        <select className="input" value={nw.project_id} onChange={(e) => setNw({ ...nw, project_id: e.target.value })}><option value="">Projeto</option>{projects.rows.filter((p) => p.stage !== "entregue").map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <input type="date" className="input" value={nw.due_date} onChange={(e) => setNw({ ...nw, due_date: e.target.value })} />
        <select className="input" value={nw.priority} onChange={(e) => setNw({ ...nw, priority: e.target.value })}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select>
        <button className="btn btn-mint col-span-2 md:col-span-1"><I.plus className="w-4 h-4" /></button>
      </form>
      <div className="flex flex-wrap gap-1 mb-6">
        {["", ...team.rows.map((m) => m.name)].map((n) => <button key={n || "all"} onClick={() => setWho(n)} className={`btn btn-sm ${who === n ? "btn-mint" : "btn-ghost"}`}>{n || "Todos"} <span className="opacity-60">{t.rows.filter((x) => !x.done && (!n || x.assignee === n)).length}</span></button>)}
      </div>
      <div className="space-y-6">
        {groups.filter(([, xs]) => xs.length).map(([g, xs, c]) => (
          <section key={g}><h2 className={`font-display font-bold mb-2 ${c}`}>{g} <span className="text-fog font-normal text-sm">{xs.length}</span></h2><ul className="space-y-1.5">{xs.map((x) => <Row key={x.id} x={x} />)}</ul></section>
        ))}
        {!open.length && <p className="text-fog text-sm text-center py-8">Nenhuma tarefa aberta. 🎬</p>}
        {!!done.length && <section><button onClick={() => setShowDone(!showDone)} className="text-sm text-fog hover:text-paper">{showDone ? "Ocultar" : "Mostrar"} concluídas ({done.length})</button>
          {showDone && <ul className="space-y-1.5 mt-2">{done.slice(0, 50).map((x) => <Row key={x.id} x={x} />)}</ul>}</section>}
      </div>
    </>
  );
}
