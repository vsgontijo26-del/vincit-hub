"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { PROPOSAL_STATUS, brl, dtShort } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";
import PriceTable from "@/components/agency/PriceTable";
import ServicesCatalog from "@/components/agency/ServicesCatalog";

export default function Propostas() {
  const router = useRouter();
  const [tab, setTab] = useState<"propostas" | "servicos" | "precos">("propostas");
  useEffect(() => { const t = new URLSearchParams(location.search).get("tab"); if (t === "precos" || t === "servicos") setTab(t); }, []);
  const p = useTable<any>("ag_proposals", { select: "id,title,total,status,created_at,accepted_at,viewed_at,ag_clients(name)" });
  const [busy, setBusy] = useState(false);

  async function create(extra: any = {}) {
    setBusy(true);
    const s = createClient();
    const { data: st } = await s.from("ag_settings").select("default_margin,default_tax").maybeSingle();
    const { data, error } = await s.from("ag_proposals").insert({ title: "Nova proposta", margin: st?.default_margin ?? 30, tax: st?.default_tax ?? 0, validity_days: 15, ...extra }).select().single();
    setBusy(false);
    if (!error && data) router.push(`/agency/propostas/${data.id}`);
  }
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const cliente = q.get("cliente"), deal = q.get("deal");
    if (cliente || deal) {
      window.history.replaceState(null, "", "/agency/propostas");
      (async () => {
        let title = "Nova proposta";
        if (deal) { const { data } = await createClient().from("ag_deals").select("title").eq("id", deal).single(); if (data) title = data.title; }
        create({ client_id: cliente || null, deal_id: deal || null, title });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sum = (st: string[]) => p.rows.filter((x) => st.includes(x.status)).reduce((a, x) => a + Number(x.total || 0), 0);
  const sent = p.rows.filter((x) => x.status !== "rascunho").length;
  const acc = p.rows.filter((x) => x.status === "aceita").length;

  return (
    <>
      <PageHead kicker="GESTOR · 02 COMERCIAL" title="Propostas & orçamentos" desc="Monte o orçamento com a calculadora, gere o texto com IA e envie um link para o cliente aceitar online.">
        <button className="btn btn-mint" disabled={busy} onClick={() => create()}><I.plus className="w-4 h-4" />Nova proposta</button>
      </PageHead>
      <div className="flex gap-1 border-b border-line mb-5">{([["propostas", "Propostas"], ["servicos", "Serviços"], ["precos", "Insumos"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-sm border-b-2 -mb-px ${tab === k ? "border-mint text-mint" : "border-transparent text-fog hover:text-paper"}`}>{l}</button>)}</div>
      {tab === "precos" ? <PriceTable /> : tab === "servicos" ? <ServicesCatalog /> : <>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["Aguardando resposta", brl(sum(["enviada", "visualizada"]))], ["Aceitas", brl(sum(["aceita"]))], ["Taxa de aceite", sent ? Math.round((acc / sent) * 100) + "%" : "–"]].map(([k, v]) => (
          <div key={k} className="card p-4"><p className="text-xs text-fog">{k}</p><p className="font-display text-xl md:text-2xl font-bold mt-1">{v}</p></div>
        ))}
      </div>
      <div className="card overflow-x-auto scroll-thin">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-fog text-xs border-b border-line">{["Proposta", "Cliente", "Status", "Criada", "Total"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {p.rows.map((x) => (
              <tr key={x.id} onClick={() => router.push(`/agency/propostas/${x.id}`)} className="border-b border-line/60 hover:bg-panel2/50 cursor-pointer">
                <td className="p-3">{x.title}</td>
                <td className="p-3 text-fog">{x.ag_clients?.name || "–"}</td>
                <td className="p-3"><span className={`chip ${x.status === "aceita" ? "chip-mint" : x.status === "recusada" ? "text-danger border-danger/40" : ""}`}>{PROPOSAL_STATUS[x.status]}</span></td>
                <td className="p-3 text-fog">{dtShort(x.created_at)}</td>
                <td className="p-3 font-mono">{brl(x.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!p.rows.length && !p.loading && <p className="text-fog text-sm text-center py-10">Nenhuma proposta ainda.</p>}
      </div>
      </>}
    </>
  );
}
