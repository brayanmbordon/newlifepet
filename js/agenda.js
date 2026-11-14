// Guia Agendamento: horários, status do banho, Taxi Dog e WhatsApp.
import { sb } from './supabase.js';
import { $, esc, br, hoje, moeda, hhmm, minutos, iso, linkWhatsApp, DURACAO, PACOTES, HORARIOS, periodo, noPeriodo, deslocar, diaSemana, rotuloPeriodo, filtroPeriodo, fechado, DIAS_SEMANA } from './utils.js';
import { S, X, q, cliente, ativo, atualizar } from './state.js';
import { modal, acoes, render, menu } from './ui.js';
import { modalPagamento } from './financeiro.js';
import { selo, numeroBanho, banhosDoCiclo, totalDoPacote, cicloConcluido, renovarPets } from './pacote.js';

// --- Regras de horário e pacote ---------------------------------------------
// Horários livres no dia, considerando a duração do serviço (Banho e Tosa ocupa 2 blocos).
// "extras": horários já reservados que ainda não estão no banco (usado ao gerar o mês)
function horariosLivres(data, servico, extras = []) {
  if (fechado(data)) return [];
  const ocupados = new Set(extras);
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

// --- Tela -------------------------------------------------------------------
const porHorario = (a, b) => a.t.localeCompare(b.t);

export function telaAgenda() {
  const semana = X.agModo === 's';
  const topo = `<div class="bar"><h2>Agendamentos</h2><span class="r">
      <button data-click="agendaHoje">Hoje</button>
      ${menu([
        '<button data-click="agGerarMes">⚡ Completar pacotes</button>',
        '<button data-click="agLembretes">💬 Lembretes de amanhã</button>',
        '<button data-click="agRota">🚗 Rota do Taxi Dog</button>',
      ], '⚡ Ações')}
      <button class="p" data-click="agendaForm">+ Novo</button></span></div>
    ${filtroPeriodo('agenda', X.agModo, X.dia, ['d', 's'])}
    <p class="mu">${!semana && X.dia === hoje() ? 'Hoje · ' : ''}${rotuloPeriodo(X.agModo, X.dia)}</p>`;

  if (!semana) {
    const lista = S.agendamentos.filter((a) => a.d === X.dia && a.st !== 'Concluído').sort(porHorario);
    return topo + resumoDia(lista) + (lista.length ? lista.map(cartao).join('') : '<p class="mu">Sem agendamentos nesta data.</p>');
  }

  // Semana: grade com horários nas linhas e dias (segunda a sábado) nas colunas.
  // Ocupado mostra o pet (inclusive concluídos); livre abre o "Novo agendamento" já preenchido.
  const [inicio] = periodo('s', X.dia);
  const dias = Array.from({ length: 6 }, (_, i) => { const x = new Date(inicio + 'T12:00'); x.setDate(x.getDate() + i); return iso(x); });
  const agora = new Date().getHours() * 60 + new Date().getMinutes();
  const ocupacao = {}; // "dia|hora" -> agendamentos
  S.agendamentos.filter((a) => dias.includes(a.d) && ativo(a)).forEach((a) => {
    const i0 = HORARIOS.indexOf(a.t);
    for (let k = 0; k < DURACAO[a.s]; k++) {
      const chave = `${a.d}|${HORARIOS[i0 + k]}`;
      (ocupacao[chave] = ocupacao[chave] || []).push({ a, inicio: k === 0 });
    }
  });

  const cab = dias.map((d) => {
    const livres = d < hoje() ? 0 : horariosLivres(d, 'Banho').length;
    return `<th class="${d === hoje() ? 'hj' : ''}"><button class="gr-dia" title="Ver o dia" data-click="agendaVerDia" data-v="${d}">
      <b>${diaSemana(d)}</b> ${br(d).slice(0, 5)}<small>${d < hoje() ? '&nbsp;' : livres + ' livre(s)'}</small></button></th>`;
  }).join('');

  const linhas = HORARIOS.map((t) => `<tr><th class="gr-hora">${t}</th>${dias.map((d) => {
    const itens = ocupacao[`${d}|${t}`];
    const classeHoje = d === hoje() ? ' hj' : '';
    if (itens) {
      return `<td class="gr-oc${classeHoje}">${itens.map(({ a, inicio: ini }) => {
        const c = cliente(a.cid);
        const classe = a.st === 'Concluído' ? 'ok' : a.st === 'Andamento' ? 'and' : a.cf === 'c' ? 'conf' : '';
        return `<button class="gr-pet ${classe}" title="${esc(c?.pet || '')} (${esc(c?.tutor || '')}) · ${esc(a.s)} · ${esc(a.st)}" data-click="agendaVerDia" data-v="${d}">
          ${ini ? '' : '↳ '}${esc(c?.pet || '—')}${(() => { const nb = numeroBanho(a); return nb && ini ? ` <small>${nb.n}/${nb.total}</small>` : ''; })()}</button>`;
      }).join('')}</td>`;
    }
    const passou = d < hoje() || (d === hoje() && minutos(t) < agora);
    return passou
      ? `<td class="gr-passou${classeHoje}"></td>`
      : `<td class="${classeHoje.trim()}"><button class="gr-livre" title="Agendar ${diaSemana(d)} ${br(d)} às ${t}" data-click="agendaForm" data-v="${d}" data-t="${t}">livre</button></td>`;
  }).join('')}</tr>`).join('');

  return topo + `<div class="tw gr"><table><tr><th class="gr-hora"></th>${cab}</tr>${linhas}</table></div>
    <p class="mu legenda"><span class="gr-pet">Agendado</span><span class="gr-pet conf">Confirmado</span><span class="gr-pet and">Andamento</span><span class="gr-pet ok">Concluído</span>
      · Toque em <b>livre</b> para agendar ou no pet/dia para ver os detalhes.</p>`;
}

// Resumo do dia: quantos faltam, confirmados, sem resposta, Taxi Dog
function resumoDia(lista) {
  if (!lista.length) return '';
  const feitos = S.agendamentos.filter((a) => a.d === X.dia && a.st === 'Concluído').length;
  const conf = lista.filter((a) => a.cf === 'c').length;
  const reag = lista.filter((a) => a.cf === 'r').length;
  const taxi = lista.filter((a) => a.x).length;
  const item = (n, txt, cls = '') => `<span class="tag ${cls}"><b>${n}</b> ${txt}</span>`;
  return `<div class="resumo">${item(lista.length, 'a fazer')}${item(conf, 'confirmados', 'ok')}${item(lista.length - conf - reag, 'sem resposta', 'wa')}`
    + `${reag ? item(reag, 'pediram reagendar', 'wa') : ''}${taxi ? item(taxi, 'Taxi Dog') : ''}${feitos ? item(feitos, 'concluídos', 'ok') : ''}</div>`;
}

const textoLembrete = (a, c) => `Olá ${c.tutor}! Aqui é a New Life Pet. O ${a.s.toLowerCase()} do(a) ${c.pet} está agendado para ${br(a.d)} às ${a.t}. Responda *1* para confirmar ou *2* para reagendar.`;

// Status avança com um toque: Agendado → Andamento → Concluído
const PROXIMO = { Agendado: 'Andamento', Andamento: 'Concluído' };
const PROXIMO_TAXI = { Buscar: 'Andamento', Andamento: 'Entregar', Entregar: 'Buscar' };

function cartao(a) {
  const c = cliente(a.cid);
  const resposta = a.cf
    ? `<span class="tag ${a.cf === 'c' ? 'ok' : 'wa'}">${a.cf === 'c' ? '✓ Confirmou' : '↻ Pediu reagendar'}</span>` : '';
  const classeSt = a.st === 'Andamento' ? 'and' : a.st === 'Concluído' ? 'ok' : '';
  const status = `<button class="st ${classeSt}" ${a.st === 'Concluído' ? 'disabled' : ''}
      title="${PROXIMO[a.st] ? 'Tocar para mudar para ' + PROXIMO[a.st] : ''}" data-click="agAvancar" data-id="${a.id}">
      ${a.st}${PROXIMO[a.st] ? ' <span>›</span>' : ''}</button>`;
  const taxi = a.x
    ? `<button class="st taxi" title="Taxi Dog: tocar para avançar" data-click="agTaxiAvancar" data-id="${a.id}">🚗 ${esc(a.ts)}</button>` : '';
  return `<div class="card ag ${a.st === 'Concluído' ? 'fe' : ''}">
    <div class="ag-info"><b class="ag-hora">${a.t}</b>
      <div><b>${esc(c.pet)}</b> ${selo(a)} <small>${esc(c.tutor)}</small><br>
        <small>${esc(a.s)} · ${esc(c.pac)}</small> ${resposta}</div></div>
    <div class="r">
      ${status}${taxi}
      <a class="btn verde ic" title="Enviar lembrete no WhatsApp" target="_blank" rel="noopener" href="${linkWhatsApp(c.tel, textoLembrete(a, c))}">💬<span> WhatsApp</span></a>
      ${menu([
        a.cf !== 'c' ? `<button data-click="agSimular" data-id="${a.id}" data-v="c">✓ Cliente confirmou</button>` : '',
        a.cf !== 'r' ? `<button data-click="agSimular" data-id="${a.id}" data-v="r">↻ Cliente pediu reagendar</button>` : '',
        a.cf ? `<button data-click="agSimular" data-id="${a.id}" data-v="">✕ Limpar resposta</button>` : '',
        a.st !== 'Agendado' ? `<button data-click="agVoltar" data-id="${a.id}">↺ Voltar para Agendado</button>` : '',
        `<button class="perigo" data-click="agExcluir" data-id="${a.id}">🗑 Excluir</button>`,
      ])}
    </div></div>`;
}

// --- Novo agendamento -------------------------------------------------------
// data/hora opcionais: vêm da grade da semana ao tocar num horário livre
function formAgendamento(data = X.dia, hora = '') {
  // Lista de pets em ordem alfabética (no mesmo nome, pelo tutor)
  const nome = (x) => x || '';
  const clientes = S.clientes.filter((c) => !c.oc)
    .sort((a, b) => nome(a.pet).localeCompare(nome(b.pet), 'pt-BR', { sensitivity: 'base' })
      || nome(a.tutor).localeCompare(nome(b.tutor), 'pt-BR', { sensitivity: 'base' }));
  if (!clientes.length) return modal('<p>Cadastre um pet primeiro.</p>', [['OK']]);
  modal(`<h3>Novo agendamento</h3><div class="g">
      <label class="w">Pet<select id="a_c" data-change="agCliente">${clientes.map((c) => `<option value="${c.id}">${esc(c.pet)} — ${esc(c.tutor)}</option>`).join('')}</select></label>
      <div id="a_i" class="w info"></div>
      <label>Serviço<select id="a_s" data-change="agHorarios">${Object.keys(DURACAO).map((x) => `<option>${x}</option>`).join('')}</select></label>
      <label>Data<input type="date" id="a_d" value="${data}" data-change="agHorarios"></label>
      <label>Horário<select id="a_t"></select></label>
      <label>Taxi Dog<select id="a_x"><option value="0">Sem Taxi Dog</option><option value="1">Com Taxi Dog</option></select></label>
    </div><p class="er" id="a_err"></p>`,
  [['Agendar', salvarAgendamento, 'p'], ['Cancelar']]);
  aoTrocarCliente();
  if (hora && [...$('#a_t').options].some((o) => o.value === hora)) $('#a_t').value = hora;
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
    + (c.pac === 'Avulso' ? 'Banho <b>avulso</b> (pago após o banho)'
      : `Ciclo atual (início ${br(c.criado)}): <b>${banhosDoCiclo(c).length} de ${totalDoPacote(c)}</b> banho(s) já agendado(s)`);
}

async function salvarAgendamento() {
  const c = cliente($('#a_c').value);
  const data = $('#a_d').value, hora = $('#a_t').value, servico = $('#a_s').value, taxi = $('#a_x').value === '1';
  if (!hora || !data) { $('#a_err').textContent = 'Escolha uma data e um horário livre.'; return false; }

  const gravar = async () => {
    await q(sb.from('agendamentos').insert({
      cid: c.id, d: data, t: hora, s: servico, x: taxi, st: 'Agendado', ts: 'Buscar', ciclo: c.pac === 'Avulso' ? null : c.criado,
    }));
    X.dia = data;
    await atualizar();
    if (c.pac !== 'Avulso' && banhosDoCiclo(c).length === totalDoPacote(c)) {
      modal(`<h3>🐾 Último agendamento</h3><p>Este é o <b>último banho</b> do ciclo do pacote ${esc(c.pac)} de ${esc(c.tutor)} (${esc(c.pet)}). Avise o cliente sobre a renovação.</p>`, [['OK', null, 'p']]);
    }
  };

  // Pacote com o ciclo já todo agendado: este seria um banho a mais
  const usados = c.pac === 'Avulso' ? 0 : banhosDoCiclo(c).length;
  if (c.pac !== 'Avulso' && usados >= totalDoPacote(c)) {
    modal(`<h3>⚠️ Ciclo completo</h3><p>${esc(c.pet)} já tem os <b>${totalDoPacote(c)}</b> banho(s) do ciclo agendados. Este seria o <b>${usados + 1}º</b>.</p>
      <p class="mu">Se o pacote foi renovado, renove no Financeiro antes, para começar um ciclo novo.</p>`,
    [['Agendar mesmo assim', gravar, 'p'], ['Voltar']]);
  } else {
    await gravar();
  }
}

// --- Completar pacotes (dia e horário fixos) -----------------------------------
// Para cada pacote, agenda os banhos que faltam no ciclo atual, a partir do último banho,
// de 7 em 7 dias (Semanal), 14 em 14 (Quinzenal). Ciclo já completo é pulado, então
// rodar de novo não duplica nada. "ids" limita a alguns pets (usado ao renovar).
const PASSO = { Semanal: 7, Quinzenal: 14, Mensal: 28 };
function proximoDiaDaSemana(base, dia) {
  const x = new Date(base + 'T12:00');
  while (x.getDay() !== dia) x.setDate(x.getDate() + 1);
  return iso(x);
}

function planejarPacotes(ids) {
  const plano = [], pulados = [], semFixo = [];
  const reservados = {}; // data -> índices de horário já reservados neste plano

  const pets = S.clientes.filter((c) => !c.oc && c.pac !== 'Avulso' && (!ids || ids.includes(c.id)))
    .sort((a, b) => a.pet.localeCompare(b.pet, 'pt-BR', { sensitivity: 'base' }));

  for (const c of pets) {
    if (!c.diaSem || !c.horaFixa) { semFixo.push(c); continue; }
    if (cicloConcluido(c)) { pulados.push({ c, motivo: 'ciclo concluído — renove o pacote' }); continue; }
    const banhos = banhosDoCiclo(c);
    let faltam = totalDoPacote(c) - banhos.length;
    if (faltam <= 0) continue;

    const ultimo = banhos.length ? banhos[banhos.length - 1].d : null;
    let base = ultimo ? deslocar('d', ultimo, PASSO[c.pac] - 3) : c.criado;
    if (base < hoje()) base = hoje();
    let data = proximoDiaDaSemana(base, c.diaSem);

    for (let tentativa = 0; faltam > 0 && tentativa < 10; tentativa++) {
      const extras = reservados[data] || [];
      const livres = horariosLivres(data, c.servFixo, extras);
      if (!livres.length) { pulados.push({ c, data, motivo: 'dia lotado, tentei a semana seguinte' }); data = deslocar('d', data, 7); continue; }
      // Horário fixo, ou o livre mais próximo dele
      const alvo = minutos(c.horaFixa);
      const hora = livres.includes(c.horaFixa) ? c.horaFixa
        : [...livres].sort((x, y) => Math.abs(minutos(x) - alvo) - Math.abs(minutos(y) - alvo) || minutos(x) - minutos(y))[0];
      const i0 = HORARIOS.indexOf(hora);
      for (let k = 0; k < DURACAO[c.servFixo]; k++) extras.push(i0 + k);
      reservados[data] = extras;
      plano.push({ c, data, hora, ajustado: hora !== c.horaFixa, n: totalDoPacote(c) - faltam + 1 });
      faltam--;
      data = deslocar('d', data, PASSO[c.pac]);
    }
  }
  plano.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  return { plano, pulados, semFixo };
}

export function completarPacotes(ids) {
  const { plano, pulados, semFixo } = planejarPacotes(ids);
  const linhas = plano.map((p) => `<tr><td>${diaSemana(p.data)} ${br(p.data).slice(0, 5)}</td><td>${p.hora}${p.ajustado ? ` <span class="tag wa" title="Horário fixo ocupado">era ${p.c.horaFixa}</span>` : ''}</td><td>${esc(p.c.pet)} <span class="nb">${p.n}/${totalDoPacote(p.c)}</span></td><td>${esc(p.c.servFixo)}</td></tr>`).join('');
  const html = `<h3>⚡ Completar pacotes</h3>
    ${plano.length
      ? `<p>Serão criados <b>${plano.length}</b> agendamento(s) como <b>Agendado</b>, completando o ciclo de cada pacote.</p>
         <div class="tw"><table><tr><th>Data</th><th>Hora</th><th>Pet</th><th>Serviço</th></tr>${linhas}</table></div>`
      : '<p>Nada a criar: os ciclos dos pacotes com dia fixo já estão todos agendados.</p>'}
    ${pulados.length ? `<p class="mu"><b>Atenção:</b><br>${pulados.map((p) => `${esc(p.c.pet)}${p.data ? ' · ' + br(p.data) : ''} — ${p.motivo}`).join('<br>')}</p>` : ''}
    ${semFixo.length ? `<p class="mu"><b>Sem dia/horário fixo no cadastro:</b> ${semFixo.map((c) => esc(c.pet)).join(', ')}</p>` : ''}`;
  modal(html, plano.length ? [['Criar agendamentos', async () => {
    await q(sb.from('agendamentos').insert(plano.map((p) => ({
      cid: p.c.id, d: p.data, t: p.hora, s: p.c.servFixo, x: !!p.c.taxi, st: 'Agendado', ts: 'Buscar', ciclo: p.c.criado,
    }))));
    await atualizar();
  }, 'p'], ['Cancelar']] : [['OK', null, 'p']]);
}

// Último banho do ciclo concluído: oferece renovar (novo ciclo começa hoje)
export function modalRenovar(id) {
  const c = cliente(id);
  modal(`<h3>🎉 Ciclo concluído</h3><p><b>${esc(c.pet)}</b> fez os ${totalDoPacote(c)} banho(s) do pacote ${esc(c.pac)}.</p>
    <p>Renovar o pacote? O novo ciclo começa hoje e o pagamento fica <b>Pendente</b>.</p>`,
  [['Renovar e agendar', async () => { await renovarPets([c.id]); completarPacotes([c.id]); }, 'p'],
    ['Só renovar', () => renovarPets([c.id])], ['Depois']]);
}

// --- Lembretes de amanhã ----------------------------------------------------
// Próximo dia de atendimento (pula o domingo) com a mensagem pronta para cada pet
function lembretes() {
  let dia = deslocar('d', hoje(), 1);
  if (fechado(dia)) dia = deslocar('d', dia, 1);
  const lista = S.agendamentos.filter((a) => a.d === dia && ativo(a) && a.st !== 'Concluído').sort(porHorario);
  const linhas = lista.map((a) => {
    const c = cliente(a.cid);
    return `<div class="lin"><div><b>${a.t}</b> ${esc(c.pet)} <small>${esc(c.tutor)}</small>
        ${a.cf === 'c' ? '<span class="tag ok">confirmou</span>' : ''}</div>
      <a class="btn verde" target="_blank" rel="noopener" data-click="marcarEnviado" href="${linkWhatsApp(c.tel, textoLembrete(a, c))}">💬 Enviar</a></div>`;
  }).join('');
  modal(`<h3>💬 Lembretes · ${diaSemana(dia)}, ${br(dia)}</h3>
    ${lista.length ? `<p class="mu">Toque em <b>Enviar</b> em cada um. Os já enviados ficam marcados.</p><div class="lista">${linhas}</div>`
      : '<p>Nenhum agendamento para este dia.</p>'}`, [['Fechar', null, 'p']]);
}

// --- Rota do Taxi Dog ---------------------------------------------------------
function rotaTaxi() {
  const lista = S.agendamentos.filter((a) => a.d === X.dia && a.x && ativo(a)).sort(porHorario);
  const enderecos = lista.map((a) => cliente(a.cid).end).filter(Boolean);
  const mapa = (e) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}`;
  let rota = '';
  if (enderecos.length) {
    const destino = enderecos[enderecos.length - 1];
    const paradas = enderecos.slice(0, -1).join('|');
    rota = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destino)}${paradas ? '&waypoints=' + encodeURIComponent(paradas) : ''}`;
  }
  const linhas = lista.map((a) => {
    const c = cliente(a.cid);
    return `<div class="lin"><div><b>${a.t}</b> ${esc(c.pet)} <small>${esc(c.tutor)} · ${esc(c.tel)}</small><br>
        <small>${c.end ? esc(c.end) : '<span class="er">sem endereço no cadastro</span>'}</small></div>
      ${c.end ? `<a class="btn" target="_blank" rel="noopener" href="${mapa(c.end)}">📍 Mapa</a>` : ''}</div>`;
  }).join('');
  modal(`<h3>🚗 Taxi Dog · ${diaSemana(X.dia)}, ${br(X.dia)}</h3>
    ${lista.length ? `<div class="lista">${linhas}</div>
      ${rota ? `<p><a class="btn verde" target="_blank" rel="noopener" href="${rota}">🗺️ Abrir rota completa no Google Maps</a></p>
      <p class="mu">A rota sai da sua localização atual e segue a ordem dos horários.</p>` : ''}`
      : '<p>Nenhum Taxi Dog neste dia.</p>'}`, [['Fechar', null, 'p']]);
}

// --- Ações dos cartões ------------------------------------------------------
async function mudarStatus(id, status) {
  const a = S.agendamentos.find((x) => x.id == id);
  const c = cliente(a.cid);
  await q(sb.from('agendamentos').update({ st: status }).eq('id', id));
  await atualizar();
  if (status !== 'Concluído') return;
  // Banho avulso concluído e ainda não pago: pede o pagamento (Cancelar devolve para "Andamento")
  if (c.pac === 'Avulso') { if (c.pag !== 'Pago') modalPagamento(c.id, id); return; }
  const nb = numeroBanho(S.agendamentos.find((x) => x.id == id));
  if (!nb) return;
  // Último banho do ciclo: cobra (se pendente) e depois oferece renovar
  if (nb.n >= nb.total) return c.pag !== 'Pago' ? modalPagamento(c.id, null, () => modalRenovar(c.id)) : modalRenovar(c.id);
  // O pagamento do ciclo costuma ser no 2º ou 3º banho: a partir do 2º, lembra se ainda estiver pendente
  if (c.pag !== 'Pago' && nb.n >= 2) modalPagamento(c.id);
}

async function mudarTaxi(id, etapa) {
  await q(sb.from('agendamentos').update({ ts: etapa }).eq('id', id));
  S.agendamentos.find((x) => x.id == id).ts = etapa;
}

async function simular(id, resposta) {
  await q(sb.from('agendamentos').update({ cf: resposta || null }).eq('id', id));
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
  agendaRef: (d, el) => { X.dia = el.value || hoje(); render(); },
  agendaModo: (d) => { X.agModo = d.v; render(); },
  agendaVerDia: (d) => { X.dia = d.v; X.agModo = 'd'; render(); },
  agendaNav: (d) => { X.dia = deslocar(X.agModo, X.dia, Number(d.v)); render(); },
  agendaHoje: () => { X.dia = hoje(); render(); },
  agGerarMes: () => completarPacotes(),
  agendaForm: (d) => formAgendamento(d.v || X.dia, d.t || ''),
  agCliente: aoTrocarCliente,
  agHorarios: atualizarHorarios,
  agAvancar: (d) => { const a = S.agendamentos.find((x) => x.id == d.id); if (PROXIMO[a.st]) return mudarStatus(d.id, PROXIMO[a.st]); },
  agVoltar: (d) => mudarStatus(d.id, 'Agendado'),
  agTaxiAvancar: async (d) => { const a = S.agendamentos.find((x) => x.id == d.id); await mudarTaxi(d.id, PROXIMO_TAXI[a.ts] || 'Buscar'); render(); },
  agLembretes: lembretes,
  agRota: rotaTaxi,
  marcarEnviado: (d, el) => el.closest('.lin')?.classList.add('enviado'),
  agSimular: (d) => simular(d.id, d.v),
  agExcluir: (d) => confirmarExclusao(d.id),
});
