"use client";
import { useEffect, useState } from "react";
import PageHead from "@/components/PageHead";
import FlowBuilder from "@/components/creator/FlowBuilder";
import QuickRules from "@/components/creator/QuickRules";
import PostScheduler from "@/components/creator/PostScheduler";
import Contacts from "@/components/creator/Contacts";

const TABS = [["fluxos", "Fluxos de mensagens"], ["agendar", "Agendar publicações"], ["contatos", "Contatos"], ["simples", "Respostas simples"]] as const;
type Tab = (typeof TABS)[number][0];

export default function Automacoes() {
  const [tab, setTab] = useState<Tab>("fluxos");
  useEffect(() => { const t = new URLSearchParams(location.search).get("tab") as Tab; if (TABS.some(([k]) => k === t)) setTab(t); }, []);
  const go = (t: Tab) => { setTab(t); const u = new URL(location.href); u.searchParams.set("tab", t); history.replaceState(null, "", u); };
  return (
    <>
      <PageHead kicker="CREATOR · 04 EXECUÇÃO" title="Automações" desc="Conversas automáticas no direct no estilo ManyChat e agenda de publicações no estilo Business Suite, direto no seu Instagram." />
      <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => go(k)} className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-mint text-mint" : "border-transparent text-fog hover:text-paper"}`}>{l}</button>)}</div>
      {tab === "fluxos" && <FlowBuilder />}
      {tab === "agendar" && <PostScheduler />}
      {tab === "contatos" && <Contacts />}
      {tab === "simples" && <QuickRules />}
    </>
  );
}
