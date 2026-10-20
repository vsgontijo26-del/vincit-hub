-- Fila do Claude: os botões de IA do HUB gravam o pedido aqui em vez de chamar a API da Anthropic.
-- Uma tarefa agendada do Claude (assinatura do Vinícius) lê os pedidos pendentes, responde e grava result_text.
-- O navegador chama a rota de novo e ela segue igual (JSON, gravação em profile_diagnoses, ref_profiles…).
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid,
  endpoint text not null check (endpoint in ('ai', 'diagnostico', 'ref-profile')),
  task text,
  label text,
  payload jsonb not null default '{}'::jsonb,
  system text,
  prompt text not null,
  web_search boolean not null default false,
  max_tokens int,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  result_text text,
  error text,
  response jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  done_at timestamptz,
  delivered_at timestamptz
);

create index if not exists ai_requests_fila on public.ai_requests (status, created_at);
create index if not exists ai_requests_user on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

create policy ai_requests_select on public.ai_requests for select to authenticated using (user_id = auth.uid());

-- o usuário só cria pedido pendente e sem resposta; quem responde é o Claude, fora da sessão do usuário
create policy ai_requests_insert on public.ai_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and result_text is null and response is null);

create policy ai_requests_update on public.ai_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- no update, o usuário só marca a entrega (response e delivered_at); status e result_text ficam com o Claude
revoke update on public.ai_requests from anon, authenticated;
grant update (response, delivered_at) on public.ai_requests to authenticated;
revoke all on public.ai_requests from anon;
