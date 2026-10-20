"use client";
import { useEffect, useState } from "react";

export type AgendaItem = { t: string; title: string; sub?: string | null; c: string; href?: string };

/** Hoje · Agenda: compromissos, gravações e publicações do dia, mais os eventos do Google Agenda */
export default function AgendaHoje({ items, today }: { items: AgendaItem[]; today: string }) {
  const [g, setG] = useState<AgendaItem[]>([]);
  useEffect(() => {
    fetch(`/api/google/events?from=${today}&to=${today}`).then((r) => r.json())
      .then((j) => setG((j.events || []).map((e: any) => ({ t: e.time || "", title: e.title, sub: "Google Agenda", c: "#7aa7ff", href: e.link }))))
      .catch(() => {});
  }, [today]);
  const all = [...items, ...g].sort((a, b) => (a.t || "99").localeCompare(b.t || "99"));
  if (!all.length) return <p className="text-sm text-fog py-3">Nada marcado para hoje.</p>;
  return (
    <ul className="divide-y divide-line/60">
      {all.map((e, i) => {
        const body = (<>
          <span className="font-mono text-xs text-fog w-11 pt-1 shrink-0">{e.t || "dia"}</span>
          <span className="w-0.5 self-stretch rounded-full shrink-0" style={{ background: e.c }} />
          <div className="min-w-0"><p className="text-[15px] truncate">{e.title}</p>{e.sub && <p className="text-xs text-fog truncate">{e.sub}</p>}</div>
        </>);
        return <li key={i}>{e.href ? <a href={e.href} target={e.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex gap-3 py-2.5 hover:text-mint">{body}</a> : <div className="flex gap-3 py-2.5">{body}</div>}</li>;
      })}
    </ul>
  );
}
