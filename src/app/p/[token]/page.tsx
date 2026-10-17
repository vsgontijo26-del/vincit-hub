"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/agency";
import Logo from "@/components/Logo";

export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const [p, setP] = useState<any>(undefined);
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { createClient().rpc("pub_get_proposal", { p_token: token }).then(({ data }) => setP(data || null)); }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { data } = await createClient().rpc("pub_accept_proposal", { p_token: token, p_name: name });
    setBusy(false); if (data) { setDone(true); setP({ ...p, status: "aceita", accepted_name: name, accepted_at: new Date().toISOString() }); }
  }

  if (p === undefined) return <main className="min-h-screen grid place-items-center text-fog">Carregando…</main>;
  if (!p) return <main className="min-h-screen grid place-items-center text-fog">Proposta não encontrada.</main>;

  const items = p.items || [];
  const base = items.reduce((a: number, i: any) => a + (i.qty || 0) * (i.days || 1) * (i.price || 0), 0);
  const gross = Number(p.total) + Number(p.discount || 0);
  const factor = base ? gross / base : 1;
  const created = new Date(p.created_at);
  const valid = new Date(created.getTime() + (p.validity_days || 15) * 864e5);
  const expired = !["aceita"].includes(p.status) && valid < new Date();
  const Sec = ({ n, t, children }: any) => (
    <section className="py-10 border-t border-line grid md:grid-cols-[180px_1fr] gap-4 md:gap-10">
      <p className="font-mono text-xs text-mint tracking-widest uppercase pt-1">{n} // {t}</p>
      <div className="text-[15px] leading-relaxed text-[#d6d7d8] whitespace-pre-wrap">{children}</div>
    </section>
  );
  let n = 0; const num = () => String(++n).padStart(2, "0");

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-10 md:py-16">
        <header className="flex items-center justify-between mb-16"><Logo className="h-7" /><span className="font-mono text-[11px] text-fog">PROPOSTA COMERCIAL</span></header>
        <p className="font-mono text-xs text-fog uppercase tracking-widest">Para {p.client_company || p.client || "você"}</p>
        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight mt-3 leading-[1.02]">{p.title}</h1>
        <p className="text-fog mt-4 text-sm">Emitida em {created.toLocaleDateString("pt-BR")} · válida até {valid.toLocaleDateString("pt-BR")}</p>

        {p.intro && <Sec n={num()} t="Olá">{p.intro}</Sec>}
        {p.scope && <Sec n={num()} t="Escopo">{p.scope}</Sec>}
        {p.deliverables && <Sec n={num()} t="Entregáveis">{p.deliverables}</Sec>}
        {p.timeline && <Sec n={num()} t="Cronograma">{p.timeline}</Sec>}

        <section className="py-10 border-t border-line">
          <p className="font-mono text-xs text-mint tracking-widest uppercase mb-6">{num()} // Investimento</p>
          <div className="card divide-y divide-line">
            {items.map((i: any, k: number) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3.5 text-sm">
                <span>{i.name}<span className="text-fog"> · {i.qty}{i.days > 1 ? ` × ${i.days} ${i.unit || ""}s` : ` ${i.unit || ""}`}</span></span>
                <span className="font-mono shrink-0">{brl((i.qty || 0) * (i.days || 1) * (i.price || 0) * factor)}</span>
              </div>
            ))}
            {Number(p.discount) > 0 && <div className="flex justify-between px-5 py-3.5 text-sm text-mint"><span>Desconto</span><span className="font-mono">− {brl(p.discount)}</span></div>}
            <div className="flex justify-between items-end px-5 py-5"><span className="text-fog text-sm">Total</span><span className="font-display text-3xl md:text-4xl font-extrabold text-mint">{brl(p.total)}</span></div>
          </div>
        </section>

        {p.payment_terms && <Sec n={num()} t="Pagamento">{p.payment_terms}</Sec>}
        {p.company_about && <Sec n={num()} t="Quem somos">{p.company_about}</Sec>}

        <section className="py-10 border-t border-line">
          {p.status === "aceita" ? (
            <div className="card p-6 border-mint-dim bg-mint/[.05] text-center">
              <p className="font-display text-2xl font-bold text-mint">{done ? "Proposta aceita. Obrigado!" : "Proposta aceita"}</p>
              <p className="text-fog text-sm mt-2">Por {p.accepted_name} em {new Date(p.accepted_at).toLocaleString("pt-BR")}. {done && "Vamos entrar em contato para os próximos passos."}</p>
            </div>
          ) : p.status === "recusada" ? <p className="text-fog text-center">Esta proposta foi encerrada.</p> : expired ? <p className="text-fog text-center">Esta proposta expirou. Fale com a gente para atualizar os valores.</p> : (
            <form onSubmit={accept} className="card p-6 md:p-8">
              <p className="font-display text-2xl font-bold">Vamos fazer acontecer?</p>
              <p className="text-fog text-sm mt-1 mb-5">Digite seu nome completo para aceitar esta proposta.</p>
              <div className="flex flex-col md:flex-row gap-2"><input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" /><button disabled={busy} className="btn btn-mint">Aceitar proposta</button></div>
            </form>
          )}
        </section>
        <footer className="pt-10 text-xs text-fog flex flex-wrap gap-x-4 gap-y-1">{[p.company, p.cnpj && `CNPJ ${p.cnpj}`, p.company_email, p.company_phone].filter(Boolean).map((x: string) => <span key={x}>{x}</span>)}</footer>
      </div>
    </main>
  );
}
