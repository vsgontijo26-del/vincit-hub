import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, extractJson, aiQuotaExceeded, QUOTA_MSG } from "@/lib/ai";
import { briefingText } from "@/lib/briefing";
import { AXES, computeInputs, availability } from "@/lib/diagnostico";

export const maxDuration = 300;

/** Raio-X do perfil: lê os dados no servidor (RLS do usuário), calcula a evidência e pede à IA nota, leitura e recomendações por eixo */
export async function POST(req: Request) {
  try {
    const { account_id } = await req.json();
    const sb = await createClient();
    if (await aiQuotaExceeded(sb)) return NextResponse.json({ error: QUOTA_MSG }, { status: 429 });
    const { data: account } = await sb.from("ig_accounts").select("*").eq("id", account_id).maybeSingle();
    if (!account) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    const [posts, refs, library, contacts, autos, flows, ideas, sched, plan, prev] = await Promise.all([
      sb.from("ig_posts").select("ig_media_id,posted_at,media_type,like_count,comments_count,reach,saved,shares,plays,caption").eq("account_id", account_id).order("posted_at", { ascending: false }).limit(60),
      sb.from("ref_profiles").select("handle,platform,followers,analysis").eq("account_id", account_id).order("created_at", { ascending: false }).limit(6),
      sb.from("references_lib").select("title,handle,format,analysis").order("created_at", { ascending: false }).limit(10),
      sb.from("dm_contacts").select("id", { count: "exact", head: true }).eq("account_id", account_id),
      sb.from("automations").select("id", { count: "exact", head: true }).eq("account_id", account_id).eq("active", true),
      sb.from("dm_flows").select("id", { count: "exact", head: true }).eq("account_id", account_id).eq("active", true),
      sb.from("content_ideas").select("status,pillar,format").eq("account_id", account_id).limit(500),
      sb.from("scheduled_posts").select("ig_media_id,idea_id").eq("account_id", account_id).not("ig_media_id", "is", null).not("idea_id", "is", null),
      sb.from("growth_plans").select("goal,horizon,plan,created_at").eq("account_id", account_id).order("created_at", { ascending: false }).limit(1),
      sb.from("profile_diagnoses").select("id,result,created_at").eq("account_id", account_id).order("created_at", { ascending: false }).limit(1),
    ]);

    // desempenho por pilar: post publicado pelo HUB → conteúdo de origem → pilar
    const pillarByMedia: Record<string, string> = {};
    const ideaIds = (sched.data || []).map((s: any) => s.idea_id);
    if (ideaIds.length) {
      const { data: src } = await sb.from("content_ideas").select("id,pillar").in("id", ideaIds);
      const pill: Record<string, string> = Object.fromEntries((src || []).filter((i: any) => i.pillar).map((i: any) => [i.id, i.pillar]));
      (sched.data || []).forEach((s: any) => { if (pill[s.idea_id]) pillarByMedia[s.ig_media_id] = pill[s.idea_id]; });
    }

    const inputs = computeInputs({
      account, posts: posts.data || [], refs: refs.data || [], library: library.data || [],
      dmContacts: contacts.count || 0, automations: (autos.count || 0) + (flows.count || 0), ideas: ideas.data || [], pillarByMedia,
    });
    const avail = availability(account, inputs);
    const niche = inputs.perfil.nicho;
    const previous = prev.error ? null : prev.data?.[0] || null;

    const ctx = `Perfil: @${account.username}${niche ? ` | Nicho: ${niche}` : ""}${account.goals ? ` | Objetivos: ${account.goals}` : ""}${account.brand_voice ? `\nVoz da marca: ${account.brand_voice}` : ""}${account.briefing ? `\n${briefingText(account.briefing)}` : ""}`;
    const captions = (posts.data || []).slice(0, 15).map((p: any) => `- ${p.posted_at?.slice(0, 10) || "?"} ${p.media_type || ""}: "${(p.caption || "").replace(/\s+/g, " ").slice(0, 180)}"`).join("\n");
    const refText = (refs.data || []).map((r: any) => `- ${r.handle} (${r.platform}, ${r.followers ?? "?"} seguidores): ${(r.analysis?.resumo || r.analysis?.leitura || "").toString().slice(0, 300)}`).join("\n");
    const libText = (library.data || []).map((r: any) => `- ${r.title}${r.handle ? ` (${r.handle})` : ""}: ${(r.analysis?.por_que_funciona || "").toString().slice(0, 200)}`).join("\n");
    const planText = plan.data?.[0] ? `Meta: ${plan.data[0].goal || plan.data[0].plan?.meta?.principal || "-"} | Posicionamento: ${plan.data[0].plan?.posicionamento || "-"} | Cadência: ${plan.data[0].plan?.cadencia?.semana || "-"}` : "";
    const prevText = previous ? `Diagnóstico anterior (${previous.created_at.slice(0, 10)}): ${(previous.result?.eixos || []).map((e: any) => `${e.key}=${e.nota ?? "sem informação"}`).join(", ")}. Resumo: ${previous.result?.resumo || ""}` : "";
    const axesText = AXES.map((a) => `- ${a.key} (${a.label}): ${a.q} ${avail[a.key] ? "[HÁ DADOS: dê nota]" : "[SEM DADOS: nota null, não recomende conteúdo]"}`).join("\n");

    const text = await callClaude({
      webSearch: !!niche,
      maxTokens: 9000,
      prompt: `${ctx}

NÚMEROS CALCULADOS PELO SISTEMA (únicos números que você pode citar; null = não existe o dado):
${JSON.stringify(inputs)}
${captions ? `\nLegendas recentes:\n${captions}` : ""}${refText ? `\nPerfis de referência analisados:\n${refText}` : ""}${libText ? `\nBiblioteca de referências:\n${libText}` : ""}${planText ? `\nEstratégia vigente: ${planText}` : ""}${prevText ? `\n${prevText}` : ""}
Data de hoje: ${new Date().toISOString().slice(0, 10)}

Faça o RAIO-X ESTRATÉGICO deste perfil, primeira etapa do método Diagnóstico → Estratégia → Implementação (método de crescimento de "Negócio Creator"). Avalie os 5 eixos que movem o crescimento:
${axesText}

${niche ? `Pesquise na web o mercado e o nicho "${niche}" no Brasil (como os concorrentes se posicionam, o que o público procura, formatos e temas em alta). Só inclua um sinal de mercado se tiver a URL de onde tirou; sem fonte, não inclua.` : `Nicho não informado: deixe "mercado" como null.`}

Regras:
- Nota de 0 a 10 só para eixos marcados com HÁ DADOS; a evidência cita os números acima ou trechos do briefing/legendas. Nunca invente números, clientes, concorrentes ou resultados.
- Eixos SEM DADOS: "nota": null, "evidencia": "", "recomendacoes": [].
- Cada recomendação é um conteúdo concreto que pode ir para a pauta: título até 80 caracteres, formato, pilar (use os pilares do briefing quando houver) e gancho de até 12 palavras.
${previous ? "- Compare com o diagnóstico anterior em \"evolucao\" (o que subiu, caiu ou ficou igual)." : "- \"evolucao\": null."}

Responda SOMENTE com JSON:
{"resumo":"3-4 frases: onde o perfil está hoje frente ao mercado e ao nicho","prioridades":["as 3 coisas mais importantes a fazer, em ordem"],"eixos":[{"key":"distribuicao|narrativa|canais|comunidade|conteudo","nota":0-10 ou null,"evidencia":"...","pontos_fortes":["..."],"lacunas":["..."],"recomendacoes":[{"titulo":"...","porque":"1 frase ligando à lacuna","formato":"Reels|Carrossel|Stories|Foto|YouTube|Live","pilar":"...","gancho":"..."}]}],"nicho":{"posicionamento_atual":"como o perfil se posiciona hoje (só com base no briefing/legendas)","lacuna":"espaço do nicho que ninguém ocupa e o perfil pode ocupar","oportunidades":["..."]},"mercado":{"resumo":"...","sinais":[{"texto":"...","fonte":"https://..."}]} ou null,"evolucao":"..." ou null}
Traga os 5 eixos, na ordem acima, com 2 a 3 recomendações nos eixos com dados.`,
    });
    const r = extractJson(text);

    // o sistema garante a regra: sem dado, sem nota nem recomendação
    r.eixos = AXES.map((a) => {
      const e = (r.eixos || []).find((x: any) => x.key === a.key) || {};
      if (!avail[a.key]) return { key: a.key, nota: null, evidencia: "", pontos_fortes: [], lacunas: [], recomendacoes: [], sem_dados: a.needs };
      const nota = typeof e.nota === "number" ? Math.max(0, Math.min(10, Math.round(e.nota * 10) / 10)) : null;
      return { ...e, key: a.key, nota, recomendacoes: (e.recomendacoes || []).map((x: any, i: number) => ({ ...x, id: `${a.key}-${i}` })) };
    });
    if (!niche) r.mercado = null;
    if (r.mercado?.sinais) r.mercado.sinais = r.mercado.sinais.filter((s: any) => /^https?:\/\//.test(s.fonte || ""));

    const { data: saved, error } = await sb.from("profile_diagnoses").insert({ account_id, result: r, inputs }).select("id,created_at").single();
    return NextResponse.json({ id: saved?.id || null, created_at: saved?.created_at || new Date().toISOString(), result: r, inputs, saved: !error });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}
