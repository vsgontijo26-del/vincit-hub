import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (aiCtx.getStore()?.answer != null) return false;
  const { data, error } = await supabase.rpc("ai_quota_hit");
  return !error && data === false;
}
export const QUOTA_MSG = "Você atingiu o limite diário de uso da IA. Tente de novo amanhã.";

/*
 * Fila do Claude: sem AI_MODE=api (e a chave), o pedido não vai à API da Anthropic. A rota grava o prompt em
 * ai_requests, uma tarefa agendada do Claude responde e grava result_text, e o navegador chama a mesma rota de
 * novo com _ai_request: aí callClaude devolve a resposta pronta e a rota segue igual (JSON, gravação no banco).
 */
type AICtx = { answer?: string; queued?: { system: string; prompt: string; webSearch: boolean; maxTokens: number } };
const aiCtx = new AsyncLocalStorage<AICtx>();
export const aiQueueMode = () => !(process.env.AI_MODE === "api" && process.env.ANTHROPIC_API_KEY);

const LABELS: Record<string, string> = {
  profile_diagnosis: "Diagnóstico do perfil", trends: "Tendências", reference: "Análise de referência", copy: "Criar conteúdo",
  automation_copy: "Mensagens da automação", agent: "Agente do Laboratório", format_apply: "Aplicar formato criativo",
  format_suggest: "Sugerir formatos", growth_plan: "Estratégia de crescimento", content_calendar: "Calendário de conteúdo",
  briefing_draft: "Rascunho do briefing", brand_voice: "Voz da marca", proposal_text: "Texto da proposta",
  diagnostico: "Raio-X do perfil", "ref-profile": "Perfil de referência",
};

/** Envolve o POST de uma rota de IA: manda o pedido para a fila ou entrega a resposta que o Claude já gravou */
export function withAIQueue(endpoint: "ai" | "diagnostico" | "ref-profile", handle: (body: any) => Promise<Response>) {
  return async (req: Request) => {
    const { _ai_request, ...body } = await req.json().catch(() => ({}));
    const sb = await createClient();
    if (_ai_request) {
      const { data: row } = await sb.from("ai_requests").select("id,endpoint,status,result_text,error,response,delivered_at").eq("id", _ai_request).maybeSingle();
      if (!row || row.endpoint !== endpoint) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
      if (row.status === "error") return NextResponse.json({ error: row.error || "O Claude não conseguiu responder este pedido." }, { status: 500 });
      if (row.status !== "done") return NextResponse.json({ queued: true, request_id: row.id, status: row.status }, { status: 202 });
      if (row.delivered_at && row.response) return NextResponse.json(row.response);
      const res = await aiCtx.run({ answer: row.result_text || "" }, () => handle(body));
      const json = await res.clone().json().catch(() => null);
      await sb.from("ai_requests").update(res.ok ? { response: json, delivered_at: new Date().toISOString() } : { delivered_at: new Date().toISOString() }).eq("id", row.id);
      return res;
    }
    const ctx: AICtx = {};
    const res = await aiCtx.run(ctx, () => handle(body));
    if (!ctx.queued) return res;
    const task = endpoint === "ai" ? body.task : endpoint;
    const { data: row, error } = await sb.from("ai_requests").insert({
      endpoint, task, label: LABELS[task] || task, payload: body,
      account_id: body.account_id || body.data?.account?.id || null,
      system: ctx.queued.system, prompt: ctx.queued.prompt, web_search: ctx.queued.webSearch, max_tokens: ctx.queued.maxTokens,
    }).select("id").single();
    if (error) return NextResponse.json({ error: `Não consegui pôr o pedido na fila do Claude: ${error.message}` }, { status: 500 });
    return NextResponse.json({ queued: true, request_id: row.id, status: "pending" }, { status: 202 });
  };
}

export async function callClaude(opts: { prompt: string; webSearch?: boolean; maxTokens?: number }) {
  const store = aiCtx.getStore();
  if (store?.answer != null) return store.answer;
  if (aiQueueMode()) {
    if (store) store.queued = { system: SYSTEM, prompt: opts.prompt, webSearch: !!opts.webSearch, maxTokens: opts.maxTokens ?? 4000 };
    throw new Error("Pedido enviado para a fila do Claude.");
  }
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
