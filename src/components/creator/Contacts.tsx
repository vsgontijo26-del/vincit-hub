"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Contacts() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  useEffect(() => { createClient().from("dm_contacts").select("*, ig_accounts(username)").order("last_interaction", { ascending: false }).limit(500).then(({ data }) => setRows(data || [])); }, []);
  const tags = Array.from(new Set(rows.flatMap((r) => r.tags || [])));
  const list = rows.filter((r) => (!tag || (r.tags || []).includes(tag)) && (!q || JSON.stringify([r.username, r.fields]).toLowerCase().includes(q.toLowerCase())));
  function csv() {
    const keys = Array.from(new Set(list.flatMap((r) => Object.keys(r.fields || {}))));
    const lines = [["usuario", "perfil", "etiquetas", ...keys, "ultima_interacao"].join(";"), ...list.map((r) => [r.username || r.igsid, r.ig_accounts?.username, (r.tags || []).join(","), ...keys.map((k) => String(r.fields?.[k] ?? "").replace(/;/g, ",")), r.last_interaction].join(";"))];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })); a.download = "contatos-instagram.csv"; a.click();
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="input !py-1.5 !w-56" placeholder="Buscar @ ou resposta…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => setTag("")} className={`btn btn-sm ${!tag ? "btn-mint" : "btn-ghost"}`}>Todos {rows.length}</button>
        {tags.map((t) => <button key={t} onClick={() => setTag(t)} className={`btn btn-sm ${tag === t ? "btn-mint" : "btn-ghost"}`}>{t} {rows.filter((r) => r.tags?.includes(t)).length}</button>)}
        <button onClick={csv} disabled={!list.length} className="btn btn-ghost btn-sm ml-auto">Exportar CSV</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead><tr className="text-left text-fog text-xs border-b border-line">{["Contato", "Etiquetas", "Respostas coletadas", "Última interação"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="p-3">{r.username ? <a href={`https://instagram.com/${r.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-mint">@{r.username}</a> : <span className="text-fog">{r.igsid}</span>}<p className="text-[11px] text-fog">via @{r.ig_accounts?.username}{r.waiting ? ` · em fluxo (${r.waiting})` : ""}</p></td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{(r.tags || []).map((t: string) => <span key={t} className="chip text-[10px]">{t}</span>)}</div></td>
                <td className="p-3 text-xs">{Object.entries(r.fields || {}).map(([k, v]) => <p key={k}><span className="text-fog">{k}:</span> {String(v)}</p>)}</td>
                <td className="p-3 text-xs text-fog">{r.last_interaction ? new Date(r.last_interaction).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "–"}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={4} className="p-8 text-center text-fog">Os contatos aparecem aqui quando alguém interage com um fluxo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
