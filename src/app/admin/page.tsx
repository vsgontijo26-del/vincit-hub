"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TOOLS } from "@/lib/access";
import { brl } from "@/lib/agency";
import Logo from "@/components/Logo";
import Modal from "@/components/agency/Modal";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";

const STATUS: Record<string, { l: string; c: string }> = {
  ativo: { l: "Ativo", c: "#6eefb6" }, pendente: { l: "Pendente", c: "#f5c84c" }, suspenso: { l: "Suspenso", c: "#ff6b6b" }, expirado: { l: "Vencido", c: "#ff6b6b" },
};
const HUBS: [string, string][] = [["creator", "CREATOR"], ["agency", "AGENCY"], ["geral", "Geral"]];
const PERIOD_MONTHS: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const todayStr = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const fmtDate = (d?: string | null) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "–");

/** status efetivo considerando a validade */
const eff = (u: any) => (u.role === "superadmin" ? "ativo" : u.status === "ativo" && u.expires_at && u.expires_at < todayStr() ? "expirado" : u.status);

function ToolPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {HUBS.map(([hub, label]) => {
        const ts = TOOLS.filter((t) => t.hub === hub);
        const all = ts.every((t) => value.includes(t.key));
        return (
          <div key={hub}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold tracking-wide">{label}</p>
              {ts.length > 1 && <button type="button" onClick={() => onChange(all ? value.filter((k) => !ts.some((t) => t.key === k)) : Array.from(new Set([...value, ...ts.map((t) => t.key)])))} className="text-[11px] text-fog hover:text-mint">{all ? "Nenhuma" : "Todas"}</button>}
            </div>
            <div className="space-y-1">{ts.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-[#6eefb6]" checked={value.includes(t.key)} onChange={() => toggle(t.key)} />{t.label}</label>
            ))}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<"usuarios" | "convites" | "planos">("usuarios");
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editU, setEditU] = useState<any>(null);
  const [editP, setEditP] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = createClient();
    const [u, p, i] = await Promise.all([s.rpc("admin_users"), s.from("plans").select("*").order("position"), s.from("invites").select("*").order("created_at", { ascending: false })]);
    if (u.error) setErr(u.error.message);
    setUsers(u.data || []); setPlans(p.data || []); setInvites(i.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const planById = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);
  const td = todayStr();
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const clients = users.filter((u) => u.role !== "superadmin");
  const active = clients.filter((u) => eff(u) === "ativo");
  const mrr = active.reduce((a, u) => { const p = planById[u.plan_id]; return a + (p ? Number(p.price) / (PERIOD_MONTHS[p.period] || 1) : 0); }, 0);
  const pending = clients.filter((u) => u.status === "pendente");
  const expiring = active.filter((u) => u.expires_at && u.expires_at >= td && u.expires_at <= in7);
  const list = users.filter((u) => (!fStatus || eff(u) === fStatus) && (!q || `${u.email} ${u.name || ""} ${u.company || ""}`.toLowerCase().includes(q.toLowerCase())));

  async function saveUser(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const u = editU;
    const { error } = await createClient().from("profiles").update({
      name: u.name || null, company: u.company || null, status: u.status, plan_id: u.plan_id || null,
      tools: u.custom ? u.tools || [] : null, expires_at: u.expires_at || null, notes: u.notes || null, updated_at: new Date().toISOString(),
    }).eq("id", u.id);
    setBusy(false); if (error) return setErr(error.message);
    setEditU(null); load();
  }
  async function quick(u: any, v: any) { await createClient().from("profiles").update({ ...v, updated_at: new Date().toISOString() }).eq("id", u.id); load(); }
  function renew(u: any) {
    const p = planById[u.plan_id]; const months = PERIOD_MONTHS[p?.period] || 1;
    const base = u.expires_at && u.expires_at > td ? new Date(u.expires_at + "T12:00:00") : new Date();
    base.setMonth(base.getMonth() + months);
    setEditU({ ...u, expires_at: base.toISOString().slice(0, 10), status: "ativo" });
  }
  async function savePlan(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { id, ...p } = editP;
    const row = { name: p.name, description: p.description || null, price: Number(p.price) || 0, period: p.period, tools: p.tools || [], active: p.active !== false, position: p.position ?? plans.length + 1 };
    const s = createClient();
    const { error } = id ? await s.from("plans").update(row).eq("id", id) : await s.from("plans").insert(row);
    setBusy(false); if (error) return setErr(error.message);
    setEditP(null); load();
  }
  async function delPlan(p: any) {
    if (clients.some((u) => u.plan_id === p.id)) return setErr("Há usuários nesse plano. Mova-os antes de excluir ou desative o plano.");
    if (!confirm(`Excluir o plano ${p.name}?`)) return;
    await createClient().from("plans").delete().eq("id", p.id); setEditP(null); load();
  }
  async function saveInvite(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const email = inv.email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      // já tem conta: aplica direto no perfil
      await createClient().from("profiles").update({ status: "ativo", plan_id: inv.plan_id || null, name: inv.name || existing.name, company: inv.company || existing.company, expires_at: inv.expires_at || null, tools: null }).eq("id", existing.id);
    } else {
      const { error } = await createClient().from("invites").upsert({ email, name: inv.name || null, company: inv.company || null, plan_id: inv.plan_id || null, expires_at: inv.expires_at || null, accepted_at: null }, { onConflict: "email" });
      if (error) { setBusy(false); return setErr(error.message); }
    }
    setBusy(false); setInv({ ...inv, done: existing ? "Usuário já tinha conta: plano aplicado e acesso liberado." : "Convite criado. Envie o link abaixo para a pessoa se cadastrar." }); load();
  }
  async function delInvite(i: any) { await createClient().from("invites").delete().eq("id", i.id); load(); }
  const signupLink = (email: string) => `${typeof location !== "undefined" ? location.origin : "https://vincit-hub.vercel.app"}/login?cadastro=1&email=${encodeURIComponent(email)}`;

  const Chip = ({ s }: { s: string }) => <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS[s]?.c + "22", color: STATUS[s]?.c }}>{STATUS[s]?.l || s}</span>;

  return (
    <main className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between px-5 md:px-10 py-5 border-b border-line">
        <div className="flex items-center gap-3"><Link href="/"><Logo className="h-6" /></Link><span className="font-mono text-[11px] text-ink bg-mint rounded-md px-1.5 py-0.5">ADMIN</span></div>
        <Link href="/" className="btn btn-ghost btn-sm"><I.back className="w-3.5 h-3.5" />Hubs</Link>
      </header>

      <div className="max-w-6xl mx-auto px-5 md:px-10 py-8">
        <p className="font-mono text-xs text-mint tracking-widest uppercase">Administração da plataforma</p>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-2">Usuários, planos e acessos</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[["Assinantes ativos", active.length], ["Aguardando liberação", pending.length], ["Receita mensal estimada", brl(mrr)], ["Vencendo em 7 dias", expiring.length]].map(([k, v]) => (
            <div key={k as string} className="card p-5"><p className="text-xs text-fog">{k}</p><p className="font-display text-2xl md:text-3xl font-bold mt-1.5 tabular-nums">{v}</p></div>
          ))}
        </div>

        {err && <p className="card p-3 mt-4 text-sm text-danger border-danger/40 flex justify-between">{err}<button onClick={() => setErr(null)}>×</button></p>}

        <div className="flex gap-1 border-b border-line mt-8 mb-5">{([["usuarios", `Usuários (${users.length})`], ["convites", `Convites (${invites.filter((i) => !i.accepted_at).length})`], ["planos", `Planos (${plans.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-sm border-b-2 -mb-px ${tab === k ? "border-mint text-mint" : "border-transparent text-fog hover:text-paper"}`}>{l}</button>
        ))}</div>

        {tab === "usuarios" && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <input className="input !py-1.5 !w-60" placeholder="Buscar nome, e-mail, empresa…" value={q} onChange={(e) => setQ(e.target.value)} />
              {["", "ativo", "pendente", "suspenso", "expirado"].map((s) => <button key={s || "all"} onClick={() => setFStatus(s)} className={`btn btn-sm ${fStatus === s ? "btn-mint" : "btn-ghost"}`}>{s ? STATUS[s].l : "Todos"}</button>)}
              <button onClick={() => { setTab("convites"); setInv({ email: "", plan_id: plans[0]?.id || "" }); }} className="btn btn-mint btn-sm ml-auto"><I.plus className="w-4 h-4" />Novo usuário</button>
            </div>
            <div className="card overflow-x-auto scroll-thin">
              <table className="w-full text-sm min-w-[760px]">
                <thead><tr className="text-left text-fog text-xs border-b border-line">{["Usuário", "Status", "Plano", "Validade", "Último acesso", ""].map((h) => <th key={h} className="py-2.5 px-4 font-normal">{h}</th>)}</tr></thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-panel2/50">
                      <td className="py-3 px-4"><p className="font-medium">{u.name || u.email}{u.role === "superadmin" && <span className="ml-2 text-[10px] font-mono text-ink bg-mint rounded px-1">ADMIN</span>}</p><p className="text-xs text-fog">{u.name ? u.email : ""}{u.company ? ` · ${u.company}` : ""}{!u.confirmed ? " · e-mail não confirmado" : ""}</p></td>
                      <td className="px-4"><Chip s={eff(u)} /></td>
                      <td className="px-4">{u.role === "superadmin" ? <span className="text-fog text-xs">Acesso total</span> : <>{planById[u.plan_id]?.name || <span className="text-fog">Sem plano</span>}{u.tools && <span className="text-[10px] text-fog ml-1">(personalizado)</span>}</>}</td>
                      <td className={`px-4 text-xs ${u.expires_at && u.expires_at < td ? "text-danger" : "text-fog"}`}>{u.role === "superadmin" ? "–" : u.expires_at ? fmtDate(u.expires_at) : "Sem vencimento"}</td>
                      <td className="px-4 text-xs text-fog">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Nunca"}</td>
                      <td className="px-4 text-right whitespace-nowrap">
                        {u.role !== "superadmin" && u.status === "pendente" && <button onClick={() => setEditU({ ...u, status: "ativo", plan_id: u.plan_id || plans[0]?.id, custom: !!u.tools, tools: u.tools || [] })} className="btn btn-mint btn-sm mr-1">Liberar</button>}
                        {u.role !== "superadmin" && <button onClick={() => setEditU({ ...u, custom: !!u.tools, tools: u.tools || planById[u.plan_id]?.tools || [] })} className="btn btn-ghost btn-sm">Gerenciar</button>}
                      </td>
                    </tr>
                  ))}
                  {!list.length && <tr><td colSpan={6} className="text-center text-fog py-10">Nenhum usuário encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-fog mt-3">Novos cadastros feitos pela tela de login entram como <b>Pendente</b> e só acessam depois de liberados aqui. Quem se cadastra com um e-mail convidado já entra ativo com o plano do convite.</p>
          </>
        )}

        {tab === "convites" && (
          <div className="grid lg:grid-cols-5 gap-5">
            <form onSubmit={saveInvite} className="lg:col-span-2 card p-5 space-y-3 h-fit">
              <p className="font-display font-bold text-lg">Liberar novo usuário</p>
              <p className="text-xs text-fog -mt-2">Cadastre o e-mail com plano e validade. Ao criar a conta com esse e-mail, a pessoa entra liberada automaticamente.</p>
              <div><label className="label">E-mail</label><input required type="email" className="input" value={inv?.email || ""} onChange={(e) => setInv({ ...(inv || {}), email: e.target.value, done: null })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Nome</label><input className="input" value={inv?.name || ""} onChange={(e) => setInv({ ...(inv || {}), name: e.target.value })} /></div>
                <div><label className="label">Empresa</label><input className="input" value={inv?.company || ""} onChange={(e) => setInv({ ...(inv || {}), company: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Plano</label><select required className="input" value={inv?.plan_id || ""} onChange={(e) => setInv({ ...(inv || {}), plan_id: e.target.value })}><option value="">–</option>{plans.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="label">Válido até</label><input type="date" className="input" value={inv?.expires_at || ""} onChange={(e) => setInv({ ...(inv || {}), expires_at: e.target.value })} /></div>
              </div>
              <button disabled={busy} className="btn btn-mint w-full">Liberar acesso</button>
              {inv?.done && <div className="bg-panel2 rounded-xl p-3 text-sm space-y-2"><p className="text-mint">{inv.done}</p>{!users.some((u) => u.email.toLowerCase() === inv.email.trim().toLowerCase()) && <div className="flex items-center gap-2"><code className="text-[11px] text-fog truncate flex-1">{signupLink(inv.email.trim())}</code><CopyButton text={signupLink(inv.email.trim())} /></div>}</div>}
            </form>
            <section className="lg:col-span-3 card p-5">
              <p className="font-display font-bold mb-3">Convites</p>
              <ul className="space-y-1.5">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2.5 text-sm">
                    <div className="flex-1 min-w-0"><p className="truncate">{i.name ? `${i.name} · ` : ""}{i.email}</p><p className="text-[11px] text-fog">{planById[i.plan_id]?.name || "Sem plano"}{i.expires_at ? ` · até ${fmtDate(i.expires_at)}` : ""}</p></div>
                    {i.accepted_at ? <span className="text-[11px] text-mint">Cadastrado {fmtDate(i.accepted_at)}</span> : <><span className="text-[11px] text-[#f5c84c]">Aguardando cadastro</span><CopyButton text={signupLink(i.email)} label="Link" /></>}
                    <button onClick={() => delInvite(i)} className="text-fog hover:text-danger"><I.trash className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
                {!invites.length && <p className="text-fog text-sm py-6 text-center">Nenhum convite ainda.</p>}
              </ul>
            </section>
          </div>
        )}

        {tab === "planos" && (
          <>
            <div className="flex justify-end mb-4"><button onClick={() => setEditP({ name: "", price: 0, period: "mensal", tools: [], active: true })} className="btn btn-mint btn-sm"><I.plus className="w-4 h-4" />Novo plano</button></div>
            <div className="grid md:grid-cols-3 gap-3">
              {plans.map((p) => {
                const n = clients.filter((u) => u.plan_id === p.id && eff(u) === "ativo").length;
                return (
                  <button key={p.id} onClick={() => setEditP({ ...p })} className={`card p-5 text-left hover:border-slate ${p.active ? "" : "opacity-50"}`}>
                    <div className="flex justify-between items-start"><p className="font-display font-bold text-xl">{p.name}</p>{!p.active && <span className="chip">Inativo</span>}</div>
                    <p className="text-sm text-fog mt-1">{p.description}</p>
                    <p className="font-display text-2xl font-bold mt-4">{Number(p.price) ? brl(Number(p.price)) : <span className="text-fog text-base">Preço não definido</span>}<span className="text-sm text-fog font-normal"> /{p.period}</span></p>
                    <p className="text-xs text-fog mt-3">{p.tools.length} ferramentas · {n} assinante(s) ativo(s)</p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal open={!!editU} title={editU ? `Gerenciar ${editU.name || editU.email}` : ""} onClose={() => setEditU(null)} wide>
        {editU && <form onSubmit={saveUser} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="label">Nome</label><input className="input" value={editU.name || ""} onChange={(e) => setEditU({ ...editU, name: e.target.value })} /></div>
            <div><label className="label">Empresa</label><input className="input" value={editU.company || ""} onChange={(e) => setEditU({ ...editU, company: e.target.value })} /></div>
            <div><label className="label">Status</label><select className="input" value={editU.status} onChange={(e) => setEditU({ ...editU, status: e.target.value })}><option value="ativo">Ativo</option><option value="pendente">Pendente</option><option value="suspenso">Suspenso</option></select></div>
            <div><label className="label">Plano</label><select className="input" value={editU.plan_id || ""} onChange={(e) => setEditU({ ...editU, plan_id: e.target.value, tools: editU.custom ? editU.tools : planById[e.target.value]?.tools || [] })}><option value="">Sem plano</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}{!p.active ? " (inativo)" : ""}</option>)}</select></div>
            <div><label className="label">Válido até</label><div className="flex gap-2"><input type="date" className="input" value={editU.expires_at || ""} onChange={(e) => setEditU({ ...editU, expires_at: e.target.value })} /><button type="button" onClick={() => renew(editU)} className="btn btn-ghost btn-sm whitespace-nowrap">+1 período</button></div><p className="text-[11px] text-fog mt-1">Vazio = sem vencimento.</p></div>
            <div><label className="label">Observações</label><input className="input" value={editU.notes || ""} onChange={(e) => setEditU({ ...editU, notes: e.target.value })} placeholder="Forma de pagamento, combinado…" /></div>
          </div>
          <div className="bg-panel2 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer"><input type="checkbox" className="accent-[#6eefb6]" checked={!!editU.custom} onChange={(e) => setEditU({ ...editU, custom: e.target.checked, tools: e.target.checked ? editU.tools?.length ? editU.tools : planById[editU.plan_id]?.tools || [] : planById[editU.plan_id]?.tools || [] })} />Personalizar ferramentas deste usuário (em vez de seguir o plano)</label>
            {editU.custom ? <ToolPicker value={editU.tools || []} onChange={(tools) => setEditU({ ...editU, tools })} />
              : <p className="text-xs text-fog">Segue o plano: {(planById[editU.plan_id]?.tools || []).map((k: string) => TOOLS.find((t) => t.key === k)?.label).filter(Boolean).join(", ") || "nenhuma ferramenta"}.</p>}
          </div>
          <p className="text-xs text-fog">Cadastro em {fmtDate(editU.created_at)} · último acesso {editU.last_sign_in_at ? fmtDate(editU.last_sign_in_at) : "nunca"}</p>
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              {editU.status !== "suspenso" ? <button type="button" onClick={() => { quick(editU, { status: "suspenso" }); setEditU(null); }} className="btn btn-ghost btn-sm text-danger">Suspender acesso</button>
                : <button type="button" onClick={() => { quick(editU, { status: "ativo" }); setEditU(null); }} className="btn btn-ghost btn-sm">Reativar</button>}
            </div>
            <button disabled={busy} className="btn btn-mint">Salvar</button>
          </div>
        </form>}
      </Modal>

      <Modal open={!!editP} title={editP?.id ? `Plano ${editP.name}` : "Novo plano"} onClose={() => setEditP(null)} wide>
        {editP && <form onSubmit={savePlan} className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2"><label className="label">Nome</label><input required className="input" value={editP.name} onChange={(e) => setEditP({ ...editP, name: e.target.value })} /></div>
            <div><label className="label">Preço (R$)</label><input type="number" step="0.01" className="input" value={editP.price} onChange={(e) => setEditP({ ...editP, price: e.target.value })} /></div>
            <div><label className="label">Cobrança</label><select className="input" value={editP.period} onChange={(e) => setEditP({ ...editP, period: e.target.value })}>{Object.keys(PERIOD_MONTHS).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
            <div className="md:col-span-4"><label className="label">Descrição</label><input className="input" value={editP.description || ""} onChange={(e) => setEditP({ ...editP, description: e.target.value })} /></div>
          </div>
          <div className="bg-panel2 rounded-xl p-4"><p className="label">Ferramentas incluídas</p><ToolPicker value={editP.tools || []} onChange={(tools) => setEditP({ ...editP, tools })} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-[#6eefb6]" checked={editP.active !== false} onChange={(e) => setEditP({ ...editP, active: e.target.checked })} />Plano disponível para novos usuários</label>
          <p className="text-xs text-fog">Alterar as ferramentas do plano muda o acesso de todos os assinantes dele (exceto quem tem ferramentas personalizadas).</p>
          <div className="flex justify-between">{editP.id ? <button type="button" onClick={() => delPlan(editP)} className="btn btn-ghost btn-sm"><I.trash className="w-4 h-4" /></button> : <span />}<button disabled={busy} className="btn btn-mint">Salvar plano</button></div>
        </form>}
      </Modal>
    </main>
  );
}
