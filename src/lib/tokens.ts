/** Leitura de tokens das integrações só pelo servidor (service role), sempre presos ao usuário logado */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

async function uid(s: SupabaseClient) {
  return (await s.auth.getUser()).data.user?.id || null;
}

/** token do Instagram de uma conta do usuário logado */
export async function igToken(s: SupabaseClient, accountId: string): Promise<string | null> {
  const owner = await uid(s);
  if (!owner) return null;
  const { data } = await createServiceClient().rpc("ig_token_for", { p_account_id: accountId, p_owner: owner });
  return (data as string) || null;
}

/** configuração e tokens do Google do usuário logado */
export async function googleCfg(s: SupabaseClient): Promise<any> {
  const owner = await uid(s);
  if (!owner) return null;
  const { data } = await createServiceClient().rpc("google_tokens_for", { p_owner: owner });
  return data;
}
