// Guia Histórico: banhos concluídos.
import { sb } from './supabase.js';
import { esc, br } from './utils.js';
import { S, X, q, cliente, atualizar } from './state.js';
import { acoes, render } from './ui.js';

export function telaHistorico() {
  const busca = X.busca.toLowerCase();
  const lista = S.agendamentos
    .filter((a) => {
      const c = cliente(a.cid);
      return a.st === 'Concluído' && c && `${c.pet} ${c.tutor}`.toLowerCase().includes(busca);
    })
    .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));

  return `<div class="bar"><h2>Histórico</h2><input placeholder="Buscar pet ou tutor" value="${esc(X.busca)}" data-change="histBusca"></div>`
    + (lista.length ? lista.map(cartao).join('') : '<p class="mu">Nenhum banho concluído ainda.</p>');
}

function cartao(a) {
  const c = cliente(a.cid);
  return `<div class="card">
    <div><b>${br(a.d)} ${a.t}</b> ${esc(c.pet)} <small>(${esc(c.tutor)})</small><br>
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
  histReabrir: (d) => reabrir(d.id),
});
