-- Hub AGENCY virou GESTOR na interface: só o nome exibido do plano muda; as chaves "agency" em tools continuam.
update public.plans set name = 'Gestor' where lower(name) = 'agency';
