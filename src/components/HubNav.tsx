"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccess } from "@/lib/useAccess";
import { can, toolForPath } from "@/lib/access";

export type NavItem = { href: string; label: string; Icon: (p: { className?: string }) => any; group?: string };

/** Menu do hub ativo: lateral no desktop, chips roláveis no celular. A troca de hub fica na TopBar. */
export default function HubNav({ title, desc, root, items }: { title: string; desc?: string; root: string; items: NavItem[] }) {
  const path = usePathname();
  const acc = useAccess();
  // esconde as ferramentas que não estão no plano do usuário
  const visible = items.filter((it) => { const t = toolForPath(it.href); return !t || !acc || can(acc.tools, t); });
  const isActive = (h: string) => (h === root ? path === h : path.startsWith(h));
  let lastGroup: string | undefined;
  return (
    <>
      <aside className="hidden lg:flex fixed top-16 bottom-0 left-0 w-60 flex-col border-r border-line bg-ink/80 backdrop-blur z-20 p-4 overflow-y-auto scroll-thin">
        <div className="px-2 mb-3">
          <p className="font-display font-extrabold text-xl tracking-tight">{title}</p>
          {desc && <p className="text-xs text-fog mt-1">{desc}</p>}
        </div>
        <nav className="flex flex-col gap-0.5">
          {visible.map(({ href, label, Icon, group }) => {
            const header = group && group !== lastGroup ? group : null;
            lastGroup = group;
            return (
              <div key={href}>
                {header && <p className="text-[10px] uppercase tracking-widest text-fog/70 px-3 pt-4 pb-1 font-mono">{header}</p>}
                <Link href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(href) ? "bg-mint/10 text-mint" : "text-fog hover:text-paper hover:bg-panel2"}`}>
                  <Icon className="w-[18px] h-[18px]" /> {label}
                </Link>
              </div>
            );
          })}
        </nav>
        <p className="mt-auto pt-6 px-2 text-[11px] text-fog font-mono">VINCIT HUB</p>
      </aside>
      <nav className="lg:hidden flex gap-2 overflow-x-auto scroll-thin px-4 py-3 border-b border-line">
        {visible.map(({ href, label }) => (
          <Link key={href} href={href} className={`chip shrink-0 text-xs px-3 py-1.5 ${isActive(href) ? "chip-mint" : "hover:text-paper"}`}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
