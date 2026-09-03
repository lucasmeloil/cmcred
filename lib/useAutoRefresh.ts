import { useEffect, useRef } from 'react';

/**
 * Hook de Auto-Refresh Inteligente com Alta Performance
 * - Executa a cada `intervalMs` (padrão 30 segundos) apenas se a aba estiver visível.
 * - Ao retornar para a aba após inatividade (visibilitychange / focus), executa imediatamente.
 * - Evita requisições excessivas (debounce mínimo de 5 segundos).
 * - Elimina por completo a necessidade de pressionar F5.
 */
export function useAutoRefresh(
  refreshCallback: () => void | Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const lastRunRef = useRef<number>(Date.now());
  const callbackRef = useRef(refreshCallback);

  useEffect(() => {
    callbackRef.current = refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    if (!enabled) return;

    const executeRefresh = () => {
      // Previne disparos repetidos se foi chamado há menos de 5 segundos
      const now = Date.now();
      if (now - lastRunRef.current < 5000) return;
      lastRunRef.current = now;

      try {
        callbackRef.current();
      } catch (err) {
        console.warn('Erro na atualização automática:', err);
      }
    };

    // 1. Timer periódico a cada N segundos (apenas se a página estiver visível)
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        executeRefresh();
      }
    }, intervalMs);

    // 2. Re-execução imediata ao retornar para a aba após inatividade ou foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Se ficou inativo por mais de 8 segundos, atualiza na hora
        if (Date.now() - lastRunRef.current > 8000) {
          executeRefresh();
        }
      }
    };

    const handleWindowFocus = () => {
      if (Date.now() - lastRunRef.current > 8000) {
        executeRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [intervalMs, enabled]);
}
