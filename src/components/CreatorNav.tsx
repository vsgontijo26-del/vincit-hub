"use client";
import HubNav from "./HubNav";
import { I } from "./icons";

/* Base → análise → criação & planejamento → crescimento */
const items = [
  { href: "/creator", label: "Visão geral", Icon: I.grid },
  { href: "/creator/perfis", label: "Perfis", Icon: I.user, group: "Base" },
  { href: "/creator/briefing", label: "Briefing", Icon: I.briefcase, group: "Base" },
  { href: "/creator/desempenho", label: "Desempenho & insights", Icon: I.chart, group: "01 · Análise" },
  { href: "/creator/tendencias", label: "Tendências", Icon: I.trend, group: "01 · Análise" },
  { href: "/creator/referencias", label: "Referências", Icon: I.bookmark, group: "01 · Análise" },
  { href: "/creator/formatos", label: "Formatos criativos", Icon: I.cards, group: "02 · Criação & planejamento" },
  { href: "/creator/laboratorio", label: "Laboratório", Icon: I.flask, group: "02 · Criação & planejamento" },
  { href: "/creator/pauta", label: "Planejador", Icon: I.calendar, group: "02 · Criação & planejamento" },
  { href: "/creator/estrategia", label: "Estratégia", Icon: I.trend, group: "03 · Crescimento" },
  { href: "/creator/automacoes", label: "Automações", Icon: I.bolt, group: "03 · Crescimento" },
];

export default function CreatorNav() {
  return <HubNav title="CREATOR" root="/creator" items={items} />;
}
