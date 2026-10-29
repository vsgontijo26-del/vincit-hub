"use client";
import { useState } from "react";

const WAIT_MS = 20000;
const MAX_WAIT_MS = 3 * 60 * 60 * 1000;
export const QUEUE_EVENT = "vincit:ai-queue";

/**
 * POST numa rota de IA. Se a rota mandar o pedido para a fila do Claude (202), espera a resposta perguntando de novo
 * a cada 20 s; com a página aberta, o resultado chega como se tivesse vindo na hora. onQueued avisa a tela.
 */
export async function aiFetch(url: string, body: any, onQueued?: () => void) {
  let r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let j = await r.json();
  if (r.status === 202 && j.queued) {
    onQueued?.();
    window.dispatchEvent(new Event(QUEUE_EVENT));
    const id = j.request_id;
    const until = Date.now() + MAX_WAIT_MS;
    while (r.status === 202) {
      if (Date.now() > until) throw new Error("O pedido continua na fila do Claude. A resposta vai aparecer em \"Pedidos ao Claude\", no topo.");
      await new Promise((ok) => setTimeout(ok, WAIT_MS));
      r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, _ai_request: id }) });
      j = await r.json();
    }
    window.dispatchEvent(new Event(QUEUE_EVENT));
  }
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}

export function useAI() {
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T = any>(task: string, data: any): Promise<T | null> {
    setBusy(true); setQueued(false); setError(null);
    try {
      return (await aiFetch("/api/ai", { task, data }, () => setQueued(true))) as T;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); setQueued(false); }
  }
  return { run, busy, queued, error };
}
