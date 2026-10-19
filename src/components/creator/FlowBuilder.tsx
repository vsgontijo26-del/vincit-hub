"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import { useAI } from "@/lib/useAI";
import { I } from "@/components/icons";
import type { FlowNode } from "@/lib/flows";

const uid = () => Math.random().toString(36).slice(2, 8);
const TRIGGERS: Record<string, { l: string; d: string }> = {
  comment: { l: "Comentário com palavra-chave", d: "Alguém comenta a palavra num post → resposta pública + direct" },
  dm: { l: "Direct com palavra-chave", d: "Alguém manda a palavra no direct" },
  story_reply: { l: "Resposta a story", d: "Alguém responde seus stories (com ou sem palavra)" },
};
const NODE_META: Record<FlowNode["type"], { l: string; c: string; d: string }> = {
  message: { l: "Mensagem", c: "#6eefb6", d: "Texto, link e botões de resposta" },
  question: { l: "Pergunta", c: "#7aa7ff", d: "Pergunta e guarda a resposta (e-mail, telefone…)" },
  delay: { l: "Esperar", c: "#f5c84c", d: "Pausa antes da próxima etapa" },
  tag: { l: "Etiqueta", c: "#c084fc", d: "Marca o contato (ex.: lead-quente)" },
};
const TEMPLATES: { l: string; d: string; make: () => Partial<any> }[] = [
  { l: "Isca digital", d: "Comentou a palavra → recebe o material + pede e-mail", make: () => {
    const a = uid(), b = uid(), c = uid();
    return { trigger_type: "comment", keywords: ["QUERO"], public_replies: ["Te mandei no direct! 📩", "Enviado, confere seu direct 😉", "Corre no direct que já tá lá!"], nodes: [
      { id: a, type: "message", text: "Oi {nome}! Que bom que você quer o material 🙌 Clica no botão que eu te mando agora.", buttons: [{ label: "Quero receber", next: b }] },
      { id: b, type: "message", text: "Aqui está 👇", link: { label: "Acesse", url: "https://" } },
      { id: c, type: "question", text: "Quer receber os próximos materiais por e-mail? Me manda seu melhor e-mail.", field: "email" },
      { id: uid(), type: "tag", tag: "lead-isca" },
      { id: uid(), type: "message", text: "Perfeito, anotado! Qualquer dúvida é só chamar aqui." },
    ] };
  } },
  { l: "Qualificar orçamento", d: "Direct com ORÇAMENTO → perguntas → avisa a equipe", make: () => {
    const a = uid(), b = uid(), c = uid();
    return { trigger_type: "dm", keywords: ["ORÇAMENTO", "ORCAMENTO", "PREÇO"], public_replies: [], nodes: [
      { id: a, type: "message", text: "Oi {nome}! Vou te fazer 3 perguntas rápidas para montar seu orçamento. Qual tipo de vídeo você precisa?", buttons: [{ label: "Institucional", next: b }, { label: "Conteúdo mensal", next: b }, { label: "Evento", next: b }] },
      { id: b, type: "question", text: "Para quando você precisa?", field: "prazo" },
      { id: c, type: "question", text: "E qual seu WhatsApp com DDD? Nossa equipe te chama por lá.", field: "telefone" },
      { id: uid(), type: "tag", tag: "orcamento" },
      { id: uid(), type: "message", text: "Recebido! Em até 1 dia útil a gente te chama no WhatsApp com a proposta. 🎬" },
    ] };
  } },
  { l: "Resposta a story", d: "Respondeu o story → conversa + oferta", make: () => ({ trigger_type: "story_reply", keywords: [], public_replies: [], nodes: [
    { id: uid(), type: "message", text: "Valeu por responder, {nome}! 💚 Quer que eu te mostre como a gente faz isso para marcas?", buttons: [{ label: "Quero ver" }, { label: "Agora não", next: "__fim__" }] },
    { id: uid(), type: "message", text: "Olha esse case 👇", link: { label: "Case", url: "https://" } },
  ] }) },
];

function nodeSummary(n: FlowNode) {
  if (n.type === "message") return n.text?.slice(0, 60) || "(vazia)";
  if (n.type === "question") return `${n.text?.slice(0, 40) || ""} → salva em "${n.field}"`;
  if (n.type === "delay") return `${n.minutes} min`;
  return n.tag;
}

function Preview({ flow }: { flow: any }) {
  const nodes: FlowNode[] = flow.nodes || [];
  const [chat, setChat] = useState<{ me: boolean; t: string; btns?: { label: string; next?: string }[] }[]>([]);
  const [wait, setWait] = useState<FlowNode | null>(null);
  const [input, setInput] = useState("");
  const nextOf = (n: FlowNode) => n.next || nodes[nodes.findIndex((x) => x.id === n.id) + 1]?.id;
  const run = useCallback((id?: string, acc: any[] = []) => {
    let n = nodes.find((x) => x.id === id) || (id ? undefined : nodes[0]); let g = 0; const out = [...acc];
    while (n && g++ < 12) {
      if (n.type === "tag") { out.push({ me: false, t: `🏷️ etiqueta “${n.tag}”` }); n = nodes.find((x) => x.id === nextOf(n!)); continue; }
      if (n.type === "delay") { out.push({ me: false, t: `⏱️ espera ${n.minutes} min` }); n = nodes.find((x) => x.id === nextOf(n!)); continue; }
      if (n.type === "question") { out.push({ me: false, t: n.text }); setWait(n); setChat(out); return; }
      const nxt = nextOf(n);
      out.push({ me: false, t: n.text.replace(/\{nome\}/g, "@cliente") + (n.link?.url ? `\n\n${n.link.label}: ${n.link.url}` : ""), btns: (n.buttons || []).map((b) => ({ ...b, next: b.next || nxt })) });
      if (n.buttons?.length) { setWait(null); setChat(out); return; }
      n = nodes.find((x) => x.id === nxt);
    }
    out.push({ me: false, t: "— fim do fluxo —" }); setWait(null); setChat(out);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(undefined, flow.trigger_type === "comment" ? [{ me: true, t: `(comentou) ${flow.keywords?.[0] || ""}` }] : [{ me: true, t: flow.keywords?.[0] || "oi" }]); }, [flow, run]);
  return (
    <div className="bg-ink rounded-2xl border border-line p-3 h-[460px] flex flex-col">
      <p className="text-[11px] text-fog text-center mb-2">Pré-visualização</p>
      <div className="flex-1 overflow-y-auto scroll-thin space-y-2 pr-1">
        {chat.map((m, i) => (
          <div key={i} className={`flex ${m.me ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] text-[13px] rounded-2xl px-3 py-2 whitespace-pre-wrap ${m.me ? "bg-[#3797f0] text-white" : m.t.startsWith("🏷️") || m.t.startsWith("⏱️") || m.t.startsWith("—") ? "text-fog text-[11px] bg-transparent" : "bg-panel2"}`}>
              {m.t}
              {m.btns && <div className="flex flex-wrap gap-1 mt-2">{m.btns.map((b, k) => <button key={k} onClick={() => run(b.next === "__fim__" ? "__x__" : b.next, [...chat.slice(0, i + 1).map((x) => ({ ...x, btns: undefined })), { me: true, t: b.label }])} className="text-[12px] border border-[#3797f0] text-[#3797f0] rounded-full px-2.5 py-0.5">{b.label}</button>)}</div>}
            </div>
          </div>
        ))}
      </div>
      {wait && <form onSubmit={(e) => { e.preventDefault(); if (!input) return; const t = input; setInput(""); run(nextOf(wait), [...chat, { me: true, t }]); }} className="flex gap-2 mt-2"><input className="input !py-1.5 text-sm" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Responder…" /><button className="btn btn-mint btn-sm">↵</button></form>}
    </div>
  );
}

export default function FlowBuilder() {
  const { accounts } = useAccounts();
  const [flows, setFlows] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [ed, setEd] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ai = useAI();
  const connected = accounts.filter((a) => a.connected);

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: f }, { data: l }] = await Promise.all([
      s.from("dm_flows").select("*, ig_accounts(username)").order("created_at", { ascending: false }),
      s.from("dm_flow_logs").select("*, dm_flows(name)").order("created_at", { ascending: false }).limit(25),
    ]);
    setFlows(f || []); setLogs(l || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!ed?.account_id) return;
    createClient().from("ig_posts").select("ig_media_id,caption,posted_at").eq("account_id", ed.account_id).order("posted_at", { ascending: false }).limit(30).then(({ data }) => setPosts(data || []));
  }, [ed?.account_id]);

  function startNew(t?: (typeof TEMPLATES)[number]) {
    setErr(null); setSaved(false);
    setEd({ name: t ? t.l : "Novo fluxo", account_id: connected[0]?.id || accounts[0]?.id || "", active: false, trigger_type: "comment", keywords: [], media_id: "", public_replies: [""], nodes: [{ id: uid(), type: "message", text: "Oi {nome}! 👋" }], ...(t ? t.make() : {}) });
  }
  const setNode = (id: string, patch: any) => setEd({ ...ed, nodes: ed.nodes.map((n: any) => (n.id === id ? { ...n, ...patch } : n)) });
  const addNode = (type: FlowNode["type"], after?: number) => {
    const n: any = type === "message" ? { id: uid(), type, text: "" } : type === "question" ? { id: uid(), type, text: "", field: "email" } : type === "delay" ? { id: uid(), type, minutes: 60 } : { id: uid(), type, tag: "" };
    const nodes = [...ed.nodes]; nodes.splice(after == null ? nodes.length : after + 1, 0, n); setEd({ ...ed, nodes });
  };
  const move = (i: number, d: number) => { const nodes = [...ed.nodes]; const j = i + d; if (j < 0 || j >= nodes.length) return; [nodes[i], nodes[j]] = [nodes[j], nodes[i]]; setEd({ ...ed, nodes }); };
  const delNode = (id: string) => setEd({ ...ed, nodes: ed.nodes.filter((n: any) => n.id !== id).map((n: any) => ({ ...n, next: n.next === id ? undefined : n.next, buttons: n.buttons?.map((b: any) => (b.next === id ? { ...b, next: undefined } : b)) })) });

  async function save(activate?: boolean) {
    setErr(null);
    if (!ed.account_id) return setErr("Escolha o perfil.");
    if (ed.trigger_type !== "story_reply" && !ed.keywords.length) return setErr("Defina ao menos uma palavra-chave.");
    if (!ed.nodes.length) return setErr("Adicione ao menos uma etapa.");
    const row = { account_id: ed.account_id, name: ed.name, trigger_type: ed.trigger_type, keywords: ed.keywords, media_id: ed.trigger_type === "comment" ? ed.media_id || null : null, public_replies: (ed.public_replies || []).filter((x: string) => x?.trim()), nodes: ed.nodes, active: activate ?? ed.active, updated_at: new Date().toISOString() };
    const s = createClient();
    const res = ed.id ? await s.from("dm_flows").update(row).eq("id", ed.id).select().single() : await s.from("dm_flows").insert(row).select().single();
    if (res.error) return setErr(res.error.message);
    setEd({ ...ed, ...res.data }); setSaved(true); setTimeout(() => setSaved(false), 1800); load();
  }
  async function toggle(f: any) { await createClient().from("dm_flows").update({ active: !f.active }).eq("id", f.id); load(); }
  async function del(f: any) { if (!confirm(`Excluir o fluxo "${f.name}"?`)) return; await createClient().from("dm_flows").delete().eq("id", f.id); setEd(null); load(); }
  async function aiText(n: any) {
    const acc = accounts.find((a) => a.id === ed.account_id);
    const r = await ai.run<{ text: string }>("agent", { agent: "direct", input: `Escreva só o texto de UMA mensagem curta (até 300 caracteres) para esta etapa de um fluxo automático de direct. Contexto do fluxo: ${ed.name}. Gatilho: ${TRIGGERS[ed.trigger_type].l} (${ed.keywords.join(", ")}). Etapa: ${n.type === "question" ? "pergunta para coletar " + n.field : "mensagem"}. Texto atual: ${n.text || "(vazio)"}. Responda apenas com o texto final, sem títulos.`, account: acc });
    if (r) setNode(n.id, { text: r.text.replace(/^["#\s*]+|["\s]+$/g, "").slice(0, 600) });
  }

  const nodeOpts = useMemo(() => (ed?.nodes || []).map((n: any, i: number) => ({ id: n.id, l: `${i + 1}. ${NODE_META[n.type as FlowNode["type"]].l}: ${nodeSummary(n).slice(0, 28)}` })), [ed?.nodes]);

  if (ed) return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEd(null)} className="btn btn-ghost btn-sm"><I.back className="w-4 h-4" />Fluxos</button>
        <input className="input !w-64 font-semibold" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} />
        <select className="input !w-auto" value={ed.account_id} onChange={(e) => setEd({ ...ed, account_id: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}{a.connected ? "" : " (não conectado)"}</option>)}</select>
        <div className="ml-auto flex gap-2 items-center">
          {saved && <span className="text-xs text-mint">Salvo ✓</span>}
          {ed.id && <button onClick={() => del(ed)} className="btn btn-ghost btn-sm"><I.trash className="w-4 h-4" /></button>}
          <button onClick={() => save()} className="btn btn-ghost btn-sm">Salvar</button>
          <button onClick={() => save(!ed.active)} className={`btn btn-sm ${ed.active ? "btn-ghost text-danger" : "btn-mint"}`}>{ed.active ? "Pausar" : "Salvar e ativar"}</button>
        </div>
      </div>
      {err && <p className="text-danger text-sm">{err}</p>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div>
          {/* gatilho */}
          <div className="card p-4 border-mint-dim">
            <p className="text-[10px] uppercase tracking-widest text-mint mb-2">Quando</p>
            <div className="grid sm:grid-cols-3 gap-2 mb-3">{Object.entries(TRIGGERS).map(([k, t]) => <button key={k} onClick={() => setEd({ ...ed, trigger_type: k })} className={`text-left rounded-xl border p-3 ${ed.trigger_type === k ? "border-mint bg-mint/10" : "border-line hover:border-slate"}`}><p className="text-sm font-semibold">{t.l}</p><p className="text-[11px] text-fog mt-0.5">{t.d}</p></button>)}</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><label className="label">Palavras-chave {ed.trigger_type === "story_reply" && "(opcional)"}</label><input className="input" value={ed.keywords.join(", ")} onChange={(e) => setEd({ ...ed, keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="QUERO, LINK, EU" /></div>
              {ed.trigger_type === "comment" && <div><label className="label">Em qual post</label><select className="input" value={ed.media_id || ""} onChange={(e) => setEd({ ...ed, media_id: e.target.value })}><option value="">Qualquer post</option>{posts.map((p) => <option key={p.ig_media_id} value={p.ig_media_id}>{(p.caption || "(sem legenda)").slice(0, 60)}</option>)}</select></div>}
              {ed.trigger_type === "comment" && <div className="md:col-span-2"><label className="label">Respostas públicas no comentário (sorteia uma, para não parecer robô)</label>
                <div className="space-y-1.5">{(ed.public_replies || []).map((r: string, i: number) => <div key={i} className="flex gap-2"><input className="input !py-1.5" value={r} onChange={(e) => { const p = [...ed.public_replies]; p[i] = e.target.value; setEd({ ...ed, public_replies: p }); }} placeholder="Te mandei no direct! 📩" /><button onClick={() => setEd({ ...ed, public_replies: ed.public_replies.filter((_: any, j: number) => j !== i) })} className="text-fog hover:text-danger px-2">×</button></div>)}
                  <button onClick={() => setEd({ ...ed, public_replies: [...(ed.public_replies || []), ""] })} className="text-xs text-fog hover:text-mint">+ variação</button></div></div>}
            </div>
          </div>

          {/* etapas */}
          {ed.nodes.map((n: any, i: number) => {
            const m = NODE_META[n.type as FlowNode["type"]];
            return (
              <div key={n.id}>
                <div className="flex justify-center"><div className="w-px h-6 bg-line" /></div>
                <div className="card p-4" style={{ borderLeft: `3px solid ${m.c}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono text-[11px] text-fog">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: m.c }}>{m.l}</span>
                    <div className="ml-auto flex items-center gap-1 text-fog">
                      {(n.type === "message" || n.type === "question") && <button onClick={() => aiText(n)} disabled={ai.busy} className="text-xs hover:text-mint px-1" title="Escrever com IA">✨</button>}
                      <button onClick={() => move(i, -1)} className="hover:text-paper px-1">▲</button><button onClick={() => move(i, 1)} className="hover:text-paper px-1">▼</button>
                      <button onClick={() => delNode(n.id)} className="hover:text-danger px-1"><I.trash className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {(n.type === "message" || n.type === "question") && <textarea className="input min-h-[70px]" value={n.text} onChange={(e) => setNode(n.id, { text: e.target.value })} placeholder={n.type === "question" ? "Qual seu melhor e-mail?" : "Texto da mensagem. Use {nome} para o @ da pessoa."} maxLength={1000} />}
                  {n.type === "message" && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-[1fr_2fr] gap-2"><input className="input !py-1.5 text-sm" value={n.link?.label || ""} onChange={(e) => setNode(n.id, { link: { ...(n.link || {}), label: e.target.value } })} placeholder="Texto do link (opcional)" /><input className="input !py-1.5 text-sm" value={n.link?.url || ""} onChange={(e) => setNode(n.id, { link: { ...(n.link || {}), url: e.target.value } })} placeholder="https://…" /></div>
                      {(n.buttons || []).map((b: any, k: number) => (
                        <div key={k} className="flex gap-2 items-center">
                          <span className="text-[10px] text-fog w-12">Botão {k + 1}</span>
                          <input className="input !py-1.5 text-sm" maxLength={20} value={b.label} onChange={(e) => setNode(n.id, { buttons: n.buttons.map((x: any, j: number) => (j === k ? { ...x, label: e.target.value } : x)) })} placeholder="Até 20 caracteres" />
                          <select className="input !py-1.5 text-sm" value={b.next || ""} onChange={(e) => setNode(n.id, { buttons: n.buttons.map((x: any, j: number) => (j === k ? { ...x, next: e.target.value || undefined } : x)) })}><option value="">→ próxima etapa</option>{nodeOpts.filter((o: any) => o.id !== n.id).map((o: any) => <option key={o.id} value={o.id}>→ {o.l}</option>)}<option value="__fim__">→ encerrar</option></select>
                          <button onClick={() => setNode(n.id, { buttons: n.buttons.filter((_: any, j: number) => j !== k) })} className="text-fog hover:text-danger px-1">×</button>
                        </div>
                      ))}
                      {(n.buttons || []).length < 13 && <button onClick={() => setNode(n.id, { buttons: [...(n.buttons || []), { label: "" }] })} className="text-xs text-fog hover:text-mint">+ botão de resposta rápida</button>}
                    </div>
                  )}
                  {n.type === "question" && <div className="mt-2 flex items-center gap-2 text-sm"><span className="text-fog">Salvar resposta em</span><select className="input !py-1.5 !w-auto" value={["email", "telefone", "nome", "prazo"].includes(n.field) ? n.field : "custom"} onChange={(e) => setNode(n.id, { field: e.target.value === "custom" ? "resposta" : e.target.value })}><option value="email">e-mail (valida)</option><option value="telefone">telefone (valida)</option><option value="nome">nome</option><option value="prazo">prazo</option><option value="custom">outro campo…</option></select>{!["email", "telefone", "nome", "prazo"].includes(n.field) && <input className="input !py-1.5 !w-36" value={n.field} onChange={(e) => setNode(n.id, { field: e.target.value.replace(/\W/g, "") })} />}</div>}
                  {n.type === "delay" && <div className="flex items-center gap-2 text-sm"><span className="text-fog">Esperar</span><input type="number" min={1} className="input !py-1.5 !w-24" value={n.minutes} onChange={(e) => setNode(n.id, { minutes: Number(e.target.value) || 1 })} /><span className="text-fog">minutos ({n.minutes >= 60 ? `${(n.minutes / 60).toFixed(1)} h` : "—"})</span></div>}
                  {n.type === "tag" && <input className="input !py-1.5" value={n.tag} onChange={(e) => setNode(n.id, { tag: e.target.value })} placeholder="ex.: lead-quente" />}
                  {n.type !== "message" || !(n.buttons || []).length ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-fog"><span>Depois:</span><select className="input !py-1 !w-auto text-xs" value={n.next || ""} onChange={(e) => setNode(n.id, { next: e.target.value || undefined })}><option value="">próxima etapa</option>{nodeOpts.filter((o: any) => o.id !== n.id).map((o: any) => <option key={o.id} value={o.id}>{o.l}</option>)}<option value="__fim__">encerrar</option></select></div>
                  ) : <p className="mt-2 text-[11px] text-fog">O fluxo espera a pessoa tocar num botão.</p>}
                </div>
              </div>
            );
          })}
          <div className="flex justify-center"><div className="w-px h-6 bg-line" /></div>
          <div className="card p-3 flex flex-wrap gap-2 justify-center">{(Object.keys(NODE_META) as FlowNode["type"][]).map((t) => <button key={t} onClick={() => addNode(t)} className="btn btn-ghost btn-sm" title={NODE_META[t].d}><span className="w-2 h-2 rounded-full" style={{ background: NODE_META[t].c }} />+ {NODE_META[t].l}</button>)}</div>
          {ed.trigger_type === "comment" && <p className="text-[11px] text-fog mt-3">Regra do Instagram: pelo comentário só dá para mandar 1 mensagem até a pessoa responder. Por isso a primeira mensagem sai com um botão — quando ela toca, a conversa abre e o resto do fluxo continua.</p>}
        </div>
        <div className="lg:sticky lg:top-4 self-start"><Preview flow={ed} /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {!connected.length && <div className="card p-4 text-sm border-[#f5c84c]/40"><b className="text-[#f5c84c]">Conecte um perfil pela Meta</b> em Perfis para os fluxos funcionarem de verdade. Você já pode montar e testar na pré-visualização.</div>}
      <div className="grid md:grid-cols-4 gap-3">
        <button onClick={() => startNew()} className="card p-4 text-left border-dashed hover:border-mint"><I.plus className="w-5 h-5 text-mint" /><p className="font-semibold mt-2">Fluxo em branco</p><p className="text-xs text-fog mt-1">Monte etapa por etapa</p></button>
        {TEMPLATES.map((t) => <button key={t.l} onClick={() => startNew(t)} className="card p-4 text-left hover:border-slate"><I.bolt className="w-5 h-5 text-mint" /><p className="font-semibold mt-2">{t.l}</p><p className="text-xs text-fog mt-1">{t.d}</p></button>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-fog text-xs border-b border-line">{["Fluxo", "Gatilho", "Etapas", "Disparos", "Status", ""].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id} className="border-b border-line/60 hover:bg-panel2/50">
                <td className="p-3 cursor-pointer" onClick={() => { setErr(null); setEd(f); }}><p className="font-medium">{f.name}</p><p className="text-xs text-fog">@{f.ig_accounts?.username}</p></td>
                <td className="p-3 text-fog text-xs">{TRIGGERS[f.trigger_type]?.l}{f.keywords?.length ? ` · ${f.keywords.join(", ")}` : ""}</td>
                <td className="p-3 font-mono text-xs">{(f.nodes || []).length}</td>
                <td className="p-3 font-mono text-xs">{f.runs_count}</td>
                <td className="p-3"><button onClick={() => toggle(f)} className={`chip ${f.active ? "chip-mint" : ""}`}>{f.active ? "Ativo" : "Pausado"}</button></td>
                <td className="p-3 text-right"><button onClick={() => { setErr(null); setEd(f); }} className="btn btn-ghost btn-sm">Editar</button></td>
              </tr>
            ))}
            {!flows.length && <tr><td colSpan={6} className="p-8 text-center text-fog">Nenhum fluxo ainda. Comece por um modelo acima.</td></tr>}
          </tbody>
        </table>
      </div>
      {!!logs.length && <div className="card p-4"><p className="font-display font-bold mb-2">Atividade recente</p><ul className="space-y-1 text-xs">{logs.map((l) => <li key={l.id} className="flex gap-3"><span className="text-fog w-28 shrink-0">{new Date(l.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span><span className={l.status === "ok" ? "text-mint" : "text-danger"}>{l.status}</span><span className="truncate">{l.dm_flows?.name} · {l.event} · {l.contact} {l.detail ? `· ${l.detail}` : ""}</span></li>)}</ul></div>}
    </div>
  );
}
