"use client";
import { useState } from "react";
export function useAI() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T = any>(task: string, data: any): Promise<T | null> {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, data }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro");
      return j as T;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  }
  return { run, busy, error };
}
