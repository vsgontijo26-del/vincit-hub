"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Flag, Recur, recurLabel } from "./shared";
import { syncTask } from "@/lib/gsync";

const WD = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** segunda-feira da semana de d */
const monday = (d: string) => { const w = new Date(d + "T12:00:00Z").getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };

type Props = { tasks: any[]; statusById: Record<string, any>; spaces: any[]; today: string; showDone: boolean; onOpen: (t: any) => void; onToggle: (t: any) => void; onChanged: () => void };

/** Visão Semana: tarefas por dia de prazo; arrastar muda o prazo */
export default function WeekView({ tasks, statusById, spaces, today, showDone, onOpen, onToggle, onChanged }: Props) {
  const [start, setStart] = useState(() => monday(today));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string | null>>({});
  const end = addDays(start, 6);
  const isCurrent = start === monday(today);
  const due = (t: any) => (t.id in local ? local[t.id] : t.due_date);
  const open = tasks.filter((t) => showDone || !t.done);

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const late = isCurrent ? open.filter((t) => !t.done && due(t) && due(t)! < start) : [];
  const cols: { key: string; label: string; sub?: string; date: string | null; items: any[]; tone?: string }[] = [
    ...(late.length ? [{ key: "late", label: "Atrasadas", date: null as string | null, items: late, tone: "danger" }] : []),
    ...days.map((d, i) => ({ key: d, label: WD[i], sub: d.slice(8) + "/" + d.slice(5, 7), date: d, items: open.filter((t) => due(t) === d) })),
    { key: "none", label: "Sem data", date: null, items: open.filter((t) => !due(t) && !t.done) },
  ];

  const week = tasks.filter((t) => due(t) && due(t)! >= start && due(t)! <= end);
  const doneWeek = tasks.filter((t) => t.done && t.done_at && t.done_at.slice(0, 10) >= start && t.done_at.slice(0, 10) <= end).length;
  const openWeek = week.filter((t) => !t.done).length;

  async function setDue(ids: string[], date: string | null) {
    if (!ids.length) return;
    setLocal((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, date])) }));
    await createClient().from("ag_tasks").update({ due_date: date }).in("id", ids);
    ids.forEach(syncTask);
    onChanged();
  }
  function drop(c: (typeof cols)[number]) {
    if (drag && c.key !== "late") setDue([drag], c.date);
    setDrag(null); setOver(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button className="btn btn-ghost btn-sm" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior">‹</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setStart(monday(today))} disabled={isCurrent}>Esta semana</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setStart(addDays(start, 7))} aria-label="Próxima semana">›</button>
        <span className="text-sm text-fog">{start.slice(8)}/{start.slice(5, 7)} a {end.slice(8)}/{end.slice(5, 7)}</span>
        <span className="text-xs text-fog ml-auto">{doneWeek} concluídas · {openWeek} abertas na semana</span>
        {late.length > 0 && <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDue(late.map((t) => t.id), today)}>Mover {late.length} atrasada{late.length > 1 ? "s" : ""} para hoje</button>}
      </div>
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-4 -mx-1 px-1">
        {cols.map((c) => (
          <div key={c.key} onDragOver={(e) => { e.preventDefault(); setOver(c.key); }} onDragLeave={() => setOver(null)} onDrop={() => drop(c)}
            className={`w-[190px] shrink-0 rounded-xl p-2 border ${over === c.key && c.key !== "late" ? "border-mint/60" : "border-line"} ${c.date === today ? "bg-mint/5" : "bg-panel/60"}`}>
            <div className="flex items-baseline gap-1.5 px-1 pb-2 mb-1 border-b border-line">
              <span className={`text-xs font-bold uppercase tracking-wide ${c.tone ? "text-danger" : c.date === today ? "text-mint" : ""}`}>{c.label}</span>
              {c.sub && <span className="text-[11px] text-fog">{c.sub}</span>}
              <span className="text-[11px] text-fog ml-auto">{c.items.length}</span>
            </div>
            <div className="space-y-1.5 min-h-[60px]">
              {c.items.sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.position - b.position)).map((t) => {
                const st = statusById[t.status_id];
                const sp = spaces.find((s) => s.id === t.space_id);
                return (
                  <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => onOpen(t)}
                    className={`bg-panel2 border border-line rounded-lg p-2 cursor-grab hover:border-slate ${drag === t.id ? "opacity-40" : ""}`}>
                    <div className="flex items-start gap-2">
                      <button onClick={(e) => { e.stopPropagation(); onToggle(t); }} title={t.done ? "Reabrir" : "Concluir"} className="mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 grid place-items-center text-[8px] text-ink" style={{ borderColor: st?.color || "#8a8f94", background: t.done ? st?.color || "#8a8f94" : "transparent" }}>{t.done && "✓"}</button>
                      <p className={`text-[13px] leading-snug flex-1 ${t.done ? "line-through text-fog" : ""}`}>{t.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-fog">
                      {sp && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sp.color }} title={sp.name} />}
                      {c.key === "late" && <span className="text-danger">{t.due_date.slice(8)}/{t.due_date.slice(5, 7)}</span>}
                      {t.assignee && <span className="truncate">{t.assignee}</span>}
                      {t.recurrence && <span title={recurLabel(t.recurrence)}><Recur /></span>}
                      <span className="ml-auto"><Flag p={t.priority} className="w-3 h-3" /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-fog">Arraste uma tarefa para outro dia para mudar o prazo, ou para &quot;Sem data&quot; para tirar o prazo.</p>
    </div>
  );
}
