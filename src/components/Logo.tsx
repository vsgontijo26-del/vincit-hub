"use client";
/* eslint-disable @next/next/no-img-element */
import { useBrand, type Brand } from "./BrandContext";

const Vincit = ({ className }: { className: string }) => <img src="/logo-green.png" alt="VINCIT" className={className + " w-auto max-w-none object-contain object-left shrink-0 select-none"} draggable={false} />;

/** Logo do sistema. Se o assinante personalizou, mostra a logo dele + "by VINCIT HUB". */
export default function Logo({ className = "h-6", brand, vincitOnly }: { className?: string; brand?: Brand; vincitOnly?: boolean }) {
  const ctx = useBrand();
  const b = brand || ctx;
  if (vincitOnly || !b?.logo) return <Vincit className={className} />;
  return (
    <span className="inline-flex items-center gap-2.5 shrink-0">
      <img src={b.logo} alt={b.name || "Logo"} className={className + " w-auto max-w-[160px] object-contain object-left select-none"} draggable={false} />
      <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-fog/80 border-l border-line pl-2.5 leading-none whitespace-nowrap">by <Vincit className="h-2.5 opacity-80" /> <span className="font-mono">HUB</span></span>
    </span>
  );
}
