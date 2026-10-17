const SYSTEM = `Você é o CREATOR, estrategista sênior de conteúdo para Instagram do VINCIT HUB.
A VINCIT é uma produtora audiovisual brasileira. Você ajuda a planejar conteúdo estratégico: análise de perfis, tendências, referências, ganchos, roteiros, legendas e automações por palavra-chave.
Regras:
- Responda sempre em português do Brasil, direto e prático, sem enrolação.
- Baseie-se nos dados fornecidos. Quando estimar, deixe claro que é estimativa.
- Pense em formatos do Instagram: Reels, carrossel, foto, Stories, Lives.
- Ganchos curtos (até 12 palavras), CTAs claros.`;

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
