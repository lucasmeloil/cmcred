import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { RealtimeSyncStatus } from '../lib/useRealtimeSync';

export interface RealtimeStatusBadgeProps {
  status: RealtimeSyncStatus;
  lastSyncTime: Date;
  onRefresh?: () => void | Promise<void>;
  compact?: boolean;
}

export const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({
  status,
  lastSyncTime,
  onRefresh,
  compact = false,
}) => {
  const [isRotating, setIsRotating] = useState(false);

  const statusConfig = {
    connected: { 
      color: '#10b981', 
      text: 'Sincronizado', 
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.25)',
      dotGlow: '0 0 8px rgba(16, 185, 129, 0.6)'
    },
    connecting: { 
      color: '#f59e0b', 
      text: 'Reconectando...', 
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.25)',
      dotGlow: '0 0 8px rgba(245, 158, 11, 0.6)'
    },
    disconnected: { 
      color: '#ef4444', 
      text: 'Sem Conexão', 
      bg: 'rgba(239, 68, 68, 0.08)',
      border: 'rgba(239, 68, 68, 0.25)',
      dotGlow: '0 0 8px rgba(239, 68, 68, 0.6)'
    },
  }[status] || {
    color: '#10b981',
    text: 'Sincronizado',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    dotGlow: '0 0 8px rgba(16, 185, 129, 0.6)'
  };

  const handleManualRefresh = async () => {
    if (isRotating || !onRefresh) return;
    setIsRotating(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRotating(false), 600);
    }
  };

  const formattedTime = lastSyncTime.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });

  return (
    <div
      title={`Status do Realtime: ${statusConfig.text} | Última sincronização: ${formattedTime}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: compact ? '4px 10px' : '5px 12px',
        borderRadius: '999px',
        backgroundColor: statusConfig.bg,
        border: `1px solid ${statusConfig.border}`,
        fontSize: compact ? '11px' : '12px',
        fontWeight: 700,
        color: statusConfig.color,
        letterSpacing: '0.2px',
        fontFamily: "'Inter', sans-serif",
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.3s ease',
        userSelect: 'none'
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: statusConfig.color,
          boxShadow: statusConfig.dotGlow,
          display: 'inline-block',
          animation: status === 'connecting' ? 'pulse 1.5s infinite' : 'none',
          flexShrink: 0
        }}
      />
      
      <span>{statusConfig.text}</span>
      
      {!compact && (
        <span style={{ color: '#64748b', fontWeight: 500, fontSize: '11px' }}>
          ({formattedTime})
        </span>
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={handleManualRefresh}
          title="Forçar sincronização manual agora"
          style={{
            background: 'none',
            border: 'none',
            cursor: isRotating ? 'default' : 'pointer',
            padding: '2px',
            marginLeft: '2px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = statusConfig.color)}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
        >
          <RefreshCw 
            size={12} 
            style={{ 
              transition: 'transform 0.5s ease',
              transform: isRotating ? 'rotate(360deg)' : 'none',
              animation: isRotating ? 'spin 0.6s linear' : 'none'
            }} 
          />
        </button>
      )}
    </div>
  );
};
