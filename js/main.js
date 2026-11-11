// Ponto de entrada: monta a tela principal (cabeçalho, abas e conteúdo) e inicia o sistema.
import { $, esc } from './utils.js';
import { X, atualizar } from './state.js';
import { render, definirRenderizador, iniciarEventos, acoes, modalAberto, msgErro } from './ui.js';
import { avatar } from './fotos.js';
import { telaLogin, iniciar } from './auth.js';
import { telaCadastro } from './cadastro.js';
import { telaAgenda } from './agenda.js';
import { telaHistorico } from './historico.js';
import { telaFinanceiro } from './financeiro.js';
import { telaUsuarios } from './usuarios.js';

const TELAS = { c: telaCadastro, a: telaAgenda, h: telaHistorico, f: telaFinanceiro, u: telaUsuarios };

function botaoUsuario(u) {
  return `<div class="ub">
    <button class="ubm" title="Meu perfil" data-click="usuarioForm" data-id="${esc(u.id)}">
      <span class="av">${avatar(u)}</span>
      <span class="un"><b>${esc(u.nome)}</b><small>${u.role === 'admin' ? 'Administrador' : 'Usuário'}</small></span>
    </button>
    <button class="out" data-click="sair">Sair</button></div>`;
}

function desenhar() {
  const u = X.usuario;
  $('#hu').innerHTML = u ? botaoUsuario(u) : '';
  if (!u) {
    $('#tabs').innerHTML = '';
    $('#v').innerHTML = telaLogin();
    return;
  }
  if (X.aba === 'u' && u.role !== 'admin') X.aba = 'a';
  const abas = [['c', 'Cadastro'], ['a', 'Agendamento'], ['h', 'Histórico'], ['f', 'Financeiro'], ...(u.role === 'admin' ? [['u', 'Usuários']] : [])];
  $('#tabs').innerHTML = abas.map(([id, nome]) => `<button class="${X.aba === id ? 'on' : ''}" data-click="aba" data-aba="${id}">${nome}</button>`).join('');
  $('#v').innerHTML = TELAS[X.aba]();
}

acoes({ aba: (d) => { X.aba = d.aba; render(); } });

definirRenderizador(desenhar);
iniciarEventos();

// Erros que escaparem de qualquer lugar aparecem como aviso na tela
window.addEventListener('unhandledrejection', (ev) => { ev.preventDefault(); msgErro(ev.reason); });

// Ao voltar para a aba/janela, recarrega os dados (útil quando duas pessoas usam o sistema)
window.addEventListener('focus', () => {
  if (X.usuario && !modalAberto()) atualizar().catch(() => {});
});

iniciar();
