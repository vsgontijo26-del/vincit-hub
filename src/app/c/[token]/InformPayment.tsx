"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InformPayment({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    await createClient().rpc("pub_inform_charge", { p_token: token, p_note: note });
    setDone(true);
  }
  if (done) return <p className="text-center text-sm text-mint">Obrigado! Avisamos o recebedor. A confirmação aparece aqui em breve.</p>;
  return open ? (
    <form onSubmit={send} className="card p-5 space-y-3">
      <p className="font-semibold">Já fez o pagamento?</p>
      <textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional: banco, horário, nome de quem pagou…" />
      <button className="btn btn-mint w-full">Informar pagamento</button>
    </form>
  ) : <button onClick={() => setOpen(true)} className="btn btn-ghost w-full">Já paguei</button>;
}
