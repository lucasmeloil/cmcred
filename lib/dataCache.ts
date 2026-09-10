/**
 * Gerenciador de cache local seguro para o sistema CM CRED
 * Permite inicialização instantânea das telas (Cache-First)
 * e proteção contra perda de dados quando o usuário muda de aba ou fica inativo.
 */

export function loadCachedData<T>(key: string, defaultVal: T | null = null): T | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultVal;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    console.warn(`[dataCache] Falha ao ler chave "${key}":`, err);
    return defaultVal;
  }
}

export function saveCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (data === undefined || data === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (err) {
    console.warn(`[dataCache] Falha ao gravar chave "${key}":`, err);
  }
}

export function clearCachedData(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Envolve uma Promise em um timeout rígido para evitar que queries fiquem presas em "loading..."
 */
export async function withQueryTimeout<T = any>(
  promise: PromiseLike<T> | Promise<T>,
  timeoutMs = 8000,
  timeoutMessage = 'Operação excedeu o tempo limite'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
