import { NextResponse } from "next/server";
import { GOOGLE_SCOPES } from "@/lib/google";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(`${origin}/conta?google_erro=${encodeURIComponent("A integração com o Google ainda não foi configurada pelo administrador (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).")}#google`);
  const state = crypto.randomUUID();
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", id);
  u.searchParams.set("redirect_uri", `${origin}/api/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  const res = NextResponse.redirect(u.toString());
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
