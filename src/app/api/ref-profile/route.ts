import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { igToken } from "@/lib/tokens";
import { callClaude, extractJson, aiQuotaExceeded, QUOTA_MSG, withAIQueue } from "@/lib/ai";
import { gget } from "@/lib/meta";
import { briefingText } from "@/lib/briefing";
import { FORMATS } from "@/lib/formats";

export const maxDuration = 300;

type Snap = { platform: "instagram" | "youtube"; handle: string; url: string; title?: string; avatar?: string; followers?: number | null; bio?: string; items: { title: string; date?: string; type?: string; likes?: number; comments?: number; views?: number; url?: string }[]; source: string };

function parse(url: string): { platform: "instagram" | "youtube"; handle: string } | null {
  const u = url.trim();
  let m = u.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m && !["p", "reel", "reels", "explore", "stories"].includes(m[1].toLowerCase())) return { platform: "instagram", handle: m[1] };
  m = u.match(/youtube\.com\/(@[A-Za-z0-9._-]+)/i) || u.match(/youtube\.com\/(channel\/UC[\w-]+)/i) || u.match(/youtube\.com\/(c\/[\w-]+|user\/[\w-]+)/i);
  if (m) return { platform: "youtube", handle: m[1] };
  if (/^@?[A-Za-z0-9._]{2,30}$/.test(u)) return { platform: "instagram", handle: u.replace(/^@/, "") };
  return null;
}

async function instagram(supabase: any, handle: string, accountId?: string): Promise<Snap | null> {
  // Business Discovery: funciona para perfis profissionais, usando a conta conectada do usuário
  let q = supabase.from("ig_accounts").select("id,ig_user_id").not("ig_user_id", "is", null);
  if (accountId) q = q.eq("id", accountId);
  const { data: accs } = await q.limit(1);
  const acc = accs?.[0];
  if (!acc) return null;
  const token = await igToken(supabase, acc.id);
  if (!token) return null;
  const f = `business_discovery.username(${handle}){username,name,biography,profile_picture_url,followers_count,media_count,media.limit(40){caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink}}`;
  const j = await gget(acc.ig_user_id, { access_token: token, fields: f });
  const bd = j.business_discovery;
  return {
    platform: "instagram", handle, url: `https://instagram.com/${handle}`, title: bd.name || bd.username, avatar: bd.profile_picture_url, followers: bd.followers_count, bio: bd.biography, source: "api",
    items: (bd.media?.data || []).map((m: any) => ({ title: (m.caption || "").slice(0, 600), date: m.timestamp?.slice(0, 10), type: m.media_product_type === "REELS" ? "Reels" : m.media_type, likes: m.like_count, comments: m.comments_count, url: m.permalink })),
  };
}

async function youtube(handle: string): Promise<Snap | null> {
  const page = `https://www.youtube.com/${handle}`;
  let channelId = handle.startsWith("channel/") ? handle.slice(8) : "";
  let title = "", avatar = "", bio = "";
  try {
    const html = await (await fetch(page, { headers: { "accept-language": "pt-BR,pt;q=0.9", "user-agent": "Mozilla/5.0" }, cache: "no-store" })).text();
    channelId ||= html.match(/"channelId":"(UC[\w-]+)"/)?.[1] || html.match(/channel\/(UC[\w-]{20,})/)?.[1] || "";
    title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || "";
    avatar = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "";
    bio = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || "";
  } catch {}
  if (!channelId) return null;
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { cache: "no-store" })).text();
  const entries = xml.split("<entry>").slice(1);
  const dec = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return {
    platform: "youtube", handle, url: page, title: dec(title || xml.match(/<title>([^<]+)<\/title>/)?.[1] || handle), avatar, bio: dec(bio), followers: null, source: "rss",
    items: entries.map((e) => ({
      title: dec(e.match(/<title>([^<]+)<\/title>/)?.[1] || "") + " — " + dec((e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || "").slice(0, 400)),
      date: e.match(/<published>([^<]+)<\/published>/)?.[1]?.slice(0, 10),
      views: Number(e.match(/views="(\d+)"/)?.[1] || 0) || undefined,
      likes: Number(e.match(/count="(\d+)"/)?.[1] || 0) || undefined,
      url: e.match(/<link rel="alternate" href="([^"]+)"/)?.[1],
      type: e.includes("/shorts/") ? "Shorts" : "Vídeo",
    })),
  };
}

export const POST = withAIQueue("ref-profile", handle);

async function handle(body: any) {
  try {
    const { url, account_id, paste } = body;
    const p = parse(url || "");
    if (!p) throw new Error("Link não reconhecido. Use um perfil do Instagram (instagram.com/usuario) ou canal do YouTube (youtube.com/@canal).");
    const supabase = await createClient();
    if (await aiQuotaExceeded(supabase)) return NextResponse.json({ error: QUOTA_MSG }, { status: 429 });
    const { data: me } = account_id ? await supabase.from("ig_accounts").select("*").eq("id", account_id).maybeSingle() : { data: null };

    let snap: Snap | null = null; let note = "";
    try { snap = p.platform === "instagram" ? await instagram(supabase, p.handle, account_id) : await youtube(p.handle); }
    catch (e: any) { note = e.message; }
    if (!snap) snap = { platform: p.platform, handle: p.handle, url, items: [], source: "manual" };
    if (paste) snap.items.push({ title: String(paste).slice(0, 8000), type: "material colado" });
    if (!snap.items.length && !paste) {
      throw new Error(p.platform === "instagram"
        ? `Não consegui ler esse perfil automaticamente${note ? ` (${note})` : ""}. Isso exige um perfil seu conectado à Meta e que o perfil analisado seja profissional. Cole legendas/roteiros de alguns posts no campo "material" e tente de novo.`
        : "Não consegui ler esse canal. Confira o link ou cole títulos/roteiros no campo \"material\".");
    }

    // métricas simples para destacar os fora da curva
    const vals = snap.items.map((i) => i.views ?? (i.likes != null ? i.likes + (i.comments || 0) * 3 : null)).filter((v): v is number => v != null).sort((a, b) => a - b);
    const med = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    const lines = snap.items.slice(0, 40).map((i, k) => {
      const score = i.views ?? (i.likes != null ? i.likes + (i.comments || 0) * 3 : null);
      return `${k + 1}. ${i.date || ""} ${i.type || ""} ${i.views != null ? `views ${i.views}` : ""}${i.likes != null ? ` curtidas ${i.likes}` : ""}${i.comments != null ? ` coment. ${i.comments}` : ""}${med && score ? ` (${(score / med).toFixed(1)}x a mediana)` : ""}\n   ${i.title.replace(/\s+/g, " ").slice(0, 500)}`;
    }).join("\n");
    const cards = FORMATS.map((f) => `${f.id}: ${f.name}`).join(", ");
    const ctx = me ? `MEU PERFIL: @${me.username}${me.niche ? ` · nicho ${me.niche}` : ""}\n${briefingText(me.briefing)}${me.brand_voice ? `\nVoz da marca: ${me.brand_voice}` : ""}` : "MEU PERFIL: não informado (adapte para uma produtora audiovisual).";

    const text = await callClaude({
      maxTokens: 7000,
      prompt: `Você vai aplicar "Roube como um artista" (Austin Kleon): estudar um perfil de referência e extrair o que vale a pena aprender e adaptar — nunca copiar.\n\nREFERÊNCIA (${snap.platform}): ${snap.title || snap.handle} (${snap.handle})${snap.followers ? ` · ${snap.followers} seguidores` : ""}\nBio: ${snap.bio || "-"}\nConteúdos recentes:\n${lines}\n\n${ctx}\n\nCartas da biblioteca de formatos (id: nome): ${cards}\n\nResponda SOMENTE com JSON:\n{\n "resumo": "3-4 frases: quem é, posicionamento, por que funciona",\n "estilo": {"tom": "...", "estetica": "...", "ritmo_edicao": "...", "persona": "...", "frequencia": "..."},\n "pilares": ["temas recorrentes"],\n "top_conteudos": [{"n": número do item, "por_que": "por que performou"}],\n "itens": [ // 12 a 18 itens selecionáveis, variados\n   {"id": "i1", "tipo": "gancho|formato|estrutura|estetica|tema|serie|cta|edicao|estrategia", "titulo": "nome curto", "o_que_eles_fazem": "descrição objetiva com evidência", "como_adaptar": "como EU aplico no meu perfil/briefing, sem copiar", "exemplo": "um gancho ou ideia de post pronto para mim", "carta": "id da carta da biblioteca que mais combina ou \\"\\""}\n ],\n "evitar": ["o que não combina comigo ou seria cópia"]\n}\nNão invente números nem fatos sobre a referência além do que está nos dados.`,
    });
    const analysis = extractJson(text);
    const { data: row, error } = await supabase.from("ref_profiles").insert({
      account_id: account_id || null, platform: snap.platform, handle: snap.handle, url: snap.url, title: snap.title || snap.handle, avatar_url: snap.avatar || null,
      followers: snap.followers ?? null, source: snap.source, snapshot: { bio: snap.bio, items: snap.items.slice(0, 40) }, analysis,
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}
