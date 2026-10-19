/** Integração com o Google Agenda (OAuth por usuário, tokens guardados em private.google_tokens) */
import type { SupabaseClient } from "@supabase/supabase-js";

export const GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/calendar.events";
const TZ = "America/Sao_Paulo";
const API = "https://www.googleapis.com/calendar/v3";

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** token de acesso válido do usuário logado (renova com o refresh token quando preciso) */
export async function googleToken(s: SupabaseClient): Promise<{ token: string; cfg: any } | null> {
  const { data: cfg } = await s.rpc("google_tokens_get");
  if (!cfg || !(cfg as any).refresh_token) return null;
  const c = cfg as any;
  if (c.access_token && c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60_000) return { token: c.access_token, cfg: c };
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: c.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok) {
    await s.rpc("google_tokens_update", { p_patch: { last_error: j.error === "invalid_grant" ? "Acesso ao Google revogado. Conecte de novo." : j.error_description || j.error || "Falha ao renovar acesso" } });
    return null;
  }
  const expires_at = new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString();
  await s.rpc("google_tokens_update", { p_patch: { access_token: j.access_token, expires_at } });
  return { token: j.access_token, cfg: c };
}

export async function gcal(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (r.status === 204 || r.status === 410) return { ok: true, status: r.status, data: null as any };
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

const RRULE: Record<string, string> = {
  daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY",
};
/** horário local de Brasília "YYYY-MM-DDTHH:MM:SS" a partir de um ISO */
const local = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 19);

/** converte um compromisso da Agenda para o formato do Google */
export function toGoogleEvent(e: any, kindLabel?: string) {
  const start = local(e.starts_at);
  const end = e.ends_at ? local(e.ends_at) : local(new Date(new Date(e.starts_at).getTime() + 3600e3).toISOString());
  const recurrence: string[] = [];
  if (e.recurrence && RRULE[e.recurrence]) {
    let rule = "RRULE:" + RRULE[e.recurrence];
    if (e.recurrence_until) {
      // fim do dia em Brasília (23:59:59 -03 = 02:59:59Z do dia seguinte)
      const d = new Date(e.recurrence_until + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
      rule += ";UNTIL=" + d.toISOString().slice(0, 10).replace(/-/g, "") + "T025959Z";
    }
    recurrence.push(rule);
    const hm = start.slice(11).replace(/:/g, "");
    for (const x of e.exdates || []) recurrence.push(`EXDATE;TZID=${TZ}:${String(x).replace(/-/g, "")}T${hm}`);
  }
  const desc = [kindLabel ? `Tipo: ${kindLabel}` : "", e.notes || "", "— Criado no VINCIT HUB"].filter(Boolean).join("\n\n");
  return {
    summary: e.title, location: e.location || undefined, description: desc,
    start: { dateTime: start, timeZone: TZ }, end: { dateTime: end, timeZone: TZ },
    recurrence: recurrence.length ? recurrence : undefined,
    extendedProperties: { private: { vincit_id: e.id } },
  };
}

/** dia seguinte de uma data "YYYY-MM-DD" (fim exclusivo de evento de dia inteiro) */
const nextDay = (d: string) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

/** tarefa que vai para o Google: com prazo, fora da Inbox e sem ser subtarefa */
export const taskGoesToGoogle = (t: any) => !!t?.due_date && !t.parent_id && !t.inbox;

/** converte uma tarefa com prazo em evento do Google: com horário se tiver due_time (1 h), senão dia inteiro do início ao prazo */
export function toGoogleTask(t: any) {
  const desc = [t.description || "", t.assignee ? `Responsável: ${t.assignee}` : "", "— Tarefa do VINCIT HUB"].filter(Boolean).join("\n\n");
  const hm = typeof t.due_time === "string" ? t.due_time.slice(0, 5) : "";
  let when: any;
  if (/^\d{2}:\d{2}$/.test(hm)) {
    const st = `${t.due_date}T${hm}:00`;
    const end = new Date(new Date(st + "Z").getTime() + 3600e3).toISOString().slice(0, 19);
    when = { start: { dateTime: st, timeZone: TZ }, end: { dateTime: end, timeZone: TZ } };
  } else {
    const start = t.start_date && t.start_date <= t.due_date ? t.start_date : t.due_date;
    when = { start: { date: start }, end: { date: nextDay(t.due_date) } };
  }
  return {
    summary: (t.done ? "✓ " : "") + t.title,
    description: desc,
    ...when,
    transparency: "transparent",
    extendedProperties: { private: { vincit_task: t.id } },
  };
}

/** evento do Google já criado para a tarefa (procurado pela marca privada vincit_task) */
export async function findTaskEvent(token: string, cal: string, taskId: string): Promise<string | null> {
  const r = await gcal(token, `/calendars/${cal}/events?privateExtendedProperty=${encodeURIComponent("vincit_task=" + taskId)}&showDeleted=false&maxResults=1`);
  return r.ok ? r.data?.items?.[0]?.id || null : null;
}
