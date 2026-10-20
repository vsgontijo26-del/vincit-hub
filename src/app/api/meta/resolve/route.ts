import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { igToken } from "@/lib/tokens";
import { gget, mediaRow, shortcodeFrom, MEDIA_FIELDS } from "@/lib/meta";

export const maxDuration = 60;

/**
 * Identifica um post publicado fora do HUB a partir do link colado.
 * body: { url, account_id? } → { post } (linha de ig_posts com métricas atualizadas)
 * Procura primeiro nos posts já importados; se não achar, percorre as mídias das contas conectadas.
 */
export async function POST(req: Request) {
  try {
    const { url, account_id } = await req.json().catch(() => ({}));
    const code = shortcodeFrom(url);
    if (!code) return NextResponse.json({ error: "Link inválido. Cole o link do post, por exemplo instagram.com/p/…" }, { status: 400 });
    const s = await createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    let q = s.from("ig_accounts").select("id,owner_id,ig_user_id,username").eq("connected", true).not("ig_user_id", "is", null);
    if (account_id) q = q.eq("id", account_id);
    const { data: accounts } = await q;
    if (!accounts?.length) return NextResponse.json({ error: account_id ? "Este perfil não está conectado ao Instagram. Conecte em Perfis & marca." : "Nenhum perfil conectado ao Instagram. Conecte em Perfis & marca." }, { status: 400 });

    const has = (p?: string | null) => !!p && new RegExp(`/(p|reel|reels|tv)/${code}(/|$|\\?)`).test(p);
    const tokens: Record<string, string> = {};
    const tokenOf = async (id: string) => (tokens[id] ??= (await igToken(s, id)) as string);

    // 1) já importado: só atualiza as métricas
    const { data: known } = await s.from("ig_posts").select("account_id,ig_media_id,permalink").in("account_id", accounts.map((a) => a.id)).ilike("permalink", `%/${code}%`);
    const hit = (known || []).find((p) => has(p.permalink));
    if (hit) {
      const acc = accounts.find((a) => a.id === hit.account_id)!;
      const token = await tokenOf(acc.id);
      if (token) {
        const m = await gget(hit.ig_media_id, { access_token: token, fields: MEDIA_FIELDS });
        const row = await mediaRow(m, token, { owner_id: acc.owner_id, account_id: acc.id });
        await s.from("ig_posts").upsert(row, { onConflict: "account_id,ig_media_id" });
      }
      const { data: post } = await s.from("ig_posts").select("*").eq("account_id", acc.id).eq("ig_media_id", hit.ig_media_id).single();
      return NextResponse.json({ post, username: acc.username });
    }

    // 2) procura nas mídias de cada conta conectada (até 500 posts por conta)
    for (const acc of accounts) {
      const token = await tokenOf(acc.id);
      if (!token) continue;
      let page: any = await gget(`${acc.ig_user_id}/media`, { access_token: token, fields: MEDIA_FIELDS, limit: "50" });
      for (let i = 0; page && i < 10; i++) {
        const m = (page.data || []).find((x: any) => has(x.permalink));
        if (m) {
          const row = await mediaRow(m, token, { owner_id: acc.owner_id, account_id: acc.id });
          const { data: post, error } = await s.from("ig_posts").upsert(row, { onConflict: "account_id,ig_media_id" }).select().single();
          if (error) throw new Error(error.message);
          return NextResponse.json({ post, username: acc.username });
        }
        page = page.paging?.next ? await gget(page.paging.next, {}) : null;
      }
    }
    return NextResponse.json({ error: "Post não encontrado nos perfis conectados. Confira se o link é de um post do seu perfil." }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Falha ao identificar o post" }, { status: 500 });
  }
}
