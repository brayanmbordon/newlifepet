-- 04 · Melhorias de segurança e desempenho  (RODAR AGORA)
-- Pode rodar mais de uma vez sem problema.

-- 1) Índices: deixam as consultas rápidas quando o histórico crescer
create index if not exists agendamentos_d_idx   on public.agendamentos (d);
create index if not exists agendamentos_cid_idx on public.agendamentos (cid);
create index if not exists pagamentos_d_idx     on public.pagamentos (d);
create index if not exists pagamentos_c_idx     on public.pagamentos (c);

-- 2) Impede dois atendimentos no mesmo horário, mesmo que duas pessoas agendem ao mesmo tempo
--    (a tela já esconde horários ocupados; aqui o banco garante a regra).
--    Mesma regra da tela: ignora cancelados e os que o cliente pediu para reagendar.
--    Banho e Tosa ocupa 1 hora; Banho ou Tosa, 30 minutos.
create or replace function public.checar_conflito_horario() returns trigger
language plpgsql set search_path = '' as $$
declare
  ini time;
  fim time;
begin
  if new.st = 'Cancelado' or coalesce(new.cf, '') = 'r' then
    return new;
  end if;

  ini := new.t::time;
  fim := ini + case when new.s = 'Banho e Tosa' then interval '60 minutes' else interval '30 minutes' end;

  if exists (
    select 1 from public.agendamentos a
    where a.d = new.d
      and a.id is distinct from new.id
      and a.st <> 'Cancelado'
      and coalesce(a.cf, '') <> 'r'
      and a.t::time < fim
      and a.t::time + case when a.s = 'Banho e Tosa' then interval '60 minutes' else interval '30 minutes' end > ini
  ) then
    raise exception 'Já existe um atendimento neste horário.';
  end if;

  return new;
end $$;

drop trigger if exists trg_conflito_horario on public.agendamentos;
create trigger trg_conflito_horario
  before insert or update of d, t, s, cf on public.agendamentos
  for each row execute function public.checar_conflito_horario();

-- 3) Registrar pagamento em uma operação só: grava o pagamento e marca o cliente como Pago.
--    O valor vem do cadastro do cliente (não da tela) e, se algo falhar, nada é gravado pela metade.
create or replace function public.registrar_pagamento(p_cliente bigint, p_data date, p_forma text)
returns void language plpgsql set search_path = '' as $$
declare v numeric;
begin
  select valor into v from public.clientes where id = p_cliente for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  insert into public.pagamentos (d, v, f, c) values (p_data, v, p_forma, p_cliente);
  update public.clientes set pag = 'Pago', forma = p_forma, dp = p_data where id = p_cliente;
end $$;

revoke execute on function public.registrar_pagamento(bigint, date, text) from public, anon;
grant execute on function public.registrar_pagamento(bigint, date, text) to authenticated;
