"use client";
import { useState } from "react";
import { I } from "./icons";
export default function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}>
      <I.copy className="w-3.5 h-3.5" /> {ok ? "Copiado" : label}
    </button>
  );
}
