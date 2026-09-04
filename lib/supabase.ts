import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL ou chave não encontradas. Verifique o arquivo .env');
}

// Mutex em memória: garante execução estritamente sequencial das renovações de token
// Evita erro de 'refresh_token_already_used' e anula deadlocks do navigator.locks entre abas
let authLockChain: Promise<void> = Promise.resolve();
const safeAuthLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  const current = authLockChain;
  let nextResolve: (value?: void) => void;
  authLockChain = new Promise<void>(resolve => {
    nextResolve = resolve;
  });
  try {
    await current;
    return await fn();
  } finally {
    nextResolve!();
  }
};

// Garante uma única instância singleton global do client Supabase
const globalObj = (typeof window !== 'undefined' ? window : globalThis) as any;

export const supabase = globalObj.__cmcred_supabase_client__ || (
  (globalObj.__cmcred_supabase_client__ = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      lock: safeAuthLock
    }
  }))
);

