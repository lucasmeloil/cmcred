import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL ou chave não encontradas. Verifique o arquivo .env');
}

// Garante uma única instância singleton global do client Supabase
const globalObj = (typeof window !== 'undefined' ? window : globalThis) as any;

// Fila serializada exclusiva da aba atual (in-process mutex com auto-liberação)
// Elimina deadlocks de background tabs sem quebrar a fila do GoTrueClient
let lockQueue: Promise<any> = Promise.resolve();

const safeProcessLock = async <R>(
  _name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const prev = lockQueue;
  let releaseCurrent: () => void;
  lockQueue = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });

  try {
    // Aguarda a operação anterior ser concluída ou time-out de segurança (5s)
    let timeoutTimer: any;
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutTimer = setTimeout(resolve, Math.max(1000, Math.min(acquireTimeout || 5000, 6000)));
    });

    await Promise.race([
      prev.catch(() => {}),
      timeoutPromise
    ]);
    clearTimeout(timeoutTimer);

    return await fn();
  } finally {
    releaseCurrent!();
  }
};

export const supabase = globalObj.__cmcred_supabase_client__ || (
  (globalObj.__cmcred_supabase_client__ = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      lock: safeProcessLock
    }
  }))
);

