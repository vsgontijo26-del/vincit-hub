import Link from "next/link";
import Logo from "@/components/Logo";
import { I } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";

const hubs = [
  {
    key: "creator", name: "CREATOR", href: "/creator", status: "Ativo",
    desc: "Conteúdo para Instagram em 4 etapas: base, análise, criação e execução.",
    items: ["Perfis & marca", "Desempenho", "Tendências", "Referências", "Formatos criativos", "Copy & roteiro", "Agentes", "Laboratório", "Planejador", "Automações"],
    Icon: I.camera,
  },
  {
    key: "agency", name: "AGENCY", href: "/agency", status: "Ativo",
    desc: "Gestão da produtora em 4 etapas: base, análise, comercial e execução.",
    items: ["Configurações", "Clientes", "Equipe", "Equipamentos", "Financeiro", "Funil", "Propostas", "Projetos", "Tarefas", "Agenda"],
    Icon: I.briefcase,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hour = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const h = parseInt(hour);
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  return (
    <main className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between px-5 md:px-10 py-6 border-b border-line">
        <div className="flex items-center gap-3">
          <Logo className="h-6" />
          <span className="font-mono text-[11px] text-fog border border-line rounded-md px-1.5 py-0.5">HUB</span>
        </div>
        <form action="/auth/signout" method="post" className="flex items-center gap-4">
          <span className="text-xs text-fog hidden sm:block">{user?.email}</span>
          <button className="btn btn-ghost btn-sm"><I.logout className="w-3.5 h-3.5" />Sair</button>
        </form>
      </header>

      <section className="px-5 md:px-10 pt-14 pb-10 max-w-6xl mx-auto">
        <p className="font-mono text-xs text-mint tracking-widest uppercase rise">{greet}</p>
        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight mt-3 rise" style={{ animationDelay: ".05s" }}>
          Escolha um hub.
        </h1>
        <p className="text-fog mt-3 max-w-lg rise" style={{ animationDelay: ".1s" }}>Cada hub é um sistema independente da VINCIT. Novos hubs aparecem aqui conforme forem criados.</p>
      </section>

      <section className="px-5 md:px-10 pb-20 max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
        {hubs.map((hub, i) => {
          const active = hub.status === "Ativo";
          return (
            <Link key={hub.key} href={hub.href}
              className={`group card relative overflow-hidden p-7 md:p-8 rise transition-all ${active ? "hover:border-mint" : "hover:border-slate"}`}
              style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
              <div className={`absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl transition-opacity ${active ? "bg-mint/10 group-hover:bg-mint/20" : "bg-slate/20"}`} />
              <div className="relative flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl grid place-items-center ${active ? "bg-mint text-black" : "bg-panel2 text-fog border border-line"}`}>
                  <hub.Icon className="w-6 h-6" />
                </div>
                <span className={`chip ${active ? "chip-mint" : ""}`}>{active && <span className="w-1.5 h-1.5 rounded-full bg-mint" />}{hub.status}</span>
              </div>
              <h2 className="relative font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-8">{hub.name}</h2>
              <p className="relative text-fog mt-2 text-[15px] leading-relaxed max-w-md">{hub.desc}</p>
              <div className="relative flex flex-wrap gap-1.5 mt-6">
                {hub.items.map((it) => <span key={it} className="chip">{it}</span>)}
              </div>
              <div className={`relative mt-8 flex items-center gap-2 text-sm font-semibold ${active ? "text-mint" : "text-fog"}`}>
                {active ? "Abrir hub" : "Ver o que vem"} <I.arrow className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
