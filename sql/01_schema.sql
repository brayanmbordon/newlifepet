-- 01 · Tabelas e regras de segurança (RLS)
-- JÁ EXECUTADO no seu projeto. Fica aqui como registro: só rode de novo em um projeto Supabase novo.

-- TABELAS
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  role text not null default 'user' check (role in ('admin','user')),
  foto text   -- caminho do arquivo no bucket "fotos" (ver 03_fotos_storage.sql)
);

create table public.clientes (
  id bigint generated always as identity primary key,
  tutor text not null,
  pet text not null,
  raca text not null default '',
  obs text not null default '',
  tel text not null,
  email text not null default '',
  endereco text not null default '',
  pac text not null default 'Avulso' check (pac in ('Avulso','Semanal','Quinzenal','Mensal')),
  valor numeric(10,2) not null default 0,
  pag text not null default 'Pendente' check (pag in ('Pendente','Pago')),
  taxi boolean not null default false,
  oculto boolean not null default false,
  criado date not null default current_date,
  forma text,
  dp date
);

create table public.agendamentos (
  id bigint generated always as identity primary key,
  cid bigint not null references public.clientes(id) on delete cascade,  -- cliente
  d date not null,                                                       -- data
  t text not null,                                                       -- horário (HH:MM)
  s text not null check (s in ('Banho','Tosa','Banho e Tosa')),          -- serviço
  x boolean not null default false,                                      -- Taxi Dog
  st text not null default 'Agendado',                                   -- status
  ts text not null default 'Buscar',                                     -- etapa do Taxi Dog
  cf text check (cf in ('c','r'))                                        -- resposta do cliente
);

create table public.pagamentos (
  id bigint generated always as identity primary key,
  d date not null,                                                       -- data do pagamento
  v numeric(10,2) not null,                                              -- valor
  f text,                                                                -- forma
  c bigint references public.clientes(id) on delete set null             -- cliente
);

-- FUNÇÕES AUXILIARES
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = (select auth.uid()))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = (select auth.uid()) and role = 'admin')
$$;

revoke execute on function public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.is_staff(), public.is_admin() to authenticated;

-- SEGURANÇA (RLS)
alter table public.perfis enable row level security;
alter table public.clientes enable row level security;
alter table public.agendamentos enable row level security;
alter table public.pagamentos enable row level security;

create policy clientes_all on public.clientes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy agendamentos_all on public.agendamentos for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy pagamentos_all on public.pagamentos for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy perfis_select on public.perfis for select to authenticated
  using (public.is_staff());
create policy perfis_insert on public.perfis for insert to authenticated
  with check (public.is_admin());
create policy perfis_update on public.perfis for update to authenticated
  using (public.is_admin() or id = (select auth.uid()))
  with check (public.is_admin() or (id = (select auth.uid()) and role = 'user'));
create policy perfis_delete on public.perfis for delete to authenticated
  using (public.is_admin());
