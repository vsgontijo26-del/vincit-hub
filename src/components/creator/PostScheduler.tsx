"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/lib/useAccounts";
import Modal from "@/components/agency/Modal";
import { I } from "@/components/icons";

const KINDS: Record<string, { l: string; d: string; accept: string; multi?: boolean }> = {
  image: { l: "Post (imagem)", d: "1 imagem JPG no feed", accept: "image/jpeg,image/png" },
  carousel: { l: "Carrossel", d: "2 a 10 imagens ou vídeos", accept: "image/jpeg,image/png,video/mp4,video/quicktime", multi: true },
  reels: { l: "Reels", d: "Vídeo vertical MP4/MOV até 15 min", accept: "video/mp4,video/quicktime" },
  story: { l: "Story", d: "Imagem ou vídeo vertical", accept: "image/jpeg,image/png,video/mp4,video/quicktime" },
};
const STATUS: Record<string, { l: string; c: string }> = {
  rascunho: { l: "Rascunho", c: "#8a8f94" }, agendado: { l: "Agendado", c: "#7aa7ff" }, publicando: { l: "Publicando", c: "#f5c84c" }, publicado: { l: "Publicado", c: "#6eefb6" }, erro: { l: "Erro", c: "#ff6b6b" },
};
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
const isVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u);

export default function PostScheduler() {
  const { accounts } = useAccounts();
  const [posts, setPosts] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [view, setView] = useState<"cal" | "list">("cal");
  const [f, setF] = useState<any>(null);
  const [up, setUp] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: p }, { data: i }] = await Promise.all([
      s.from("scheduled_posts").select("*, ig_accounts(username)").order("scheduled_at", { ascending: true, nullsFirst: true }),
      s.from("content_ideas").select("id,title,body,format,status,planned_for").neq("status", "publicado").order("created_at", { ascending: false }).limit(40),
    ]);
    setPosts(p || []); setIdeas(i || []);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d >= 1 && d <= days ? `${y}-${pad(m + 1)}-${pad(d)}` : null; });
  const byDay = useMemo(() => { const o: Record<string, any[]> = {}; posts.forEach((p) => { if (p.scheduled_at) (o[localDate(p.scheduled_at).slice(0, 10)] ||= []).push(p); }); return o; }, [posts]);
  const today = localDate(new Date().toISOString()).slice(0, 10);

  function openNew(date?: string) {
    setErr(null);
    const acc = accounts.find((a) => a.connected) || accounts[0];
    setF({ account_id: acc?.id || "", kind: "image", media_urls: [], caption: "", date: date || today, time: "18:00", cover_url: "" });
  }
  function openEdit(p: any) {
    setErr(null);
    const l = p.scheduled_at ? localDate(p.scheduled_at) : "";
    setF({ ...p, date: l.slice(0, 10) || today, time: l.slice(11, 16) || "18:00" });
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUp(true); setErr(null);
    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await s.storage.from("midia").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { setErr(`Falha ao enviar ${file.name}: ${error.message}`); continue; }
      urls.push(s.storage.from("midia").getPublicUrl(path).data.publicUrl);
    }
    setF((x: any) => ({ ...x, media_urls: KINDS[x.kind].multi ? [...x.media_urls, ...urls].slice(0, 10) : urls.slice(0, 1) }));
    setUp(false);
  }
  async function save(status: "rascunho" | "agendado" | "agora") {
    setErr(null);
    if (!f.account_id) return setErr("Escolha o perfil.");
    if (!f.media_urls.length) return setErr("Adicione a mídia.");
    if (f.kind === "carousel" && f.media_urls.length < 2) return setErr("Carrossel precisa de pelo menos 2 itens.");
    if (f.kind === "image" && isVideo(f.media_urls[0])) return setErr("Para vídeo, use Reels.");
    if (f.kind === "reels" && !isVideo(f.media_urls[0])) return setErr("Reels precisa de um vídeo MP4 ou MOV.");
    if ((f.caption || "").length > 2200) return setErr("A legenda passa de 2.200 caracteres.");
    if (((f.caption || "").match(/#[\p{L}\d_]+/gu) || []).length > 5) return setErr("O Instagram aceita no máximo 5 hashtags.");
    const when = status === "agora" ? new Date() : new Date(`${f.date}T${f.time}:00-03:00`);
    if (status === "agendado" && when.getTime() < Date.now() - 60000) return setErr("Escolha um horário no futuro (ou use Publicar agora).");
    const row = { account_id: f.account_id, kind: f.kind, media_urls: f.media_urls, caption: f.caption || null, cover_url: f.cover_url || null, scheduled_at: when.toISOString(), status: status === "rascunho" ? "rascunho" : "agendado", error: null, idea_id: f.idea_id || null, updated_at: new Date().toISOString() };
    const s = createClient();
    const { error } = f.id ? await s.from("scheduled_posts").update(row).eq("id", f.id) : await s.from("scheduled_posts").insert(row);
    if (error) return setErr(error.message);
    setF(null); load();
  }
  async function del(p: any) { if (!confirm("Excluir esta publicação?")) return; await createClient().from("scheduled_posts").delete().eq("id", p.id); setF(null); load(); }

  const Thumb = ({ u, className = "w-full h-full" }: { u?: string; className?: string }) => !u ? <div className={`${className} bg-panel2`} /> : isVideo(u) ? <video src={u} className={`${className} object-cover`} muted /> : <img src={u} alt="" className={`${className} object-cover`} />;
  const tags = (f?.caption || "").match(/#[\p{L}\d_]+/gu) || [];
  const acc = accounts.find((a) => a.id === f?.account_id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-panel2 rounded-lg p-0.5">{(["cal", "list"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm rounded-md ${view === v ? "bg-ink text-mint" : "text-fog"}`}>{v === "cal" ? "Calendário" : "Lista"}</button>)}</div>
        {view === "cal" && <><button onClick={() => setCursor(new Date(y, m - 1, 1))} className="btn btn-ghost btn-sm">‹</button><p className="font-display font-bold capitalize w-40 text-center">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p><button onClick={() => setCursor(new Date(y, m + 1, 1))} className="btn btn-ghost btn-sm">›</button></>}
        <div className="ml-auto flex flex-wrap gap-1.5">{Object.entries(STATUS).map(([k, s]) => <span key={k} className="chip text-[11px]"><span className="w-2 h-2 rounded-full" style={{ background: s.c }} />{s.l} {posts.filter((p) => p.status === k).length}</span>)}</div>
        <button onClick={() => openNew()} className="btn btn-mint btn-sm"><I.plus className="w-4 h-4" />Criar publicação</button>
      </div>

      {view === "cal" ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line">{WD.map((d) => <p key={d} className="text-[11px] text-fog text-center py-2 uppercase">{d}</p>)}</div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => (
              <div key={i} onClick={() => d && d >= today && openNew(d)} className={`min-h-[110px] border-b border-r border-line/60 p-1.5 ${d ? (d >= today ? "cursor-pointer hover:bg-panel2/40" : "opacity-70") : "bg-ink/40"}`}>
                {d && <><p className={`text-xs mb-1 w-6 h-6 grid place-items-center rounded-full ${d === today ? "bg-mint text-black font-bold" : "text-fog"}`}>{Number(d.slice(8))}</p>
                  <div className="space-y-1">{(byDay[d] || []).slice(0, 3).map((p) => (
                    <button key={p.id} onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="w-full flex items-center gap-1.5 rounded-md bg-panel2 p-1 text-left" style={{ borderLeft: `2px solid ${STATUS[p.status].c}` }}>
                      <div className="w-6 h-6 rounded overflow-hidden shrink-0"><Thumb u={p.media_urls?.[0]} /></div>
                      <span className="text-[10px] truncate">{localDate(p.scheduled_at).slice(11, 16)} {KINDS[p.kind].l.split(" ")[0]}</span>
                    </button>
                  ))}{(byDay[d] || []).length > 3 && <p className="text-[10px] text-fog">+{byDay[d].length - 3}</p>}</div></>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <button key={p.id} onClick={() => openEdit(p)} className="card p-3 w-full flex items-center gap-3 text-left hover:border-slate">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0"><Thumb u={p.media_urls?.[0]} /></div>
              <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.caption || "(sem legenda)"}</p><p className="text-xs text-fog">@{p.ig_accounts?.username} · {KINDS[p.kind].l} · {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "sem data"}</p>{p.error && <p className="text-xs text-danger truncate">{p.error}</p>}</div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS[p.status].c + "22", color: STATUS[p.status].c }}>{STATUS[p.status].l}</span>
              {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-mint text-sm">↗</a>}
            </button>
          ))}
          {!posts.length && <p className="text-fog text-sm text-center py-10">Nenhuma publicação ainda.</p>}
        </div>
      )}
      <p className="text-[11px] text-fog mt-3">A publicação acontece no horário marcado (verificação a cada minuto). Requer o perfil conectado à Meta com a permissão de publicação — se você conectou antes, reconecte em Perfis para liberar.</p>

      <Modal open={!!f} title={f?.id ? "Editar publicação" : "Criar publicação"} onClose={() => setF(null)} wide>
        {f && (
          <div className="grid md:grid-cols-[1fr_260px] gap-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Perfil</label><select className="input" value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}{a.connected ? "" : " (não conectado)"}</option>)}</select></div>
                <div><label className="label">A partir do Planejador</label><select className="input" value={f.idea_id || ""} onChange={(e) => { const i = ideas.find((x) => x.id === e.target.value); setF({ ...f, idea_id: e.target.value, caption: f.caption || (i?.body || "").match(/## Legenda[^\n]*\n([\s\S]*?)(\n## |$)/)?.[1]?.trim() || i?.title || "" }); }}><option value="">—</option>{ideas.map((i) => <option key={i.id} value={i.id}>{i.title.slice(0, 50)}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(KINDS).map(([k, v]) => <button key={k} onClick={() => setF({ ...f, kind: k, media_urls: v.multi ? f.media_urls : f.media_urls.slice(0, 1) })} className={`rounded-xl border p-2.5 text-left ${f.kind === k ? "border-mint bg-mint/10" : "border-line hover:border-slate"}`}><p className="text-sm font-semibold">{v.l}</p><p className="text-[10px] text-fog">{v.d}</p></button>)}</div>
              <div>
                <label className="label">Mídia</label>
                <div className="flex flex-wrap gap-2">
                  {f.media_urls.map((u: string, i: number) => <div key={u} className="relative w-20 h-20 rounded-lg overflow-hidden border border-line"><Thumb u={u} /><button onClick={() => setF({ ...f, media_urls: f.media_urls.filter((_: any, j: number) => j !== i) })} className="absolute top-0.5 right-0.5 bg-black/70 rounded-full w-5 h-5 text-xs">×</button>{KINDS[f.kind].multi && <span className="absolute bottom-0.5 left-1 text-[10px] bg-black/70 rounded px-1">{i + 1}</span>}</div>)}
                  {(KINDS[f.kind].multi ? f.media_urls.length < 10 : !f.media_urls.length) && <label className="w-20 h-20 rounded-lg border border-dashed border-slate grid place-items-center text-fog text-xs cursor-pointer hover:border-mint text-center px-1">{up ? "Enviando…" : "+ Arquivo"}<input type="file" className="hidden" accept={KINDS[f.kind].accept} multiple={!!KINDS[f.kind].multi} onChange={(e) => upload(e.target.files)} /></label>}
                </div>
                <input className="input !py-1.5 mt-2 text-sm" placeholder="ou cole a URL pública de uma mídia e aperte Enter" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v.startsWith("http")) { setF({ ...f, media_urls: KINDS[f.kind].multi ? [...f.media_urls, v] : [v] }); (e.target as HTMLInputElement).value = ""; } } }} />
              </div>
              {f.kind !== "story" && <div><div className="flex justify-between"><label className="label">Legenda</label><span className={`text-[11px] ${(f.caption || "").length > 2200 || tags.length > 5 ? "text-danger" : "text-fog"}`}>{(f.caption || "").length}/2200 · {tags.length}/5 hashtags</span></div><textarea className="input min-h-[150px]" value={f.caption || ""} onChange={(e) => setF({ ...f, caption: e.target.value })} placeholder="1ª linha forte (aparece antes do 'mais'), um único CTA, até 5 hashtags." /></div>}
              {f.kind === "reels" && <div><label className="label">Capa (URL de imagem, opcional)</label><input className="input" value={f.cover_url || ""} onChange={(e) => setF({ ...f, cover_url: e.target.value })} placeholder="https://…" /></div>}
              <div className="grid grid-cols-2 gap-3"><div><label className="label">Data</label><input type="date" className="input" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div><div><label className="label">Horário (Brasília)</label><input type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div></div>
              {f.error && <p className="text-sm text-danger">Último erro: {f.error}</p>}
              {err && <p className="text-sm text-danger">{err}</p>}
              <div className="flex flex-wrap gap-2 justify-between">
                <div>{f.id && <button onClick={() => del(f)} className="btn btn-ghost btn-sm"><I.trash className="w-4 h-4" /></button>}</div>
                {f.status === "publicado" ? <a href={f.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Ver no Instagram ↗</a> : (
                  <div className="flex gap-2"><button onClick={() => save("rascunho")} className="btn btn-ghost btn-sm">Salvar rascunho</button><button onClick={() => save("agora")} className="btn btn-ghost btn-sm">Publicar agora</button><button onClick={() => save("agendado")} className="btn btn-mint btn-sm">Agendar</button></div>
                )}
              </div>
            </div>
            {/* prévia estilo feed */}
            <div className="hidden md:block">
              <p className="label">Prévia</p>
              <div className="rounded-2xl border border-line bg-ink overflow-hidden">
                <div className="flex items-center gap-2 p-2.5"><div className="w-7 h-7 rounded-full bg-panel2 overflow-hidden">{acc?.profile_picture_url && <img src={acc.profile_picture_url} alt="" className="w-full h-full object-cover" />}</div><span className="text-xs font-semibold">{acc?.username || "perfil"}</span></div>
                <div className={`${f.kind === "reels" || f.kind === "story" ? "aspect-[9/16]" : "aspect-[4/5]"} bg-panel2 relative`}><Thumb u={f.media_urls[0]} />{KINDS[f.kind].multi && f.media_urls.length > 1 && <span className="absolute top-2 right-2 text-[10px] bg-black/70 rounded-full px-2">1/{f.media_urls.length}</span>}</div>
                {f.kind !== "story" && <p className="text-xs p-2.5"><b className="mr-1">{acc?.username || "perfil"}</b>{(f.caption || "").replace(/\n/g, " ").slice(0, 125)}{(f.caption || "").length > 125 && <span className="text-fog">… mais</span>}</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
