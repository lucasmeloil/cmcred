/**
 * dataCache.ts — CM CRED
 *
 * Versão limpa SEM localStorage. Dados vivem apenas em memória React.
 * O Supabase Client cuida da sessão de autenticação de forma nativa.
 * Qualquer busca de dados é feita diretamente do banco ao montar a página
 * ou ao retornar para a aba (via useRealtimeSync / visibilitychange).
 */

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

// Stubs mantidos para compatibilidade de importação (não fazem nada)
export function loadCachedData<T>(_key: string, defaultVal: T | null = null): T | null {
  return defaultVal;
}

export function saveCachedData<T>(_key: string, _data: T): void {
  // Sem localStorage — dados vivem apenas no estado React
}

export function clearCachedData(_key: string): void {
  // Sem localStorage
}
