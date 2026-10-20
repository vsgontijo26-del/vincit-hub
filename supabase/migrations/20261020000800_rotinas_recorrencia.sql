-- Seu dia · rotinas personalizadas: a próxima ocorrência de uma tarefa recorrente
-- passa a levar horário, lembrete, rotina de origem, conteúdo e o checklist (subtarefas reabertas).
-- Pedido da conversa "Seu dia e tarefas" para a conversa Banco aplicar. Só substitui a função.

create or replace function public.ag_tasks_recur()
returns trigger language plpgsql set search_path = '' as $$
declare nxt date; base date; shift int; new_id uuid;
begin
  if new.done and not coalesce(old.done, false) and new.recurrence is not null and not new.recur_spawned and new.parent_id is null then
    base := coalesce(new.due_date, new.start_date, current_date);
    nxt := public.ag_next_occurrence(base, new.recurrence);
    while nxt < current_date loop nxt := public.ag_next_occurrence(nxt, new.recurrence); end loop;
    if new.recurrence_until is null or nxt <= new.recurrence_until then
      shift := nxt - base;
      insert into public.ag_tasks (owner_id, title, project_id, assignee, due_date, start_date, priority, space_id, list_id, description, tags, position,
                                   recurrence, recurrence_until, event_id, due_time, remind_at, routine_key, content_id)
      values (new.owner_id, new.title, new.project_id, new.assignee,
        case when new.due_date is not null then nxt end,
        case when new.start_date is not null then new.start_date + shift end,
        new.priority, new.space_id, new.list_id, new.description, new.tags, new.position, new.recurrence, new.recurrence_until, new.event_id,
        new.due_time,
        case when new.remind_at is not null then new.remind_at + make_interval(days => shift) end,
        new.routine_key, new.content_id)
      returning id into new_id;
      -- checklist: as subtarefas voltam abertas na próxima ocorrência
      insert into public.ag_tasks (owner_id, title, parent_id, space_id, list_id, assignee, priority, position)
      select owner_id, title, new_id, new.space_id, new.list_id, assignee, priority, position
        from public.ag_tasks where parent_id = new.id order by created_at;
    end if;
    new.recur_spawned := true;
  end if;
  return new;
end $$;
