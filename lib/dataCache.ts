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
 * Executa uma Promise com timeout de segurança longo (15s) e tratamento tolerante a falhas.
 * NUNCA lança erro não-tratado que quebre a interface ou gere toasts vermelhos de alerta;
 * caso atinja o timeout ou falhe, retorna fallbackValue seguro.
 */
export async function withQueryTimeout<T = any>(
  promise: PromiseLike<T> | Promise<T>,
  timeoutMs = 15000,
  fallbackValue: T = { data: null, error: null } as any
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[dataCache] Operação excedeu timeout suave de ${timeoutMs}ms.`);
      resolve(fallbackValue);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } catch (err) {
    console.warn('[dataCache] Erro capturado em consulta:', err);
    return fallbackValue;
  } finally {
    clearTimeout(timer);
  }
}
