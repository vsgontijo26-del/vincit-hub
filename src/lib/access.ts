/** Catálogo de ferramentas liberáveis por plano/usuário */
export type Tool = { key: string; label: string; hub: "creator" | "agency" | "geral"; path?: string };

export const TOOLS: Tool[] = [
  { key: "creator:perfis", label: "Perfis & marca", hub: "creator", path: "/creator/perfis" },
  { key: "creator:desempenho", label: "Desempenho", hub: "creator", path: "/creator/desempenho" },
  { key: "creator:tendencias", label: "Tendências", hub: "creator", path: "/creator/tendencias" },
  { key: "creator:referencias", label: "Referências", hub: "creator", path: "/creator/referencias" },
  { key: "creator:formatos", label: "Formatos criativos", hub: "creator", path: "/creator/formatos" },
  { key: "creator:laboratorio", label: "Laboratório", hub: "creator", path: "/creator/laboratorio" },
  { key: "creator:planejador", label: "Planejador", hub: "creator", path: "/creator/pauta" },
  { key: "creator:producao", label: "Quadro de produção", hub: "creator", path: "/creator/producao" },
  { key: "creator:estrategia", label: "Estratégia de crescimento", hub: "creator", path: "/creator/estrategia" },
  { key: "creator:automacoes", label: "Automações", hub: "creator", path: "/creator/automacoes" },
  { key: "agency:clientes", label: "Clientes", hub: "agency", path: "/agency/clientes" },
  { key: "agency:equipe", label: "Equipe", hub: "agency", path: "/agency/equipe" },
  { key: "agency:equipamentos", label: "Equipamentos", hub: "agency", path: "/agency/equipamentos" },
  { key: "agency:financeiro", label: "Financeiro", hub: "agency", path: "/agency/financeiro" },
  { key: "agency:funil", label: "Funil de vendas", hub: "agency", path: "/agency/funil" },
  { key: "agency:propostas", label: "Propostas & orçamentos", hub: "agency", path: "/agency/propostas" },
  { key: "ia", label: "Inteligência artificial (agentes, roteiros, análises)", hub: "geral" },
];

export type Access = { role: "superadmin" | "user"; status: "ativo" | "pendente" | "suspenso" | "expirado"; tools: string[]; plan?: string | null; expires_at?: string | null; name?: string | null };

export const can = (tools: string[] | undefined, key: string) => !!tools && (tools.includes("*") || tools.includes(key));
export const hubAllowed = (tools: string[] | undefined, hub: "creator" | "agency") => !!tools && (tools.includes("*") || tools.some((t) => t.startsWith(hub + ":")));

/** ferramenta exigida por um caminho (undefined = livre para usuários ativos) */
export function toolForPath(path: string): string | undefined {
  const t = TOOLS.filter((x) => x.path && (path === x.path || path.startsWith(x.path + "/"))).sort((a, b) => b.path!.length - a.path!.length)[0];
  return t?.key;
}
