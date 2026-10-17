import { NextResponse } from "next/server";
import { callClaude, extractJson } from "@/lib/ai";
import { AGENTS } from "@/lib/agents";

export const maxDuration = 300;

function postsTable(posts: any[]) {
  return (posts || []).slice(0, 40).map((p) =>
    `- ${p.posted_at?.slice(0, 10) || "?"} | ${p.media_type || "?"} | curtidas ${p.like_count ?? "-"} | coment. ${p.comments_count ?? "-"} | alcance ${p.reach ?? "-"} | salvos ${p.saved ?? "-"} | compart. ${p.shares ?? "-"} | views ${p.plays ?? "-"} | "${(p.caption || "").replace(/\s+/g, " ").slice(0, 160)}"`
  ).join("\n");
}

export async function POST(req: Request) {
  try {
    const { task, data } = await req.json();
    const ctx = data?.account ? `Perfil: @${data.account.username}${data.account.niche ? ` | Nicho: ${data.account.niche}` : ""}${data.account.goals ? ` | Objetivos: ${data.account.goals}` : ""}${data.account.followers_count ? ` | Seguidores: ${data.account.followers_count}` : ""}` : "";

    if (task === "profile_diagnosis") {
      const text = await callClaude({
        maxTokens: 5000,
        prompt: `${ctx}\n\nÚltimos posts e métricas:\n${postsTable(data.posts) || "(sem posts sincronizados)"}\n\nFaça um diagnóstico estratégico do perfil em markdown com as seções:\n## Resumo\n## O que está funcionando (com evidências dos números)\n## O que não está funcionando\n## Padrões de formato, tema e gancho\n## Melhores dias/horários (se der para inferir)\n## Plano de ação para as próximas 2 semanas (lista numerada, concreta)\n## 5 ideias de posts com gancho\nSeja específico e use os números.`,
      });
      return NextResponse.json({ text });
    }

    if (task === "trends") {
      const text = await callClaude({
        webSearch: true,
        maxTokens: 6000,
        prompt: `${ctx}\nNicho/tema: ${data.niche}\nPúblico: ${data.audience || "não informado"}\nFoco: ${data.focus || "geral"}\nData de hoje: ${new Date().toISOString().slice(0, 10)}\n\nPesquise na web as tendências ATUAIS de conteúdo no Instagram para esse nicho no Brasil (formatos em alta, áudios/trends de Reels, temas em discussão, datas próximas relevantes). Depois responda SOMENTE com um JSON:\n{"resumo":"2-3 frases sobre o cenário","tendencias":[{"titulo":"...","por_que":"por que está em alta e evidência","formato":"Reels|Carrossel|Stories|Foto|Live","gancho":"gancho pronto","ideia":"como a VINCIT/perfil pode aplicar, em 2-3 frases","urgencia":"alta|media|baixa"}]}\nTraga de 6 a 10 tendências.`,
      });
      return NextResponse.json(extractJson(text));
    }

    if (task === "reference") {
      const text = await callClaude({
        maxTokens: 4000,
        prompt: `${ctx}\nAnalise esta referência de conteúdo:\nTítulo: ${data.title}\nPerfil: ${data.handle || "-"}\nURL: ${data.url || "-"}\nFormato: ${data.format || "-"}\nConteúdo (legenda/transcrição/descrição):\n"""${data.content || ""}"""\n\nResponda SOMENTE com JSON:\n{"gancho":"qual é o gancho e por que prende","estrutura":["passo 1","passo 2"],"por_que_funciona":"...","gatilhos":["curiosidade","..."],"modelo_de_copy":"template reutilizável com [colchetes] nas partes variáveis","adaptacoes":["ideia adaptada 1","ideia 2","ideia 3"],"sinais_de_tendencia":["..."],"nota":0-10}`,
      });
      return NextResponse.json(extractJson(text));
    }

    if (task === "copy") {
      const text = await callClaude({
        maxTokens: 4000,
        prompt: `${ctx}\nCrie o conteúdo:\nTema: ${data.topic}\nFormato: ${data.format}\nObjetivo: ${data.goal}\nTom: ${data.tone}\n${data.keyword ? `CTA de automação: pedir para comentar a palavra "${data.keyword}" para receber no direct.` : ""}\n${data.reference ? `Use como referência de estrutura:\n${data.reference}` : ""}\n\nEntregue em markdown:\n## 5 opções de gancho\n## ${data.format === "Carrossel" ? "Texto slide a slide" : data.format === "Reels" ? "Roteiro (cena, fala, texto na tela, duração)" : "Conteúdo"}\n## Legenda pronta\n## CTA\n## Hashtags (até 8, específicas)`,
      });
      return NextResponse.json({ text });
    }

    if (task === "automation_copy") {
      const text = await callClaude({
        maxTokens: 1200,
        prompt: `${ctx}\nCrie as mensagens de uma automação de Instagram. Quando alguém comentar "${data.keyword}" no post, o perfil responde publicamente e envia uma DM.\nO que será entregue: ${data.offer}\n${data.link ? `Link: ${data.link}` : ""}\nResponda SOMENTE com JSON: {"public_reply":"resposta curta e variada para o comentário, até 80 caracteres, sem link","dm_message":"mensagem de direct calorosa, até 500 caracteres, que entrega o prometido${data.link ? " e menciona que o link segue abaixo" : ""}"}`,
      });
      return NextResponse.json(extractJson(text));
    }

    if (task === "agent") {
      const ag = AGENTS.find((a) => a.id === data.agent);
      if (!ag) return NextResponse.json({ error: "Agente desconhecido" }, { status: 400 });
      const text = await callClaude({
        webSearch: !!ag.web,
        maxTokens: 5000,
        prompt: `${ag.prompt}\n\n${ctx}\nData de hoje: ${new Date().toISOString().slice(0, 10)}\n\nPedido:\n"""${data.input || ""}"""\n\nResponda em markdown, pronto para usar.`,
      });
      return NextResponse.json({ text });
    }

    if (task === "proposal_text") {
      const c = data.client || {};
      const text = await callClaude({
        maxTokens: 3000,
        prompt: `Você escreve propostas comerciais para a VINCIT, produtora audiovisual brasileira. Tom: profissional, próximo e confiante, sem exageros.\nProjeto: ${data.title}\nCliente: ${c.name || "-"}${c.company ? ` (${c.company})` : ""}${c.segment ? ` · segmento ${c.segment}` : ""}\nItens orçados: ${data.items || "-"}\nInvestimento total: ${data.total}\nContexto adicional: ${data.brief || "-"}\n\nResponda SOMENTE com JSON: {"intro":"abertura pessoal de 2-3 frases para o cliente","scope":"escopo em parágrafos curtos ou tópicos com hífen","deliverables":"lista de entregáveis com hífen, específica (duração, formatos, resolução, quantidade de revisões)","timeline":"cronograma por etapas com prazos estimados","payment_terms":"condições de pagamento sugeridas (ex.: 50% na aprovação e 50% na entrega) e forma de pagamento"}`,
      });
      return NextResponse.json(extractJson(text));
    }

    return NextResponse.json({ error: "Tarefa desconhecida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}
