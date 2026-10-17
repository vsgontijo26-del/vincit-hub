"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { EVENT_KINDS, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import { RECUR, recurLabel, occurrences, Recur } from "@/components/tasks/shared";
import { I } from "@/components/icons";
import { A } from "@/components/agency/icons";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const KINDS = [...EVENT_KINDS, { k: "tarefa", l: "Tarefas", c: "#c084fc" }];
const toLocal = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 16);
const pad = (n: number) => String(n).padStart(2, "0");

type E = { id: string; title: string; kind: string; date: string; time?: string; href?: string; ev?: any; task?: any; linked?: any; projected?: boolean; recurring?: boolean };

export default function Agenda() {
  const ev = useTable<any>("ag_events", { order: "starts_at", asc: true });
  const pr = useTable<any>("ag_projects", { select: "id,title,shoot_date,due_date,stage" });
  const tx = useTable<any>("ag_transactions", { select: "id,description,due_date,kind,paid,amount" });
  const clients = useTable<any>("ag_clients", { order: "name", asc: true });
  const [t, setT] = useState<{ tasks: any[]; spaces: any[]; statuses: any[]; lists: any[]; tags: any[]; team: any[] }>({ tasks: [], spaces: [], statuses: [], lists: [], tags: [], team: [] });
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [form, setForm] = useState<any>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [openTask, setOpenTask] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const td = today();

  const loadTasks = useCallback(async () => {
    const s = createClient();
    const [tk, sp, st, li, tg, tm] = await Promise.all([
      s.from("ag_tasks").select("*"), s.from("ag_spaces").select("*").order("position"), s.from("ag_space_statuses").select("*").order("position"),
      s.from("ag_lists").select("*").order("position"), s.from("ag_tags").select("*").order("name"), s.from("ag_team").select("id,name").order("name"),
    ]);
    setT({ tasks: tk.data || [], spaces: sp.data || [], statuses: st.data || [], lists: li.data || [], tags: tg.data || [], team: tm.data || [] });
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { if (openTask) setOpenTask(t.tasks.find((x) => x.id === openTask.id) || null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [t.tasks]);

  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const from = `${y}-${pad(m + 1)}-01`, to = `${y}-${pad(m + 1)}-${pad(days)}`;
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d >= 1 && d <= days ? `${y}-${pad(m + 1)}-${pad(d)}` : null; });

  // tarefa aberta vinculada a cada compromisso
  const linkedOpen = (eventId: string) => t.tasks.filter((x) => x.event_id === eventId && !x.done).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0];
  const linkedOn = (eventId: string, date: string) => t.tasks.find((x) => x.event_id === eventId && x.due_date === date);

  const all: E[] = [
    ...ev.rows.flatMap((e) => {
      const loc = toLocal(e.starts_at);
      return occurrences(loc.slice(0, 10), e.recurrence, from, to, e.recurrence_until, e.exdates || []).map((date) => ({
        id: e.id + date, title: e.title, kind: e.kind, date, time: loc.slice(11, 16), ev: e, linked: linkedOn(e.id, date), recurring: !!e.recurrence,
      }));
    }),
    // tarefas com prazo que não são compromissos (os vinculados já aparecem pelo compromisso)
    ...t.tasks.filter((x) => x.due_date && !x.inbox && !x.parent_id && !x.event_id).flatMap((x) => {
      const occ: E[] = x.due_date >= from && x.due_date <= to ? [{ id: "k" + x.id, title: x.title, kind: "tarefa", date: x.due_date, task: x, recurring: !!x.recurrence }] : [];
      if (x.recurrence && !x.done && !x.recur_spawned) {
        // próximas ocorrências previstas (a tarefa real é criada ao concluir a atual)
        occurrences(x.due_date, x.recurrence, from, to, x.recurrence_until).filter((d) => d > x.due_date).forEach((d) => occ.push({ id: "p" + x.id + d, title: x.title, kind: "tarefa", date: d, task: x, projected: true, recurring: true }));
      }
      return occ;
    }),
    ...pr.rows.filter((p) => p.shoot_date).map((p) => ({ id: "s" + p.id, title: p.title, kind: "captacao", date: p.shoot_date, href: `/agency/projetos/${p.id}` })),
    ...pr.rows.filter((p) => p.due_date && p.stage !== "entregue").map((p) => ({ id: "d" + p.id, title: "Entrega: " + p.title, kind: "entrega", date: p.due_date, href: `/agency/projetos/${p.id}` })),
    ...tx.rows.filter((x) => !x.paid && x.kind === "entrada").map((x) => ({ id: "t" + x.id, title: x.description, kind: "pagamento", date: x.due_date, href: "/agency/financeiro" })),
  ].filter((e) => !hidden.includes(e.kind));
  const byDay = (d: string) => all.filter((e) => e.date === d).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  function openNew(date: string) { setForm({ kind: "reuniao", starts_at: date + "T10:00", recurrence: "", as_task: true }); }
  function openEvent(e: E) {
    const r = e.ev;
    setForm({ ...r, starts_at: toLocal(r.starts_at), ends_at: r.ends_at ? toLocal(r.ends_at) : "", recurrence: r.recurrence || "", recurrence_until: r.recurrence_until || "", as_task: !!linkedOpen(r.id) || !!e.linked, occ: r.recurrence ? e.date : null });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const f = form;
    const row: any = {
      id: f.id, title: f.title, kind: f.kind, client_id: f.client_id || null, project_id: f.project_id || null, location: f.location || null, notes: f.notes || null,
      starts_at: new Date(f.starts_at + ":00-03:00").toISOString(), ends_at: f.ends_at ? new Date(f.ends_at + ":00-03:00").toISOString() : null,
      recurrence: f.recurrence || null, recurrence_until: f.recurrence ? f.recurrence_until || null : null,
    };
    const saved = await ev.save(row);
    if (saved) {
      const s = createClient();
      const date = f.starts_at.slice(0, 10);
      // próxima ocorrência a partir de hoje (para séries que começaram no passado)
      const nextOcc = row.recurrence ? (occurrences(date, row.recurrence, td, "2999-12-31", row.recurrence_until, (saved as any).exdates || [])[0] || date) : date;
      const cur = linkedOpen((saved as any).id);
      const taskData = { title: row.title, project_id: row.project_id, recurrence: row.recurrence, recurrence_until: row.recurrence_until };
      if (f.as_task) {
        if (cur) await s.from("ag_tasks").update({ ...taskData, ...(row.recurrence && cur.due_date && cur.due_date >= td ? {} : { due_date: nextOcc }) }).eq("id", cur.id);
        else await s.from("ag_tasks").insert({ ...taskData, event_id: (saved as any).id, due_date: nextOcc, priority: null });
      } else if (cur) {
        await s.from("ag_tasks").delete().eq("id", cur.id);
      }
      await loadTasks(); setForm(null);
    }
    setBusy(false);
  }
  async function removeEvent() {
    const s = createClient();
    await s.from("ag_tasks").delete().eq("event_id", form.id).eq("done", false);
    await ev.remove(form.id); await loadTasks(); setForm(null);
  }
  async function skipOccurrence() {
    const ex = Array.from(new Set([...(form.exdates || []), form.occ]));
    const s = createClient();
    await s.from("ag_events").update({ exdates: ex }).eq("id", form.id);
    // se a tarefa aberta era desta data, pula para a próxima ocorrência
    const cur = linkedOpen(form.id);
    if (cur && cur.due_date === form.occ) {
      const nxt = occurrences(form.starts_at.slice(0, 10), form.recurrence, form.occ, "2999-12-31", form.recurrence_until || null, ex)[0];
      if (nxt) await s.from("ag_tasks").update({ due_date: nxt }).eq("id", cur.id); else await s.from("ag_tasks").delete().eq("id", cur.id);
    }
    await ev.reload(); await loadTasks(); setForm(null);
  }
  async function toggleTask(x: any) {
    setT((p) => ({ ...p, tasks: p.tasks.map((y) => (y.id === x.id ? { ...y, done: !x.done } : y)) }));
    await createClient().from("ag_tasks").update({ done: !x.done }).eq("id", x.id); loadTasks();
  }

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

  const Chip = ({ e }: { e: E }) => {
    const k = KINDS.find((x) => x.k === e.kind);
    const task = e.task || e.linked;
    const done = task?.done && !e.projected;
    return (
      <span className={`flex items-center gap-1 text-[10px] md:text-[11px] rounded px-1 py-0.5 ${e.projected ? "border border-dashed" : ""}`} style={{ background: e.projected ? "transparent" : (k?.c || "#888") + "22", color: k?.c, borderColor: (k?.c || "#888") + "66" }}>
        {task && !e.projected && <span role="checkbox" aria-checked={!!task.done} onClick={(ev2) => { ev2.stopPropagation(); toggleTask(task); }} className="w-2.5 h-2.5 rounded-full border shrink-0 grid place-items-center" style={{ borderColor: k?.c, background: done ? k?.c : "transparent" }} />}
        <span className={`truncate ${done ? "line-through opacity-60" : ""}`}>{e.time ? e.time + " " : ""}{e.title}</span>
        {e.recurring && <Recur className="w-2.5 h-2.5 shrink-0 opacity-70" />}
      </span>
    );
  };

  return (
    <>
      <PageHead kicker="AGENCY · 04 EXECUÇÃO" title="Agenda" desc="Compromissos, tarefas com prazo, captações, entregas e recebimentos no mesmo calendário. Cada compromisso pode virar tarefa e se repetir.">
        <button className="btn btn-mint" onClick={() => openNew(td)}><I.plus className="w-4 h-4" />Novo compromisso</button>
      </PageHead>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(y, m - 1, 1))} className="btn btn-ghost btn-sm"><A.chevL className="w-4 h-4" /></button>
          <p className="font-display font-bold text-xl capitalize w-48 text-center">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          <button onClick={() => setCursor(new Date(y, m + 1, 1))} className="btn btn-ghost btn-sm"><A.chevR className="w-4 h-4" /></button>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="btn btn-ghost btn-sm">Hoje</button>
        </div>
        <div className="flex flex-wrap gap-1.5">{KINDS.map((k) => (
          <button key={k.k} onClick={() => setHidden(hidden.includes(k.k) ? hidden.filter((x) => x !== k.k) : [...hidden, k.k])} className={`chip ${hidden.includes(k.k) ? "opacity-40" : ""}`}><span className="w-2 h-2 rounded-full" style={{ background: k.c }} />{k.l}</button>
        ))}</div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">{WD.map((d) => <p key={d} className="text-[11px] text-fog text-center py-2 uppercase tracking-wider">{d}</p>)}</div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => (
            <div key={i} onClick={() => d && openNew(d)} className={`min-h-[92px] md:min-h-[118px] border-b border-r border-line/60 p-1.5 ${d ? "cursor-pointer hover:bg-panel2/40" : "bg-ink/40"}`}>
              {d && <>
                <p className={`text-xs mb-1 w-6 h-6 grid place-items-center rounded-full ${d === td ? "bg-mint text-black font-bold" : "text-fog"}`}>{Number(d.slice(8))}</p>
                <div className="space-y-0.5">
                  {byDay(d).slice(0, 4).map((e) =>
                    e.href ? <Link key={e.id} href={e.href} onClick={(x) => x.stopPropagation()} className="block"><Chip e={e} /></Link>
                      : <button key={e.id} className="w-full text-left" onClick={(x) => { x.stopPropagation(); e.ev ? openEvent(e) : setOpenTask(e.task); }}><Chip e={e} /></button>
                  )}
                  {byDay(d).length > 4 && <p className="text-[10px] text-fog px-1">+{byDay(d).length - 4}</p>}
                </div>
              </>}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-fog mt-3 flex items-center gap-1.5"><Recur /> repete · contorno tracejado = próxima ocorrência prevista · bolinha = marcar a tarefa como feita</p>

      <Modal open={!!form} title={form?.id ? "Compromisso" : "Novo compromisso"} onClose={() => setForm(null)}>
        {form && <form onSubmit={submit}>
          <Fields fields={fields} value={form} onChange={setForm} />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div><label className="label">Repetir</label><select className="input" value={form.recurrence || ""} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>{RECUR.map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}</select></div>
            {form.recurrence && <div><label className="label">Até (opcional)</label><input type="date" className="input" value={form.recurrence_until || ""} onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })} /></div>}
          </div>
          <label className="flex items-start gap-2.5 mt-4 bg-panel2 rounded-xl p-3 cursor-pointer">
            <input type="checkbox" className="accent-[#6eefb6] mt-0.5" checked={!!form.as_task} onChange={(e) => setForm({ ...form, as_task: e.target.checked })} />
            <span className="text-sm">Mostrar em Tarefas<span className="block text-xs text-fog">O compromisso vira uma tarefa vinculada{form.recurrence ? " que se renova a cada ocorrência ao ser concluída" : ""}. Marque como feita aqui ou em Tarefas.</span></span>
          </label>
          {form.id && form.recurrence && form.occ && <p className="text-xs text-fog mt-3">Você está editando a série inteira ({recurLabel(form.recurrence).toLowerCase()}). Ocorrência clicada: {form.occ.split("-").reverse().join("/")}.</p>}
          {ev.error && <p className="text-danger text-sm mt-3">{ev.error}</p>}
          <div className="flex flex-wrap justify-between gap-2 mt-6">
            <div className="flex gap-2">
              {form.id && <button type="button" className="btn btn-ghost btn-sm" onClick={removeEvent}><I.trash className="w-4 h-4" />{form.recurrence ? "Excluir série" : "Excluir"}</button>}
              {form.id && form.recurrence && form.occ && <button type="button" className="btn btn-ghost btn-sm" onClick={skipOccurrence}>Pular só esta data</button>}
            </div>
            <button disabled={busy} className="btn btn-mint">Salvar</button>
          </div>
        </form>}
      </Modal>

      <TaskDrawer task={openTask} onClose={() => setOpenTask(null)} onChanged={loadTasks} onOpen={setOpenTask} spaces={t.spaces} statuses={t.statuses} lists={t.lists} tags={t.tags} team={t.team} projects={pr.rows} tasks={t.tasks} />
    </>
  );
}
