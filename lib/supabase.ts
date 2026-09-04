import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL ou chave não encontradas. Verifique o arquivo .env');
}

// Garante uma única instância singleton global do client Supabase
const globalObj = (typeof window !== 'undefined' ? window : globalThis) as any;

export const supabase = globalObj.__cmcred_supabase_client__ || (
  (globalObj.__cmcred_supabase_client__ = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Elimina deadlock do navigator.locks que trava requisições no F5/recarregamento
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn()
    }
  }))
);

