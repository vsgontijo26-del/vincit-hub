import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/PageHead";
import { brl, brlShort, dtShort, stageLabel, EVENT_KINDS, DEAL_STAGES } from "@/lib/agency";

export const dynamic = "force-dynamic";

export default async function AgencyHome() {
  const s = await createClient();
  const now = new Date(Date.now() - 3 * 3600e3);
  const today = now.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
  const in14 = new Date(now.getTime() + 14 * 864e5).toISOString();

  const [{ data: settings }, { data: tx }, { data: projects }, { data: events }, { data: tasks }, { data: deals }, { data: clients }] = await Promise.all([
    s.from("ag_settings").select("*").maybeSingle(),
    s.from("ag_transactions").select("kind,amount,due_date,paid,paid_at,client_id").is("transfer_id", null).gte("due_date", sixAgo),
    s.from("ag_projects").select("id,title,stage,due_date,revisions,delivered_at,value,client_id,ag_clients(name)").order("due_date", { ascending: true }),
    s.from("ag_events").select("id,title,kind,starts_at").gte("starts_at", now.toISOString().slice(0, 10)).lte("starts_at", in14).order("starts_at").limit(6),
    s.from("ag_tasks").select("id,title,due_date,done,assignee").eq("done", false).order("due_date", { ascending: true }).limit(50),
    s.from("ag_deals").select("value,stage"),
    s.from("ag_clients").select("id,name,status"),
  ]);

  const T = tx || [];
  const month = T.filter((t) => t.due_date.startsWith(today.slice(0, 7)));
  const faturado = month.filter((t) => t.kind === "entrada" && t.paid).reduce((a, t) => a + Number(t.amount), 0);
  const aReceber = T.filter((t) => t.kind === "entrada" && !t.paid).reduce((a, t) => a + Number(t.amount), 0);
  const atrasado = T.filter((t) => t.kind === "entrada" && !t.paid && t.due_date < today).reduce((a, t) => a + Number(t.amount), 0);
  const despesas = month.filter((t) => t.kind === "saida").reduce((a, t) => a + Number(t.amount), 0);
  const goal = Number(settings?.monthly_goal) || 0;
  const pct = goal ? Math.round((faturado / goal) * 100) : 0;

  const P = projects || [];
  const ativos = P.filter((p) => p.stage !== "entregue");
  const entreguesMes = P.filter((p) => p.stage === "entregue" && p.delivered_at && p.delivered_at.slice(0, 10) >= monthStart).length;
  const atrasados = ativos.filter((p) => p.due_date && p.due_date < today);
  const entreguesTotal = P.filter((p) => p.stage === "entregue");
  const retrabalho = entreguesTotal.length ? Math.round((entreguesTotal.filter((p) => p.revisions > 0).length / entreguesTotal.length) * 100) : 0;
  const tasksLate = (tasks || []).filter((t) => t.due_date && t.due_date < today).length;
  const pipeline = (deals || []).filter((d) => !["ganho", "perdido"].includes(d.stage)).reduce((a, d) => a + Number(d.value || 0), 0);
  const clientesAtivos = (clients || []).filter((c) => c.status === "ativo").length;

  // Faturamento mensal (6 meses)
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return d.toISOString().slice(0, 7); });
  const byMonth = months.map((m) => ({ m, v: T.filter((t) => t.kind === "entrada" && t.paid && t.due_date.startsWith(m)).reduce((a, t) => a + Number(t.amount), 0) }));
  const maxM = Math.max(1, ...byMonth.map((x) => x.v));
  // Melhores clientes
  const byClient: Record<string, number> = {};
  T.filter((t) => t.kind === "entrada" && t.paid && t.client_id).forEach((t) => { byClient[t.client_id] = (byClient[t.client_id] || 0) + Number(t.amount); });
  const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ name: (clients || []).find((c) => c.id === id)?.name || "–", v }));
  const topMax = Math.max(1, ...top.map((t) => t.v));

  const R = 54, C = 2 * Math.PI * R;
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHead kicker="GESTOR" title="Visão geral" desc={`Operação e caixa da produtora em ${monthName}.`} />

      <section className="card p-6 md:p-7 mb-5 relative overflow-hidden rise">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-mint/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div>
            <p className="text-xs text-fog uppercase tracking-widest font-mono">Faturado no mês</p>
            <p className="font-display text-4xl md:text-5xl font-extrabold mt-2 tabular-nums">{brl(faturado)}</p>
            <p className="text-sm text-fog mt-2">{goal ? <>Meta {brl(goal)} · faltam <span className="text-paper">{brl(Math.max(0, goal - faturado))}</span></> : <Link href="/conta" className="text-mint underline">Defina a meta mensal</Link>}</p>
          </div>
          <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-mint)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(pct, 100) / 100)} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-3xl font-extrabold">{pct}%</p><p className="text-[10px] text-fog uppercase tracking-wider">da meta</p></div></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          ["A receber", brlShort(aReceber), atrasado ? `${brlShort(atrasado)} em atraso` : "nada em atraso", atrasado ? "text-danger" : "text-fog"],
          ["Despesas do mês", brlShort(despesas), `lucro ${brlShort(faturado - despesas)}`, "text-fog"],
          ["Projetos ativos", String(ativos.length), `${atrasados.length} atrasado(s)`, atrasados.length ? "text-danger" : "text-fog"],
          ["Pipeline comercial", brlShort(pipeline), `${clientesAtivos} clientes ativos`, "text-fog"],
        ].map(([k, v, sub, cls], i) => (
          <div key={k} className="card p-5 rise" style={{ animationDelay: `${i * 0.04}s` }}>
            <p className="text-xs text-fog">{k}</p>
            <p className="font-display text-2xl md:text-3xl font-bold mt-2 tabular-nums">{v}</p>
            <p className={`text-xs mt-1 ${cls}`}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["Entregues no mês", entreguesMes, "text-mint"], ["Taxa de refação", retrabalho + "%", retrabalho > 30 ? "text-danger" : "text-paper"], ["Tarefas atrasadas", tasksLate, tasksLate ? "text-danger" : "text-paper"]].map(([k, v, c]) => (
          <div key={k as string} className="card p-4"><p className="text-xs text-fog">{k}</p><p className={`font-display text-2xl font-bold mt-1 ${c}`}>{v}</p></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-5 mb-5">
        <section className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-5"><h2 className="font-display font-bold text-lg">Faturamento recebido</h2><Link href="/agency/financeiro" className="text-xs text-fog hover:text-mint">Financeiro</Link></div>
          <div className="flex items-end gap-3 h-44">
            {byMonth.map(({ m, v }) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-fog">{v ? brlShort(v) : ""}</span>
                <div className={`w-full rounded-t-md ${m === today.slice(0, 7) ? "bg-mint" : "bg-slate"}`} style={{ height: `${Math.max(2, (v / maxM) * 100)}%` }} />
                <span className="text-[11px] text-fog capitalize">{new Date(m + "-15").toLocaleDateString("pt-BR", { month: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="lg:col-span-2 card p-5">
          <h2 className="font-display font-bold text-lg mb-4">Melhores clientes</h2>
          {!top.length ? <p className="text-fog text-sm">Os clientes aparecem aqui conforme os recebimentos forem marcados como pagos.</p> : (
            <ul className="space-y-3">
              {top.map((t, i) => (
                <li key={i}><div className="flex justify-between text-sm mb-1"><span className="truncate">{t.name}</span><span className="font-mono text-mint">{brlShort(t.v)}</span></div>
                  <div className="h-1.5 bg-panel2 rounded-full"><div className="h-full bg-mint rounded-full" style={{ width: `${(t.v / topMax) * 100}%` }} /></div></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4"><h2 className="font-display font-bold text-lg">Projetos em andamento</h2><Link href="/agency/projetos" className="text-xs text-fog hover:text-mint">Ver quadro</Link></div>
          {!ativos.length ? <p className="text-fog text-sm py-6 text-center">Nenhum projeto ativo. <Link href="/agency/projetos" className="text-mint underline">Criar projeto</Link></p> : (
            <ul className="divide-y divide-line">
              {ativos.slice(0, 7).map((p: any) => {
                const late = p.due_date && p.due_date < today;
                return (
                  <li key={p.id}><Link href={`/agency/projetos/${p.id}`} className="py-3 flex items-center gap-3 hover:text-mint">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${late ? "bg-danger" : "bg-mint"}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.title}</p><p className="text-xs text-fog">{p.ag_clients?.name || "Sem cliente"}</p></div>
                    <span className="chip">{stageLabel(p.stage)}</span>
                    <span className={`text-xs w-16 text-right ${late ? "text-danger" : "text-fog"}`}>{dtShort(p.due_date)}</span>
                  </Link></li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="font-display font-bold text-lg">Próximos 14 dias</h2><Link href="/agency/agenda" className="text-xs text-fog hover:text-mint">Agenda</Link></div>
          {!events?.length ? <p className="text-fog text-sm">Nada agendado.</p> : (
            <ul className="space-y-2">
              {events.map((e) => { const k = EVENT_KINDS.find((x) => x.k === e.kind); return (
                <li key={e.id} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2.5">
                  <span className="w-1 self-stretch rounded" style={{ background: k?.c }} />
                  <div className="min-w-0 flex-1"><p className="text-sm truncate">{e.title}</p><p className="text-[11px] text-fog">{k?.l} · {new Date(e.starts_at).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</p></div>
                </li>); })}
            </ul>
          )}
          <p className="text-[11px] text-fog mt-4">Funil: {DEAL_STAGES.filter((d) => !["ganho", "perdido"].includes(d.k)).map((d) => `${d.l} ${(deals || []).filter((x) => x.stage === d.k).length}`).join(" · ")}</p>
        </section>
      </div>
    </>
  );
}
