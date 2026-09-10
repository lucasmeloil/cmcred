/**
 * connectionManager.ts — CM CRED
 *
 * Middleware Centralizado de Conexão, Visibilidade e Auto-Heal (Sem F5)
 * - Monitora visibilidade da aba (visibilitychange) e foco da janela (focus).
 * - Monitora status de rede (online / offline).
 * - Realiza verificação e renovação preventiva e silenciosa de tokens JWT.
 * - Gerencia a reconexão automática dos canais WebSocket do Supabase Realtime.
 * - Mantém registro de auditoria dos eventos de conexão no localStorage.
 * - Notifica todas as páginas e componentes para sincronização sem perda de dados.
 */

import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

export type ConnectionEventType =
  | 'online'
  | 'offline'
  | 'tab_hidden'
  | 'tab_visible'
  | 'token_refresh_attempt'
  | 'token_refresh_success'
  | 'token_refresh_failed'
  | 'realtime_reconnected'
  | 'sync_dispatched';

export interface ConnectionAuditEntry {
  id: string;
  type: ConnectionEventType;
  timestamp: string;
  details?: string;
}

const AUDIT_STORAGE_KEY = 'cmcred_connection_audit_log';
const MAX_AUDIT_ENTRIES = 50;

class ConnectionManager {
  private isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isVisibleState: boolean = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
  private isReconnectingState: boolean = false;
  private lastReconnectedAt: Date = new Date();
  private reconnectListeners = new Set<(isSilent: boolean) => void | Promise<void>>();
  private debounceTimer: any = null;
  private isRefreshingToken: boolean = false;
  private lastSyncTime: number = 0;

  constructor() {
    if (typeof window === 'undefined') return;

    this.setupEventListeners();
    this.logEvent('tab_visible', 'Inicialização do ConnectionManager');
  }

  private setupEventListeners(): void {
    // 1. Mudança de visibilidade da aba: reconecta e valida sessão ao retornar
    document.addEventListener('visibilitychange', () => {
      const isVisible = document.visibilityState === 'visible';
      this.isVisibleState = isVisible;

      if (!isVisible) {
        this.logEvent('tab_hidden', 'Aba minimizada ou usuário alternou de aba');
      } else {
        this.logEvent('tab_visible', 'Usuário retornou à aba CM CRED');
        this.handleWakeUp(true);
      }
    });

    // 2. Foco na janela: reconexão passiva com debounce
    window.addEventListener('focus', () => {
      this.isVisibleState = true;
      this.handleWakeUp(true);
    });

    // 3. Status de rede online/offline
    window.addEventListener('online', () => {
      this.isOnlineState = true;
      this.logEvent('online', 'Conexão com a internet restaurada');
      this.handleWakeUp(false);
    });

    window.addEventListener('offline', () => {
      this.isOnlineState = false;
      this.logEvent('offline', 'Sem conexão com a internet detectada');
    });

    // 4. Verificação periódica suave de token (a cada 4 minutos se aba visível)
    setInterval(() => {
      if (this.isVisibleState && this.isOnlineState) {
        this.ensureFreshSession(false);
      }
    }, 4 * 60 * 1000);
  }

  /**
   * Trata o despertar da aba ou restauração de rede
   */
  public async handleWakeUp(isSilent = true): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      this.isReconnectingState = true;

      try {
        // 1. Garantir que o socket Realtime do Supabase está conectado
        await this.ensureRealtimeSocket();

        // 2. Garantir que a sessão do Supabase está válida antes de fazer qualquer query
        await this.ensureFreshSession(true);

        // 3. Disparar sincronização suave para todos os ouvintes registrados
        this.lastSyncTime = Date.now();
        this.lastReconnectedAt = new Date();
        this.logEvent('sync_dispatched', `Revalidação disparada para ${this.reconnectListeners.size} módulos`);

        // Executa callbacks de revalidação em paralelo tolerante a falhas
        const callbacks = Array.from(this.reconnectListeners);
        await Promise.allSettled(callbacks.map(cb => Promise.resolve(cb(isSilent))));
      } catch (err) {
        console.warn('[ConnectionManager] Aviso durante revalidação ao acordar:', err);
      } finally {
        this.isReconnectingState = false;
      }
    }, 300); // 300ms de amortecimento para o navegador estabilizar o socket
  }

  /**
   * Verifica se o token JWT está próximo de expirar e realiza a renovação silenciosa
   */
  public async ensureFreshSession(forceCheck = false): Promise<{ valid: boolean; session: Session | null }> {
    if (this.isRefreshingToken) {
      return { valid: true, session: null };
    }

    this.isRefreshingToken = true;
    try {
      const getSessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ data: { session: null }, error: new Error('Timeout getSession') }), 2500)
      );
      const { data: { session }, error } = await Promise.race([getSessionPromise, timeoutPromise]);

      if (error || !session) {
        // Não apaga dados locais se houver falha de rede temporária
        return { valid: false, session: null };
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const timeLeftSec = expiresAt - nowSec;

      // Renova apenas se o token já expirou ou expira em menos de 60 segundos
      if (expiresAt > 0 && timeLeftSec <= 60) {
        this.logEvent('token_refresh_attempt', `Token expirando (${timeLeftSec}s). Renovando preventivamente...`);
        const refreshPromise = supabase.auth.refreshSession();
        const refreshTimeout = new Promise<any>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: new Error('Timeout refresh') }), 3000)
        );
        const { data: refreshed, error: refreshErr } = await Promise.race([refreshPromise, refreshTimeout]);

        if (refreshErr) {
          this.logEvent('token_refresh_failed', refreshErr.message);
          return { valid: true, session }; // Mantém a sessão atual enquanto possível
        }

        if (refreshed?.session) {
          this.logEvent('token_refresh_success', 'Token JWT renovado silenciosamente com sucesso');
          return { valid: true, session: refreshed.session };
        }
      }

      return { valid: true, session };
    } catch (err: any) {
      this.logEvent('token_refresh_failed', err?.message || 'Erro inesperado na renovação de token');
      return { valid: false, session: null };
    } finally {
      this.isRefreshingToken = false;
    }
  }

  /**
   * Assegura que o socket do Supabase Realtime esteja ativo e conectado
   */
  public async ensureRealtimeSocket(): Promise<void> {
    try {
      const realtime = (supabase as any).realtime;
      if (realtime && typeof realtime.isConnected === 'function') {
        if (!realtime.isConnected()) {
          this.logEvent('realtime_reconnected', 'Reconectando socket WebSocket do Realtime...');
          realtime.connect();
        }
      }
    } catch (err) {
      console.warn('[ConnectionManager] Erro ao verificar realtime socket:', err);
    }
  }

  /**
   * Registra um listener para ser acionado quando a aba acordar ou reconectar
   */
  public subscribeToReconnect(callback: (isSilent: boolean) => void | Promise<void>): () => void {
    this.reconnectListeners.add(callback);
    return () => {
      this.reconnectListeners.delete(callback);
    };
  }

  /**
   * Registra eventos no log de auditoria local
   */
  public logEvent(type: ConnectionEventType, details?: string): void {
    try {
      const entry: ConnectionAuditEntry = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        timestamp: new Date().toISOString(),
        details,
      };

      if (typeof window === 'undefined') return;

      const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
      const existing: ConnectionAuditEntry[] = raw ? JSON.parse(raw) : [];
      const updated = [entry, ...existing].slice(0, MAX_AUDIT_ENTRIES);
      window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  /**
   * Recupera o log de auditoria de conexões
   */
  public getAuditLog(): ConnectionAuditEntry[] {
    try {
      if (typeof window === 'undefined') return [];
      const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public isOnline(): boolean {
    return this.isOnlineState;
  }

  public isVisible(): boolean {
    return this.isVisibleState;
  }

  public isReconnecting(): boolean {
    return this.isReconnectingState;
  }

  public getLastReconnectedAt(): Date {
    return this.lastReconnectedAt;
  }
}

// Instância Singleton Global
export const connectionManager = new ConnectionManager();
