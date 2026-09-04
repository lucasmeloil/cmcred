import { useEffect, useRef } from 'react';

/**
 * Hook de Auto-Refresh Inteligente com Alta Performance
 * - Executa a cada `intervalMs` (padrão 30 segundos) apenas se a aba estiver visível.
 * - Ao retornar para a aba após inatividade, executa suavemente em segundo plano (`isSilent = true`).
 * - Evita requisições concorrentes ou repetidas (debounce e trava de execução).
 * - Garante que os dados existentes nunca sumam da tela durante a revalidação.
 */
export function useAutoRefresh(
  refreshCallback: (isSilent?: boolean) => void | Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const lastRunRef = useRef<number>(Date.now());
  const callbackRef = useRef(refreshCallback);
  const isRefreshingRef = useRef<boolean>(false);

  useEffect(() => {
    callbackRef.current = refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    if (!enabled) return;

    const executeRefresh = async (isSilent: boolean = true) => {
      // Previne disparos repetidos se foi chamado há menos de 6 segundos ou se já está executando
      const now = Date.now();
      if (now - lastRunRef.current < 6000 || isRefreshingRef.current) return;
      lastRunRef.current = now;
      isRefreshingRef.current = true;

      try {
        await callbackRef.current(isSilent);
      } catch (err) {
        console.warn('Erro na atualização automática em segundo plano:', err);
      } finally {
        isRefreshingRef.current = false;
      }
    };

    // 1. Timer periódico a cada N segundos (apenas se a página estiver visível)
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        executeRefresh(true);
      }
    }, intervalMs);

    // 2. Re-execução suave ao retornar para a aba após inatividade
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // Se ficou inativo por mais de 15 segundos, atualiza em segundo plano sem piscar a tela
        if (Date.now() - lastRunRef.current > 15000) {
          executeRefresh(true);
        }
      }
    };

    const handleWindowFocus = () => {
      if (Date.now() - lastRunRef.current > 15000) {
        executeRefresh(true);
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

