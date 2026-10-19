"use client";
import HubNav from "./HubNav";
import { I } from "./icons";

/* Fluxo operacional: base → análise → criação → execução */
const items = [
  { href: "/creator", label: "Visão geral", Icon: I.grid },
  { href: "/creator/perfis", label: "Perfis", Icon: I.user, group: "01 · Base" },
  { href: "/creator/briefing", label: "Briefing", Icon: I.briefcase, group: "01 · Base" },
  { href: "/creator/desempenho", label: "Desempenho", Icon: I.chart, group: "02 · Análise" },
  { href: "/creator/tendencias", label: "Tendências", Icon: I.trend, group: "02 · Análise" },
  { href: "/creator/referencias", label: "Referências", Icon: I.bookmark, group: "02 · Análise" },
  { href: "/creator/formatos", label: "Formatos criativos", Icon: I.cards, group: "03 · Criação" },
  { href: "/creator/laboratorio", label: "Laboratório", Icon: I.flask, group: "03 · Criação" },
  { href: "/creator/pauta", label: "Planejador", Icon: I.calendar, group: "04 · Execução" },
  { href: "/creator/automacoes", label: "Automações", Icon: I.bolt, group: "04 · Execução" },
];

export default function CreatorNav() {
  return <HubNav title="CREATOR" root="/creator" items={items} />;
}
