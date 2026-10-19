"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { isValidCPF, maskCPF, maskPhone, onlyDigits } from "@/lib/br";

function Eye({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete, min = 8 }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; min?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input pr-11" type={show ? "text" : "password"} required minLength={min} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-0 top-0 h-full px-3.5 text-fog hover:text-paper" aria-label={show ? "Ocultar senha" : "Mostrar senha"} title={show ? "Ocultar senha" : "Mostrar senha"}><Eye open={!show} /></button>
    </div>
  );
}

const RULES: [string, (p: string) => boolean][] = [
  ["8+ caracteres", (p) => p.length >= 8],
  ["letra maiúscula", (p) => /[A-Z]/.test(p)],
  ["número", (p) => /\d/.test(p)],
];

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // link de convite: /login?cadastro=1&email=...
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("cadastro")) setMode("up");
    const e = q.get("email"); if (e) setEmail(e);
  }, []);

  const cpfDigits = onlyDigits(cpf);
  const cpfOk = isValidCPF(cpfDigits);
  const nameOk = name.trim().split(/\s+/).filter(Boolean).length >= 2;
  const phoneOk = onlyDigits(phone).length >= 10;
  const passOk = RULES.every(([, f]) => f(password));
  const matchOk = password === password2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createClient();
    if (mode === "in") {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ t: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message === "Email not confirmed" ? "Confirme seu e-mail pelo link que enviamos antes de entrar." : error.message });
      else window.location.href = "/";
      setBusy(false);
      return;
    }
    setTouched(true);
    if (!nameOk) return setMsg({ t: "Informe nome e sobrenome." });
    if (!cpfOk) return setMsg({ t: "CPF inválido. Confira os números." });
    if (!phoneOk) return setMsg({ t: "Informe um WhatsApp com DDD." });
    if (!passOk) return setMsg({ t: "A senha precisa de 8 caracteres, uma letra maiúscula e um número." });
    if (!matchOk) return setMsg({ t: "As senhas não conferem." });
    if (!terms) return setMsg({ t: "Aceite os termos e a política de privacidade para continuar." });
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/auth/callback`, data: { name: name.trim(), cpf: cpfDigits, phone: onlyDigits(phone), terms: true } },
    });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      setMsg({ t: /database error|CPF_/i.test(m) ? "Não foi possível criar a conta: este CPF já está cadastrado ou é inválido." : /already registered|already exists/i.test(m) ? "Este e-mail já tem conta. Entre ou recupere a senha." : m });
    } else if (data.session) window.location.href = "/";
    else { setMsg({ t: "Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, seu acesso será liberado pelo administrador.", ok: true }); }
  }

  async function forgot() {
    if (!email) return setMsg({ t: "Digite seu e-mail acima para receber o link de redefinição." });
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/conta` });
    setBusy(false);
    setMsg(error ? { t: error.message } : { t: "Se houver uma conta com esse e-mail, enviamos o link para redefinir a senha.", ok: true });
  }

  const Hint = ({ ok, text }: { ok: boolean; text: string }) => <p className={`text-[11px] mt-1 ${ok ? "text-mint" : "text-danger"}`}>{ok ? "✓ " : ""}{text}</p>;

  return (
    <main className="relative z-10 min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-[radial-gradient(ellipse_at_20%_100%,rgba(110,239,182,.12),transparent_60%)]">
        <div className="self-start"><Logo className="h-8" /></div>
        <div>
          <p className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight max-w-md">
            Uma central para criar, vender e <span className="text-mint">entregar</span>.
          </p>
          <p className="text-fog mt-5 max-w-sm">CREATOR para conteúdo estratégico. AGENCY para operar a produtora. Tudo no mesmo lugar.</p>
        </div>
        <p className="text-xs text-fog font-mono">VINCIT HUB · v0.1</p>
      </section>
      <section className="flex items-center justify-center p-6 py-10">
        <form onSubmit={submit} className="w-full max-w-sm rise" noValidate={mode === "up"}>
          <div className="lg:hidden mb-10"><Logo className="h-7" /></div>
          <h1 className="font-display text-3xl font-bold">{mode === "in" ? "Entrar" : "Criar acesso"}</h1>
          <p className="text-fog text-sm mt-1 mb-8">{mode === "in" ? "Acesse o VINCIT HUB." : "Preencha seus dados. O acesso é liberado após a confirmação do e-mail e a aprovação do administrador."}</p>

          {mode === "up" && (
            <div className="space-y-4 mb-4">
              <div>
                <label className="label">Nome completo</label>
                <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name" />
                {touched && !nameOk && <Hint ok={false} text="Informe nome e sobrenome" />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">CPF</label>
                  <input className="input" inputMode="numeric" required value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
                  {cpfDigits.length === 11 ? <Hint ok={cpfOk} text={cpfOk ? "CPF válido" : "CPF inválido"} /> : touched && <Hint ok={false} text="Informe o CPF" />}
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input" inputMode="tel" required value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" autoComplete="tel" />
                  {touched && !phoneOk && <Hint ok={false} text="Com DDD" />}
                </div>
              </div>
            </div>
          )}

          <label className="label">E-mail</label>
          <input className="input mb-4" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" autoComplete="email" />

          <label className="label">Senha</label>
          <PasswordInput value={password} onChange={setPassword} placeholder={mode === "in" ? "Sua senha" : "Crie uma senha"} autoComplete={mode === "in" ? "current-password" : "new-password"} min={mode === "in" ? 1 : 8} />
          {mode === "up" && password && <div className="flex flex-wrap gap-x-3 mt-1.5">{RULES.map(([l, f]) => <span key={l} className={`text-[11px] ${f(password) ? "text-mint" : "text-fog"}`}>{f(password) ? "✓" : "·"} {l}</span>)}</div>}

          {mode === "up" && (
            <div className="mt-4">
              <label className="label">Confirmar senha</label>
              <PasswordInput value={password2} onChange={setPassword2} placeholder="Repita a senha" autoComplete="new-password" />
              {password2 && !matchOk && <Hint ok={false} text="As senhas não conferem" />}
              <label className="flex items-start gap-2.5 mt-5 text-sm text-fog cursor-pointer">
                <input type="checkbox" className="accent-[var(--color-mint)] mt-0.5" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>Li e aceito os termos de uso e a <Link href="/privacidade" target="_blank" className="text-mint hover:underline">política de privacidade</Link>. Meu CPF é usado só para identificar minha conta.</span>
              </label>
            </div>
          )}

          {mode === "in" && <div className="flex justify-end mt-2"><button type="button" onClick={forgot} className="text-xs text-fog hover:text-mint">Esqueci minha senha</button></div>}

          <button disabled={busy} className="btn btn-mint w-full mt-6">{busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}</button>
          {msg && <p className={`text-sm mt-4 ${msg.ok ? "text-mint" : "text-danger"}`}>{msg.t}</p>}
          <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); setTouched(false); }} className="text-sm text-fog hover:text-paper mt-6">
            {mode === "in" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
          </button>
        </form>
      </section>
    </main>
  );
}
