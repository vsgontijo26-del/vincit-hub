"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { A } from "@/components/agency/icons";
import { I } from "@/components/icons";

const items = [
  { href: "/", label: "Resumo", Icon: I.grid },
  { href: "/tarefas", label: "Tarefas", Icon: A.check },
  { href: "/agenda", label: "Agenda", Icon: A.cal },
  { href: "/rotina", label: "Rotina", Icon: I.refresh },
];
/** espaço que guarda as listas dos projetos (kind = projetos depois da migração; antes, pelo nome) */
export const isProjectsSpace = (s: any) => s.kind === "projetos" || (!s.kind && s.name === "Projetos");

/** Menu de Seu dia: lateral no desktop (com os espaços do gestor de tarefas), chips no celular */
export default function DiaNav() {
  const path = usePathname();
  const q = useSearchParams();
  const [d, setD] = useState<{ spaces: any[]; projects: any[]; tasks: any[] }>({ spaces: [], projects: [], tasks: [] });
  const load = useCallback(async () => {
    const s = createClient();
    const [sp, pr, tk] = await Promise.all([
      s.from("ag_spaces").select("*").order("position"),
      s.from("ag_projects").select("id,title,stage").neq("stage", "entregue").order("created_at", { ascending: false }),
      s.from("ag_tasks").select("id,space_id,project_id,inbox,done,parent_id").eq("done", false),
    ]);
    setD({ spaces: sp.data || [], projects: pr.data || [], tasks: tk.data || [] });
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("vh:tasks", load);
    return () => window.removeEventListener("vh:tasks", load);
  }, [load]);

  const open = d.tasks.filter((t) => !t.parent_id);
  const onTasks = path === "/tarefas";
  const cur = { space: q.get("space"), projeto: q.get("projeto"), inbox: q.get("inbox"), view: q.get("view") };
  const isActive = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/")) && !(h === "/tarefas" && (cur.space || cur.projeto || cur.inbox || cur.view === "projetos"));
  const sub = (active: boolean) => `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${active ? "bg-mint/10 text-mint" : "text-fog hover:text-paper hover:bg-panel2"}`;
  const count = (n: number) => (n ? <span className="ml-auto text-[11px] font-mono text-fog">{n}</span> : null);

  return (
    <>
      <aside className="hidden lg:flex fixed top-16 bottom-0 left-0 w-60 flex-col border-r border-line bg-ink/80 backdrop-blur z-20 p-4 overflow-y-auto scroll-thin">
        <div className="px-2 mb-3">
          <p className="font-display font-extrabold text-xl tracking-tight">Seu dia</p>
          <p className="text-xs text-fog mt-1">Central de trabalho do HUB</p>
        </div>
        <nav className="flex flex-col gap-0.5">
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(href) ? "bg-mint/10 text-mint" : "text-fog hover:text-paper hover:bg-panel2"}`}>
              <Icon className="w-[18px] h-[18px]" /> {label}
              {href === "/tarefas" && count(open.filter((t) => !t.inbox).length)}
            </Link>
          ))}
          <p className="text-[10px] uppercase tracking-widest text-fog/70 px-3 pt-4 pb-1 font-mono">Espaços</p>
          <Link href="/tarefas?inbox=1" className={sub(onTasks && !!cur.inbox)}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5" /></svg>
            Inbox {count(open.filter((t) => t.inbox).length)}
          </Link>
          <Link href="/tarefas?view=projetos" className={sub(onTasks && cur.view === "projetos" && !cur.projeto)}>
            <span className="w-2 h-2 rounded-full bg-[#7aa7ff]" /> Projetos {count(d.projects.length)}
          </Link>
          {d.projects.map((p) => (
            <Link key={p.id} href={`/tarefas?projeto=${p.id}`} className={`${sub((onTasks && cur.projeto === p.id) || path === `/projetos/${p.id}`)} pl-8`}>
              <span className="truncate">{p.title}</span>{count(open.filter((t) => t.project_id === p.id).length)}
            </Link>
          ))}
          {d.spaces.filter((s) => !isProjectsSpace(s)).map((s) => (
            <Link key={s.id} href={`/tarefas?space=${s.id}`} className={sub(onTasks && cur.space === s.id)}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> <span className="truncate">{s.name}</span>
              {count(open.filter((t) => t.space_id === s.id && !t.inbox).length)}
            </Link>
          ))}
        </nav>
        <p className="mt-auto pt-6 px-2 text-[11px] text-fog font-mono">VINCIT HUB</p>
      </aside>
      <nav className="lg:hidden flex gap-2 overflow-x-auto scroll-thin px-4 py-3 border-b border-line">
        {items.map(({ href, label }) => (
          <Link key={href} href={href} className={`chip shrink-0 text-xs px-3 py-1.5 ${isActive(href) || (href === "/tarefas" && onTasks) ? "chip-mint" : "hover:text-paper"}`}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
