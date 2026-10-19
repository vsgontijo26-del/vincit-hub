import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EVENT_KINDS } from "@/lib/agency";
import { findTaskEvent, gcal, googleToken, taskGoesToGoogle, toGoogleEvent, toGoogleTask } from "@/lib/google";

/**
 * Envia compromissos da Agenda para o Google Agenda.
 * body: { event_id } cria/atualiza um · { delete: google_event_id } apaga um · { all: true } envia todos os futuros
 * Tarefas com prazo (sem Inbox nem subtarefas) viram eventos, regras em seu-dia/regras-seu-dia.md §4:
 * { task_id } cria/atualiza/remove uma · { delete_task: task_id } remove uma · { tasks: true } envia as abertas e as concluídas nos últimos 7 dias
 */
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const s = await createClient();
  const auth = await googleToken(s);
  if (!auth) return NextResponse.json({ ok: false, skipped: "not_connected" });
  if (!auth.cfg.push) return NextResponse.json({ ok: true, skipped: "push_off" });
  const cal = encodeURIComponent(auth.cfg.calendar_id || "primary");
  const label = (k: string) => EVENT_KINDS.find((x: any) => x.k === k)?.l;

  if (b.delete) {
    const r = await gcal(auth.token, `/calendars/${cal}/events/${encodeURIComponent(b.delete)}`, { method: "DELETE" });
    return NextResponse.json({ ok: r.ok || r.status === 404 });
  }

  if (b.task_id || b.delete_task || b.tasks) return syncTasks(s, auth.token, cal, b);

  let q = s.from("ag_events").select("*");
  if (b.event_id) q = q.eq("id", b.event_id);
  else if (b.all) q = q.or(`starts_at.gte.${new Date(Date.now() - 864e5).toISOString()},recurrence.not.is.null`);
  else return NextResponse.json({ ok: false, error: "Nada para sincronizar" }, { status: 400 });
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0; const errors: string[] = [];
  for (const e of rows || []) {
    const body = JSON.stringify(toGoogleEvent(e, label(e.kind)));
    let r = e.google_event_id
      ? await gcal(auth.token, `/calendars/${cal}/events/${encodeURIComponent(e.google_event_id)}`, { method: "PUT", body })
      : null;
    if (!r || r.status === 404) r = await gcal(auth.token, `/calendars/${cal}/events`, { method: "POST", body });
    if (r.ok && r.data?.id) {
      sent++;
      if (r.data.id !== e.google_event_id) await s.from("ag_events").update({ google_event_id: r.data.id }).eq("id", e.id);
    } else errors.push(`${e.title}: ${r.data?.error?.message || r.status}`);
  }
  await s.rpc("google_tokens_update", { p_patch: { last_sync_at: new Date().toISOString(), last_error: errors[0] || null } });
  return NextResponse.json({ ok: !errors.length, sent, errors });
}

async function syncTasks(s: any, token: string, cal: string, b: any) {
  if (b.delete_task) {
    const gid = await findTaskEvent(token, cal, b.delete_task);
    if (gid) await gcal(token, `/calendars/${cal}/events/${encodeURIComponent(gid)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  }
  // select * para aceitar due_time quando a coluna existir
  let q = s.from("ag_tasks").select("*");
  if (b.task_id) q = q.eq("id", b.task_id);
  else q = q.not("due_date", "is", null).is("parent_id", null).not("inbox", "is", true).or(`done.eq.false,done_at.gte.${new Date(Date.now() - 7 * 864e5).toISOString()}`);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0; const errors: string[] = [];
  for (const t of rows || []) {
    const gid = await findTaskEvent(token, cal, t.id);
    if (!taskGoesToGoogle(t)) {
      // sem prazo, na Inbox ou subtarefa: não fica no Google
      if (gid) await gcal(token, `/calendars/${cal}/events/${encodeURIComponent(gid)}`, { method: "DELETE" });
      continue;
    }
    const body = JSON.stringify(toGoogleTask(t));
    const r = gid
      ? await gcal(token, `/calendars/${cal}/events/${encodeURIComponent(gid)}`, { method: "PUT", body })
      : await gcal(token, `/calendars/${cal}/events`, { method: "POST", body });
    if (r.ok) sent++; else errors.push(`${t.title}: ${r.data?.error?.message || r.status}`);
  }
  await s.rpc("google_tokens_update", { p_patch: { last_sync_at: new Date().toISOString(), last_error: errors[0] || null } });
  return NextResponse.json({ ok: !errors.length, sent, errors });
}
