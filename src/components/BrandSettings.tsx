"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brandCss, contrast, isHex, PRESETS } from "@/lib/brand";
import Logo from "./Logo";

/** Personalização do assinante: cor de destaque e logo (sempre acompanhada de "by VINCIT HUB") */
export default function BrandSettings() {
  const [color, setColor] = useState("#6eefb6");
  const [logo, setLogo] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);

  useEffect(() => {
    const s = createClient();
    s.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await s.from("profiles").select("brand_color,brand_logo_url,brand_name").eq("id", data.user.id).maybeSingle();
      if (p?.brand_color) setColor(p.brand_color);
      setLogo(p?.brand_logo_url || ""); setName(p?.brand_name || "");
    });
  }, []);

  // pré-visualização ao vivo no sistema inteiro
  useEffect(() => {
    let el = document.getElementById("brand-preview") as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = "brand-preview"; document.head.appendChild(el); }
    el.textContent = isHex(color) ? brandCss(color) : "";
  }, [color]);

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setMsg({ t: "Use uma imagem de até 2 MB." });
    setBusy(true);
    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    const path = `${user!.id}/marca/logo-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`;
    const { error } = await s.storage.from("midia").upload(path, file, { contentType: file.type, upsert: true });
    setBusy(false);
    if (error) return setMsg({ t: error.message });
    setLogo(s.storage.from("midia").getPublicUrl(path).data.publicUrl);
  }
  async function save(reset = false) {
    setBusy(true); setMsg(null);
    const { error } = await createClient().rpc("set_my_brand", { p_color: reset ? null : color, p_logo: reset ? "" : logo, p_name: reset ? "" : name });
    setBusy(false);
    if (error) return setMsg({ t: error.message });
    if (reset) { setColor("#6eefb6"); setLogo(""); setName(""); }
    setMsg({ t: reset ? "Voltou ao padrão VINCIT." : "Personalização salva. Recarregando…", ok: true });
    setTimeout(() => location.reload(), 600);
  }

  const low = isHex(color) && contrast(color, "#151517") < 3;
  return (
    <section className="card p-5 space-y-4">
      <div><h2 className="font-display font-bold text-lg">Personalização</h2><p className="text-xs text-fog">Deixe o sistema com a cara da sua marca. O selo “by VINCIT HUB” sempre acompanha sua logo.</p></div>
      <div>
        <label className="label">Cor de destaque</label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 ${color.toLowerCase() === c ? "border-paper" : "border-transparent"}`} style={{ background: c }} aria-label={c} />)}
          <label className="flex items-center gap-2 ml-1"><input type="color" value={isHex(color) ? color : "#6eefb6"} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 bg-transparent border-0 cursor-pointer" /><input className="input !py-1.5 !w-28 font-mono text-sm" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        </div>
        {low && <p className="text-[11px] text-[#f5c84c] mt-1">Cor escura demais para o fundo do sistema: vamos clarear um pouco para manter a leitura.</p>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Logo (PNG transparente ou SVG, horizontal)</label>
          <div className="flex items-center gap-3">
            <label className="btn btn-ghost btn-sm cursor-pointer">{busy ? "Enviando…" : logo ? "Trocar logo" : "Enviar logo"}<input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
            {logo && <button type="button" onClick={() => setLogo("")} className="text-xs text-fog hover:text-danger">Remover</button>}
          </div>
        </div>
        <div><label className="label">Nome da marca</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Studio Aurora" /></div>
      </div>
      <div>
        <p className="label">Prévia</p>
        <div className="rounded-xl border border-line bg-ink p-4 flex flex-wrap items-center justify-between gap-3">
          <Logo className="h-7" brand={{ logo, name }} />
          <div className="flex gap-2"><span className="btn btn-mint btn-sm">Botão</span><span className="chip chip-mint">Destaque</span></div>
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-mint" : "text-danger"}`}>{msg.t}</p>}
      <div className="flex justify-between"><button type="button" onClick={() => save(true)} className="btn btn-ghost btn-sm">Voltar ao padrão</button><button type="button" disabled={busy || !isHex(color)} onClick={() => save()} className="btn btn-mint">Salvar personalização</button></div>
    </section>
  );
}
