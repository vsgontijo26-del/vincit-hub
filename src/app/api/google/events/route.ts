import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gcal, googleToken } from "@/lib/google";

/** eventos do Google Agenda no período (exceto os criados pelo VINCIT HUB, que já aparecem na Agenda) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ events: [] });
  const s = await createClient();
  const auth = await googleToken(s);
  if (!auth || !auth.cfg.pull) return NextResponse.json({ events: [], connected: !!auth });
  const cal = encodeURIComponent(auth.cfg.calendar_id || "primary");
  const qs = new URLSearchParams({ timeMin: `${from}T00:00:00-03:00`, timeMax: `${to}T23:59:59-03:00`, singleEvents: "true", orderBy: "startTime", maxResults: "500", timeZone: "America/Sao_Paulo" });
  const r = await gcal(auth.token, `/calendars/${cal}/events?${qs}`);
  if (!r.ok) return NextResponse.json({ events: [], error: r.data?.error?.message || "Falha ao ler o Google Agenda" });
  const local = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
  const events = (r.data?.items || [])
    .filter((e: any) => e.status !== "cancelled" && !e.extendedProperties?.private?.vincit_id)
    .map((e: any) => {
      const allDay = !!e.start?.date;
      const st = allDay ? e.start.date : local(e.start.dateTime);
      return { id: e.id, title: e.summary || "(sem título)", date: st.slice(0, 10), time: allDay ? null : st.slice(11, 16), allDay, link: e.htmlLink, location: e.location || null };
    });
  return NextResponse.json({ events, connected: true });
}
