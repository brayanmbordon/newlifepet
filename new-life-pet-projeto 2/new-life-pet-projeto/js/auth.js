// Login, logout e controle da sessão.
import { sb, definirManterConectado } from './supabase.js';
import { $, esc } from './utils.js';
import { X, carregar, limparEstado } from './state.js';
import { render, acoes, msgErro } from './ui.js';

export function telaLogin() {
  return `<div class="box login-box">
    <img class="logo-login" src="img/logo.jpg" alt="New Life Pet" width="120" height="120">
    <h2>Entrar</h2><p class="mu">Acesse o sistema da New Life Pet</p>
    <div class="g">
      <label class="w">E-mail<input id="l_u" type="email" autocomplete="username" value="${esc(X.emailLogin)}" data-enter="entrar"></label>
      <label class="w">Senha<input id="l_p" type="password" autocomplete="current-password" data-enter="entrar"></label>
      <label class="w keep"><input type="checkbox" id="l_k" ${X.manter ? 'checked' : ''}><span>Manter este dispositivo conectado</span></label>
    </div>
    <p class="er">${esc(X.erroLogin)}</p>
    <div class="row"><button class="p" data-click="entrar">Entrar</button></div>
  </div>`;
}

// Chamada quando já existe uma sessão válida: carrega os dados e confere se o usuário tem perfil.
async function abrirSistema() {
  await carregar();
  if (!X.usuario) {
    await sb.auth.signOut();
    limparEstado();
    X.erroLogin = 'Este usuário ainda não tem perfil no sistema. Fale com o administrador.';
  }
  render();
}

let entrando = false;
async function entrar() {
  if (entrando) return;
  const email = $('#l_u').value.trim();
  const senha = $('#l_p').value;
  X.emailLogin = email;
  X.erroLogin = '';
  X.manter = $('#l_k').checked;
  definirManterConectado(X.manter);
  if (!email || !senha) { X.erroLogin = 'Informe e-mail e senha.'; return render(); }

  entrando = true;
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) {
      X.erroLogin = error.code === 'invalid_credentials' ? 'E-mail ou senha inválidos.' : `Não foi possível entrar: ${error.message}`;
      return render();
    }
    X.sessao = data.session;
    X.aba = 'a';
    await abrirSistema();
  } finally {
    entrando = false;
  }
}

async function sair() {
  try { await sb.auth.signOut(); } finally { limparEstado(); render(); }
}

export async function iniciar() {
  // Se a sessão acabar (expirou ou foi encerrada em outro lugar), volta para o login.
  sb.auth.onAuthStateChange((evento) => {
    if (evento !== 'SIGNED_OUT' || !X.usuario) return;
    setTimeout(() => {
      if (!X.usuario) return; // já tratado pelo botão Sair
      limparEstado();
      X.erroLogin = 'Sua sessão expirou. Entre novamente.';
      render();
    }, 0);
  });

  try {
    const { data } = await sb.auth.getSession();
    X.sessao = data.session;
    if (X.sessao) await abrirSistema(); else render();
  } catch (x) {
    msgErro(x);
    render();
  }
}

acoes({ entrar, sair });
