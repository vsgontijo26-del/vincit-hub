"use client";
import HubNav from "@/components/HubNav";
import { A } from "./icons";
import { I } from "@/components/icons";

const items = [
  { href: "/agency", label: "Visão geral", Icon: A.home },
  { href: "/agency/projetos", label: "Projetos", Icon: A.film, group: "01 · Operação" },
  { href: "/agency/tarefas", label: "Tarefas", Icon: A.check, group: "01 · Operação" },
  { href: "/agency/agenda", label: "Agenda", Icon: A.cal, group: "01 · Operação" },
  { href: "/agency/clientes", label: "Clientes", Icon: A.users, group: "02 · Comercial" },
  { href: "/agency/funil", label: "Funil de vendas", Icon: A.funnel, group: "02 · Comercial" },
  { href: "/agency/financeiro", label: "Financeiro", Icon: A.money, group: "02 · Comercial" },
  { href: "/agency/propostas", label: "Propostas & orçamentos", Icon: A.doc, group: "02 · Comercial" },
  { href: "/agency/equipe", label: "Equipe", Icon: A.team, group: "03 · Recursos" },
  { href: "/agency/equipamentos", label: "Equipamentos", Icon: I.camera, group: "03 · Recursos" },
];

export default function AgencyNav() {
  return <HubNav title="Gestor" desc="Operação, comercial e recursos" root="/agency" items={items} />;
}
