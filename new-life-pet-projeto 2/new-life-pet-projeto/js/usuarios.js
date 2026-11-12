// Guia Usuários (somente administrador) e "Meu perfil", incluindo a foto.
import { sb } from './supabase.js';
import { $, esc } from './utils.js';
import { S, X, q, atualizar } from './state.js';
import { modal, acoes, msgErro } from './ui.js';
import { avatar, prepararFoto, enviarFoto, removerFoto } from './fotos.js';

const rotuloPerfil = (role) => (role === 'admin' ? 'Administrador' : 'Usuário');

export function telaUsuarios() {
  return `<div class="bar"><h2>Usuários</h2><button class="p" data-click="usuarioForm">+ Novo usuário</button></div>`
    + S.perfis.map((u) => `<div class="card">
        <div class="r"><span class="av sm">${avatar(u)}</span><div><b>${esc(u.nome)}</b> <span class="tag">${rotuloPerfil(u.role)}</span></div></div>
        <div class="r"><button data-click="usuarioForm" data-id="${esc(u.id)}">Editar</button>
          ${u.id === X.usuario.id ? '' : `<button data-click="usuarioRemover" data-id="${esc(u.id)}">Remover acesso</button>`}</div></div>`).join('');
}

// Foto escolhida na janela aberta:
//   undefined = não mexeu | null = remover | Blob = foto nova (ainda não enviada)
let fotoNova;
let previa = null;

function mostrarPrevia(blob) {
  if (previa) URL.revokeObjectURL(previa);
  previa = URL.createObjectURL(blob);
  $('#u_av').innerHTML = `<img src="${previa}" alt="">`;
}

function formUsuario(id) {
  fotoNova = undefined;
  const u = (id && S.perfis.find((p) => p.id === id)) || { nome: '', role: 'user' };
  const ehEu = Boolean(id) && id === X.usuario.id;
  const admin = X.usuario.role === 'admin';

  const novoAcesso = id ? '' : `<p class="w info">Primeiro crie o acesso no Supabase (Authentication → Users → Add user, com Auto Confirm User). Depois informe aqui o mesmo e-mail.</p>
      <label class="w">E-mail do acesso<input id="u_m" type="email"></label>`;
  const campoPerfil = admin && !ehEu
    ? `<label>Perfil<select id="u_r"><option value="user">Usuário</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option></select></label>` : '';
  const campoSenha = ehEu ? '<label class="w">Nova senha (vazio mantém a atual)<input id="u_p" type="password" autocomplete="new-password"></label>' : '';

  modal(`<h3>${ehEu ? 'Meu perfil' : id ? 'Editar usuário' : 'Novo usuário'}</h3><div class="g">
      <div class="w pf"><span class="av big" id="u_av">${avatar(u)}</span>
        <div class="r"><button type="button" data-click="fotoEscolher">Escolher foto</button><button type="button" data-click="fotoRemover">Remover</button>
          <input type="file" id="u_f" accept="image/*" hidden data-change="fotoArquivo"></div></div>
      ${novoAcesso}
      <label>Nome exibido<input id="u_n" value="${esc(u.nome)}"></label>
      ${campoPerfil}${campoSenha}
    </div><p class="er" id="u_e"></p>`,
  [['Salvar', () => salvar(id, u, ehEu), 'p'], ['Cancelar']]);
}

async function salvar(id, atual, ehEu) {
  const nome = $('#u_n').value.trim();
  const role = $('#u_r') ? $('#u_r').value : atual.role;
  const senha = ehEu ? $('#u_p').value : '';
  const email = id ? '' : $('#u_m').value.trim();
  const erro = (t) => { $('#u_e').textContent = t; return false; };

  if (!nome) return erro('Informe o nome.');
  if (!id && !email.includes('@')) return erro('Informe o e-mail do acesso.');
  if (senha && senha.length < 6) return erro('A senha deve ter ao menos 6 caracteres.');

  try {
    let uid = id;
    if (!id) {
      uid = await q(sb.rpc('vincular_usuario', { p_email: email, p_nome: nome, p_role: role }));
    } else {
      const campos = { nome };
      if (!ehEu) campos.role = role;
      await q(sb.from('perfis').update(campos).eq('id', id));
    }

    if (fotoNova !== undefined) {
      const enviada = fotoNova ? await enviarFoto(uid, fotoNova) : null;
      try {
        await q(sb.from('perfis').update({ foto: enviada }).eq('id', uid));
      } catch (x) {
        await removerFoto(enviada); // não deixa arquivo órfão se o banco recusou
        throw x;
      }
      await removerFoto(atual.foto); // só apaga a foto antiga depois que a nova foi salva
    }

    if (senha) {
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) throw error;
    }
  } catch (x) {
    atualizar().catch(() => {});
    return erro(x.message || 'Erro ao salvar.');
  }
  await atualizar();
}

function confirmarRemocao(id) {
  const u = S.perfis.find((p) => p.id === id);
  modal(`<p>Remover o acesso de <b>${esc(u.nome)}</b>? A conta continua no Supabase, mas ele não entra mais no sistema.</p>`, [
    ['Remover', async () => {
      await q(sb.from('perfis').delete().eq('id', id));
      await removerFoto(u.foto);
      await atualizar();
    }, 'p'],
    ['Cancelar'],
  ]);
}

acoes({
  usuarioForm: (d) => formUsuario(d.id),
  usuarioRemover: (d) => confirmarRemocao(d.id),
  fotoEscolher: () => $('#u_f').click(),
  fotoArquivo: async (d, el) => {
    const arquivo = el.files[0];
    el.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    try {
      fotoNova = await prepararFoto(arquivo);
      mostrarPrevia(fotoNova);
      $('#u_e').textContent = '';
    } catch (x) {
      $('#u_e').textContent = x.message;
    }
  },
  fotoRemover: () => {
    fotoNova = null;
    $('#u_av').textContent = ($('#u_n').value.trim().charAt(0) || '?').toUpperCase();
  },
});
