"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";
import { STAGES } from "@/lib/content";

type Props = { open: boolean; onClose: () => void; statuses: any[]; items: any[]; onChanged: () => void };

/** renomear, reordenar, colorir, criar e remover os status do conteúdo */
export default function StatusSettings({ open, onClose, statuses, items, onChanged }: Props) {
  const [nw, setNw] = useState({ name: "", color: "#7aa7ff" });
  const s = () => createClient();
  const st = [...statuses].sort((a, b) => a.position - b.position);

  async function upd(id: string, v: any) { await s().from("content_statuses").update(v).eq("id", id); onChanged(); }
  async function move(i: number, d: number) {
    const a = st[i], b = st[i + d]; if (!a || !b) return;
    await Promise.all([s().from("content_statuses").update({ position: b.position }).eq("id", a.id), s().from("content_statuses").update({ position: a.position }).eq("id", b.id)]);
    onChanged();
  }
  async function add() {
    if (!nw.name.trim()) return;
    // entra antes de Publicado, onde costuma caber uma etapa nova
    const pub = st.find((x) => x.stage === "publicado");
    const position = pub ? pub.position - 0.5 : (st.at(-1)?.position ?? -1) + 1;
    await s().from("content_statuses").insert({ name: nw.name.trim(), color: nw.color, position });
    setNw({ ...nw, name: "" }); onChanged();
  }
  async function del(x: any) {
    const others = st.filter((y) => y.id !== x.id);
    if (!others.length) return alert("É preciso ter ao menos um status.");
    const i = st.findIndex((y) => y.id === x.id);
    const target = st[i - 1] || st[i + 1];
    const n = items.filter((t) => t.status_id === x.id).length;
    if (!confirm(`Excluir o status "${x.name}"?${n ? ` ${n} conteúdo(s) vão para "${target.name}".` : ""}`)) return;
    if (n) await s().from("content_ideas").update({ status_id: target.id }).eq("status_id", x.id);
    await s().from("content_statuses").delete().eq("id", x.id); onChanged();
  }

  return (
    <Modal open={open} title="Status do conteúdo" onClose={onClose} wide>
      <p className="text-sm text-fog mb-4">Renomeie, reordene ou crie status. A “regra” liga o status a uma etapa do modelo padrão: é ela que define o que o conteúdo precisa ter para avançar. Status sem regra avançam livremente.</p>
      <ul className="space-y-1.5">
        {st.map((x, i) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2 bg-panel2 rounded-lg p-2">
            <div className="flex flex-col"><button onClick={() => move(i, -1)} className="text-fog hover:text-paper text-[10px] leading-none">▲</button><button onClick={() => move(i, 1)} className="text-fog hover:text-paper text-[10px] leading-none">▼</button></div>
            <input type="color" value={x.color} onChange={(e) => upd(x.id, { color: e.target.value })} className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer" />
            <input className="input !py-1.5 flex-1 min-w-[140px]" defaultValue={x.name} onBlur={(e) => e.target.value.trim() && e.target.value !== x.name && upd(x.id, { name: e.target.value.trim() })} />
            <select className="input !py-1.5 !w-44" value={x.stage || ""} onChange={(e) => upd(x.id, { stage: e.target.value || null })}>
              <option value="">Sem regra</option>{STAGES.map((t) => <option key={t.k} value={t.k}>Regra: {t.l}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-fog"><input type="checkbox" checked={!!x.optional} onChange={(e) => upd(x.id, { optional: e.target.checked })} className="accent-[var(--color-mint)]" />Opcional</label>
            <button onClick={() => del(x)} className="text-fog hover:text-danger p-1"><I.trash className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <input type="color" value={nw.color} onChange={(e) => setNw({ ...nw, color: e.target.value })} className="w-9 h-9 rounded bg-transparent border-0" />
        <input className="input flex-1 min-w-[160px]" placeholder="Novo status (ex.: Legendagem)" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} className="btn btn-ghost"><I.plus className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-fog mt-3">Status opcionais podem ser pulados ao arrastar o conteúdo para frente. Publicar pelo HUB move o conteúdo sozinho para o status com a regra Publicado.</p>
      <div className="flex justify-end mt-6"><button onClick={onClose} className="btn btn-mint">Pronto</button></div>
    </Modal>
  );
}
