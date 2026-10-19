-- Diagnóstico estratégico do perfil (Raio-X), uma linha por versão para comparar evolução.

create table if not exists public.profile_diagnoses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.ig_accounts(id) on delete cascade,
  version integer not null,
  result jsonb not null,   -- eixos (nota, evidência, recomendações), mercado, nicho, resumo
  inputs jsonb,            -- dados disponíveis quando rodou (nº de posts, briefing %, referências…)
  created_at timestamptz not null default now(),
  unique (account_id, version)
);
create index if not exists profile_diagnoses_account_idx on public.profile_diagnoses (account_id, created_at desc);
create index if not exists profile_diagnoses_owner_idx on public.profile_diagnoses (owner_id);
alter table public.profile_diagnoses enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_diagnoses' and policyname='owner') then
    create policy owner on public.profile_diagnoses for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;

-- Versão 1, 2, 3… por perfil, dada pelo banco e imutável; o perfil precisa ser do assinante
create or replace function private.profile_diagnoses_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.ig_accounts where id = new.account_id and owner_id = new.owner_id) then
      raise exception 'PERFIL_INVALIDO';
    end if;
    perform pg_advisory_xact_lock(hashtext('profile_diagnoses:' || new.account_id::text));
    select coalesce(max(version), 0) + 1 into new.version from public.profile_diagnoses where account_id = new.account_id;
  else
    new.version := old.version;
    new.account_id := old.account_id;
  end if;
  return new;
end $$;
revoke all on function private.profile_diagnoses_version() from public, anon, authenticated;
create or replace trigger profile_diagnoses_version before insert or update on public.profile_diagnoses
  for each row execute function private.profile_diagnoses_version();

-- Ideia nascida de uma recomendação: eixo e diagnóstico de origem
alter table public.content_ideas
  add column if not exists axis text check (axis in ('distribuicao','narrativa','canais','comunidade','conteudo')),
  add column if not exists diagnosis_id uuid references public.profile_diagnoses(id) on delete set null,
  add column if not exists growth_plan_id uuid references public.growth_plans(id) on delete set null;
create index if not exists content_ideas_diagnosis_id_idx on public.content_ideas (diagnosis_id);
create index if not exists content_ideas_growth_plan_id_idx on public.content_ideas (growth_plan_id);

-- Perfil ligado ao cliente do GESTOR; diagnóstico mensal automático opcional; estratégia ligada ao diagnóstico
alter table public.ig_accounts
  add column if not exists client_id uuid references public.ag_clients(id) on delete set null,
  add column if not exists diagnosis_auto boolean not null default false;
create index if not exists ig_accounts_client_id_idx on public.ig_accounts (client_id);
alter table public.growth_plans
  add column if not exists diagnosis_id uuid references public.profile_diagnoses(id) on delete set null;
create index if not exists growth_plans_diagnosis_id_idx on public.growth_plans (diagnosis_id);
