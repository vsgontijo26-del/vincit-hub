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
