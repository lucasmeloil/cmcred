import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface UseRealtimeSyncOptions {
  table?: string;
  tables?: string[];
  schema?: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  onDataChange: (isSilent?: boolean) => void | Promise<void>;
  heartbeatIntervalMs?: number;
  enabled?: boolean;
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

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const targetTables = tables && tables.length > 0 ? tables : table ? [table] : ['loans'];

  const triggerRefresh = useCallback(async (isSilent = true) => {
    const now = Date.now();
    // Trava de execução concorrente e debounce de 2s para chamadas silenciosas
    if (isRefreshingRef.current || (isSilent && now - lastRefreshTimeRef.current < 2000)) {
      return;
    }
    lastRefreshTimeRef.current = now;
    isRefreshingRef.current = true;
    try {
      await onDataChangeRef.current(isSilent);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('[RealtimeSync] Aviso ao sincronizar dados em tempo real:', err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!enabled) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    }

    setSyncStatus('connecting');

    const uniqueName = `sync-${targetTables.join('-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(uniqueName);

    targetTables.forEach((tbl) => {
      const cfg: any = { event, schema, table: tbl };
      if (filter) cfg.filter = filter;
      channel.on('postgres_changes', cfg, () => {
        triggerRefresh(true);
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setSyncStatus('connected');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        setSyncStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            setupChannel();
          }
        }, 3000);
      }
    });

    channelRef.current = channel;
  }, [enabled, targetTables.join(','), schema, event, filter, triggerRefresh]);

  useEffect(() => {
    if (!enabled) return;

    setupChannel();
    triggerRefresh(false);

    // 1. Reconexão de rede
    const handleOnline = () => {
      setupChannel();
      triggerRefresh(true);
    };

    const handleOffline = () => {
      setSyncStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Barramento de eventos instantâneos (LiveSyncBus):
    // Notifica instantaneamente quando um consultor lança um empréstimo ou cadastra um cliente
    const handleLiveDataChange = () => {
      triggerRefresh(true);
    };
    window.addEventListener('cmcred:live-data-change', handleLiveDataChange);

    // 3. Heartbeat suave de segurança a cada 60s (apenas se visível e online)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        triggerRefresh(true);
      }
    }, heartbeatIntervalMs || 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cmcred:live-data-change', handleLiveDataChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
    };
  }, [setupChannel, triggerRefresh, heartbeatIntervalMs, enabled]);

  return {
    syncStatus,
    lastSyncTime,
    forceSync: () => triggerRefresh(false),
  };
}
