import { gpost, gget } from "@/lib/meta";

/** Tipos de etapas do fluxo (estilo ManyChat) */
export type FlowNode =
  | { id: string; type: "message"; text: string; buttons?: { label: string; next?: string }[]; link?: { label: string; url: string }; next?: string }
  | { id: string; type: "question"; text: string; field: string; next?: string }
  | { id: string; type: "delay"; minutes: number; next?: string }
  | { id: string; type: "tag"; tag: string; next?: string };

export const NODE_LABEL: Record<FlowNode["type"], string> = { message: "Mensagem", question: "Pergunta", delay: "Esperar", tag: "Etiqueta" };

type Db = { rpc: (fn: string, args: any) => any };
type Ctx = { db: Db; secret: string; flow: any; contact: any; commentId?: string };

const nextOf = (nodes: FlowNode[], n: FlowNode) => n.next || nodes[nodes.findIndex((x) => x.id === n.id) + 1]?.id;
const fill = (t: string, c: any) => (t || "").replace(/\{nome\}/gi, c.username ? `@${c.username}` : "").replace(/\{(\w+)\}/g, (_, k) => c.fields?.[k] ?? "");

async function send(ctx: Ctx, text: string, quick?: { title: string; payload: string }[]) {
  const { flow, contact, commentId } = ctx;
  const recipient = commentId ? { comment_id: commentId } : { id: contact.igsid };
  const message: any = { text };
  if (quick?.length) message.quick_replies = quick.slice(0, 13).map((q) => ({ content_type: "text", title: q.title.slice(0, 20), payload: q.payload }));
  await gpost(`${flow.ig_user_id}/messages`, flow.token, { recipient, message });
}

const setContact = (ctx: Ctx, patch: any) => ctx.db.rpc("wh_contact_set", { p_secret: ctx.secret, p_id: ctx.contact.id, p_patch: patch });
export const log = (ctx: { db: Db; secret: string }, owner: string, flowId: string | null, contact: string, event: string, status: string, detail = "") =>
  ctx.db.rpc("wh_flow_log", { p_secret: ctx.secret, p_owner_id: owner, p_flow_id: flowId, p_contact: contact, p_event: event, p_status: status, p_detail: detail });

/** Executa o fluxo a partir de uma etapa até precisar esperar (resposta, pergunta ou tempo) */
export async function runFrom(ctx: Ctx, nodeId?: string) {
  const nodes: FlowNode[] = ctx.flow.nodes || [];
  let n = nodes.find((x) => x.id === nodeId) || (nodeId ? undefined : nodes[0]);
  let guard = 0;
  while (n && guard++ < 12) {
    if (n.type === "tag") { await setContact(ctx, { add_tag: n.tag }); n = nodes.find((x) => x.id === nextOf(nodes, n!)); continue; }
    if (n.type === "delay") {
      await setContact(ctx, { flow_id: ctx.flow.id, node_id: nextOf(nodes, n) || "", waiting: "delay", wait_until: new Date(Date.now() + Math.max(1, n.minutes) * 60000).toISOString() });
      return;
    }
    if (n.type === "question") {
      await send(ctx, fill(n.text, ctx.contact));
      await setContact(ctx, { flow_id: ctx.flow.id, node_id: n.id, waiting: "question" });
      return;
    }
    // mensagem
    const nxt = nextOf(nodes, n);
    let text = fill(n.text, ctx.contact);
    if (n.link?.url) text += `\n\n${n.link.label ? n.link.label + ": " : ""}${n.link.url}`;
    let quick = (n.buttons || []).filter((b) => b.label).map((b) => ({ title: b.label, payload: `F:${ctx.flow.id}:${b.next || nxt || ""}` }));
    // pelo comentário só cabe 1 mensagem até a pessoa responder: oferece um botão para continuar
    if (ctx.commentId && !quick.length && nxt) quick = [{ title: "Quero ver", payload: `F:${ctx.flow.id}:${nxt}` }];
    await send(ctx, text, quick);
    if (quick.length) { await setContact(ctx, { flow_id: ctx.flow.id, node_id: n.id, waiting: "reply" }); return; }
    ctx.commentId = undefined;
    n = nodes.find((x) => x.id === nxt);
  }
  await setContact(ctx, { flow_id: "", node_id: "", waiting: "" });
}

/** Resposta de texto a uma pergunta pendente */
export async function answer(ctx: Ctx, text: string) {
  const nodes: FlowNode[] = ctx.flow.nodes || [];
  const n = nodes.find((x) => x.id === ctx.contact.node_id);
  if (!n || n.type !== "question") return runFrom(ctx, undefined);
  const v = text.trim();
  if (n.field === "email" && !/^\S+@\S+\.\S+$/.test(v)) { await send(ctx, "Hmm, não parece um e-mail válido. Pode mandar de novo?"); return; }
  if (n.field === "telefone" && v.replace(/\D/g, "").length < 10) { await send(ctx, "Me manda o número com DDD, por favor 🙂"); return; }
  await setContact(ctx, { set_field: { [n.field || "resposta"]: v } });
  ctx.contact.fields = { ...(ctx.contact.fields || {}), [n.field || "resposta"]: v };
  const nxt = nextOf(nodes, n);
  if (nxt) await runFrom(ctx, nxt); else await setContact(ctx, { flow_id: "", node_id: "", waiting: "" });
}

/* ─────────────── Publicação agendada (Content Publishing API) ─────────────── */
export async function publishStep(post: any): Promise<Record<string, any>> {
  const ig = post.ig_user_id, token = post.token;
  const isVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u);
  if (post.status === "agendado") {
    let creation: string;
    const urls: string[] = post.media_urls || [];
    if (!urls.length) throw new Error("Sem mídia");
    if (post.kind === "carousel") {
      const children: string[] = [];
      for (const u of urls.slice(0, 10)) {
        const c = await gpost(`${ig}/media`, token, isVideo(u) ? { media_type: "VIDEO", video_url: u, is_carousel_item: true } : { image_url: u, is_carousel_item: true });
        children.push(c.id);
      }
      creation = (await gpost(`${ig}/media`, token, { media_type: "CAROUSEL", children: children.join(","), caption: post.caption || "" })).id;
    } else if (post.kind === "reels") {
      creation = (await gpost(`${ig}/media`, token, { media_type: "REELS", video_url: urls[0], caption: post.caption || "", share_to_feed: true, ...(post.cover_url ? { cover_url: post.cover_url } : {}) })).id;
    } else if (post.kind === "story") {
      creation = (await gpost(`${ig}/media`, token, isVideo(urls[0]) ? { media_type: "STORIES", video_url: urls[0] } : { media_type: "STORIES", image_url: urls[0] })).id;
    } else {
      creation = (await gpost(`${ig}/media`, token, { image_url: urls[0], caption: post.caption || "" })).id;
    }
    post = { ...post, container_id: creation, status: "publicando" };
  }
  // contêiner pronto? (vídeos levam alguns minutos para processar)
  const st = await gget(post.container_id, { access_token: token, fields: "status_code,status" });
  if (st.status_code === "ERROR" || st.status_code === "EXPIRED") return { status: "erro", error: st.status || "Erro ao processar a mídia no Instagram", container_id: post.container_id };
  if (st.status_code !== "FINISHED") return { status: "publicando", container_id: post.container_id };
  const pub = await gpost(`${ig}/media_publish`, token, { creation_id: post.container_id });
  let permalink = "";
  try { permalink = (await gget(pub.id, { access_token: token, fields: "permalink" })).permalink; } catch {}
  return { status: "publicado", ig_media_id: pub.id, permalink, container_id: post.container_id, error: "" };
}
