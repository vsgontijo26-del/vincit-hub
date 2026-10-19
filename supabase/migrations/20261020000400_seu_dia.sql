-- Seu dia: campos novos de tarefa, espaços do sistema, avisos e Projetos como listas do Gestor de tarefas.
-- Pedido da conversa "Seu dia e tarefas" (regras-seu-dia.md, seção 7). Só acrescenta.

-- 1. Tarefas
alter table public.ag_tasks
  add column if not exists due_time time,
  add column if not exists remind_at timestamptz,
  add column if not exists content_id uuid references public.content_ideas(id) on delete set null,
  add column if not exists routine_key text;
create index if not exists ag_tasks_content_id_idx on public.ag_tasks (content_id);
create index if not exists ag_tasks_remind_idx on public.ag_tasks (remind_at) where remind_at is not null and not done;

-- 2. Espaços criados pelo sistema e lista de cada projeto
alter table public.ag_spaces add column if not exists kind text check (kind in ('projetos','rotina'));
create unique index if not exists ag_spaces_owner_kind_key on public.ag_spaces (owner_id, kind) where kind is not null;
alter table public.ag_lists add column if not exists project_id uuid references public.ag_projects(id) on delete set null;
create unique index if not exists ag_lists_project_id_key on public.ag_lists (project_id) where project_id is not null;

-- 3. Avisos (sino e bloco Avisos de Seu dia). Só o sistema cria; o assinante lê, marca como lido e apaga.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  source_type text,
  source_id uuid,
  dedup_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (owner_id, dedup_key)
);
create index if not exists notifications_owner_idx on public.notifications (owner_id, created_at desc);
create index if not exists notifications_source_idx on public.notifications (source_type, source_id) where read_at is null;
alter table public.notifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_select') then
    create policy notifications_select on public.notifications for select to authenticated using (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_update') then
    create policy notifications_update on public.notifications for update to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_delete') then
    create policy notifications_delete on public.notifications for delete to authenticated using (owner_id = (select auth.uid()));
  end if;
end $$;
-- o assinante só muda read_at
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 4. Projetos como listas
-- Espaço Projetos do assinante (criado na primeira vez, com as etapas padrão)
create or replace function private.ag_projects_space(p_owner uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  select id into sid from public.ag_spaces where owner_id = p_owner and kind = 'projetos';
  if sid is not null then return sid; end if;
  insert into public.ag_spaces (owner_id, name, color, position, kind)
  values (p_owner, 'Projetos', '#7aa7ff', coalesce((select max(position) + 1 from public.ag_spaces where owner_id = p_owner), 0), 'projetos')
  returning id into sid;
  insert into public.ag_space_statuses (owner_id, space_id, name, color, type, position) values
    (p_owner, sid, 'A fazer', '#8a8f94', 'aberto', 0),
    (p_owner, sid, 'Em andamento', '#f5c84c', 'andamento', 1),
    (p_owner, sid, 'Concluído', '#6eefb6', 'concluido', 2);
  return sid;
end $$;

-- Lista do projeto (cria se faltar)
create or replace function private.ag_project_list(p_project uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pr record; lid uuid; sid uuid;
begin
  select id, owner_id, title into pr from public.ag_projects where id = p_project;
  if not found then return null; end if;
  select id into lid from public.ag_lists where project_id = pr.id;
  if lid is not null then return lid; end if;
  sid := private.ag_projects_space(pr.owner_id);
  insert into public.ag_lists (owner_id, space_id, name, position, project_id)
  values (pr.owner_id, sid, coalesce(nullif(trim(pr.title), ''), 'Projeto'),
          coalesce((select max(position) + 1 from public.ag_lists where space_id = sid), 0), pr.id)
  returning id into lid;
  return lid;
end $$;

create or replace function private.ag_projects_list_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.ag_project_list(new.id);
  elsif new.title is distinct from old.title and coalesce(trim(new.title), '') <> '' then
    update public.ag_lists set name = trim(new.title) where project_id = new.id;
  end if;
  return null;
end $$;
create or replace trigger ag_projects_zlist after insert or update on public.ag_projects
  for each row execute function private.ag_projects_list_sync();

-- Tarefa e projeto andam juntos. Roda antes de ag_tasks_sync (gatilhos disparam em ordem alfabética).
create or replace function private.ag_tasks_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare l record; space_before uuid;
begin
  space_before := new.space_id;
  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id) then
    -- escolheu o projeto: vai para a lista dele
    if not exists (select 1 from public.ag_projects where id = new.project_id and owner_id = new.owner_id) then
      raise exception 'PROJETO_INVALIDO';
    end if;
    select id, space_id into l from public.ag_lists where id = private.ag_project_list(new.project_id);
    new.list_id := l.id;
    new.space_id := l.space_id;
  elsif new.list_id is not null and (tg_op = 'INSERT' or new.list_id is distinct from old.list_id) then
    -- foi para uma lista: a de um projeto liga a tarefa a ele; uma lista comum desliga
    select project_id, space_id into l from public.ag_lists where id = new.list_id;
    if l.project_id is not null then new.project_id := l.project_id;
    elsif tg_op = 'UPDATE' then new.project_id := null;
    end if;
    new.space_id := coalesce(l.space_id, new.space_id);
  elsif tg_op = 'UPDATE' and new.list_id is null and old.list_id is not null and new.project_id is not null then
    new.project_id := null;  -- ficou sem lista: sai do projeto
  end if;
  -- mudou de espaço aqui: a etapa antiga não vale mais; ag_tasks_sync escolhe a do novo espaço
  if new.space_id is distinct from space_before and new.status_id is not null
     and not exists (select 1 from public.ag_space_statuses where id = new.status_id and space_id = new.space_id) then
    new.status_id := null;
  end if;
  return new;
end $$;
create or replace trigger ag_tasks_aproject before insert or update on public.ag_tasks
  for each row execute function private.ag_tasks_project();

revoke all on function private.ag_projects_space(uuid), private.ag_project_list(uuid),
  private.ag_projects_list_sync(), private.ag_tasks_project() from public, anon, authenticated;

-- 5. Gerador de avisos (rascunho da conversa Seu dia, revisado). Idempotente: o dedup_key impede repetição.
create or replace function private.notify_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  now_br timestamp := (now() at time zone 'America/Sao_Paulo');
  today date := now_br::date;
  dow int := extract(isodow from now_br);  -- 1 = segunda
  hh int := extract(hour from now_br);
begin
  if hh >= 7 then
    insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
    select t.owner_id, 'tarefa_hoje', 'Para hoje: ' || t.title, '/tarefas?t=' || t.id, 'task', t.id, 'tarefa_hoje:' || t.id || ':' || today
    from public.ag_tasks t
    where t.due_date = today and not t.done and t.parent_id is null and not coalesce(t.inbox, false)
    on conflict (owner_id, dedup_key) do nothing;

    insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
    select t.owner_id, 'tarefa_atrasada', 'Atrasada: ' || t.title, '/tarefas?t=' || t.id, 'task', t.id, 'tarefa_atrasada:' || t.id || ':' || t.due_date
    from public.ag_tasks t
    where t.due_date < today and not t.done and t.parent_id is null and not coalesce(t.inbox, false)
    on conflict (owner_id, dedup_key) do nothing;

    insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
    select x.owner_id, 'cobranca_vencida', 'Recebimento vencido: ' || coalesce(x.description, 'sem descrição'), '/agency/financeiro', 'transaction', x.id, 'cobranca_vencida:' || x.id || ':' || x.due_date
    from public.ag_transactions x
    where x.kind = 'entrada' and not x.paid and x.transfer_id is null and x.due_date < today
    on conflict (owner_id, dedup_key) do nothing;

    insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
    select p.owner_id, 'proposta_sem_resposta', 'Proposta sem resposta: ' || p.title, '/agency/propostas/' || p.id, 'proposal', p.id, 'proposta_sem_resposta:' || p.id
    from public.ag_proposals p
    where p.status in ('enviada', 'visualizada') and p.created_at < now() - interval '5 days'
    on conflict (owner_id, dedup_key) do nothing;

    -- conteúdo que passou da data sem estar publicado (o texto de status segue sincronizado com status_id)
    insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
    select c.owner_id, 'conteudo_atrasado', 'Conteúdo atrasado: ' || coalesce(c.title, 'sem título'), '/creator/pauta', 'content', c.id, 'conteudo_atrasado:' || c.id || ':' || c.planned_for
    from public.content_ideas c
    where c.planned_for < today and coalesce(c.status, '') <> 'publicado' and c.archived_at is null
    on conflict (owner_id, dedup_key) do nothing;
  end if;

  insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
  select p.owner_id, 'revisoes_excedidas', p.title || ' passou de 3 revisões', '/agency/projetos/' || p.id, 'project', p.id, 'revisoes_excedidas:' || p.id || ':' || p.revisions
  from public.ag_projects p
  where p.revisions > 3 and p.stage <> 'entregue'
  on conflict (owner_id, dedup_key) do nothing;

  insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
  select t.owner_id, 'lembrete', 'Lembrete: ' || t.title, '/tarefas?t=' || t.id, 'task', t.id, 'lembrete:' || t.id || ':' || t.remind_at
  from public.ag_tasks t
  where t.remind_at is not null and t.remind_at <= now() and t.remind_at > now() - interval '1 day' and not t.done
  on conflict (owner_id, dedup_key) do nothing;

  insert into public.notifications (owner_id, kind, title, href, source_type, source_id, dedup_key)
  select e.owner_id, 'evento_em_breve', 'Em 1 h: ' || e.title, '/agenda', 'event', e.id, 'evento_em_breve:' || e.id || ':' || e.starts_at
  from public.ag_events e
  where e.recurrence is null and e.starts_at between now() and now() + interval '1 hour'
  on conflict (owner_id, dedup_key) do nothing;

  if (dow = 1 and hh >= 8) or (dow = 5 and hh >= 16) then
    insert into public.notifications (owner_id, kind, title, href, source_type, dedup_key)
    select pr.id, 'rotina', case when dow = 1 then 'Planeje sua semana' else 'Revisão da semana' end, '/rotina', 'routine',
           'rotina:' || dow || ':' || today
    from public.profiles pr where pr.status = 'ativo'
    on conflict (owner_id, dedup_key) do nothing;
  end if;

  -- some sozinho quando a pendência foi resolvida
  delete from public.notifications n using public.ag_tasks t
   where n.read_at is null and n.source_type = 'task' and n.source_id = t.id and t.done;
  delete from public.notifications n using public.ag_transactions x
   where n.read_at is null and n.source_type = 'transaction' and n.source_id = x.id and x.paid;
  delete from public.notifications n using public.ag_proposals p
   where n.read_at is null and n.source_type = 'proposal' and n.source_id = p.id and p.status not in ('enviada', 'visualizada');
  delete from public.notifications n using public.content_ideas c
   where n.read_at is null and n.source_type = 'content' and n.source_id = c.id and (c.status = 'publicado' or c.archived_at is not null);
  delete from public.notifications where read_at < now() - interval '30 days';
end $$;
revoke all on function private.notify_tick() from public, anon, authenticated;

-- Chamado pela rotina agendada existente (vincit-tick), antes do resto
create or replace function private.cron_tick()
returns void language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform private.notify_tick();
  exception when others then
    raise warning 'notify_tick: %', sqlerrm;  -- aviso com erro não pode travar publicação e DMs
  end;
  -- só chama a aplicação quando há algo para fazer
  if exists (select 1 from public.dm_contacts where waiting = 'delay' and wait_until <= now())
     or exists (select 1 from public.scheduled_posts where (status = 'agendado' and scheduled_at <= now()) or status = 'publicando') then
    perform net.http_post(
      url := 'https://vincit-hub.vercel.app/api/cron/tick',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from private.app_config where key = 'webhook_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  end if;
end $$;

-- 6. Migração dos dados atuais: espaço Projetos, uma lista por projeto e as tarefas do projeto dentro dela.
-- O espaço Projetos de quem já tem projetos copia as etapas do espaço onde estão hoje as tarefas desses
-- projetos, e cada tarefa mantém a etapa pelo nome (ex.: Roteiro e Captação do Audiovisual).
do $$
declare o record; src uuid; sid uuid;
begin
  for o in select distinct owner_id from public.ag_projects loop
    if exists (select 1 from public.ag_spaces where owner_id = o.owner_id and kind = 'projetos') then continue; end if;
    select t.space_id into src from public.ag_tasks t
      where t.owner_id = o.owner_id and t.project_id is not null and t.space_id is not null
      group by t.space_id order by count(*) desc limit 1;
    if src is null then continue; end if;  -- sem tarefas: o espaço nasce com as etapas padrão
    insert into public.ag_spaces (owner_id, name, color, position, kind)
    values (o.owner_id, 'Projetos', '#7aa7ff', coalesce((select max(position) + 1 from public.ag_spaces where owner_id = o.owner_id), 0), 'projetos')
    returning id into sid;
    insert into public.ag_space_statuses (owner_id, space_id, name, color, type, position)
    select owner_id, sid, name, color, type, position from public.ag_space_statuses where space_id = src;
  end loop;
end $$;
select private.ag_project_list(id) from public.ag_projects;
select set_config('vincit.status_source', 'migracao', true);
update public.ag_tasks t set
  list_id = l.id,
  status_id = coalesce(
    (select ns.id from public.ag_space_statuses os join public.ag_space_statuses ns on ns.space_id = l.space_id and ns.name = os.name
      where os.id = t.status_id order by ns.position limit 1),
    t.status_id)
from public.ag_lists l
where l.project_id = t.project_id and t.list_id is distinct from l.id;
select set_config('vincit.status_source', '', true);
