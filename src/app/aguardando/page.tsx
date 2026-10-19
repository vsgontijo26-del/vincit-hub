import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MSG: Record<string, [string, string]> = {
  pendente: ["Seu acesso está em análise", "Recebemos seu cadastro. Assim que o administrador liberar seu plano, você entra direto na plataforma."],
  suspenso: ["Acesso suspenso", "Seu acesso foi suspenso. Fale com o administrador para regularizar."],
  expirado: ["Sua assinatura venceu", "O período do seu plano terminou. Fale com o administrador para renovar."],
};

export default async function Aguardando() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await s.rpc("my_access");
  const st = (data as any)?.status || "pendente";
  if (st === "ativo") redirect("/");
  const [t, d] = MSG[st] || MSG.pendente;
  return (
    <main className="relative z-10 min-h-screen grid place-items-center px-5">
      <div className="card p-8 max-w-md w-full text-center rise">
        <Logo className="h-6 mx-auto" />
        <p className="font-mono text-[11px] text-mint tracking-widest uppercase mt-8">{st}</p>
        <h1 className="font-display text-2xl font-bold mt-2">{t}</h1>
        <p className="text-fog text-sm mt-3 leading-relaxed">{d}</p>
        <p className="text-xs text-fog mt-6">{user.email}</p>
        <div className="flex justify-center gap-2 mt-4">
          <Link href="/aguardando" className="btn btn-ghost btn-sm">Verificar de novo</Link>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm">Sair</button></form>
        </div>
      </div>
    </main>
  );
}
