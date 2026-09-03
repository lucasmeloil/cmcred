import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Key, DoorOpen, PlusCircle, Edit3, Trash2, Download, Search, RefreshCw, Activity, ShieldCheck } from 'lucide-react';

type AuditAction = 'login' | 'logout' | 'criação' | 'edição' | 'exclusão' | 'exportação';

interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  description: string;
  ip: string;
  created_at: string;
  user_name?: string;
}

const actionConfig: Record<AuditAction, { icon: React.ReactNode; color: string; label: string }> = {
  login: { icon: <Key size={16} />, color: '#2563eb', label: 'Login' },
  logout: { icon: <DoorOpen size={16} />, color: '#64748b', label: 'Logout' },
  'criação': { icon: <PlusCircle size={16} />, color: '#059669', label: 'Criação' },
  'edição': { icon: <Edit3 size={16} />, color: '#d97706', label: 'Edição' },
  'exclusão': { icon: <Trash2 size={16} />, color: '#dc2626', label: 'Exclusão' },
  'exportação': { icon: <Download size={16} />, color: '#7c3aed', label: 'Exportação' },
};

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (data) {
      setLogs(data.map(d => ({
        ...d,
        user_name: d.profiles?.full_name || 'Sistema/Desconhecido',
        action: d.action as AuditAction
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(l => {
    const matchSearch = (l.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px', padding: '0.75rem 1rem',
    color: '#1e293b', fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  };

  return (
    <div style={{ padding: '2.5rem' }}>
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity size={32} color="#d97706" /> Trilha de Auditoria
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Monitoramento em tempo real de todas as ações administrativas</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', background: '#f0fdf4', padding: '0.75rem 1.25rem', borderRadius: '14px', border: '1px solid #dcfce7', alignItems: 'center' }}>
          <ShieldCheck size={20} color="#059669" />
          <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>PROTEÇÃO ATIVA ATIVADA</span>
        </div>
      </header>

      {/* Action Summaries */}
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {(Object.entries(actionConfig) as [AuditAction, typeof actionConfig[AuditAction]][]).map(([action, cfg]) => {
          const count = logs.filter(l => l.action === action).length;
          const isActive = actionFilter === action;
          return (
            <div key={action} style={{
              background: isActive ? '#fff' : '#ffffff', 
              border: `2px solid ${isActive ? cfg.color : '#f1f5f9'}`,
              borderRadius: '20px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
              cursor: 'pointer', minWidth: '160px',
              boxShadow: isActive ? `0 10px 15px -3px ${cfg.color}15` : '0 4px 6px -1px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }} onClick={() => setActionFilter(isActive ? 'all' : action)}>
              <div style={{ background: `${cfg.color}10`, color: cfg.color, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cfg.icon}
              </div>
              <div>
                <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 900, lineHeight: 1 }}>{count}</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '450px' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Search size={18} /></span>
          <input placeholder="Filtrar por usuário, ação ou descrição específica..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.75rem' }} />
        </div>
        <button onClick={fetchLogs}
          style={{ padding: '0.8rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <RefreshCw size={16} /> Atualizar Logs
        </button>
      </div>

      {/* Timeline Layout */}
      <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>Sincronizando trilha forense do sistema...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.map((log, i) => {
              const cfg = actionConfig[log.action] || actionConfig['login'];
              return (
                <div key={log.id} style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                  {i < filtered.length - 1 && (
                    <div style={{
                      position: 'absolute', left: '23px', top: '48px',
                      bottom: 0, width: '2px',
                      background: '#f1f5f9',
                    }} />
                  )}
                  <div style={{
                    width: '48px', height: '48px', flexShrink: 0,
                    background: `${cfg.color}10`,
                    borderRadius: '50%', border: `2px solid #fff`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cfg.color, zIndex: 1,
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }}>{cfg.icon}</div>
                  <div style={{
                    flex: 1,
                    padding: '0.5rem 0 2rem',
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem' }}>{log.user_name}</span>
                      <span style={{ background: `${cfg.color}10`, color: cfg.color, borderRadius: '8px', padding: '0.25rem 0.75rem', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0.75rem', color: '#475569', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.6 }}>{log.description}</p>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        🕒 {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                      {log.ip && (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          📡 IP DO TERMINAL: {log.ip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b' }}>
                <p style={{ fontWeight: 600 }}>Nenhum registro de auditoria encontrado para os filtros aplicados.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
