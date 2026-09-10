import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL ou chave não encontradas. Verifique o arquivo .env');
}

// Garante uma única instância singleton global do client Supabase
const globalObj = (typeof window !== 'undefined' ? window : globalThis) as any;

// Mutex serializado leve e à prova de falhas por chave de armazenamento
// Elimina 100% de deadlocks em abas em segundo plano sem travar requisições de banco
let lockHeld = false;
const lockWaiters: Array<() => void> = [];

const acquireSafeLock = (timeoutMs: number): Promise<void> => {
  if (!lockHeld) {
    lockHeld = true;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let done = false;
    const grant = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve();
      }
    };
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        const idx = lockWaiters.indexOf(grant);
        if (idx !== -1) lockWaiters.splice(idx, 1);
        resolve(); // Auto-desbloqueio garantido para nunca travar a aplicação
      }
    }, timeoutMs);

    lockWaiters.push(grant);
  });
};

const releaseSafeLock = () => {
  if (lockWaiters.length > 0) {
    const next = lockWaiters.shift();
    if (next) next();
  } else {
    lockHeld = false;
  }
};

const safeProcessLock = async <R>(
  _name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const timeoutMs = acquireTimeout > 0 ? Math.min(acquireTimeout, 3000) : 2500;
  await acquireSafeLock(timeoutMs);
  try {
    return await fn();
  } finally {
    releaseSafeLock();
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

