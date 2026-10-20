"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHead from "@/components/PageHead";
import { RoutinesPanel } from "@/components/tasks/Routines";
import { syncTask } from "@/lib/gsync";
import { OriginTag, addDays, monday, originOf, tagOf, todayBR, wd } from "@/components/dia/shared";
import { brlShort } from "@/lib/agency";
import { useAccess } from "@/lib/useAccess";
import { hubAllowed } from "@/lib/access";

/** Rotina: planejar a semana (segunda) e revisar o que foi feito (sexta) */
export default function Rotina() {
  const td = todayBR();
  const start = monday(td), end = addDays(start, 6);
  const acc = useAccess();
  const gestor = !acc || hubAllowed(acc.tools, "agency");
  const [mode, setMode] = useState<"planejar" | "revisar">(() => (["5", "6", "0"].includes(String(new Date(td + "T12:00:00Z").getUTCDay())) ? "revisar" : "planejar"));
  const [d, setD] = useState<{ tasks: any[]; spaces: any[]; statuses: any[]; content: any[]; tx: any[] }>({ tasks: [], spaces: [], statuses: [], content: [], tx: [] });
  const [pick, setPick] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = createClient();
    const [tk, sp, st, ct, tx] = await Promise.all([
      s.from("ag_tasks").select("*"),
      s.from("ag_spaces").select("*").order("position"),
      s.from("ag_space_statuses").select("*").order("position"),
      s.from("content_ideas").select("*").gte("planned_for", start).lte("planned_for", end),
      s.from("ag_transactions").select("id,description,amount,due_date,paid,kind").eq("kind", "entrada").eq("paid", false).is("transfer_id", null).gte("due_date", start).lte("due_date", end),
    ]);
    setD({ tasks: tk.data || [], spaces: sp.data || [], statuses: st.data || [], content: ct.data || [], tx: tx.data || [] });
  }, [start, end]);
  useEffect(() => { load(); }, [load]);

  const spaceOf = (t: any) => d.spaces.find((s) => s.id === t.space_id);
  const top = d.tasks.filter((t) => !t.parent_id && !t.inbox);
  const leftover = top.filter((t) => !t.done && t.due_date && t.due_date < start);
  const thisWeek = top.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end);
  const published = d.content.filter((c) => ["publicado", "analisado"].includes(c.status || "") || c.published_at);
  const due = [
    ...thisWeek.filter((t) => !t.done).map((t) => ({ d: t.due_date, title: t.title, tag: originOf(t, spaceOf(t)), href: `/tarefas?${t.project_id ? `projeto=${t.project_id}` : `space=${t.space_id}`}` })),
    ...d.content.filter((c) => !published.includes(c)).map((c) => ({ d: c.planned_for, title: "Publicar: " + c.title, tag: tagOf("conteudo"), href: "/creator/pauta" })),
    ...(gestor ? d.tx.map((x) => ({ d: x.due_date, title: `Vence cobrança · ${x.description || brlShort(x.amount)}`, tag: tagOf("gestor"), href: "/agency/financeiro" })) : []),
  ].sort((a, b) => a.d.localeCompare(b.d));

  async function setDue(ids: string[], date: string | null) {
    if (!ids.length) return;
    setD((p) => ({ ...p, tasks: p.tasks.map((t) => (ids.includes(t.id) ? { ...t, due_date: date } : t)) }));
    await createClient().from("ag_tasks").update({ due_date: date }).in("id", ids);
    ids.forEach((id) => syncTask(id)); setPick(null); load();
  }
  async function toggle(t: any) {
    setD((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)) }));
    await createClient().from("ag_tasks").update({ done: !t.done }).eq("id", t.id); syncTask(t.id); load();
  }

  const doneWeek = top.filter((t) => t.done && t.done_at && t.done_at.slice(0, 10) >= start && t.done_at.slice(0, 10) <= end);
  const openWeek = thisWeek.filter((t) => !t.done);
  const Check = ({ t }: { t: any }) => <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} className="accent-[var(--color-mint)] w-4 h-4 shrink-0" />;
  const Pill = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button onClick={onClick} className="text-xs border border-line rounded-full px-2.5 py-1 hover:border-slate hover:text-paper whitespace-nowrap">{children}</button>;

  return (
    <>
      <PageHead kicker="SEU DIA · ROTINA" title={mode === "planejar" ? "Planejamento da semana" : "Revisão da semana"} desc="Segunda é dia de organizar a semana. Sexta, de revisar o que foi feito.">
        <div className="flex bg-panel2 border border-line rounded-xl p-1">
          {(["planejar", "revisar"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 text-sm rounded-lg ${mode === m ? "bg-ink text-paper font-semibold" : "text-fog"}`}>{m === "planejar" ? "Planejar · segunda" : "Revisar · sexta"}</button>)}
        </div>
      </PageHead>

      {mode === "planejar" ? (
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <section className="card p-5">
            <p className="font-mono text-[11px] tracking-widest uppercase text-danger mb-3">Ficou da semana passada · {leftover.length}</p>
            {!leftover.length ? <p className="text-sm text-fog py-4">Nada pendente da semana passada.</p> : (
              <ul className="divide-y divide-line/60">{leftover.map((t) => (
                <li key={t.id} className="py-2.5 flex flex-wrap items-center gap-2">
                  <Check t={t} /><span className="text-[15px] flex-1 min-w-[140px] truncate">{t.title}</span>
                  <Pill onClick={() => setDue([t.id], td)}>Para hoje</Pill>
                  {pick === t.id
                    ? <input type="date" autoFocus className="input !py-1 !w-auto text-xs" min={td} onChange={(e) => e.target.value && setDue([t.id], e.target.value)} onBlur={() => setPick(null)} />
                    : <Pill onClick={() => setPick(t.id)}>Escolher dia</Pill>}
                  <Pill onClick={() => setDue([t.id], null)}>Tirar prazo</Pill>
                </li>
              ))}</ul>
            )}
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3"><p className="font-mono text-[11px] tracking-widest uppercase text-fog">Vence nesta semana · {due.length}</p><Link href="/tarefas?view=semana" className="text-xs text-fog hover:text-mint">Ver na visão Semana</Link></div>
            {!due.length ? <p className="text-sm text-fog py-4">Nada com prazo nesta semana.</p> : (
              <ul className="divide-y divide-line/60">{due.map((x, i) => (
                <li key={i}><Link href={x.href} className="py-2.5 flex items-center gap-4 hover:text-mint">
                  <span className={`font-mono text-[11px] w-8 ${x.d === td ? "text-mint" : "text-fog"}`}>{wd(x.d)}</span>
                  <span className="text-[15px] flex-1 truncate">{x.title}</span><OriginTag tag={x.tag} />
                </Link></li>
              ))}</ul>
            )}
          </section>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 mb-4">
          <section className="card p-5">
            <p className="font-mono text-[11px] tracking-widest uppercase text-fog">Concluídas na semana</p>
            <p className="font-display text-4xl font-bold mt-2 tabular-nums text-mint">{doneWeek.length}</p>
            <ul className="mt-3 space-y-1 text-sm text-fog">{doneWeek.slice(0, 6).map((t) => <li key={t.id} className="truncate line-through">{t.title}</li>)}</ul>
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between"><p className="font-mono text-[11px] tracking-widest uppercase text-fog">Ficaram abertas</p>
              {openWeek.length > 0 && <button onClick={() => setDue(openWeek.map((t) => t.id), addDays(start, 7))} className="text-xs text-mint hover:underline">Jogar para a próxima semana</button>}</div>
            <p className="font-display text-4xl font-bold mt-2 tabular-nums">{openWeek.length}</p>
            <ul className="mt-3 space-y-1.5">{openWeek.slice(0, 6).map((t) => <li key={t.id} className="flex items-center gap-2 text-sm"><Check t={t} /><span className="truncate">{t.title}</span></li>)}</ul>
          </section>
          <section className="card p-5">
            <p className="font-mono text-[11px] tracking-widest uppercase text-fog">Conteúdos da semana</p>
            <p className="font-display text-4xl font-bold mt-2 tabular-nums">{published.length}<span className="text-lg text-fog font-normal"> de {d.content.length}</span></p>
            <p className="text-sm text-fog mt-2">publicados entre {start.slice(8)}/{start.slice(5, 7)} e {end.slice(8)}/{end.slice(5, 7)}.</p>
          </section>
        </div>
      )}

      <section className="card p-5">
        <p className="font-mono text-[11px] tracking-widest uppercase text-fog mb-4">Rotinas · modelos prontos</p>
        <RoutinesPanel wide spaces={d.spaces} statuses={d.statuses} tasks={d.tasks} today={td} onChanged={load} />
      </section>
    </>
  );
}
