import Link from "next/link";
import { I } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { brl, brlShort } from "@/lib/agency";
import { occurrences } from "@/components/tasks/shared";
import { hubAllowed, type Access } from "@/lib/access";
import TodayTasks from "@/components/dia/TodayTasks";
import AgendaHoje, { type AgendaItem } from "@/components/dia/AgendaHoje";
import Avisos, { type Aviso } from "@/components/dia/Avisos";
import { addDays, monday, todayBR, WD3 } from "@/components/dia/shared";

export const dynamic = "force-dynamic";

const PUBLISHED = ["publicado", "analisado"];

export default async function Resumo({ searchParams }: { searchParams: Promise<{ bloqueado?: string }> }) {
  const { bloqueado } = await searchParams;
  const supabase = await createClient();
  const { data: accData } = await supabase.rpc("my_access");
  const acc = (accData || { role: "user", tools: [] }) as Access;
  const hasAgency = hubAllowed(acc.tools, "agency");
  const hasCreator = hubAllowed(acc.tools, "creator");
  const h = parseInt(new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  const today = todayBR();
  const start = monday(today), end = addDays(start, 6);
  const ym = today.slice(0, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [{ data: settings }, { data: tx }, { data: projects }, { data: events }, { data: tasks }, { data: proposals }, { data: content }, { data: spaces }, { data: statuses }, cst] = await Promise.all([
    supabase.from("ag_settings").select("monthly_goal").maybeSingle(),
    hasAgency ? supabase.from("ag_transactions").select("id,kind,amount,due_date,paid,description").is("transfer_id", null).gte("due_date", `${ym}-01` < start ? `${ym}-01` : start).lte("due_date", end > `${ym}-31` ? end : `${ym}-31`) : Promise.resolve({ data: [] as any[] }),
    supabase.from("ag_projects").select("id,title,stage,shoot_date,due_date,revisions"),
    supabase.from("ag_events").select("id,title,kind,starts_at,recurrence,recurrence_until,exdates,location"),
    supabase.from("ag_tasks").select("*").is("parent_id", null),
    hasAgency ? supabase.from("ag_proposals").select("id,title,total,status,created_at") : Promise.resolve({ data: [] as any[] }),
    hasCreator ? supabase.from("content_ideas").select("*") : Promise.resolve({ data: [] as any[] }),
    supabase.from("ag_spaces").select("*").order("position"),
    supabase.from("ag_space_statuses").select("*").order("position"),
    hasCreator ? supabase.from("content_statuses").select("*").order("position") : Promise.resolve({ data: null, error: true }),
  ]);
  const loc0 = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
  const T = tx || [], P = projects || [], TK = (tasks || []).filter((t) => !t.inbox && (!t.done || (t.done_at && loc0(t.done_at).slice(0, 10) === today))), C = (content || []).filter((c: any) => !c.archived_at);
  const statusList: any[] | null = (cst as any).error ? null : (cst as any).data;
  const stageOf = (c: any) => (statusList ? statusList.find((s) => s.id === c.status_id)?.stage : c.status) || "";
  const isPublished = (c: any) => PUBLISHED.includes(stageOf(c));
  const loc = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
  const evOn = (d: string) => (events || []).filter((e) => occurrences(loc(e.starts_at).slice(0, 10), e.recurrence, d, d, e.recurrence_until, e.exdates || []).length);

  // ── hoje ──
  const open = TK.filter((t) => !t.done);
  const late = open.filter((t) => t.due_date && t.due_date < today);
  const todayTasks = [...late, ...TK.filter((t) => t.due_date === today)].sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.due_date || "").localeCompare(b.due_date || ""));
  const pubToday = C.filter((c) => c.planned_for === today && !isPublished(c));
  const shootsToday = evOn(today).filter((e) => e.kind === "captacao").map((e) => loc(e.starts_at).slice(11, 16));
  const projShoots = P.filter((p) => p.shoot_date === today);
  const agenda: AgendaItem[] = [
    ...evOn(today).map((e) => ({ t: loc(e.starts_at).slice(11, 16), title: e.title, sub: e.location, c: e.kind === "captacao" ? "#ff6b6b" : e.kind === "reuniao" ? "#f5c84c" : "#8a8f94", href: "/agenda" })),
    ...projShoots.map((p) => ({ t: "", title: "Captação · " + p.title, sub: "Projeto", c: "#ff6b6b", href: `/tarefas?projeto=${p.id}` })),
    ...P.filter((p) => p.due_date === today && p.stage !== "entregue").map((p) => ({ t: "", title: "Entrega · " + p.title, sub: "Projeto", c: "#6eefb6", href: `/tarefas?projeto=${p.id}` })),
    ...C.filter((c) => c.record_date === today).map((c) => ({ t: "", title: "Gravação · " + c.title, sub: c.format || "Conteúdo", c: "#ff6b6b", href: "/creator/producao?c=" + c.id })),
    ...pubToday.map((c) => ({ t: "", title: "Publicar: " + c.title, sub: c.format || "Conteúdo", c: "#c084fc", href: statusList ? "/creator/producao?c=" + c.id : "/creator/pauta" })),
  ];
  const gravacoes = shootsToday.length + projShoots.length + C.filter((c) => c.record_date === today).length;
  const agora = [
    late.length ? { t: `${late.length} tarefa${late.length > 1 ? "s" : ""} atrasada${late.length > 1 ? "s" : ""}`, red: true } : null,
    pubToday.length ? { t: `${pubToday.length} conteúdo${pubToday.length > 1 ? "s" : ""} para publicar hoje` } : null,
    gravacoes ? { t: `${gravacoes} gravaç${gravacoes > 1 ? "ões" : "ão"}${shootsToday[0] ? ` às ${shootsToday.sort()[0].replace(":00", "h")}` : " hoje"}` } : null,
    !late.length && TK.some((t) => t.due_date === today && !t.done) ? { t: `${TK.filter((t) => t.due_date === today && !t.done).length} tarefa(s) para hoje` } : null,
  ].filter(Boolean) as { t: string; red?: boolean }[];

  // ── avisos calculados (até a tabela de avisos existir) ──
  const lateContent = C.filter((c) => c.planned_for && c.planned_for < today && !isPublished(c));
  const fallback: Aviso[] = [
    ...lateContent.slice(0, 4).map((c) => ({ id: "c" + c.id, title: `"${c.title}" passou da data de publicação`, href: statusList ? "/creator/producao?c=" + c.id : "/creator/pauta", action: "Abrir conteúdo", tone: "danger" as const })),
    ...C.filter((c) => Number(c.revisions) > 3).map((c) => ({ id: "r" + c.id, title: `"${c.title}" passou de 3 revisões`, href: "/creator/producao?c=" + c.id, action: "Abrir conteúdo", tone: "warn" as const })),
    ...P.filter((p) => Number(p.revisions) > 3 && p.stage !== "entregue").map((p) => ({ id: "p" + p.id, title: `${p.title} passou de 3 revisões`, href: `/tarefas?projeto=${p.id}`, action: "Abrir projeto", tone: "warn" as const })),
    ...T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date < today).slice(0, 4).map((t) => ({ id: "t" + t.id, title: `Cobrança ${t.description ? `de ${t.description} ` : ""}venceu em ${t.due_date.slice(8)}/${t.due_date.slice(5, 7)}`, href: "/agency/financeiro", action: "Abrir Financeiro", tone: "danger" as const })),
    ...(proposals || []).filter((p) => ["enviada", "visualizada"].includes(p.status) && p.created_at < new Date(Date.now() - 5 * 864e5).toISOString()).map((p) => ({ id: "x" + p.id, title: `Proposta ${p.title || ""} sem resposta há ${Math.floor((Date.now() - new Date(p.created_at).getTime()) / 864e5)} dias`, href: `/agency/propostas/${p.id}`, action: "Abrir proposta", tone: "muted" as const })),
  ];

  // ── semana ──
  const week = days.map((d) => {
    const nt = open.filter((t) => t.due_date === d).length + TK.filter((t) => t.done && t.due_date === d).length;
    const ev = evOn(d);
    const grav = ev.filter((e) => e.kind === "captacao").length + P.filter((p) => p.shoot_date === d).length + C.filter((c) => c.record_date === d).length;
    const reun = ev.filter((e) => e.kind !== "captacao").length;
    const pub = C.filter((c) => c.planned_for === d).length;
    const rec = T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date === d).reduce((a, t) => a + Number(t.amount), 0);
    return { d, nt, grav, reun, pub, rec };
  });

  // ── conteúdo ──
  const contentCols: { l: string; n: number }[] = statusList
    ? statusList.filter((s) => s.stage !== "analisado").map((s) => ({ l: s.name, n: C.filter((c) => c.status_id === s.id).length })).filter((x, i, a) => x.n || a.length <= 5 || i < 5).slice(0, 6)
    : [["backlog", "Ideia"], ["produzindo", "Produção"], ["agendado", "Agendado"], ["publicado", "Publicado"]].map(([k, l]) => ({ l, n: C.filter((c) => (c.status || "backlog") === k).length }));

  // ── comercial ──
  const faturado = T.filter((t) => t.kind === "entrada" && t.paid && t.due_date.startsWith(ym)).reduce((a, t) => a + Number(t.amount), 0);
  const goal = Number(settings?.monthly_goal) || 0;
  const pct = goal ? Math.min(100, Math.round((faturado / goal) * 100)) : 0;
  const in7 = addDays(today, 7);
  const receber7 = T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date >= today && t.due_date <= in7).reduce((a, t) => a + Number(t.amount), 0);
  const vencidas = T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date < today);

  // ── rotina ──
  const rotina = (spaces || []).find((s) => s.kind === "rotina" || s.name === "Rotina");
  const rotWeek = rotina ? (tasks || []).filter((t) => t.space_id === rotina.id && t.due_date && t.due_date >= start && t.due_date <= end) : [];
  const rotDone = rotWeek.filter((t) => t.done).length;
  const rotNext = rotWeek.filter((t) => !t.done).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const dateLabel = new Date(today + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const kicker = "font-mono text-[11px] tracking-widest uppercase text-fog";

  return (
    <>
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 rise">
        <div>
          <p className="font-mono text-[11px] text-mint tracking-widest uppercase">{greet} · {dateLabel}</p>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mt-2">Seu dia na VINCIT</h1>
          <p className="mt-3 text-[15px] md:text-base">
            {agora.length ? agora.map((a, i) => <span key={i}>{i > 0 && <span className="text-fog"> · </span>}<span className={a.red ? "text-danger" : ""}>{a.t}</span></span>) : <span className="text-fog">Nada pedindo atenção agora. Bom momento para planejar.</span>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/rotina" className="btn btn-ghost">Planejar a semana</Link>
          <Link href="/tarefas?nova=1" className="btn btn-mint"><I.plus className="w-4 h-4" />Nova tarefa</Link>
        </div>
      </section>

      {bloqueado && <p className="card p-4 mb-4 text-sm border-danger/40 text-danger">{bloqueado}. Fale com o administrador para liberar.</p>}

      <section className="grid lg:grid-cols-[3fr_2fr] gap-4 mb-4">
        <div className="card p-5 rise">
          <div className="flex items-center justify-between mb-2"><p className={kicker}>Hoje · Tarefas</p><Link href="/tarefas" className="text-xs text-fog hover:text-mint">Abrir Tarefas</Link></div>
          <TodayTasks tasks={todayTasks} spaces={spaces || []} statuses={statuses || []} today={today} />
        </div>
        <div className="card p-5 rise" style={{ animationDelay: ".04s" }}>
          <div className="flex items-center justify-between mb-2"><p className={kicker}>Hoje · Agenda</p><Link href="/agenda" className="text-xs text-fog hover:text-mint">Abrir Agenda</Link></div>
          <AgendaHoje items={agenda} today={today} />
        </div>
      </section>

      <section className="card p-5 mb-4 rise" style={{ animationDelay: ".08s" }}>
        <Avisos fallback={fallback} />
      </section>

      <section className="card p-5 mb-4 rise" style={{ animationDelay: ".12s" }}>
        <div className="flex items-center justify-between mb-3"><p className={kicker}>Semana</p><Link href="/tarefas?view=semana" className="text-xs text-fog hover:text-mint">Abrir visão Semana</Link></div>
        <div className="grid grid-flow-col auto-cols-[minmax(110px,1fr)] gap-2 overflow-x-auto scroll-thin pb-1">
          {week.map((w, i) => {
            const empty = !w.nt && !w.grav && !w.reun && !w.pub && !w.rec;
            return (
              <Link key={w.d} href="/tarefas?view=semana" className={`rounded-xl border p-3 text-sm hover:border-slate ${w.d === today ? "border-mint/60 bg-mint/5" : "border-line"} ${empty ? "opacity-60" : ""}`}>
                <p className={`font-mono text-[11px] tracking-widest ${w.d === today ? "text-mint" : "text-fog"}`}>{WD3[(i + 1) % 7]} {w.d.slice(8)}</p>
                <div className="mt-1.5 space-y-0.5 text-[13px] text-fog">
                  {empty && <p>livre</p>}
                  {w.nt > 0 && <p>{w.nt} tarefa{w.nt > 1 ? "s" : ""}</p>}
                  {w.grav > 0 && <p>{w.grav} gravaç{w.grav > 1 ? "ões" : "ão"}</p>}
                  {w.reun > 0 && <p>{w.reun} compromisso{w.reun > 1 ? "s" : ""}</p>}
                  {w.pub > 0 && <p className="text-[#c084fc]">{w.pub} publicaç{w.pub > 1 ? "ões" : "ão"}</p>}
                  {w.rec > 0 && <p className="text-mint">{brlShort(w.rec)} a receber</p>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={`grid gap-4 mb-12 ${hasCreator && hasAgency ? "lg:grid-cols-[5fr_4fr_3fr]" : "lg:grid-cols-2"}`}>
        {hasCreator && (
          <div className="card p-5 rise">
            <div className="flex items-center justify-between mb-3"><p className={kicker}>Conteúdo</p><Link href={statusList ? "/creator/producao" : "/creator/pauta"} className="text-xs text-fog hover:text-mint">{statusList ? "Quadro de produção" : "Planejador"}</Link></div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {contentCols.map((c) => <div key={c.l}><p className="text-xs text-fog truncate">{c.l}</p><p className="font-display text-2xl font-bold tabular-nums">{c.n}</p></div>)}
            </div>
            {lateContent.length > 0 && <p className="text-xs text-danger mt-2">{lateContent.length} atrasado{lateContent.length > 1 ? "s" : ""}</p>}
          </div>
        )}
        {hasAgency && (
          <Link href="/agency/financeiro" className="card p-5 rise hover:border-slate">
            <p className={kicker + " mb-3"}>Comercial</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-fog">Faturado no mês</p>
                <p className="font-display text-2xl font-bold tabular-nums mt-1">{brlShort(faturado)}</p>
                {goal > 0 && <><div className="h-1.5 bg-panel2 rounded-full mt-2 overflow-hidden"><div className="h-full bg-mint rounded-full" style={{ width: `${pct}%` }} /></div><p className="text-[11px] text-fog mt-1">{pct}% da meta</p></>}
              </div>
              <div>
                <p className="text-xs text-fog">A receber em 7 dias</p>
                <p className="font-display text-2xl font-bold tabular-nums mt-1">{brlShort(receber7)}</p>
                {vencidas.length > 0 && <p className="text-[11px] text-danger mt-1">{vencidas.length} vencida{vencidas.length > 1 ? "s" : ""} · {brl(vencidas.reduce((a, t) => a + Number(t.amount), 0))}</p>}
              </div>
            </div>
          </Link>
        )}
        <Link href="/rotina" className="card p-5 rise hover:border-slate">
          <p className={kicker + " mb-3"}>Rotina da semana</p>
          {rotWeek.length ? <>
            <p className="font-display text-2xl font-bold">{rotDone} de {rotWeek.length}</p>
            <div className="h-1.5 bg-panel2 rounded-full mt-2 overflow-hidden"><div className="h-full bg-[#f5c84c] rounded-full" style={{ width: `${(rotDone / rotWeek.length) * 100}%` }} /></div>
            <p className="text-xs text-fog mt-2 truncate">{rotNext ? `Próxima: ${rotNext.title}` : "Rotina da semana feita."}</p>
          </> : <p className="text-sm text-fog">Ligue rotinas prontas, como planejar a semana e o relatório de sexta.</p>}
        </Link>
      </section>
    </>
  );
}
