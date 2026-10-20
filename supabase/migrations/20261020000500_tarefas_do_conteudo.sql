-- Tarefas que nascem do conteúdo (rascunho da conversa Seu dia, revisado). Regra: seção 3 de regras-seu-dia.md.
-- Entrar em Produção com data de gravação cria "Gravar: título" (prazo = data de gravação);
-- entrar em Edição cria "Editar: título"; entrar em Aprovação com aprovação pendente cria
-- "Enviar para aprovação: título". Não duplica (uma tarefa aberta por conteúdo e tipo) e concluir
-- a tarefa não move o conteúdo. As tarefas ficam no espaço Conteúdo do assinante (ag_spaces.kind = 'conteudo').
-- Os gatilhos não usam "update of coluna": o status muda também por outros gatilhos.

create or replace function private.content_spawn_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
declare st text; prefix text; due date; sp uuid; first_status uuid;
begin
  if new.archived_at is not null or new.status_id is not distinct from old.status_id then return null; end if;
  select stage into st from public.content_statuses where id = new.status_id;
  if st = 'producao' and new.record_date is not null then prefix := 'Gravar: '; due := new.record_date;
  elsif st = 'edicao' then prefix := 'Editar: ';
  elsif st = 'aprovacao' and coalesce(new.approval, 'pendente') = 'pendente' then prefix := 'Enviar para aprovação: ';
  else return null; end if;

  if exists (select 1 from public.ag_tasks where content_id = new.id and title = prefix || coalesce(new.title, '') and not done) then
    return null;
  end if;

  select id into sp from public.ag_spaces where owner_id = new.owner_id and kind = 'conteudo';
  if sp is null then
    insert into public.ag_spaces (owner_id, name, color, position, kind)
    values (new.owner_id, 'Conteúdo', '#c084fc', coalesce((select max(position) + 1 from public.ag_spaces where owner_id = new.owner_id), 0), 'conteudo')
    returning id into sp;
    insert into public.ag_space_statuses (owner_id, space_id, name, color, type, position) values
      (new.owner_id, sp, 'A fazer', '#8a8f94', 'aberto', 0),
      (new.owner_id, sp, 'Em andamento', '#f5c84c', 'andamento', 1),
      (new.owner_id, sp, 'Concluído', '#6eefb6', 'concluido', 2);
  end if;
  select id into first_status from public.ag_space_statuses where space_id = sp order by position limit 1;

  insert into public.ag_tasks (owner_id, title, due_date, space_id, status_id, content_id, assignee, description)
  values (new.owner_id, prefix || coalesce(new.title, ''), due, sp, first_status, new.id, new.assignee, '/creator/producao?c=' || new.id);
  return null;
end $$;
create or replace trigger content_ideas_zspawn_tasks after update on public.content_ideas
  for each row execute function private.content_spawn_tasks();

-- prazo da tarefa "Gravar" acompanha a data de gravação
create or replace function private.content_sync_record_date()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.record_date is distinct from old.record_date then
    update public.ag_tasks set due_date = new.record_date
    where content_id = new.id and title like 'Gravar: %' and not done;
  end if;
  return null;
end $$;
create or replace trigger content_ideas_zsync_record_date after update on public.content_ideas
  for each row execute function private.content_sync_record_date();

revoke all on function private.content_spawn_tasks(), private.content_sync_record_date() from public, anon, authenticated;
