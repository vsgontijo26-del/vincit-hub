import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gget } from "@/lib/meta";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { account_id } = await req.json();
    const supabase = await createClient();
    const { data: acc } = await supabase.from("ig_accounts").select("*").eq("id", account_id).single();
    if (!acc?.ig_user_id) throw new Error("Conta não conectada à Meta.");
    const { data: token, error } = await supabase.rpc("ig_get_token", { p_account_id: account_id });
    if (error || !token) throw new Error("Token não encontrado. Conecte a conta de novo.");

    const prof = await gget(acc.ig_user_id, { access_token: token, fields: "username,name,profile_picture_url,followers_count,follows_count,media_count" });
    await supabase.from("ig_accounts").update({
      username: prof.username, name: prof.name, profile_picture_url: prof.profile_picture_url,
      followers_count: prof.followers_count, follows_count: prof.follows_count, media_count: prof.media_count, last_synced_at: new Date().toISOString(),
    }).eq("id", account_id);

    const media = await gget(`${acc.ig_user_id}/media`, {
      access_token: token, limit: "30",
      fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
    });

    const rows = await Promise.all((media.data || []).map(async (m: any) => {
      const row: any = {
        owner_id: acc.owner_id, account_id, ig_media_id: m.id,
        media_type: m.media_product_type === "REELS" ? "REELS" : m.media_type,
        caption: m.caption, permalink: m.permalink, thumbnail_url: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : null),
        posted_at: m.timestamp, like_count: m.like_count ?? 0, comments_count: m.comments_count ?? 0,
      };
      for (const metrics of ["reach,saved,shares,views", "reach,saved,shares", "reach,saved"]) {
        try {
          const ins = await gget(`${m.id}/insights`, { access_token: token, metric: metrics });
          for (const it of ins.data || []) {
            const v = it.values?.[0]?.value ?? it.total_value?.value;
            if (it.name === "reach") row.reach = v;
            if (it.name === "saved") row.saved = v;
            if (it.name === "shares") row.shares = v;
            if (it.name === "views") row.plays = v;
          }
          break;
        } catch {}
      }
      return row;
    }));

    if (rows.length) {
      const { error: e3 } = await supabase.from("ig_posts").upsert(rows, { onConflict: "account_id,ig_media_id" });
      if (e3) throw new Error(e3.message);
    }
    return NextResponse.json({ ok: true, posts: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
