import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { runFrom, log, publishStep } from "@/lib/flows";
import { gget, mediaRow, MEDIA_FIELDS } from "@/lib/meta";

export const maxDuration = 300;

/** Chamado a cada minuto pelo agendador do banco (pg_cron): continua fluxos em espera, publica posts agendados e, uma vez por hora, analisa posts com 7 dias */
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_DB_SECRET!;
  const h = (v: string) => createHash("sha256").update(v).digest();
  if (!secret || !timingSafeEqual(h(req.headers.get("x-cron-secret") || ""), h(secret))) return new Response("forbidden", { status: 403 });
  const db = createServiceClient();
  const { data, error } = await db.rpc("wh_due", { p_secret: secret });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const out = { contacts: 0, posts: 0, analyzed: 0 };

  for (const c of data?.contacts || []) {
    try {
      const flow = (await db.rpc("wh_get_flow", { p_secret: secret, p_flow_id: c.flow_id })).data;
      if (!flow) { await db.rpc("wh_contact_set", { p_secret: secret, p_id: c.id, p_patch: { flow_id: "", node_id: "", waiting: "" } }); continue; }
      await db.rpc("wh_contact_set", { p_secret: secret, p_id: c.id, p_patch: { waiting: "" } });
      if (c.node_id) await runFrom({ db, secret, flow, contact: c }, c.node_id);
      out.contacts++;
    } catch (e: any) { await log({ db, secret }, c.owner_id, c.flow_id, c.username || c.igsid, "espera", "erro", e.message); }
  }

  for (const p of data?.posts || []) {
    try {
      const patch = await publishStep(p);
      await db.rpc("wh_post_set", { p_secret: secret, p_id: p.id, p_patch: patch });
      out.posts++;
    } catch (e: any) {
      await db.rpc("wh_post_set", { p_secret: secret, p_id: p.id, p_patch: { status: "erro", error: e.message } });
    }
  }
  // Publicado há 7+ dias → puxa as métricas e move o conteúdo para Analisado (uma vez por hora)
  if (new Date().getUTCMinutes() === 0) {
    const { data: due } = await db.rpc("wh_analysis_due", { p_secret: secret }); // ausente até a migração da Produção: ignora
    for (const c of due || []) {
      try {
        const m = await gget(c.ig_media_id, { access_token: c.token, fields: MEDIA_FIELDS });
        const row = await mediaRow(m, c.token, { owner_id: c.owner_id, account_id: c.account_id });
        const { error: e } = await db.rpc("wh_analysis_done", { p_secret: secret, p_idea_id: c.idea_id, p_row: row });
        if (!e) out.analyzed++;
      } catch {} // post apagado ou token expirado: tenta de novo na próxima hora
    }
  }
  return NextResponse.json(out);
}
