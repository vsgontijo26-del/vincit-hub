"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { brl } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import Fields from "@/components/agency/Fields";
import { I } from "@/components/icons";

const CATS = ["Equipe", "Equipamento", "Pós-produção", "Pré-produção", "Logística", "Outro"];
const UNITS = ["diária", "hora", "unidade", "vídeo", "mês", "pacote"];
const SUGGESTED = [
  ["Diretor(a)", "Equipe", "diária", 1200, 0], ["Cinegrafista", "Equipe", "diária", 800, 500], ["Assistente de câmera", "Equipe", "diária", 400, 250],
  ["Técnico de som", "Equipe", "diária", 600, 400], ["Kit câmera cinema", "Equipamento", "diária", 450, 0], ["Kit iluminação", "Equipamento", "diária", 300, 0],
  ["Drone", "Equipamento", "diária", 600, 0], ["Roteiro", "Pré-produção", "unidade", 800, 0], ["Edição", "Pós-produção", "vídeo", 900, 500],
  ["Color grading", "Pós-produção", "vídeo", 500, 0], ["Motion graphics", "Pós-produção", "vídeo", 900, 0], ["Corte vertical (Reels)", "Pós-produção", "unidade", 250, 120],
  ["Deslocamento", "Logística", "unidade", 150, 150],
];

export default function Config() {
  const [s, setS] = useState<any>(null);
  const [ok, setOk] = useState(false);
  const prices = useTable<any>("ag_price_items", { order: "category", asc: true });
  const [nw, setNw] = useState<any>({ name: "", category: "Equipe", unit: "diária", price: "", cost: "" });

  useEffect(() => { createClient().from("ag_settings").select("*").maybeSingle().then(({ data }) => setS(data || { company_name: "VINCIT", monthly_goal: 0, default_margin: 30, default_tax: 0 })); }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const { owner_id, updated_at, ...rest } = s;
    const { data: { user } } = await createClient().auth.getUser();
    const { error } = await createClient().from("ag_settings").upsert({ ...rest, owner_id: user!.id, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (!error) { setOk(true); setTimeout(() => setOk(false), 2000); }
  }
  async function addPrice(e: React.FormEvent) {
    e.preventDefault(); if (!nw.name) return;
    await prices.save({ ...nw, price: Number(nw.price) || 0, cost: Number(nw.cost) || 0 }); setNw({ ...nw, name: "", price: "", cost: "" });
  }
  async function seed() {
    await createClient().from("ag_price_items").insert(SUGGESTED.map(([name, category, unit, price, cost]) => ({ name, category, unit, price, cost })));
    prices.reload();
  }

  return (
    <>
      <PageHead kicker="AGENCY · 01 BASE" title="Configurações" desc="Dados da produtora (aparecem nas propostas), metas e tabela de preços da calculadora." />
      <div className="grid lg:grid-cols-5 gap-5">
        <form onSubmit={saveSettings} className="lg:col-span-2 card p-5 h-fit">
          <h2 className="font-display font-bold text-lg mb-4">Produtora</h2>
          {s && <Fields value={s} onChange={setS} fields={[
            { key: "company_name", label: "Nome", span: 2 }, { key: "cnpj", label: "CNPJ" }, { key: "phone", label: "Telefone" },
            { key: "email", label: "E-mail", type: "email", span: 2 },
            { key: "monthly_goal", label: "Meta de faturamento mensal (R$)", type: "money" },
            { key: "default_margin", label: "Margem padrão (%)", type: "number" },
            { key: "default_tax", label: "Impostos padrão (%)", type: "number" },
            { key: "about", label: "Quem somos (vai no fim das propostas)", type: "textarea" },
          ]} />}
          <button className="btn btn-mint w-full mt-5">{ok ? "Salvo ✓" : "Salvar"}</button>
        </form>

        <section id="precos" className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-1"><h2 className="font-display font-bold text-lg">Tabela de preços</h2>{!prices.rows.length && <button onClick={seed} className="btn btn-ghost btn-sm"><I.spark className="w-3.5 h-3.5" />Carregar tabela sugerida</button>}</div>
          <p className="text-xs text-fog mb-4">Itens usados na calculadora de orçamento. O custo é interno (cachê pago, aluguel) e serve para calcular seu lucro.</p>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-left text-fog text-xs">{["Item", "Categoria", "Unidade", "Preço", "Custo", ""].map((h) => <th key={h} className="pb-2 pr-2 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {prices.rows.map((x) => (
                  <tr key={x.id} className="border-t border-line/60">
                    <td className="py-2 pr-2">{x.name}</td><td className="py-2 pr-2 text-fog">{x.category}</td><td className="py-2 pr-2 text-fog">{x.unit}</td>
                    <td className="py-2 pr-2 w-28"><input type="number" className="input !py-1.5" defaultValue={x.price} onBlur={(e) => Number(e.target.value) !== Number(x.price) && prices.patch(x.id, { price: Number(e.target.value) })} /></td>
                    <td className="py-2 pr-2 w-28"><input type="number" className="input !py-1.5" defaultValue={x.cost} onBlur={(e) => Number(e.target.value) !== Number(x.cost) && prices.patch(x.id, { cost: Number(e.target.value) })} /></td>
                    <td className="py-2"><button onClick={() => prices.remove(x.id)} className="text-fog hover:text-danger"><I.trash className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={addPrice} className="grid grid-cols-2 md:grid-cols-[1fr_130px_110px_100px_100px_auto] gap-2 mt-4 border-t border-line pt-4">
            <input className="input col-span-2 md:col-span-1" placeholder="Novo item" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
            <select className="input" value={nw.category} onChange={(e) => setNw({ ...nw, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="input" value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })}>{UNITS.map((c) => <option key={c}>{c}</option>)}</select>
            <input type="number" className="input" placeholder="Preço" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value })} />
            <input type="number" className="input" placeholder="Custo" value={nw.cost} onChange={(e) => setNw({ ...nw, cost: e.target.value })} />
            <button className="btn btn-mint"><I.plus className="w-4 h-4" /></button>
          </form>
          {!!prices.rows.length && <p className="text-[11px] text-fog mt-3">Valores sugeridos são apenas ponto de partida; ajuste à sua realidade. Média da tabela: {brl(prices.rows.reduce((a, x) => a + Number(x.price), 0) / prices.rows.length)}</p>}
        </section>
      </div>
    </>
  );
}
