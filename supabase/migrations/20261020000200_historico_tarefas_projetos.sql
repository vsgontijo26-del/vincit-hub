-- Histórico de status de tarefas e projetos (o de conteúdo fica em content_events).
-- Só leitura para o assinante; gravado por gatilhos. Os gatilhos não usam "update of coluna":
-- o status muda também por outros gatilhos (ex.: concluir tarefa), e "update of" só dispara
-- quando a coluna está no SET do comando.

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('tarefa','projeto')),
  entity_id uuid not null,
  from_status_id uuid,
  to_status_id uuid,
  from_label text,
  to_label text,
  source text not null default 'usuario' check (source in ('usuario','cliente','sistema','migracao')),
  changed_at timestamptz not null default now()
);
comment on table public.status_history is 'Cada mudança de etapa de tarefa ou projeto. Os nomes ficam gravados porque as etapas são personalizáveis.';
create index if not exists status_history_entity_idx on public.status_history (entity, entity_id, changed_at);
create index if not exists status_history_owner_idx on public.status_history (owner_id, changed_at);
alter table public.status_history enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='status_history' and policyname='status_history_read') then
    create policy status_history_read on public.status_history for select to authenticated
      using (owner_id = (select auth.uid()));
  end if;
end $$;

create or replace function private.status_source()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('vincit.status_source', true), ''),
                  case when auth.uid() is null then 'sistema' else 'usuario' end);
$$;

create or replace function private.ag_tasks_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    insert into public.status_history (owner_id, entity, entity_id, from_status_id, to_status_id, from_label, to_label, source)
    values (new.owner_id, 'tarefa', new.id,
      case when tg_op = 'UPDATE' then old.status_id end, new.status_id,
      case when tg_op = 'UPDATE' then (select name from public.ag_space_statuses where id = old.status_id) end,
      (select name from public.ag_space_statuses where id = new.status_id),
      private.status_source());
  end if;
  return null;
end $$;
create or replace trigger ag_tasks_zhistory after insert or update on public.ag_tasks
  for each row execute function private.ag_tasks_history();

create or replace function private.ag_stage_label(p_stage text)
returns text language sql immutable set search_path = '' as $$
  select case p_stage when 'briefing' then 'Briefing' when 'pre_producao' then 'Pré-produção'
    when 'captacao' then 'Captação' when 'edicao' then 'Edição' when 'revisao' then 'Revisão do cliente'
    when 'entregue' then 'Entregue' else p_stage end;
$$;

create or replace function private.ag_projects_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.status_history (owner_id, entity, entity_id, from_label, to_label, source)
    values (new.owner_id, 'projeto', new.id, case when tg_op = 'UPDATE' then private.ag_stage_label(old.stage) end,
      private.ag_stage_label(new.stage), private.status_source());
  end if;
  return null;
end $$;
create or replace trigger ag_projects_zhistory after insert or update on public.ag_projects
  for each row execute function private.ag_projects_history();

revoke all on function private.ag_tasks_history(), private.ag_projects_history() from public, anon, authenticated;

-- Resposta do cliente pelo link público entra no histórico como "cliente" (resto igual ao atual)
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

-- Ponto de partida: etapa atual de cada tarefa e as mudanças de etapa já registradas nos projetos
insert into public.status_history (owner_id, entity, entity_id, to_status_id, to_label, source, changed_at)
select t.owner_id, 'tarefa', t.id, t.status_id, s.name, 'migracao', t.created_at
from public.ag_tasks t left join public.ag_space_statuses s on s.id = t.status_id
where not exists (select 1 from public.status_history h where h.entity = 'tarefa' and h.entity_id = t.id);
insert into public.status_history (owner_id, entity, entity_id, to_label, source, changed_at)
select p.owner_id, 'projeto', p.id, 'Briefing', 'migracao', p.created_at
from public.ag_projects p
where not exists (select 1 from public.status_history h where h.entity = 'projeto' and h.entity_id = p.id);
insert into public.status_history (owner_id, entity, entity_id, from_label, to_label, source, changed_at)
select e.owner_id, 'projeto', e.project_id,
  trim(split_part(substr(e.text, 7), '→', 1)), trim(split_part(e.text, '→', 2)), 'migracao', e.created_at
from public.ag_project_events e
where e.kind = 'status' and e.text like 'Etapa:%→%'
  and not exists (select 1 from public.status_history h where h.entity = 'projeto' and h.entity_id = e.project_id and h.changed_at = e.created_at);
