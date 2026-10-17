"use client";
import Link from "next/link";
import { useState } from "react";
import { useTable } from "@/lib/useTable";
import { brl, dtShort, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";

const CATS = ["Câmera", "Lente", "Áudio", "Iluminação", "Estabilização", "Drone", "Armazenamento", "Acessório", "Computador", "Outro"];
const STATUS = [{ v: "disponivel", l: "Disponível" }, { v: "manutencao", l: "Em manutenção" }, { v: "emprestado", l: "Emprestado" }, { v: "inativo", l: "Fora de uso" }];
const fields = [
  { key: "name", label: "Equipamento", required: true, span: 2 as const, placeholder: "Sony FX3" },
  { key: "category", label: "Categoria", type: "select" as const, options: CATS },
  { key: "brand", label: "Marca" },
  { key: "serial", label: "Nº de série" },
  { key: "value", label: "Valor (R$)", type: "money" as const },
  { key: "status", label: "Status", type: "select" as const, options: STATUS },
  { key: "notes", label: "Observações", type: "textarea" as const },
];

export default function Equipamentos() {
  const e = useTable<any>("ag_equipment", { order: "name", asc: true });
  const b = useTable<any>("ag_bookings", { select: "*, ag_projects(id,title)", order: "start_date", asc: true });
  const [form, setForm] = useState<any>(null);
  const [cat, setCat] = useState("");
  const td = today();

  async function submit(ev: React.FormEvent) { ev.preventDefault(); if (await e.save(form)) setForm(null); }
  const inUse = (id: string) => b.rows.find((x) => x.equipment_id === id && x.start_date <= td && x.end_date >= td);
  const next = (id: string) => b.rows.find((x) => x.equipment_id === id && x.start_date > td);
  const list = e.rows.filter((x) => !cat || x.category === cat);
  const total = e.rows.reduce((a, x) => a + Number(x.value || 0), 0);
  const upcoming = b.rows.filter((x) => x.end_date >= td).slice(0, 8);

  return (
    <>
      <PageHead kicker="AGENCY" title="Equipamentos" desc="Inventário, reservas por projeto e manutenção.">
        <button className="btn btn-mint" onClick={() => setForm({ status: "disponivel" })}><I.plus className="w-4 h-4" />Novo equipamento</button>
      </PageHead>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["Itens", e.rows.length], ["Patrimônio", brl(total)], ["Em uso hoje", e.rows.filter((x) => inUse(x.id)).length]].map(([k, v]) => <div key={k as string} className="card p-4"><p className="text-xs text-fog">{k}</p><p className="font-display text-xl md:text-2xl font-bold mt-1">{v}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-1 mb-4">{["", ...CATS.filter((c) => e.rows.some((x) => x.category === c))].map((c) => <button key={c || "all"} onClick={() => setCat(c)} className={`btn btn-sm ${cat === c ? "btn-mint" : "btn-ghost"}`}>{c || "Todos"}</button>)}</div>
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 card overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-fog text-xs border-b border-line">{["Equipamento", "Categoria", "Situação", "Próxima reserva", "Valor"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>{list.map((x) => {
              const use = inUse(x.id), nx = next(x.id);
              const st = use ? ["Em uso", "chip chip-mint"] : x.status === "disponivel" ? ["Disponível", "chip"] : [STATUS.find((s) => s.v === x.status)?.l, "chip text-danger border-danger/40"];
              return (
                <tr key={x.id} onClick={() => setForm(x)} className="border-b border-line/60 hover:bg-panel2/50 cursor-pointer">
                  <td className="p-3"><p>{x.name}</p><p className="text-[11px] text-fog">{[x.brand, x.serial].filter(Boolean).join(" · ")}</p></td>
                  <td className="p-3 text-fog">{x.category || "–"}</td>
                  <td className="p-3"><span className={st[1]}>{st[0]}</span>{use?.ag_projects && <p className="text-[11px] text-fog mt-1">{use.ag_projects.title}</p>}</td>
                  <td className="p-3 text-fog text-xs">{nx ? `${dtShort(nx.start_date)} · ${nx.ag_projects?.title || ""}` : "–"}</td>
                  <td className="p-3 font-mono text-xs">{brl(x.value)}</td>
                </tr>);
            })}</tbody>
          </table>
          {!list.length && !e.loading && <p className="text-fog text-sm text-center py-10">Cadastre câmeras, lentes, áudio e luz para reservar nos projetos.</p>}
        </section>
        <section className="card p-5 h-fit">
          <h2 className="font-display font-bold text-lg mb-1">Reservas</h2>
          <p className="text-xs text-fog mb-4">Reserve equipamentos dentro de cada projeto; conflitos de data são bloqueados.</p>
          <ul className="space-y-2">{upcoming.map((x) => (
            <li key={x.id} className="bg-panel2 rounded-lg px-3 py-2 text-sm"><p className="truncate">{e.rows.find((q) => q.id === x.equipment_id)?.name}</p>
              <p className="text-[11px] text-fog">{dtShort(x.start_date)}{x.end_date !== x.start_date ? ` – ${dtShort(x.end_date)}` : ""} · {x.ag_projects ? <Link href={`/agency/projetos/${x.ag_projects.id}`} className="hover:text-mint">{x.ag_projects.title}</Link> : "–"}</p></li>
          ))}{!upcoming.length && <p className="text-fog text-sm">Nenhuma reserva futura.</p>}</ul>
        </section>
      </div>
      <Modal open={!!form} title={form?.id ? form.name : "Novo equipamento"} onClose={() => setForm(null)}>
        <form onSubmit={submit}><Fields fields={fields} value={form} onChange={setForm} />
          <div className="flex justify-between mt-6">{form?.id ? <button type="button" className="btn btn-ghost" onClick={async () => { await e.remove(form.id); setForm(null); }}><I.trash className="w-4 h-4" /></button> : <span />}<button className="btn btn-mint">Salvar</button></div></form>
      </Modal>
    </>
  );
}
