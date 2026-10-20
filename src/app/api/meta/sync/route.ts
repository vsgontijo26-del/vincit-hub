import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gget, mediaRow, MEDIA_FIELDS } from "@/lib/meta";

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
      fields: MEDIA_FIELDS,
    });

    const rows = await Promise.all((media.data || []).map((m: any) => mediaRow(m, token, { owner_id: acc.owner_id, account_id })));

    if (rows.length) {
      const { error: e3 } = await supabase.from("ig_posts").upsert(rows, { onConflict: "account_id,ig_media_id" });
      if (e3) throw new Error(e3.message);
    }
    return NextResponse.json({ ok: true, posts: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
