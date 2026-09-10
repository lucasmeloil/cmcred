/**
 * liveSyncBus.ts — CM CRED
 *
 * Barramento de Sincronização e Broadcast em Tempo Real (Sub-100ms)
 * - Conecta Consultores e Administradores em tempo real absoluto via Supabase Broadcast.
 * - Quando um consultor lança um empréstimo ou cadastra um cliente, o Admin recebe
 *   notificação e atualização no mesmo instante.
 * - Suporte a alerta sonoro sutil via Web Audio API (sem dependência de arquivos externos).
 */

import { supabase } from './supabase';

export type LiveEventType = 
  | 'LOAN_CREATED'
  | 'CUSTOMER_CREATED'
  | 'LOAN_STATUS_UPDATED'
  | 'RATES_UPDATED';

export interface LiveSyncEvent {
  type: LiveEventType;
  authorId?: string;
  authorName?: string;
  authorRole?: string;
  timestamp: string;
  data: any;
}

type LiveEventHandler = (event: LiveSyncEvent) => void;

class LiveSyncBus {
  private channel: any = null;
  private listeners = new Set<LiveEventHandler>();
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    this.initChannel();
  }

  private initChannel() {
    try {
      this.channel = supabase.channel('cmcred-live-sync', {
        config: {
          broadcast: { self: false } // Apenas os outros usuários recebem o broadcast
        }
      });

      this.channel
        .on('broadcast', { event: 'live_event' }, ({ payload }: { payload: LiveSyncEvent }) => {
          this.notifyListeners(payload);
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('[LiveSyncBus] Conectado ao barramento de eventos instantâneos.');
          }
        });
    } catch (err) {
      console.warn('[LiveSyncBus] Erro ao inicializar barramento:', err);
    }
  }

  private notifyListeners(event: LiveSyncEvent) {
    // 1. Toca o chime sonoro sutil
    this.playNotificationSound();

    // 2. Dispara evento DOM global para que qualquer componente com useRealtimeSync revalide
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cmcred:live-data-change', { detail: event }));
    }

    // 3. Notifica ouvintes registrados (ex: AuthContext para exibir toast do Admin)
    this.listeners.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.warn('[LiveSyncBus] Erro no manipulador de evento:', err);
      }
    });
  }

  /**
   * Emite um evento para todos os administradores e consultores conectados
   */
  public broadcast(type: LiveEventType, data: any, author?: { id?: string; name?: string; role?: string }) {
    const eventPayload: LiveSyncEvent = {
      type,
      authorId: author?.id,
      authorName: author?.name || 'Consultor CM CRED',
      authorRole: author?.role || 'consultant',
      timestamp: new Date().toISOString(),
      data
    };

    // Dispara internamente para componentes locais caso necessário
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cmcred:live-data-change', { detail: eventPayload }));
    }

    if (this.channel) {
      try {
        this.channel.send({
          type: 'broadcast',
          event: 'live_event',
          payload: eventPayload
        });
      } catch (err) {
        console.warn('[LiveSyncBus] Falha ao enviar broadcast:', err);
      }
    }
  }

  /**
   * Inscreve um ouvinte para receber eventos de broadcast
   */
  public subscribe(handler: LiveEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * Gera um som sutil, moderno e profissional de notificação via Web Audio API
   */
  public playNotificationSound() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Primeiro tom suave (880Hz - Lá5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Segundo tom ascendente (1174.66Hz - Ré6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.12);
      gain2.gain.setValueAtTime(0.1, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch {
      // Ignora silenciosamente se o navegador bloquear autoplay de áudio
    }
  }
}

export const liveSyncBus = new LiveSyncBus();
