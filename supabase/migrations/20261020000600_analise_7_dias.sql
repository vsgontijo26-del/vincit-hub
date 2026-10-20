-- Conversa Integrações · rotina "Analisado" (métricas de 7 dias)
-- Depende da migração da Produção: content_ideas.ig_media_id, status_id, status_changed_at
-- e private.content_status_for(owner_id, stage). Aplicar depois dela.

-- conteúdos publicados há 7+ dias com post vinculado, com o token da conta (só para o cron)
create or replace function public.wh_analysis_due(p_secret text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_secret(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object('idea_id', c.id, 'owner_id', c.owner_id, 'account_id', c.account_id, 'ig_media_id', c.ig_media_id, 'token', t.access_token))
    from (
      select c.* from public.content_ideas c
      left join public.ig_posts p on p.account_id = c.account_id and p.ig_media_id = c.ig_media_id
      where c.ig_media_id is not null and c.account_id is not null
        and c.status_id = private.content_status_for(c.owner_id, 'publicado')
        and coalesce(p.posted_at, c.status_changed_at) <= now() - interval '7 days'
      limit 50
    ) c
    join private.ig_tokens t on t.account_id = c.account_id
  ), '[]'::jsonb);
end $$;

-- grava as métricas do post e move o conteúdo para o status de stage 'analisado' do dono
create or replace function public.wh_analysis_done(p_secret text, p_idea_id uuid, p_row jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  perform private.check_secret(p_secret);
  select * into c from public.content_ideas where id = p_idea_id;
  if not found then return; end if;
  if p_row ? 'ig_media_id' then
    insert into public.ig_posts (owner_id, account_id, ig_media_id, media_type, caption, permalink, thumbnail_url, posted_at, like_count, comments_count, reach, saved, shares, plays)
    values (c.owner_id, c.account_id, p_row->>'ig_media_id', p_row->>'media_type', p_row->>'caption', p_row->>'permalink', p_row->>'thumbnail_url',
      (p_row->>'posted_at')::timestamptz, coalesce((p_row->>'like_count')::int, 0), coalesce((p_row->>'comments_count')::int, 0),
      (p_row->>'reach')::int, (p_row->>'saved')::int, (p_row->>'shares')::int, (p_row->>'plays')::int)
    on conflict (account_id, ig_media_id) do update set
      caption = excluded.caption, permalink = excluded.permalink, thumbnail_url = excluded.thumbnail_url,
      like_count = excluded.like_count, comments_count = excluded.comments_count,
      reach = coalesce(excluded.reach, public.ig_posts.reach), saved = coalesce(excluded.saved, public.ig_posts.saved),
      shares = coalesce(excluded.shares, public.ig_posts.shares), plays = coalesce(excluded.plays, public.ig_posts.plays);
  end if;
  update public.content_ideas set status_id = private.content_status_for(c.owner_id, 'analisado') where id = p_idea_id;
end $$;

revoke all on function public.wh_analysis_due(text) from public, authenticated;
revoke all on function public.wh_analysis_done(text, uuid, jsonb) from public, authenticated;
grant execute on function public.wh_analysis_due(text) to anon;
grant execute on function public.wh_analysis_done(text, uuid, jsonb) to anon;
