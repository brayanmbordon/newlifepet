// Cliente do Supabase e controle de "Manter este dispositivo conectado".
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const CHAVE_MANTER = 'nlp_keep';

// Sem preferência salva, o dispositivo é tratado como "conectado" (comportamento padrão do Supabase).
const manter = () => {
  try { return localStorage.getItem(CHAVE_MANTER) !== '0'; } catch { return true; }
};

export function definirManterConectado(valor) {
  try { localStorage.setItem(CHAVE_MANTER, valor ? '1' : '0'); } catch { /* armazenamento bloqueado */ }
}

// Onde guardar a sessão: localStorage (dispositivo salvo) ou sessionStorage (some ao fechar a aba).
const armazenamento = {
  getItem: (k) => localStorage.getItem(k) ?? sessionStorage.getItem(k),
  setItem: (k, v) => {
    const [destino, outro] = manter() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    destino.setItem(k, v);
    outro.removeItem(k);
  },
  removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: armazenamento } });
