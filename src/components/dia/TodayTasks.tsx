"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { I } from "@/components/icons";
import { Recur, recurLabel } from "@/components/tasks/shared";
import { syncTask } from "@/lib/gsync";
import { OriginTag, originOf } from "./shared";
import { isProjectsSpace } from "./DiaNav";

/** Hoje · Tarefas: atrasadas e do dia, com check e adicionar rápido */
export default function TodayTasks({ tasks, spaces, statuses, today }: { tasks: any[]; spaces: any[]; statuses: any[]; today: string }) {
  const router = useRouter();
  const [list, setList] = useState(tasks);
  const [draft, setDraft] = useState("");
  const yest = new Date(new Date(today + "T12:00:00Z").getTime() - 864e5).toISOString().slice(0, 10);

  async function toggle(t: any) {
    setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    await createClient().from("ag_tasks").update({ done: !t.done }).eq("id", t.id);
    syncTask(t.id); router.refresh();
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); const title = draft.trim(); if (!title) return;
    const sp = spaces.find((s) => !isProjectsSpace(s) && !s.kind && s.name !== "Rotina") || spaces[0];
    const st = statuses.filter((x) => x.space_id === sp?.id).sort((a, b) => a.position - b.position)[0];
    setDraft("");
    const { data } = await createClient().from("ag_tasks").insert({ title, due_date: today, space_id: sp?.id || null, status_id: st?.id || null, priority: null }).select().single();
    if (data) { setList((l) => [...l, data]); syncTask(data.id); }
    router.refresh();
  }

  return (
    <>
      {!list.length && <p className="text-sm text-fog py-3">Nada para hoje. Tudo em dia.</p>}
      <ul className="divide-y divide-line/60">
        {list.map((t) => {
          const late = !t.done && t.due_date < today;
          const sp = spaces.find((s) => s.id === t.space_id);
          return (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} className="accent-[var(--color-mint)] w-4 h-4 shrink-0" aria-label="Concluir" />
              <Link href={t.project_id ? `/tarefas?projeto=${t.project_id}` : `/tarefas?space=${t.space_id}`} className={`flex-1 min-w-0 truncate text-[15px] hover:text-mint ${t.done ? "line-through text-fog" : ""}`}>{t.title}</Link>
              {late && <span className="text-[11px] text-danger border border-danger/40 rounded-full px-2 py-0.5 whitespace-nowrap">atrasada · {t.due_date === yest ? "ontem" : `${t.due_date.slice(8)}/${t.due_date.slice(5, 7)}`}</span>}
              {t.due_time && !late && <span className="text-[11px] text-mint border border-mint/40 rounded-full px-2 py-0.5">{String(t.due_time).slice(0, 5).replace(":00", "h")}</span>}
              {t.recurrence && <span className="hidden sm:flex items-center gap-1 text-[11px] text-fog border border-line rounded-full px-2 py-0.5 whitespace-nowrap"><Recur /> {recurLabel(t.recurrence).toLowerCase()}</span>}
              <OriginTag tag={originOf(t, sp)} />
            </li>
          );
        })}
      </ul>
      <form onSubmit={add} className="flex items-center gap-2 pt-2 text-fog">
        <I.plus className="w-4 h-4" />
        <input className="flex-1 bg-transparent text-sm py-1.5 outline-none placeholder:text-fog" placeholder="Adicionar tarefa para hoje" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </form>
    </>
  );
}
