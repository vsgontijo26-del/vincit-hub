"use client";
import { useMemo, useState } from "react";
import PageHead from "@/components/PageHead";
import CopyButton from "@/components/CopyButton";

/* Ferramentas locais (sem IA, instantâneas). Heurísticas inspiradas em instagram-agent-skill (J. Schincariol, MIT), adaptadas ao PT-BR. */

// ───────────── Ganchos ─────────────
const FORMULAS: { id: string; name: string; ex: string; re?: RegExp }[] = [
  { id: "contradicao", name: "Contradição", ex: "Postar todo dia está matando seu alcance", re: /\b(está|tá) (matando|destruindo|atrapalhando)|\bnão (é|era) (sobre|o que)|\bao contrário\b/i },
  { id: "numero", name: "Número específico", ex: "Gravei 47 Reels e só 3 deram certo", re: /\b\d+([.,]\d+)?\s?(%|mil|k|x|reais|dias|vídeos|reels|posts|seguidores|views|minutos|segundos)?\b/i },
  { id: "erro", name: "Erro comum", ex: "O erro que faz seu vídeo parecer amador", re: /\b(erro|erros|errando|errado)\b/i },
  { id: "pare", name: "Pare de…", ex: "Pare de começar vídeo com 'oi gente'", re: /^\s*(pare|para|chega) de\b/i },
  { id: "segredo", name: "Segredo / bastidor", ex: "O que produtoras não te contam sobre orçamento", re: /\b(segredo|ninguém (te )?(conta|fala)|não te contam|bastidor|por trás)\b/i },
  { id: "resultado-prazo", name: "Resultado + prazo", ex: "Como saímos de 2 para 20 clientes em 6 meses", re: /\b(em|durante) \d+ (dias|semanas|meses|anos)\b/i },
  { id: "pergunta-dor", name: "Pergunta que dói", ex: "Por que seu vídeo tem views e ninguém compra?", re: /^\s*(por que|porque|será que|você (já|ainda|sabe))\b.*\?/i },
  { id: "antes-depois", name: "Antes × depois", ex: "Esse vídeo custou R$ 0. Esse custou R$ 15 mil", re: /\b(antes|depois)\b.*\b(antes|depois)\b|\bvs\.?\b|\bx\b/i },
  { id: "mito", name: "Mito × verdade", ex: "Luz cara não deixa vídeo bonito", re: /\b(mito|mentira|verdade|não precisa|ninguém precisa)\b/i },
  { id: "lista", name: "Lista", ex: "3 planos que todo vídeo institucional precisa", re: /^\s*\d+\s+\w+/i },
  { id: "pov", name: "POV", ex: "POV: o cliente pediu 'só um ajuste'", re: /^\s*pov\b/i },
  { id: "se-voce", name: "Se você…", ex: "Se você grava no celular, assiste isso", re: /^\s*se (você|vc|tu)\b/i },
  { id: "confissao", name: "Confissão", ex: "Eu cobrava barato por medo — e quase quebrei", re: /\b(eu (cobrava|achava|errei|confesso|fazia|perdi|quase))\b/i },
  { id: "alerta", name: "Alerta", ex: "Cuidado antes de fechar com uma produtora", re: /\b(cuidado|atenção|alerta|não faça|nunca faça)\b/i },
  { id: "testei", name: "Eu testei", ex: "Testei a luz de R$ 100 contra a de R$ 3 mil", re: /\b(testei|testamos|experimentei|fiz o teste)\b/i },
  { id: "o-que-aconteceu", name: "O que aconteceu quando", ex: "O que aconteceu quando gravamos sem roteiro", re: /\bo que aconteceu (quando|depois)\b/i },
  { id: "opiniao", name: "Opinião impopular", ex: "Opinião impopular: vídeo bonito não vende", re: /\b(opinião impopular|vou apanhar|polêmic|ninguém (concorda|vai gostar))\b/i },
  { id: "ranking", name: "Ranking", ex: "Do pior ao melhor microfone de lapela", re: /\b(do pior ao melhor|ranking|top \d+|melhor(es)? e pior(es)?)\b/i },
  { id: "custo", name: "Custo do erro", ex: "Esse detalhe custou R$ 8 mil para o cliente", re: /\b(custou|perdeu|prejuízo|jogou fora)\b/i },
  { id: "atalho", name: "Atalho", ex: "O jeito mais rápido de ter áudio limpo", re: /\b(jeito mais (rápido|fácil|simples)|atalho|truque|hack)\b/i },
  { id: "identificacao", name: "Identificação", ex: "Todo editor já passou por isso", re: /\b(todo (mundo|editor|criador|cliente)|quem nunca|você também)\b/i },
  { id: "desafio", name: "Desafio", ex: "Duvido você notar o corte nesse vídeo", re: /\b(duvido|desafio|tente|aposto)\b/i },
  { id: "previsao", name: "Previsão", ex: "Em 2027, vídeo institucional vai morrer", re: /\b(vai (morrer|acabar|mudar)|em 20\d\d|o futuro)\b/i },
  { id: "historia", name: "História em 1 frase", ex: "O cliente chorou quando viu o primeiro corte", re: /\b(quando eu|um dia|ontem|semana passada|o cliente)\b/i },
  { id: "misterio", name: "Mistério", ex: "Ninguém percebeu o que tem no fundo dessa cena", re: /\b(ninguém percebeu|repara|olha (isso|o que)|adivinha|até o final)\b/i },
  { id: "comparacao", name: "Comparação", ex: "Iphone x câmera de cinema: diferença real", re: /\b(contra|comparado|diferença (real|entre))\b/i },
];
const WEAK = /^\s*(oi|olá|ola|fala|e a[ií]|bom dia|boa (tarde|noite)|gente|pessoal|galera|nesse v[ií]deo|neste v[ií]deo|hoje (eu )?(vou|vamos)|então|bom,|seguinte)\b/i;

function scoreHook(h: string) {
  const t = h.trim(); if (!t) return null;
  const words = t.split(/\s+/).filter(Boolean).length;
  const formulas = FORMULAS.filter((f) => f.re?.test(t));
  const gapF = ["contradicao", "mito", "opiniao", "segredo", "misterio", "custo", "erro", "pare", "alerta", "o-que-aconteceu", "pergunta-dor"];
  const checks: [string, boolean, number][] = [
    ["Até 12 palavras", words <= 12, 20],
    ["Não começa com cumprimento ou 'nesse vídeo'", !WEAK.test(t), 20],
    ["Fala com o espectador (você/seu)", /\b(você|voce|vc|seu|sua|seus|suas|te)\b/i.test(t), 10],
    ["Tem algo específico (número, valor, nome)", /\d|R\$|[A-Z][a-zà-ú]+\s[A-Z]/.test(t.slice(1)), 15],
    ["Abre uma lacuna (curiosidade, tensão ou contraste)", /\?|\b(mas|porém|ninguém|nunca|erro|segredo|pare|verdade|mito|por que|o que|até o final|cuidado|custou)\b/i.test(t) || formulas.some((f) => gapF.includes(f.id)), 20],
    ["Linguagem simples (palavras curtas)", t.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter((w) => w.length > 12).length === 0, 15],
  ];
  const score = checks.reduce((a, [, ok, w]) => a + (ok ? w : 0), 0);
  return { score, words, checks, formulas };
}

// ───────────── Roteiro ─────────────
const STRUCTS: Record<string, { l: string; beats: [string, number, string][] }> = {
  ihc: { l: "I.H.C (Identificação → História → Conteúdo)", beats: [["Gancho", 8, "Frase + visual que param o scroll"], ["Identificação", 15, "Situação/dor que o público reconhece"], ["História", 40, "Conflito, virada, emoção"], ["Conteúdo", 27, "A lição/dica que a história prova"], ["CTA", 10, "Um único pedido"]] },
  heroi: { l: "Jornada do herói", beats: [["Gancho", 8, "O resultado ou o conflito em 1 frase"], ["Vida comum", 12, "Como era antes, o incômodo"], ["Chamado", 12, "O evento que obriga a agir"], ["Provações", 33, "Dificuldades, tensão e alívio"], ["Transformação", 25, "O que mudou e o aprendizado"], ["CTA", 10, "Convite"]] },
  problema: { l: "Problema → Solução", beats: [["Gancho", 10, "A dor nomeada"], ["Agravamento", 20, "Por que piora se ignorar"], ["Solução", 40, "O método, passo a passo"], ["Prova", 20, "Exemplo, antes/depois ou case real"], ["CTA", 10, "Salvar ou comentar"]] },
  lista: { l: "Lista / tutorial", beats: [["Gancho", 10, "Promessa com número"], ["Contexto", 10, "Para quem é e por quê"], ["Itens", 60, "Um item por corte, do mais forte ao mais fraco"], ["Recap", 10, "Resumo rápido"], ["CTA", 10, "Salvar para depois"]] },
  misterio: { l: "Mistério / plot twist", beats: [["Lacuna", 10, "Pergunta que só se responde no fim"], ["Pistas", 35, "Detalhes que constroem a expectativa"], ["Falsa resposta", 20, "O que todo mundo acha"], ["Revelação", 25, "A virada"], ["CTA", 10, "Comente se adivinhou"]] },
};
const WPS = 2.5; // palavras por segundo em PT-BR falado

// ───────────── Legenda ─────────────
const CTA_RE = /\b(comente|comenta|salve|salva|compartilhe|compartilha|envie|manda (pra|para)|link na bio|clique|marque|siga|me chama|chama no direct|responda)\b/gi;
function lintCaption(c: string) {
  const first = c.split("\n").find((l) => l.trim()) || "";
  const tags = c.match(/#[\p{L}\d_]+/gu) || [];
  const ctas = c.match(CTA_RE) || [];
  const emojis = c.match(/\p{Extended_Pictographic}/gu) || [];
  const paras = c.split(/\n\s*\n/).filter((p) => p.trim());
  const longPara = paras.some((p) => p.length > 280);
  return {
    len: c.length, first, tags, ctas, emojis,
    checks: [
      ["1ª linha cabe no corte do feed (≤125)", first.length > 0 && first.length <= 125],
      ["1ª linha não é cumprimento", !WEAK.test(first)],
      ["Até 2.200 caracteres", c.length <= 2200],
      ["No máximo 5 hashtags", tags.length <= 5],
      ["Um único CTA", ctas.length === 1],
      ["Parágrafos curtos (leitura no celular)", !longPara],
      ["Emojis com moderação (≤6)", emojis.length <= 6],
    ] as [string, boolean][],
  };
}

// ───────────── Humanizar ─────────────
const CLICHES: [RegExp, string][] = [
  [/\bno mundo (de hoje|atual|moderno)\b,?\s*/gi, ""], [/\bnos dias (de hoje|atuais)\b,?\s*/gi, "hoje "], [/\bdesvend(ar|e|a|amos)\b/gi, "entender"],
  [/\bmergulh(ar|e|amos|ando)\b/gi, "entrar"], [/\bjornada\b/gi, "caminho"], [/\bé importante (ressaltar|destacar|lembrar) que\s*/gi, ""],
  [/\bem suma,?\s*/gi, ""], [/\bem resumo,?\s*/gi, ""], [/\bvale ressaltar que\s*/gi, ""], [/\bnão é apenas\b/gi, "não é só"],
  [/\bpotencializ(ar|e)\b/gi, "aumentar"], [/\balavanc(ar|e)\b/gi, "melhorar"], [/\bdesbloque(ar|ie)\b/gi, "liberar"], [/\bfundamental\b/gi, "essencial"],
  [/\bincrível\b/gi, "muito bom"], [/\bsem sombra de dúvidas?,?\s*/gi, ""], [/\bprepare-se para\b/gi, "você vai"], [/\bvamos juntos\b/gi, "bora"],
  [/\bno universo d[aoe]s?\b/gi, "em"], [/\bnesse contexto,?\s*/gi, ""], [/\bdito isso,?\s*/gi, ""], [/\bcrucial\b/gi, "importante"],
];
function humanCheck(t: string) {
  const words = t.split(/\s+/).filter(Boolean).length || 1;
  const hits = CLICHES.reduce((a, [re]) => a + (t.match(re)?.length || 0), 0);
  const dashes = (t.match(/—/g) || []).length;
  const sents = t.split(/(?<=[.!?])\s+/).map((s) => s.split(/\s+/).length).filter((n) => n > 1);
  const avg = sents.reduce((a, b) => a + b, 0) / (sents.length || 1);
  const sd = Math.sqrt(sents.reduce((a, b) => a + (b - avg) ** 2, 0) / (sents.length || 1));
  const emojis = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
  const notJust = /não (é|se trata de) (só|apenas)[^.]*,\s*(é|mas)/i.test(t);
  const checks: [string, boolean][] = [
    ["Sem clichês de IA", hits === 0],
    ["Travessões com moderação", dashes <= Math.max(1, Math.floor(words / 120))],
    ["Ritmo variado (frases curtas e longas)", sents.length < 3 || sd >= 4],
    ["Sem 'não é só X, é Y'", !notJust],
    ["Emojis com moderação", emojis <= Math.max(2, Math.floor(words / 40))],
  ];
  return { checks, score: checks.filter(([, ok]) => ok).length * 20, hits, dashes };
}
function clean(t: string) {
  let s = t; CLICHES.forEach(([re, rep]) => { s = s.replace(re, rep); });
  s = s.replace(/\s—\s/g, ", ").replace(/—/g, ", ").replace(/ {2,}/g, " ").replace(/\n /g, "\n");
  return s.replace(/(^|[.!?]\s+)([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase());
}

const TABS = [["gancho", "Gancho"], ["roteiro", "Tempo do roteiro"], ["legenda", "Legenda"], ["humanizar", "Humanizar"]] as const;
const Ok = ({ ok }: { ok: boolean }) => <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] shrink-0 ${ok ? "bg-mint text-ink" : "bg-danger/20 text-danger"}`}>{ok ? "✓" : "!"}</span>;
const Meter = ({ v }: { v: number }) => (<div className="flex items-center gap-3"><span className={`font-display text-4xl font-extrabold tabular-nums ${v >= 75 ? "text-mint" : v >= 50 ? "text-[#f5c84c]" : "text-danger"}`}>{v}</span><div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: v >= 75 ? "#6eefb6" : v >= 50 ? "#f5c84c" : "#ff6b6b" }} /></div></div>);

export default function Laboratorio() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("gancho");
  const [hook, setHook] = useState("");
  const [hooks, setHooks] = useState("");
  const [dur, setDur] = useState(45);
  const [st, setSt] = useState("ihc");
  const [script, setScript] = useState("");
  const [cap, setCap] = useState("");
  const [hum, setHum] = useState("");

  const hs = useMemo(() => scoreHook(hook), [hook]);
  const ranked = useMemo(() => hooks.split("\n").map((h) => h.trim()).filter(Boolean).map((h) => ({ h, r: scoreHook(h)! })).sort((a, b) => b.r.score - a.r.score), [hooks]);
  const cl = useMemo(() => lintCaption(cap), [cap]);
  const hc = useMemo(() => humanCheck(hum), [hum]);
  const words = script.split(/\s+/).filter(Boolean).length;
  const est = Math.round(words / WPS);
  let acc = 0;

  return (
    <>
      <PageHead kicker="CREATOR · 03 CRIAÇÃO" title="Laboratório" desc="Ferramentas instantâneas para testar gancho, tempo de roteiro, legenda e 'cara de IA' antes de postar. Rodam no navegador, sem gastar IA." />
      <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-mint text-mint" : "border-transparent text-fog hover:text-paper"}`}>{l}</button>)}</div>

      {tab === "gancho" && (
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-5">
            <div className="card p-5 space-y-4">
              <div><label className="label">Teste um gancho</label><input className="input text-lg" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Ex.: O erro que faz seu vídeo parecer amador" /></div>
              {hs && (<>
                <Meter v={hs.score} />
                <ul className="space-y-1.5 text-sm">{hs.checks.map(([l, ok]) => <li key={l} className="flex items-center gap-2"><Ok ok={ok} />{l}</li>)}</ul>
                <p className="text-xs text-fog">{hs.words} palavras · fórmula detectada: {hs.formulas.length ? hs.formulas.map((f) => f.name).join(", ") : "nenhuma (tente uma da biblioteca)"}</p>
              </>)}
            </div>
            <div className="card p-5">
              <label className="label">Compare vários (um por linha)</label>
              <textarea className="input min-h-[130px]" value={hooks} onChange={(e) => setHooks(e.target.value)} placeholder={"Cole aqui os ganchos do agente Ganchos\n…"} />
              {!!ranked.length && <ol className="mt-3 space-y-1.5">{ranked.map(({ h, r }, i) => <li key={i} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2 text-sm"><span className={`font-mono w-8 ${r.score >= 75 ? "text-mint" : r.score >= 50 ? "text-[#f5c84c]" : "text-danger"}`}>{r.score}</span><span className="flex-1">{h}</span><span className="text-[10px] text-fog hidden sm:block">{r.formulas[0]?.name}</span></li>)}</ol>}
            </div>
          </div>
          <div className="lg:col-span-2 card p-5 h-fit">
            <p className="font-display font-bold mb-1">26 fórmulas de gancho</p>
            <p className="text-xs text-fog mb-3">Clique para testar a estrutura.</p>
            <ul className="space-y-1 max-h-[560px] overflow-y-auto scroll-thin pr-1">{FORMULAS.map((f, i) => <li key={f.id}><button onClick={() => setHook(f.ex)} className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-panel2"><span className="font-mono text-[10px] text-fog mr-2">{String(i + 1).padStart(2, "0")}</span><span className="text-sm font-semibold">{f.name}</span><p className="text-xs text-fog ml-7">"{f.ex}"</p></button></li>)}</ul>
          </div>
        </div>
      )}

      {tab === "roteiro" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Estrutura</label><select className="input" value={st} onChange={(e) => setSt(e.target.value)}>{Object.entries(STRUCTS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></div>
              <div><label className="label">Duração alvo: {dur}s</label><input type="range" min={7} max={180} step={1} value={dur} onChange={(e) => setDur(+e.target.value)} className="w-full accent-[#6eefb6] mt-3" /></div>
            </div>
            <ol className="space-y-1.5">
              {STRUCTS[st].beats.map(([name, pct, tip]) => { const from = acc; acc += (pct / 100) * dur; return (
                <li key={name} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2.5">
                  <span className="font-mono text-xs text-mint w-[86px] shrink-0">{from.toFixed(0)}s–{acc.toFixed(0)}s</span>
                  <div className="flex-1"><p className="text-sm font-semibold">{name}</p><p className="text-xs text-fog">{tip}</p></div>
                  <span className="text-[10px] text-fog whitespace-nowrap">~{Math.round(((pct / 100) * dur) * WPS)} palavras</span>
                </li>); })}
            </ol>
            <p className="text-xs text-fog">Referência de ritmo: ~{WPS} palavras por segundo de fala em português. O gancho precisa caber nos primeiros 2–3 segundos.</p>
          </div>
          <div className="card p-5">
            <label className="label">Cole o roteiro (só as falas)</label>
            <textarea className="input min-h-[300px]" value={script} onChange={(e) => setScript(e.target.value)} placeholder="Cole aqui o texto falado do vídeo…" />
            {!!words && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="chip">{words} palavras</span><span className={`chip ${Math.abs(est - dur) <= dur * 0.15 ? "chip-mint" : ""}`}>~{est}s de fala</span>
              <span className="text-fog">{est > dur * 1.15 ? `Corte ~${Math.round((est - dur) * WPS)} palavras para caber em ${dur}s.` : est < dur * 0.85 ? "Sobra tempo: dá para respirar ou incluir b-roll." : "Tempo no ponto."}</span></div>}
          </div>
        </div>
      )}

      {tab === "legenda" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="flex justify-between"><label className="label">Legenda</label><span className={`text-xs font-mono ${cl.len > 2200 ? "text-danger" : "text-fog"}`}>{cl.len}/2200</span></div>
            <textarea className="input min-h-[320px]" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Cole a legenda completa…" />
          </div>
          <div className="space-y-5">
            <div className="card p-5">
              <p className="label">Como aparece no feed</p>
              <div className="bg-ink rounded-xl p-4 text-sm border border-line"><span className="font-semibold mr-1.5">vincit</span>{cap ? <>{cap.replace(/\n/g, " ").slice(0, 125)}{cap.length > 125 && <span className="text-fog">… mais</span>}</> : <span className="text-fog">sua legenda aqui</span>}</div>
              <p className="text-xs text-fog mt-2">1ª linha: {cl.first.length} caracteres</p>
            </div>
            <div className="card p-5">
              <ul className="space-y-2 text-sm">{cl.checks.map(([l, ok]) => <li key={l} className="flex items-center gap-2"><Ok ok={ok} />{l}</li>)}</ul>
              <div className="text-xs text-fog mt-4 space-y-1">
                <p>CTAs encontrados: {cl.ctas.length ? cl.ctas.join(", ") : "nenhum"}</p>
                <p>Hashtags: {cl.tags.length ? cl.tags.join(" ") : "nenhuma"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "humanizar" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <label className="label">Texto</label>
            <textarea className="input min-h-[320px]" value={hum} onChange={(e) => setHum(e.target.value)} placeholder="Cole um texto gerado por IA (ou o seu) para checar se soa humano…" />
            <div className="flex gap-2 mt-3"><button disabled={!hum} onClick={() => setHum(clean(hum))} className="btn btn-mint btn-sm">Limpar automaticamente</button><CopyButton text={hum} /></div>
            <p className="text-xs text-fog mt-2">A limpeza troca clichês e travessões. Para reescrita completa, use o agente Humanizar.</p>
          </div>
          <div className="card p-5 h-fit space-y-4">
            <p className="label">Cara de humano</p>
            {hum ? <Meter v={hc.score} /> : <p className="text-fog text-sm">Cole um texto para analisar.</p>}
            {hum && <ul className="space-y-2 text-sm">{hc.checks.map(([l, ok]) => <li key={l} className="flex items-center gap-2"><Ok ok={ok} />{l}</li>)}</ul>}
            {hum && hc.hits > 0 && <p className="text-xs text-fog">{hc.hits} clichê(s) de IA encontrados.</p>}
          </div>
        </div>
      )}
    </>
  );
}
