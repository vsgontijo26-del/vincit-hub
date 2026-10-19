export const GRAPH = "https://graph.facebook.com/v23.0";
export const SCOPES = [
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "instagram_manage_insights",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "business_management",
].join(",");

export async function gget(path: string, params: Record<string, string>) {
  const u = new URL(path.startsWith("http") ? path : `${GRAPH}/${path}`);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message || `Graph ${r.status}`);
  return j;
}

export async function gpost(path: string, token: string, body: any) {
  const r = await fetch(`${GRAPH}/${path}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message || `Graph ${r.status}`);
  return j;
}

export function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function matches(text: string, keywords: string[]) {
  if (!keywords?.length) return true;
  const t = ` ${norm(text).replace(/[^\p{L}\p{N}#@]+/gu, " ")} `;
  return keywords.some((k) => {
    const kk = norm(k);
    return kk && (t.includes(` ${kk} `) || norm(text) === kk);
  });
}

/** campos de mídia usados ao importar posts */
export const MEDIA_FIELDS = "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";

/** código curto do post a partir de um link do Instagram (instagram.com/p|reel|reels|tv/CODIGO) ou do próprio código */
export function shortcodeFrom(input: string): string | null {
  const s = (input || "").trim();
  const m = s.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i);
  if (m) return m[1];
  return /^[\w-]{5,40}$/.test(s) ? s : null;
}

/** converte uma mídia da Graph API em linha de ig_posts, com alcance, salvos, compartilhamentos e visualizações */
export async function mediaRow(m: any, token: string, base: { owner_id: string; account_id: string }) {
  const row: any = {
    ...base, ig_media_id: m.id,
    media_type: m.media_product_type === "REELS" ? "REELS" : m.media_type,
    caption: m.caption, permalink: m.permalink, thumbnail_url: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : null),
    posted_at: m.timestamp, like_count: m.like_count ?? 0, comments_count: m.comments_count ?? 0,
  };
  // nem todo tipo de mídia aceita todas as métricas: tenta da lista mais completa para a mais curta
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
}
