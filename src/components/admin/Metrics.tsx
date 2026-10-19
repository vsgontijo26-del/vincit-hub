"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/agency";
import { TOOLS } from "@/lib/access";

const PERIOD_MONTHS: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center text-sm py-1.5">
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-fog text-xs">{right}</span>
      <div className="col-span-2 h-1.5 rounded-full bg-panel2 mt-1 overflow-hidden">
        <div className="h-full rounded-full bg-mint" style={{ width: `${max ? Math.max(value ? 3 : 0, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

export default function Metrics() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    createClient().rpc("admin_metrics").then(({ data, error }) => (error ? setErr(error.message) : setM(data)));
  }, []);
  if (err) return <p className="card p-4 text-sm text-danger">{err}</p>;
  if (!m) return <p className="text-fog text-sm">Carregando métricas…</p>;

  const plans: any[] = m.by_plan || [];
  const mrr = plans.reduce((a, p) => a + (Number(p.price) / (PERIOD_MONTHS[p.period] || 1)) * p.active, 0);
  const activeSubs = plans.reduce((a, p) => a + p.active, 0);
  const ticket = activeSubs ? mrr / activeSubs : 0;
  const signups: any[] = m.signups || [];
  const maxSign = Math.max(1, ...signups.map((s) => s.n));
  const usage: any[] = m.usage || [];
  const maxUse = Math.max(1, ...usage.map((u) => u.users));
  const access = m.tool_access || {};
  const toolRows = TOOLS.map((t) => ({ ...t, n: access[t.key] || 0 }));
  const maxAccess = Math.max(1, ...toolRows.map((t) => t.n));
  const noPrice = plans.filter((p) => !Number(p.price)).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Assinantes (total)", m.total, "contas de clientes"],
          ["Ativos nos últimos 7 dias", m.active7, `${pct(m.active7, m.total)}% da base`],
          ["Ativos nos últimos 30 dias", m.active30, `${pct(m.active30, m.total)}% da base`],
          ["Ticket médio mensal", brl(ticket), `${activeSubs} assinatura(s) paga(s) ativa(s)`],
        ].map(([k, v, s]) => (
          <div key={k as string} className="card p-5">
            <p className="text-xs text-fog">{k}</p>
            <p className="font-display text-2xl md:text-3xl font-bold mt-1.5 tabular-nums">{v}</p>
            <p className="text-[11px] text-fog mt-1">{s}</p>
          </div>
        ))}
      </div>

      {noPrice > 0 && <p className="card p-3 text-sm border-[#f5c84c]/40 text-[#f5c84c]">{noPrice} plano(s) estão com preço R$ 0. Defina os preços na aba Planos para a receita e o ticket médio ficarem corretos.</p>}

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="card p-5">
          <h3 className="font-display font-bold">Novos cadastros por mês</h3>
          <p className="text-xs text-fog mb-4">Últimos 6 meses (inclui todas as contas criadas)</p>
          <div className="flex items-end gap-3 h-40">
            {signups.map((s) => {
              const [, mo] = s.month.split("-");
              return (
                <div key={s.month} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-xs tabular-nums text-fog">{s.n}</span>
                  <div className="w-full max-w-10 rounded-t-md bg-mint" style={{ height: `${(s.n / maxSign) * 100}%`, minHeight: s.n ? 4 : 1, opacity: s.n ? 1 : 0.25 }} />
                  <span className="text-[11px] text-fog">{MONTHS[Number(mo) - 1]}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5">
          <h3 className="font-display font-bold">Receita por plano</h3>
          <p className="text-xs text-fog mb-3">Receita mensal estimada: <b className="text-paper">{brl(mrr)}</b></p>
          <div className="divide-y divide-line">
            {plans.map((p) => {
              const rev = (Number(p.price) / (PERIOD_MONTHS[p.period] || 1)) * p.active;
              return (
                <div key={p.name} className="flex items-center justify-between py-2.5 text-sm">
                  <div><p className="font-semibold">{p.name}</p><p className="text-[11px] text-fog">{brl(Number(p.price))} / {p.period} · {p.active} ativo(s) de {p.total}</p></div>
                  <span className="tabular-nums font-semibold">{brl(rev)}<span className="text-fog text-xs font-normal">/mês</span></span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5">
          <h3 className="font-display font-bold">Uso real das ferramentas</h3>
          <p className="text-xs text-fog mb-3">Quantos assinantes já criaram algo em cada área</p>
          {usage.map((u) => <Bar key={u.key} label={u.label} value={u.users} max={maxUse} right={`${u.users} usuário(s) · ${u.rows} registro(s)`} />)}
        </section>

        <section className="card p-5">
          <h3 className="font-display font-bold">Ferramentas liberadas</h3>
          <p className="text-xs text-fog mb-3">Assinantes ativos com cada ferramenta no plano</p>
          {m.total === 0 ? <p className="text-sm text-fog">Ainda não há assinantes além de você.</p>
            : toolRows.map((t) => <Bar key={t.key} label={`${t.hub === "creator" ? "CREATOR" : t.hub === "agency" ? "GESTOR" : "Geral"} · ${t.label}`} value={t.n} max={maxAccess} right={String(t.n)} />)}
        </section>
      </div>
      <p className="text-[11px] text-fog">"Ativo" considera o último login. O uso conta registros criados por qualquer conta, inclusive a sua.</p>
    </div>
  );
}
