-- 03 · Fotos dos usuários no Supabase Storage  (RODAR AGORA)
--
-- Como funciona:
--  • As fotos ficam no bucket "fotos", dentro de uma pasta com o id do usuário.
--  • A coluna perfis.foto guarda só o CAMINHO do arquivo, por exemplo:
--        3f2a…-uuid/1731340000000.jpg
--  • O bucket é público para leitura: o endereço da foto só abre para quem tem o
--    caminho completo (ele contém o id do usuário e um número de envio), e ninguém
--    consegue listar os arquivos sem estar logado.
--  • Enviar, trocar e apagar: o administrador mexe em qualquer foto; cada usuário só na própria pasta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 512000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fotos_ver     on storage.objects;
drop policy if exists fotos_enviar  on storage.objects;
drop policy if exists fotos_alterar on storage.objects;
drop policy if exists fotos_apagar  on storage.objects;

create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.is_staff());

create policy fotos_enviar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = (select auth.uid())::text))
  );

create policy fotos_alterar on storage.objects for update to authenticated
  using (
    bucket_id = 'fotos'
    and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = (select auth.uid())::text))
  )
  with check (
    bucket_id = 'fotos'
    and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = (select auth.uid())::text))
  );

create policy fotos_apagar on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = (select auth.uid())::text))
  );

-- OPCIONAL: se você já enviou alguma foto de teste pela versão antiga (salva dentro do banco),
-- este comando limpa esses registros para recomeçar com o Storage:
-- update public.perfis set foto = null where foto like 'data:%';
