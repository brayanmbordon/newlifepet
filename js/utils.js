// Funções e constantes sem dependência do resto do sistema.

export const $ = (seletor) => document.querySelector(seletor);

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Sempre calculada na hora: se o sistema ficar aberto de um dia para o outro, "hoje" continua certo.
export const hoje = () => iso(new Date());
export const br = (data) => data.split('-').reverse().join('/');
export const moeda = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const minutos = (hhmmTexto) => { const [h, m] = hhmmTexto.split(':'); return h * 60 + Number(m); };
export const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

// Duração em blocos de 30 minutos
export const DURACAO = { 'Banho': 1, 'Tosa': 1, 'Banho e Tosa': 1 };
// Quantidade de banhos de cada pacote
export const PACOTES = { Avulso: 1, Semanal: 4, Quinzenal: 2, Mensal: 1 };
// Dias de atendimento: segunda a sábado (domingo fechado)
export const fechado = (data) => new Date(data + 'T12:00').getDay() === 0;
export const DIAS_SEMANA = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
// Horários de atendimento: 08:00 às 17:30, de 30 em 30 minutos
export const HORARIOS = Array.from({ length: 20 }, (_, i) => hhmm(480 + i * 30));

// Link do WhatsApp. Aceita o telefone com ou sem o 55 na frente.
export function linkWhatsApp(telefone, texto) {
  let numero = String(telefone).replace(/\D/g, '');
  if (!(numero.startsWith('55') && numero.length >= 12)) numero = '55' + numero;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// --- Filtros por período (dia, semana, mês) ---------------------------------
// modo: d = dia, s = semana (segunda a domingo), m = mês, t = todos
const dataJS = (d) => new Date(d + 'T12:00');

// Devolve [início, fim] (AAAA-MM-DD) do período que contém a data de referência
export function periodo(modo, ref) {
  const x = dataJS(ref);
  if (modo === 'd') return [ref, ref];
  if (modo === 's') {
    x.setDate(x.getDate() - (x.getDay() + 6) % 7);
    const inicio = iso(x);
    x.setDate(x.getDate() + 6);
    return [inicio, iso(x)];
  }
  if (modo === 'm') return [ref.slice(0, 7) + '-01', iso(new Date(x.getFullYear(), x.getMonth() + 1, 0))];
  return ['0000-01-01', '9999-12-31'];
}
export const noPeriodo = (data, [inicio, fim]) => data >= inicio && data <= fim;

// Avança ou volta "n" períodos a partir da data de referência
export function deslocar(modo, ref, n) {
  const x = dataJS(ref);
  if (modo === 'd') x.setDate(x.getDate() + n);
  else if (modo === 's') x.setDate(x.getDate() + 7 * n);
  else if (modo === 'm') { x.setDate(1); x.setMonth(x.getMonth() + n); }
  return iso(x);
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const diaSemana = (d) => DIAS[dataJS(d).getDay()];

export function rotuloPeriodo(modo, ref) {
  const [inicio, fim] = periodo(modo, ref);
  if (modo === 'd') return `${diaSemana(ref)}, ${br(ref)}`;
  if (modo === 's') return `Semana de ${br(inicio).slice(0, 5)} a ${br(fim)}`;
  if (modo === 'm') return dataJS(ref).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return 'Todo o período';
}

// Barra de filtro reutilizável. Gera as ações: <prefixo>Modo, <prefixo>Ref e <prefixo>Nav.
export function filtroPeriodo(prefixo, modo, ref, modos = ['d', 's', 'm', 't']) {
  const NOMES = { d: 'Dia', s: 'Semana', m: 'Mês', t: 'Todos' };
  const botoes = modos.map((m) => `<button class="${m === modo ? 'on' : ''}" data-click="${prefixo}Modo" data-v="${m}">${NOMES[m]}</button>`).join('');
  const navegar = modo === 't' ? '' : `
    <button title="Anterior" data-click="${prefixo}Nav" data-v="-1">◀</button>
    <input type="date" value="${ref}" data-change="${prefixo}Ref">
    <button title="Próximo" data-click="${prefixo}Nav" data-v="1">▶</button>`;
  return `<div class="filtro"><div class="seg">${botoes}</div><div class="r">${navegar}</div></div>`;
}
