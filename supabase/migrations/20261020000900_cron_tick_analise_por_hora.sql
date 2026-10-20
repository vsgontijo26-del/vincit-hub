-- O app só analisa posts de 7+ dias no minuto 0 de cada hora. Antes, um conteúdo pendente
-- fazia o banco chamar /api/cron/tick a cada minuto à toa. Agora a checagem de análise segue
-- a mesma regra de wh_analysis_due e só vale no minuto 0.
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
     or exists (select 1 from public.scheduled_posts where (status = 'agendado' and scheduled_at <= now()) or status = 'publicando')
     -- conteúdo publicado há 7+ dias esperando as métricas (rotina Analisado, roda no minuto 0)
     or (extract(minute from now()) = 0 and exists (
           select 1 from public.content_ideas c
           join private.ig_tokens t on t.account_id = c.account_id
           left join public.ig_posts p on p.account_id = c.account_id and p.ig_media_id = c.ig_media_id
           where c.ig_media_id is not null and c.account_id is not null
             and c.status_id = private.content_status_for(c.owner_id, 'publicado')
             and coalesce(p.posted_at, c.status_changed_at) <= now() - interval '7 days')) then
    perform net.http_post(
      url := 'https://vincit-hub.vercel.app/api/cron/tick',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from private.app_config where key = 'webhook_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  end if;
end $$;
