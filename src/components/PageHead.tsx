export default function PageHead({ kicker, title, desc, children }: { kicker?: string; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 rise">
      <div>
        {kicker && <p className="font-mono text-[11px] text-mint tracking-widest uppercase">{kicker}</p>}
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1">{title}</h1>
        {desc && <p className="text-fog mt-2 max-w-xl text-[15px]">{desc}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
