/** Raio-X do perfil: diagnóstico estratégico nos 5 eixos do método Diagnóstico → Estratégia → Implementação */
import { briefingProgress } from "@/lib/briefing";

export type AxisKey = "distribuicao" | "narrativa" | "canais" | "comunidade" | "conteudo";
export const AXES: { key: AxisKey; label: string; q: string; needs: string; fix: [string, string] }[] = [
  { key: "distribuicao", label: "Distribuição orgânica", q: "O conteúdo chega a gente nova sem anúncio?", needs: "métricas de alcance ou views dos posts", fix: ["Sincronize o perfil em Desempenho", "/creator/desempenho"] },
  { key: "narrativa", label: "Narrativa de marca", q: "Fica claro quem é, o que defende e por que escolher esse perfil?", needs: "briefing (oferta, diferencial, tom) ou voz da marca", fix: ["Preencha o briefing", "/creator/perfis?tab=briefing"] },
  { key: "canais", label: "Canais próprios", q: "A audiência é levada para um canal que o perfil controla (WhatsApp, lista, site, direct)?", needs: "CTA principal no briefing ou automações de direct", fix: ["Defina o CTA no briefing ou crie uma automação", "/creator/automacoes"] },
  { key: "comunidade", label: "Comunidade", q: "Existe conversa e relação, ou só gente assistindo?", needs: "comentários dos posts ou contatos de direct", fix: ["Sincronize o perfil em Desempenho", "/creator/desempenho"] },
  { key: "conteudo", label: "Conteúdo estratégico", q: "Os conteúdos seguem pilares, formatos e frequência que servem ao objetivo?", needs: "posts publicados ou pilares e formatos no briefing", fix: ["Preencha pilares e formatos no briefing", "/creator/perfis?tab=briefing"] },
];
export const axisLabel = (k?: string | null) => AXES.find((a) => a.key === k)?.label || k || "";

const has = (v: any) => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()));
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (a: number | null, b: number | null) => (a != null && b ? Math.round((a / b) * 1000) / 10 : null);
const num = (v: any) => (typeof v === "number" ? v : null);

type Group = { n: number; alcance_mediano: number | null; views_medianas: number | null; salvos_por_alcance: number | null; compart_por_alcance: number | null; comentarios_medios: number | null };
function group(posts: any[]): Group {
  const reach = posts.map((p) => num(p.reach)).filter((x): x is number => x != null);
  const plays = posts.map((p) => num(p.plays)).filter((x): x is number => x != null);
  const withReach = posts.filter((p) => p.reach);
  const sv = avg(withReach.map((p) => (p.saved || 0) / p.reach));
  const sh = avg(withReach.map((p) => (p.shares || 0) / p.reach));
  const cm = avg(posts.map((p) => num(p.comments_count)).filter((x): x is number => x != null));
  return {
    n: posts.length, alcance_mediano: median(reach), views_medianas: median(plays),
    salvos_por_alcance: sv == null ? null : Math.round(sv * 1000) / 10, compart_por_alcance: sh == null ? null : Math.round(sh * 1000) / 10,
    comentarios_medios: cm == null ? null : Math.round(cm * 10) / 10,
  };
}

/** Números calculados no servidor a partir dos dados reais: são a evidência que a IA pode citar */
export function computeInputs(d: { account: any; posts: any[]; refs: any[]; library: any[]; dmContacts: number; automations: number; ideas: any[]; pillarByMedia: Record<string, string> }) {
  const { account: a, posts } = d;
  const b = a.briefing || {};
  const dates = posts.map((p) => p.posted_at).filter(Boolean).sort();
  const days = dates.length > 1 ? Math.max(1, (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 864e5) : null;
  const byType: Record<string, Group> = {};
  const types = [...new Set(posts.map((p) => p.media_type || "?"))];
  types.forEach((t) => (byType[t] = group(posts.filter((p) => (p.media_type || "?") === t))));
  const byPillar: Record<string, Group> = {};
  const pillars = [...new Set(posts.map((p) => d.pillarByMedia[p.ig_media_id]).filter(Boolean))];
  pillars.forEach((pl) => (byPillar[pl] = group(posts.filter((p) => d.pillarByMedia[p.ig_media_id] === pl))));
  const ideasByStatus: Record<string, number> = {};
  d.ideas.forEach((i) => (ideasByStatus[i.status || "ideia"] = (ideasByStatus[i.status || "ideia"] || 0) + 1));
  const g = group(posts);
  return {
    perfil: { username: a.username, seguidores: a.followers_count ?? null, seguindo: a.follows_count ?? null, total_posts: a.media_count ?? null, nicho: a.niche || b.nicho || null, conectado: !!a.connected, sincronizado_em: a.last_synced_at || null },
    briefing_pct: briefingProgress(b),
    posts: { ...g, periodo_dias: days ? Math.round(days) : null, por_semana: days && posts.length > 1 ? Math.round((posts.length / days) * 7 * 10) / 10 : null, alcance_por_seguidor: pct(g.alcance_mediano, a.followers_count ?? null) },
    por_formato: byType,
    por_pilar: byPillar,
    referencias: { perfis: d.refs.length, biblioteca: d.library.length },
    canais: { cta: b.cta || null, automacoes_ativas: d.automations, contatos_direct: d.dmContacts },
    ideias: ideasByStatus,
  };
}

/** Quais eixos têm dado real para receber nota */
export function availability(account: any, inputs: ReturnType<typeof computeInputs>): Record<AxisKey, boolean> {
  const b = account.briefing || {};
  const p = inputs.posts;
  return {
    distribuicao: p.n >= 3 && (p.alcance_mediano != null || p.views_medianas != null),
    narrativa: ["oferta", "diferencial", "personalidade", "tom", "historias"].some((k) => has(b[k])) || has(account.brand_voice),
    canais: has(b.cta) || inputs.canais.automacoes_ativas > 0 || inputs.canais.contatos_direct > 0,
    comunidade: (p.n >= 3 && p.comentarios_medios != null) || inputs.canais.contatos_direct > 0,
    conteudo: p.n >= 3 || has(b.pilares) || has(b.formatos),
  };
}
