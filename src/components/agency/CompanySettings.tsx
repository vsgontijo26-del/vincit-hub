"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Fields from "@/components/agency/Fields";

/** Dados da produtora (aparecem nas propostas), metas e padrões de orçamento */
export default function CompanySettings() {
  const [s, setS] = useState<any>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => { createClient().from("ag_settings").select("*").maybeSingle().then(({ data }) => setS(data || { company_name: "", monthly_goal: 0, default_margin: 30, default_tax: 0 })); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { owner_id, updated_at, ...rest } = s;
    const { data: { user } } = await createClient().auth.getUser();
    const { error } = await createClient().from("ag_settings").upsert({ ...rest, owner_id: user!.id, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (!error) { setOk(true); setTimeout(() => setOk(false), 2000); }
  }
  return (
    <form onSubmit={save} className="card p-5">
      <h2 className="font-display font-bold text-lg">Produtora</h2>
      <p className="text-xs text-fog mb-4">Aparece nas propostas e define a meta e os padrões da calculadora de orçamento.</p>
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
  );
}
