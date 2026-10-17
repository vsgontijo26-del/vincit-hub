"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dtShort, today } from "@/lib/agency";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";
import { PRIORITIES, STATUS_TYPES, Flag } from "@/components/tasks/shared";
import SpaceSettings from "@/components/tasks/SpaceSettings";
import TaskDrawer from "@/components/tasks/TaskDrawer";

const TYPE_COLOR: Record<string, string> = { aberto: "#8a8f94", andamento: "#f5c84c", concluido: "#6eefb6" };
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } };

type Group = { key: string; name: string; color: string; type: string; items: any[]; statusId?: string };

export default function Tarefas() {
  const [d, setD] = useState<{ spaces: any[]; statuses: any[]; lists: any[]; tags: any[]; tasks: any[]; team: any[]; projects: any[] }>({ spaces: [], statuses: [], lists: [], tags: [], tasks: [], team: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<{ space?: string; list?: string }>({});
  const [view, setView] = useState<"lista" | "quadro">("lista");
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [tag, setTag] = useState("");
  const [pri, setPri] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<any>(null);
  const [cfg, setCfg] = useState<{ open: boolean; space: any | null }>({ open: false, space: null });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const td = today();

  const load = useCallback(async () => {
    const s = createClient();
    const [sp, st, li, tg, tk, tm, pr] = await Promise.all([
      s.from("ag_spaces").select("*").order("position"),
      s.from("ag_space_statuses").select("*").order("position"),
      s.from("ag_lists").select("*").order("position"),
      s.from("ag_tags").select("*").order("name"),
      s.from("ag_tasks").select("*").order("position").order("created_at"),
      s.from("ag_team").select("id,name").order("name"),
      s.from("ag_projects").select("id,title,stage").order("created_at", { ascending: false }),
    ]);
    if (!sp.error && !(sp.data || []).length) { await s.rpc("ag_my_default_space"); return load(); }
    setD({ spaces: sp.data || [], statuses: st.data || [], lists: li.data || [], tags: tg.data || [], tasks: tk.data || [], team: tm.data || [], projects: pr.data || [] });
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const v = ls.get("vh.tasks.view"); if (v === "quadro" || v === "lista") setView(v);
    const sv = ls.get("vh.tasks.sel"); if (sv) try { setSel(JSON.parse(sv)); } catch {}
  }, [load]);
  useEffect(() => { ls.set("vh.tasks.view", view); }, [view]);
  useEffect(() => { ls.set("vh.tasks.sel", JSON.stringify(sel)); }, [sel]);
  // seleção apontando para espaço excluído
  useEffect(() => { if (!loading && sel.space && !d.spaces.some((x) => x.id === sel.space)) setSel({}); }, [loading, d.spaces, sel.space]);
  useEffect(() => { if (open) setOpen(d.tasks.find((x) => x.id === open.id) || null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [d.tasks]);

  const space = d.spaces.find((x) => x.id === sel.space);
  const stOf = (spaceId: string) => d.statuses.filter((x) => x.space_id === spaceId).sort((a, b) => a.position - b.position);
  const statusById = useMemo(() => Object.fromEntries(d.statuses.map((x) => [x.id, x])), [d.statuses]);
  const tagById = useMemo(() => Object.fromEntries(d.tags.map((x) => [x.id, x])), [d.tags]);
  const subCount = useMemo(() => {
    const m: Record<string, [number, number]> = {};
    d.tasks.forEach((x) => { if (x.parent_id) { const c = (m[x.parent_id] ||= [0, 0]); c[1]++; if (x.done) c[0]++; } });
    return m;
  }, [d.tasks]);

  const visible = d.tasks.filter((x) => !x.parent_id
    && (!sel.space || x.space_id === sel.space)
    && (!sel.list || x.list_id === sel.list)
    && (!who || x.assignee === who)
    && (!tag || (x.tags || []).includes(tag))
    && (!pri || x.priority === pri)
    && (!q || x.title.toLowerCase().includes(q.toLowerCase())));

  const groups: Group[] = space
    ? stOf(space.id).map((s) => ({ key: s.id, statusId: s.id, name: s.name, color: s.color, type: s.type, items: visible.filter((x) => x.status_id === s.id) }))
    : STATUS_TYPES.map((t) => ({ key: t.k, name: t.l, color: TYPE_COLOR[t.k], type: t.k, items: visible.filter((x) => (statusById[x.status_id]?.type || (x.done ? "concluido" : "aberto")) === t.k) }));
  const shown = groups.filter((g) => showDone || g.type !== "concluido");
  const hiddenDone = groups.filter((g) => g.type === "concluido").reduce((a, g) => a + g.items.length, 0);
  const sortItems = (xs: any[]) => [...xs].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || (a.position - b.position));

  /** status de destino quando a visão "Todas" agrupa por tipo */
  function statusFor(spaceId: string, g: Group) {
    if (g.statusId) return g.statusId;
    return stOf(spaceId).find((s) => s.type === g.type)?.id;
  }
  async function moveTo(taskId: string, g: Group) {
    const t = d.tasks.find((x) => x.id === taskId); if (!t) return;
    const status_id = statusFor(t.space_id, g);
    if (!status_id || status_id === t.status_id) return;
    const st = statusById[status_id];
    setD((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, status_id, done: st?.type === "concluido" } : x)) }));
    await createClient().from("ag_tasks").update({ status_id }).eq("id", taskId);
    load();
  }
  async function quickAdd(g: Group) {
    const title = (adding[g.key] || "").trim(); if (!title) return;
    const spaceId = sel.space || d.spaces[0]?.id;
    await createClient().from("ag_tasks").insert({ title, space_id: spaceId, list_id: sel.list || null, status_id: statusFor(spaceId, g), assignee: who || null, priority: null, tags: tag ? [tag] : [] });
    setAdding({ ...adding, [g.key]: "" }); load();
  }
  async function toggleDone(t: any) {
    setD((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)) }));
    await createClient().from("ag_tasks").update({ done: !t.done }).eq("id", t.id); load();
  }
  async function newTask() {
    const spaceId = sel.space || d.spaces[0]?.id; if (!spaceId) return;
    const { data } = await createClient().from("ag_tasks").insert({ title: "Nova tarefa", space_id: spaceId, list_id: sel.list || null, status_id: stOf(spaceId)[0]?.id, priority: null }).select().single();
    await load(); if (data) setOpen(data);
  }

  const Tags = ({ ids }: { ids: string[] }) => (<>{(ids || []).map((id) => tagById[id]).filter(Boolean).map((g: any) => <span key={g.id} className="text-[10px] px-1.5 py-px rounded-full whitespace-nowrap" style={{ background: g.color + "26", color: g.color }}>{g.name}</span>)}</>);
  const Due = ({ t }: { t: any }) => t.due_date ? <span className={`text-xs whitespace-nowrap ${!t.done && t.due_date < td ? "text-danger" : t.due_date === td ? "text-mint" : "text-fog"}`}>{t.due_date === td ? "Hoje" : dtShort(t.due_date)}</span> : null;
  const Check = ({ t }: { t: any }) => {
    const c = statusById[t.status_id]?.color || "#8a8f94";
    return <button onClick={(e) => { e.stopPropagation(); toggleDone(t); }} title={t.done ? "Reabrir" : "Concluir"} className="w-4 h-4 rounded-full border-2 shrink-0 grid place-items-center text-[9px] text-ink" style={{ borderColor: c, background: t.done ? c : "transparent" }}>{t.done && "✓"}</button>;
  };
  const Avatar = ({ n }: { n?: string }) => n ? <span title={n} className="w-6 h-6 rounded-full bg-slate text-[10px] font-semibold grid place-items-center shrink-0">{n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span> : null;

  const sidebar = (
    <nav className="space-y-0.5 text-sm">
      <button onClick={() => { setSel({}); setNavOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg ${!sel.space ? "bg-mint/10 text-mint" : "hover:bg-panel2"}`}>
        <I.grid className="w-4 h-4" /> <span className="flex-1 text-left">Todas as tarefas</span><span className="text-xs text-fog">{d.tasks.filter((x) => !x.parent_id && !x.done).length}</span>
      </button>
      <p className="label !mt-4 !mb-1 px-2.5">Espaços</p>
      {d.spaces.map((s) => {
        const active = sel.space === s.id;
        return (
          <div key={s.id}>
            <div className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg ${active && !sel.list ? "bg-panel2" : "hover:bg-panel2"}`}>
              <span className="w-5 h-5 rounded-md grid place-items-center text-[10px] font-bold text-ink shrink-0" style={{ background: s.color }}>{s.name[0]?.toUpperCase()}</span>
              <button onClick={() => { setSel({ space: s.id }); setNavOpen(false); }} className="flex-1 text-left truncate">{s.name}</button>
              <span className="text-xs text-fog group-hover:hidden">{d.tasks.filter((x) => !x.parent_id && !x.done && x.space_id === s.id).length}</span>
              <button onClick={() => setCfg({ open: true, space: s })} className="hidden group-hover:block text-fog hover:text-mint" title="Configurar espaço">⚙</button>
            </div>
            {active && d.lists.filter((l) => l.space_id === s.id).map((l) => (
              <button key={l.id} onClick={() => { setSel({ space: s.id, list: l.id }); setNavOpen(false); }} className={`w-full flex items-center gap-2 pl-9 pr-2.5 py-1.5 rounded-lg text-[13px] ${sel.list === l.id ? "bg-panel2 text-paper" : "text-fog hover:bg-panel2"}`}>
                <span className="flex-1 text-left truncate">{l.name}</span><span className="text-xs">{d.tasks.filter((x) => !x.parent_id && !x.done && x.list_id === l.id).length}</span>
              </button>
            ))}
          </div>
        );
      })}
      <button onClick={() => setCfg({ open: true, space: null })} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-fog hover:text-mint hover:bg-panel2"><I.plus className="w-4 h-4" /> Novo espaço</button>
    </nav>
  );

  const crumb = space ? `${space.name}${sel.list ? " / " + (d.lists.find((l) => l.id === sel.list)?.name || "") : ""}` : "Todas as tarefas";

  return (
    <>
      <PageHead kicker="AGENCY · 04 EXECUÇÃO" title="Tarefas" desc="Espaços, etapas e tags do seu jeito — no estilo ClickUp." />
      <div className="grid lg:grid-cols-[230px_1fr] gap-5">
        <aside className="hidden lg:block card p-2 self-start sticky top-4">{sidebar}</aside>

        <section className="min-w-0">
          {/* barra superior */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button className="lg:hidden btn btn-ghost btn-sm" onClick={() => setNavOpen(!navOpen)}><I.menu className="w-4 h-4" /></button>
            {space && <span className="w-3 h-3 rounded-sm" style={{ background: space.color }} />}
            <h2 className="font-display font-bold text-lg mr-auto truncate">{crumb}</h2>
            {space && <button onClick={() => setCfg({ open: true, space })} className="btn btn-ghost btn-sm">⚙ Etapas, listas e tags</button>}
            <button onClick={newTask} className="btn btn-mint btn-sm"><I.plus className="w-4 h-4" /> Tarefa</button>
          </div>
          {navOpen && <div className="lg:hidden card p-2 mb-3">{sidebar}</div>}

          <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-line">
            <div className="flex bg-panel2 rounded-lg p-0.5">
              {(["lista", "quadro"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm rounded-md capitalize ${view === v ? "bg-ink text-mint" : "text-fog"}`}>{v === "lista" ? "☰ Lista" : "▦ Quadro"}</button>)}
            </div>
            <input className="input !py-1.5 !w-44" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input !py-1.5 !w-auto" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Responsável</option>{d.team.map((m) => <option key={m.id}>{m.name}</option>)}</select>
            <select className="input !py-1.5 !w-auto" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Tag</option>{d.tags.filter((g) => !space || !g.space_id || g.space_id === space.id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <select className="input !py-1.5 !w-auto" value={pri} onChange={(e) => setPri(e.target.value)}><option value="">Prioridade</option>{PRIORITIES.map((p) => <option key={p.k} value={p.k}>{p.l}</option>)}</select>
            <label className="flex items-center gap-1.5 text-sm text-fog ml-auto cursor-pointer"><input type="checkbox" className="accent-[#6eefb6]" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Concluídas{hiddenDone ? ` (${hiddenDone})` : ""}</label>
          </div>

          {loading ? <p className="text-fog text-sm py-10 text-center">Carregando…</p> : view === "lista" ? (
            <div className="space-y-5">
              {shown.map((g) => (
                <div key={g.key} onDragOver={(e) => { e.preventDefault(); setOver(g.key); }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) moveTo(drag, g); setDrag(null); setOver(null); }} className={`rounded-xl ${over === g.key ? "ring-1 ring-mint/50" : ""}`}>
                  <button onClick={() => setCollapsed({ ...collapsed, [g.key]: !collapsed[g.key] })} className="flex items-center gap-2 mb-1.5">
                    <span className="text-fog text-xs w-3">{collapsed[g.key] ? "▸" : "▾"}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded" style={{ background: g.color, color: "#0c0c0d" }}>{g.name}</span>
                    <span className="text-xs text-fog">{g.items.length}</span>
                  </button>
                  {!collapsed[g.key] && (
                    <div className="card overflow-hidden">
                      <div className="hidden md:grid grid-cols-[1fr_130px_90px_70px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-fog border-b border-line"><span>Tarefa</span><span>Responsável</span><span>Prazo</span><span>Prior.</span></div>
                      {sortItems(g.items).map((t) => (
                        <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onClick={() => setOpen(t)} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_130px_90px_70px] gap-3 items-center px-4 py-2.5 border-b border-line/60 last:border-0 hover:bg-panel2 cursor-pointer">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Check t={t} />
                            {!space && <span className="w-1.5 h-1.5 rounded-full shrink-0" title={d.spaces.find((s) => s.id === t.space_id)?.name} style={{ background: d.spaces.find((s) => s.id === t.space_id)?.color }} />}
                            <span className={`text-sm truncate ${t.done ? "line-through text-fog" : ""}`}>{t.title}</span>
                            {subCount[t.id] && <span className="text-[10px] text-fog whitespace-nowrap">⑂ {subCount[t.id][0]}/{subCount[t.id][1]}</span>}
                            {t.description && <span className="text-fog text-[10px]">≡</span>}
                            <div className="hidden sm:flex gap-1 overflow-hidden"><Tags ids={t.tags} /></div>
                            {!space && statusById[t.status_id] && <span className="hidden xl:inline text-[10px]" style={{ color: statusById[t.status_id].color }}>{statusById[t.status_id].name}</span>}
                          </div>
                          <div className="hidden md:flex items-center gap-2 min-w-0"><Avatar n={t.assignee} /><span className="text-xs text-fog truncate">{t.assignee}</span></div>
                          <div className="flex md:block items-center gap-2"><Due t={t} /><span className="md:hidden"><Flag p={t.priority} /></span></div>
                          <div className="hidden md:block"><Flag p={t.priority} /></div>
                        </div>
                      ))}
                      <form onSubmit={(e) => { e.preventDefault(); quickAdd(g); }} className="px-4 py-1.5 border-t border-line/60">
                        <input className="w-full bg-transparent text-sm py-1 outline-none placeholder:text-fog/70" placeholder="+ Adicionar tarefa" value={adding[g.key] || ""} onChange={(e) => setAdding({ ...adding, [g.key]: e.target.value })} />
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto scroll-thin pb-4 -mx-1 px-1">
              {shown.map((g) => (
                <div key={g.key} onDragOver={(e) => { e.preventDefault(); setOver(g.key); }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) moveTo(drag, g); setDrag(null); setOver(null); }}
                  className={`w-[270px] shrink-0 rounded-xl p-2 bg-panel/60 border ${over === g.key ? "border-mint/60" : "border-line"}`}>
                  <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b-2" style={{ borderColor: g.color }}>
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: g.color }}>{g.name}</span>
                    <span className="text-xs text-fog">{g.items.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[40px]">
                    {sortItems(g.items).map((t) => (
                      <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => setOpen(t)} className={`bg-panel2 border border-line rounded-lg p-2.5 cursor-grab hover:border-slate ${drag === t.id ? "opacity-40" : ""}`}>
                        {!space && <p className="text-[10px] text-fog mb-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: d.spaces.find((s) => s.id === t.space_id)?.color }} />{d.spaces.find((s) => s.id === t.space_id)?.name}</p>}
                        <div className="flex items-start gap-2"><span className="mt-0.5"><Check t={t} /></span><p className={`text-sm leading-snug flex-1 ${t.done ? "line-through text-fog" : ""}`}>{t.title}</p></div>
                        {!!(t.tags || []).length && <div className="flex flex-wrap gap-1 mt-2"><Tags ids={t.tags} /></div>}
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar n={t.assignee} />
                          <Due t={t} />
                          {subCount[t.id] && <span className="text-[10px] text-fog">⑂ {subCount[t.id][0]}/{subCount[t.id][1]}</span>}
                          <span className="ml-auto"><Flag p={t.priority} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); quickAdd(g); }} className="mt-2">
                    <input className="w-full bg-transparent text-sm px-1 py-1.5 outline-none placeholder:text-fog/70" placeholder="+ Adicionar" value={adding[g.key] || ""} onChange={(e) => setAdding({ ...adding, [g.key]: e.target.value })} />
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {cfg.open && (
        <SpaceSettings key={cfg.space?.id || "new"} open onClose={() => setCfg({ open: false, space: null })} space={cfg.space ? d.spaces.find((x) => x.id === cfg.space.id) || cfg.space : null}
          statuses={d.statuses} lists={d.lists} tags={d.tags} tasks={d.tasks}
          onChanged={(id) => { load(); if (id) setSel({ space: id }); }} />
      )}
      <TaskDrawer task={open} onClose={() => setOpen(null)} onChanged={load} spaces={d.spaces} statuses={d.statuses} lists={d.lists} tags={d.tags} team={d.team} projects={d.projects} tasks={d.tasks} onOpen={setOpen} />
    </>
  );
}
