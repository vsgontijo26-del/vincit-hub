"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Sino de avisos na barra do topo. Fica escondido enquanto a tabela de avisos não existe. */
export default function Bell() {
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const { data, error } = await createClient().from("notifications").select("id,title,href,kind,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(20);
    setItems(error ? null : data || []);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("vh:avisos", load);
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => { clearInterval(t); window.removeEventListener("vh:avisos", load); document.removeEventListener("mousedown", close); };
  }, [load]);
  if (items === null) return null;

  const read = async (ids: string[]) => {
    setItems((l) => (l || []).filter((x) => !ids.includes(x.id)));
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  };
  const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm relative" aria-label={`Avisos${items.length ? `, ${items.length} não lidos` : ""}`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {items.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-[10px] font-bold text-white grid place-items-center">{items.length > 9 ? "9+" : items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] card p-2 shadow-2xl z-40">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="font-mono text-[11px] tracking-widest uppercase text-fog">Avisos</p>
            {items.length > 0 && <button type="button" onClick={() => read(items.map((x) => x.id))} className="text-xs text-fog hover:text-mint">Marcar tudo como lido</button>}
          </div>
          {!items.length ? <p className="text-sm text-fog px-2 py-4">Nenhum aviso novo.</p> : (
            <ul className="max-h-[60vh] overflow-y-auto scroll-thin">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.href || "/"} onClick={() => { read([n.id]); setOpen(false); }} className="flex gap-2 px-2 py-2 rounded-lg hover:bg-panel2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${/atrasad|vencid/.test(n.kind) ? "bg-danger" : "bg-mint"}`} />
                    <span className="flex-1">{n.title}</span><span className="text-[11px] text-fog whitespace-nowrap">{ago(n.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
