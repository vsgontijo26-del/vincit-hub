"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { I } from "@/components/icons";
import { hideCPF, maskPhone } from "@/lib/br";

export default function Conta() {
  const [p, setP] = useState<any>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);

  useEffect(() => {
    const s = createClient();
    s.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await s.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      setP(prof || { email: data.user.email });
      const { data: acc } = await s.rpc("my_access");
      setPlan((acc as any)?.plan || null);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8 || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return setMsg({ t: "A senha precisa de 8 caracteres, uma letra maiúscula e um número." });
    if (pw !== pw2) return setMsg({ t: "As senhas não conferem." });
    const { error } = await createClient().auth.updateUser({ password: pw });
    setMsg(error ? { t: error.message } : { t: "Senha atualizada.", ok: true });
    if (!error) { setPw(""); setPw2(""); }
  }

  return (
    <main className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between px-5 md:px-10 py-5 border-b border-line">
        <Link href="/"><Logo className="h-6" /></Link>
        <Link href="/" className="btn btn-ghost btn-sm"><I.back className="w-3.5 h-3.5" />Hubs</Link>
      </header>
      <div className="max-w-xl mx-auto px-5 py-10 space-y-5">
        <h1 className="font-display text-3xl font-extrabold">Minha conta</h1>
        {p && (
          <section className="card p-5 grid grid-cols-2 gap-4 text-sm">
            <div><p className="label">Nome</p><p>{p.name || "–"}</p></div>
            <div><p className="label">E-mail</p><p className="truncate">{p.email}</p></div>
            <div><p className="label">CPF</p><p className="font-mono">{hideCPF(p.cpf)}</p></div>
            <div><p className="label">WhatsApp</p><p>{p.phone ? maskPhone(p.phone) : "–"}</p></div>
            <div><p className="label">Plano</p><p>{p.role === "superadmin" ? "Administrador" : plan || "–"}</p></div>
            <div><p className="label">Validade</p><p>{p.expires_at ? new Date(p.expires_at + "T12:00:00").toLocaleDateString("pt-BR") : "Sem vencimento"}</p></div>
            <p className="col-span-2 text-xs text-fog">Para alterar nome, CPF ou plano, fale com o administrador.</p>
          </section>
        )}
        <form onSubmit={save} className="card p-5 space-y-3">
          <p className="font-display font-bold">Alterar senha</p>
          <div className="relative"><input className="input pr-11" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nova senha" autoComplete="new-password" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-0 top-0 h-full px-3.5 text-fog hover:text-paper text-xs">{show ? "Ocultar" : "Mostrar"}</button></div>
          <input className="input" type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
          <button className="btn btn-mint w-full">Salvar nova senha</button>
          {msg && <p className={`text-sm ${msg.ok ? "text-mint" : "text-danger"}`}>{msg.t}</p>}
        </form>
      </div>
    </main>
  );
}
