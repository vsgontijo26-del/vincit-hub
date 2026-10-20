import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleCfg } from "@/lib/tokens";

export async function POST() {
  const s = await createClient();
  const cfg = await googleCfg(s);
  const tok = (cfg as any)?.refresh_token || (cfg as any)?.access_token;
  if (tok) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(tok), { method: "POST" }).catch(() => null);
  const { error } = await s.rpc("google_disconnect");
  return NextResponse.json({ ok: !error, error: error?.message });
}
