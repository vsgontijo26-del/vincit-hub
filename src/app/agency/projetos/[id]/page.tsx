"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_STAGES, PROJECT_TYPES, brl, dt, dtShort, today, stageLabel } from "@/lib/agency";
import Fields from "@/components/agency/Fields";
import CopyButton from "@/components/CopyButton";
import { I } from "@/components/icons";
import { A } from "@/components/agency/icons";

export default function Projeto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [lists, setLists] = useState<{ clients: any[]; team: any[]; equip: any[] }>({ clients: [], team: [], equip: [] });
  const [edit, setEdit] = useState(false);
  const [comment, setComment] = useState("");
  const [newTask, setNewTask] = useState({ title: "", assignee: "", due_date: "" });
  const [newTx, setNewTx] = useState({ kind: "entrada", description: "", amount: "", due_date: today() });
  const [newBk, setNewBk] = useState({ equipment_id: "", start_date: "", end_date: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const s = createClient();
    const [a, b, c, d, e, cl, tm, eq] = await Promise.all([
      s.from("ag_projects").select("*, ag_clients(name)").eq("id", id).single(),
      s.from("ag_project_events").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      s.from("ag_tasks").select("*").eq("project_id", id).order("done").order("due_date"),
      s.from("ag_transactions").select("*").eq("project_id", id).order("due_date"),
      s.from("ag_bookings").select("*, ag_equipment(name)").eq("project_id", id).order("start_date"),
      s.from("ag_clients").select("id,name").order("name"),
      s.from("ag_team").select("name").order("name"),
      s.from("ag_equipment").select("id,name,status").order("name"),
    ]);
    setP(a.data); setEvents(b.data || []); setTasks(c.data || []); setTx(d.data || []); setBookings(e.data || []);
    setLists({ clients: cl.data || [], team: tm.data || [], equip: eq.data || [] });
  }, [id]);
  useEffect(() => { load(); setOrigin(location.origin); }, [load]);

  const s = () => createClient();
  const log = (kind: string, text: string) => s().from("ag_project_events").insert({ project_id: id, kind, text });

  async function saveInfo() {
    const { title, client_id, type, value, responsible, shoot_date, due_date, description } = p;
    const { error } = await s().from("ag_projects").update({ title, client_id: client_id || null, type, value: value || 0, responsible, shoot_date: shoot_date || null, due_date: due_date || null, description }).eq("id", id);
    if (error) setMsg(error.message); else { setEdit(false); load(); }
  }
  async function setStage(stage: string) {
    if (stage === p.stage) return;
    await s().from("ag_projects").update({ stage, ...(stage === "entregue" ? { delivered_at: new Date().toISOString() } : {}) }).eq("id", id);
    await log("status", `Etapa: ${stageLabel(p.stage)} → ${stageLabel(stage)}`); load();
  }
  async function sendDelivery() {
    if (!p.delivery_url) return setMsg("Cole o link do vídeo (Drive, Vimeo, Frame.io, YouTube não listado…) antes de enviar.");
    await s().from("ag_projects").update({ delivery_url: p.delivery_url, review_status: "pendente", stage: "revisao" }).eq("id", id);
    await log("entrega", `Nova versão enviada para aprovação${p.revisions ? ` (v${p.revisions + 1})` : ""}`);
    setMsg("Entrega enviada. Mande o link de aprovação para o cliente."); load();
  }
  async function addComment(e: React.FormEvent) { e.preventDefault(); if (!comment.trim()) return; await log("comentario", comment.trim()); setComment(""); load(); }
  async function addTask(e: React.FormEvent) { e.preventDefault(); if (!newTask.title.trim()) return; await s().from("ag_tasks").insert({ ...newTask, due_date: newTask.due_date || null, assignee: newTask.assignee || null, project_id: id }); setNewTask({ title: "", assignee: "", due_date: "" }); load(); }
  async function toggleTask(t: any) { await s().from("ag_tasks").update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq("id", t.id); load(); }
  async function addTx(e: React.FormEvent) {
    e.preventDefault(); if (!newTx.description || !newTx.amount) return;
    await s().from("ag_transactions").insert({ ...newTx, amount: Number(newTx.amount), project_id: id, client_id: p.client_id || null, category: newTx.kind === "entrada" ? "Projeto" : "Custo de projeto" });
    setNewTx({ kind: "entrada", description: "", amount: "", due_date: today() }); load();
  }
  async function payTx(t: any) { await s().from("ag_transactions").update({ paid: !t.paid, paid_at: !t.paid ? today() : null }).eq("id", t.id); load(); }
  async function addBooking(e: React.FormEvent) {
    e.preventDefault(); if (!newBk.equipment_id || !newBk.start_date) return;
    const end = newBk.end_date || newBk.start_date;
    const { data: clash } = await s().from("ag_bookings").select("id, ag_projects(title)").eq("equipment_id", newBk.equipment_id).lte("start_date", end).gte("end_date", newBk.start_date);
    if (clash?.length) return setMsg(`Equipamento já reservado nessas datas${(clash[0] as any).ag_projects?.title ? ` (${(clash[0] as any).ag_projects.title})` : ""}.`);
    await s().from("ag_bookings").insert({ ...newBk, end_date: end, project_id: id }); setNewBk({ equipment_id: "", start_date: "", end_date: "" }); setMsg(null); load();
  }
  async function delBooking(b: any) { await s().from("ag_bookings").delete().eq("id", b.id); load(); }
  async function removeProject() { if (!confirm("Excluir este projeto, com tarefas, histórico e reservas?")) return; await s().from("ag_projects").delete().eq("id", id); router.push("/agency/projetos"); }

  if (!p) return <p className="text-fog">Carregando…</p>;
  const reviewLink = `${origin}/r/${p.review_token}`;
  const received = tx.filter((t) => t.kind === "entrada" && t.paid).reduce((a, t) => a + Number(t.amount), 0);
  const billed = tx.filter((t) => t.kind === "entrada").reduce((a, t) => a + Number(t.amount), 0);
  const costs = tx.filter((t) => t.kind === "saida").reduce((a, t) => a + Number(t.amount), 0);
  const late = p.due_date && p.due_date < today() && p.stage !== "entregue";
  const stageIdx = PROJECT_STAGES.findIndex((x) => x.k === p.stage);

  return (
    <>
      <Link href="/agency/projetos" className="inline-flex items-center gap-2 text-sm text-fog hover:text-paper mb-6"><I.back className="w-4 h-4" />Projetos</Link>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 rise">
        <div>
          <p className="font-mono text-[11px] text-mint tracking-widest uppercase">{p.type || "Projeto"}</p>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1">{p.title}</h1>
          <p className="text-fog mt-1 text-sm">{p.ag_clients?.name || "Sem cliente"} · prazo <span className={late ? "text-danger" : ""}>{dt(p.due_date)}</span>{p.responsible ? ` · ${p.responsible}` : ""}</p>
        </div>
        <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setEdit(!edit)}>{edit ? "Cancelar" : "Editar"}</button><button className="btn btn-ghost" onClick={removeProject}><I.trash className="w-4 h-4" /></button></div>
      </div>
      {msg && <div className="card px-4 py-3 mb-5 text-sm text-mint border-mint-dim flex justify-between gap-3">{msg}<button onClick={() => setMsg(null)} className="text-fog">×</button></div>}

      <div className="card p-2 mb-5 overflow-x-auto scroll-thin">
        <div className="flex min-w-[640px]">
          {PROJECT_STAGES.map((st, i) => (
            <button key={st.k} onClick={() => setStage(st.k)} className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${i === stageIdx ? "bg-mint text-black" : i < stageIdx ? "text-mint" : "text-fog hover:text-paper"}`}>
              {i < stageIdx ? "✓ " : ""}{st.l}
            </button>
          ))}
        </div>
      </div>

      {edit && (
        <section className="card p-5 mb-5 border-mint-dim">
          <Fields value={p} onChange={setP} fields={[
            { key: "title", label: "Nome", span: 2 },
            { key: "client_id", label: "Cliente", type: "select", options: lists.clients.map((c) => ({ v: c.id, l: c.name })) },
            { key: "type", label: "Tipo", type: "select", options: PROJECT_TYPES },
            { key: "value", label: "Valor (R$)", type: "money" },
            { key: "responsible", label: "Responsável", type: "select", options: lists.team.map((m) => m.name) },
            { key: "shoot_date", label: "Captação", type: "date" },
            { key: "due_date", label: "Prazo de entrega", type: "date" },
            { key: "description", label: "Briefing", type: "textarea" },
          ]} />
          <div className="flex justify-end mt-4"><button className="btn btn-mint" onClick={saveInfo}>Salvar</button></div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3"><h2 className="font-display font-bold text-lg">Entrega & aprovação do cliente</h2>
              {p.review_status !== "sem_entrega" && <span className={`chip ${p.review_status === "aprovado" ? "chip-mint" : p.review_status === "alteracao" ? "text-danger border-danger/40" : ""}`}>{p.review_status === "aprovado" ? "Aprovado pelo cliente" : p.review_status === "alteracao" ? "Cliente pediu alteração" : "Aguardando cliente"}</span>}</div>
            <p className="text-sm text-fog mb-3">Cole o link do vídeo, envie para aprovação e mande o link abaixo ao cliente. Ele assiste, aprova ou pede alteração, e o projeto avança sozinho.</p>
            <div className="flex flex-col md:flex-row gap-2">
              <input className="input" placeholder="https://drive.google.com/… ou vimeo.com/…" value={p.delivery_url || ""} onChange={(e) => setP({ ...p, delivery_url: e.target.value })} />
              <button onClick={sendDelivery} className="btn btn-mint">Enviar para aprovação</button>
            </div>
            {p.review_status !== "sem_entrega" && (
              <div className="mt-4 bg-panel2 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-2 justify-between">
                <code className="text-xs text-mint break-all">{reviewLink}</code>
                <div className="flex gap-2 shrink-0"><CopyButton text={reviewLink} label="Copiar link" /><a href={reviewLink} target="_blank" className="btn btn-ghost btn-sm"><A.ext className="w-3.5 h-3.5" />Abrir</a></div>
              </div>
            )}
            {p.revisions > 0 && <p className="text-xs text-fog mt-3">{p.revisions} rodada(s) de alteração até aqui.</p>}
          </section>

          <section className="card p-5">
            <h2 className="font-display font-bold text-lg mb-3">Tarefas</h2>
            <ul className="space-y-1.5 mb-3">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 bg-panel2 rounded-lg px-3 py-2">
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} className="accent-[#6eefb6] w-4 h-4" />
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-fog" : ""}`}>{t.title}</span>
                  {t.assignee && <span className="chip">{t.assignee}</span>}
                  {t.due_date && <span className={`text-xs ${!t.done && t.due_date < today() ? "text-danger" : "text-fog"}`}>{dtShort(t.due_date)}</span>}
                </li>
              ))}
              {!tasks.length && <p className="text-fog text-sm">Nenhuma tarefa.</p>}
            </ul>
            <form onSubmit={addTask} className="grid grid-cols-2 md:grid-cols-[1fr_140px_140px_auto] gap-2">
              <input className="input col-span-2 md:col-span-1" placeholder="Nova tarefa…" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
              <select className="input" value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}><option value="">Responsável</option>{lists.team.map((m) => <option key={m.name}>{m.name}</option>)}</select>
              <input type="date" className="input" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
              <button className="btn btn-ghost col-span-2 md:col-span-1"><I.plus className="w-4 h-4" /></button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="font-display font-bold text-lg mb-3">Histórico</h2>
            <form onSubmit={addComment} className="flex gap-2 mb-4"><input className="input" placeholder="Adicionar comentário…" value={comment} onChange={(e) => setComment(e.target.value)} /><button className="btn btn-ghost">Comentar</button></form>
            <ol className="relative border-l border-line ml-2 space-y-4">
              {events.map((e) => (
                <li key={e.id} className="pl-4 relative">
                  <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${e.kind === "cliente" ? "bg-mint" : e.kind === "entrega" ? "bg-[#7aa7ff]" : "bg-line"}`} />
                  <p className="text-sm">{e.kind === "cliente" && <span className="text-mint font-medium">{e.author}: </span>}{e.text}</p>
                  <p className="text-[11px] text-fog">{new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </li>
              ))}
              {!events.length && <p className="text-fog text-sm pl-4">Sem registros ainda.</p>}
            </ol>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-display font-bold text-lg mb-3">Financeiro do projeto</h2>
            <div className="grid grid-cols-2 gap-2 mb-4 text-center">
              {[["Valor", brl(p.value)], ["Recebido", brl(received)], ["Custos", brl(costs)], ["Margem", brl((Number(p.value) || billed) - costs)]].map(([k, v]) => (
                <div key={k} className="bg-panel2 rounded-lg py-2.5"><p className="font-mono text-xs">{v}</p><p className="text-[11px] text-fog mt-0.5">{k}</p></div>
              ))}
            </div>
            <ul className="space-y-1.5 mb-3">
              {tx.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <button onClick={() => payTx(t)} className={`w-4 h-4 rounded border shrink-0 ${t.paid ? "bg-mint border-mint" : "border-line"}`} title="Marcar como pago" />
                  <span className="flex-1 truncate">{t.description}</span>
                  <span className={`font-mono text-xs ${t.kind === "saida" ? "text-danger" : "text-mint"}`}>{t.kind === "saida" ? "−" : "+"}{brl(t.amount)}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={addTx} className="space-y-2 border-t border-line pt-3">
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={newTx.kind} onChange={(e) => setNewTx({ ...newTx, kind: e.target.value })}><option value="entrada">A receber</option><option value="saida">Custo</option></select>
                <input type="number" step="0.01" className="input" placeholder="Valor" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} />
              </div>
              <input className="input" placeholder={newTx.kind === "entrada" ? "Ex.: Entrada 50%" : "Ex.: Diária de câmera"} value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} />
              <div className="flex gap-2"><input type="date" className="input" value={newTx.due_date} onChange={(e) => setNewTx({ ...newTx, due_date: e.target.value })} /><button className="btn btn-ghost"><I.plus className="w-4 h-4" /></button></div>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="font-display font-bold text-lg mb-3">Equipamentos reservados</h2>
            <ul className="space-y-1.5 mb-3">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-sm bg-panel2 rounded-lg px-3 py-2">
                  <span className="flex-1 truncate">{b.ag_equipment?.name}</span>
                  <span className="text-xs text-fog">{dtShort(b.start_date)}{b.end_date !== b.start_date ? `–${dtShort(b.end_date)}` : ""}</span>
                  <button onClick={() => delBooking(b)} className="text-fog hover:text-danger"><I.trash className="w-3.5 h-3.5" /></button>
                </li>
              ))}
              {!bookings.length && <p className="text-fog text-sm">Nenhuma reserva.</p>}
            </ul>
            <form onSubmit={addBooking} className="space-y-2 border-t border-line pt-3">
              <select className="input" value={newBk.equipment_id} onChange={(e) => setNewBk({ ...newBk, equipment_id: e.target.value })}><option value="">Equipamento…</option>{lists.equip.map((q) => <option key={q.id} value={q.id} disabled={q.status === "manutencao"}>{q.name}{q.status === "manutencao" ? " (manutenção)" : ""}</option>)}</select>
              <div className="grid grid-cols-2 gap-2"><input type="date" className="input" value={newBk.start_date} onChange={(e) => setNewBk({ ...newBk, start_date: e.target.value })} /><input type="date" className="input" value={newBk.end_date} onChange={(e) => setNewBk({ ...newBk, end_date: e.target.value })} /></div>
              <button className="btn btn-ghost w-full">Reservar</button>
            </form>
          </section>

          {p.description && <section className="card p-5"><h2 className="font-display font-bold text-lg mb-2">Briefing</h2><p className="text-sm text-fog whitespace-pre-wrap">{p.description}</p></section>}
        </div>
      </div>
    </>
  );
}
