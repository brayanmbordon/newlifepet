// Guia Financeiro: carteira, pagamentos e gráfico mensal.
import { sb } from './supabase.js';
import { $, esc, br, hoje, moeda, linkWhatsApp, PACOTES, periodo, noPeriodo, deslocar, rotuloPeriodo, filtroPeriodo } from './utils.js';
import { S, X, q, cliente, atualizar } from './state.js';
import { modal, acoes, render, menu } from './ui.js';
import { completarPacotes } from './agenda.js';
import { seloPet, cicloConcluido, renovarPets } from './pacote.js';

const FORMAS = ['Dinheiro', 'Pix', 'Cartão Débito', 'Cartão Crédito'];

// Janela de confirmação de pagamento. Também é usada pelo Cadastro e pela Agenda.
// "idAgendamento" só vem da Agenda: se o pagamento for cancelado, o banho volta para "Andamento".
// "depois": função chamada após confirmar o pagamento (ex.: oferecer a renovação)
export function modalPagamento(idCliente, idAgendamento, depois) {
  const c = cliente(idCliente);
  modal(`<h3>Confirmar pagamento</h3><p>${esc(c.pet)} (${esc(c.tutor)}) · ${moeda(c.valor)}</p>
    <div class="g">
      <label>Forma de pagamento<select id="p_f">${FORMAS.map((f) => `<option>${f}</option>`).join('')}</select></label>
      <label>Data do pagamento<input type="date" id="p_d" value="${hoje()}"></label>
    </div>`,
  [
    ['Confirmar', async () => {
      const data = $('#p_d').value;
      if (!data) return false;
      // Função do banco: registra o pagamento e marca o cliente como Pago numa única operação.
      await q(sb.rpc('registrar_pagamento', { p_cliente: c.id, p_data: data, p_forma: $('#p_f').value }));
      await atualizar();
      if (depois) depois();
    }, 'p'],
    ['Cancelar', async () => {
      if (!idAgendamento) return;
      await q(sb.from('agendamentos').update({ st: 'Andamento' }).eq('id', idAgendamento));
      await atualizar();
    }],
  ]);
}

export function telaFinanceiro() {
  const lista = S.clientes.filter((c) => !c.oc);
  const mes = hoje().slice(0, 7);
  const soma = (itens) => itens.reduce((total, x) => total + x.valor, 0);
  const pagoNoMes = S.pagamentos.filter((p) => p.d.slice(0, 7) === mes).reduce((total, p) => total + p.v, 0);
  const pendentes = lista.filter((c) => c.pag !== 'Pago');

  const abas = [['p', `Pendentes (${pendentes.length})`], ['r', 'Recebimentos'], ['g', 'Gráfico']]
    .map(([id, nome]) => `<button class="${X.finAba === id ? 'on' : ''}" data-click="finAba" data-v="${id}">${nome}</button>`).join('');

  const corpo = X.finAba === 'r' ? recebimentos() : X.finAba === 'g' ? `<h3>Mês a mês · ${hoje().slice(0, 4)}</h3><div class="tw pad">${grafico()}</div>` : telaPendentes(lista);

  return `<div class="bar"><h2>Financeiro</h2><span class="r">
      <button data-click="finCobrar">💬 Cobrar pendentes</button>
      <button data-click="finVirarMes">🔄 Renovar ciclos</button></span></div>
    <div class="k">
      <div><small>Carteira total</small><b>${moeda(soma(lista))}</b></div>
      <div><small>Recebido no mês</small><b>${moeda(pagoNoMes)}</b></div>
      <div><small>Em aberto</small><b>${moeda(soma(pendentes))}</b><small>${pendentes.length} pet(s)</small></div>
    </div>
    <div class="seg sub">${abas}</div>
    ${corpo}`;
}

// Filtros da aba Pendentes: busca por nome e pacote
function filtrar(lista) {
  const busca = X.finBusca.toLowerCase();
  return lista
    .filter((c) => (!X.finPac || c.pac === X.finPac) && `${c.pet} ${c.tutor}`.toLowerCase().includes(busca))
    .sort((a, b) => a.tutor.localeCompare(b.tutor, 'pt-BR') || a.pet.localeCompare(b.pet, 'pt-BR'));
}

function telaPendentes(lista) {
  const filtrados = filtrar(lista);
  const pendentes = filtrados.filter((c) => c.pag !== 'Pago');
  const pagos = filtrados.filter((c) => c.pag === 'Pago');
  const pacotes = ['', ...Object.keys(PACOTES)].map((p) => `<option value="${p}" ${p === X.finPac ? 'selected' : ''}>${p || 'Todos os pacotes'}</option>`).join('');
  return `<div class="filtro">
      <input type="search" placeholder="Buscar pet ou tutor" value="${esc(X.finBusca)}" data-change="finBusca">
      <select data-change="finPac">${pacotes}</select></div>
    ${pendentes.length ? `<div class="lista-fin">${pendentes.map(linha).join('')}</div>` : '<p class="mu">Nenhum pagamento pendente. 🎉</p>'}
    ${pagos.length ? `<details class="dobra"><summary>✅ Em dia (${pagos.length}) · ${moeda(pagos.reduce((t, c) => t + c.valor, 0))}</summary>
      <div class="lista-fin">${pagos.map(linha).join('')}</div></details>` : ''}`;
}

const textoRenovacao = (c) => `Olá *${c.tutor}* tudo bem? Estamos passando para informar que o seu pacote de banho acabou. Na semana que vem iniciaremos um novo pacote. Responda *RENOVAR* ou *CANCELAR*.`;
const textoCobranca = (c) => `Olá *${c.tutor}*, tudo bem? Passando para lembrar do pagamento do ${c.pac === 'Avulso' ? 'banho' : 'pacote ' + c.pac} do(a) *${c.pet}*, no valor de ${moeda(c.valor)}. Qualquer dúvida estamos à disposição. New Life Pet 🐾`;

function linha(c) {
  const pago = c.pag === 'Pago';
  const situacao = pago
    ? `<span class="tag ok">Pago · ${esc(c.forma || '')}${c.dp ? ' · ' + br(c.dp).slice(0, 5) : ''}</span>`
    : '<span class="tag wa">Pendente</span>';
  const principal = pago
    ? `<a class="btn verde ic" title="Mensagem de renovação" target="_blank" rel="noopener" href="${linkWhatsApp(c.tel, textoRenovacao(c))}">💬<span> Renovação</span></a>`
    : `<button class="p" data-click="pagar" data-id="${c.id}">Registrar pagamento</button>`;
  return `<div class="card fin">
    <div><b>${esc(c.pet)}</b> <small>${esc(c.tutor)}</small><br><small>${esc(c.pac)}</small> ${seloPet(c)} ${situacao}</div>
    <div class="r"><b class="valor">${moeda(c.valor)}</b>${principal}
      ${menu([
        pago ? '' : `<a target="_blank" rel="noopener" href="${linkWhatsApp(c.tel, textoCobranca(c))}">💬 Cobrar no WhatsApp</a>`,
        pago ? '' : `<a target="_blank" rel="noopener" href="${linkWhatsApp(c.tel, textoRenovacao(c))}">💬 Mensagem de renovação</a>`,
        `<button data-click="renovar" data-id="${c.id}">🔄 Renovar pacote</button>`,
        `<button class="perigo" data-click="ocultar" data-id="${c.id}">✕ Cancelar (ocultar)</button>`,
      ])}</div></div>`;
}

// --- Cobrar pendentes: mensagem pronta para cada um ----------------------------
function cobrarPendentes() {
  const lista = S.clientes.filter((c) => !c.oc && c.pag !== 'Pago')
    .sort((a, b) => a.tutor.localeCompare(b.tutor, 'pt-BR'));
  const linhas = lista.map((c) => `<div class="lin"><div><b>${esc(c.pet)}</b> <small>${esc(c.tutor)} · ${esc(c.pac)}</small><br><b>${moeda(c.valor)}</b></div>
      <a class="btn verde" target="_blank" rel="noopener" data-click="marcarEnviado" href="${linkWhatsApp(c.tel, textoCobranca(c))}">💬 Enviar</a></div>`).join('');
  modal(`<h3>💬 Cobrar pendentes</h3>
    ${lista.length ? `<p class="mu">${lista.length} pendente(s) · ${moeda(lista.reduce((t, c) => t + c.valor, 0))}. Toque em <b>Enviar</b> em cada um.</p><div class="lista">${linhas}</div>`
      : '<p>Ninguém pendente. 🎉</p>'}`, [['Fechar', null, 'p']]);
}

// --- Renovar ciclos: renova os pacotes que já fizeram todos os banhos do ciclo ----
function virarMes() {
  const concluidos = S.clientes.filter((c) => !c.oc && cicloConcluido(c));
  const renovar = concluidos.filter((c) => c.pag === 'Pago');
  const atrasados = concluidos.filter((c) => c.pag !== 'Pago');
  const nomes = (l) => l.map((c) => esc(c.pet)).join(', ');
  modal(`<h3>🔄 Renovar ciclos</h3>
    ${renovar.length
      ? `<p><b>${renovar.length}</b> pacote(s) concluíram o ciclo e serão renovados. O novo ciclo começa hoje e fica <b>Pendente</b>:</p><p class="mu">${nomes(renovar)}</p>`
      : '<p>Nenhum pacote pago com o ciclo concluído para renovar.</p>'}
    ${atrasados.length ? `<p class="er">⚠️ Concluíram o ciclo sem pagar (registre o pagamento antes de renovar):</p><p class="mu">${nomes(atrasados)}</p>` : ''}
    <label class="keep"><input type="checkbox" id="vm_gerar" checked> Completar os agendamentos dos pacotes em seguida</label>`,
  [['Confirmar', async () => {
    const gerar = $('#vm_gerar').checked;
    await renovarPets(renovar.map((c) => c.id));
    if (gerar) { X.aba = 'a'; X.dia = hoje(); render(); completarPacotes(); }
  }, 'p'], ['Cancelar']]);
}

const renovar = (id) => renovarPets([Number(id)]);

// Recebimentos: pagamentos registrados, filtrados por período e forma (fechamento do dia/semana/mês)
function recebimentos() {
  const intervalo = periodo(X.finModo, X.finRef);
  const lista = S.pagamentos
    .filter((p) => noPeriodo(p.d, intervalo) && (!X.finForma || p.f === X.finForma))
    .sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id);
  const total = lista.reduce((t, p) => t + p.v, 0);
  const porForma = FORMAS.map((f) => [f, lista.filter((p) => p.f === f).reduce((t, p) => t + p.v, 0)]);
  const opcoes = ['', ...FORMAS].map((f) => `<option value="${f}" ${f === X.finForma ? 'selected' : ''}>${f || 'Todas as formas'}</option>`).join('');

  const linhas = lista.map((p) => {
    const c = cliente(p.c);
    return `<div class="lin"><div><b>${esc(c?.pet || '—')}</b> <small>${esc(c?.tutor || '')}</small><br>
      <small>${br(p.d)} · ${esc(p.f || '')}</small></div><b>${moeda(p.v)}</b></div>`;
  }).join('');

  return `${filtroPeriodo('fin', X.finModo, X.finRef)}
    <div class="r"><select data-change="finForma">${opcoes}</select></div>
    <p class="mu">${rotuloPeriodo(X.finModo, X.finRef)}${X.finForma ? ' · ' + esc(X.finForma) : ''}</p>
    <div class="k">
      <div><small>Total recebido</small><b>${moeda(total)}</b><small>${lista.length} pagamento(s)</small></div>
      ${X.finForma ? '' : porForma.map(([f, v]) => `<div><small>${f}</small><b>${moeda(v)}</b></div>`).join('')}
    </div>
    ${linhas ? `<div class="lista card-lista">${linhas}</div>` : '<p class="mu">Nenhum pagamento neste período.</p>'}`;
}

function grafico() {
  const ano = hoje().slice(0, 4);
  const pagos = Array(12).fill(0);
  const pendentes = Array(12).fill(0);
  S.pagamentos.forEach((p) => { if (p.d.slice(0, 4) === ano) pagos[Number(p.d.slice(5, 7)) - 1] += p.v; });
  S.clientes.forEach((c) => {
    if (!c.oc && c.pag !== 'Pago' && c.criado.slice(0, 4) === ano) pendentes[Number(c.criado.slice(5, 7)) - 1] += c.valor;
  });
  const maximo = Math.max(1, ...pagos, ...pendentes);
  const MESES = 'JanFevMarAbrMaiJunJulAgoSetOutNovDez';
  const rotulo = (x, y, texto) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="var(--mu)">${texto}</text>`;

  let svg = '<svg class="grafico" viewBox="0 0 640 260" width="100%">'
    + '<rect x="20" y="6" width="10" height="10" fill="#30bfbd"/><text x="34" y="15" font-size="11" fill="var(--mu)">Pago</text>'
    + '<rect x="80" y="6" width="10" height="10" fill="#f2a33a"/><text x="94" y="15" font-size="11" fill="var(--mu)">Pendente</text>';
  for (let i = 0; i < 12; i++) {
    const x = 20 + i * 51;
    const alturaPago = pagos[i] / maximo * 170;
    const alturaPendente = pendentes[i] / maximo * 170;
    svg += `<rect x="${x}" y="${220 - alturaPago}" width="20" height="${alturaPago}" fill="#30bfbd"/>`
      + `<rect x="${x + 22}" y="${220 - alturaPendente}" width="20" height="${alturaPendente}" fill="#f2a33a"/>`
      + `<text x="${x + 21}" y="238" text-anchor="middle" font-size="11" fill="var(--mu)">${MESES.slice(i * 3, i * 3 + 3)}</text>`
      + (pagos[i] ? rotulo(x + 10, 216 - alturaPago, Math.round(pagos[i])) : '')
      + (pendentes[i] ? rotulo(x + 32, 216 - alturaPendente, Math.round(pendentes[i])) : '');
  }
  return svg + '</svg>';
}

acoes({
  pagar: (d) => modalPagamento(d.id),
  renovar: (d) => renovar(d.id),
  finAba: (d) => { X.finAba = d.v; render(); },
  finBusca: (d, el) => { X.finBusca = el.value; render(); },
  finPac: (d, el) => { X.finPac = el.value; render(); },
  finCobrar: cobrarPendentes,
  finVirarMes: virarMes,
  finForma: (d, el) => { X.finForma = el.value; render(); },
  finModo: (d) => { X.finModo = d.v; render(); },
  finRef: (d, el) => { X.finRef = el.value || hoje(); render(); },
  finNav: (d) => { X.finRef = deslocar(X.finModo, X.finRef, Number(d.v)); render(); },
});
