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
export const DURACAO = { 'Banho': 1, 'Tosa': 1, 'Banho e Tosa': 2 };
// Quantidade de banhos de cada pacote
export const PACOTES = { Avulso: 1, Semanal: 4, Quinzenal: 2, Mensal: 1 };
// Horários de atendimento: 08:00 às 17:30, de 30 em 30 minutos
export const HORARIOS = Array.from({ length: 20 }, (_, i) => hhmm(480 + i * 30));

// Link do WhatsApp. Aceita o telefone com ou sem o 55 na frente.
export function linkWhatsApp(telefone, texto) {
  let numero = String(telefone).replace(/\D/g, '');
  if (!(numero.startsWith('55') && numero.length >= 12)) numero = '55' + numero;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
