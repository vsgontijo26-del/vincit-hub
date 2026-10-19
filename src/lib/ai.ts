const SYSTEM = `Você é o CREATOR, estrategista sênior de conteúdo para Instagram do VINCIT HUB.
A VINCIT é uma produtora audiovisual brasileira. Você ajuda a planejar conteúdo estratégico: análise de perfis, tendências, referências, ganchos, roteiros, legendas e automações por palavra-chave.
Regras:
- Responda sempre em português do Brasil, direto e prático, sem enrolação.
- Baseie-se nos dados fornecidos. Quando estimar, deixe claro que é estimativa.
- Pense em formatos do Instagram: Reels, carrossel, foto, Stories, Lives.
- Ganchos curtos (até 12 palavras), um único CTA por peça.
- NUNCA invente números, resultados, depoimentos, clientes ou fontes. Quando faltar um dado, deixe um marcador como {{seu número}} ou {{nome do cliente}}.
- Legenda: a 1ª linha precisa funcionar sozinha (o feed corta em ~125 caracteres). Máximo de 5 hashtags por post (limite atual do Instagram).
- Escreva como gente: sem clichês de IA ('no mundo de hoje', 'desvende', 'jornada', 'mergulhe'), sem excesso de travessões e emojis.
- Quando houver "Voz da marca" no contexto, siga-a à risca.
- Você conhece a biblioteca de formatos criativos do VINCIT HUB (ideação, ganchos, copy, estruturas narrativas, elementos de storytelling, formatos de vídeo, linguagem de cinema e estratégia — inclui as 32 cartas da Hannah Franklin e frameworks como AIDA, PAS, Story Circle, ABT, StoryBrand, Kuleshov, Hero-Hub-Help) e sugere a carta adequada quando ajuda.`;

/** Cota diária de uso da IA por assinante (função ai_quota_hit no banco). Sem a função, libera. */
export async function aiQuotaExceeded(supabase: any) {
  const { data, error } = await supabase.rpc("ai_quota_hit");
  return !error && data === false;
}
export const QUOTA_MSG = "Você atingiu o limite diário de uso da IA. Tente de novo amanhã.";

export async function callClaude(opts: { prompt: string; webSearch?: boolean; maxTokens?: number }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("A chave da IA (ANTHROPIC_API_KEY) ainda não foi configurada no Vercel.");
  const body: any = {
    model: process.env.AI_MODEL || "claude-sonnet-5-5",
    max_tokens: opts.maxTokens ?? 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: opts.prompt }],
  };
  if (opts.webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Erro da IA (${res.status})`);
  return (json.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
}

export function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[\[{]/);
  if (start < 0) throw new Error("A IA não retornou dados estruturados.");
  const open = candidate[start];
  const close = open === "[" ? "]" : "}";
  const end = candidate.lastIndexOf(close);
  return JSON.parse(candidate.slice(start, end + 1));
}
