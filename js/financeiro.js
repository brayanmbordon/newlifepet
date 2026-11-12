// Guia Financeiro: carteira, pagamentos e gráfico mensal.
import { sb } from './supabase.js';
import { $, esc, br, hoje, moeda, linkWhatsApp } from './utils.js';
import { S, q, cliente, atualizar } from './state.js';
import { modal, acoes } from './ui.js';

// Janela de confirmação de pagamento. Também é usada pelo Cadastro e pela Agenda.
// "idAgendamento" só vem da Agenda: se o pagamento for cancelado, o banho volta para "Andamento".
export function modalPagamento(idCliente, idAgendamento) {
  const c = cliente(idCliente);
  modal(`<h3>Confirmar pagamento</h3><p>${esc(c.pet)} (${esc(c.tutor)}) · ${moeda(c.valor)}</p>
    <div class="g">
      <label>Forma de pagamento<select id="p_f"><option>Dinheiro</option><option>Pix</option><option>Cartão Débito</option><option>Cartão Crédito</option></select></label>
      <label>Data do pagamento<input type="date" id="p_d" value="${hoje()}"></label>
    </div>`,
  [
    ['Confirmar', async () => {
      const data = $('#p_d').value;
      if (!data) return false;
      // Função do banco: registra o pagamento e marca o cliente como Pago numa única operação.
      await q(sb.rpc('registrar_pagamento', { p_cliente: c.id, p_data: data, p_forma: $('#p_f').value }));
      await atualizar();
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
  const emAberto = soma(lista.filter((c) => c.pag !== 'Pago'));

  return `<h2>Financeiro</h2>
    <div class="k">
      <div><small>Carteira total</small><b>${moeda(soma(lista))}</b></div>
      <div><small>Pago no mês</small><b>${moeda(pagoNoMes)}</b></div>
      <div><small>Pendente (em aberto)</small><b>${moeda(emAberto)}</b></div>
    </div>
    <div class="tw"><table>
      <tr><th>Tutor</th><th>Pet</th><th>Pacote</th><th>Pagamento</th><th>Valor</th><th></th></tr>
      ${lista.map(linha).join('')}
    </table></div>
    <h3>Mês a mês · ${hoje().slice(0, 4)}</h3>
    <div class="tw pad">${grafico()}</div>`;
}

function linha(c) {
  const texto = `Olá *${c.tutor}* tudo bem? Estamos passando para informar que o seu pacote de banho acabou. Na semana que vem iniciaremos um novo pacote. Responda *RENOVAR* ou *CANCELAR*.`;
  const situacao = c.pag === 'Pago'
    ? `<span class="tag ok">Pago · ${esc(c.forma || '')} · ${c.dp ? br(c.dp) : ''}</span>`
    : '<span class="tag wa">Pendente</span>';
  return `<tr><td>${esc(c.tutor)}</td><td>${esc(c.pet)}</td><td>${esc(c.pac)}</td><td>${situacao}</td><td>${moeda(c.valor)}</td>
    <td class="r">
      ${c.pag !== 'Pago' ? `<button data-click="pagar" data-id="${c.id}">Registrar pagamento</button>` : ''}
      <a class="btn verde" target="_blank" rel="noopener" href="${linkWhatsApp(c.tel, texto)}">WhatsApp</a>
      <button title="Simula a resposta do cliente" data-click="renovar" data-id="${c.id}">Renovar</button>
      <button title="Simula a resposta do cliente" data-click="ocultar" data-id="${c.id}">Cancelar</button>
    </td></tr>`;
}

async function renovar(id) {
  await q(sb.from('pets').update({ pag: 'Pendente', forma: null, dp: null, criado: hoje() }).eq('id', id));
  await atualizar();
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
});
