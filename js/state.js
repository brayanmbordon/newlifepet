// Estado da aplicação e carregamento dos dados do Supabase.
import { sb } from './supabase.js';
import { hoje } from './utils.js';
import { render } from './ui.js';

// Dados "crus" do banco (uma tabela cada)
export const S = { tutores: [], pets: [], clientes: [], agendamentos: [], pagamentos: [], perfis: [] };
// S.clientes é uma VISÃO: cada pet já vem com os dados do seu tutor juntos
// (tutor, tel, email, end...), no mesmo formato que o resto do sistema usa
// (agenda, financeiro, histórico). Isso existe porque um tutor pode ter mais
// de um pet — cada pet é uma linha em S.clientes, mas o tutor é compartilhado.

// Estado da tela
export const X = {
  usuario: null,        // perfil do usuário logado
  sessao: null,         // sessão do Supabase Auth
  aba: 'a',             // c = cadastro, a = agenda, h = histórico, f = financeiro, u = usuários
  dia: hoje(),          // dia exibido na agenda
  mostrarOcultos: false,
  agModo: 'd',          // agenda: d = dia, s = semana
  busca: '',            // filtro do histórico (texto)
  histModo: 't',        // histórico: d, s, m ou t (todos)
  histRef: hoje(),
  finModo: 'm',         // financeiro (recebimentos): d, s, m ou t
  finRef: hoje(),
  finForma: '',         // '' = todas as formas de pagamento
  finAba: 'p',          // financeiro: p = pendentes, r = recebimentos, g = gráfico
  finBusca: '',
  finPac: '',
  cadBusca: '',         // cadastro: busca e filtro rápido
  cadFiltro: '',        // '' | pacotes | avulsos | pendentes
  cadAbertos: new Set(),// grupos de tutor abertos
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

// Monta S.clientes a partir de S.tutores + S.pets (ver comentário acima).
function montarClientes() {
  const tutoresPorId = new Map(S.tutores.map((t) => [t.id, t]));
  S.clientes = S.pets.map((p) => {
    const t = tutoresPorId.get(p.tutor_id) || { nome: '', tel: '', email: '', endereco: '' };
    return {
      id: p.id, tutor_id: Number(p.tutor_id),
      tutor: t.nome, tel: t.tel, email: t.email, end: t.endereco,
      pet: p.pet, raca: p.raca, obs: p.obs,
      pac: p.pac, valor: Number(p.valor), pag: p.pag, taxi: p.taxi, oc: p.oculto,
      criado: p.criado, forma: p.forma, dp: p.dp,
      diaSem: p.dia_sem ?? null, horaFixa: p.hora_fixa || '', servFixo: p.serv_fixo || 'Banho',
    };
  });
}

export async function carregar() {
  const [tutores, pets, agendamentos, pagamentos, perfis] = await Promise.all([
    todos('tutores'), todos('pets'), todos('agendamentos'), todos('pagamentos'), todos('perfis'),
  ]);
  S.tutores = tutores;
  S.pets = pets;
  montarClientes();
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
  S.tutores = []; S.pets = []; S.clientes = []; S.agendamentos = []; S.pagamentos = []; S.perfis = [];
  X.usuario = null; X.sessao = null; X.aba = 'a'; X.erroLogin = '';
}

// Visão combinada (tutor + pet) — usada pela Agenda, Financeiro e Histórico.
export const cliente = (id) => S.clientes.find((c) => c.id == id);
// Linha "crua" do tutor — usada pelo Cadastro, para editar só os dados do tutor.
export const tutor = (id) => S.tutores.find((t) => t.id == id);
// Pets de um mesmo tutor, na ordem em que foram cadastrados.
export const petsDoTutor = (tutorId) => S.pets.filter((p) => p.tutor_id == tutorId).sort((a, b) => a.id - b.id);
// Um horário só fica livre se o agendamento foi cancelado ou o cliente pediu reagendamento.
export const ativo = (a) => a.st !== 'Cancelado' && a.cf !== 'r';
