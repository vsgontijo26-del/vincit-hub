"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { I } from "./icons";
import { A } from "./agency/icons";
import { useAccess } from "@/lib/useAccess";
import { hubAllowed } from "@/lib/access";
import Bell from "./dia/Bell";

/* rotas de Seu dia (a aba "/" fica ativa em todas) */
const DIA = ["/tarefas", "/agenda", "/rotina", "/projetos"];

/* Navegador horizontal: troca entre Seu dia e os hubs sem sair do topo */
const tabs = [
  { href: "/", label: "Seu dia", Icon: A.home },
  { href: "/creator", label: "Creator", Icon: I.camera, hub: "creator" as const },
  { href: "/agency", label: "Gestor", Icon: I.briefcase, hub: "agency" as const },
];

export default function TopBar() {
  const path = usePathname();
  const acc = useAccess();
  const visible = tabs.filter((t) => !t.hub || !acc || hubAllowed(acc.tools, t.hub));
  const isActive = (h: string) => (h === "/" ? path === "/" || DIA.some((d) => path === d || path.startsWith(d + "/")) : path.startsWith(h));
  const nav = (
    <nav className="flex gap-1 bg-panel border border-line rounded-xl p-1">
      {visible.map(({ href, label, Icon }) => (
        <Link key={href} href={href}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 rounded-[9px] text-sm font-semibold transition-colors ${isActive(href) ? "bg-mint text-[var(--color-on-mint,#06140e)]" : "text-fog hover:text-paper hover:bg-panel2"}`}>
          <Icon className="w-4 h-4" /> {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="h-16 flex items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo className="h-5" />
          <span className="font-mono text-[10px] text-fog border border-line rounded-md px-1.5 py-0.5">HUB</span>
        </Link>
        <div className="hidden md:block">{nav}</div>
        <form action="/auth/signout" method="post" className="ml-auto flex items-center gap-2">
          <Bell />
          {acc?.role === "superadmin" && <Link href="/admin" className="btn btn-ghost btn-sm text-mint">Admin</Link>}
          <Link href="/conta" className="btn btn-ghost btn-sm"><I.user className="w-3.5 h-3.5" /><span className="hidden sm:inline">Minha conta</span></Link>
          <button className="btn btn-ghost btn-sm" aria-label="Sair"><I.logout className="w-3.5 h-3.5" /><span className="hidden sm:inline">Sair</span></button>
        </form>
      </div>
      <div className="md:hidden px-4 pb-3">{nav}</div>
    </header>
  );
}
