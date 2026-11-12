// Guia Agendamento: horários, status do banho, Taxi Dog e WhatsApp.
import { sb } from './supabase.js';
import { $, esc, br, hoje, moeda, hhmm, minutos, iso, linkWhatsApp, DURACAO, PACOTES, HORARIOS } from './utils.js';
import { S, X, q, cliente, ativo, atualizar } from './state.js';
import { modal, acoes, render } from './ui.js';
import { modalPagamento } from './financeiro.js';

const mesmoMes = (a, b) => a.slice(0, 7) === b.slice(0, 7);

// --- Regras de horário e pacote ---------------------------------------------
// Horários livres no dia, considerando a duração do serviço (Banho e Tosa ocupa 2 blocos).
function horariosLivres(data, servico) {
  const ocupados = new Set();
  const agora = new Date().getHours() * 60 + new Date().getMinutes();
  S.agendamentos.filter((a) => a.d === data && ativo(a)).forEach((a) => {
    const inicio = HORARIOS.indexOf(a.t);
    for (let k = 0; k < DURACAO[a.s]; k++) ocupados.add(inicio + k);
  });
  return HORARIOS.filter((t, i) => {
    if (data === hoje() && minutos(t) < agora) return false;
    for (let k = 0; k < DURACAO[servico]; k++) if (i + k >= HORARIOS.length || ocupados.has(i + k)) return false;
    return true;
  });
}

// Banhos que ainda faltam no mês para o pacote do cliente
const pendentesNoMes = (c, data) => PACOTES[c.pac] - S.agendamentos.filter((a) => a.cid === c.id && ativo(a) && mesmoMes(a.d, data)).length;

// Agendamentos do cliente que já cobrem o período da data (semana, quinzena ou mês, conforme o pacote)
function agendamentosDoPeriodo(c, data) {
  if (c.pac === 'Avulso') return [];
  const segundaDaSemana = (d) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return iso(x); };
  const segundaQuinzena = (d) => Number(d.slice(8)) > 15;
  return S.agendamentos.filter((a) => a.cid === c.id && ativo(a) && (
    c.pac === 'Semanal'
      ? segundaDaSemana(a.d) === segundaDaSemana(data)
      : mesmoMes(a.d, data) && (c.pac === 'Mensal' || segundaQuinzena(a.d) === segundaQuinzena(data))
  ));
}

// --- Tela -------------------------------------------------------------------
export function telaAgenda() {
  const lista = S.agendamentos.filter((a) => a.d === X.dia && a.st !== 'Concluído').sort((a, b) => a.t.localeCompare(b.t));
  return `<div class="bar"><h2>Agendamentos</h2><span class="r">
      <input type="date" value="${X.dia}" data-change="agendaDia">
      <button data-click="agendaHoje">Hoje</button>
      <button class="p" data-click="agendaForm">+ Novo agendamento</button></span></div>
    <p class="mu">${X.dia === hoje() ? 'Hoje, ' : ''}${br(X.dia)}</p>`
    + (lista.length ? lista.map(cartao).join('') : '<p class="mu">Sem agendamentos nesta data.</p>');
}

const seletor = (itens, atual, acao, id) =>
  `<select data-change="${acao}" data-id="${id}">${itens.map((x) => `<option ${x === atual ? 'selected' : ''}>${x}</option>`).join('')}</select>`;

function cartao(a) {
  const c = cliente(a.cid);
  const texto = `Olá ${c.tutor}! Aqui é a New Life Pet. O ${a.s.toLowerCase()} do(a) ${c.pet} está agendado para ${br(a.d)} às ${a.t}. Responda *1* para confirmar ou *2* para reagendar.`;
  const resposta = a.cf
    ? `<br><span class="tag ${a.cf === 'c' ? 'ok' : 'wa'}">${a.cf === 'c' ? 'Cliente confirmou' : 'Cliente pediu reagendamento'}</span>` : '';
  return `<div class="card">
    <div><b>${a.t}–${hhmm(minutos(a.t) + 30 * DURACAO[a.s])}</b> ${esc(c.pet)} <small>(${esc(c.tutor)})</small><br>
      <small>${esc(a.s)} · ${esc(c.pac)}${a.x ? ' · Taxi Dog' : ''}</small>${resposta}</div>
    <div class="r">
      ${seletor(['Agendado', 'Andamento', 'Concluído'], a.st, 'agStatus', a.id)}
      ${a.x ? seletor(['Buscar', 'Andamento', 'Entregar'], a.ts, 'agTaxi', a.id) : ''}
      <a class="btn verde" target="_blank" rel="noopener" href="${linkWhatsApp(c.tel, texto)}">WhatsApp</a>
      <button title="Simula a resposta do cliente" data-click="agSimular" data-id="${a.id}" data-v="c">✓ Confirmou</button>
      <button title="Simula a resposta do cliente" data-click="agSimular" data-id="${a.id}" data-v="r">↻ Reagendar</button>
      <button data-click="agExcluir" data-id="${a.id}">Excluir</button>
    </div></div>`;
}

// --- Novo agendamento -------------------------------------------------------
function formAgendamento() {
  const clientes = S.clientes.filter((c) => !c.oc);
  if (!clientes.length) return modal('<p>Cadastre um pet primeiro.</p>', [['OK']]);
  modal(`<h3>Novo agendamento</h3><div class="g">
      <label class="w">Pet<select id="a_c" data-change="agCliente">${clientes.map((c) => `<option value="${c.id}">${esc(c.pet)} — ${esc(c.tutor)}</option>`).join('')}</select></label>
      <div id="a_i" class="w info"></div>
      <label>Serviço<select id="a_s" data-change="agHorarios">${Object.keys(DURACAO).map((x) => `<option>${x}</option>`).join('')}</select></label>
      <label>Data<input type="date" id="a_d" value="${X.dia}" data-change="agHorarios"></label>
      <label>Horário<select id="a_t"></select></label>
      <label>Taxi Dog<select id="a_x"><option value="0">Sem Taxi Dog</option><option value="1">Com Taxi Dog</option></select></label>
    </div><p class="er" id="a_err"></p>`,
  [['Agendar', salvarAgendamento, 'p'], ['Cancelar']]);
  aoTrocarCliente();
}

function aoTrocarCliente() {
  $('#a_x').value = cliente($('#a_c').value).taxi ? 1 : 0;
  atualizarHorarios();
}

function atualizarHorarios() {
  const c = cliente($('#a_c').value);
  const data = $('#a_d').value || hoje();
  const livres = horariosLivres(data, $('#a_s').value);
  $('#a_t').innerHTML = livres.length ? livres.map((t) => `<option>${t}</option>`).join('') : '<option value="">Sem horários livres</option>';
  $('#a_i').innerHTML = `<b>${esc(c.tutor)}</b> · ${esc(c.tel)}<br>${esc(c.raca)} · ${esc(c.end)}${c.obs ? '<br>Obs: ' + esc(c.obs) : ''}<br>`
    + `Pacote: <b>${esc(c.pac)}</b> · ${moeda(c.valor)} · ${c.taxi ? 'Com' : 'Sem'} Taxi Dog<br>`
    + `Banhos pendentes no mês: <b>${c.pac === 'Avulso' ? 'avulso (pago após o banho)' : Math.max(0, pendentesNoMes(c, data))}</b>`;
}

async function salvarAgendamento() {
  const c = cliente($('#a_c').value);
  const data = $('#a_d').value, hora = $('#a_t').value, servico = $('#a_s').value, taxi = $('#a_x').value === '1';
  if (!hora || !data) { $('#a_err').textContent = 'Escolha uma data e um horário livre.'; return false; }

  const gravar = async () => {
    await q(sb.from('agendamentos').insert({ cid: c.id, d: data, t: hora, s: servico, x: taxi, st: 'Agendado', ts: 'Buscar' }));
    X.dia = data;
    await atualizar();
    const usados = S.agendamentos.filter((a) => a.cid === c.id && ativo(a) && mesmoMes(a.d, data)).length;
    if (c.pac !== 'Avulso' && usados >= PACOTES[c.pac]) {
      modal(`<h3>🐾 Último agendamento</h3><p>Este é o <b>último agendamento</b> do pacote ${esc(c.pac)} de ${esc(c.tutor)} (${esc(c.pet)}). Avise o cliente sobre a renovação.</p>`, [['OK', null, 'p']]);
    }
  };

  // Pacote com banho já agendado no período: pede confirmação antes de seguir
  const jaAgendados = agendamentosDoPeriodo(c, data);
  if (jaAgendados.length) {
    modal(`<h3>⚠️ Atenção</h3><p>${esc(c.pet)} tem pacote ${esc(c.pac)} e já possui banho neste período:</p>
      <p><b>${jaAgendados.map((a) => `${br(a.d)} às ${a.t}`).join('<br>')}</b></p>`,
    [['Agendar mesmo assim', gravar, 'p'], ['Voltar']]);
  } else {
    await gravar();
  }
}

// --- Ações dos cartões ------------------------------------------------------
async function mudarStatus(id, status) {
  const a = S.agendamentos.find((x) => x.id == id);
  const c = cliente(a.cid);
  await q(sb.from('agendamentos').update({ st: status }).eq('id', id));
  await atualizar();
  // Banho avulso concluído e ainda não pago: pede o pagamento
  if (status === 'Concluído' && c.pac === 'Avulso' && c.pag !== 'Pago') modalPagamento(c.id, id);
}

async function mudarTaxi(id, etapa) {
  await q(sb.from('agendamentos').update({ ts: etapa }).eq('id', id));
  S.agendamentos.find((x) => x.id == id).ts = etapa;
}

async function simular(id, resposta) {
  await q(sb.from('agendamentos').update({ cf: resposta }).eq('id', id));
  await atualizar();
}

function confirmarExclusao(id) {
  const a = S.agendamentos.find((x) => x.id == id);
  const c = cliente(a.cid);
  modal(`<p>Excluir o agendamento de <b>${esc(c.pet)}</b> em ${br(a.d)} às ${a.t}?</p>`, [
    ['Excluir', async () => { await q(sb.from('agendamentos').delete().eq('id', id)); await atualizar(); }, 'p'],
    ['Cancelar'],
  ]);
}

acoes({
  agendaDia: (d, el) => { X.dia = el.value || hoje(); render(); },
  agendaHoje: () => { X.dia = hoje(); render(); },
  agendaForm: formAgendamento,
  agCliente: aoTrocarCliente,
  agHorarios: atualizarHorarios,
  agStatus: (d, el) => mudarStatus(d.id, el.value),
  agTaxi: (d, el) => mudarTaxi(d.id, el.value),
  agSimular: (d) => simular(d.id, d.v),
  agExcluir: (d) => confirmarExclusao(d.id),
});
