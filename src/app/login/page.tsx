"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const supabase = createClient();
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      else window.location.href = "/";
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
      if (error) setMsg(error.message);
      else if (data.session) window.location.href = "/";
      else setMsg("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.");
    }
    setBusy(false);
  }

  return (
    <main className="relative z-10 min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-[radial-gradient(ellipse_at_20%_100%,rgba(110,239,182,.12),transparent_60%)]">
        <Logo className="h-8" />
        <div>
          <p className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight max-w-md">
            Uma central para criar, vender e <span className="text-mint">entregar</span>.
          </p>
          <p className="text-fog mt-5 max-w-sm">CREATOR para conteúdo estratégico. AGENCY para operar a produtora. Tudo no mesmo lugar.</p>
        </div>
        <p className="text-xs text-fog font-mono">VINCIT HUB · v0.1</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm rise">
          <div className="lg:hidden mb-10"><Logo className="h-7" /></div>
          <h1 className="font-display text-3xl font-bold">{mode === "in" ? "Entrar" : "Criar acesso"}</h1>
          <p className="text-fog text-sm mt-1 mb-8">{mode === "in" ? "Acesse o VINCIT HUB." : "Crie seu usuário do VINCIT HUB."}</p>
          <label className="label">E-mail</label>
          <input className="input mb-4" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@vincit.com" />
          <label className="label">Senha</label>
          <input className="input mb-6" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
          <button disabled={busy} className="btn btn-mint w-full">{busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}</button>
          {msg && <p className="text-sm mt-4 text-mint">{msg}</p>}
          <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="text-sm text-fog hover:text-paper mt-6">
            {mode === "in" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
          </button>
        </form>
      </section>
    </main>
  );
}
