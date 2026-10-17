import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/meta";

export async function GET(request: Request) {
  const appId = process.env.META_APP_ID;
  const origin = new URL(request.url).origin;
  if (!appId) return NextResponse.redirect(`${origin}/creator/perfis?erro=${encodeURIComponent("O app da Meta ainda não foi configurado (META_APP_ID).")}`);
  const state = crypto.randomUUID();
  const u = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", `${origin}/api/meta/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("response_type", "code");
  const res = NextResponse.redirect(u.toString());
  res.cookies.set("meta_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
