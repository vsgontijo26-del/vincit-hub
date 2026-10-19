import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/conta?${q}#google`);
  const err = url.searchParams.get("error");
  if (err) return back("google_erro=" + encodeURIComponent(err === "access_denied" ? "Conexão cancelada." : err));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  if (!code || !state || state !== jar.get("g_state")?.value) return back("google_erro=" + encodeURIComponent("Sessão de conexão expirada. Tente de novo."));

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${origin}/api/google/callback`, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!r.ok) return back("google_erro=" + encodeURIComponent(j.error_description || j.error || "Falha ao conectar"));
  if (!String(j.scope || "").includes("calendar")) return back("google_erro=" + encodeURIComponent("Permissão da agenda não concedida. Marque a opção de acesso à agenda ao conectar."));

  let email: string | null = null;
  try { email = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString()).email || null; } catch {}
  const s = await createClient();
  const { error } = await s.rpc("google_tokens_save", { p_email: email, p_refresh: j.refresh_token || null, p_access: j.access_token, p_expires: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString() });
  if (error) return back("google_erro=" + encodeURIComponent(error.message));
  const res = back("google=ok");
  res.cookies.delete("g_state");
  return res;
}
