/**
 * dataCache.ts — CM CRED
 *
 * Camada de Cache Local Híbrida (Memória RAM + localStorage)
 * - Carregamento instantâneo (0ms) ao montar telas ou alternar abas, eliminando telas brancas e perda de dados.
 * - Sincronização e persistência no localStorage com controle de tempo (timestamp) e TTL opcional.
 * - Proteção contra estouro de cota (QuotaExceededError) e JSON corrompido.
 * - Consulta tolerante a falhas com withQueryTimeout para evitar bloqueios na interface.
 */

interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

// Camada 1: Cache rápido em memória para resposta síncrona instantânea
const memoryStore = new Map<string, CacheEnvelope<any>>();

/**
 * Executa uma Promise com timeout de segurança tolerante a falhas.
 * NUNCA lança erro não-tratado que quebre a interface ou gere toasts vermelhos;
 * caso atinja o timeout ou falhe, retorna fallbackValue seguro silenciosamente.
 */
export async function withQueryTimeout<T = any>(
  promise: PromiseLike<T> | Promise<T>,
  timeoutMs = 15000,
  fallbackValue: T = { data: null, error: null } as any
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[CMCred] Consulta excedeu ${timeoutMs}ms — retornando fallback silencioso.`);
      resolve(fallbackValue);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } catch (err) {
    console.warn('[CMCred] Erro silencioso em consulta de dados:', err);
    return fallbackValue;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Carrega dados do cache (primeiro checa memória, depois localStorage).
 * Se o dado existir e não tiver expirado, retorna T imediatamente.
 * Caso contrário, retorna defaultVal.
 */
export function loadCachedData<T>(key: string, defaultVal: T | null = null, maxAgeMs?: number): T | null {
  try {
    // 1. Verificar memória RAM
    const inMem = memoryStore.get(key);
    const now = Date.now();
    if (inMem) {
      if (inMem.ttlMs && now - inMem.timestamp > inMem.ttlMs) {
        memoryStore.delete(key);
      } else if (maxAgeMs && now - inMem.timestamp > maxAgeMs) {
        memoryStore.delete(key);
      } else {
        return inMem.data as T;
      }
    }

    // 2. Verificar localStorage
    if (typeof window === 'undefined') return defaultVal;
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultVal;

    const parsed = JSON.parse(raw);

    // Compatibilidade com envelopes { data, timestamp, ttlMs } e objetos legados puros
    let data: T;
    let timestamp = now;
    let ttlMs: number | undefined;

    if (parsed && typeof parsed === 'object' && 'timestamp' in parsed && 'data' in parsed) {
      data = parsed.data;
      timestamp = parsed.timestamp;
      ttlMs = parsed.ttlMs;
    } else {
      data = parsed as T;
    }

    // Verificar TTL
    if (ttlMs && now - timestamp > ttlMs) {
      window.localStorage.removeItem(key);
      return defaultVal;
    }
    if (maxAgeMs && now - timestamp > maxAgeMs) {
      window.localStorage.removeItem(key);
      return defaultVal;
    }

    // Alimentar memória RAM para os próximos acessos rápidos
    memoryStore.set(key, { data, timestamp, ttlMs });
    return data;
  } catch (err) {
    console.warn(`[CMCred] Falha ao recuperar cache para chave "${key}":`, err);
    return defaultVal;
  }
}

/**
 * Salva dados no cache da memória e no localStorage com timestamp de atualização.
 */
export function saveCachedData<T>(key: string, data: T, ttlMs?: number): void {
  try {
    const timestamp = Date.now();
    const envelope: CacheEnvelope<T> = { data, timestamp, ttlMs };

    // 1. Salvar na memória RAM
    memoryStore.set(key, envelope);

    // 2. Salvar no localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(envelope));
      } catch (storageError: any) {
        // Se a cota do localStorage estiver cheia, limpar chaves temporárias antigas
        if (storageError?.name === 'QuotaExceededError' || storageError?.code === 22) {
          console.warn('[CMCred] Cota do localStorage excedida. Limpando chaves antigas de cache.');
          cleanupOldCacheKeys();
          try {
            window.localStorage.setItem(key, JSON.stringify(envelope));
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn(`[CMCred] Falha ao salvar cache para chave "${key}":`, err);
  }
}

/**
 * Remove uma chave do cache (memória e localStorage).
 */
export function clearCachedData(key: string): void {
  try {
    memoryStore.delete(key);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn(`[CMCred] Falha ao limpar cache da chave "${key}":`, err);
  }
}

/**
 * Retorna o timestamp (em ms) da última gravação de uma chave do cache.
 */
export function getCachedTimestamp(key: string): number | null {
  try {
    const inMem = memoryStore.get(key);
    if (inMem) return inMem.timestamp;

    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'timestamp' in parsed) {
      return parsed.timestamp;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Limpa chaves auxiliares de cache expiradas ou volumosas em caso de cota cheia.
 */
function cleanupOldCacheKeys(): void {
  try {
    if (typeof window === 'undefined') return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('cmcred_cache_') && !k.includes('user') && !k.includes('rates')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      window.localStorage.removeItem(k);
      memoryStore.delete(k);
    });
  } catch {}
}
