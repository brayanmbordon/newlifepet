// Pacotes por ciclo: o ciclo começa na contratação/renovação (campo "criado" do pet)
// e vale pela quantidade de banhos do pacote (Semanal 4, Quinzenal 2, Mensal 1),
// mesmo que atravesse de um mês para o outro. Cada agendamento guarda o seu ciclo.
import { sb } from './supabase.js';
import { esc, br, hoje, moeda, diaSemana, PACOTES } from './utils.js';
import { S, q, cliente, ativo, atualizar } from './state.js';
import { modal, acoes } from './ui.js';

const porData = (a, b) => (a.d + a.t).localeCompare(b.d + b.t);

// Ciclo do agendamento (agendamentos antigos sem ciclo: entram no atual se forem a partir do início dele)
export function cicloDe(a, c = cliente(a.cid)) {
  if (!c || c.pac === 'Avulso') return null;
  return a.ciclo || (a.d >= c.criado ? c.criado : null);
}

// Banhos (ativos) do ciclo atual do pet, em ordem
export const banhosDoCiclo = (c) => S.agendamentos
  .filter((a) => a.cid === c.id && ativo(a) && cicloDe(a, c) === c.criado)
  .sort(porData);

export const totalDoPacote = (c) => PACOTES[c.pac] || 1;

// Número do banho dentro do ciclo dele: { n, total } ou null (avulso / fora de ciclo)
export function numeroBanho(a) {
  const c = cliente(a.cid);
  const ciclo = cicloDe(a, c);
  if (!ciclo || !ativo(a)) return null;
  const lista = S.agendamentos.filter((x) => x.cid === a.cid && ativo(x) && cicloDe(x, c) === ciclo).sort(porData);
  return { n: lista.findIndex((x) => x.id === a.id) + 1, total: totalDoPacote(c) };
}

// Etiqueta "2/4" (toca para abrir o cartão do pacote)
export function selo(a) {
  const nb = numeroBanho(a);
  if (!nb) return '';
  const classe = nb.n > nb.total ? 'fora' : nb.n === nb.total ? 'ult' : '';
  const titulo = nb.n > nb.total ? 'Passou da quantidade do pacote' : nb.n === nb.total ? 'Último banho do pacote' : 'Banho do pacote';
  return `<button class="nb ${classe}" title="${titulo} · ver cartão" data-click="cartaoPacote" data-id="${a.cid}">${nb.n}/${nb.total}</button>`;
}

// Resumo do ciclo atual para Cadastro/Financeiro: "2/4 feitos"
export function seloPet(c) {
  if (c.pac === 'Avulso') return '';
  const banhos = banhosDoCiclo(c);
  const feitos = banhos.filter((a) => a.st === 'Concluído').length;
  const total = totalDoPacote(c);
  return `<button class="nb ${feitos >= total ? 'ult' : ''}" title="Banhos feitos no ciclo · ver cartão" data-click="cartaoPacote" data-id="${c.id}">🛁 ${feitos}/${total}</button>`;
}

export const cicloConcluido = (c) => c.pac !== 'Avulso'
  && banhosDoCiclo(c).filter((a) => a.st === 'Concluído').length >= totalDoPacote(c);

// --- Cartão do pacote (igual ao cartão de papel) ------------------------------
function circulos(banhos, total) {
  let html = '';
  for (let i = 0; i < total; i++) {
    const a = banhos[i];
    const classe = !a ? 'vazio' : a.st === 'Concluído' ? 'feito' : 'agendado';
    html += `<div class="bola ${classe}"><small>${i + 1}º banho</small>
      <b>${a ? br(a.d).slice(0, 5) : '—'}</b><small>${a ? (a.st === 'Concluído' ? '✓ feito' : diaSemana(a.d) + ' ' + a.t) : 'a agendar'}</small></div>`;
  }
  const extras = banhos.slice(total);
  if (extras.length) html += `<p class="er w">⚠️ Agendado(s) além do pacote: ${extras.map((a) => br(a.d)).join(', ')}</p>`;
  return html;
}

export function cartaoPacote(id) {
  const c = cliente(id);
  if (c.pac === 'Avulso') return modal(`<h3>${esc(c.pet)}</h3><p>Banho avulso (sem pacote).</p>`, [['OK', null, 'p']]);
  const total = totalDoPacote(c);
  const banhos = banhosDoCiclo(c);
  // Ciclos anteriores (agrupados pela data de início)
  const anteriores = new Map();
  S.agendamentos.filter((a) => a.cid === c.id && ativo(a) && a.st === 'Concluído' && cicloDe(a, c) && cicloDe(a, c) !== c.criado)
    .sort(porData).forEach((a) => { const k = cicloDe(a, c); (anteriores.get(k) || anteriores.set(k, []).get(k)).push(a); });

  modal(`<h3>🐾 Cartão do pacote</h3>
    <p><b>${esc(c.pet)}</b> · ${esc(c.tutor)}<br>
      <small>Pacote ${esc(c.pac)} com ${total} banho(s) · ${moeda(c.valor)} · início do ciclo ${br(c.criado)}</small><br>
      <span class="tag ${c.pag === 'Pago' ? 'ok' : 'wa'}">${c.pag === 'Pago' ? `Pago · ${esc(c.forma || '')}${c.dp ? ' · ' + br(c.dp) : ''}` : 'Pagamento pendente'}</span></p>
    <div class="bolas">${circulos(banhos, total)}</div>
    ${[...anteriores].reverse().slice(0, 4).map(([ini, l]) => `<p class="mu"><small>Ciclo de ${br(ini)}: ${l.map((a) => br(a.d).slice(0, 5)).join(' · ')}</small></p>`).join('')}`,
  [['Fechar', null, 'p']]);
}

// --- Renovar (novo ciclo começa hoje, pagamento volta para Pendente) ------------
export async function renovarPets(ids) {
  if (!ids.length) return;
  await q(sb.from('pets').update({ pag: 'Pendente', forma: null, dp: null, criado: hoje() }).in('id', ids));
  await atualizar();
}

acoes({ cartaoPacote: (d) => cartaoPacote(Number(d.id)) });
