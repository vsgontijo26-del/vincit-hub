"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/agency/Modal";
import { useAccess } from "@/lib/useAccess";
import { hubAllowed } from "@/lib/access";
import { I } from "@/components/icons";
import { RECUR, TEMPLATES, recurLabel } from "./shared";

export const ROUTINE_SPACE = "Rotina";
const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** modelos de rotina: wd = dia da semana (0 = domingo); day = dia do mês */
const PRESETS: { k: string; title: string; rule: "weekly" | "monthly"; wd?: number; day?: number; desc: string; gestor?: boolean }[] = [
  { k: "planejar", title: "Planejar a semana", rule: "weekly", wd: 1, desc: "Revisar atrasadas e distribuir as tarefas pelos dias." },
  { k: "pauta", title: "Montar a pauta da semana", rule: "weekly", wd: 1, desc: "Definir os conteúdos e datas de publicação." },
  { k: "gravar", title: "Gravar conteúdos da semana", rule: "weekly", wd: 3, desc: "Bloco de gravação dos conteúdos em produção." },
  { k: "relatorio", title: "Relatório de desempenho", rule: "weekly", wd: 5, desc: "Olhar alcance, salvamentos e o que funcionou." },
  { k: "financeiro", title: "Revisão financeira", rule: "weekly", wd: 5, desc: "Conferir recebimentos, contas a pagar e cobranças.", gestor: true },
  { k: "diagnostico", title: "Diagnóstico do perfil", rule: "monthly", day: 1, desc: "Refazer o raio-X do perfil e comparar com o mês anterior." },
];

const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** próxima data (a partir de hoje, inclusive) que cai no dia da semana ou do mês do modelo */
function firstDate(p: (typeof PRESETS)[number], today: string) {
  if (p.rule === "weekly") { const w = new Date(today + "T12:00:00Z").getUTCDay(); return addDays(today, (p.wd! - w + 7) % 7); }
  const [y, m, d] = today.split("-").map(Number);
  return d <= p.day! ? `${today.slice(0, 8)}${String(p.day).padStart(2, "0")}` : new Date(Date.UTC(y, m, p.day!)).toISOString().slice(0, 10);
}
const when = (p: (typeof PRESETS)[number]) => (p.rule === "weekly" ? `Toda ${WEEKDAY[p.wd!]}` : `Todo dia ${p.day} do mês`);

type Props = { open: boolean; onClose: () => void; spaces: any[]; statuses: any[]; tasks: any[]; today: string; onChanged: () => void };

/** Rotinas: tarefas recorrentes prontas, ligadas ou desligadas num clique, no espaço "Rotina" */
export default function Routines({ open, onClose, spaces, statuses, tasks, today, onChanged }: Props) {
  const acc = useAccess();
  const gestor = !acc || hubAllowed(acc.tools, "agency");
  const [busy, setBusy] = useState<string | null>(null);
  const [own, setOwn] = useState({ title: "", recurrence: "weekly", due_date: today });
  const s = () => createClient();
  const space = spaces.find((x) => x.name === ROUTINE_SPACE);
  const active = (title: string) => !!space && tasks.some((t) => t.space_id === space.id && !t.done && !t.parent_id && t.recurrence && t.title === title);
  const mine = space ? tasks.filter((t) => t.space_id === space.id && !t.done && !t.parent_id && t.recurrence && !PRESETS.some((p) => p.title === t.title)) : [];

  async function ensureSpace() {
    if (space) return { id: space.id, first: statuses.filter((x) => x.space_id === space.id).sort((a, b) => a.position - b.position)[0]?.id };
    const { data, error } = await s().from("ag_spaces").insert({ name: ROUTINE_SPACE, color: "#c084fc", position: Date.now() / 1e10 }).select().single();
    if (error || !data) { alert(error?.message || "Não foi possível criar o espaço Rotina."); return null; }
    const tpl = TEMPLATES.find((x) => x.k === "simples")!;
    const { data: st } = await s().from("ag_space_statuses").insert(tpl.statuses.map(([n, c, ty], i) => ({ space_id: data.id, name: n, color: c, type: ty, position: i }))).select();
    return { id: data.id, first: (st || []).sort((a: any, b: any) => a.position - b.position)[0]?.id };
  }
  async function add(title: string, recurrence: string, due_date: string, description?: string) {
    const sp = await ensureSpace(); if (!sp) return;
    const { error } = await s().from("ag_tasks").insert({ title, recurrence, due_date, description: description || null, space_id: sp.id, status_id: sp.first, priority: null });
    if (error) alert(error.message);
  }
  async function toggle(p: (typeof PRESETS)[number]) {
    setBusy(p.k);
    if (active(p.title)) await s().from("ag_tasks").delete().eq("space_id", space.id).eq("title", p.title).eq("done", false).not("recurrence", "is", null);
    else await add(p.title, p.rule, firstDate(p, today), p.desc);
    setBusy(null); onChanged();
  }
  async function addOwn(e: React.FormEvent) {
    e.preventDefault(); if (!own.title.trim()) return;
    setBusy("own"); await add(own.title.trim(), own.recurrence, own.due_date || today);
    setOwn({ ...own, title: "" }); setBusy(null); onChanged();
  }
  async function stop(t: any) { await s().from("ag_tasks").delete().eq("id", t.id); onChanged(); }

  return (
    <Modal open={open} title="Rotinas" onClose={onClose}>
      <p className="text-sm text-fog mb-4">Tarefas que se repetem sozinhas. Ao concluir, a próxima já aparece com o novo prazo. Ficam no espaço &quot;{ROUTINE_SPACE}&quot;.</p>
      <ul className="space-y-2">
        {PRESETS.filter((p) => !p.gestor || gestor).map((p) => {
          const on = active(p.title);
          return (
            <li key={p.k} className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${on ? "border-mint/50 bg-mint/5" : "border-line"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-fog">{when(p)} · {p.desc}</p>
              </div>
              <button disabled={busy === p.k} onClick={() => toggle(p)} role="switch" aria-checked={on} aria-label={p.title}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${on ? "bg-mint" : "bg-panel2 border border-line"}`}>
                <span className={`block w-5 h-5 rounded-full transition-transform ${on ? "translate-x-4 bg-[var(--color-on-mint,#06140e)]" : "bg-fog"}`} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="label mt-6">Suas rotinas</p>
      {!!mine.length && <ul className="space-y-1.5 mb-3">{mine.map((t) => (
        <li key={t.id} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2 text-sm">
          <span className="flex-1 truncate">{t.title}</span>
          <span className="text-xs text-fog whitespace-nowrap">{recurLabel(t.recurrence)}</span>
          <button onClick={() => stop(t)} className="text-fog hover:text-danger" title="Parar rotina"><I.trash className="w-3.5 h-3.5" /></button>
        </li>
      ))}</ul>}
      <form onSubmit={addOwn} className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2">
        <input className="input" placeholder="Ex.: Responder directs" value={own.title} onChange={(e) => setOwn({ ...own, title: e.target.value })} />
        <select className="input !w-auto" value={own.recurrence} onChange={(e) => setOwn({ ...own, recurrence: e.target.value })}>{RECUR.filter((r) => r.k).map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}</select>
        <input type="date" className="input !w-auto" title="Primeira vez" value={own.due_date} onChange={(e) => setOwn({ ...own, due_date: e.target.value })} />
        <button className="btn btn-mint" disabled={busy === "own"}><I.plus className="w-4 h-4" /></button>
      </form>
    </Modal>
  );
}
