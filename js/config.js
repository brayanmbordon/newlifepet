// Configuração pública do projeto Supabase.
// A chave "publishable" pode ficar no front-end: quem protege os dados são as regras (RLS) do banco.
// NUNCA coloque aqui a chave "secret" / "service_role" nem a senha do banco.
export const SUPABASE_URL = 'https://jkfgdlcpscpbmxgknyjj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_nnP2GMmLJ8o5M7kfitpKwg_YESyNSOQ';

// Bucket do Supabase Storage onde ficam as fotos dos usuários (ver sql/03_fotos_storage.sql)
export const BUCKET_FOTOS = 'fotos';
