import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const patch: any = {};
  if (typeof b.push === "boolean") patch.push = b.push;
  if (typeof b.pull === "boolean") patch.pull = b.pull;
  const s = await createClient();
  const { error } = await s.rpc("google_tokens_update", { p_patch: patch });
  return NextResponse.json({ ok: !error, error: error?.message });
}
