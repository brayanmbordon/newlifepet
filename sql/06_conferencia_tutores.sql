-- 06 · Conferência ANTES da migração  (SÓ CONSULTA — não muda nada no banco)
--
-- Roda o mesmo agrupamento que a migração (07) vai usar: um tutor por telefone,
-- ignorando espaços, parênteses e traços no número. Rode esta consulta no SQL
-- Editor e veja os resultados antes de rodar o arquivo 07.
--
-- O que olhar:
--  • "pets": quantos pets ficarão sob o mesmo tutor.
--  • "nomes_encontrados": se aparecer mais de um nome aqui, os cadastros têm
--    telefones iguais mas o nome do tutor foi digitado diferente nas vezes
--    (ou são mesmo tutores diferentes com telefones iguais por engano). A
--    migração usa o nome do cadastro MAIS RECENTE; os outros dá para corrigir
--    depois, pela tela "Editar tutor".
--  • "telefones_originais": como o telefone foi digitado em cada cadastro,
--    para confirmar que o agrupamento por número fez sentido.

select
  regexp_replace(tel, '\D', '', 'g')                          as telefone_normalizado,
  count(*)                                                     as pets,
  string_agg(distinct tutor, ' / ' order by tutor)             as nomes_encontrados,
  string_agg(distinct tel, ' / ' order by tel)                 as telefones_originais,
  string_agg(pet, ', ' order by pet)                           as nomes_dos_pets
from public.clientes
group by 1
order by pets desc, telefone_normalizado;
