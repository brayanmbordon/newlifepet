// Estado da aplicação e carregamento dos dados do Supabase.
import { sb } from './supabase.js';
import { hoje } from './utils.js';
import { render } from './ui.js';

// Dados do banco
export const S = { clientes: [], agendamentos: [], pagamentos: [], perfis: [] };

// Estado da tela
export const X = {
  usuario: null,        // perfil do usuário logado
  sessao: null,         // sessão do Supabase Auth
  aba: 'a',             // c = cadastro, a = agenda, h = histórico, f = financeiro, u = usuários
  dia: hoje(),          // dia exibido na agenda
  mostrarOcultos: false,
  busca: '',            // filtro do histórico
  emailLogin: '',
  erroLogin: '',
  manter: false,        // caixa "Manter este dispositivo conectado"
};

// Executa uma consulta do Supabase e lança o erro, se houver.
export async function q(promessa) {
  const r = await promessa;
  if (r.error) throw r.error;
  return r.data;
}

// O Supabase devolve no máximo 1000 linhas por consulta. Esta função busca em páginas
// para que nada seja cortado quando a base crescer.
const POR_PAGINA = 1000;
async function todos(tabela) {
  const linhas = [];
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const pagina = await q(sb.from(tabela).select('*').order('id').range(inicio, inicio + POR_PAGINA - 1));
    linhas.push(...pagina);
    if (pagina.length < POR_PAGINA) return linhas;
  }
}

export async function carregar() {
  const [clientes, agendamentos, pagamentos, perfis] = await Promise.all([
    todos('clientes'), todos('agendamentos'), todos('pagamentos'), todos('perfis'),
  ]);
  S.clientes = clientes.map((c) => ({ ...c, valor: Number(c.valor), end: c.endereco, oc: c.oculto }));
  S.agendamentos = agendamentos;
  S.pagamentos = pagamentos.map((p) => ({ ...p, v: Number(p.v) }));
  S.perfis = perfis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  X.usuario = S.perfis.find((p) => p.id === X.sessao.user.id) || null;
}

export async function atualizar() {
  await carregar();
  render();
}

export function limparEstado() {
  S.clientes = []; S.agendamentos = []; S.pagamentos = []; S.perfis = [];
  X.usuario = null; X.sessao = null; X.aba = 'a'; X.erroLogin = '';
}

export const cliente = (id) => S.clientes.find((c) => c.id == id);
// Um horário só fica livre se o agendamento foi cancelado ou o cliente pediu reagendamento.
export const ativo = (a) => a.st !== 'Cancelado' && a.cf !== 'r';
