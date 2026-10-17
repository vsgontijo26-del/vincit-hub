"use client";
import HubNav from "@/components/HubNav";
import { A } from "./icons";
import { I } from "@/components/icons";

/* Fluxo operacional: base → análise → comercial → execução */
const items = [
  { href: "/agency", label: "Visão geral", Icon: A.home },
  { href: "/agency/config", label: "Configurações", Icon: A.gear, group: "01 · Base" },
  { href: "/agency/clientes", label: "Clientes", Icon: A.users, group: "01 · Base" },
  { href: "/agency/equipe", label: "Equipe", Icon: A.team, group: "01 · Base" },
  { href: "/agency/equipamentos", label: "Equipamentos", Icon: I.camera, group: "01 · Base" },
  { href: "/agency/financeiro", label: "Financeiro", Icon: A.money, group: "02 · Análise" },
  { href: "/agency/funil", label: "Funil de vendas", Icon: A.funnel, group: "03 · Comercial" },
  { href: "/agency/propostas", label: "Propostas & orçamentos", Icon: A.doc, group: "03 · Comercial" },
  { href: "/agency/projetos", label: "Projetos", Icon: A.film, group: "04 · Execução" },
  { href: "/agency/tarefas", label: "Tarefas", Icon: A.check, group: "04 · Execução" },
  { href: "/agency/agenda", label: "Agenda", Icon: A.cal, group: "04 · Execução" },
];

export default function AgencyNav() {
  return <HubNav title="AGENCY" root="/agency" items={items} />;
}
