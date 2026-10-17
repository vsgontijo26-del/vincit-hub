"use client";
import Link from "next/link";
import { useState } from "react";
import { useTable } from "@/lib/useTable";
import { EVENT_KINDS, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";
import { A } from "@/components/agency/icons";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Agenda() {
  const ev = useTable<any>("ag_events", { order: "starts_at", asc: true });
  const pr = useTable<any>("ag_projects", { select: "id,title,shoot_date,due_date,stage" });
  const tx = useTable<any>("ag_transactions", { select: "id,description,due_date,kind,paid,amount" });
  const clients = useTable<any>("ag_clients", { order: "name", asc: true });
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [form, setForm] = useState<any>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const td = today();

  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d >= 1 && d <= days ? `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null; });

  type E = { id: string; title: string; kind: string; date: string; time?: string; href?: string; raw?: any };
  const all: E[] = [
    ...ev.rows.map((e) => { const d = new Date(e.starts_at); const loc = new Date(d.getTime() - 3 * 3600e3).toISOString(); return { id: e.id, title: e.title, kind: e.kind, date: loc.slice(0, 10), time: loc.slice(11, 16), raw: e }; }),
    ...pr.rows.filter((p) => p.shoot_date).map((p) => ({ id: "s" + p.id, title: p.title, kind: "captacao", date: p.shoot_date, href: `/agency/projetos/${p.id}` })),
    ...pr.rows.filter((p) => p.due_date && p.stage !== "entregue").map((p) => ({ id: "d" + p.id, title: "Entrega: " + p.title, kind: "entrega", date: p.due_date, href: `/agency/projetos/${p.id}` })),
    ...tx.rows.filter((t) => !t.paid && t.kind === "entrada").map((t) => ({ id: "t" + t.id, title: t.description, kind: "pagamento", date: t.due_date, href: "/agency/financeiro" })),
  ].filter((e) => !hidden.includes(e.kind));
  const byDay = (d: string) => all.filter((e) => e.date === d).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const row = { ...form, starts_at: new Date(form.starts_at + ":00-03:00").toISOString(), ends_at: form.ends_at ? new Date(form.ends_at + ":00-03:00").toISOString() : null };
    if (await ev.save(row)) setForm(null);
  }
  const toLocal = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 16);
  const fields = [
    { key: "title", label: "Título", required: true, span: 2 as const },
    { key: "kind", label: "Tipo", type: "select" as const, options: EVENT_KINDS.map((k) => ({ v: k.k, l: k.l })) },
    { key: "client_id", label: "Cliente", type: "select" as const, options: clients.rows.map((c) => ({ v: c.id, l: c.name })) },
    { key: "starts_at", label: "Início", type: "datetime" as const, required: true },
    { key: "ends_at", label: "Fim", type: "datetime" as const },
    { key: "location", label: "Local", span: 2 as const },
    { key: "project_id", label: "Projeto", type: "select" as const, options: pr.rows.map((p) => ({ v: p.id, l: p.title })) },
    { key: "notes", label: "Observações", type: "textarea" as const },
  ];

  return (
    <>
      <PageHead kicker="AGENCY" title="Agenda" desc="Captações, reuniões, entregas e pagamentos no mesmo calendário. Datas de projetos e recebimentos entram sozinhas.">
        <button className="btn btn-mint" onClick={() => setForm({ kind: "reuniao", starts_at: td + "T10:00" })}><I.plus className="w-4 h-4" />Novo compromisso</button>
      </PageHead>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(y, m - 1, 1))} className="btn btn-ghost btn-sm"><A.chevL className="w-4 h-4" /></button>
          <p className="font-display font-bold text-xl capitalize w-48 text-center">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          <button onClick={() => setCursor(new Date(y, m + 1, 1))} className="btn btn-ghost btn-sm"><A.chevR className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">{EVENT_KINDS.map((k) => (
          <button key={k.k} onClick={() => setHidden(hidden.includes(k.k) ? hidden.filter((x) => x !== k.k) : [...hidden, k.k])} className={`chip ${hidden.includes(k.k) ? "opacity-40" : ""}`}><span className="w-2 h-2 rounded-full" style={{ background: k.c }} />{k.l}</button>
        ))}</div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">{WD.map((d) => <p key={d} className="text-[11px] text-fog text-center py-2 uppercase tracking-wider">{d}</p>)}</div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => (
            <div key={i} onClick={() => d && setForm({ kind: "reuniao", starts_at: d + "T10:00" })} className={`min-h-[92px] md:min-h-[118px] border-b border-r border-line/60 p-1.5 ${d ? "cursor-pointer hover:bg-panel2/40" : "bg-ink/40"}`}>
              {d && <>
                <p className={`text-xs mb-1 w-6 h-6 grid place-items-center rounded-full ${d === td ? "bg-mint text-black font-bold" : "text-fog"}`}>{Number(d.slice(8))}</p>
                <div className="space-y-0.5">
                  {byDay(d).slice(0, 3).map((e) => {
                    const k = EVENT_KINDS.find((x) => x.k === e.kind);
                    const inner = <span className="block truncate text-[10px] md:text-[11px] rounded px-1 py-0.5" style={{ background: (k?.c || "#888") + "22", color: k?.c }}>{e.time ? e.time + " " : ""}{e.title}</span>;
                    return e.href ? <Link key={e.id} href={e.href} onClick={(ev2) => ev2.stopPropagation()}>{inner}</Link>
                      : <button key={e.id} className="w-full text-left" onClick={(ev2) => { ev2.stopPropagation(); setForm({ ...e.raw, starts_at: toLocal(e.raw.starts_at), ends_at: e.raw.ends_at ? toLocal(e.raw.ends_at) : "" }); }}>{inner}</button>;
                  })}
                  {byDay(d).length > 3 && <p className="text-[10px] text-fog px-1">+{byDay(d).length - 3}</p>}
                </div>
              </>}
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!form} title={form?.id ? "Compromisso" : "Novo compromisso"} onClose={() => setForm(null)}>
        <form onSubmit={submit}><Fields fields={fields} value={form} onChange={setForm} />
          {ev.error && <p className="text-danger text-sm mt-3">{ev.error}</p>}
          <div className="flex justify-between mt-6">{form?.id ? <button type="button" className="btn btn-ghost" onClick={async () => { await ev.remove(form.id); setForm(null); }}><I.trash className="w-4 h-4" /></button> : <span />}<button className="btn btn-mint">Salvar</button></div>
        </form>
      </Modal>
    </>
  );
}
