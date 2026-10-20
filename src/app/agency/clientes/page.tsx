"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { DEFAULT_ONBOARDING, brl, dtShort, stageLabel } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";

const STATUS = [{ v: "lead", l: "Lead" }, { v: "ativo", l: "Ativo" }, { v: "inativo", l: "Inativo" }];
const fields = [
  { key: "name", label: "Nome / contato principal", required: true },
  { key: "company", label: "Empresa" },
  { key: "email", label: "E-mail", type: "email" as const },
  { key: "phone", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "segment", label: "Segmento", placeholder: "educação, saúde, eventos…" },
  { key: "status", label: "Status", type: "select" as const, options: STATUS },
  { key: "notes", label: "Observações", type: "textarea" as const },
];

export default function Clientes() {
  const c = useTable<any>("ag_clients", { order: "name", asc: true });
  const [form, setForm] = useState<any>(null);
  const [sel, setSel] = useState<any>(null);
  const [detail, setDetail] = useState<{ projects: any[]; tx: any[] }>({ projects: [], tx: [] });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [newStep, setNewStep] = useState("");

  useEffect(() => {
    if (!sel) return;
    const s = createClient();
    Promise.all([
      s.from("ag_projects").select("id,title,stage,value,due_date").eq("client_id", sel.id).order("created_at", { ascending: false }),
      s.from("ag_transactions").select("kind,amount,paid").eq("client_id", sel.id),
    ]).then(([a, b]) => setDetail({ projects: a.data || [], tx: b.data || [] }));
  }, [sel?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const row = { ...form };
    if (!row.id) row.onboarding = DEFAULT_ONBOARDING.map((label) => ({ label, done: false }));
    if (await c.save(row)) setForm(null);
  }
  async function toggleStep(i: number) {
    const ob = [...(sel.onboarding || [])]; ob[i] = { ...ob[i], done: !ob[i].done };
    setSel({ ...sel, onboarding: ob }); await c.patch(sel.id, { onboarding: ob });
  }
  async function addStep(e: React.FormEvent) {
    e.preventDefault(); if (!newStep.trim()) return;
    const ob = [...(sel.onboarding || []), { label: newStep.trim(), done: false }];
    setSel({ ...sel, onboarding: ob }); setNewStep(""); await c.patch(sel.id, { onboarding: ob });
  }
  async function del() { if (!confirm(`Excluir ${sel.name}?`)) return; await c.remove(sel.id); setSel(null); }

  const list = c.rows.filter((x) => (!status || x.status === status) && (!q || `${x.name} ${x.company || ""} ${x.segment || ""}`.toLowerCase().includes(q.toLowerCase())));
  const ob = sel?.onboarding || [];
  const obDone = ob.filter((x: any) => x.done).length;
  const paid = detail.tx.filter((t) => t.kind === "entrada" && t.paid).reduce((a, t) => a + Number(t.amount), 0);
  const open = detail.tx.filter((t) => t.kind === "entrada" && !t.paid).reduce((a, t) => a + Number(t.amount), 0);

  return (
    <>
      <PageHead kicker="GESTOR · 02 COMERCIAL" title="Clientes" desc="Cadastro, ficha e onboarding de cada cliente.">
        <button className="btn btn-mint" onClick={() => setForm({ status: "ativo" })}><I.plus className="w-4 h-4" />Novo cliente</button>
      </PageHead>
      <div className="flex flex-col md:flex-row gap-2 mb-5">
        <input className="input md:max-w-xs" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1">{[{ v: "", l: "Todos" }, ...STATUS].map((s) => <button key={s.v} onClick={() => setStatus(s.v)} className={`btn btn-sm ${status === s.v ? "btn-mint" : "btn-ghost"}`}>{s.l} <span className="opacity-60">{s.v ? c.rows.filter((x) => x.status === s.v).length : c.rows.length}</span></button>)}</div>
      </div>
      {c.error && <p className="text-danger text-sm mb-3">{c.error}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((x) => {
          const o = x.onboarding || []; const d = o.filter((s: any) => s.done).length;
          return (
            <button key={x.id} onClick={() => setSel(x)} className="card p-5 text-left hover:border-mint transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center font-display font-bold text-mint shrink-0">{x.name[0]?.toUpperCase()}</div>
                  <div className="min-w-0"><p className="font-semibold truncate">{x.name}</p><p className="text-xs text-fog truncate">{x.company || x.segment || "–"}</p></div>
                </div>
                <span className={`chip ${x.status === "ativo" ? "chip-mint" : ""}`}>{STATUS.find((s) => s.v === x.status)?.l}</span>
              </div>
              {!!o.length && <div className="mt-4"><div className="flex justify-between text-[11px] text-fog mb-1"><span>Onboarding</span><span>{d}/{o.length}</span></div><div className="h-1.5 bg-panel2 rounded-full"><div className="h-full bg-mint rounded-full" style={{ width: `${(d / o.length) * 100}%` }} /></div></div>}
            </button>
          );
        })}
        {!list.length && !c.loading && <p className="text-fog text-sm col-span-full text-center py-10">Nenhum cliente.</p>}
      </div>

      <Modal open={!!form} title={form?.id ? "Editar cliente" : "Novo cliente"} onClose={() => setForm(null)}>
        <form onSubmit={submit}><Fields fields={fields} value={form} onChange={setForm} />
          <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-mint">Salvar</button></div></form>
      </Modal>

      {sel && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end" onClick={() => setSel(null)}>
          <div className="w-full max-w-xl h-full bg-panel border-l border-line p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><span className="chip">Ficha do cliente</span><button className="text-fog text-sm hover:text-paper" onClick={() => setSel(null)}>Fechar</button></div>
            <h2 className="font-display text-3xl font-extrabold">{sel.name}</h2>
            <p className="text-fog text-sm mt-1">{[sel.company, sel.segment].filter(Boolean).join(" · ") || "–"}</p>
            <div className="grid grid-cols-2 gap-2 mt-5 text-sm">
              {[["E-mail", sel.email], ["WhatsApp", sel.phone], ["Instagram", sel.instagram], ["Cliente desde", dtShort(sel.created_at)]].map(([k, v]) => (
                <div key={k} className="bg-panel2 rounded-lg p-3"><p className="text-[11px] text-fog">{k}</p><p className="truncate">{v || "–"}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <div className="bg-panel2 rounded-lg p-3"><p className="text-[11px] text-fog">Total recebido</p><p className="font-mono text-mint">{brl(paid)}</p></div>
              <div className="bg-panel2 rounded-lg p-3"><p className="text-[11px] text-fog">Em aberto</p><p className="font-mono">{brl(open)}</p></div>
            </div>
            {sel.notes && <p className="text-sm text-fog mt-4 whitespace-pre-wrap">{sel.notes}</p>}

            <h3 className="font-display font-bold mt-7 mb-3">Onboarding <span className="text-fog font-normal text-sm">{obDone}/{ob.length}</span></h3>
            <ul className="space-y-1.5">
              {ob.map((s: any, i: number) => (
                <li key={i}><label className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={s.done} onChange={() => toggleStep(i)} className="accent-[var(--color-mint)] w-4 h-4" /><span className={s.done ? "line-through text-fog" : ""}>{s.label}</span></label></li>
              ))}
            </ul>
            <form onSubmit={addStep} className="flex gap-2 mt-2"><input className="input" placeholder="Nova etapa…" value={newStep} onChange={(e) => setNewStep(e.target.value)} /><button className="btn btn-ghost"><I.plus className="w-4 h-4" /></button></form>

            <h3 className="font-display font-bold mt-7 mb-3">Projetos</h3>
            <ul className="space-y-1.5">
              {detail.projects.map((p) => (
                <li key={p.id}><Link href={`/projetos/${p.id}`} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2 text-sm hover:text-mint">
                  <span className="flex-1 truncate">{p.title}</span><span className="chip">{stageLabel(p.stage)}</span><span className="font-mono text-xs">{brl(p.value)}</span></Link></li>
              ))}
              {!detail.projects.length && <p className="text-fog text-sm">Nenhum projeto ainda.</p>}
            </ul>
            <div className="flex justify-between mt-8">
              <button className="btn btn-ghost" onClick={del}><I.trash className="w-4 h-4" />Excluir</button>
              <div className="flex gap-2"><Link href={`/agency/propostas?cliente=${sel.id}`} className="btn btn-ghost">Nova proposta</Link><button className="btn btn-mint" onClick={() => { setForm(sel); setSel(null); }}>Editar</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
