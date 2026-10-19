import QRCode from "qrcode";
import { createAnonClient } from "@/lib/supabase/server";
import { pixPayload, chargeAmount } from "@/lib/pix";
import { brl } from "@/lib/agency";
import Logo from "@/components/Logo";
import CopyButton from "@/components/CopyButton";
import InformPayment from "./InformPayment";

export const dynamic = "force-dynamic";
const fmtD = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export default async function Cobranca({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: c } = await createAnonClient().rpc("pub_get_charge", { p_token: token });
  if (!c) return <main className="min-h-screen grid place-items-center p-6"><div className="card p-8 text-center"><p className="font-display text-xl font-bold">Cobrança não encontrada</p><p className="text-fog text-sm mt-2">Confira o link com quem te enviou.</p></div></main>;
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const v = chargeAmount(c, today);
  const paid = c.status === "pago", cancelled = c.status === "cancelado";
  const pix = c.methods?.includes("pix") && c.pix_key ? pixPayload({ key: c.pix_key, name: c.pix_name || c.company?.name || "", city: c.pix_city || "", amount: Math.round(v.value * 100) / 100, txid: token.replace(/-/g, "").slice(0, 25), description: c.description }) : null;
  const qr = pix ? await QRCode.toDataURL(pix, { margin: 1, width: 280, color: { dark: "#0c0c0d", light: "#ffffff" } }) : null;

  return (
    <main className="relative z-10 min-h-screen px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="font-display font-bold text-lg">{c.company?.name || "Cobrança"}</p>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${paid ? "bg-mint/15 text-mint" : cancelled ? "bg-panel2 text-fog" : v.daysLate > 0 ? "bg-danger/15 text-danger" : "bg-[#f5c84c]/15 text-[#f5c84c]"}`}>{paid ? "Pago" : cancelled ? "Cancelada" : c.status === "informado" ? "Pagamento informado" : v.daysLate > 0 ? `Vencida há ${v.daysLate} dia(s)` : "Em aberto"}</span>
        </div>
        <div className="card p-6">
          {c.customer_name && <p className="text-sm text-fog">Olá, {c.customer_name}</p>}
          <p className="font-semibold mt-1">{c.description}{c.installment ? ` · parcela ${c.installment}` : ""}</p>
          <p className="font-display text-4xl font-extrabold mt-4 tabular-nums">{brl(paid ? Number(c.amount) : v.value)}</p>
          <p className="text-sm text-fog mt-1">Vencimento {fmtD(c.due_date)}</p>
          {!paid && v.discount > 0 && <p className="text-xs text-mint mt-2">Desconto de {brl(v.discount)} para pagamento até {fmtD(new Date(new Date(c.due_date + "T12:00").getTime() - c.discount_days * 864e5).toISOString().slice(0, 10))}.</p>}
          {!paid && v.daysLate > 0 && <p className="text-xs text-danger mt-2">Inclui multa de {brl(v.fine)} e juros de {brl(v.interest)} ({v.daysLate} dia(s) de atraso). Valor original {brl(Number(c.amount))}.</p>}
          {paid && <p className="text-sm text-mint mt-3">Pagamento confirmado{c.paid_at ? ` em ${fmtD(c.paid_at)}` : ""}. Obrigado!</p>}
        </div>

        {!paid && !cancelled && (
          <div className="space-y-4 mt-4">
            {pix && qr && (
              <div className="card p-6 text-center">
                <p className="font-display font-bold">Pague com Pix</p>
                <p className="text-xs text-fog mt-1">Abra o app do seu banco e escaneie, ou use o copia e cola.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code Pix" className="mx-auto mt-4 rounded-xl w-56 h-56" />
                <div className="mt-4 bg-panel2 rounded-lg p-2.5 text-[11px] font-mono break-all text-left">{pix}</div>
                <div className="mt-3 flex justify-center"><CopyButton text={pix} label="Copiar código Pix" /></div>
                <p className="text-[11px] text-fog mt-3">Recebedor: {c.pix_name || c.company?.name}</p>
              </div>
            )}
            {c.methods?.includes("link") && c.payment_link && (
              <a href={c.payment_link} target="_blank" rel="noopener noreferrer" className="btn btn-mint w-full">Pagar com cartão ou boleto</a>
            )}
            {c.methods?.includes("transferencia") && c.bank_info && (
              <div className="card p-5"><p className="font-display font-bold mb-2">Transferência bancária</p><p className="text-sm whitespace-pre-wrap">{c.bank_info}</p></div>
            )}
            {c.status === "informado" ? <p className="text-center text-sm text-fog">Você informou o pagamento em {new Date(c.informed_at).toLocaleDateString("pt-BR")}. Assim que confirmarmos, esta página será atualizada.</p> : <InformPayment token={token} />}
          </div>
        )}

        <div className="text-center text-[11px] text-fog mt-8 space-y-1">
          {c.company?.cnpj && <p>{c.company.name} · CNPJ {c.company.cnpj}</p>}
          {(c.company?.email || c.company?.phone) && <p>{[c.company.email, c.company.phone].filter(Boolean).join(" · ")}</p>}
          <p className="flex items-center justify-center gap-1.5 pt-2 opacity-70">by <Logo className="h-3" /> HUB</p>
        </div>
      </div>
    </main>
  );
}
