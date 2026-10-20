"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QUEUE_EVENT } from "@/lib/useAI";
import Markdown from "./Markdown";

const ROUTE: Record<string, string> = { ai: "/api/ai", diagnostico: "/api/ai/diagnostico", "ref-profile": "/api/ref-profile" };
const STATUS: Record<string, string> = { pending: "Na fila", running: "O Claude está fazendo", done: "Pronto", error: "Não deu certo" };

/** Pedidos de IA que esperam a fila do Claude. Some da barra enquanto a tabela não existe ou não há pedidos recentes. */
export default function ClaudeQueue() {
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const finishing = useRef(new Set<string>());

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data, error } = await createClient().from("ai_requests").select("id,endpoint,label,payload,status,error,response,created_at,done_at,delivered_at").gte("created_at", since).order("created_at", { ascending: false }).limit(30);
    if (error) { setItems(null); return; }
    setItems(data || []);
    // resposta pronta e a página que pediu já foi fechada: entrega pela rota, que grava no HUB (Raio-X, perfil de referência)
    for (const r of data || []) {
      if (r.status !== "done" || r.delivered_at || finishing.current.has(r.id)) continue;
      if (Date.now() - new Date(r.done_at || r.created_at).getTime() < 90_000) continue;
      finishing.current.add(r.id);
      fetch(ROUTE[r.endpoint], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...r.payload, _ai_request: r.id }) }).finally(() => setTimeout(load, 1000));
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener(QUEUE_EVENT, load);
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => { clearInterval(t); window.removeEventListener(QUEUE_EVENT, load); document.removeEventListener("mousedown", close); };
  }, [load]);
  if (!items?.length) return null;

  const waiting = items.filter((r) => r.status === "pending" || r.status === "running").length;
  const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm relative" aria-label={`Pedidos ao Claude${waiting ? `, ${waiting} na fila` : ""}`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
        <span className="hidden sm:inline">Claude</span>
        {waiting > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-mint text-[10px] font-bold text-[var(--color-on-mint,#06140e)] grid place-items-center">{waiting}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] card p-2 shadow-2xl z-40">
          <div className="px-2 py-1.5">
            <p className="font-mono text-[11px] tracking-widest uppercase text-fog">Pedidos ao Claude</p>
            <p className="text-xs text-fog mt-1">O Claude responde a fila de hora em hora. A resposta aparece na página do pedido e fica aqui por 7 dias.</p>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto scroll-thin">
            {items.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={!r.response && r.status !== "error"} onClick={() => setView(r)} className="w-full text-left flex gap-2 px-2 py-2 rounded-lg hover:bg-panel2 text-sm disabled:hover:bg-transparent">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${r.status === "error" ? "bg-danger" : r.status === "done" ? "bg-mint" : "bg-fog"}`} />
                  <span className="flex-1">{r.label || r.endpoint}<span className="block text-xs text-fog">{STATUS[r.status] || r.status}</span></span>
                  <span className="text-[11px] text-fog whitespace-nowrap">{ago(r.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setView(null)}>
          <div className="card w-full max-w-3xl max-h-[85vh] overflow-y-auto scroll-thin p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">{view.label}</p>
              <button type="button" onClick={() => setView(null)} className="btn btn-ghost btn-sm">Fechar</button>
            </div>
            {view.status === "error" ? <p className="text-danger text-sm">{view.error || "O Claude não conseguiu responder este pedido."}</p>
              : view.response?.text ? <Markdown text={view.response.text} />
              : <pre className="text-xs whitespace-pre-wrap bg-panel2 rounded-xl p-4">{JSON.stringify(view.response, null, 2)}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}
