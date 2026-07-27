// config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Substitua com seus dados reais do Supabase (A chave que começa com eyJ)
const SUPABASE_URL = "https://okffzwnvpygtajokaozh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CjdlBf8SW3u9cCFaW8DX7g_mBL9yZh2"; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);