export const PALETTE = ["#6eefb6", "#7aa7ff", "#f5c84c", "#ff6b6b", "#c084fc", "#fb923c", "#22d3ee", "#a3e635", "#f472b6", "#8a8f94", "#3d525a"];
export const PRIORITIES = [
  { k: "urgente", l: "Urgente", c: "#ff6b6b" },
  { k: "alta", l: "Alta", c: "#f5c84c" },
  { k: "media", l: "Normal", c: "#7aa7ff" },
  { k: "baixa", l: "Baixa", c: "#8a8f94" },
];
export const STATUS_TYPES = [
  { k: "aberto", l: "Aberta" },
  { k: "andamento", l: "Em andamento" },
  { k: "concluido", l: "Concluída" },
];
export const TEMPLATES: { k: string; l: string; statuses: [string, string, string][] }[] = [
  { k: "simples", l: "Simples", statuses: [["A fazer", "#8a8f94", "aberto"], ["Em andamento", "#f5c84c", "andamento"], ["Concluído", "#6eefb6", "concluido"]] },
  { k: "producao", l: "Produção audiovisual", statuses: [["Briefing", "#8a8f94", "aberto"], ["Roteiro", "#c084fc", "andamento"], ["Captação", "#ff6b6b", "andamento"], ["Edição", "#7aa7ff", "andamento"], ["Revisão", "#f5c84c", "andamento"], ["Entregue", "#6eefb6", "concluido"]] },
  { k: "conteudo", l: "Conteúdo / social", statuses: [["Ideia", "#8a8f94", "aberto"], ["Roteiro", "#c084fc", "andamento"], ["Gravação", "#ff6b6b", "andamento"], ["Edição", "#7aa7ff", "andamento"], ["Agendado", "#f5c84c", "andamento"], ["Publicado", "#6eefb6", "concluido"]] },
  { k: "comercial", l: "Comercial", statuses: [["Lead", "#8a8f94", "aberto"], ["Contato", "#7aa7ff", "andamento"], ["Proposta", "#f5c84c", "andamento"], ["Fechado", "#6eefb6", "concluido"]] },
];

export function Flag({ p, className = "w-3.5 h-3.5" }: { p?: string; className?: string }) {
  const c = PRIORITIES.find((x) => x.k === p)?.c || "#3d525a";
  return (<svg viewBox="0 0 24 24" className={className} fill={p ? c : "none"} stroke={c} strokeWidth={1.8} strokeLinejoin="round"><path d="M5 21V4h11l-2 4 2 4H5" /></svg>);
}

export function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={`w-6 h-6 rounded-full border-2 ${value === c ? "border-paper" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
      ))}
    </div>
  );
}

export const RECUR = [
  { k: "", l: "Não repete" },
  { k: "daily", l: "Todo dia" },
  { k: "weekdays", l: "Dias úteis (seg–sex)" },
  { k: "weekly", l: "Toda semana" },
  { k: "biweekly", l: "A cada 2 semanas" },
  { k: "monthly", l: "Todo mês" },
  { k: "yearly", l: "Todo ano" },
];
export const recurLabel = (k?: string | null) => RECUR.find((r) => r.k === (k || ""))?.l || "";

/** próxima data (YYYY-MM-DD) pela regra — igual à função ag_next_occurrence do banco */
export function nextDate(d: string, rule: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  const add = (n: number) => dt.setUTCDate(dt.getUTCDate() + n);
  if (rule === "daily") add(1);
  else if (rule === "weekdays") { const w = dt.getUTCDay(); add(w === 5 ? 3 : w === 6 ? 2 : 1); }
  else if (rule === "weekly") add(7);
  else if (rule === "biweekly") add(14);
  else if (rule === "monthly") { const day = dt.getUTCDate(); dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + 1); const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(); dt.setUTCDate(Math.min(day, last)); }
  else if (rule === "yearly") dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  else add(36500);
  return dt.toISOString().slice(0, 10);
}

/** todas as datas da série entre from e to (inclusive) */
export function occurrences(start: string, rule: string | null | undefined, from: string, to: string, until?: string | null, ex: string[] = []): string[] {
  if (!rule) return start >= from && start <= to && !ex.includes(start) ? [start] : [];
  const out: string[] = []; let d = start; let guard = 0;
  // monthly: manter o dia original
  const origDay = Number(start.slice(8));
  while (d <= to && (!until || d <= until) && guard++ < 5000) {
    if (d >= from && !ex.includes(d)) out.push(d);
    let n = nextDate(d, rule);
    if (rule === "monthly") { const [y, m] = n.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); n = `${n.slice(0, 8)}${String(Math.min(origDay, last)).padStart(2, "0")}`; }
    d = n;
  }
  return out;
}

export function Recur({ className = "w-3 h-3" }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" /></svg>);
}
