import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/PageHead";
import { I } from "@/components/icons";

const n = (v: any) => (v == null ? "–" : Intl.NumberFormat("pt-BR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v));

export default async function Overview() {
  const s = await createClient();
  const [{ data: accounts }, { data: posts }, { data: autos }, { data: ideas }, { count: refs }] = await Promise.all([
    s.from("ig_accounts").select("*").order("created_at"),
    s.from("ig_posts").select("account_id,like_count,comments_count,reach,saved,shares,plays,posted_at,caption,permalink,media_type,thumbnail_url").order("posted_at", { ascending: false }).limit(200),
    s.from("automations").select("id,active,runs_count"),
    s.from("content_ideas").select("id,title,status,format,kind,planned_for").order("created_at", { ascending: false }).limit(6),
    s.from("references_lib").select("id", { count: "exact", head: true }),
  ]);

  const totalFollowers = (accounts || []).reduce((a, x) => a + (x.followers_count || 0), 0);
  const eng = (p: any) => (p.like_count || 0) + (p.comments_count || 0) + (p.saved || 0) + (p.shares || 0);
  const top = [...(posts || [])].sort((a, b) => eng(b) - eng(a)).slice(0, 4);
  const activeAutos = (autos || []).filter((a) => a.active).length;
  const runs = (autos || []).reduce((a, x) => a + (x.runs_count || 0), 0);

  const kpis = [
    ["Perfis", n(accounts?.length || 0)],
    ["Seguidores somados", n(totalFollowers)],
    ["Automações ativas", n(activeAutos)],
    ["Disparos de automação", n(runs)],
  ];

  const flow = [
    { n: "00", t: "Base", d: "Perfis conectados e o briefing: negócio, público, mercado e estilo.", links: [["Perfis", "/creator/perfis"], ["Briefing", "/creator/briefing"]] },
    { n: "01", t: "Análise & insights", d: "Dados do perfil, tendências e referências para decidir melhor.", links: [["Desempenho & insights", "/creator/desempenho"], ["Tendências", "/creator/tendencias"], ["Referências", "/creator/referencias"]] },
    { n: "02", t: "Criação & planejamento", d: "Da ideia ao calendário da semana ou do mês.", links: [["Formatos criativos", "/creator/formatos"], ["Laboratório", "/creator/laboratorio"], ["Planejador", "/creator/pauta"]] },
    { n: "03", t: "Crescimento", d: "Estratégia 30/60/90 e automações que trabalham por você.", links: [["Estratégia", "/creator/estrategia"], ["Automações", "/creator/automacoes"]] },
  ];

  return (
    <>
      <PageHead kicker="CREATOR" title="Visão geral" desc="Analisar o perfil, criar e planejar o conteúdo e crescer com estratégia — tudo a partir do briefing." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map(([k, v], i) => (
          <div key={k} className="card p-5 rise" style={{ animationDelay: `${i * 0.04}s` }}>
            <p className="text-xs text-fog">{k}</p>
            <p className="font-display text-3xl font-bold mt-2 tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {!accounts?.length && (
        <div className="card p-6 mb-8 border-mint-dim bg-mint/[.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-lg">Comece conectando um perfil</p>
            <p className="text-fog text-sm mt-1">Conecte pela Meta para métricas e automações reais, ou cadastre manualmente para já usar a IA.</p>
          </div>
          <Link href="/creator/perfis" className="btn btn-mint">Adicionar perfil <I.arrow className="w-4 h-4" /></Link>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {flow.map((f, i) => (
          <div key={f.n} className="card p-5 relative rise" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="font-mono text-xs text-mint">{f.n}</p>
            <p className="font-display font-bold text-xl mt-1">{f.t}</p>
            <p className="text-fog text-sm mt-1 mb-4">{f.d}</p>
            <div className="flex flex-col gap-1">
              {f.links.map(([l, h]) => <Link key={h} href={h} className="flex items-center justify-between text-sm rounded-lg px-2.5 py-1.5 bg-panel2 hover:text-mint">{l}<I.arrow className="w-3.5 h-3.5" /></Link>)}
            </div>
            {i < 3 && <span className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-fog z-10">›</span>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <section className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Posts com mais engajamento</h2>
            <Link href="/creator/desempenho" className="text-xs text-fog hover:text-mint">Ver desempenho</Link>
          </div>
          {!top.length ? <p className="text-fog text-sm py-8 text-center">Sincronize um perfil conectado para ver os posts aqui.</p> : (
            <ul className="divide-y divide-line">
              {top.map((p, i) => (
                <li key={i} className="py-3 flex gap-3 items-center">
                  <span className="font-mono text-xs text-fog w-4">{i + 1}</span>
                  {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-11 h-11 rounded-md object-cover bg-panel2" /> : <div className="w-11 h-11 rounded-md bg-panel2" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{p.caption || "(sem legenda)"}</p>
                    <p className="text-xs text-fog mt-0.5">{p.media_type} · {p.posted_at?.slice(0, 10)}</p>
                  </div>
                  <span className="font-mono text-sm text-mint">{n(eng(p))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Planejador</h2>
            <Link href="/creator/pauta" className="text-xs text-fog hover:text-mint">Abrir planejador</Link>
          </div>
          {!ideas?.length ? <p className="text-fog text-sm py-8 text-center">Ideias salvas de tendências, referências e copy aparecem aqui.</p> : (
            <ul className="space-y-2">
              {ideas.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 bg-panel2 rounded-lg px-3 py-2.5">
                  <p className="text-sm truncate">{it.title}</p>
                  <span className="chip shrink-0">{it.status}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fog mt-4">{refs || 0} referências na biblioteca</p>
        </section>
      </div>
    </>
  );
}
