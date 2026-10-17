import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAnonClient } from "@/lib/supabase/server";
import { GRAPH, gpost, matches } from "@/lib/meta";

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
    const { data: autos } = await db.rpc("wh_get_automations", { p_secret: secret, p_ig_user_id: igId });
    if (!autos?.length) continue;

    // Comentários em posts
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments") continue;
      const v = ch.value || {};
      if (!v.id || v.from?.id === igId) continue; // ignora os próprios comentários
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
      if (!text || m.message?.is_echo || m.sender?.id === igId) continue;
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
