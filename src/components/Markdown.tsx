"use client";
// Renderizador de markdown simples (títulos, listas, negrito, links, código)
function inline(s: string) {
  let h = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return h;
}
export function toHtml(md: string) {
  const lines = (md || "").replace(/\r/g, "").split("\n");
  let out = "";
  let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); const n = m[1].length; out += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
    if (/^---+$/.test(l.trim())) { close(); out += "<hr/>"; continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== "ul") { close(); out += "<ul>"; list = "ul"; } out += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out += "<ol>"; list = "ol"; } out += `<li>${inline(m[1])}</li>`; continue; }
    close();
    out += `<p>${inline(l)}</p>`;
  }
  close();
  return out;
}
export default function Markdown({ text }: { text: string }) {
  return <div className="md text-[14px]" dangerouslySetInnerHTML={{ __html: toHtml(text) }} />;
}
