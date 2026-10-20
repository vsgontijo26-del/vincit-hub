"use client";
import HubNav from "@/components/HubNav";
import { A } from "./icons";
import { I } from "@/components/icons";

const items = [
  { href: "/agency", label: "Visão geral", Icon: A.home },
  { href: "/agency/clientes", label: "Clientes", Icon: A.users, group: "01 · Comercial" },
  { href: "/agency/funil", label: "Funil de vendas", Icon: A.funnel, group: "01 · Comercial" },
  { href: "/agency/financeiro", label: "Financeiro", Icon: A.money, group: "01 · Comercial" },
  { href: "/agency/propostas", label: "Propostas & orçamentos", Icon: A.doc, group: "01 · Comercial" },
  { href: "/agency/equipe", label: "Equipe", Icon: A.team, group: "02 · Recursos" },
  { href: "/agency/equipamentos", label: "Equipamentos", Icon: I.camera, group: "02 · Recursos" },
];

export default function AgencyNav() {
  return <HubNav title="Gestor" desc="Comercial e recursos" root="/agency" items={items} />;
}
