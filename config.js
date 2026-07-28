// config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// AVISO DEVSECOPS: Em arquiteturas SPA sem servidor (frontend puro), a Anon Key é pública.
// A segurança real dos dados DEPENDE EXCLUSIVAMENTE de ativar o RLS (Row Level Security) no painel do Supabase.
// Jamais insira a 'Service Role Key' (Chave Mestra) neste arquivo.
const SUPABASE_URL = "https://okffzwnvpygtajokaozh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CjdlBf8SW3u9cCFaW8DX7g_mBL9yZh2"; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Refatoração de Segurança: Transição de localStorage para sessionStorage.
        // Mitiga riscos de roubo persistente de token via XSS. A sessão morre ao fechar a aba.
        storage: window.sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});
