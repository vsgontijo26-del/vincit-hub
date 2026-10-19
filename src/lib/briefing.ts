/** Briefing estratégico de cada perfil do CREATOR */
export type BField = { k: string; l: string; type?: "text" | "textarea" | "chips" | "multi" | "select"; options?: string[]; ph?: string; help?: string };
export type BSection = { k: string; l: string; d: string; fields: BField[] };

export const BRIEFING: BSection[] = [
  { k: "negocio", l: "Negócio & objetivo", d: "O que o perfil vende e o que precisa acontecer para valer a pena.", fields: [
    { k: "oferta", l: "O que você vende / oferece", type: "textarea", ph: "Ex.: vídeos institucionais e conteúdo mensal para empresas de saúde e educação." },
    { k: "diferencial", l: "Diferencial (por que escolher você)", type: "textarea", ph: "Ex.: roteiro estratégico incluso, entrega em 5 dias, equipe que já gravou 300+ aulas." },
    { k: "ticket", l: "Ticket médio / faixa de preço", ph: "Ex.: R$ 2 mil a R$ 15 mil por projeto" },
    { k: "objetivo", l: "Objetivo principal do perfil", type: "select", options: ["Gerar clientes / vendas", "Autoridade e posicionamento", "Crescer audiência", "Comunidade e relacionamento", "Portfólio / prova de trabalho"] },
    { k: "cta", l: "Para onde levar as pessoas (CTA principal)", ph: "Ex.: WhatsApp, link na bio, comentar palavra-chave, agendar reunião" },
    { k: "metas", l: "Metas e números", ph: "Ex.: 10 reuniões/mês, 20 mil seguidores até dezembro" },
  ] },
  { k: "publico", l: "Público", d: "Para quem cada conteúdo é feito.", fields: [
    { k: "persona", l: "Quem é o cliente ideal", type: "textarea", ph: "Ex.: dono(a) de clínica ou escola, 30–50 anos, sem tempo, já tentou gravar sozinho." },
    { k: "regiao", l: "Idade, região, classe", ph: "Ex.: 28–50 anos, Goiânia e Brasília, classes A/B" },
    { k: "dores", l: "Dores e problemas", type: "chips", ph: "Digite e aperte Enter", help: "O que tira o sono dele." },
    { k: "desejos", l: "Desejos e resultados que quer", type: "chips", ph: "Digite e aperte Enter" },
    { k: "objecoes", l: "Objeções (por que não compra)", type: "chips", ph: "Ex.: caro, sem tempo, vergonha de câmera" },
    { k: "consciencia", l: "Nível de consciência da maioria", type: "select", options: ["Não sabe que tem o problema", "Sabe do problema", "Conhece soluções", "Conhece você/seu produto", "Pronto para comprar"] },
    { k: "linguagem", l: "Palavras e expressões que o público usa", type: "chips", ph: "Ex.: 'gravar story', 'ficar natural', 'vídeo profissional'" },
  ] },
  { k: "mercado", l: "Nicho & mercado", d: "Onde o perfil compete e como se diferenciar.", fields: [
    { k: "nicho", l: "Nicho e subnicho", ph: "Ex.: produção audiovisual › vídeo para empresas de educação" },
    { k: "concorrentes", l: "Concorrentes / perfis de referência", type: "chips", ph: "@perfil" },
    { k: "padrao", l: "O que todo mundo do nicho faz (para evitar)", type: "textarea", ph: "Ex.: vídeo de drone com música épica, 'dicas' genéricas de equipamento." },
    { k: "oportunidades", l: "Lacunas e oportunidades", type: "textarea", ph: "Ex.: ninguém mostra bastidores reais nem números de clientes." },
    { k: "datas", l: "Sazonalidade e datas importantes", type: "chips", ph: "Ex.: volta às aulas, Black Friday, formaturas" },
  ] },
  { k: "marca", l: "Marca & estilo", d: "Como o perfil soa e se parece.", fields: [
    { k: "personalidade", l: "Personalidade em 3 adjetivos", type: "chips", ph: "Ex.: direto, criativo, confiável" },
    { k: "tom", l: "Tom de voz", type: "multi", options: ["Direto", "Educativo", "Bem-humorado", "Inspirador", "Técnico", "Próximo / informal", "Premium / sofisticado", "Provocador"] },
    { k: "estetica", l: "Estética visual", type: "textarea", ph: "Ex.: preto e grafite com verde menta, luz contrastada, cortes rápidos, tipografia bold." },
    { k: "gosta", l: "Referências que admira (contas, filmes, marcas)", type: "chips", ph: "Ex.: @perfil, Apple, A24" },
    { k: "evitar", l: "O que NÃO combina com a marca", type: "chips", ph: "Ex.: dancinha, clickbait, palavrão" },
    { k: "rosto", l: "Quem aparece nos conteúdos", type: "select", options: ["Fundador(a) aparece sempre", "Equipe e clientes", "Às vezes aparece alguém", "Ninguém aparece (só produto/bastidor)"] },
  ] },
  { k: "conteudo", l: "Conteúdo & produção", d: "O que você tem em mãos para criar.", fields: [
    { k: "pilares", l: "Pilares de conteúdo (3 a 5 temas)", type: "chips", ph: "Ex.: bastidores, educação, cases, opinião" },
    { k: "formatos", l: "Formatos prioritários", type: "multi", options: ["Reels", "Carrossel", "Stories", "YouTube (vídeo longo)", "Foto", "Lives"] },
    { k: "frequencia", l: "Frequência possível", ph: "Ex.: 3 Reels + 2 carrosséis por semana, stories diários" },
    { k: "recursos", l: "Recursos de produção", type: "textarea", ph: "Ex.: equipe com câmera, estúdio, 1 diária de gravação por mês, editor próprio." },
    { k: "provas", l: "Provas reais (números, cases, depoimentos)", type: "textarea", ph: "Ex.: 300+ aulas gravadas para a IPM; cliente X saiu de 800 para 40 mil views.", help: "A IA só usa números que estiverem aqui." },
    { k: "historias", l: "Histórias que podem virar conteúdo", type: "textarea", ph: "Ex.: o dia em que o HD queimou na véspera da entrega; como a empresa começou." },
  ] },
];

const ALL = BRIEFING.flatMap((s) => s.fields);
const filled = (v: any) => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()));
export const briefingProgress = (b: any) => Math.round((ALL.filter((f) => filled(b?.[f.k])).length / ALL.length) * 100);

/** texto compacto do briefing para o contexto da IA */
export function briefingText(b: any): string {
  if (!b || typeof b !== "object") return "";
  const lines: string[] = [];
  for (const s of BRIEFING) {
    const parts = s.fields.filter((f) => filled(b[f.k])).map((f) => `${f.l}: ${Array.isArray(b[f.k]) ? b[f.k].join("; ") : String(b[f.k]).replace(/\s+/g, " ").trim()}`);
    if (parts.length) lines.push(`[${s.l}] ${parts.join(" | ")}`);
  }
  return lines.length ? `BRIEFING DO PERFIL (use para ser específico; respeite o que deve ser evitado; só use números das provas):\n${lines.join("\n")}` : "";
}
