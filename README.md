# New Life Pet

Sistema de gestão do pet shop: cadastro de tutores e pets, agendamento de banho e tosa, histórico e financeiro.
Site estático (HTML + CSS + JavaScript) com banco de dados e login no [Supabase](https://supabase.com).

## Estrutura

```
index.html            página única
css/style.css         visual
js/
  main.js             entrada: cabeçalho, abas e início do sistema
  config.js           URL e chave pública do Supabase, nome do bucket de fotos
  supabase.js         conexão com o Supabase e opção "manter dispositivo conectado"
  state.js            dados carregados (clientes, agenda, pagamentos, perfis) e estado da tela
  ui.js               janelas (modal), avisos e eventos dos botões
  utils.js            funções e constantes comuns (datas, moeda, WhatsApp...)
  auth.js             login, logout, sessão
  cadastro.js         guia Cadastro
  agenda.js           guia Agendamento
  historico.js        guia Histórico
  financeiro.js       guia Financeiro e janela de pagamento
  usuarios.js         guia Usuários e "Meu perfil"
  fotos.js            fotos no Supabase Storage
sql/                  scripts do banco, em ordem (01 a 04)
vercel.json           cabeçalhos de segurança para a publicação
```

Os botões não usam `onclick`. Cada botão tem `data-click="nome"` e o módulo da guia registra a ação com `acoes({ nome: funcao })`.

## Rodar no computador

Os arquivos JavaScript são módulos, então **não abrem com duplo clique**. Use um servidor local:

- **VS Code:** instale a extensão *Live Server*, clique com o botão direito em `index.html` → *Open with Live Server*.
- **Ou, com Node instalado:** na pasta do projeto, `npx serve` e abra o endereço mostrado.

## Banco de dados (Supabase)

No **SQL Editor**, rode os arquivos da pasta `sql/` em ordem. Os dois primeiros já foram executados no seu projeto:

| Arquivo | O que faz | Situação |
|---|---|---|
| `01_schema.sql` | tabelas e regras de segurança | já executado |
| `02_vincular_usuario.sql` | função para cadastrar usuários pela tela | já executado |
| `03_fotos_storage.sql` | bucket `fotos` e permissões das fotos | **rodar** |
| `04_melhorias.sql` | índices, trava de horário duplicado, pagamento em uma operação | **rodar** |

Em **Authentication → Sign In / Providers**, deixe desativado *Allow new users to sign up*.

### Criar um novo usuário
1. Supabase → **Authentication → Users → Add user** (marque *Auto Confirm User*).
2. No sistema, como administrador: **Usuários → + Novo usuário**, com o mesmo e-mail.

## Publicar (Vercel)

1. Crie um repositório no GitHub e envie esta pasta (um repositório só, com tudo dentro).
2. Em [vercel.com](https://vercel.com): **Add New → Project** → escolha o repositório.
3. *Framework Preset*: **Other**. Deixe *Build Command* e *Output Directory* em branco. **Deploy**.
4. Domínio: **Settings → Domains**, adicione e siga as instruções de DNS.
5. No Supabase, em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL*.

A cada `git push`, a Vercel publica a nova versão sozinha.

## Segurança

- Só o URL e a chave `sb_publishable_...` ficam no código. **Nunca** coloque a chave `sb_secret_...` (ou `service_role`) nem a senha do banco.
- Quem protege os dados são as regras RLS do banco: sem login, nada é lido nem gravado.
- Para bloquear alguém na hora, use **Usuários → Remover acesso**.
