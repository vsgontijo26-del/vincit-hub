"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Etapas do modelo padrão. O status do assinante pode ter qualquer nome; a etapa dá o comportamento. */
export const STAGES = [
  { k: "ideia", l: "Ideia" },
  { k: "pauta", l: "Pauta" },
  { k: "roteiro", l: "Roteiro" },
  { k: "producao", l: "Produção" },
  { k: "edicao", l: "Edição" },
  { k: "revisao", l: "Revisão interna" },
  { k: "aprovacao", l: "Aprovação do cliente" },
  { k: "agendado", l: "Agendado" },
  { k: "publicado", l: "Publicado" },
  { k: "analisado", l: "Analisado" },
] as const;

export const FORMAT_LIST = ["Reels", "Carrossel", "Stories", "Foto", "YouTube", "Live"];
export const MAX_REVISIONS = 3;

/** o que o conteúdo precisa ter para SAIR da etapa (regra do PRD) */
export function missing(it: any, stage?: string | null): string[] {
  const m: string[] = [];
  const has = (v: any) => v != null && String(v).trim() !== "";
  switch (stage) {
    case "ideia": if (!has(it.title)) m.push("título"); if (!has(it.account_id)) m.push("perfil"); break;
    case "pauta": if (!has(it.planned_for)) m.push("data de publicação"); if (!has(it.format)) m.push("formato"); if (!has(it.pillar)) m.push("pilar"); break;
    case "roteiro": if (!has(it.hook)) m.push("gancho"); if (!has(it.body)) m.push("roteiro ou copy"); break;
    case "producao": if (!has(it.record_date)) m.push("data de gravação"); break;
    case "edicao": if (!has(it.final_url)) m.push("link da versão final"); break;
    case "revisao": if (!has(it.caption)) m.push("legenda final"); break;
    case "aprovacao": if (it.approval !== "aprovado" && it.approval !== "dispensada") m.push("aprovação do cliente (ou pular a etapa)"); break;
    case "publicado": if (!has(it.post_url)) m.push("link do post"); break;
  }
  return m;
}

/** checa se dá para mover de um status para outro: avançar exige cumprir as etapas que ficam para trás */
export function blockers(it: any, statuses: any[], toId: string): string[] {
  const from = statuses.find((s) => s.id === it.status_id), to = statuses.find((s) => s.id === toId);
  if (!to || !from || to.position <= from.position) return [];
  const out = new Set<string>();
  for (const s of statuses) {
    if (s.position < from.position || s.position >= to.position) continue;
    // etapas opcionais puladas não bloqueiam; a atual sempre conta
    if (s.optional && s.id !== from.id) continue;
    missing(it, s.stage).forEach((x) => out.add(x));
  }
  return Array.from(out);
}

/** de onde a ideia veio (pelo tipo gravado por cada ferramenta) */
export function origin(it: any): string | null {
  const b = it.body || "";
  if (it.kind === "tendencia") return "da Tendência";
  if (it.kind === "plano") return "do plano com IA";
  if (it.kind === "copy") return "do Laboratório";
  if (it.kind === "diagnostico") return it.pillar ? `do Diagnóstico · ${it.pillar}` : "do Diagnóstico";
  if (it.kind === "ideia" && /Baseado na referência|Inspirado em/.test(b)) return "da Referência";
  return null;
}

export const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export const isLate = (it: any, statuses: any[]) => {
  const st = statuses.find((s) => s.id === it.status_id)?.stage;
  return !!it.planned_for && it.planned_for < today() && st !== "publicado" && st !== "analisado";
};
export const shortDate = (d?: string | null) => (d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "");

/** status do assinante (cria os 10 padrão na primeira vez) */
export function useContentStatuses() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await createClient().rpc("content_statuses_ensure");
    setStatuses(((data as any[]) || []).sort((a, b) => a.position - b.position));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { statuses, reload: load };
}
