import Link from "next/link";
import Logo from "@/components/Logo";
import { I } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { brl, brlShort } from "@/lib/agency";
import { occurrences } from "@/components/tasks/shared";
import { hubAllowed, type Access } from "@/lib/access";

export const dynamic = "force-dynamic";

const hubs = [
  {
    key: "creator", name: "CREATOR", href: "/creator", status: "Ativo",
    desc: "Conteúdo para Instagram em 4 etapas: base, análise, criação e execução.",
    items: ["Perfis", "Briefing", "Desempenho", "Tendências", "Referências", "Formatos criativos", "Laboratório", "Planejador", "Automações"],
    Icon: I.camera,
  },
  {
    key: "agency", name: "AGENCY", href: "/agency", status: "Ativo",
    desc: "Gestão da produtora: operação, comercial e recursos.",
    items: ["Projetos", "Tarefas", "Agenda", "Clientes", "Funil", "Financeiro", "Propostas", "Equipe", "Equipamentos"],
    Icon: I.briefcase,
  },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ bloqueado?: string }> }) {
  const { bloqueado } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: accData } = await supabase.rpc("my_access");
  const acc = (accData || { role: "user", tools: [] }) as Access;
  const isAdmin = acc.role === "superadmin";
  const hasAgency = hubAllowed(acc.tools, "agency");
  const myHubs = hubs.filter((h) => hubAllowed(acc.tools, h.key as "creator" | "agency"));
  const hour = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const h = parseInt(hour);
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  // ───── resumo do dia ─────
  const now = new Date(Date.now() - 3 * 3600e3);
  const today = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const [{ data: settings }, { data: tx }, { data: projects }, { data: events }, { data: tasks }, { data: proposals }, { data: ideas }] = await Promise.all([
    supabase.from("ag_settings").select("monthly_goal").maybeSingle(),
    supabase.from("ag_transactions").select("kind,amount,due_date,paid,description").gte("due_date", new Date(now.getTime() - 365 * 864e5).toISOString().slice(0, 10)).lte("due_date", in7 > `${ym}-31` ? in7 : `${ym}-31`),
    supabase.from("ag_projects").select("id,title,stage,shoot_date,due_date"),
    supabase.from("ag_events").select("id,title,kind,starts_at,recurrence,recurrence_until,exdates,location"),
    supabase.from("ag_tasks").select("id,title,due_date,done,inbox,parent_id,event_id,priority").eq("done", false),
    supabase.from("ag_proposals").select("total,status"),
    supabase.from("content_ideas").select("id,title,format,planned_for,status").gte("planned_for", today).lte("planned_for", in7),
  ]);
  const T = tx || [];
  const faturado = T.filter((t) => t.kind === "entrada" && t.paid && t.due_date.startsWith(ym)).reduce((a, t) => a + Number(t.amount), 0);
  const goal = Number(settings?.monthly_goal) || 0;
  const pct = goal ? Math.min(100, Math.round((faturado / goal) * 100)) : 0;
  const receber7 = T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date >= today && t.due_date <= in7);
  const atrasadoRec = T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date < today).reduce((a, t) => a + Number(t.amount), 0);
  const pagar7 = T.filter((t) => t.kind === "saida" && !t.paid && t.due_date <= in7).reduce((a, t) => a + Number(t.amount), 0);
  const P = projects || [];
  const ativos = P.filter((p) => p.stage !== "entregue");
  const projAtrasados = ativos.filter((p) => p.due_date && p.due_date < today).length;
  const abertas = (proposals || []).filter((p) => ["enviada", "visualizada"].includes(p.status));
  const valorAbertas = abertas.reduce((a, p) => a + Number(p.total || 0), 0);
  const TK = (tasks || []).filter((t) => !t.parent_id && !t.inbox);
  const late = TK.filter((t) => t.due_date && t.due_date < today);
  const dueToday = TK.filter((t) => t.due_date === today);
  const inbox = (tasks || []).filter((t) => t.inbox).length;
  const loc = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
  const agendaHoje = [
    ...(events || []).filter((e) => occurrences(loc(e.starts_at).slice(0, 10), e.recurrence, today, today, e.recurrence_until, e.exdates || []).length).map((e) => ({ t: loc(e.starts_at).slice(11, 16), title: e.title, sub: e.location })),
    ...P.filter((p) => p.shoot_date === today).map((p) => ({ t: "", title: "Captação: " + p.title, sub: null })),
    ...P.filter((p) => p.due_date === today && p.stage !== "entregue").map((p) => ({ t: "", title: "Entrega: " + p.title, sub: null })),
  ].sort((a, b) => (a.t || "99").localeCompare(b.t || "99"));
  const semana = [
    ...P.filter((p) => p.shoot_date && p.shoot_date > today && p.shoot_date <= in7).map((p) => ({ d: p.shoot_date, k: "Captação", c: "#ff6b6b", title: p.title, href: `/agency/projetos/${p.id}` })),
    ...ativos.filter((p) => p.due_date && p.due_date > today && p.due_date <= in7).map((p) => ({ d: p.due_date, k: "Entrega", c: "#6eefb6", title: p.title, href: `/agency/projetos/${p.id}` })),
    ...receber7.map((t) => ({ d: t.due_date, k: brlShort(Number(t.amount)), c: "#7aa7ff", title: t.description, href: "/agency/financeiro" })),
    ...(ideas || []).map((i) => ({ d: i.planned_for, k: i.format || "Post", c: "#c084fc", title: i.title, href: "/creator/pauta" })),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8);
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dShort = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", timeZone: "UTC" }).replace(".", "");

  return (
    <main className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between px-5 md:px-10 py-6 border-b border-line">
        <div className="flex items-center gap-3">
          <Logo className="h-6" />
          <span className="font-mono text-[11px] text-fog border border-line rounded-md px-1.5 py-0.5">HUB</span>
        </div>
        <form action="/auth/signout" method="post" className="flex items-center gap-2 sm:gap-4">
          {isAdmin && <Link href="/admin" className="btn btn-ghost btn-sm text-mint">Admin</Link>}
          <Link href="/conta" className="btn btn-ghost btn-sm">Minha conta</Link>
          <span className="text-xs text-fog hidden sm:block">{user?.email}</span>
          <button className="btn btn-ghost btn-sm"><I.logout className="w-3.5 h-3.5" />Sair</button>
        </form>
      </header>

      <section className="px-5 md:px-10 pt-10 pb-8 max-w-6xl mx-auto">
        <p className="font-mono text-xs text-mint tracking-widest uppercase rise">{greet} · {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-3 rise" style={{ animationDelay: ".05s" }}>{hasAgency ? "Seu dia na VINCIT." : "Bem-vindo ao VINCIT HUB."}</h1>
      </section>

      {bloqueado && <section className="px-5 md:px-10 max-w-6xl mx-auto mb-4"><p className="card p-4 text-sm border-danger/40 text-danger">{bloqueado}. Fale com o administrador para liberar.</p></section>}
      {hasAgency && <>
      <section className="px-5 md:px-10 max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Link href="/agency/financeiro" className="card p-5 rise hover:border-slate">
          <p className="text-xs text-fog">Faturado no mês</p>
          <p className="font-display text-2xl md:text-3xl font-bold mt-1.5 tabular-nums">{brlShort(faturado)}</p>
          {goal > 0 && <><div className="h-1.5 bg-panel2 rounded-full mt-3 overflow-hidden"><div className="h-full bg-mint rounded-full" style={{ width: `${pct}%` }} /></div><p className="text-[11px] text-fog mt-1.5">{pct}% da meta de {brlShort(goal)}</p></>}
        </Link>
        <Link href="/agency/financeiro" className="card p-5 rise hover:border-slate" style={{ animationDelay: ".04s" }}>
          <p className="text-xs text-fog">A receber em 7 dias</p>
          <p className="font-display text-2xl md:text-3xl font-bold mt-1.5 tabular-nums">{brlShort(receber7.reduce((a, t) => a + Number(t.amount), 0))}</p>
          <p className={`text-[11px] mt-2 ${atrasadoRec ? "text-danger" : "text-fog"}`}>{atrasadoRec ? `${brl(atrasadoRec)} atrasado` : `${brlShort(pagar7)} a pagar na semana`}</p>
        </Link>
        <Link href="/agency/projetos" className="card p-5 rise hover:border-slate" style={{ animationDelay: ".08s" }}>
          <p className="text-xs text-fog">Projetos em andamento</p>
          <p className="font-display text-2xl md:text-3xl font-bold mt-1.5 tabular-nums">{ativos.length}</p>
          <p className={`text-[11px] mt-2 ${projAtrasados ? "text-danger" : "text-fog"}`}>{projAtrasados ? `${projAtrasados} com prazo vencido` : "Nenhum atrasado"}</p>
        </Link>
        <Link href="/agency/propostas" className="card p-5 rise hover:border-slate" style={{ animationDelay: ".12s" }}>
          <p className="text-xs text-fog">Propostas em aberto</p>
          <p className="font-display text-2xl md:text-3xl font-bold mt-1.5 tabular-nums">{brlShort(valorAbertas)}</p>
          <p className="text-[11px] text-fog mt-2">{abertas.length} aguardando resposta</p>
        </Link>
      </section>

      <section className="px-5 md:px-10 max-w-6xl mx-auto grid lg:grid-cols-3 gap-3 mb-12">
        <div className="card p-5 rise" style={{ animationDelay: ".14s" }}>
          <div className="flex items-center justify-between mb-3"><h2 className="font-display font-bold">Agenda de hoje</h2><Link href="/agency/agenda" className="text-xs text-fog hover:text-mint">Agenda</Link></div>
          {!agendaHoje.length ? <p className="text-sm text-fog py-4">Nada marcado para hoje.</p> : (
            <ul className="space-y-2">{agendaHoje.map((e, i) => <li key={i} className="flex gap-3 text-sm"><span className="font-mono text-xs text-mint w-10 pt-0.5">{e.t || "dia"}</span><div className="min-w-0"><p className="truncate">{e.title}</p>{e.sub && <p className="text-xs text-fog truncate">{e.sub}</p>}</div></li>)}</ul>
          )}
        </div>
        <div className="card p-5 rise" style={{ animationDelay: ".18s" }}>
          <div className="flex items-center justify-between mb-3"><h2 className="font-display font-bold">Tarefas</h2><Link href="/agency/tarefas" className="text-xs text-fog hover:text-mint">Abrir</Link></div>
          <div className="flex gap-2 mb-3 text-xs">
            <span className={`chip ${late.length ? "text-danger border-danger/40" : ""}`}>{late.length} atrasadas</span>
            <span className="chip chip-mint">{dueToday.length} para hoje</span>
            {inbox > 0 && <span className="chip">{inbox} no Inbox</span>}
          </div>
          {![...late, ...dueToday].length ? <p className="text-sm text-fog py-2">Tudo em dia.</p> : (
            <ul className="space-y-1.5">{[...late, ...dueToday].slice(0, 6).map((t) => <li key={t.id} className="flex items-center gap-2 text-sm"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.due_date < today ? "bg-danger" : "bg-mint"}`} /><span className="truncate flex-1">{t.title}</span>{t.due_date < today && <span className="text-[10px] text-danger">{t.due_date.slice(8)}/{t.due_date.slice(5, 7)}</span>}</li>)}</ul>
          )}
        </div>
        <div className="card p-5 rise" style={{ animationDelay: ".22s" }}>
          <h2 className="font-display font-bold mb-3">Próximos 7 dias</h2>
          {!semana.length ? <p className="text-sm text-fog py-4">Semana livre de entregas, captações e recebimentos.</p> : (
            <ul className="space-y-2">{semana.map((x, i) => <li key={i}><Link href={x.href} className="flex items-center gap-3 text-sm hover:text-mint"><span className="text-[11px] text-fog w-12 capitalize">{dShort(x.d)}</span><span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: x.c + "22", color: x.c }}>{x.k}</span><span className="truncate">{x.title}</span></Link></li>)}</ul>
          )}
        </div>
      </section>

      </>}
      <section className="px-5 md:px-10 max-w-6xl mx-auto mb-4"><p className="label">Hubs</p></section>
      <section className="px-5 md:px-10 pb-20 max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
        {myHubs.map((hub, i) => {
          const active = hub.status === "Ativo";
          return (
            <Link key={hub.key} href={hub.href}
              className={`group card relative overflow-hidden p-7 md:p-8 rise transition-all ${active ? "hover:border-mint" : "hover:border-slate"}`}
              style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
              <div className={`absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl transition-opacity ${active ? "bg-mint/10 group-hover:bg-mint/20" : "bg-slate/20"}`} />
              <div className="relative flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl grid place-items-center ${active ? "bg-mint text-black" : "bg-panel2 text-fog border border-line"}`}>
                  <hub.Icon className="w-6 h-6" />
                </div>
                <span className={`chip ${active ? "chip-mint" : ""}`}>{active && <span className="w-1.5 h-1.5 rounded-full bg-mint" />}{hub.status}</span>
              </div>
              <h2 className="relative font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-8">{hub.name}</h2>
              <p className="relative text-fog mt-2 text-[15px] leading-relaxed max-w-md">{hub.desc}</p>
              <div className="relative flex flex-wrap gap-1.5 mt-6">
                {hub.items.map((it) => <span key={it} className="chip">{it}</span>)}
              </div>
              <div className={`relative mt-8 flex items-center gap-2 text-sm font-semibold ${active ? "text-mint" : "text-fog"}`}>
                {active ? "Abrir hub" : "Ver o que vem"} <I.arrow className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
