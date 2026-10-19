export const brl = (n: any) => Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(Number(n) || 0);
export const brlShort = (n: any) => {
  const v = Number(n) || 0;
  return Math.abs(v) >= 10000 ? "R$ " + Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v) : brl(v);
};
export const dt = (d: any) => (d ? new Date(String(d).length === 10 ? d + "T12:00" : d).toLocaleDateString("pt-BR") : "–");
export const dtShort = (d: any) => (d ? new Date(String(d).length === 10 ? d + "T12:00" : d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "–");
export const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

export const PROJECT_STAGES = [
  { k: "briefing", l: "Briefing" },
  { k: "pre_producao", l: "Pré-produção" },
  { k: "captacao", l: "Captação" },
  { k: "edicao", l: "Edição" },
  { k: "revisao", l: "Revisão do cliente" },
  { k: "entregue", l: "Entregue" },
];
export const stageLabel = (k: string) => PROJECT_STAGES.find((s) => s.k === k)?.l || k;

export const DEAL_STAGES = [
  { k: "lead", l: "Lead" },
  { k: "contato", l: "Primeiro contato" },
  { k: "proposta", l: "Proposta enviada" },
  { k: "negociacao", l: "Negociação" },
  { k: "ganho", l: "Fechado" },
  { k: "perdido", l: "Perdido" },
];

export const PROJECT_TYPES = ["Vídeo institucional", "Evento", "Reels / social", "Comercial / publicidade", "Videoclipe", "Aula / curso", "Documentário", "Fotografia", "Outro"];
export const EVENT_KINDS = [
  { k: "captacao", l: "Captação", c: "#ff6b6b" },
  { k: "reuniao", l: "Reunião", c: "#f5c84c" },
  { k: "entrega", l: "Entrega", c: "#6eefb6" },
  { k: "pagamento", l: "Pagamento", c: "#7aa7ff" },
  { k: "outro", l: "Outro", c: "#8a8f94" },
];
export const PROPOSAL_STATUS: Record<string, string> = { rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", aceita: "Aceita", recusada: "Recusada" };
export const DEFAULT_ONBOARDING = ["Contrato assinado", "Briefing preenchido", "Acesso a materiais e marca", "Grupo de comunicação criado", "Cronograma alinhado", "Pagamento de entrada recebido"];

export type Item = { name: string; category?: string; unit?: string; qty: number; days?: number; price: number; cost?: number; final?: boolean; tax?: number; service_id?: string };
export function calcProposal(items: Item[], margin = 0, tax = 0, discount = 0) {
  // itens "fechados" (serviços do catálogo) já vêm com preço final: não recebem margem nem imposto de novo
  const open = items.filter((i: any) => !i.final), closed = items.filter((i: any) => i.final);
  const line = (i: any, k: "price" | "cost") => (Number(i.qty) || 0) * (Number(i.days) || 1) * (Number(i[k]) || 0);
  const base = open.reduce((a, i) => a + line(i, "price"), 0);
  const closedTotal = closed.reduce((a, i) => a + line(i, "price"), 0);
  const closedTax = closed.reduce((a, i: any) => a + line(i, "price") * (Number(i.tax) || 0) / 100, 0);
  const cost = items.reduce((a, i) => a + line(i, "cost"), 0);
  const withMargin = base * (1 + (Number(margin) || 0) / 100);
  const withTax = withMargin / (1 - Math.min(Number(tax) || 0, 90) / 100);
  const taxValue = withTax - withMargin + closedTax;
  const total = Math.max(0, withTax + closedTotal - (Number(discount) || 0));
  return { base: base + closedTotal, cost, marginValue: withMargin - base, taxValue, total, profit: total - cost - taxValue };
}

/** Preço de um serviço do catálogo a partir da composição de custos */
export function calcService(items: Item[], margin = 0, tax = 0, fixed?: number | null) {
  const line = (i: any, k: "price" | "cost") => (Number(i.qty) || 0) * (Number(i.days) || 1) * (Number(i[k]) || 0);
  const base = items.reduce((a, i) => a + line(i, "price"), 0);
  const cost = items.reduce((a, i) => a + line(i, "cost"), 0);
  const suggested = (base * (1 + (Number(margin) || 0) / 100)) / (1 - Math.min(Number(tax) || 0, 90) / 100);
  const price = fixed != null && Number(fixed) > 0 ? Number(fixed) : suggested;
  const taxValue = price * (Number(tax) || 0) / 100;
  const profit = price - cost - taxValue;
  return { base, cost, suggested, price, taxValue, profit, profitPct: price ? (profit / price) * 100 : 0 };
}
