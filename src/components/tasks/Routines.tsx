"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/agency/Modal";
import { useAccess } from "@/lib/useAccess";
import { hubAllowed } from "@/lib/access";
import { I } from "@/components/icons";
import { PRIORITIES, TEMPLATES } from "./shared";
import { syncTask, unsyncTask } from "@/lib/gsync";

export const ROUTINE_SPACE = "Rotina";
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Freq = "daily" | "weekdays" | "days" | "monthly" | "yearly";
export type RoutineForm = {
  title: string; description: string; freq: Freq; days: number[]; every: 1 | 2; monthDay: number;
  start: string; until: string; time: string; remind: string; checklist: string[]; priority: string; assignee: string; space_id: string;
};

/** modelos para começar: abrem o editor já preenchido */
const PRESETS: { k: string; title: string; desc: string; f: Partial<RoutineForm>; gestor?: boolean }[] = [
  { k: "planejar", title: "Planejar a semana", desc: "Revisar atrasadas e distribuir as tarefas pelos dias.", f: { freq: "days", days: [1], time: "09:00", checklist: ["Revisar atrasadas", "Distribuir tarefas pelos dias", "Conferir agenda"] } },
  { k: "pauta", title: "Montar a pauta da semana", desc: "Definir os conteúdos e datas de publicação.", f: { freq: "days", days: [1] } },
  { k: "gravar", title: "Gravar conteúdos da semana", desc: "Bloco de gravação dos conteúdos em produção.", f: { freq: "days", days: [3], checklist: ["Separar roteiros", "Preparar cenário e luz", "Gravar", "Subir arquivos"] } },
  { k: "relatorio", title: "Relatório de desempenho", desc: "Olhar alcance, salvamentos e o que funcionou.", f: { freq: "days", days: [5] } },
  { k: "financeiro", title: "Revisão financeira", desc: "Conferir recebimentos, contas a pagar e cobranças.", f: { freq: "days", days: [5] }, gestor: true },
  { k: "diagnostico", title: "Diagnóstico do perfil", desc: "Refazer o raio-X do perfil e comparar com o mês anterior.", f: { freq: "monthly", monthDay: 1 } },
];

const REMIND = [
  { k: "", l: "Sem lembrete" }, { k: "0", l: "Na hora" }, { k: "15", l: "15 min antes" },
  { k: "60", l: "1 hora antes" }, { k: "1440", l: "1 dia antes" },
];

const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();
/** primeira data a partir de d (inclusive) que cai no dia da semana w */
const nextWd = (d: string, w: number) => addDays(d, (w - dow(d) + 7) % 7);
function nextMonthDay(d: string, day: number) {
  const [y, m] = d.split("-").map(Number);
  const at = (yy: number, mm: number) => { const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate(); return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`; };
  const here = at(y, m);
  return here >= d ? here : m === 12 ? at(y + 1, 1) : at(y, m + 1);
}
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : "");
const fmtTime = (t: string) => (t.endsWith(":00") ? `${Number(t.slice(0, 2))}h` : t.replace(":", "h"));
/** horário de Brasília → instante ISO, menos o aviso em minutos */
const remindAt = (date: string, time: string, min: string) => (min === "" ? null : new Date(new Date(`${date}T${time || "09:00"}:00-03:00`).getTime() - Number(min) * 60000).toISOString());

/** descrição curta da repetição, ex.: "seg, qua, sex · 9h" */
export function scheduleLabel(f: Pick<RoutineForm, "freq" | "days" | "every" | "monthDay" | "time">) {
  const base = f.freq === "daily" ? "Todo dia" : f.freq === "weekdays" ? "Dias úteis" : f.freq === "monthly" ? `Todo dia ${f.monthDay} do mês` : f.freq === "yearly" ? "Todo ano"
    : (f.every === 2 ? "A cada 2 semanas · " : "") + WD_ORDER.filter((w) => f.days.includes(w)).map((w) => WD[w].toLowerCase()).join(", ");
  return f.time ? `${base} · ${fmtTime(f.time)}` : base;
}

/** grupo de tarefas abertas que formam uma rotina → formulário do editor */
function formOf(g: any[], all: any[], today: string): RoutineForm {
  const t = g[0];
  const due = t.due_date || today;
  const days = [...new Set(g.map((x) => dow(x.due_date || today)))];
  const freq: Freq = t.recurrence === "daily" ? "daily" : t.recurrence === "weekdays" ? "weekdays" : t.recurrence === "monthly" ? "monthly" : t.recurrence === "yearly" ? "yearly" : "days";
  let remind = "";
  if (t.remind_at && t.due_date) {
    const diff = Math.round((new Date(`${t.due_date}T${hhmm(t.due_time) || "09:00"}:00-03:00`).getTime() - new Date(t.remind_at).getTime()) / 60000);
    remind = REMIND.find((r) => r.k === String(diff))?.k ?? "0";
  }
  return {
    title: t.title, description: t.description || "", freq, days, every: t.recurrence === "biweekly" ? 2 : 1, monthDay: Number(due.slice(8)),
    start: today, until: t.recurrence_until || "", time: hhmm(t.due_time), remind,
    checklist: all.filter((x) => x.parent_id === t.id).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")).map((x) => x.title),
    priority: t.priority || "", assignee: t.assignee || "", space_id: t.space_id || "",
  };
}

type PanelProps = { spaces: any[]; statuses: any[]; tasks: any[]; today: string; onChanged: () => void; wide?: boolean };

export default function Routines({ open, onClose, ...p }: PanelProps & { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Rotinas" onClose={onClose}>
      <p className="text-sm text-fog mb-4">Tarefas que se repetem sozinhas. Ao concluir, a próxima já aparece com o novo prazo.</p>
      <RoutinesPanel {...p} />
    </Modal>
  );
}

/** Rotinas: o usuário monta as próprias (dias, horário, lembrete, checklist) ou parte de um modelo */
export function RoutinesPanel({ spaces, statuses, tasks, today, onChanged, wide }: PanelProps) {
  const acc = useAccess();
  const gestor = !acc || hubAllowed(acc.tools, "agency");
  const [edit, setEdit] = useState<{ key: string | null; form: RoutineForm } | null>(null);
  const [busy, setBusy] = useState(false);
  const s = () => createClient();
  const space = spaces.find((x) => x.kind === "rotina") || spaces.find((x) => !x.kind && x.name === ROUTINE_SPACE);

  // rotina = tarefas abertas com a mesma routine_key; as antigas (sem chave) no espaço Rotina agrupam pelo título
  const groups = new Map<string, any[]>();
  for (const t of tasks) {
    if (t.done || t.parent_id || !t.recurrence) continue;
    const key = t.routine_key || (space && t.space_id === space.id ? "t:" + t.title : null);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  const mine = [...groups.entries()].map(([key, g]) => ({ key, g: g.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")), f: formOf(g, tasks, today) }))
    .sort((a, b) => a.f.title.localeCompare(b.f.title));

  const blank = (p?: Partial<RoutineForm>): RoutineForm => ({
    title: "", description: "", freq: "days", days: [dow(today)], every: 1, monthDay: Number(today.slice(8)), start: today, until: "",
    time: "", remind: "", checklist: [], priority: "", assignee: "", space_id: space?.id || "", ...p,
  });

  async function ensureSpace() {
    if (space) return space.id as string;
    // único por dono (kind = rotina): se outro clique já criou, usa o existente
    const { data, error } = await s().from("ag_spaces").insert({ name: ROUTINE_SPACE, color: "#c084fc", position: Date.now() / 1e10, kind: "rotina" }).select().single();
    if (error?.code === "23505") { const { data: ex } = await s().from("ag_spaces").select("id").eq("kind", "rotina").single(); return ex?.id || null; }
    if (error || !data) { alert(error?.message || "Não foi possível criar o espaço Rotina."); return null; }
    const tpl = TEMPLATES.find((x) => x.k === "simples")!;
    await s().from("ag_space_statuses").insert(tpl.statuses.map(([n, c, ty], i) => ({ space_id: data.id, name: n, color: c, type: ty, position: i })));
    return data.id as string;
  }
  async function firstStatus(spaceId: string) {
    const local = statuses.filter((x) => x.space_id === spaceId).sort((a, b) => a.position - b.position)[0]?.id;
    if (local) return local;
    const { data } = await s().from("ag_space_statuses").select("id").eq("space_id", spaceId).order("position").limit(1);
    return data?.[0]?.id || null;
  }
  async function remove(g: any[]) {
    const ids = g.map((t) => t.id);
    await Promise.all(ids.map((id) => unsyncTask(id)));
    await s().from("ag_tasks").delete().in("parent_id", ids);
    await s().from("ag_tasks").delete().in("id", ids);
  }

  async function save(key: string | null, f: RoutineForm) {
    const spaceId = f.space_id || (await ensureSpace()); if (!spaceId) return;
    const status = await firstStatus(spaceId);
    // uma tarefa por dia escolhido; todos os 7 dias vira "todo dia" e seg–sex vira "dias úteis"
    let freq = f.freq;
    const days = [...f.days].sort();
    if (freq === "days" && f.every === 1 && days.length === 7) freq = "daily";
    if (freq === "days" && f.every === 1 && days.join() === "1,2,3,4,5") freq = "weekdays";
    const runs: { due: string; rule: string }[] =
      freq === "daily" ? [{ due: f.start, rule: "daily" }]
      : freq === "weekdays" ? [{ due: [0, 6].includes(dow(f.start)) ? nextWd(f.start, 1) : f.start, rule: "weekdays" }]
      : freq === "monthly" ? [{ due: nextMonthDay(f.start, f.monthDay), rule: "monthly" }]
      : freq === "yearly" ? [{ due: f.start, rule: "yearly" }]
      : days.map((w) => ({ due: nextWd(f.start, w), rule: f.every === 2 ? "biweekly" : "weekly" }));
    const newKey = key?.startsWith("r:") ? key : "r:" + crypto.randomUUID();
    const rows = runs.map((r) => ({
      title: f.title.trim(), description: f.description.trim() || null, recurrence: r.rule, recurrence_until: f.until || null, due_date: r.due,
      due_time: f.time || null, remind_at: remindAt(r.due, f.time, f.remind), priority: f.priority || null, assignee: f.assignee || null,
      space_id: spaceId, status_id: status, routine_key: newKey,
    }));
    const { data, error } = await s().from("ag_tasks").insert(rows).select("id");
    if (error) { alert(error.message); return false; }
    const items = f.checklist.map((x) => x.trim()).filter(Boolean);
    if (items.length && data?.length)
      await s().from("ag_tasks").insert(data.flatMap((t: any) => items.map((title) => ({ title, parent_id: t.id, space_id: spaceId, status_id: status, priority: null }))));
    if (key) await remove(groups.get(key) || []);
    data?.forEach((t: any) => syncTask(t.id));
    return true;
  }

  async function submit(f: RoutineForm) {
    if (!f.title.trim() || (f.freq === "days" && !f.days.length)) return;
    setBusy(true);
    const ok = await save(edit?.key || null, f);
    setBusy(false);
    if (ok) { setEdit(null); onChanged(); }
  }
  async function del(key: string) {
    if (!confirm("Excluir esta rotina? As próximas ocorrências deixam de aparecer.")) return;
    setBusy(true); await remove(groups.get(key) || []); setBusy(false); setEdit(null); onChanged();
  }

  const nextOf = (g: any[]) => g.map((t) => t.due_date).filter(Boolean).sort()[0];

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="label !mb-0">Suas rotinas{mine.length ? ` · ${mine.length}` : ""}</p>
        <button className="btn btn-mint btn-sm" onClick={() => setEdit({ key: null, form: blank() })}><I.plus className="w-4 h-4" /> Nova rotina</button>
      </div>
      {!mine.length ? (
        <p className="text-sm text-fog border border-dashed border-line rounded-xl px-4 py-5 mb-6">Você ainda não tem rotinas. Crie a sua do zero ou comece por um dos modelos abaixo.</p>
      ) : (
        <ul className={`mb-6 ${wide ? "grid md:grid-cols-2 gap-2" : "space-y-2"}`}>{mine.map(({ key, g, f }) => {
          const nx = nextOf(g);
          return (
            <li key={key}>
              <button onClick={() => setEdit({ key, form: f })} className="w-full text-left flex items-center gap-3 border border-mint/40 bg-mint/5 hover:border-mint rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.title}</p>
                  <p className="text-xs text-fog truncate">{scheduleLabel(f)}{f.checklist.length ? ` · ${f.checklist.length} itens` : ""}{f.remind ? " · com lembrete" : ""}</p>
                </div>
                {nx && <span className="text-[11px] text-fog whitespace-nowrap">próxima {nx === today ? "hoje" : `${nx.slice(8)}/${nx.slice(5, 7)}`}</span>}
                <I.pen className="w-3.5 h-3.5 text-fog shrink-0" />
              </button>
            </li>
          );
        })}</ul>
      )}

      <p className="label">Modelos para começar</p>
      <ul className={wide ? "grid md:grid-cols-2 gap-x-6 gap-y-2" : "space-y-2"}>
        {PRESETS.filter((p) => !p.gestor || gestor).map((p) => (
          <li key={p.k} className="flex items-center gap-3 border border-line rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-xs text-fog">{p.desc}</p>
            </div>
            <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setEdit({ key: null, form: blank({ title: p.title, description: p.desc, ...p.f }) })}>Usar</button>
          </li>
        ))}
      </ul>

      {edit && <RoutineEditor initial={edit.form} isNew={!edit.key} busy={busy} spaces={spaces} rotinaId={space?.id}
        onClose={() => setEdit(null)} onSave={submit} onDelete={edit.key ? () => del(edit.key!) : undefined} />}
    </>
  );
}

function RoutineEditor({ initial, isNew, busy, spaces, rotinaId, onClose, onSave, onDelete }: {
  initial: RoutineForm; isNew: boolean; busy: boolean; spaces: any[]; rotinaId?: string; onClose: () => void; onSave: (f: RoutineForm) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState(initial);
  const [item, setItem] = useState("");
  const [team, setTeam] = useState<string[]>([]);
  useEffect(() => { createClient().from("ag_team").select("name").order("name").then(({ data }) => setTeam((data || []).map((x: any) => x.name))); }, []);
  const set = (p: Partial<RoutineForm>) => setF((x) => ({ ...x, ...p }));
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm border ${on ? "bg-mint text-[var(--color-on-mint,#06140e)] border-mint font-semibold" : "border-line text-fog hover:border-slate"}`;
  const addItem = () => { if (item.trim()) { set({ checklist: [...f.checklist, item.trim()] }); setItem(""); } };
  const otherSpaces = spaces.filter((x) => x.id !== rotinaId && x.kind !== "projetos");
  const invalid = !f.title.trim() || (f.freq === "days" && !f.days.length);

  return (
    <Modal open title={isNew ? "Nova rotina" : "Editar rotina"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" autoFocus placeholder="Ex.: Responder directs, Treino, Fechar o caixa" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">Descrição</label>
          <textarea className="input min-h-[64px]" placeholder="Opcional" value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </div>

        <div>
          <label className="label">Repete</label>
          <div className="flex flex-wrap gap-2">
            {([["daily", "Todo dia"], ["weekdays", "Dias úteis"], ["days", "Dias da semana"], ["monthly", "Todo mês"], ["yearly", "Todo ano"]] as [Freq, string][]).map(([k, l]) => (
              <button type="button" key={k} className={chip(f.freq === k)} onClick={() => set({ freq: k })}>{l}</button>
            ))}
          </div>
          {f.freq === "days" && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {WD_ORDER.map((w) => (
                  <button type="button" key={w} aria-pressed={f.days.includes(w)} className={`w-11 ${chip(f.days.includes(w))} !px-0`}
                    onClick={() => set({ days: f.days.includes(w) ? f.days.filter((x) => x !== w) : [...f.days, w] })}>{WD[w]}</button>
                ))}
              </div>
              <select className="input !w-auto" value={f.every} onChange={(e) => set({ every: Number(e.target.value) as 1 | 2 })}>
                <option value={1}>Toda semana</option><option value={2}>A cada 2 semanas</option>
              </select>
            </div>
          )}
          {f.freq === "monthly" && (
            <div className="mt-3 flex items-center gap-2 text-sm">No dia
              <input type="number" min={1} max={31} className="input !w-20" value={f.monthDay} onChange={(e) => set({ monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} /> de cada mês
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Horário</label>
            <input type="time" className="input" value={f.time} onChange={(e) => set({ time: e.target.value })} />
          </div>
          <div>
            <label className="label">Lembrete</label>
            <select className="input" value={f.remind} onChange={(e) => set({ remind: e.target.value })}>{REMIND.map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}</select>
          </div>
          <div>
            <label className="label">{f.freq === "yearly" ? "Data" : "Começa em"}</label>
            <input type="date" className="input" value={f.start} onChange={(e) => set({ start: e.target.value || f.start })} />
          </div>
          <div>
            <label className="label">Termina em</label>
            <input type="date" className="input" min={f.start} value={f.until} onChange={(e) => set({ until: e.target.value })} title="Deixe vazio para não terminar" />
          </div>
        </div>

        <div>
          <label className="label">Checklist</label>
          {!!f.checklist.length && (
            <ul className="space-y-1.5 mb-2">{f.checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2 bg-panel2 rounded-lg px-3 py-1.5 text-sm">
                <span className="w-3.5 h-3.5 rounded border border-line shrink-0" />
                <input className="flex-1 bg-transparent outline-none" value={c} onChange={(e) => set({ checklist: f.checklist.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" onClick={() => set({ checklist: f.checklist.filter((_, j) => j !== i) })} className="text-fog hover:text-danger" aria-label="Remover item"><I.trash className="w-3.5 h-3.5" /></button>
              </li>
            ))}</ul>
          )}
          <div className="flex gap-2">
            <input className="input" placeholder="Adicionar passo" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
            <button type="button" className="btn btn-ghost" onClick={addItem} aria-label="Adicionar passo"><I.plus className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Prioridade</label>
            <select className="input" value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="">Nenhuma</option>{PRIORITIES.filter((p: any) => p.k).map((p: any) => <option key={p.k} value={p.k}>{p.l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Responsável</label>
            <select className="input" value={f.assignee} onChange={(e) => set({ assignee: e.target.value })}>
              <option value="">Eu</option>{team.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Espaço</label>
            <select className="input" value={f.space_id === rotinaId ? "" : f.space_id} onChange={(e) => set({ space_id: e.target.value || rotinaId || "" })}>
              <option value="">Rotina</option>{otherSpaces.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>

        <p className="text-xs text-fog">{f.title.trim() ? `${f.title.trim()}: ` : ""}{scheduleLabel(f)}{f.until ? ` até ${f.until.slice(8)}/${f.until.slice(5, 7)}` : ""}. Ao concluir, a próxima aparece sozinha.</p>
        <div className="flex items-center gap-2 pt-1">
          {onDelete && <button type="button" className="btn btn-ghost text-danger" disabled={busy} onClick={onDelete}><I.trash className="w-4 h-4" /> Excluir</button>}
          <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>Cancelar</button>
          <button className="btn btn-mint" disabled={busy || invalid}>{busy ? "Salvando…" : isNew ? "Criar rotina" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
