-- Projetos e Tarefas viram uma tela só: cada projeto é uma lista dentro do Gestor de tarefas.
-- ag_projects continua guardando os dados de entrega ao cliente (link, aprovação, revisões),
-- abertos como painel do projeto a partir das tarefas. Nenhuma coluna existente é removida.

alter table public.ag_lists
  add column if not exists project_id uuid references public.ag_projects(id) on delete cascade;
create unique index if not exists ag_lists_project_id_key on public.ag_lists (project_id) where project_id is not null;

alter table public.ag_projects add column if not exists archived_at timestamptz;

-- Tarefa gerada por um conteúdo em produção (Seu Dia)
alter table public.ag_tasks
  add column if not exists content_id uuid references public.content_ideas(id) on delete set null;
create index if not exists ag_tasks_content_id_idx on public.ag_tasks (content_id);

-- Garante a lista do projeto (no espaço onde estão as tarefas dele, senão no espaço padrão)
create or replace function public.ag_project_list(p_project uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pr record; lid uuid; sid uuid;
begin
  select id, owner_id, title into pr from public.ag_projects where id = p_project;
  if not found then return null; end if;
  select id into lid from public.ag_lists where project_id = pr.id;
  if lid is not null then return lid; end if;
  select t.space_id into sid from public.ag_tasks t
    where t.project_id = pr.id and t.space_id is not null group by t.space_id order by count(*) desc limit 1;
  if sid is null then sid := public.ag_ensure_default_space(pr.owner_id); end if;
  insert into public.ag_lists (owner_id, space_id, name, position, project_id)
  values (pr.owner_id, sid, coalesce(nullif(trim(pr.title), ''), 'Projeto'),
          coalesce((select max(position) + 1 from public.ag_lists where space_id = sid), 0), pr.id)
  returning id into lid;
  return lid;
end $$;
revoke execute on function public.ag_project_list(uuid) from public, anon, authenticated;

create or replace function public.ag_projects_list_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.ag_project_list(new.id);
  elsif new.title is distinct from old.title and coalesce(trim(new.title), '') <> '' then
    update public.ag_lists set name = trim(new.title) where project_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function public.ag_projects_list_sync() from public, anon, authenticated;
create or replace trigger ag_projects_zlist after insert or update of title on public.ag_projects
  for each row execute function public.ag_projects_list_sync();

-- Tarefa e projeto andam juntos: escolher o projeto põe a tarefa na lista dele; mover para
-- a lista de um projeto liga a tarefa a ele. Roda antes de ag_tasks_sync (ordem alfabética).
create or replace function public.ag_tasks_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare l record; old_space uuid;
begin
  old_space := new.space_id;
  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id) then
    if not exists (select 1 from public.ag_projects where id = new.project_id and owner_id = new.owner_id) then
      raise exception 'PROJETO_INVALIDO';
    end if;
    select id, space_id into l from public.ag_lists where id = public.ag_project_list(new.project_id);
    new.list_id := l.id;
    new.space_id := l.space_id;
  elsif new.list_id is not null and (tg_op = 'INSERT' or new.list_id is distinct from old.list_id) then
    select project_id, space_id into l from public.ag_lists where id = new.list_id;
    if l.project_id is not null then new.project_id := l.project_id;
    elsif tg_op = 'UPDATE' then new.project_id := null;  -- foi para uma lista comum: sai do projeto
    end if;
    new.space_id := coalesce(l.space_id, new.space_id);
  elsif tg_op = 'UPDATE' and new.list_id is null and old.list_id is not null and new.project_id is not null then
    new.project_id := null;  -- ficou sem lista: sai do projeto
  end if;
  -- mudou de espaço: a etapa antiga não vale mais; ag_tasks_sync escolhe a do novo espaço
  if new.space_id is distinct from old_space and new.status_id is not null
     and not exists (select 1 from public.ag_space_statuses where id = new.status_id and space_id = new.space_id) then
    new.status_id := null;
  end if;
  return new;
end $$;
revoke execute on function public.ag_tasks_project() from public, anon, authenticated;
create or replace trigger ag_tasks_aproject before insert or update on public.ag_tasks
  for each row execute function public.ag_tasks_project();

-- Migração dos dados atuais: uma lista por projeto e as tarefas do projeto dentro dela
select public.ag_project_list(id) from public.ag_projects;
update public.ag_tasks t set list_id = l.id
from public.ag_lists l
where l.project_id = t.project_id and t.list_id is distinct from l.id;
