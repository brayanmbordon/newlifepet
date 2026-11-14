// Guia Cadastro: tutores e, dentro de cada um, os pets (um tutor pode ter vários pets,
// cada um com seu próprio pacote/valor/pagamento).
import { sb } from './supabase.js';
import { $, esc, moeda, PACOTES, DURACAO, HORARIOS, DIAS_SEMANA } from './utils.js';
import { S, X, q, cliente, tutor, petsDoTutor, atualizar } from './state.js';
import { modal, acoes, render } from './ui.js';
import { modalPagamento } from './financeiro.js';
import { seloPet } from './pacote.js';

const opcoes = (lista, atual) => lista.map((x) => `<option ${x === atual ? 'selected' : ''}>${x}</option>`).join('');

export function telaCadastro() {
  const grupos = new Map(); // tutor_id (number) -> pets visíveis
  const busca = X.cadBusca.toLowerCase().trim();
  const buscaNum = busca.replace(/\D/g, '');
  const passaFiltro = (c) => X.cadFiltro === 'pacotes' ? c.pac !== 'Avulso'
    : X.cadFiltro === 'avulsos' ? c.pac === 'Avulso'
      : X.cadFiltro === 'pendentes' ? c.pag !== 'Pago' : true;
  const passaBusca = (c) => !busca || `${c.pet} ${c.tutor}`.toLowerCase().includes(busca)
    || (buscaNum.length >= 3 && String(c.tel).replace(/\D/g, '').includes(buscaNum));
  for (const c of S.clientes) {
    if (!X.mostrarOcultos && c.oc) continue;
    if (!passaFiltro(c) || !passaBusca(c)) continue;
    const chave = Number(c.tutor_id);
    (grupos.get(chave) || grupos.set(chave, []).get(chave)).push(c);
  }
  const tutores = [...grupos.keys()]
    .map((id) => tutor(id))
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const filtros = [['', 'Todos'], ['pacotes', 'Pacotes'], ['avulsos', 'Avulsos'], ['pendentes', 'Pendentes']]
    .map(([v, nome]) => `<button class="${X.cadFiltro === v ? 'on' : ''}" data-click="cadFiltro" data-v="${v}">${nome}</button>`).join('');
  const totalPets = [...grupos.values()].reduce((t, l) => t + l.length, 0);
  const abrirTodos = !!busca; // com busca, mostra os grupos já abertos

  return `<div class="bar"><h2>Cadastros</h2><span class="r">
      <label><input type="checkbox" data-change="ocultos" ${X.mostrarOcultos ? 'checked' : ''}> Mostrar ocultos</label>
      <button class="p" data-click="novoTutorForm">+ Novo cadastro</button></span></div>
    <div class="filtro"><input type="search" placeholder="Buscar pet, tutor ou telefone" value="${esc(X.cadBusca)}" data-change="cadBusca">
      <div class="seg">${filtros}</div></div>
    <p class="mu">${tutores.length} tutor(es) · ${totalPets} pet(s)</p>`
    + (tutores.length ? tutores.map((t) => grupoTutor(t, grupos.get(Number(t.id)), abrirTodos)).join('') : '<p class="mu">Nenhum cadastro encontrado.</p>');
}

// Grupo recolhível: fechado mostra só o tutor e os nomes dos pets
function grupoTutor(t, pets, abrir) {
  const aberto = abrir || X.cadAbertos.has(Number(t.id));
  const pendente = pets.some((c) => c.pag !== 'Pago' && !c.oc);
  return `<details class="tutor-grupo" data-tid="${t.id}" ${aberto ? 'open' : ''}>
    <summary class="tutor-cab">
      <div><b>${esc(t.nome)}</b> ${pendente ? '<span class="pont" title="Tem pagamento pendente"></span>' : ''}<br>
        <small>${esc(t.tel)} · 🐾 ${pets.map((c) => esc(c.pet)).join(', ')}</small></div>
      <div class="r"><button data-click="editarTutorForm" data-id="${t.id}">Editar</button>
        <button data-click="outroPetForm" data-id="${t.id}">+ Pet</button><span class="seta">▾</span></div>
    </summary>
    <div class="tutor-pets">
      ${t.email || t.endereco ? `<p class="mu tutor-extra">${t.email ? esc(t.email) : ''}${t.email && t.endereco ? ' · ' : ''}${t.endereco ? esc(t.endereco) : ''}</p>` : ''}
      ${pets.map(cartaoPet).join('')}</div>
  </details>`;
}

function cartaoPet(c) {
  return `<div class="card pet ${c.oc ? 'oc' : ''}">
    <div><b>${esc(c.pet)}</b>${c.raca ? ' · ' + esc(c.raca) : ''}${c.obs ? '<br><small>Obs: ' + esc(c.obs) + '</small>' : ''}</div>
    <div class="r">
      <span class="tag">${esc(c.pac)}</span>${seloPet(c)}
      ${c.pac !== 'Avulso' && c.diaSem && c.horaFixa ? `<span class="tag">📅 ${DIAS_SEMANA[c.diaSem].slice(0, 3)} ${c.horaFixa}</span>` : ''}
      <span class="tag">${c.taxi ? 'Com' : 'Sem'} Taxi Dog</span>
      <span class="tag ${c.pag === 'Pago' ? 'ok' : 'wa'}">${esc(c.pag)}</span>
      <b>${moeda(c.valor)}</b>
      <button data-click="petForm" data-id="${c.id}">Editar</button>
      <button data-click="ocultar" data-id="${c.id}">${c.oc ? 'Reexibir' : 'Ocultar'}</button>
    </div></div>`;
}

// --- Bloco de um pet dentro do formulário (reaproveitado nas listas repetíveis) ---
// permiteRemover fica false só na edição de um pet único, que não tem o que remover.
function blocoPet(v = {}, permiteRemover = true) {
  const { pet = '', raca = '', obs = '', pac = 'Avulso', valor = '', pag = 'Pendente', taxi = false, diaSem = null, horaFixa = '', servFixo = 'Banho' } = v;
  const dias = `<option value="">—</option>` + Object.entries(DIAS_SEMANA).map(([n, nome]) => `<option value="${n}" ${Number(n) === diaSem ? 'selected' : ''}>${nome}</option>`).join('');
  const horas = `<option value="">—</option>` + HORARIOS.map((t) => `<option ${t === horaFixa ? 'selected' : ''}>${t}</option>`).join('');
  return `<div class="pet-bloco g">
    <label>Nome do Pet<input data-f="pet" value="${esc(pet)}"></label>
    <label>Raça<input data-f="raca" value="${esc(raca)}"></label>
    <label>Pacote<select data-f="pac">${opcoes(Object.keys(PACOTES), pac)}</select></label>
    <label>Valor (R$)<input data-f="valor" type="number" step="0.01" min="0" value="${valor || ''}"></label>
    <label>Status do pagamento<select data-f="pag">${opcoes(['Pendente', 'Pago'], pag)}</select></label>
    <label>Taxi Dog<select data-f="taxi"><option value="0">Sem Taxi Dog</option><option value="1" ${taxi ? 'selected' : ''}>Com Taxi Dog</option></select></label>
    <p class="w mu" style="margin:4px 0 -4px">Agendamento fixo (pacotes) — usado para gerar os agendamentos do mês</p>
    <label>Dia fixo<select data-f="dia_sem">${dias}</select></label>
    <label>Horário fixo<select data-f="hora_fixa">${horas}</select></label>
    <label>Serviço do pacote<select data-f="serv_fixo">${opcoes(Object.keys(DURACAO), servFixo)}</select></label>
    <label class="w">Observação<textarea data-f="obs">${esc(obs)}</textarea></label>
    ${permiteRemover ? '<button type="button" class="w" data-click="removerPetBloco">Remover este pet</button>' : ''}
  </div>`;
}

function lerBlocoPet(bloco) {
  const v = (campo) => bloco.querySelector(`[data-f="${campo}"]`).value.trim();
  return {
    pet: v('pet'), raca: v('raca'), obs: v('obs'), pac: v('pac'),
    valor: Math.max(0, Number(v('valor')) || 0), pag: v('pag'), taxi: v('taxi') === '1',
    dia_sem: v('dia_sem') ? Number(v('dia_sem')) : null, hora_fixa: v('hora_fixa') || null, serv_fixo: v('serv_fixo'),
  };
}

// --- Novo tutor (+ um ou mais pets de uma vez) ---
function formNovoTutor() {
  modal(`<h3>Novo cadastro</h3>
      <div class="g">
        <label>Nome do Tutor<input id="t_nome"></label>
        <label>Telefone (com DDD)<input id="t_tel"></label>
        <label>E-mail<input id="t_email"></label>
        <label>Endereço<input id="t_end"></label>
      </div>
      <h3>Pets</h3>
      <div id="pets-blocos">${blocoPet()}</div>
      <button type="button" data-click="adicionarPetBloco">+ Adicionar outro pet</button>
      <p class="er" id="f_err"></p>`,
  [['Salvar', salvarNovoTutor, 'p'], ['Cancelar']]);
}

async function salvarNovoTutor() {
  const erro = (t) => { $('#f_err').textContent = t; return false; };
  const nome = $('#t_nome').value.trim(), tel = $('#t_tel').value.trim();
  if (!nome) return erro('Informe o nome do tutor.');
  if (tel.replace(/\D/g, '').length < 10) return erro('Informe o telefone com DDD.');

  const blocos = [...document.querySelectorAll('#pets-blocos .pet-bloco')].map(lerBlocoPet);
  if (!blocos.length) return erro('Adicione ao menos um pet.');
  const semNome = blocos.findIndex((p) => !p.pet);
  if (semNome !== -1) return erro(`Informe o nome do pet ${semNome + 1}.`);

  const dadosTutor = { nome, tel, email: $('#t_email').value.trim(), endereco: $('#t_end').value.trim() };
  const tutorId = (await q(sb.from('tutores').insert(dadosTutor).select('id').single())).id;
  await q(sb.from('pets').insert(blocos.map((p) => ({ ...p, tutor_id: tutorId }))));
  await atualizar();
}

// --- Outro pet para um tutor já cadastrado ---
function formOutroPet(tutorId) {
  const t = tutor(tutorId);
  modal(`<h3>Outro pet de ${esc(t.nome)}</h3>
      <p class="info">${esc(t.tel)}${t.email ? ' · ' + esc(t.email) : ''}${t.endereco ? '<br>' + esc(t.endereco) : ''}</p>
      <div id="pets-blocos">${blocoPet()}</div>
      <button type="button" data-click="adicionarPetBloco">+ Adicionar outro pet</button>
      <p class="er" id="f_err"></p>`,
  [['Salvar', () => salvarOutroPet(tutorId), 'p'], ['Cancelar']]);
}

async function salvarOutroPet(tutorId) {
  const erro = (t) => { $('#f_err').textContent = t; return false; };
  const blocos = [...document.querySelectorAll('#pets-blocos .pet-bloco')].map(lerBlocoPet);
  if (!blocos.length) return erro('Adicione ao menos um pet.');
  const semNome = blocos.findIndex((p) => !p.pet);
  if (semNome !== -1) return erro(`Informe o nome do pet ${semNome + 1}.`);

  await q(sb.from('pets').insert(blocos.map((p) => ({ ...p, tutor_id: tutorId }))));
  await atualizar();
}

// --- Editar os dados do tutor (vale para todos os pets dele) ---
function formEditarTutor(id) {
  const t = tutor(id);
  modal(`<h3>Editar tutor</h3><div class="g">
      <label>Nome do Tutor<input id="t_nome" value="${esc(t.nome)}"></label>
      <label>Telefone (com DDD)<input id="t_tel" value="${esc(t.tel)}"></label>
      <label>E-mail<input id="t_email" value="${esc(t.email)}"></label>
      <label>Endereço<input id="t_end" value="${esc(t.endereco)}"></label>
    </div><p class="er" id="f_err"></p>`,
  [['Salvar', () => salvarTutor(id), 'p'], ['Cancelar']]);
}

async function salvarTutor(id) {
  const erro = (t) => { $('#f_err').textContent = t; return false; };
  const nome = $('#t_nome').value.trim(), tel = $('#t_tel').value.trim();
  if (!nome) return erro('Informe o nome do tutor.');
  if (tel.replace(/\D/g, '').length < 10) return erro('Informe o telefone com DDD.');
  await q(sb.from('tutores').update({ nome, tel, email: $('#t_email').value.trim(), endereco: $('#t_end').value.trim() }).eq('id', id));
  await atualizar();
}

// --- Editar um pet já cadastrado ---
function formPet(id) {
  const c = cliente(id);
  modal(`<h3>Editar pet</h3><p class="info">Tutor: <b>${esc(c.tutor)}</b> · ${esc(c.tel)}</p>
      <div id="pets-blocos">${blocoPet(c, false)}</div><p class="er" id="f_err"></p>`,
  [['Salvar', () => salvarPet(id), 'p'], ['Cancelar']]);
}

async function salvarPet(id) {
  const erro = (t) => { $('#f_err').textContent = t; return false; };
  const bloco = document.querySelector('#pets-blocos .pet-bloco');
  const dados = lerBlocoPet(bloco);
  if (!dados.pet) return erro('Informe o nome do pet.');

  const atual = cliente(id);
  await q(sb.from('pets').update(dados).eq('id', id));
  if (dados.pag === 'Pago' && atual.pag !== 'Pago') { await atualizar(); modalPagamento(id); return; }
  await atualizar();
}

async function ocultar(id) {
  const c = cliente(id);
  await q(sb.from('pets').update({ oculto: !c.oc }).eq('id', id));
  await atualizar();
}

acoes({
  ocultos: (d, el) => { X.mostrarOcultos = el.checked; render(); },
  cadBusca: (d, el) => { X.cadBusca = el.value; render(); },
  cadFiltro: (d) => { X.cadFiltro = d.v; render(); },
  novoTutorForm: formNovoTutor,
  outroPetForm: (d) => formOutroPet(Number(d.id)),
  editarTutorForm: (d) => formEditarTutor(Number(d.id)),
  petForm: (d) => formPet(Number(d.id)),
  ocultar: (d) => ocultar(Number(d.id)),
  adicionarPetBloco: () => { $('#pets-blocos').insertAdjacentHTML('beforeend', blocoPet()); },
  removerPetBloco: (d, el) => {
    const blocos = document.querySelectorAll('#pets-blocos .pet-bloco');
    if (blocos.length > 1) el.closest('.pet-bloco').remove();
  },
});
