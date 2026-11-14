-- 09 · Pacote por ciclo: cada agendamento guarda a data de início do ciclo do pacote.
-- Ex.: pacote com 4 banhos contratado em 23/01 → banhos 23/01, 30/01, 06/02 e 13/02 são o mesmo ciclo,
-- mesmo atravessando o mês. A data de início do ciclo é o campo "criado" do pet (muda ao renovar).
-- Pode rodar mais de uma vez sem problema.

alter table public.agendamentos add column if not exists ciclo date;

-- Agendamentos já existentes, a partir do início do ciclo atual do pet, entram no ciclo atual
update public.agendamentos a
set ciclo = p.criado
from public.pets p
where a.cid = p.id and a.ciclo is null and a.d >= p.criado and p.pac <> 'Avulso';

create index if not exists agendamentos_cid_ciclo_idx on public.agendamentos (cid, ciclo);
