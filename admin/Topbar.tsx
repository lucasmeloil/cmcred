import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Search, Bell, Calendar, User, Layout, MessageSquare, AlertCircle, Menu, X } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

const Topbar: React.FC<TopbarProps> = ({ title, subtitle }) => {
  const { notifications, markNotificationRead, unreadCount, toggleSidebar, sidebarOpen } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const typeIcon = (tipo: string) => {
    switch(tipo) {
      case 'lead': return <User size={16} />;
      case 'solicitacao': return <Layout size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const typeColor = (tipo: string) => tipo === 'lead' ? '#d97706' : tipo === 'solicitacao' ? '#f59e0b' : '#2563eb';

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h atrás`;
    return `${Math.floor(hours / 24)} d atrás`;
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 60,
      background: '#ffffff',
      borderBottom: '1px solid #f1f5f9',
      padding: isMobile ? '0.75rem 1rem' : '1rem 2.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isMobile ? '0.5rem' : '1.5rem',
      minHeight: '70px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1rem', flex: 1 }}>
        {isMobile && (
          <button
            onClick={toggleSidebar}
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              cursor: 'pointer', color: '#d97706',
              padding: '0',
              width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(217,119,6,0.1)',
            }}
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '1.1rem' : '1.4rem', 
            fontWeight: 900,
            color: '#0f172a',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '-1px',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
          }}>{title}</h1>
          {!isMobile && subtitle && <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>{subtitle}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1.25rem' }}>


        {/* Notifications Hub */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              position: 'relative',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              cursor: 'pointer', color: '#64748b',
              padding: '0.7rem',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#dc2626', color: '#fff',
                borderRadius: '999px', fontSize: '0.65rem',
                minWidth: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, border: '2px solid #fff',
                boxShadow: '0 2px 4px rgba(220,38,38,0.3)'
              }}>{unreadCount}</span>
            )}
          </button>

          {showNotifs && (
            <>
              <div onClick={() => setShowNotifs(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 1rem)',
                width: '380px',
                background: '#ffffff',
                border: '1px solid #f1f5f9',
                borderRadius: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                zIndex: 50, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#f8fafc'
                }}>
                  <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem' }}>Notificações</span>
                  <span style={{
                    background: '#fffbeb', color: '#b45309',
                    borderRadius: '100px', fontSize: '0.7rem',
                    padding: '4px 12px', fontWeight: 900,
                  }}>{unreadCount} NOVAS</span>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
                      <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Nenhum alerta pendente</p>
                    </div>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { markNotificationRead(n.id); }}
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid #f8fafc',
                        cursor: 'pointer',
                        background: n.lida ? 'transparent' : '#fffbeb',
                        display: 'flex', gap: '1.25rem', alignItems: 'flex-start',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        width: '40px', height: '40px', flexShrink: 0,
                        background: `${typeColor(n.tipo)}15`,
                        color: typeColor(n.tipo),
                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{typeIcon(n.tipo)}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          margin: 0, color: n.lida ? '#64748b' : '#1e293b',
                          fontSize: '0.9rem', lineHeight: 1.5,
                          fontWeight: n.lida ? 500 : 700
                        }}>{n.mensagem}</p>
                        <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>{formatTime(n.dataHora)}</p>
                      </div>
                      {!n.lida && (
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706', flexShrink: 0, marginTop: '0.5rem', boxShadow: '0 0 8px rgba(217,119,6,0.4)' }} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  <button style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Ver tudo</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dynamic Date */}
        {!isMobile && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '14px', padding: '0.7rem 1.25rem',
            color: '#b45309', fontSize: '0.85rem', fontWeight: 800,
            whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            boxShadow: '0 2px 4px rgba(217,119,6,0.05)'
          }}>
            <Calendar size={16} />
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
