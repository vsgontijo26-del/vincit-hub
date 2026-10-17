import { NextResponse } from "next/server";
import { callClaude, extractJson } from "@/lib/ai";
import { AGENTS } from "@/lib/agents";
import { FORMATS, CATS } from "@/lib/formats";

export const maxDuration = 300;

function postsTable(posts: any[]) {
  return (posts || []).slice(0, 40).map((p) =>
    `- ${p.posted_at?.slice(0, 10) || "?"} | ${p.media_type || "?"} | curtidas ${p.like_count ?? "-"} | coment. ${p.comments_count ?? "-"} | alcance ${p.reach ?? "-"} | salvos ${p.saved ?? "-"} | compart. ${p.shares ?? "-"} | views ${p.plays ?? "-"} | "${(p.caption || "").replace(/\s+/g, " ").slice(0, 160)}"`
  ).join("\n");
}

export async function POST(req: Request) {
  try {
    const { task, data } = await req.json();
    const ctx = data?.account ? `Perfil: @${data.account.username}${data.account.niche ? ` | Nicho: ${data.account.niche}` : ""}${data.account.goals ? ` | Objetivos: ${data.account.goals}` : ""}${data.account.followers_count ? ` | Seguidores: ${data.account.followers_count}` : ""}${data.account.brand_voice ? `\nVoz da marca: ${data.account.brand_voice}` : ""}` : "";

    if (task === "profile_diagnosis") {
      const text = await callClaude({
        maxTokens: 5000,
        prompt: `${ctx}\n\nÚltimos posts e métricas:\n${postsTable(data.posts) || "(sem posts sincronizados)"}\n\nFaça um diagnóstico estratégico do perfil em markdown com as seções:\n## Resumo\n## O que está funcionando (com evidências dos números)\n## O que não está funcionando\n## Padrões de formato, tema e gancho\n## Leitura de funil (views altas e poucos seguidores = problema de perfil; poucas views = problema de gancho/conteúdo; compartilhamentos e seguidores por alcance)\n## Outliers (posts acima de 2x a mediana de views/alcance e o que têm em comum)\n## Melhores dias/horários (se der para inferir)\n## Plano de ação para as próximas 2 semanas (lista numerada, concreta)\n## 5 ideias de posts com gancho\nSeja específico e use os números.`,
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
        prompt: `${ctx}\nAnalise esta referência de conteúdo:\nTítulo: ${data.title}\nPerfil: ${data.handle || "-"}\nURL: ${data.url || "-"}\nFormato: ${data.format || "-"}\n${data.views ? `Views: ${data.views}` : ""}${data.followers ? ` | Seguidores do perfil: ${data.followers}` : ""}${data.median_views ? ` | Mediana de views do perfil: ${data.median_views}` : ""}\nConteúdo (legenda/transcrição/descrição):\n"""${data.content || ""}"""\n\nResponda SOMENTE com JSON:\n{"gancho":"qual é o gancho e por que prende","estrutura":["passo 1","passo 2"],"por_que_funciona":"...","gatilhos":["curiosidade","..."],"modelo_de_copy":"template reutilizável com [colchetes] nas partes variáveis","adaptacoes":["ideia adaptada 1","ideia 2","ideia 3"],"formula_gancho":"nome da fórmula do gancho (ex.: contradição, número específico, mistério, POV)","formatos_criativos":["cartas das 32 que a referência usa"],"sinais_de_tendencia":["..."],"nota":0-10}`,
      });
      return NextResponse.json(extractJson(text));
    }

    if (task === "copy") {
      const text = await callClaude({
        maxTokens: 4000,
        prompt: `${ctx}\nCrie o conteúdo:\nTema: ${data.topic}\nFormato: ${data.format}\nObjetivo: ${data.goal}\nTom: ${data.tone}\n${data.keyword ? `CTA de automação: pedir para comentar a palavra "${data.keyword}" para receber no direct.` : ""}\n${data.reference ? `Use como referência de estrutura:\n${data.reference}` : ""}\n\nEntregue em markdown:\n## 5 opções de gancho\n## ${data.format === "Carrossel" ? "Texto slide a slide" : data.format === "Reels" ? "Roteiro (cena, fala, texto na tela, duração)" : "Conteúdo"}\n## Legenda pronta\n## CTA\n## Hashtags (até 5, específicas)${data.format_card ? `\n\nUse o formato criativo \"${data.format_card}\" na construção do roteiro e explique em 1 linha como ele foi aplicado.` : ""}`,
      });
      return NextResponse.json({ text });
    }

    if (task === "automation_copy") {
      const text = await callClaude({
        maxTokens: 1200,
        prompt: `${ctx}\nCrie as mensagens de uma automação de Instagram. Quando alguém comentar "${data.keyword}" no post, o perfil responde publicamente e envia uma DM.\nO que será entregue: ${data.offer}\n${data.link ? `Link: ${data.link}` : ""}\nResponda SOMENTE com JSON: {"public_reply":"resposta curta e variada para o comentário, até 80 caracteres, sem link, avisando que mandou no direct","dm_message":"mensagem de direct calorosa, até 500 caracteres, que ENTREGA o prometido logo na primeira frase (sem exigir seguir ou responder antes)${data.link ? " e menciona que o link segue abaixo" : ""}, e termina com uma pergunta leve que abre conversa"}`,
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

    if (task === "format_apply") {
      const f = FORMATS.find((x) => x.id === data.card);
      const f2 = data.card2 ? FORMATS.find((x) => x.id === data.card2) : null;
      if (!f) return NextResponse.json({ error: "Carta desconhecida" }, { status: 400 });
      const desc = (x: typeof f) => `Carta ${x.n} · ${x.name} (${CATS[x.cat].l})\nEssência: ${x.essence}\nPor que funciona: ${x.why}\nComo aplicar: ${x.how.join(" ")}`;
      const text = await callClaude({
        maxTokens: 3500,
        prompt: `${ctx}\nAplique o formato criativo abaixo${f2 ? " combinado com o segundo" : ""} ao tema.\n\n${desc(f)}${f2 ? `\n\n${desc(f2)}` : ""}\n\nTema: ${data.topic}\nFormato de entrega: ${data.format || "Reels"}\nObjetivo: ${data.goal || "alcance e conexão"}\n\nEntregue em markdown:\n## Ideia em 1 frase\n## 3 opções de gancho\n## Roteiro (tabela mental: tempo · cena/visual · fala · texto na tela)\n## Dicas de gravação e edição para essa carta\n## Legenda (1ª linha forte, 1 CTA, até 5 hashtags)\n## Por que essa carta funciona aqui (2 linhas)`,
      });
      return NextResponse.json({ text });
    }

    if (task === "brand_voice") {
      const text = await callClaude({
        maxTokens: 1200,
        prompt: `${ctx}\nAnalise os textos abaixo, escritos pela própria marca, e descreva a VOZ DA MARCA em no máximo 900 caracteres, como instruções para um redator: tom, pessoa (eu/nós/você), tamanho de frase, vocabulário e gírias usadas, palavras proibidas, uso de emoji, como abre e como fecha um texto. Não invente; baseie-se só nos textos.\n\nTextos:\n"""${data.samples || ""}"""\n\nResponda só com o texto da voz da marca, sem título.`,
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
