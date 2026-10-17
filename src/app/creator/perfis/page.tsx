"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts, fmt } from "@/lib/useAccounts";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

export default function Perfis() {
  const { accounts, loading, reload } = useAccounts();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ username: "", niche: "", goals: "", followers_count: "" });
  const [notice, setNotice] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("conectado")) setNotice({ ok: true, t: `${q.get("conectado")} conta(s) conectada(s). Clique em sincronizar para puxar os posts.` });
    if (q.get("erro")) setNotice({ ok: false, t: q.get("erro")! });
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().from("ig_accounts").insert({
      username: form.username.replace(/^@/, "").trim(), niche: form.niche || null, goals: form.goals || null,
      followers_count: form.followers_count ? Number(form.followers_count) : null,
    });
    if (error) return setNotice({ ok: false, t: error.message.includes("duplicate") ? "Esse perfil já está cadastrado." : error.message });
    setForm({ username: "", niche: "", goals: "", followers_count: "" }); setShow(false); reload();
  }

  return (
    <>
      <PageHead kicker="CREATOR · 01 BASE" title="Perfis & marca" desc="A base de tudo: conecte perfis pela Meta (ou cadastre manualmente) e defina nicho, objetivos e voz da marca em Desempenho.">
        <button className="btn btn-ghost" onClick={() => setShow(!show)}><I.plus className="w-4 h-4" />Manual</button>
        <a href="/api/meta/connect" className="btn btn-mint"><I.camera className="w-4 h-4" />Conectar via Meta</a>
      </PageHead>

      {notice && <div className={`card px-4 py-3 mb-5 text-sm ${notice.ok ? "border-mint-dim text-mint" : "border-danger/40 text-danger"}`}>{notice.t}</div>}

      {show && (
        <form onSubmit={add} className="card p-5 mb-6 grid md:grid-cols-2 gap-4 rise">
          <div><label className="label">@ do perfil</label><input required className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="@vincit" /></div>
          <div><label className="label">Seguidores (opcional)</label><input type="number" className="input" value={form.followers_count} onChange={(e) => setForm({ ...form, followers_count: e.target.value })} /></div>
          <div><label className="label">Nicho</label><input className="input" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="produtora audiovisual, bastidores, vídeo para marcas" /></div>
          <div><label className="label">Objetivos</label><input className="input" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} placeholder="gerar leads de empresas, autoridade" /></div>
          <div className="md:col-span-2 flex gap-2 justify-end"><button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>Cancelar</button><button className="btn btn-mint">Salvar perfil</button></div>
        </form>
      )}

      {loading ? <p className="text-fog">Carregando…</p> : !accounts.length ? (
        <div className="card p-10 text-center">
          <p className="font-display text-xl font-bold">Nenhum perfil ainda</p>
          <p className="text-fog text-sm mt-2 max-w-md mx-auto">Para conectar via Meta o perfil precisa ser Profissional (Creator ou Business) e estar vinculado a uma Página do Facebook.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a, i) => (
            <Link key={a.id} href={`/creator/desempenho/${a.id}`} className="card p-5 hover:border-mint transition-colors rise" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="flex items-center gap-3">
                {a.profile_picture_url ? <img src={a.profile_picture_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-panel2 grid place-items-center font-display font-bold text-mint">{a.username[0]?.toUpperCase()}</div>}
                <div className="min-w-0">
                  <p className="font-semibold truncate">@{a.username}</p>
                  <span className={`chip mt-1 ${a.connected ? "chip-mint" : ""}`}>{a.connected ? "Conectado à Meta" : "Manual"}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5 text-center">
                {[["Seguidores", a.followers_count], ["Seguindo", a.follows_count], ["Posts", a.media_count]].map(([k, v]) => (
                  <div key={k as string} className="bg-panel2 rounded-lg py-2.5"><p className="font-mono text-sm">{fmt(v)}</p><p className="text-[11px] text-fog mt-0.5">{k}</p></div>
                ))}
              </div>
              {a.niche && <p className="text-xs text-fog mt-4 truncate">Nicho: {a.niche}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
