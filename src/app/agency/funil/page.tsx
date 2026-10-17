"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { DEAL_STAGES, brlShort, dtShort } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Modal from "@/components/agency/Modal";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";

const SOURCES = ["Instagram", "Indicação", "Site", "WhatsApp", "Evento", "Cliente antigo", "Outro"];

export default function Funil() {
  const router = useRouter();
  const d = useTable<any>("ag_deals", { select: "*, ag_clients(name)" });
  const clients = useTable<any>("ag_clients", { order: "name", asc: true });
  const [form, setForm] = useState<any>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [won, setWon] = useState<any>(null);

  async function move(id: string, stage: string) {
    const deal = d.rows.find((x) => x.id === id);
    if (!deal || deal.stage === stage) return;
    await d.patch(id, { stage });
    if (stage === "ganho") setWon(deal);
  }
  async function submit(e: React.FormEvent) { e.preventDefault(); if (await d.save(form)) setForm(null); }
  async function createProject() {
    const { data } = await createClient().from("ag_projects").insert({ title: won.title, client_id: won.client_id, value: won.value || 0 }).select().single();
    if (data) {
      if (won.client_id) await createClient().from("ag_clients").update({ status: "ativo" }).eq("id", won.client_id);
      router.push(`/agency/projetos/${data.id}`);
    }
  }

  const open = d.rows.filter((x) => !["ganho", "perdido"].includes(x.stage));
  const wonRows = d.rows.filter((x) => x.stage === "ganho");
  const closed = d.rows.filter((x) => ["ganho", "perdido"].includes(x.stage)).length;
  const conv = closed ? Math.round((wonRows.length / closed) * 100) : 0;

  const fields = [
    { key: "title", label: "Oportunidade", required: true, span: 2 as const, placeholder: "Vídeo institucional Empresa X" },
    { key: "client_id", label: "Cliente / lead", type: "select" as const, options: clients.rows.map((c) => ({ v: c.id, l: c.name })) },
    { key: "value", label: "Valor estimado (R$)", type: "money" as const },
    { key: "stage", label: "Etapa", type: "select" as const, options: DEAL_STAGES.map((s) => ({ v: s.k, l: s.l })) },
    { key: "source", label: "Origem", type: "select" as const, options: SOURCES },
    { key: "expected_close", label: "Previsão de fechamento", type: "date" as const },
    { key: "notes", label: "Anotações", type: "textarea" as const },
  ];

  return (
    <>
      <PageHead kicker="AGENCY" title="Funil de vendas" desc="Acompanhe cada oportunidade do primeiro contato ao fechamento.">
        <button className="btn btn-mint" onClick={() => setForm({ stage: "lead" })}><I.plus className="w-4 h-4" />Nova oportunidade</button>
      </PageHead>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["Em negociação", brlShort(open.reduce((a, x) => a + Number(x.value || 0), 0)), `${open.length} oportunidades`], ["Fechado", brlShort(wonRows.reduce((a, x) => a + Number(x.value || 0), 0)), `${wonRows.length} negócios`], ["Conversão", conv + "%", "fechados / finalizados"]].map(([k, v, s]) => (
          <div key={k} className="card p-4"><p className="text-xs text-fog">{k}</p><p className="font-display text-2xl font-bold mt-1">{v}</p><p className="text-[11px] text-fog">{s}</p></div>
        ))}
      </div>
      {clients.rows.length === 0 && <p className="text-sm text-fog mb-4">Dica: cadastre o lead em Clientes (status “Lead”) para vincular à oportunidade.</p>}

      <div className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-3 overflow-x-auto scroll-thin pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {DEAL_STAGES.map((s) => {
          const col = d.rows.filter((x) => x.stage === s.k);
          return (
            <div key={s.k} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, s.k)} className={`border rounded-2xl p-3 min-h-[360px] ${s.k === "ganho" ? "bg-mint/[.04] border-mint-dim" : s.k === "perdido" ? "bg-panel/30 border-line" : "bg-panel/60 border-line"}`}>
              <div className="flex items-center justify-between px-1 mb-3"><p className="font-display font-bold text-sm">{s.l}</p><span className="font-mono text-[11px] text-fog">{col.length} · {brlShort(col.reduce((a, x) => a + Number(x.value || 0), 0))}</span></div>
              <div className="space-y-2">
                {col.map((x) => (
                  <div key={x.id} draggable onDragStart={() => setDrag(x.id)} onDragEnd={() => setDrag(null)} onClick={() => setForm(x)} className="bg-panel2 border border-line rounded-xl p-3 cursor-grab hover:border-mint-dim">
                    <p className="text-sm font-medium leading-snug">{x.title}</p>
                    <p className="text-xs text-fog mt-1">{x.ag_clients?.name || "–"}</p>
                    <div className="flex flex-wrap gap-1 mt-2"><span className="chip chip-mint">{brlShort(x.value)}</span>{x.source && <span className="chip">{x.source}</span>}{x.expected_close && <span className="chip">{dtShort(x.expected_close)}</span>}</div>
                    <select onClick={(e) => e.stopPropagation()} className="input !py-1 !text-xs mt-2 lg:hidden" value={x.stage} onChange={(e) => move(x.id, e.target.value)}>{DEAL_STAGES.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}</select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!form} title={form?.id ? "Oportunidade" : "Nova oportunidade"} onClose={() => setForm(null)}>
        <form onSubmit={submit}><Fields fields={fields} value={form} onChange={setForm} />
          <div className="flex justify-between gap-2 mt-6">
            {form?.id ? <button type="button" className="btn btn-ghost" onClick={async () => { await d.remove(form.id); setForm(null); }}><I.trash className="w-4 h-4" /></button> : <span />}
            <div className="flex gap-2">{form?.id && <button type="button" className="btn btn-ghost" onClick={() => router.push(`/agency/propostas?deal=${form.id}${form.client_id ? `&cliente=${form.client_id}` : ""}`)}>Criar proposta</button>}<button className="btn btn-mint">Salvar</button></div>
          </div></form>
      </Modal>
      <Modal open={!!won} title="Negócio fechado 🎉" onClose={() => setWon(null)}>
        <p className="text-sm text-fog">Quer abrir o projeto “{won?.title}” agora? Ele entra no quadro de Projetos na etapa Briefing.</p>
        <div className="flex justify-end gap-2 mt-6"><button className="btn btn-ghost" onClick={() => setWon(null)}>Depois</button><button className="btn btn-mint" onClick={createProject}>Criar projeto</button></div>
      </Modal>
    </>
  );
}
