-- 05 · Correção de segurança encontrada na revisão  (RODAR AGORA)
--
-- Falha: a função registrar_pagamento() não conferia se quem a chamava era
-- um usuário do sistema (um "staff"). Ela só exigia estar logado no Supabase.
-- Como ninguém mais pode criar login (cadastro público está desativado), o
-- risco na prática era baixo, mas a função ficava sem essa trava própria,
-- diferente das outras. Corrigido para seguir a mesma regra das demais.

create or replace function public.registrar_pagamento(p_cliente bigint, p_data date, p_forma text)
returns void language plpgsql security definer set search_path = '' as $$
declare v numeric;
begin
  if not public.is_staff() then raise exception 'Apenas usuários do sistema'; end if;
  select valor into v from public.clientes where id = p_cliente for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  insert into public.pagamentos (d, v, f, c) values (p_data, v, p_forma, p_cliente);
  update public.clientes set pag = 'Pago', forma = p_forma, dp = p_data where id = p_cliente;
end $$;
