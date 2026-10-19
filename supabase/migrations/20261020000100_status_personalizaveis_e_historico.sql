-- Status personalizáveis do ciclo de vida do conteúdo + histórico de status (tarefas, conteúdos e projetos).
-- Só acrescenta: nenhuma coluna ou tabela existente é removida. O campo antigo content_ideas.status
-- continua sincronizado com o novo status_id para a tela atual do Planejador seguir funcionando.

-- 1. Status do conteúdo, por assinante (modelo padrão de 10, renomeáveis, reordenáveis, removíveis)
create table if not exists public.content_statuses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text check (key in ('ideia','pauta','roteiro','producao','edicao','revisao','aprovacao','agendado','publicado','analisado')),
  name text not null,
  color text not null default '#8a8f94',
  type text not null default 'andamento' check (type in ('aberto','andamento','concluido')),
  optional boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
comment on column public.content_statuses.key is 'Papel do status no ciclo padrão (null = status criado pelo assinante). Usado pelas regras automáticas: publicação, falha, ajuste do cliente.';
create unique index if not exists content_statuses_owner_key on public.content_statuses (owner_id, key) where key is not null;
create index if not exists content_statuses_owner_id_idx on public.content_statuses (owner_id, position);
alter table public.content_statuses enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='content_statuses' and policyname='content_statuses_owner') then
    create policy content_statuses_owner on public.content_statuses for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;

create or replace function public.content_ensure_statuses(p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or exists (select 1 from public.content_statuses where owner_id = p_owner) then return; end if;
  insert into public.content_statuses (owner_id, key, name, color, type, optional, position) values
    (p_owner, 'ideia',     'Ideia',               '#8a8f94', 'aberto',    false, 0),
    (p_owner, 'pauta',     'Pauta',               '#7aa2f7', 'andamento', false, 1),
    (p_owner, 'roteiro',   'Roteiro',             '#bb9af7', 'andamento', false, 2),
    (p_owner, 'producao',  'Produção',            '#f5c84c', 'andamento', false, 3),
    (p_owner, 'edicao',    'Edição',              '#ff9e64', 'andamento', false, 4),
    (p_owner, 'revisao',   'Revisão interna',     '#e0af68', 'andamento', false, 5),
    (p_owner, 'aprovacao', 'Aprovação do cliente','#2ac3de', 'andamento', true,  6),
    (p_owner, 'agendado',  'Agendado',            '#73daca', 'andamento', true,  7),
    (p_owner, 'publicado', 'Publicado',           '#6eefb6', 'concluido', false, 8),
    (p_owner, 'analisado', 'Analisado',           '#3d525a', 'concluido', false, 9);
end $$;
revoke execute on function public.content_ensure_statuses(uuid) from public, anon, authenticated;

create or replace function public.content_my_statuses()
returns setof public.content_statuses language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  perform public.content_ensure_statuses(auth.uid());
  return query select * from public.content_statuses where owner_id = auth.uid() order by position;
end $$;
revoke execute on function public.content_my_statuses() from public, anon;
grant execute on function public.content_my_statuses() to authenticated;

-- 2. Conteúdo (content_ideas) ganha os campos do ciclo de vida
alter table public.content_ideas
  add column if not exists status_id uuid references public.content_statuses(id) on delete set null,
  add column if not exists status_changed_at timestamptz,
  add column if not exists client_id uuid references public.ag_clients(id) on delete set null,
  add column if not exists assignee text,
  add column if not exists shoot_date date,
  add column if not exists final_url text,
  add column if not exists caption text,
  add column if not exists approval_mode text check (approval_mode in ('pular','manual','link')),
  add column if not exists approval_status text check (approval_status in ('pendente','aprovado','ajuste')),
  add column if not exists approved_at timestamptz,
  add column if not exists review_token uuid default gen_random_uuid(),
  add column if not exists revisions integer not null default 0,
  add column if not exists post_url text,
  add column if not exists ig_media_id text,
  add column if not exists published_at timestamptz,
  add column if not exists publish_error text,
  add column if not exists metrics jsonb not null default '{}'::jsonb,
  add column if not exists metrics_at timestamptz,
  add column if not exists archived_at timestamptz;
create unique index if not exists content_ideas_review_token on public.content_ideas (review_token);
create index if not exists content_ideas_status_id_idx on public.content_ideas (status_id);
create index if not exists content_ideas_client_id_idx on public.content_ideas (client_id);
create index if not exists content_ideas_planned_idx on public.content_ideas (owner_id, planned_for) where archived_at is null;

-- Mapeia o status antigo (texto do Planejador) <-> status novo
create or replace function public.content_legacy_status(p_key text, p_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_key in ('ideia','pauta') then 'backlog'
    when p_key = 'agendado' then 'agendado'
    when p_key in ('publicado','analisado') then 'publicado'
    when p_key is not null then 'produzindo'
    when p_type = 'concluido' then 'publicado'
    when p_type = 'aberto' then 'backlog'
    else 'produzindo' end;
$$;

create or replace function public.content_status_by_key(p_owner uuid, p_key text)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select id from public.content_statuses where owner_id = p_owner and key = p_key),
    (select id from public.content_statuses where owner_id = p_owner order by position limit 1));
$$;
revoke execute on function public.content_status_by_key(uuid, text) from public, anon, authenticated;

create or replace function public.content_ideas_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare st record;
begin
  perform public.content_ensure_statuses(new.owner_id);
  -- status novo vazio ou só o texto antigo mudou: deriva do texto
  if new.status_id is null
     or (tg_op = 'UPDATE' and new.status_id is not distinct from old.status_id and new.status is distinct from old.status) then
    new.status_id := public.content_status_by_key(new.owner_id, case coalesce(new.status, 'backlog')
      when 'produzindo' then 'producao' when 'agendado' then 'agendado' when 'publicado' then 'publicado' else 'ideia' end);
  end if;
  select key, type, owner_id into st from public.content_statuses where id = new.status_id;
  if st.owner_id is distinct from new.owner_id then raise exception 'STATUS_INVALIDO'; end if;
  new.status := public.content_legacy_status(st.key, st.type);
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    new.status_changed_at := now();
  end if;
  return new;
end $$;


create or replace trigger content_ideas_sync before insert or update on public.content_ideas
  for each row execute function public.content_ideas_sync();

-- 3. Histórico de status (só leitura para o assinante; gravado pelos gatilhos)
-- Os gatilhos não usam "update of coluna": o status muda também por outros gatilhos (ex.: concluir tarefa),
-- e "update of" só dispara quando a coluna está no SET do comando.
create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('tarefa','conteudo','projeto')),
  entity_id uuid not null,
  from_status_id uuid,
  to_status_id uuid,
  from_label text,
  to_label text,
  source text not null default 'usuario' check (source in ('usuario','cliente','sistema','migracao')),
  changed_at timestamptz not null default now()
);
comment on table public.status_history is 'Cada mudança de status de tarefa, conteúdo ou projeto. Os nomes ficam gravados (from_label/to_label) porque os status são personalizáveis.';
create index if not exists status_history_entity_idx on public.status_history (entity, entity_id, changed_at);
create index if not exists status_history_owner_idx on public.status_history (owner_id, changed_at);
alter table public.status_history enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='status_history' and policyname='status_history_read') then
    create policy status_history_read on public.status_history for select to authenticated
      using (owner_id = (select auth.uid()));
  end if;
end $$;

create or replace function public.status_source()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('vincit.status_source', true), ''),
                  case when auth.uid() is null then 'sistema' else 'usuario' end);
$$;

create or replace function public.content_ideas_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    insert into public.status_history (owner_id, entity, entity_id, from_status_id, to_status_id, from_label, to_label, source)
    values (new.owner_id, 'conteudo', new.id,
      case when tg_op = 'UPDATE' then old.status_id end, new.status_id,
      case when tg_op = 'UPDATE' then (select name from public.content_statuses where id = old.status_id) end,
      (select name from public.content_statuses where id = new.status_id),
      public.status_source());
  end if;
  return null;
end $$;

create or replace trigger content_ideas_zhistory after insert or update on public.content_ideas
  for each row execute function public.content_ideas_history();

create or replace function public.ag_tasks_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    insert into public.status_history (owner_id, entity, entity_id, from_status_id, to_status_id, from_label, to_label, source)
    values (new.owner_id, 'tarefa', new.id,
      case when tg_op = 'UPDATE' then old.status_id end, new.status_id,
      case when tg_op = 'UPDATE' then (select name from public.ag_space_statuses where id = old.status_id) end,
      (select name from public.ag_space_statuses where id = new.status_id),
      public.status_source());
  end if;
  return null;
end $$;

create or replace trigger ag_tasks_zhistory after insert or update on public.ag_tasks
  for each row execute function public.ag_tasks_history();

create or replace function public.ag_stage_label(p_stage text)
returns text language sql immutable set search_path = '' as $$
  select case p_stage when 'briefing' then 'Briefing' when 'pre_producao' then 'Pré-produção'
    when 'captacao' then 'Captação' when 'edicao' then 'Edição' when 'revisao' then 'Revisão do cliente'
    when 'entregue' then 'Entregue' else p_stage end;
$$;

create or replace function public.ag_projects_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.status_history (owner_id, entity, entity_id, from_label, to_label, source)
    values (new.owner_id, 'projeto', new.id, case when tg_op = 'UPDATE' then public.ag_stage_label(old.stage) end,
      public.ag_stage_label(new.stage), public.status_source());
  end if;
  return null;
end $$;

create or replace trigger ag_projects_zhistory after insert or update on public.ag_projects
  for each row execute function public.ag_projects_history();

revoke execute on function public.content_ideas_sync(), public.content_ideas_history(),
  public.ag_tasks_history(), public.ag_projects_history() from public, anon, authenticated;

-- Resposta do cliente pelo link público entra no histórico como "cliente"
create or replace function public.pub_submit_review(p_token uuid, p_decision text, p_comment text, p_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare pr record;
begin
  if p_decision not in ('aprovado', 'alteracao') then return false; end if;
  select id, owner_id into pr from public.ag_projects where review_token = p_token and delivery_url is not null;
  if not found then return false; end if;
  perform set_config('vincit.status_source', 'cliente', true);
  update public.ag_projects set review_status = p_decision,
    revisions = revisions + case when p_decision = 'alteracao' then 1 else 0 end,
    stage = case when p_decision = 'aprovado' then 'entregue' else 'edicao' end,
    delivered_at = case when p_decision = 'aprovado' then now() else delivered_at end
  where id = pr.id;
  insert into public.ag_project_events(owner_id, project_id, kind, text, author)
  values (pr.owner_id, pr.id, 'cliente',
    case when p_decision = 'aprovado' then 'Aprovou a entrega' else 'Pediu alteração' end ||
    case when coalesce(trim(p_comment), '') <> '' then ': ' || left(p_comment, 4000) else '' end,
    left(coalesce(nullif(trim(p_name), ''), 'Cliente'), 120));
  perform set_config('vincit.status_source', '', true);
  return true;
end $$;

-- 4. Post publicado ou com falha pelo HUB move o conteúdo de origem (regras 5 e 6 do PRD)
create or replace function public.scheduled_posts_to_content()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.idea_id is null or new.status is not distinct from old.status then return null; end if;
  perform set_config('vincit.status_source', 'sistema', true);
  if new.status = 'publicado' then
    update public.content_ideas set
      status_id = public.content_status_by_key(owner_id, 'publicado'),
      post_url = coalesce(new.permalink, post_url), ig_media_id = coalesce(new.ig_media_id, ig_media_id),
      published_at = coalesce(published_at, now()), publish_error = null
    where id = new.idea_id and owner_id = new.owner_id;
  elsif new.status = 'erro' then
    update public.content_ideas set
      status_id = public.content_status_by_key(owner_id, 'agendado'),
      publish_error = coalesce(nullif(new.error, ''), 'Falha na publicação')
    where id = new.idea_id and owner_id = new.owner_id;
  end if;
  perform set_config('vincit.status_source', '', true);
  return null;
end $$;
revoke execute on function public.scheduled_posts_to_content() from public, anon, authenticated;

create or replace trigger scheduled_posts_zcontent after update on public.scheduled_posts
  for each row execute function public.scheduled_posts_to_content();

-- 5. Migração dos dados atuais
-- Status padrão para todo assinante que já existe
select public.content_ensure_statuses(id) from auth.users;
-- Conteúdos existentes recebem status_id a partir do status antigo (o gatilho resolve)
update public.content_ideas set status_id = null where status_id is null;
-- Ponto de partida do histórico: status atual de cada tarefa e etapa de cada projeto
insert into public.status_history (owner_id, entity, entity_id, to_status_id, to_label, source, changed_at)
select t.owner_id, 'tarefa', t.id, t.status_id, s.name, 'migracao', t.created_at
from public.ag_tasks t left join public.ag_space_statuses s on s.id = t.status_id
where not exists (select 1 from public.status_history h where h.entity = 'tarefa' and h.entity_id = t.id);
insert into public.status_history (owner_id, entity, entity_id, to_label, source, changed_at)
select p.owner_id, 'projeto', p.id, 'Briefing', 'migracao', p.created_at
from public.ag_projects p
where not exists (select 1 from public.status_history h where h.entity = 'projeto' and h.entity_id = p.id);
-- Mudanças de etapa já registradas na linha do tempo do projeto ("Etapa: A → B")
insert into public.status_history (owner_id, entity, entity_id, from_label, to_label, source, changed_at)
select e.owner_id, 'projeto', e.project_id,
  trim(split_part(substr(e.text, 7), '→', 1)), trim(split_part(e.text, '→', 2)), 'migracao', e.created_at
from public.ag_project_events e
where e.kind = 'status' and e.text like 'Etapa:%→%'
  and not exists (select 1 from public.status_history h where h.entity = 'projeto' and h.entity_id = e.project_id and h.changed_at = e.created_at);
