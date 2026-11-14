// Guia Histórico: banhos concluídos.
import { sb } from './supabase.js';
import { esc, br, hoje, diaSemana, periodo, noPeriodo, deslocar, rotuloPeriodo, filtroPeriodo } from './utils.js';
import { S, X, q, cliente, atualizar } from './state.js';
import { acoes, render } from './ui.js';
import { selo } from './pacote.js';

export function telaHistorico() {
  const busca = X.busca.toLowerCase();
  const intervalo = periodo(X.histModo, X.histRef);
  const lista = S.agendamentos
    .filter((a) => {
      const c = cliente(a.cid);
      return a.st === 'Concluído' && c && noPeriodo(a.d, intervalo) && `${c.pet} ${c.tutor}`.toLowerCase().includes(busca);
    })
    .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));

  return `<div class="bar"><h2>Histórico</h2><input placeholder="Buscar pet ou tutor" value="${esc(X.busca)}" data-change="histBusca"></div>
    ${filtroPeriodo('hist', X.histModo, X.histRef)}
    <p class="mu">${rotuloPeriodo(X.histModo, X.histRef)} · ${lista.length} banho(s) concluído(s)</p>`
    + (lista.length ? porDia(lista) : '<p class="mu">Nenhum banho concluído neste período.</p>');
}

// Agrupa por dia (mais recente primeiro), com o total de cada dia
function porDia(lista) {
  const dias = new Map();
  lista.forEach((a) => (dias.get(a.d) || dias.set(a.d, []).get(a.d)).push(a));
  return [...dias].map(([d, itens]) => `<div class="dia-cab"><b>${diaSemana(d)}, ${br(d)}</b><small>${itens.length} banho(s)</small></div>`
    + itens.sort((a, b) => a.t.localeCompare(b.t)).map(cartao).join('')).join('');
}

function cartao(a) {
  const c = cliente(a.cid);
  return `<div class="card">
    <div><b>${a.t}</b> ${esc(c.pet)} ${selo(a)} <small>(${esc(c.tutor)})</small><br>
      <small>${esc(a.s)} · ${esc(c.pac)}${a.x ? ' · Taxi Dog' : ''}</small></div>
    <div class="r"><span class="tag ${c.pag === 'Pago' ? 'ok' : 'wa'}">Pagamento: ${esc(c.pag)}</span>
      <button data-click="histReabrir" data-id="${a.id}">Reabrir</button></div></div>`;
}

// Reabrir devolve o banho para a Agenda, no dia em que foi marcado.
async function reabrir(id) {
  const a = S.agendamentos.find((x) => x.id == id);
  await q(sb.from('agendamentos').update({ st: 'Agendado' }).eq('id', id));
  X.dia = a.d;
  X.aba = 'a';
  await atualizar();
}

acoes({
  histBusca: (d, el) => { X.busca = el.value; render(); },
  histModo: (d) => { X.histModo = d.v; render(); },
  histRef: (d, el) => { X.histRef = el.value || hoje(); render(); },
  histNav: (d) => { X.histRef = deslocar(X.histModo, X.histRef, Number(d.v)); render(); },
  histReabrir: (d) => reabrir(d.id),
});
