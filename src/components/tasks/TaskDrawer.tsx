"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { I } from "@/components/icons";
import { PRIORITIES, Flag, RECUR } from "./shared";

type Props = {
  task: any | null; onClose: () => void; onChanged: () => void;
  spaces: any[]; statuses: any[]; lists: any[]; tags: any[]; team: any[]; projects: any[]; tasks: any[]; onOpen?: (t: any) => void;
};

export default function TaskDrawer({ task, onClose, onChanged, spaces, statuses, lists, tags, team, projects, tasks, onOpen }: Props) {
  const [t, setT] = useState<any>(task);
  const [sub, setSub] = useState("");
  useEffect(() => setT(task), [task]);
  useEffect(() => {
    if (!task) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [task, onClose]);
  if (!task || !t) return null;
  const s = () => createClient();

  async function upd(v: any) {
    setT({ ...t, ...v });
    const { error } = await s().from("ag_tasks").update(v).eq("id", t.id);
    if (error) alert(error.message); onChanged();
  }
  async function moveSpace(space_id: string) {
    const first = statuses.filter((x) => x.space_id === space_id).sort((a, b) => a.position - b.position)[0];
    await upd({ space_id, inbox: false, list_id: null, status_id: first?.id || null, tags: (t.tags || []).filter((id: string) => { const g = tags.find((x) => x.id === id); return g && (!g.space_id || g.space_id === space_id); }) });
  }
  async function addSub(e: React.FormEvent) {
    e.preventDefault(); if (!sub.trim()) return;
    const first = statuses.filter((x) => x.space_id === t.space_id).sort((a, b) => a.position - b.position)[0];
    await s().from("ag_tasks").insert({ title: sub.trim(), parent_id: t.id, space_id: t.space_id, list_id: t.list_id, status_id: first?.id, priority: null });
    setSub(""); onChanged();
  }
  async function toggleSub(x: any) { await s().from("ag_tasks").update({ done: !x.done }).eq("id", x.id); onChanged(); }
  async function delSub(x: any) { await s().from("ag_tasks").delete().eq("id", x.id); onChanged(); }
  async function del() {
    if (!confirm(`Excluir "${t.title}"${subs.length ? ` e ${subs.length} subtarefa(s)` : ""}?`)) return;
    await s().from("ag_tasks").delete().eq("id", t.id); onChanged(); onClose();
  }

  const st = statuses.filter((x) => x.space_id === t.space_id).sort((a, b) => a.position - b.position);
  const cur = st.find((x) => x.id === t.status_id);
  const ls = lists.filter((x) => x.space_id === t.space_id);
  const tg = tags.filter((x) => !x.space_id || x.space_id === t.space_id);
  const subs = tasks.filter((x) => x.parent_id === t.id).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const toggleTag = (id: string) => { const cur = t.tags || []; upd({ tags: cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id] }); };
  const parent = t.parent_id ? tasks.find((x) => x.id === t.parent_id) : null;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 min-h-9"><span className="text-xs text-fog">{label}</span><div className="min-w-0">{children}</div></div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-xl h-full bg-panel border-l border-line overflow-y-auto scroll-thin rise" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-panel/95 backdrop-blur border-b border-line px-5 py-3 flex items-center gap-2 z-10">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: spaces.find((x) => x.id === t.space_id)?.color }} />
          <span className="text-xs text-fog truncate flex-1">{spaces.find((x) => x.id === t.space_id)?.name}{t.list_id ? ` / ${lists.find((x) => x.id === t.list_id)?.name}` : ""}</span>
          <button onClick={del} className="text-fog hover:text-danger p-1" title="Excluir"><I.trash className="w-4 h-4" /></button>
          <button onClick={onClose} className="text-fog hover:text-paper text-sm px-2">Fechar</button>
        </div>
        <div className="p-5 space-y-5">
          {parent && <button onClick={() => (onOpen || setT)(parent)} className="text-xs text-fog hover:text-mint">↖ {parent.title}</button>}
          <div className="flex items-start gap-3">
            <button onClick={() => upd({ done: !t.done })} className={`mt-1.5 w-5 h-5 rounded-full border-2 shrink-0 grid place-items-center ${t.done ? "bg-mint border-mint text-ink" : "border-slate hover:border-mint"}`}>{t.done && "✓"}</button>
            <textarea rows={1} className="w-full bg-transparent font-display font-bold text-2xl leading-tight resize-none outline-none" defaultValue={t.title} key={t.id}
              onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && upd({ title: e.target.value.trim() })} />
          </div>

          <div className="space-y-1.5">
            <Row label="Etapa">
              <div className="flex flex-wrap gap-1">{st.map((x) => (
                <button key={x.id} onClick={() => upd({ status_id: x.id })} className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border"
                  style={x.id === t.status_id ? { background: x.color, color: "#0c0c0d", borderColor: x.color } : { color: x.color, borderColor: x.color + "55" }}>{x.name}</button>
              ))}</div>
            </Row>
            <Row label="Espaço">
              <div className="flex gap-2">
                <select className="input !py-1.5" value={t.space_id || ""} onChange={(e) => moveSpace(e.target.value)}>{spaces.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <select className="input !py-1.5" value={t.list_id || ""} onChange={(e) => upd({ list_id: e.target.value || null })}><option value="">Sem lista</option>{ls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </div>
            </Row>
            <Row label="Responsável">
              <select className="input !py-1.5" value={t.assignee || ""} onChange={(e) => upd({ assignee: e.target.value || null })}><option value="">Ninguém</option>{team.map((m) => <option key={m.id}>{m.name}</option>)}</select>
            </Row>
            <Row label="Datas">
              <div className="flex items-center gap-2">
                <input type="date" className="input !py-1.5" value={t.start_date || ""} onChange={(e) => upd({ start_date: e.target.value || null })} title="Início" />
                <span className="text-fog text-xs">→</span>
                <input type="date" className="input !py-1.5" value={t.due_date || ""} onChange={(e) => upd({ due_date: e.target.value || null })} title="Prazo" />
              </div>
            </Row>
            <Row label="Repetir">
              <div className="flex items-center gap-2">
                <select className="input !py-1.5" value={t.recurrence || ""} onChange={(e) => upd({ recurrence: e.target.value || null, recur_spawned: false })}>{RECUR.map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}</select>
                {t.recurrence && <input type="date" className="input !py-1.5" title="Repetir até" value={t.recurrence_until || ""} onChange={(e) => upd({ recurrence_until: e.target.value || null })} />}
              </div>
              {t.recurrence && <p className="text-[11px] text-fog mt-1">Ao concluir, a próxima tarefa é criada sozinha{t.due_date ? "" : " (defina um prazo)"}.{t.recurrence_until ? "" : " Sem data final."}</p>}
            </Row>
            {t.event_id && <Row label="Agenda"><Link href="/agency/agenda" className="text-sm text-mint hover:underline">Compromisso vinculado ↗</Link></Row>}
            <Row label="Prioridade">
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((p) => (
                  <button key={p.k} onClick={() => upd({ priority: t.priority === p.k ? null : p.k })} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${t.priority === p.k ? "border-paper/50 bg-panel2" : "border-line text-fog"}`}><Flag p={p.k} />{p.l}</button>
                ))}
              </div>
            </Row>
            <Row label="Tags">
              <div className="flex flex-wrap gap-1">
                {tg.map((g) => {
                  const on = (t.tags || []).includes(g.id);
                  return <button key={g.id} onClick={() => toggleTag(g.id)} className="text-[11px] px-2 py-0.5 rounded-full border" style={on ? { background: g.color + "33", color: g.color, borderColor: g.color } : { color: "#8a8f94", borderColor: "#2a2a2e" }}>{g.name}</button>;
                })}
                {!tg.length && <span className="text-xs text-fog">Crie tags na engrenagem do espaço.</span>}
              </div>
            </Row>
            <Row label="Projeto">
              <div className="flex items-center gap-2">
                <select className="input !py-1.5" value={t.project_id || ""} onChange={(e) => upd({ project_id: e.target.value || null })}><option value="">Nenhum</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                {t.project_id && <Link href={`/agency/projetos/${t.project_id}`} className="text-fog hover:text-mint"><I.arrow className="w-4 h-4" /></Link>}
              </div>
            </Row>
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea key={t.id + "d"} rows={5} className="input" placeholder="Detalhes, links, briefing…" defaultValue={t.description || ""} onBlur={(e) => e.target.value !== (t.description || "") && upd({ description: e.target.value || null })} />
          </div>

          {!t.parent_id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label !mb-0">Subtarefas</label>
                {!!subs.length && <span className="text-xs text-fog">{subs.filter((x) => x.done).length}/{subs.length}</span>}
              </div>
              {!!subs.length && <div className="h-1 bg-panel2 rounded mb-2 overflow-hidden"><div className="h-full bg-mint" style={{ width: `${(subs.filter((x) => x.done).length / subs.length) * 100}%` }} /></div>}
              <ul className="space-y-1">
                {subs.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 bg-panel2 rounded-lg px-3 py-2 group">
                    <input type="checkbox" checked={!!x.done} onChange={() => toggleSub(x)} className="accent-[var(--color-mint)]" />
                    <button onClick={() => (onOpen || setT)(x)} className={`flex-1 text-left text-sm ${x.done ? "line-through text-fog" : ""}`}>{x.title}</button>
                    {x.assignee && <span className="text-[10px] text-fog">{x.assignee}</span>}
                    <button onClick={() => delSub(x)} className="opacity-0 group-hover:opacity-100 text-fog hover:text-danger"><I.trash className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
              <form onSubmit={addSub} className="flex gap-2 mt-2"><input className="input !py-1.5" placeholder="+ Adicionar subtarefa" value={sub} onChange={(e) => setSub(e.target.value)} /></form>
            </div>
          )}
          {cur && <p className="text-[11px] text-fog">Criada em {new Date(t.created_at).toLocaleDateString("pt-BR")}{t.done_at ? ` · concluída em ${new Date(t.done_at).toLocaleDateString("pt-BR")}` : ""}</p>}
        </div>
      </aside>
    </div>
  );
}
