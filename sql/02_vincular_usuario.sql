-- 02 · Função que o administrador usa na tela "Usuários" para ligar um acesso (criado no
-- Supabase Auth) ao nome e ao perfil dentro do sistema.
-- JÁ EXECUTADO no seu projeto. Rodar de novo não causa problema.

create or replace function public.vincular_usuario(p_email text, p_nome text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administrador'; end if;
  if p_role not in ('admin','user') then raise exception 'Perfil inválido'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'E-mail não encontrado no Supabase Auth. Crie o usuário primeiro.'; end if;
  insert into public.perfis (id, nome, role) values (uid, p_nome, p_role)
  on conflict (id) do update set nome = excluded.nome, role = excluded.role;
  return uid;
end $$;

revoke execute on function public.vincular_usuario(text, text, text) from public, anon;
grant execute on function public.vincular_usuario(text, text, text) to authenticated;
