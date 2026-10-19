"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const DEFAULT_CATS: [string, "entrada" | "saida", string][] = [
  ["Projetos", "entrada", "#6eefb6"], ["Mensalidades / contratos", "entrada", "#22d3ee"], ["Aluguel de equipamento", "entrada", "#a3e635"], ["Outras receitas", "entrada", "#8a8f94"],
  ["Equipe / freelancers", "saida", "#ff6b6b"], ["Equipamento", "saida", "#fb923c"], ["Aluguel / estrutura", "saida", "#f5c84c"], ["Software e assinaturas", "saida", "#7aa7ff"],
  ["Marketing", "saida", "#c084fc"], ["Transporte", "saida", "#f472b6"], ["Impostos", "saida", "#3d525a"], ["Pró-labore", "saida", "#22d3ee"], ["Custos de projeto", "saida", "#a3e635"], ["Outras despesas", "saida", "#8a8f94"],
];
export const ACCOUNT_KINDS: Record<string, string> = { corrente: "Conta corrente", poupanca: "Poupança", carteira: "Carteira / caixa", investimento: "Investimento", cartao: "Cartão de crédito" };

export const todayBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

/** vencimento da fatura para uma compra no cartão */
export function cardDueDate(purchase: string, closingDay: number, dueDay: number) {
  const d = new Date(purchase + "T12:00:00");
  let y = d.getFullYear(), m = d.getMonth();
  if (d.getDate() >= closingDay) m += 1; // fechou: vai para a próxima fatura
  if (dueDay <= closingDay) m += 1; // vencimento cai no mês seguinte ao fechamento
  const due = new Date(y, m, Math.min(dueDay, 28), 12);
  return due.toISOString().slice(0, 10);
}

export function useFinance() {
  const [d, setD] = useState<{ accounts: any[]; categories: any[]; tx: any[]; clients: any[]; projects: any[]; charges: any[]; settings: any }>({ accounts: [], categories: [], tx: [], clients: [], projects: [], charges: [], settings: null });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const s = createClient();
    let [acc, cat] = await Promise.all([s.from("fin_accounts").select("*").order("position").order("created_at"), s.from("fin_categories").select("*").order("name")]);
    // primeiros passos: conta principal e categorias padrão
    if (!acc.error && !(acc.data || []).length) {
      const { data: main } = await s.from("fin_accounts").insert({ name: "Conta principal", kind: "corrente" }).select().single();
      if (main) await s.from("ag_transactions").update({ account_id: main.id }).is("account_id", null);
      acc = await s.from("fin_accounts").select("*").order("position").order("created_at");
    }
    if (!cat.error && !(cat.data || []).length) {
      // padrão + categorias que já existiam nos lançamentos antigos (evita lançamento "órfão")
      const { data: used } = await s.from("ag_transactions").select("category,kind").not("category", "is", null);
      const rows = DEFAULT_CATS.map(([name, kind, color]) => ({ name, kind, color }));
      for (const u of used || []) if (u.category !== "Transferência" && !rows.some((r) => r.name === u.category && r.kind === u.kind)) rows.push({ name: u.category, kind: u.kind, color: "#8a8f94" });
      await s.from("fin_categories").insert(rows);
      cat = await s.from("fin_categories").select("*").order("name");
    }
    const [tx, cl, pr, ch, st] = await Promise.all([
      s.from("ag_transactions").select("*, ag_clients(name), ag_projects(title)").order("due_date", { ascending: true }),
      s.from("ag_clients").select("id,name,email,phone").order("name"),
      s.from("ag_projects").select("id,title").order("created_at", { ascending: false }),
      s.from("fin_charges").select("*, ag_clients(name)").order("due_date", { ascending: false }),
      s.from("ag_settings").select("*").maybeSingle(),
    ]);
    setD({ accounts: acc.data || [], categories: cat.data || [], tx: tx.data || [], clients: cl.data || [], projects: pr.data || [], charges: ch.data || [], settings: st.data });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const balanceOf = (a: any) => a.kind === "cartao"
    ? -d.tx.filter((t) => t.account_id === a.id && t.kind === "saida" && !t.paid).reduce((x, t) => x + Number(t.amount), 0)
    : Number(a.opening_balance || 0) + d.tx.filter((t) => t.account_id === a.id && t.paid).reduce((x, t) => x + (t.kind === "entrada" ? 1 : -1) * Number(t.amount), 0);

  return { ...d, loading, reload: load, balanceOf };
}
