import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import AdminLogin from './AdminLogin';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Dashboard from './Dashboard';
import LoanRequests from './LoanRequests';
import UsersManager from './UsersManager';
import AuditLogs from './AuditLogs';
import PeopleManager from './PeopleManager';
import Simulator from './Simulator';
import CreateLoan from './CreateLoan';
import Financeiro from './Financeiro';
import MachinesManager from './MachinesManager';
import CardFlagsManager from './CardFlagsManager';
import RatesSettingsManager from './RatesSettingsManager';
import ReportsManager from './ReportsManager';
import Tutorials from './Tutorials';
import { useDevToolsProtection } from '../lib/security';

// Simple Error Boundary to prevent black screens
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2', margin: '2rem' }}>
          <h3 style={{ fontWeight: 800 }}>⚠️ Ocorreu um erro nesta seção</h3>
          <p style={{ fontWeight: 500, color: '#475569' }}>Tente recarregar a página. Se o erro persistir, contate o suporte administrative.</p>
          <button onClick={() => window.location.reload()} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, marginTop: '1rem' }}>Recarregar Sistema</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SECTION_CONFIG: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard Estratégico', subtitle: 'Visão geral de performance e métricas em tempo real' },
  simulador: { title: 'Simulador de Crédito', subtitle: 'Cálculo dinâmico de taxas e propostas profissionais' },
  novo_emprestimo: { title: 'Lançar Operação', subtitle: 'Lançamento e registro de novos contratos PIX' },
  pessoas: { title: 'Gestão de Clientes', subtitle: 'Administração da base de portadores e parceiros' },
  maquininhas: { title: 'Gestão de Máquinas', subtitle: 'Controle de terminais e instituições bancárias' },
  bandeiras: { title: 'Gestão de Bandeiras', subtitle: 'Controle das taxas e bandeiras de cartão aceitas' },
  taxas_simulador: { title: 'Editor de Taxas do Simulador', subtitle: 'Configuração geral e personalização de taxas 1x a 18x' },
  solicitacoes: { title: 'Contratos e Empréstimos', subtitle: 'Acompanhamento e auditoria de contratos realizados' },
  financeiro: { title: 'Controle Financeiro', subtitle: 'Gestão de fluxo de caixa, repasses e lucro líquido' },
  relatorios: { title: 'Central de Relatórios', subtitle: 'Auditoria financeira consolidada e exportação de dados' },
  usuarios: { title: 'Gestão de Acessos', subtitle: 'Controle de privilégios e operadores de sistema' },
  logs: { title: 'Auditoria de Sistema', subtitle: 'Rastreamento forense de atividades administrativas' },
  tutoriais: { title: 'Central de Ajuda & Tutoriais', subtitle: 'Manuais operacionais, passo a passo e base de conhecimento' },
};

const AdminApp: React.FC = () => {
  const { currentUser, isAuthenticated, sidebarOpen, isLoading, notifications, markNotificationRead, authUserEmail } = useAuth();
  const [activeSection, setActiveSectionState] = useState(() => {
    try {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash && SECTION_CONFIG[hash]) return hash;
      const saved = localStorage.getItem('cmcred_active_section');
      if (saved && SECTION_CONFIG[saved]) return saved;
    } catch {}
    return 'dashboard';
  });

  const setActiveSection = (section: string) => {
    setActiveSectionState(section);
    try {
      localStorage.setItem('cmcred_active_section', section);
      window.location.hash = section;
    } catch {}
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Manter sincronizado se o hash da URL mudar
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash && SECTION_CONFIG[hash] && hash !== activeSection) {
        setActiveSectionState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeSection]);

  // Proteção contra inspeção e extração de código/dados via F12 / DevTools
  useDevToolsProtection(isAuthenticated);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Sincronização dinâmica de rota: /consultor vs /admin
  useEffect(() => {
    if (currentUser) {
      const isConsultant = currentUser.perfil === 'consultant';
      const targetPath = isConsultant ? '/consultor' : '/admin';
      if (window.location.pathname !== targetPath) {
        window.history.replaceState(null, '', targetPath);
      }
    }
  }, [currentUser]);

  if (isLoading) {
    return (
      <div style={{
        background: '#0a0b0e',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f59e0b',
        gap: '1rem'
      }}>
        <img src="/cmcred-logo.png" alt="CMCred" style={{ height: '56px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(245,158,11,0.5))' }} />
        <div style={{ fontWeight: 900, letterSpacing: '2px', fontSize: '0.9rem', textTransform: 'uppercase', color: '#f59e0b' }}>
          Sincronizando Acesso Seguro...
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <AdminLogin />;

  const sectionInfo = SECTION_CONFIG[activeSection] || SECTION_CONFIG.dashboard;
  const sidebarWidth = isMobile ? 0 : (sidebarOpen ? 280 : 80);
  
  // Extract active toasts
  const activeToasts = (notifications as any[]).filter(n => n.isNew);

  const renderSection = () => {
    const email = (currentUser?.email || authUserEmail || '').toLowerCase();
    const isSuperAdmin = email === 'caique@cmcred.com.br' ||
                         email.includes('caique') ||
                         currentUser?.perfil === 'admin';
    const isConsultant = !isSuperAdmin && currentUser?.perfil === 'consultant';

    const canAccessSection = (sec: string): boolean => {
      // Super Admin Principal tem acesso 100% total e irrestrito a todas as áreas
      if (isSuperAdmin) return true;

      const perms = (currentUser?.permissions || {}) as any;
      
      switch (sec) {
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
        case 'tutoriais': return true;
        default: return false;
      }
    };

    if (!canAccessSection(activeSection)) {
      return (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#ffffff', borderRadius: '24px', margin: '2rem', border: '1px solid #fee2e2' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: '#0f172a', fontWeight: 900, marginBottom: '0.5rem' }}>Acesso Restrito</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            Este módulo é restrito a administradores. Acessos não autorizados são monitorados e registrados por segurança.
          </p>
          <button 
            onClick={() => setActiveSection('simulador')}
            style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.85rem 1.75rem', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}
          >
            Voltar ao Simulador
          </button>
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'simulador': return <Simulator />;
      case 'novo_emprestimo': return <CreateLoan />;
      case 'pessoas': return <PeopleManager />;
      case 'maquininhas': return <MachinesManager />;
      case 'bandeiras': return <CardFlagsManager />;
      case 'taxas_simulador': return <RatesSettingsManager />;
      case 'solicitacoes': return <LoanRequests />;
      case 'financeiro': return <Financeiro />;
      case 'relatorios': return <ReportsManager />;
      case 'usuarios': return <UsersManager />;
      case 'logs': return <AuditLogs />;
      case 'tutoriais': return <Tutorials onNavigate={setActiveSection} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div style={{
      background: '#f8fafc',
      minHeight: '100vh',
      fontFamily: "'Inter', 'Roboto', sans-serif",
      color: '#0f172a',
    }}>
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />

      <div style={{
        marginLeft: `${sidebarWidth}px`,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        <Topbar title={sectionInfo.title} subtitle={sectionInfo.subtitle} />
        <main style={{ flex: 1, position: 'relative', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
          <ErrorBoundary key={activeSection}>
            <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
              {renderSection()}
            </div>
          </ErrorBoundary>
        </main>

        <footer style={{
          borderTop: '1px solid #f1f5f9',
          padding: '1.5rem 2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: '#ffffff'
        }}>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            © {new Date().getFullYear()} CM CRED — Plataforma de Gestão Corporativa
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
            CMCred Soluções Financeiras
          </span>
        </footer>

        {/* Global Toast Container */}
        {activeToasts.length > 0 && (
          <div style={{ position: 'fixed', top: isMobile ? '80px' : '90px', right: isMobile ? '10px' : '30px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.75rem', pointerEvents: 'none' }}>
            {activeToasts.map(toast => {
              const colors = {
                sucesso: { bg: '#f0fdf4', border: '#d97706', text: '#059669' },
                alerta: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },
                info: { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb' }
              };
              const style = colors[toast.tipo as keyof typeof colors] || colors.info;
              
              return (
                <div key={toast.id} style={{
                  background: '#ffffff',
                  borderLeft: `4px solid ${style.border}`,
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  animation: 'toastSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                  pointerEvents: 'auto',
                  maxWidth: isMobile ? 'calc(100vw - 20px)' : '350px'
                }}>
                  <div style={{ background: style.bg, color: style.border, padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {toast.tipo === 'sucesso' ? '✓' : toast.tipo === 'alerta' ? '!' : 'i'}
                  </div>
                  <div style={{ color: '#0f172a', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.4 }}>
                    {toast.mensagem}
                  </div>
                  <button 
                    onClick={() => markNotificationRead(toast.id)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', marginLeft: 'auto', display: 'flex' }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        body { margin: 0; overflow-x: hidden; background: #f8fafc; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        /* === MOBILE RESPONSIVENESS HACKS === */
        @media (max-width: 768px) {
          /* Reduzir paddings excessivos nos containers principais e modais */
          div[style*="padding: 2.5rem"], div[style*="padding: 2rem"], form[style*="padding: 2.5rem"] {
            padding: 1.25rem !important;
          }
          
          /* Forçar Grids a virarem 1 coluna no celular para evitar quebra de layout */
          div[style*="display: grid"] {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          
          /* Tabelas Responsivas (Scroll Horizontal) */
          table {
            min-width: 600px !important;
          }
          .table-scroll, div[style*="overflowX: 'auto'"], div[style*="overflow-x: auto"] {
            max-width: 100vw;
            overflow-x: auto !important;
            padding-bottom: 1rem;
          }
          
          /* Ajustar botões de formulário sem quebrar ícones (Apenas botões grandes) */
          form button[type="submit"], .action-button {
            width: 100%;
            justify-content: center;
          }
          
          /* Gráficos Recharts */
          .recharts-responsive-container {
            min-height: 250px !important;
          }
        }
      `}</style>
    </div>
  );
};

const AdminPanel: React.FC = () => (
  <AuthProvider>
    <AdminPanelContent />
  </AuthProvider>
);

const AdminPanelContent: React.FC = () => <AdminApp />;

export default AdminPanel;
