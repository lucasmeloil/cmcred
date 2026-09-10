import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL ou chave não encontradas. Verifique o arquivo .env');
}

// Sincronização e compatibilidade de chaves de autenticação do Supabase no localStorage
if (typeof window !== 'undefined') {
  try {
    const customToken = window.localStorage.getItem('cmcred_auth_token');
    // Descobre a chave nativa do Supabase (sb-*-auth-token)
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const nativeToken = window.localStorage.getItem(k);
        if (!nativeToken && customToken) {
          window.localStorage.setItem(k, customToken);
        } else if (nativeToken && !customToken) {
          window.localStorage.setItem('cmcred_auth_token', nativeToken);
        }
      }
    }
  } catch {}
}

// Singleton global — uma única instância reutilizada em toda a aplicação
const globalObj = (typeof window !== 'undefined' ? window : globalThis) as any;

export const supabase = globalObj.__cmcred_supabase_client__ || (
  globalObj.__cmcred_supabase_client__ = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn(),
    }
  })
);
