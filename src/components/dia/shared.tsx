/** datas no fuso de Brasília, como YYYY-MM-DD */
export const todayBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** segunda-feira da semana de d */
export const monday = (d: string) => { const w = new Date(d + "T12:00:00Z").getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };
export const WD3 = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const wd = (d: string) => WD3[new Date(d + "T12:00:00Z").getUTCDay()];

const TAGS: Record<string, [string, string]> = {
  projeto: ["PROJETO", "#7aa7ff"], conteudo: ["CONTEÚDO", "#c084fc"], rotina: ["ROTINA", "#f5c84c"], gestor: ["GESTOR", "#7aa7ff"],
};
/** de onde a tarefa veio: projeto, conteúdo, rotina ou o nome do espaço */
export function originOf(t: any, space?: any): [string, string] {
  if (t.project_id) return TAGS.projeto;
  if (t.content_id) return TAGS.conteudo;
  if (space && (space.kind === "rotina" || space.name === "Rotina")) return TAGS.rotina;
  if (space && (space.kind === "conteudo" || space.name === "Conteúdo")) return TAGS.conteudo;
  return [String(space?.name || "Tarefa").toUpperCase(), space?.color || "#8a8f94"];
}
export const tagOf = (k: keyof typeof TAGS) => TAGS[k];

export function OriginTag({ tag }: { tag: [string, string] }) {
  return <span className="font-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: tag[1] + "22", color: tag[1] }}>{tag[0]}</span>;
}
