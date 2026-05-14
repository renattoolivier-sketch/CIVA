import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = rawUrl?.trim().replace(/\/$/, '');
const supabaseAnonKey = 
  ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || 
  (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  (import.meta as any).env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase: Faltando URL ou Chave Anon. Configure os Secrets no painel do AI Studio para ativar a sincronização em nuvem.');
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
