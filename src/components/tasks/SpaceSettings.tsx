"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";
import { STATUS_TYPES, TEMPLATES, Swatches, PALETTE } from "./shared";

type Props = { open: boolean; onClose: () => void; space: any | null; statuses: any[]; lists: any[]; tags: any[]; tasks: any[]; onChanged: (newSpaceId?: string) => void };

export default function SpaceSettings({ open, onClose, space, statuses, lists, tags, tasks, onChanged }: Props) {
  const isNew = !space;
  const [name, setName] = useState(space?.name || "");
  const [color, setColor] = useState(space?.color || PALETTE[0]);
  const [tpl, setTpl] = useState("simples");
  const [tab, setTab] = useState<"etapas" | "listas" | "tags">("etapas");
  const [newStatus, setNewStatus] = useState({ name: "", color: "#7aa7ff", type: "andamento" });
  const [newList, setNewList] = useState("");
  const [newTag, setNewTag] = useState({ name: "", color: "#c084fc" });
  const [busy, setBusy] = useState(false);
  const s = () => createClient();
  const st = statuses.filter((x) => x.space_id === space?.id).sort((a, b) => a.position - b.position);
  const ls = lists.filter((x) => x.space_id === space?.id).sort((a, b) => a.position - b.position);
  const tg = tags.filter((x) => x.space_id === space?.id || !x.space_id);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const { data } = await s().from("ag_spaces").insert({ name: name.trim(), color, position: Date.now() / 1e10 }).select().single();
    if (data) {
      const t = TEMPLATES.find((x) => x.k === tpl)!;
      await s().from("ag_space_statuses").insert(t.statuses.map(([n, c, ty], i) => ({ space_id: data.id, name: n, color: c, type: ty, position: i })));
      onChanged(data.id); onClose();
    }
    setBusy(false);
  }
  async function saveSpace() { await s().from("ag_spaces").update({ name: name.trim() || space.name, color }).eq("id", space.id); onChanged(); }
  async function updStatus(id: string, v: any) { await s().from("ag_space_statuses").update(v).eq("id", id); onChanged(); }
  async function move(i: number, d: number) {
    const a = st[i], b = st[i + d]; if (!a || !b) return;
    await Promise.all([s().from("ag_space_statuses").update({ position: b.position }).eq("id", a.id), s().from("ag_space_statuses").update({ position: a.position }).eq("id", b.id)]);
    onChanged();
  }
  async function addStatus() {
    if (!newStatus.name.trim()) return;
    const pos = (st.at(-1)?.position ?? -1) + 1;
    // concluídas ficam no fim; as outras entram antes da primeira concluída
    const firstDone = st.find((x) => x.type === "concluido");
    const position = newStatus.type !== "concluido" && firstDone ? firstDone.position - 0.5 : pos;
    await s().from("ag_space_statuses").insert({ space_id: space.id, ...newStatus, name: newStatus.name.trim(), position });
    setNewStatus({ ...newStatus, name: "" }); onChanged();
  }
  async function delStatus(x: any) {
    const others = st.filter((y) => y.id !== x.id);
    if (!others.length) return alert("O espaço precisa ter ao menos uma etapa.");
    const target = others.find((y) => y.type === x.type) || others[0];
    const n = tasks.filter((t) => t.status_id === x.id).length;
    if (!confirm(`Excluir a etapa "${x.name}"?${n ? ` ${n} tarefa(s) vão para "${target.name}".` : ""}`)) return;
    if (n) await s().from("ag_tasks").update({ status_id: target.id }).eq("status_id", x.id);
    await s().from("ag_space_statuses").delete().eq("id", x.id); onChanged();
  }
  async function addList() { if (!newList.trim()) return; await s().from("ag_lists").insert({ space_id: space.id, name: newList.trim(), position: ls.length }); setNewList(""); onChanged(); }
  async function delList(x: any) { if (!confirm(`Excluir a lista "${x.name}"? As tarefas continuam no espaço.`)) return; await s().from("ag_lists").delete().eq("id", x.id); onChanged(); }
  async function addTag() { if (!newTag.name.trim()) return; await s().from("ag_tags").insert({ space_id: space.id, name: newTag.name.trim(), color: newTag.color }); setNewTag({ ...newTag, name: "" }); onChanged(); }
  async function delTag(x: any) { await s().from("ag_tags").delete().eq("id", x.id); onChanged(); }
  async function delSpace() {
    const n = tasks.filter((t) => t.space_id === space.id).length;
    if (!confirm(`Excluir o espaço "${space.name}"${n ? ` e as ${n} tarefa(s) dele` : ""}? Não dá para desfazer.`)) return;
    await s().from("ag_tasks").delete().eq("space_id", space.id);
    await s().from("ag_spaces").delete().eq("id", space.id); onChanged(""); onClose();
  }

  return (
    <Modal open={open} title={isNew ? "Novo espaço" : `Configurar ${space.name}`} onClose={onClose} wide>
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end mb-5">
        <div><label className="label">Nome do espaço</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !isNew && saveSpace()} placeholder="Ex.: Produção, Marketing, IPM" /></div>
        <div><label className="label">Cor</label><Swatches value={color} onChange={(c) => { setColor(c); if (!isNew) s().from("ag_spaces").update({ color: c }).eq("id", space.id).then(() => onChanged()); }} /></div>
      </div>

      {isNew ? (
        <>
          <label className="label">Começar com as etapas de</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.k} type="button" onClick={() => setTpl(t.k)} className={`text-left rounded-xl border p-3 ${tpl === t.k ? "border-mint bg-mint/5" : "border-line hover:border-slate"}`}>
                <p className="text-sm font-semibold">{t.l}</p>
                <div className="flex flex-wrap gap-1 mt-2">{t.statuses.map(([n, c]) => <span key={n} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: c + "22", color: c }}>{n}</span>)}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-fog mt-3">Depois você renomeia, reordena, muda cores e cria quantas etapas, listas e tags quiser.</p>
          <div className="flex justify-end mt-6"><button disabled={busy} onClick={create} className="btn btn-mint">Criar espaço</button></div>
        </>
      ) : (
        <>
          <div className="flex gap-1 border-b border-line mb-4">{(["etapas", "listas", "tags"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-mint text-mint" : "border-transparent text-fog"}`}>{t}</button>)}</div>

          {tab === "etapas" && (
            <div>
              <ul className="space-y-1.5">
                {st.map((x, i) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2 bg-panel2 rounded-lg p-2">
                    <div className="flex flex-col"><button onClick={() => move(i, -1)} className="text-fog hover:text-paper text-[10px] leading-none">▲</button><button onClick={() => move(i, 1)} className="text-fog hover:text-paper text-[10px] leading-none">▼</button></div>
                    <input type="color" value={x.color} onChange={(e) => updStatus(x.id, { color: e.target.value })} className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer" />
                    <input className="input !py-1.5 flex-1 min-w-[140px]" defaultValue={x.name} onBlur={(e) => e.target.value.trim() && e.target.value !== x.name && updStatus(x.id, { name: e.target.value.trim() })} />
                    <select className="input !py-1.5 !w-36" value={x.type} onChange={(e) => updStatus(x.id, { type: e.target.value })}>{STATUS_TYPES.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}</select>
                    <button onClick={() => delStatus(x)} className="text-fog hover:text-danger p-1"><I.trash className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <input type="color" value={newStatus.color} onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })} className="w-9 h-9 rounded bg-transparent border-0" />
                <input className="input flex-1 min-w-[160px]" placeholder="Nova etapa" value={newStatus.name} onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addStatus()} />
                <select className="input !w-36" value={newStatus.type} onChange={(e) => setNewStatus({ ...newStatus, type: e.target.value })}>{STATUS_TYPES.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}</select>
                <button onClick={addStatus} className="btn btn-ghost"><I.plus className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-fog mt-3">O tipo define o comportamento: tarefas numa etapa “Concluída” contam como feitas nos relatórios e na equipe.</p>
            </div>
          )}

          {tab === "listas" && (
            <div>
              <p className="text-xs text-fog mb-3">Listas organizam as tarefas dentro do espaço (ex.: por cliente, por campanha, por mês).</p>
              <ul className="space-y-1.5">{ls.map((x) => (
                <li key={x.id} className="flex items-center gap-2 bg-panel2 rounded-lg p-2">
                  <input className="input !py-1.5 flex-1" defaultValue={x.name} onBlur={(e) => e.target.value.trim() && e.target.value !== x.name && s().from("ag_lists").update({ name: e.target.value.trim() }).eq("id", x.id).then(() => onChanged())} />
                  <span className="text-xs text-fog">{tasks.filter((t) => t.list_id === x.id).length} tarefas</span>
                  <button onClick={() => delList(x)} className="text-fog hover:text-danger p-1"><I.trash className="w-4 h-4" /></button>
                </li>))}</ul>
              <div className="flex gap-2 mt-3"><input className="input" placeholder="Nova lista" value={newList} onChange={(e) => setNewList(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addList()} /><button onClick={addList} className="btn btn-ghost"><I.plus className="w-4 h-4" /></button></div>
            </div>
          )}

          {tab === "tags" && (
            <div>
              <div className="flex flex-wrap gap-2">{tg.map((x) => (
                <span key={x.id} className="inline-flex items-center gap-1.5 text-xs rounded-full pl-2.5 pr-1 py-1" style={{ background: x.color + "26", color: x.color }}>
                  {x.name}{!x.space_id && <span className="opacity-60">· global</span>}
                  <button onClick={() => delTag(x)} className="w-4 h-4 grid place-items-center rounded-full hover:bg-black/30">×</button>
                </span>))}{!tg.length && <p className="text-sm text-fog">Nenhuma tag ainda.</p>}</div>
              <div className="flex flex-wrap gap-2 mt-4 items-center">
                <input className="input flex-1 min-w-[160px]" placeholder="Nova tag (ex.: urgente-cliente, gravação, IPM)" value={newTag.name} onChange={(e) => setNewTag({ ...newTag, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTag()} />
                <Swatches value={newTag.color} onChange={(c) => setNewTag({ ...newTag, color: c })} />
                <button onClick={addTag} className="btn btn-ghost"><I.plus className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t border-line"><button onClick={delSpace} className="btn btn-ghost text-danger"><I.trash className="w-4 h-4" />Excluir espaço</button><button onClick={onClose} className="btn btn-mint">Pronto</button></div>
        </>
      )}
    </Modal>
  );
}
