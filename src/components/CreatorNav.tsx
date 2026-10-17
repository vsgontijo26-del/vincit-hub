"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import { I } from "./icons";

const items = [
  { href: "/creator", label: "Visão geral", Icon: I.grid },
  { href: "/creator/perfis", label: "Perfis & métricas", Icon: I.user },
  { href: "/creator/automacoes", label: "Automações", Icon: I.bolt },
  { href: "/creator/tendencias", label: "Tendências", Icon: I.trend },
  { href: "/creator/referencias", label: "Referências", Icon: I.bookmark },
  { href: "/creator/copy", label: "Copy & roteiro", Icon: I.pen },
  { href: "/creator/pauta", label: "Pauta", Icon: I.board },
];

export default function CreatorNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (h: string) => (h === "/creator" ? path === h : path.startsWith(h));
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive(href) ? "bg-mint/10 text-mint" : "text-fog hover:text-paper hover:bg-panel2"}`}>
          <Icon className="w-[18px] h-[18px]" /> {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-ink/80 backdrop-blur z-20 p-4">
        <Link href="/" className="flex items-center gap-2 text-xs text-fog hover:text-paper mb-6 px-2"><I.back className="w-3.5 h-3.5" /> Hubs</Link>
        <div className="px-2 mb-8">
          <Logo className="h-5" />
          <p className="font-display font-extrabold text-xl tracking-tight mt-3">CREATOR</p>
        </div>
        {nav}
        <p className="mt-auto px-2 text-[11px] text-fog font-mono">VINCIT HUB</p>
      </aside>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-line bg-ink/90 backdrop-blur">
        <Link href="/" className="flex items-center gap-2"><Logo className="h-4" /><span className="font-display font-extrabold text-sm">CREATOR</span></Link>
        <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm" aria-label="Menu"><I.menu className="w-4 h-4" /></button>
      </header>
      {open && <div className="lg:hidden fixed inset-x-0 top-[53px] z-30 bg-ink border-b border-line p-3">{nav}<Link href="/" className="flex items-center gap-2 text-xs text-fog px-3 py-3"><I.back className="w-3.5 h-3.5" /> Voltar aos hubs</Link></div>}
    </>
  );
}
