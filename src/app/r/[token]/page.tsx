"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

function embed(url: string) {
  if (!url) return null;
  let m;
  if ((m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/))) return `https://drive.google.com/file/d/${m[1]}/preview`;
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/))) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
  if ((m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/))) return `https://www.youtube.com/embed/${m[1]}`;
  if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return url;
  return null;
}

export default function Review() {
  const { token } = useParams<{ token: string }>();
  const [p, setP] = useState<any>(undefined);
  const [mode, setMode] = useState<"" | "alteracao">("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => createClient().rpc("pub_get_review", { p_token: token }).then(({ data }) => setP(data || null));
  useEffect(() => { load(); }, [token]);

  async function submit(decision: "aprovado" | "alteracao") {
    if (decision === "alteracao" && !comment.trim()) return;
    setBusy(true);
    const { data } = await createClient().rpc("pub_submit_review", { p_token: token, p_decision: decision, p_comment: comment, p_name: name });
    setBusy(false);
    if (data) { setSent(decision); setComment(""); setMode(""); load(); }
  }

  if (p === undefined) return <main className="min-h-screen grid place-items-center text-fog">Carregando…</main>;
  if (!p) return <main className="min-h-screen grid place-items-center text-fog">Link inválido.</main>;
  const src = embed(p.delivery_url);
  const isFile = src && /\.(mp4|mov|webm)(\?|$)/i.test(src);

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <header className="flex items-center justify-between mb-10"><Logo className="h-6" /><span className="font-mono text-[11px] text-fog">APROVAÇÃO DE ENTREGA</span></header>
        <p className="font-mono text-xs text-fog uppercase tracking-widest">{p.client || "Cliente"}{p.type ? ` · ${p.type}` : ""}</p>
        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mt-2">{p.title}</h1>
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 mt-8">
          <div className="card overflow-hidden bg-black">
            {!p.delivery_url ? <div className="aspect-video grid place-items-center text-fog">A entrega ainda não foi enviada.</div>
              : isFile ? <video src={src!} controls className="w-full aspect-video bg-black" />
              : src ? <iframe src={src} className="w-full aspect-video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              : <div className="aspect-video grid place-items-center p-6 text-center"><div><p className="text-fog mb-4">Abra o material no link abaixo:</p><a href={p.delivery_url} target="_blank" className="btn btn-mint">Abrir entrega</a></div></div>}
          </div>
          <aside className="card p-5 h-fit">
            {p.review_status === "aprovado" ? (
              <div className="text-center py-4"><p className="font-display text-2xl font-bold text-mint">Aprovado ✓</p><p className="text-fog text-sm mt-2">{sent ? "Obrigado! Recebemos sua aprovação." : "Esta versão já foi aprovada."}</p></div>
            ) : p.review_status === "alteracao" && !sent ? (
              <div className="py-2"><p className="font-display text-lg font-bold">Alterações recebidas</p><p className="text-fog text-sm mt-1">Estamos ajustando. Você receberá um novo link quando a próxima versão estiver pronta.</p></div>
            ) : sent === "alteracao" ? (
              <div className="py-2"><p className="font-display text-lg font-bold text-mint">Pedido enviado</p><p className="text-fog text-sm mt-1">Recebemos suas observações e já vamos ajustar.</p></div>
            ) : (
              <>
                <p className="font-display text-lg font-bold">O que achou?</p>
                <p className="text-fog text-sm mt-1 mb-4">Assista e aprove, ou descreva o que precisa mudar (de preferência com a minutagem, ex.: 0:42).</p>
                <label className="label">Seu nome</label>
                <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
                {mode === "alteracao" && <><label className="label">O que alterar?</label><textarea className="input mb-3" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="0:42 trocar a música… / 1:10 corrigir o nome…" /></>}
                <div className="flex flex-col gap-2">
                  {mode !== "alteracao" ? <>
                    <button disabled={busy || !p.delivery_url} onClick={() => submit("aprovado")} className="btn btn-mint">Aprovar entrega</button>
                    <button onClick={() => setMode("alteracao")} className="btn btn-ghost">Sugerir alteração</button>
                  </> : <>
                    <button disabled={busy || !comment.trim()} onClick={() => submit("alteracao")} className="btn btn-mint">Enviar alterações</button>
                    <button onClick={() => setMode("")} className="btn btn-ghost">Voltar</button>
                  </>}
                </div>
              </>
            )}
            {p.delivery_url && <a href={p.delivery_url} target="_blank" className="block text-xs text-fog hover:text-mint mt-5">Abrir arquivo original ↗</a>}
          </aside>
        </div>
        {!!p.history?.length && (
          <section className="mt-10"><p className="font-mono text-xs text-fog uppercase tracking-widest mb-3">Histórico</p>
            <ul className="space-y-2">{p.history.map((h: any, i: number) => <li key={i} className="text-sm flex gap-3"><span className="text-fog text-xs w-28 shrink-0">{new Date(h.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span><span>{h.kind === "cliente" && <span className="text-mint">{h.author}: </span>}{h.text}</span></li>)}</ul>
          </section>
        )}
      </div>
    </main>
  );
}
