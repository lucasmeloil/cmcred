import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface UseRealtimeSyncOptions {
  table?: string;                              // Ex: 'loans'
  tables?: string[];                           // Ex: ['loans', 'finance', 'customers']
  schema?: string;                             // Padrão: 'public'
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'; // Padrão: '*'
  filter?: string;                             // Ex: 'consultant_id=eq.123' (opcional)
  onDataChange: (isSilent?: boolean) => void | Promise<void>; // Função que recarrega seus dados (ex: fetchData)
  heartbeatIntervalMs?: number;                // Polling de segurança (padrão: 45000ms = 45s)
  enabled?: boolean;                           // Ativar/desativar hook (padrão: true)
}

export type RealtimeSyncStatus = 'connected' | 'connecting' | 'disconnected';

export function useRealtimeSync({
  table,
  tables,
  schema = 'public',
  event = '*',
  filter,
  onDataChange,
  heartbeatIntervalMs = 45000,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const onDataChangeRef = useRef(onDataChange);
  const isRefreshingRef = useRef<boolean>(false);
  const lastRefreshTimeRef = useRef<number>(0);

  // Mantém a referência da função de busca atualizada sem reiniciar efeitos
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const targetTables = tables && tables.length > 0 ? tables : table ? [table] : ['loans'];

  // Executa o refresh seguro evitando sobreposição e requisições excessivas (cooldown 2s para silent)
  const triggerRefresh = useCallback(async (isSilent = true) => {
    const now = Date.now();
    if (isRefreshingRef.current || (isSilent && now - lastRefreshTimeRef.current < 2000)) {
      return;
    }
    lastRefreshTimeRef.current = now;
    isRefreshingRef.current = true;

    try {
      await onDataChangeRef.current(isSilent);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('[RealtimeSync] Erro ao atualizar dados:', err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!enabled) return;

    // Limpa timeout de reconexão anterior
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Limpa canal anterior se houver
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setSyncStatus('connecting');

    // Nome exclusivo para anular colisão entre múltiplas abas e telas
    const uniqueChannelName = `sync-${targetTables.join('-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(uniqueChannelName);

    // Registra listener postgres_changes para cada tabela alvo
    targetTables.forEach((tbl) => {
      const channelConfig: any = {
        event,
        schema,
        table: tbl,
      };
      if (filter) {
        channelConfig.filter = filter;
      }

      channel.on('postgres_changes', channelConfig, () => {
        // ARQUITETURA ALARME + RE-FETCH:
        // O evento atua puramente como alarme, re-buscando do banco para preservar joins e integridade
        triggerRefresh(true);
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setSyncStatus('connected');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        setSyncStatus('disconnected');

        // AUTO-HEAL: Agenda reconexão após 3 segundos caso a aba esteja visível
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
            setupChannel();
          }
        }, 3000);
      }
    });

    channelRef.current = channel;
  }, [enabled, targetTables.join(','), schema, event, filter, triggerRefresh]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Inicia canal e busca inicial
    setupChannel();
    triggerRefresh(false);

    // 2. Listener de Visibilidade Inteligente (Item 5 do Usuário):
    // Pausa a sincronização quando a aba está oculta para não sobrecarregar rede ou sessão,
    // e retoma suavemente em segundo plano ao retornar sem desconectar o usuário.
    const handleVisibilityChange = async () => {
      if (typeof document !== 'undefined') {
        if (document.visibilityState === 'hidden') {
          return;
        }

        if (document.visibilityState === 'visible') {
          // Auto-heal: reconecta canal WebSocket se caiu durante repouso
          if (!channelRef.current || (channelRef.current as any).state === 'closed') {
            setupChannel();
          }

          // Garante sessão ativa antes de buscar dados (evita concorrência lock auth + queries)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return; // Sem sessão válida, não busca dados
          } catch {
            return; // Falha ao verificar sessão — não busca dados para evitar erro
          }

          // Busca dados ao retornar para a aba (cooldown mínimo de 3s)
          const timeSinceLast = Date.now() - lastRefreshTimeRef.current;
          if (timeSinceLast > 3000) {
            triggerRefresh(true);
          }
        }
      }
    };

    // 3. Quando a janela ganha foco (revalida se passou mais de 5s)
    const handleFocus = () => {
      const timeSinceLast = Date.now() - lastRefreshTimeRef.current;
      if (timeSinceLast > 5000) {
        triggerRefresh(true);
      }
    };

    // 4. Quando a conexão cai e volta
    const handleOnline = () => {
      setupChannel();
      triggerRefresh(true);
    };

    const handleOffline = () => {
      setSyncStatus('disconnected');
    };

    // 5. Polling de contingência (Heartbeat leve: só roda se visível e conectado)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        triggerRefresh(true);
      }
    }, heartbeatIntervalMs);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup completo ao desmontar o componente
    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupChannel, triggerRefresh, heartbeatIntervalMs, enabled]);

  return {
    syncStatus,                 // 'connected' | 'connecting' | 'disconnected'
    lastSyncTime,               // Última data/hora sincronizada
    forceSync: () => triggerRefresh(false), // Ação para forçar re-sincronização imediata
  };
}
