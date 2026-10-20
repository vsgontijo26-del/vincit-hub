"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Aviso = { id: string; title: string; href?: string | null; action?: string; tone?: "danger" | "warn" | "muted" };
const ACTION: Record<string, string> = { task: "Abrir tarefa", content: "Abrir conteúdo", transaction: "Abrir Financeiro", proposal: "Abrir proposta", project: "Abrir projeto", event: "Abrir Agenda", routine: "Abrir Rotina" };
const TONE: Record<string, Aviso["tone"]> = { tarefa_atrasada: "danger", conteudo_atrasado: "danger", cobranca_vencida: "danger", revisoes_excedidas: "warn", lembrete: "warn" };

/** Avisos do Resumo: lê a tabela de avisos; enquanto ela não existe, mostra os avisos calculados na hora */
export default function Avisos({ fallback }: { fallback: Aviso[] }) {
  const [items, setItems] = useState<Aviso[] | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    createClient().from("notifications").select("*").is("read_at", null).order("created_at", { ascending: false }).limit(12).then(({ data, error }) => {
      // sem tabela, ou sem avisos gerados ainda: mostra as pendências calculadas na hora
      if (error || !data?.length) { setItems(fallback); return; }
      setLive(true);
      setItems((data || []).map((n: any) => ({ id: n.id, title: n.title, href: n.href, action: ACTION[n.source_type] || "Abrir", tone: TONE[n.kind] || "muted" })));
    });
  }, [fallback]);
  async function readAll() {
    if (!live || !items?.length) return;
    const ids = items.map((x) => x.id); setItems([]);
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    window.dispatchEvent(new Event("vh:avisos"));
  }
  async function read(a: Aviso) { if (live) { await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", a.id); window.dispatchEvent(new Event("vh:avisos")); } }
  if (!items) return <p className="text-sm text-fog py-3">Carregando…</p>;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[11px] tracking-widest uppercase text-fog">Avisos · {items.length} {live ? "não lidos" : "pendências"}</p>
        {live && items.length > 0 && <button onClick={readAll} className="text-xs text-fog hover:text-mint">Marcar tudo como lido</button>}
      </div>
      {!items.length ? <p className="text-sm text-fog py-2">Nenhum aviso. Tudo sob controle.</p> : (
        <ul className="grid md:grid-cols-2 gap-x-8">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5 border-b border-line/60">
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.tone === "danger" ? "bg-danger" : a.tone === "warn" ? "bg-[#f5c84c]" : "bg-fog"}`} />
              <span className="flex-1 min-w-0 text-[15px] truncate">{a.title}</span>
              {a.href && <Link href={a.href} onClick={() => read(a)} className="btn btn-ghost btn-sm whitespace-nowrap">{a.action || "Abrir"}</Link>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
