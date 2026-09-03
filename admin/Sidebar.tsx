import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  LayoutDashboard, 
  Calculator, 
  PlusCircle, 
  Users, 
  Smartphone, 
  ClipboardList, 
  Wallet, 
  ShieldCheck, 
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  CreditCard,
  FileDown,
  Sliders,
  Cpu
} from 'lucide-react';

interface SidebarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: SidebarItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Painel Geral' },
  { id: 'simulador', icon: <Calculator size={20} />, label: 'Simulador' },
  { id: 'novo_emprestimo', icon: <PlusCircle size={20} />, label: 'Lançar Operação' },
  { id: 'pessoas', icon: <Users size={20} />, label: 'Gestão de Clientes' },
  { id: 'solicitacoes', icon: <ClipboardList size={20} />, label: 'Empréstimos' },
  { id: 'maquininhas', icon: <Cpu size={20} />, label: 'Gestão de Máquinas' },
  { id: 'taxas_simulador', icon: <Sliders size={20} />, label: 'Editor de Taxas' },
  { id: 'financeiro', icon: <Wallet size={20} />, label: 'Financeiro' },
  { id: 'relatorios', icon: <FileDown size={20} />, label: 'Relatórios Gerais' },
  { id: 'usuarios', icon: <ShieldCheck size={20} />, label: 'Acessos' },
  { id: 'logs', icon: <History size={20} />, label: 'Auditoria' },
];

interface SidebarProps {
  activeSection: string;
  onNavigate: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate }) => {
  const { currentUser, sidebarOpen, toggleSidebar, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const isOpen = sidebarOpen;
  const sidebarWidth = isOpen ? (isMobile ? '100vw' : '280px') : (isMobile ? '100vw' : '80px');
  
  const roleColors: Record<string, string> = { 
    admin: '#d97706', 
    manager: '#f59e0b', 
    consultant: '#b45309',
    operator: '#7c3aed' 
  };
  
  const roleLabels: Record<string, string> = { 
    admin: 'Super Admin', 
    manager: 'Gestor', 
    consultant: 'Consultor',
    operator: 'Operador' 
  };

  const canAccess = (itemId: string): boolean => {
    // Se ainda estiver carregando currentUser, mostra tudo para Super Admin
    if (!currentUser) return true;

    const email = currentUser?.email?.toLowerCase() || '';
    const isSuperAdmin = email === 'caique@cmcred.com.br' ||
                         email.includes('caique') ||
                         email.includes('admin') ||
                         currentUser?.perfil === 'admin';
    if (isSuperAdmin) return true;

    const perms = (currentUser?.permissions || {}) as any;

    switch (itemId) {
      case 'dashboard': return Boolean(perms.dashboard);
      case 'simulador': return Boolean(perms.simulador ?? true);
      case 'novo_emprestimo': return Boolean(perms.create_loan || perms.novo_emprestimo);
      case 'pessoas': return Boolean(perms.customers || perms.pessoas);
      case 'solicitacoes': return Boolean(perms.loans || perms.solicitacoes);
      case 'maquininhas': return Boolean(perms.machines || perms.maquininhas);
      case 'taxas_simulador': return Boolean(perms.taxas_simulador || perms.card_flags);
      case 'financeiro': return Boolean(perms.finance || perms.financeiro);
      case 'relatorios': return Boolean(perms.reports || perms.relatorios);
      case 'usuarios': return Boolean(perms.users || perms.usuarios);
      case 'logs': return Boolean(perms.audit || perms.logs);
      default: return false;
    }
  };

  const filteredNavItems = NAV_ITEMS.filter(item => canAccess(item.id));

  return (
    <>
      {isMobile && isOpen && (
        <div
          onClick={toggleSidebar}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.6)',
            zIndex: 40,
            backdropFilter: 'blur(8px)',
          }}
        />
      )}

      <aside style={{
        position: 'fixed', top: 0, left: 0,
        height: isMobile ? 'auto' : '100vh',
        maxHeight: '100vh',
        width: sidebarWidth,
        maxWidth: isMobile ? '100vw' : '280px',
        background: '#ffffff',
        borderRight: isMobile ? 'none' : '1px solid #f1f5f9',
        borderBottom: isMobile ? '1px solid #f1f5f9' : 'none',
        zIndex: 50,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isOpen ? '0 20px 50px rgba(0,0,0,0.1)' : 'none',
        transform: isMobile ? (isOpen ? 'translateY(0)' : 'translateY(-100%)') : 'none',
        paddingTop: isMobile ? '70px' : 0,
      }}>
        {/* Institutional Branding */}
        <div style={{
          padding: isMobile ? '0.75rem 1rem' : (isOpen ? '1rem 1.25rem' : '1rem 0.5rem'),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f1f5f9',
          minHeight: isMobile ? 'auto' : '95px',
          transition: 'all 0.3s',
          background: '#ffffff'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '100%',
            background: 'linear-gradient(135deg, #0a0b0e 0%, #161922 100%)',
            padding: isOpen ? '0.75rem 1rem' : '0.5rem',
            borderRadius: '16px',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 4px 20px rgba(217, 119, 6, 0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle Gold Aura Glow */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '120px',
              height: '50px',
              background: 'radial-gradient(ellipse, rgba(245, 158, 11, 0.35), transparent 70%)',
              filter: 'blur(10px)',
              pointerEvents: 'none'
            }} />
            <img
              src="/cmcred-logo.png"
              alt="CMCred"
              style={{
                height: isOpen ? '42px' : '28px',
                width: 'auto',
                maxWidth: isOpen ? '100%' : '36px',
                objectFit: 'contain',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: 'drop-shadow(0 2px 10px rgba(245, 158, 11, 0.5))',
                position: 'relative',
                zIndex: 1
              }}
            />
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {filteredNavItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); if (isMobile) toggleSidebar(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: isMobile ? '0.65rem 0.75rem' : '0.65rem 1rem',
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  background: isActive ? '#fffbeb' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  outline: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  if(!isActive) e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={e => {
                  if(!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ 
                  color: isActive ? '#d97706' : '#94a3b8', 
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {item.icon}
                </span>
                
                {isOpen && (
                  <span style={{
                    color: isActive ? '#b45309' : '#475569',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 800 : 600,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.label}
                  </span>
                )}

                {isActive && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                    background: '#d97706', borderRadius: '0 4px 4px 0'
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Executive Footer */}
        <div style={{
          padding: isMobile ? '0.75rem' : '1rem',
          borderTop: '1px solid #f1f5f9',
          background: '#ffffff'
        }}>
          {isOpen && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              marginBottom: isMobile ? '0.5rem' : '0.75rem', padding: '0.5rem 0.75rem',
              background: '#fffbeb', borderRadius: '14px',
              border: '1px solid #fde68a',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '36px', height: '36px',
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 900, fontSize: '1rem',
                boxShadow: '0 3px 6px rgba(217,119,6,0.3)',
                flexShrink: 0
              }}>{(currentUser?.nome || currentUser?.email || 'C').charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {currentUser?.nome || currentUser?.email || 'Caique'}
                </div>
                <div style={{ color: '#b45309', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.perfil === 'admin' || !currentUser ? '👑 Super Admin' : (roleLabels[currentUser.perfil] || 'Membro')}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              width: '100%', padding: '0.75rem 1rem',
              justifyContent: isOpen ? 'flex-start' : 'center',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '12px', cursor: 'pointer',
              color: '#dc2626', fontSize: '0.85rem', fontWeight: 800,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
            onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
          >
            <LogOut size={18} />
            {isOpen && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* Sidebar Toggle Button */}
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#d97706';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.borderColor = '#d97706';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
          style={{
            position: 'fixed', top: '1.25rem',
            left: isOpen ? '262px' : '62px',
            zIndex: 100, width: '36px', height: '36px',
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '50%',
            cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.08)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            outline: 'none'
          }}
        >
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      )}
    </>
  );
};

export default Sidebar;
