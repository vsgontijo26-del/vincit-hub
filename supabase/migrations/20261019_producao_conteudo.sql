-- Produção de conteúdo (CREATOR): status personalizáveis, ciclo de vida, aprovação opcional e revisões.
-- Só acrescenta (tabelas, colunas, funções e triggers). Nada é apagado.

-- ── status personalizáveis por assinante ──
create table if not exists public.content_statuses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8a8f94',
  -- etapa do modelo padrão que dá o comportamento ao status (null = status livre, sem regra)
  stage text check (stage in ('ideia','pauta','roteiro','producao','edicao','revisao','aprovacao','agendado','publicado','analisado')),
  optional boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists content_statuses_owner_idx on public.content_statuses(owner_id, position);
alter table public.content_statuses enable row level security;

-- ── colunas novas do conteúdo ──
alter table public.content_ideas
  add column if not exists status_id uuid references public.content_statuses(id) on delete set null,
  add column if not exists client_id uuid references public.ag_clients(id) on delete set null,
  add column if not exists assignee text,
  add column if not exists record_date date,
  add column if not exists final_url text,
  add column if not exists caption text,
  add column if not exists post_url text,
  add column if not exists ig_media_id text,
  add column if not exists revisions integer not null default 0,
  add column if not exists approval text check (approval in ('pendente','aprovado','ajuste','dispensada')),
  add column if not exists approval_token uuid unique,
  add column if not exists approval_note text,
  add column if not exists approved_at timestamptz,
  add column if not exists publish_error text,
  add column if not exists archived_at timestamptz,
  add column if not exists status_changed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists content_ideas_status_idx on public.content_ideas(owner_id, status_id);

-- ── histórico (mudanças de status, respostas do cliente, revisões) ──
create table if not exists public.content_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  idea_id uuid not null references public.content_ideas(id) on delete cascade,
  kind text not null default 'status',
  from_status text,
  to_status text,
  text text,
  author text,
  created_at timestamptz not null default now()
);
create index if not exists content_events_idea_idx on public.content_events(idea_id, created_at);
alter table public.content_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['content_statuses','content_events'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='own_select') then
      execute format('create policy own_select on public.%I for select using ((select auth.uid()) = owner_id)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='own_insert') then
      execute format('create policy own_insert on public.%I for insert with check ((select auth.uid()) = owner_id)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='own_update') then
      execute format('create policy own_update on public.%I for update using ((select auth.uid()) = owner_id)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='own_delete') then
      execute format('create policy own_delete on public.%I for delete using ((select auth.uid()) = owner_id)', t);
    end if;
  end loop;
end $$;

-- ── os 10 status padrão (só cria se o assinante ainda não tem nenhum) ──
create or replace function private.content_seed_statuses(p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or exists (select 1 from public.content_statuses where owner_id = p_owner) then return; end if;
  insert into public.content_statuses(owner_id, name, color, stage, optional, position)
  select p_owner, x.name, x.color, x.stage, x.optional, x.pos
  from (values
    ('Ideia', '#8a8f94', 'ideia', false, 0),
    ('Pauta', '#22d3ee', 'pauta', false, 1),
    ('Roteiro', '#c084fc', 'roteiro', false, 2),
    ('Produção', '#ff6b6b', 'producao', false, 3),
    ('Edição', '#7aa7ff', 'edicao', false, 4),
    ('Revisão interna', '#fb923c', 'revisao', false, 5),
    ('Aprovação do cliente', '#f5c84c', 'aprovacao', true, 6),
    ('Agendado', '#a3e635', 'agendado', true, 7),
    ('Publicado', '#6eefb6', 'publicado', false, 8),
    ('Analisado', '#3d525a', 'analisado', false, 9)
  ) as x(name, color, stage, optional, pos);
end $$;
revoke all on function private.content_seed_statuses(uuid) from public, anon, authenticated;

create or replace function public.content_statuses_ensure()
returns setof public.content_statuses language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  perform private.content_seed_statuses(auth.uid());
  return query select * from public.content_statuses where owner_id = auth.uid() order by position;
end $$;
revoke all on function public.content_statuses_ensure() from public, anon;
grant execute on function public.content_statuses_ensure() to authenticated;

-- status do assinante para uma etapa padrão
create or replace function private.content_status_for(p_owner uuid, p_stage text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.content_statuses where owner_id = p_owner and stage = p_stage order by position limit 1
$$;
revoke all on function private.content_status_for(uuid, text) from public, anon, authenticated;

-- ── ciclo de vida: status_id é a fonte; status (texto antigo) fica sincronizado para as telas antigas ──
create or replace function private.content_ideas_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_stage text;
begin
  perform private.content_seed_statuses(new.owner_id);
  -- status e cliente só valem se forem do próprio assinante
  if new.status_id is not null and not exists (select 1 from public.content_statuses where id = new.status_id and owner_id = new.owner_id) then
    new.status_id := null;
  end if;
  if new.client_id is not null and not exists (select 1 from public.ag_clients where id = new.client_id and owner_id = new.owner_id) then
    new.client_id := null;
  end if;
  -- telas antigas que só mudam o texto do status
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status_id is not distinct from old.status_id then
    new.status_id := null;
  end if;
  if new.status_id is null then
    new.status_id := private.content_status_for(new.owner_id, case coalesce(new.status, 'backlog')
      when 'produzindo' then 'producao' when 'agendado' then 'agendado' when 'publicado' then 'publicado'
      else case when new.planned_for is not null then 'pauta' else 'ideia' end end);
    if new.status_id is null then
      select id into new.status_id from public.content_statuses where owner_id = new.owner_id order by position limit 1;
    end if;
  end if;
  select stage into v_stage from public.content_statuses where id = new.status_id;
  new.status := case
    when v_stage in ('ideia','pauta') then 'backlog'
    when v_stage in ('roteiro','producao','edicao','revisao','aprovacao') then 'produzindo'
    when v_stage = 'agendado' then 'agendado'
    when v_stage in ('publicado','analisado') then 'publicado'
    else coalesce(case when tg_op = 'UPDATE' then old.status end, 'produzindo') end;
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    new.status_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace trigger content_ideas_lifecycle before insert or update on public.content_ideas
  for each row execute function private.content_ideas_lifecycle();

-- grava cada mudança de status (para medir tempo por etapa)
create or replace function private.content_ideas_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    insert into public.content_events(owner_id, idea_id, kind, from_status, to_status)
    values (new.owner_id, new.id, 'status',
      case when tg_op = 'UPDATE' then (select name from public.content_statuses where id = old.status_id) end,
      (select name from public.content_statuses where id = new.status_id));
  end if;
  return null;
end $$;

create or replace trigger content_ideas_zlog after insert or update on public.content_ideas
  for each row execute function private.content_ideas_log();

-- ── publicação pelo HUB move o conteúdo vinculado ──
create or replace function private.scheduled_posts_to_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_target uuid;
begin
  if new.idea_id is null or (tg_op = 'UPDATE' and new.status is not distinct from old.status) then return null; end if;
  if new.status = 'publicado' then
    update public.content_ideas set
      status_id = coalesce(private.content_status_for(owner_id, 'publicado'), status_id),
      post_url = coalesce(new.permalink, post_url), ig_media_id = coalesce(new.ig_media_id, ig_media_id), publish_error = null
    where id = new.idea_id;
  elsif new.status = 'erro' then
    update public.content_ideas set
      status_id = coalesce(private.content_status_for(owner_id, 'agendado'), status_id),
      publish_error = coalesce(new.error, 'Falha ao publicar')
    where id = new.idea_id;
  elsif new.status = 'agendado' then
    -- só avança: conteúdo que ainda está antes de Agendado passa para Agendado
    select s.id into v_target from public.content_ideas c
      join public.content_statuses s on s.owner_id = c.owner_id and s.stage = 'agendado'
      join public.content_statuses cur on cur.id = c.status_id
      where c.id = new.idea_id and cur.position < s.position
      order by s.position limit 1;
    if v_target is not null then
      update public.content_ideas set status_id = v_target, publish_error = null where id = new.idea_id;
    end if;
  end if;
  return null;
end $$;

create or replace trigger scheduled_posts_zcontent after insert or update on public.scheduled_posts
  for each row execute function private.scheduled_posts_to_content();

-- ── aprovação do cliente por link público (sem login) ──
create or replace function public.content_approval_get(p_token uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'title', c.title, 'format', c.format, 'planned_for', c.planned_for, 'final_url', c.final_url,
    'caption', coalesce(c.caption, ''), 'approval', c.approval, 'revisions', c.revisions,
    'username', a.username, 'client', coalesce(cl.company, cl.name))
  from public.content_ideas c
  left join public.ig_accounts a on a.id = c.account_id
  left join public.ag_clients cl on cl.id = c.client_id
  where p_token is not null and c.approval_token = p_token and c.archived_at is null
$$;

create or replace function public.content_approval_answer(p_token uuid, p_decision text, p_comment text, p_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c record; v_next uuid;
begin
  if p_decision not in ('aprovado', 'ajuste') then return false; end if;
  select i.id, i.owner_id, i.status_id into c from public.content_ideas i
    where p_token is not null and i.approval_token = p_token and i.archived_at is null and coalesce(i.approval, 'pendente') = 'pendente';
  if not found then return false; end if;
  if p_decision = 'aprovado' then
    -- se está em Aprovação do cliente, segue para o próximo status
    select n.id into v_next from public.content_statuses cur
      join public.content_statuses n on n.owner_id = cur.owner_id and n.position > cur.position
      where cur.id = c.status_id and cur.stage = 'aprovacao' order by n.position limit 1;
    update public.content_ideas set approval = 'aprovado', approved_at = now(), approval_note = nullif(left(trim(coalesce(p_comment, '')), 4000), ''),
      status_id = coalesce(v_next, status_id) where id = c.id;
  else
    update public.content_ideas set approval = 'ajuste', revisions = revisions + 1, approval_note = left(trim(coalesce(p_comment, '')), 4000),
      status_id = coalesce(private.content_status_for(c.owner_id, 'edicao'), status_id) where id = c.id;
  end if;
  insert into public.content_events(owner_id, idea_id, kind, text, author)
  values (c.owner_id, c.id, 'cliente',
    case when p_decision = 'aprovado' then 'Aprovou o conteúdo' else 'Pediu ajuste' end ||
    case when coalesce(trim(p_comment), '') <> '' then ': ' || left(p_comment, 4000) else '' end,
    left(coalesce(nullif(trim(p_name), ''), 'Cliente'), 120));
  return true;
end $$;
grant execute on function public.content_approval_get(uuid) to anon, authenticated;
grant execute on function public.content_approval_answer(uuid, text, text, text) to anon, authenticated;

-- ── Quadro de produção entra em todo plano (e liberação individual) que já tem o Creator ──
update public.plans set tools = array_append(tools, 'creator:producao')
  where not ('creator:producao' = any(tools)) and exists (select 1 from unnest(tools) t where t like 'creator:%');
update public.profiles set tools = array_append(tools, 'creator:producao')
  where tools is not null and not ('creator:producao' = any(tools)) and exists (select 1 from unnest(tools) t where t like 'creator:%');

-- ── conteúdos que já existem ganham status_id ──
update public.content_ideas set status_id = null where status_id is null;
