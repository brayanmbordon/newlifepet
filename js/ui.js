// Interface compartilhada: janelas (modal), avisos de erro e eventos dos botões.
import { $ } from './utils.js';

// --- Renderização -----------------------------------------------------------
// A tela principal é registrada pelo main.js. Assim os módulos podem pedir
// "redesenhe" sem importar as telas (evita importações circulares).
let renderizador = () => {};
export const definirRenderizador = (fn) => { renderizador = fn; };
export const render = () => renderizador();

// --- Avisos -----------------------------------------------------------------
let timerAviso;
export function aviso(texto) {
  const caixa = $('#toast');
  caixa.textContent = texto;
  caixa.className = 'show';
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { caixa.className = ''; }, 6000);
}
export const msgErro = (x) => aviso('Erro: ' + (x?.message || x));

// --- Janelas ----------------------------------------------------------------
// botoes: [[texto, funcao, classe]]. Se a função devolver false, a janela continua aberta.
// Se a função abrir outra janela, a nova substitui a atual.
let contadorModal = 0;
export function modal(html, botoes = []) {
  const el = $('#m');
  const id = ++contadorModal;
  const rodape = botoes.map((b, i) => `<button class="${b[2] || ''}" data-i="${i}">${b[0]}</button>`).join('');
  el.innerHTML = `<div class="box">${html}<div class="row">${rodape}</div></div>`;
  el.className = 'show';
  el.querySelectorAll('button[data-i]').forEach((botao) => {
    botao.onclick = async () => {
      const funcao = botoes[botao.dataset.i][1];
      let resultado;
      botao.disabled = true;
      try { resultado = funcao && await funcao(); } catch (x) { msgErro(x); resultado = false; }
      botao.disabled = false;
      if (resultado !== false && id === contadorModal) fecharModal();
    };
  });
}
export const fecharModal = () => { $('#m').className = ''; };
export const modalAberto = () => $('#m').className === 'show';

// --- Menu "⋯" (opções secundárias) ----------------------------------------
export const menu = (itens, rotulo = '⋯') =>
  `<details class="mn"><summary title="Mais opções">${rotulo}</summary><div>${itens.filter(Boolean).join('')}</div></details>`;

// --- Eventos ----------------------------------------------------------------
// Os botões da tela não usam onclick="...". Eles trazem data-click="nome" (ou
// data-change / data-enter) e cada módulo registra o que fazer com acoes({ nome: funcao }).
const mapa = {};
export const acoes = (novas) => Object.assign(mapa, novas);

async function despachar(tipo, ev) {
  const el = ev.target.closest?.(`[data-${tipo}]`);
  if (!el) return;
  // Botão dentro do cabeçalho de um grupo recolhível: não abre/fecha o grupo
  if (tipo === 'click' && el.tagName !== 'SUMMARY' && el.closest('summary')) ev.preventDefault();
  const funcao = mapa[el.dataset[tipo]];
  if (!funcao) return console.warn('Ação não registrada:', el.dataset[tipo]);
  try { await funcao(el.dataset, el, ev); } catch (x) { msgErro(x); }
}

export function iniciarEventos() {
  document.addEventListener('click', (ev) => {
    // Fecha menus "⋯" abertos ao clicar fora ou ao escolher uma opção
    document.querySelectorAll('details.mn[open]').forEach((d) => {
      if (!d.contains(ev.target) || ev.target.closest('.mn > div')) d.open = false;
    });
    despachar('click', ev);
  });
  document.addEventListener('change', (ev) => despachar('change', ev));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') despachar('enter', ev); });
}
