-- 07 · Migração: separar Tutores e Pets  (RODAR DEPOIS de conferir o 06)
--
-- O que esta migração faz, em uma única transação (ou aplica tudo, ou nada muda):
--  1. Cria a tabela "tutores" (um por telefone).
--  2. Cria a tabela "pets", com os MESMOS ids que a tabela "clientes" já usava —
--     por isso o histórico de agendamentos e pagamentos continua ligado ao pet
--     certo, sem precisar mexer nessas duas tabelas.
--  3. Religa agendamentos e pagamentos para apontar para "pets".
--  4. Renomeia a tabela antiga para "clientes_backup_2026_11_12" — ela
--     continua no banco, intacta, como garantia. Nada é apagado.
--
-- Depois de confirmar que o sistema está funcionando bem com a nova estrutura
-- (dê alguns dias de uso), essa tabela de backup pode ser apagada com:
--   drop table public.clientes_backup_2026_11_12;
-- Isso é OPCIONAL e só deve ser feito quando você tiver certeza.

begin;

create table public.tutores (
  id bigint generated always as identity primary key,
  nome text not null,
  tel text not null,
  email text not null default '',
  endereco text not null default ''
);

create table public.pets (
  id bigint generated always as identity primary key,
  tutor_id bigint not null references public.tutores(id) on delete cascade,
  pet text not null,
  raca text not null default '',
  obs text not null default '',
  pac text not null default 'Avulso' check (pac in ('Avulso','Semanal','Quinzenal','Mensal')),
  valor numeric(10,2) not null default 0,
  pag text not null default 'Pendente' check (pag in ('Pendente','Pago')),
  taxi boolean not null default false,
  oculto boolean not null default false,
  criado date not null default current_date,
  forma text,
  dp date
);

-- Um tutor por telefone normalizado; usa os dados do cadastro mais recente desse telefone.
insert into public.tutores (nome, tel, email, endereco)
select distinct on (regexp_replace(tel, '\D', '', 'g'))
  tutor, tel, email, endereco
from public.clientes
order by regexp_replace(tel, '\D', '', 'g'), criado desc, id desc;

-- Pets com o MESMO id que tinham em "clientes".
insert into public.pets (id, tutor_id, pet, raca, obs, pac, valor, pag, taxi, oculto, criado, forma, dp)
overriding system value
select c.id, t.id, c.pet, c.raca, c.obs, c.pac, c.valor, c.pag, c.taxi, c.oculto, c.criado, c.forma, c.dp
from public.clientes c
join public.tutores t on regexp_replace(t.tel, '\D', '', 'g') = regexp_replace(c.tel, '\D', '', 'g');

-- A numeração de novos pets continua de onde "clientes" parou.
select setval(pg_get_serial_sequence('public.pets', 'id'), (select max(id) from public.pets));

create index pets_tutor_id_idx on public.pets (tutor_id);

-- Religa agendamentos e pagamentos para "pets" (acha o nome da trava automaticamente,
-- não importa como o Postgres batizou ela quando "clientes" foi criada).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.agendamentos'::regclass and contype = 'f'
             and confrelid = 'public.clientes'::regclass
  loop
    execute format('alter table public.agendamentos drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.agendamentos
  add constraint agendamentos_cid_fkey foreign key (cid) references public.pets(id) on delete cascade;

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.pagamentos'::regclass and contype = 'f'
             and confrelid = 'public.clientes'::regclass
  loop
    execute format('alter table public.pagamentos drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.pagamentos
  add constraint pagamentos_c_fkey foreign key (c) references public.pets(id) on delete set null;

-- Segurança (RLS) — mesma regra das outras tabelas: só quem está logado no sistema.
alter table public.tutores enable row level security;
alter table public.pets enable row level security;

create policy tutores_all on public.tutores for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy pets_all on public.pets for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- registrar_pagamento passa a olhar o valor no pet, não mais no cliente.
create or replace function public.registrar_pagamento(p_cliente bigint, p_data date, p_forma text)
returns void language plpgsql security definer set search_path = '' as $$
declare v numeric;
begin
  if not public.is_staff() then raise exception 'Apenas usuários do sistema'; end if;
  select valor into v from public.pets where id = p_cliente for update;
  if not found then raise exception 'Pet não encontrado'; end if;
  insert into public.pagamentos (d, v, f, c) values (p_data, v, p_forma, p_cliente);
  update public.pets set pag = 'Pago', forma = p_forma, dp = p_data where id = p_cliente;
end $$;

-- Backup da tabela antiga — nada é apagado.
alter table public.clientes rename to clientes_backup_2026_11_12;

commit;
