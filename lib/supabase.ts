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
      // CRITICAL FIX: Remove o lock do GoTrue que serializava todas as chamadas
      // getSession() em fila (token refresh + queries PostgREST concorrentes),
      // causando timeout de 15s ao retornar para a aba após ficar inativo.
      // Sem o lock customizado, as queries correm em paralelo via HTTP/2 normalmente.
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn(),
    }
  }))
);
