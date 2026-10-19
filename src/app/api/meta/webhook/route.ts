import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAnonClient } from "@/lib/supabase/server";
import { GRAPH, gpost, matches } from "@/lib/meta";
import { runFrom, answer, log } from "@/lib/flows";

export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  const body = JSON.parse(raw);
  const db = createAnonClient();
  const secret = process.env.WEBHOOK_DB_SECRET!;

  for (const entry of body.entry || []) {
    const igId = String(entry.id);
    const { data: autos0 } = await db.rpc("wh_get_automations", { p_secret: secret, p_ig_user_id: igId });
    const { data: flows0 } = await db.rpc("wh_get_flows", { p_secret: secret, p_ig_user_id: igId });
    const autos: any[] = autos0 || [], flows: any[] = flows0 || [];
    if (!autos.length && !flows.length) continue;
    const handled = new Set<string>();
    const contactFor = async (f: any, igsid: string, username?: string) => (await db.rpc("wh_contact", { p_secret: secret, p_account_id: f.account_id, p_owner_id: f.owner_id, p_igsid: igsid, p_username: username || null })).data;

    // ── Fluxos (estilo ManyChat) ──
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments") continue;
      const v = ch.value || {};
      if (!v.id || v.from?.id === igId) continue;
      const f = flows.find((x) => x.trigger_type === "comment" && (!x.media_id || x.media_id === v.media?.id) && matches(v.text, x.keywords));
      if (!f) continue;
      handled.add(v.id);
      try {
        const replies = (f.public_replies || []).filter(Boolean);
        if (replies.length) await gpost(`${v.id}/replies`, f.token, { message: replies[Math.floor(Math.random() * replies.length)] });
        const contact = await contactFor(f, v.from?.id, v.from?.username);
        await runFrom({ db, secret, flow: f, contact, commentId: v.id });
        await log({ db, secret }, f.owner_id, f.id, v.from?.username || v.from?.id, "início", "ok", `comentário: ${v.text}`);
      } catch (e: any) { await log({ db, secret }, f.owner_id, f.id, v.from?.username || "", "início", "erro", e.message); }
    }
    for (const m of entry.messaging || []) {
      const text = m.message?.text || "";
      const sender = m.sender?.id;
      if (!sender || m.message?.is_echo || sender === igId) continue;
      const qr: string = m.message?.quick_reply?.payload || "";
      try {
        if (qr.startsWith("F:")) {
          const [, flowId, nodeId] = qr.split(":");
          const f = (await db.rpc("wh_get_flow", { p_secret: secret, p_flow_id: flowId })).data;
          if (f) { const contact = await contactFor(f, sender); await runFrom({ db, secret, flow: f, contact }, nodeId || "__fim__"); handled.add(m.message?.mid); await log({ db, secret }, f.owner_id, f.id, sender, "botão", "ok", text); }
          continue;
        }
        // contato no meio de um fluxo (pergunta ou aguardando resposta)
        for (const f of flows) {
          const contact = await contactFor(f, sender);
          if (contact?.flow_id === f.id && contact.waiting === "question") { await answer({ db, secret, flow: f, contact }, text); handled.add(m.message?.mid); break; }
          if (contact?.flow_id === f.id && contact.waiting === "reply") { const nodes = f.nodes || []; const i = nodes.findIndex((x: any) => x.id === contact.node_id); const nxt = nodes[i]?.next || nodes[i + 1]?.id; if (nxt) { await runFrom({ db, secret, flow: f, contact }, nxt); handled.add(m.message?.mid); } break; }
        }
        if (handled.has(m.message?.mid)) continue;
        const isStory = !!m.message?.reply_to?.story;
        const f = flows.find((x) => (x.trigger_type === "dm" && !isStory && matches(text, x.keywords)) || (x.trigger_type === "story_reply" && isStory && (!x.keywords?.length || matches(text, x.keywords))));
        if (f) {
          const contact = await contactFor(f, sender);
          await runFrom({ db, secret, flow: f, contact });
          handled.add(m.message?.mid);
          await log({ db, secret }, f.owner_id, f.id, sender, "início", "ok", `${isStory ? "resposta ao story" : "direct"}: ${text}`);
        }
      } catch (e: any) { await log({ db, secret }, flows[0]?.owner_id, null, sender, "mensagem", "erro", e.message); }
    }

    // Comentários em posts
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments") continue;
      const v = ch.value || {};
      if (!v.id || v.from?.id === igId || handled.has(v.id)) continue; // ignora os próprios comentários
      for (const a of autos.filter((x: any) => x.trigger_type === "comment")) {
        if (a.media_id && a.media_id !== v.media?.id) continue;
        if (!matches(v.text, a.keywords)) continue;
        const done: string[] = [];
        try {
          if (a.public_reply) { await gpost(`${v.id}/replies`, a.token, { message: a.public_reply }); done.push("resposta"); }
          if (a.dm_message) {
            const text = a.dm_link ? `${a.dm_message}\n\n${a.dm_link}` : a.dm_message;
            await gpost(`${igId}/messages`, a.token, { recipient: { comment_id: v.id }, message: { text } });
            done.push("direct");
          }
          await db.rpc("wh_log", { p_secret: secret, p_automation_id: a.automation_id, p_owner_id: a.owner_id, p_from: v.from?.username || null, p_text: v.text, p_status: "ok", p_detail: done.join(" + ") });
        } catch (e: any) {
          await db.rpc("wh_log", { p_secret: secret, p_automation_id: a.automation_id, p_owner_id: a.owner_id, p_from: v.from?.username || null, p_text: v.text, p_status: "erro", p_detail: e.message });
        }
        break; // uma automação por comentário
      }
    }

    // Mensagens diretas
    for (const m of entry.messaging || []) {
      const text = m.message?.text;
      if (!text || m.message?.is_echo || m.sender?.id === igId || handled.has(m.message?.mid)) continue;
      for (const a of autos.filter((x: any) => x.trigger_type === "dm")) {
        if (!matches(text, a.keywords)) continue;
        try {
          const out = a.dm_link ? `${a.dm_message}\n\n${a.dm_link}` : a.dm_message;
          await gpost(`${igId}/messages`, a.token, { recipient: { id: m.sender.id }, message: { text: out } });
          await db.rpc("wh_log", { p_secret: secret, p_automation_id: a.automation_id, p_owner_id: a.owner_id, p_from: m.sender.id, p_text: text, p_status: "ok", p_detail: "direct" });
        } catch (e: any) {
          await db.rpc("wh_log", { p_secret: secret, p_automation_id: a.automation_id, p_owner_id: a.owner_id, p_from: m.sender.id, p_text: text, p_status: "erro", p_detail: e.message });
        }
        break;
      }
    }
  }
  return NextResponse.json({ ok: true });
}
