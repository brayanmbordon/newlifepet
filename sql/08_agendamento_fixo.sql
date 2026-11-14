-- 08 · Agendamento fixo dos pacotes (dia da semana, horário e serviço preferidos de cada pet)
-- Usado pelo botão "Gerar agendamentos do mês" na guia Agendamento.
-- Pode rodar mais de uma vez sem problema.

alter table public.pets add column if not exists dia_sem smallint check (dia_sem between 1 and 6); -- 1 = Seg ... 6 = Sáb
alter table public.pets add column if not exists hora_fixa text;                                     -- ex.: '10:00'
alter table public.pets add column if not exists serv_fixo text not null default 'Banho'
  check (serv_fixo in ('Banho', 'Tosa', 'Banho e Tosa'));
