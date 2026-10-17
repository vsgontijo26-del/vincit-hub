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
