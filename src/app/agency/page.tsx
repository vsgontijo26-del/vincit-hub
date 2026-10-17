import Link from "next/link";
import Logo from "@/components/Logo";
import { I } from "@/components/icons";

const mods = [
  ["Propostas", "Gerador de propostas de serviço com a identidade VINCIT, pronto para enviar ao cliente."],
  ["Calculadora de orçamento", "Diárias, equipe, equipamentos, edição e margem calculados por tipo de projeto."],
  ["Financeiro", "Entradas, saídas, contas a receber e fluxo de caixa por projeto."],
  ["CRM", "Clientes, contatos e funil de negociação."],
  ["Tarefas", "To-do por projeto e por pessoa, com prazos."],
  ["Equipamentos", "Inventário, reservas por diária e manutenção."],
];

export default function Agency() {
  return (
    <main className="relative z-10 min-h-screen px-5 md:px-10 py-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between pb-6 border-b border-line">
        <Link href="/" className="flex items-center gap-2 text-sm text-fog hover:text-paper"><I.back className="w-4 h-4" /> Hubs</Link>
        <Logo className="h-5" />
      </header>
      <p className="font-mono text-xs text-fog tracking-widest uppercase mt-14">Em construção</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight mt-2">AGENCY</h1>
      <p className="text-fog mt-3 max-w-lg">O sistema de gestão da produtora. Estes são os módulos planejados:</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-10">
        {mods.map(([t, d], i) => (
          <div key={t} className="card p-5 rise" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="font-display font-bold text-lg">{t}</p>
            <p className="text-fog text-sm mt-1">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
