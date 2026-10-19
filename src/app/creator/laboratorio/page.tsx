"use client";
import { useEffect, useState } from "react";
import PageHead from "@/components/PageHead";
import Criar from "@/components/creator/Criar";
import Especialistas from "@/components/creator/Especialistas";
import Revisar from "@/components/creator/Revisar";

const TABS = [
  { k: "criar", l: "Criar", d: "Gancho, roteiro, legenda e hashtags a partir de um tema" },
  { k: "especialistas", l: "Especialistas", d: "Stories, comentários, respostas, direct e mais" },
  { k: "revisar", l: "Revisar", d: "Checagem final antes de postar" },
] as const;
type Tab = (typeof TABS)[number]["k"];

export default function Laboratorio() {
  const [tab, setTab] = useState<Tab>("criar");
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t === "especialistas" || t === "revisar" || t === "criar") setTab(t);
  }, []);
  function go(t: Tab) {
    setTab(t);
    const u = new URL(location.href); u.searchParams.set("tab", t); history.replaceState(null, "", u);
  }
  return (
    <>
      <PageHead kicker="CREATOR · 02 CRIAÇÃO" title="Laboratório" desc="Onde a ideia vira conteúdo: crie com IA, chame um especialista para tarefas pontuais e revise antes de postar." />
      <div className="grid grid-cols-3 gap-2 mb-6">
        {TABS.map((t, i) => (
          <button key={t.k} onClick={() => go(t.k)} className={`text-left rounded-xl border p-3 md:p-4 transition-colors ${tab === t.k ? "border-mint bg-mint/10" : "border-line bg-panel hover:border-slate"}`}>
            <p className="font-mono text-[10px] text-fog">{String(i + 1).padStart(2, "0")}</p>
            <p className={`font-display font-bold mt-0.5 ${tab === t.k ? "text-mint" : ""}`}>{t.l}</p>
            <p className="text-xs text-fog mt-1 hidden sm:block">{t.d}</p>
          </button>
        ))}
      </div>
      {/* mantém o estado de cada aba ao alternar */}
      <div className={tab === "criar" ? "" : "hidden"}><Criar /></div>
      <div className={tab === "especialistas" ? "" : "hidden"}><Especialistas /></div>
      <div className={tab === "revisar" ? "" : "hidden"}><Revisar /></div>
    </>
  );
}
