/* eslint-disable @next/next/no-img-element */
export default function Logo({ className = "h-6" }: { className?: string }) {
  return <img src="/logo-green.png" alt="VINCIT" className={className + " w-auto max-w-none object-contain object-left shrink-0 select-none"} draggable={false} />;
}
