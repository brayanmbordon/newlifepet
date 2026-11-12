// Fotos dos usuários no Supabase Storage.
// Na tabela "perfis", a coluna "foto" guarda só o CAMINHO do arquivo dentro do bucket
// (exemplo: "<id-do-usuario>/1731340000000.jpg"). O endereço completo é montado aqui.
import { sb } from './supabase.js';
import { BUCKET_FOTOS } from './config.js';
import { esc } from './utils.js';

const JA_E_URL = /^(data:|https?:)/;

export function urlFoto(valor) {
  if (!valor) return '';
  if (JA_E_URL.test(valor)) return valor; // fotos antigas (base64) continuam aparecendo
  return sb.storage.from(BUCKET_FOTOS).getPublicUrl(valor).data.publicUrl;
}

// Foto redonda do usuário; sem foto, mostra a inicial do nome.
export function avatar(usuario) {
  if (usuario.foto) return `<img src="${esc(urlFoto(usuario.foto))}" alt="">`;
  return esc((usuario.nome || '?').trim().charAt(0).toUpperCase());
}

// Recorta a imagem em quadrado, reduz para 256px e converte para JPEG (arquivo leve).
export function prepararFoto(arquivo, lado = 256) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith('image/')) return reject(new Error('Escolha um arquivo de imagem.'));
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = lado;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // PNG transparente não vira fundo preto no JPEG
      ctx.fillRect(0, 0, lado, lado);
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida.')); };
    img.src = url;
  });
}

// Envia a foto e devolve o caminho salvo. Cada envio usa um nome novo, então o navegador nunca mostra foto antiga.
export async function enviarFoto(idUsuario, blob) {
  const caminho = `${idUsuario}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from(BUCKET_FOTOS).upload(caminho, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return caminho;
}

// Apaga o arquivo antigo. Não interrompe o fluxo se falhar.
export async function removerFoto(valor) {
  if (!valor || JA_E_URL.test(valor)) return;
  try { await sb.storage.from(BUCKET_FOTOS).remove([valor]); } catch { /* sem problema */ }
}
