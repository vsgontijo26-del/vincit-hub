import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { gget, GRAPH } from "@/lib/meta";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/creator/perfis?${q}`);
  try {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const jar = await cookies();
    if (!code) return back(`erro=${encodeURIComponent(url.searchParams.get("error_description") || "Conexão cancelada.")}`);
    if (!state || state !== jar.get("meta_state")?.value) return back(`erro=${encodeURIComponent("Sessão de conexão expirada. Tente de novo.")}`);

    const appId = process.env.META_APP_ID!, secret = process.env.META_APP_SECRET!;
    const short = await gget("oauth/access_token", { client_id: appId, client_secret: secret, redirect_uri: `${origin}/api/meta/callback`, code });
    const long = await gget("oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: short.access_token });

    const pages = await gget("me/accounts", {
      access_token: long.access_token,
      fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}",
      limit: "100",
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${origin}/login`);

    let n = 0;
    for (const p of pages.data || []) {
      const ig = p.instagram_business_account;
      if (!ig) continue;
      const { data: acc, error } = await supabase.from("ig_accounts").upsert({
        owner_id: user.id, ig_user_id: ig.id, username: ig.username, name: ig.name, profile_picture_url: ig.profile_picture_url,
        followers_count: ig.followers_count, follows_count: ig.follows_count, media_count: ig.media_count, connected: true,
      }, { onConflict: "owner_id,username" }).select().single();
      if (error) throw new Error(error.message);
      const { error: e2 } = await supabase.rpc("ig_save_token", { p_account_id: acc.id, p_page_id: p.id, p_token: p.access_token, p_expires: null });
      if (e2) throw new Error(e2.message);
      // Inscreve a página no webhook do app (necessário para receber comentários/mensagens)
      try {
        await fetch(`${GRAPH}/${p.id}/subscribed_apps?subscribed_fields=feed&access_token=${encodeURIComponent(p.access_token)}`, { method: "POST" });
      } catch {}
      n++;
    }
    if (!n) return back(`erro=${encodeURIComponent("Nenhuma conta Profissional do Instagram vinculada a uma Página do Facebook foi encontrada.")}`);
    return back(`conectado=${n}`);
  } catch (e: any) {
    return back(`erro=${encodeURIComponent(e.message || "Falha ao conectar")}`);
  }
}
