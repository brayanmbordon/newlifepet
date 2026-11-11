// Guia Cadastro: tutores e pets.
import { sb } from './supabase.js';
import { $, esc, moeda, PACOTES } from './utils.js';
import { S, X, q, cliente, atualizar } from './state.js';
import { modal, acoes, render } from './ui.js';
import { modalPagamento } from './financeiro.js';

const CAMPOS = [
  ['tutor', 'Nome do Tutor'], ['pet', 'Nome do Pet'], ['raca', 'Raça'],
  ['tel', 'Telefone (com DDD)'], ['email', 'E-mail'], ['end', 'Endereço'],
];
const opcoes = (lista, atual) => lista.map((x) => `<option ${x === atual ? 'selected' : ''}>${x}</option>`).join('');

export function telaCadastro() {
  const lista = S.clientes.filter((c) => X.mostrarOcultos || !c.oc);
  return `<div class="bar"><h2>Cadastros</h2><span class="r">
      <label><input type="checkbox" data-change="ocultos" ${X.mostrarOcultos ? 'checked' : ''}> Mostrar ocultos</label>
      <button class="p" data-click="cadastroForm">+ Novo cadastro</button></span></div>`
    + (lista.length ? lista.map(cartao).join('') : '<p class="mu">Nenhum cadastro.</p>');
}

function cartao(c) {
  return `<div class="card ${c.oc ? 'oc' : ''}">
    <div><b>${esc(c.pet)}</b> · ${esc(c.raca)}<br>
      <small>Tutor: ${esc(c.tutor)} · ${esc(c.tel)}${c.email ? ' · ' + esc(c.email) : ''}<br>${esc(c.end)}${c.obs ? '<br>Obs: ' + esc(c.obs) : ''}</small></div>
    <div class="r">
      <span class="tag">${esc(c.pac)}</span>
      <span class="tag">${c.taxi ? 'Com' : 'Sem'} Taxi Dog</span>
      <span class="tag ${c.pag === 'Pago' ? 'ok' : 'wa'}">${esc(c.pag)}</span>
      <b>${moeda(c.valor)}</b>
      <button data-click="cadastroForm" data-id="${c.id}">Editar</button>
      <button data-click="ocultar" data-id="${c.id}">${c.oc ? 'Reexibir' : 'Ocultar'}</button>
    </div></div>`;
}

function formCadastro(id) {
  const c = (id && cliente(id)) || { pac: 'Avulso', pag: 'Pendente', taxi: false };
  const campos = CAMPOS.map(([k, rotulo]) => `<label>${rotulo}<input id="f_${k}" value="${esc(c[k])}"></label>`).join('');
  modal(`<h3>${id ? 'Editar' : 'Novo'} cadastro</h3><div class="g">${campos}
      <label>Pacote<select id="f_pac">${opcoes(Object.keys(PACOTES), c.pac)}</select></label>
      <label>Valor (R$)<input id="f_valor" type="number" step="0.01" min="0" value="${c.valor || ''}"></label>
      <label>Status do pagamento<select id="f_pag">${opcoes(['Pendente', 'Pago'], c.pag)}</select></label>
      <label>Taxi Dog<select id="f_taxi"><option value="0">Sem Taxi Dog</option><option value="1" ${c.taxi ? 'selected' : ''}>Com Taxi Dog</option></select></label>
      <label class="w">Observação<textarea id="f_obs">${esc(c.obs)}</textarea></label></div>
      <p class="er" id="f_err"></p>`,
  [['Salvar', () => salvarCadastro(id), 'p'], ['Cancelar']]);
}

async function salvarCadastro(id) {
  const g = (k) => $('#f_' + k).value.trim();
  const erro = (t) => { $('#f_err').textContent = t; return false; };
  if (!g('tutor') || !g('pet')) return erro('Informe o tutor e o pet.');
  if (g('tel').replace(/\D/g, '').length < 10) return erro('Informe o telefone com DDD.');

  const dados = {
    tutor: g('tutor'), pet: g('pet'), raca: g('raca'), tel: g('tel'), email: g('email'), endereco: g('end'),
    obs: g('obs'), pac: g('pac'), valor: Math.max(0, Number(g('valor')) || 0), taxi: g('taxi') === '1',
  };
  const atual = id ? cliente(id) : null;
  const pagAntes = atual ? atual.pag : 'Pendente';
  const pagNovo = g('pag');
  let cid = id;

  if (atual) await q(sb.from('clientes').update(dados).eq('id', id));
  else cid = (await q(sb.from('clientes').insert(dados).select('id').single())).id;

  // Marcou como Pago: abre a janela para registrar forma e data do pagamento
  if (pagNovo === 'Pago' && pagAntes !== 'Pago') { await atualizar(); modalPagamento(cid); return; }
  if (atual && pagNovo !== pagAntes) await q(sb.from('clientes').update({ pag: pagNovo, forma: null, dp: null }).eq('id', id));
  await atualizar();
}

async function ocultar(id) {
  const c = cliente(id);
  await q(sb.from('clientes').update({ oculto: !c.oc }).eq('id', id));
  await atualizar();
}

acoes({
  ocultos: (d, el) => { X.mostrarOcultos = el.checked; render(); },
  cadastroForm: (d) => formCadastro(d.id),
  ocultar: (d) => ocultar(d.id),
});
