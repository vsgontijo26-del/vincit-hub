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

/** aprovação de um conteúdo pelo cliente, sem login */
export default function ContentReview() {
  const { token } = useParams<{ token: string }>();
  const [p, setP] = useState<any>(undefined);
  const [mode, setMode] = useState<"" | "ajuste">("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => createClient().rpc("content_approval_get", { p_token: token }).then(({ data }) => setP(data || null));
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(decision: "aprovado" | "ajuste") {
    if (decision === "ajuste" && !comment.trim()) return;
    setBusy(true);
    const { data } = await createClient().rpc("content_approval_answer", { p_token: token, p_decision: decision, p_comment: comment, p_name: name });
    setBusy(false);
    if (data) { setSent(decision); setComment(""); setMode(""); load(); }
  }

  if (p === undefined) return <main className="min-h-screen grid place-items-center text-fog">Carregando…</main>;
  if (!p) return <main className="min-h-screen grid place-items-center text-fog">Link inválido.</main>;
  // só links http(s) chegam ao cliente
  const url: string = /^https?:\/\//i.test(p.final_url || "") ? p.final_url : "";
  const src = embed(url);
  const isFile = src && /\.(mp4|mov|webm)(\?|$)/i.test(src);

  return (
    <main className="relative z-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <header className="flex items-center justify-between mb-10"><Logo className="h-6" /><span className="font-mono text-[11px] text-fog">APROVAÇÃO DE CONTEÚDO</span></header>
        <p className="font-mono text-xs text-fog uppercase tracking-widest">{p.client || (p.username ? `@${p.username}` : "Conteúdo")}{p.format ? ` · ${p.format}` : ""}{p.planned_for ? ` · ${new Date(p.planned_for + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mt-2">{p.title}</h1>
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 mt-8">
          <div className="space-y-4">
            <div className="card overflow-hidden bg-black">
              {!url ? <div className="aspect-video grid place-items-center text-fog">O material ainda não foi enviado.</div>
                : isFile ? <video src={src!} controls className="w-full aspect-video bg-black" />
                : src ? <iframe src={src} className="w-full aspect-video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                : <div className="aspect-video grid place-items-center p-6 text-center"><div><p className="text-fog mb-4">Abra o material no link abaixo:</p><a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-mint">Abrir material</a></div></div>}
            </div>
            {p.caption && <div className="card p-5"><p className="label">Legenda</p><p className="text-sm whitespace-pre-wrap">{p.caption}</p></div>}
          </div>
          <aside className="card p-5 h-fit">
            {p.approval === "aprovado" ? (
              <div className="text-center py-4"><p className="font-display text-2xl font-bold text-mint">Aprovado ✓</p><p className="text-fog text-sm mt-2">{sent ? "Obrigado! Recebemos sua aprovação." : "Este conteúdo já foi aprovado."}</p></div>
            ) : sent === "ajuste" ? (
              <div className="py-2"><p className="font-display text-lg font-bold text-mint">Pedido enviado</p><p className="text-fog text-sm mt-1">Recebemos suas observações e já vamos ajustar.</p></div>
            ) : p.approval !== "pendente" ? (
              <div className="py-2"><p className="font-display text-lg font-bold">Em ajuste</p><p className="text-fog text-sm mt-1">Estamos ajustando. Você poderá aprovar por este mesmo link quando a próxima versão estiver pronta.</p></div>
            ) : (
              <>
                <p className="font-display text-lg font-bold">O que achou?</p>
                <p className="text-fog text-sm mt-1 mb-4">Aprove ou descreva o que precisa mudar (no vídeo, de preferência com a minutagem, ex.: 0:42).</p>
                <label className="label">Seu nome</label>
                <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
                {mode === "ajuste" && <><label className="label">O que ajustar?</label><textarea className="input mb-3" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="0:42 trocar a música… / legenda: corrigir o nome…" /></>}
                <div className="flex flex-col gap-2">
                  {mode !== "ajuste" ? <>
                    <button disabled={busy} onClick={() => submit("aprovado")} className="btn btn-mint">Aprovar conteúdo</button>
                    <button onClick={() => setMode("ajuste")} className="btn btn-ghost">Pedir ajuste</button>
                  </> : <>
                    <button disabled={busy || !comment.trim()} onClick={() => submit("ajuste")} className="btn btn-mint">Enviar ajustes</button>
                    <button onClick={() => setMode("")} className="btn btn-ghost">Voltar</button>
                  </>}
                </div>
              </>
            )}
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-fog hover:text-mint mt-5">Abrir arquivo original ↗</a>}
          </aside>
        </div>
      </div>
    </main>
  );
}
