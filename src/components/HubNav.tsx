"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import { I } from "./icons";
import { useAccess } from "@/lib/useAccess";
import { can, toolForPath } from "@/lib/access";

export type NavItem = { href: string; label: string; Icon: (p: { className?: string }) => any; group?: string };

export default function HubNav({ title, root, items }: { title: string; root: string; items: NavItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const acc = useAccess();
  // esconde as ferramentas que não estão no plano do usuário
  const visible = items.filter((it) => { const t = toolForPath(it.href); return !t || !acc || can(acc.tools, t); });
  const isActive = (h: string) => (h === root ? path === h : path.startsWith(h));
  let lastGroup: string | undefined;
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {visible.map(({ href, label, Icon, group }) => {
        const header = group && group !== lastGroup ? group : null;
        lastGroup = group;
        return (
          <div key={href}>
            {header && <p className="text-[10px] uppercase tracking-widest text-fog/70 px-3 pt-4 pb-1 font-mono">{header}</p>}
            <Link href={href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(href) ? "bg-mint/10 text-mint" : "text-fog hover:text-paper hover:bg-panel2"}`}>
              <Icon className="w-[18px] h-[18px]" /> {label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
  return (
    <>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-ink/80 backdrop-blur z-20 p-4 overflow-y-auto scroll-thin">
        <Link href="/" className="flex items-center gap-2 text-xs text-fog hover:text-paper mb-6 px-2"><I.back className="w-3.5 h-3.5" /> Hubs</Link>
        <div className="px-2 mb-4">
          <Logo className="h-5" />
          <p className="font-display font-extrabold text-xl tracking-tight mt-3">{title}</p>
        </div>
        {nav}
        <p className="mt-auto pt-6 px-2 text-[11px] text-fog font-mono">VINCIT HUB</p>
      </aside>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-line bg-ink/90 backdrop-blur">
        <Link href="/" className="flex items-center gap-2"><Logo className="h-4" /><span className="font-display font-extrabold text-sm">{title}</span></Link>
        <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm" aria-label="Menu"><I.menu className="w-4 h-4" /></button>
      </header>
      {open && <div className="lg:hidden fixed inset-x-0 top-[53px] bottom-0 overflow-y-auto z-30 bg-ink border-b border-line p-3">{nav}<Link href="/" className="flex items-center gap-2 text-xs text-fog px-3 py-3"><I.back className="w-3.5 h-3.5" /> Voltar aos hubs</Link></div>}
    </>
  );
}
