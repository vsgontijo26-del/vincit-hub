import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

export default async function Desempenho() {
  const s = await createClient();
  const { data: accounts } = await s.from("ig_accounts").select("id,username,connected,followers_count,profile_picture_url").order("created_at");
  if (accounts?.length === 1) redirect(`/creator/desempenho/${accounts[0].id}`);
  return (
    <>
      <PageHead kicker="CREATOR · 02 ANÁLISE" title="Desempenho" desc="Métricas, posts fora da curva e diagnóstico de cada perfil." />
      {!accounts?.length ? (
        <div className="card p-10 text-center">
          <p className="font-display text-xl font-bold">Nenhum perfil cadastrado</p>
          <p className="text-fog text-sm mt-2">Comece pela base: conecte ou cadastre um perfil.</p>
          <Link href="/creator/perfis" className="btn btn-mint mt-5 inline-flex">Ir para Perfis & marca <I.arrow className="w-4 h-4" /></Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`/creator/desempenho/${a.id}`} className="card p-5 flex items-center gap-3 hover:border-mint transition-colors">
              {a.profile_picture_url ? <img src={a.profile_picture_url} alt="" className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full bg-panel2 grid place-items-center font-display font-bold text-mint">{a.username[0]?.toUpperCase()}</div>}
              <div className="flex-1 min-w-0"><p className="font-semibold truncate">@{a.username}</p><p className="text-xs text-fog">{a.connected ? "Conectado à Meta" : "Manual"}</p></div>
              <I.arrow className="w-4 h-4 text-fog" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
