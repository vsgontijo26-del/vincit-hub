"use client";
import HubNav from "@/components/HubNav";
import { A } from "./icons";
import { I } from "@/components/icons";

const items = [
  { href: "/agency", label: "Visão geral", Icon: A.home },
  { href: "/agency/projetos", label: "Projetos", Icon: A.film, group: "Operação" },
  { href: "/agency/tarefas", label: "Tarefas", Icon: A.check, group: "Operação" },
  { href: "/agency/agenda", label: "Agenda", Icon: A.cal, group: "Operação" },
  { href: "/agency/clientes", label: "Clientes", Icon: A.users, group: "Comercial" },
  { href: "/agency/funil", label: "Funil de vendas", Icon: A.funnel, group: "Comercial" },
  { href: "/agency/propostas", label: "Propostas & orçamentos", Icon: A.doc, group: "Comercial" },
  { href: "/agency/financeiro", label: "Financeiro", Icon: A.money, group: "Gestão" },
  { href: "/agency/equipe", label: "Equipe", Icon: A.team, group: "Gestão" },
  { href: "/agency/equipamentos", label: "Equipamentos", Icon: I.camera, group: "Gestão" },
  { href: "/agency/config", label: "Configurações", Icon: A.gear, group: "Gestão" },
];

export default function AgencyNav() {
  return <HubNav title="AGENCY" root="/agency" items={items} />;
}
