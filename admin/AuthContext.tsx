import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AdminUser, Notification, UserPermissions } from './types';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  SUPER_ADMIN_EMAIL,
  useInactivityTimeout,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts
} from '../lib/security';

interface AuthContextType {
  currentUser: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sidebarOpen: boolean;
  notifications: Notification[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; remainingSeconds?: number }>;
  logout: () => Promise<void>;
  toggleSidebar: () => void;
  markNotificationRead: (id: string) => void;
  unreadCount: number;
  logAudit: (action: string, description: string) => Promise<void>;
  addNotification: (mensagem: string, tipo?: 'info' | 'sucesso' | 'alerta' | 'lead' | 'solicitacao') => void;
  authUserEmail: string | null;
  showConfirm: (message: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const CACHED_USER_KEY = 'cmcred_active_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const cached = localStorage.getItem(CACHED_USER_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    try {
      // Se já possui usuário em cache no localStorage, não bloqueia com loading spinner
      return !localStorage.getItem(CACHED_USER_KEY);
    } catch {
      return true;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    message: '',
    resolve: null
  });

  const isExplicitLogoutRef = React.useRef(false);

  // Auto logout por inatividade (30 minutos) para proteção de dados financeiros sensíveis
  const handleInactivityLogout = useCallback(() => {
    if (currentUser) {
      console.warn('Sessão encerrada por inatividade de 30 minutos (Proteção Financeira CM CRED).');
      isExplicitLogoutRef.current = true;
      supabase.auth.signOut();
      setCurrentUser(null);
      setSession(null);
      try { localStorage.removeItem(CACHED_USER_KEY); } catch {}
      isExplicitLogoutRef.current = false;
    }
  }, [currentUser]);

  useInactivityTimeout(handleInactivityLogout);

  // Fetch profile when session changes
  const fetchProfile = useCallback(async (userId: string, fallbackEmail?: string) => {
    try {
      const isSuperAdminFallback = fallbackEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
        fallbackEmail?.toLowerCase().includes('caique') ||
        fallbackEmail?.toLowerCase() === 'caique@cmcred.com.br';

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const email = data?.email || fallbackEmail || (currentUser?.email) || '';
      const isSuperAdmin = isSuperAdminFallback ||
        email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
        email.toLowerCase().includes('caique') ||
        email.toLowerCase() === 'caique@cmcred.com.br';

      const isAdminUser = isSuperAdmin ||
        email.toLowerCase().includes('admin') ||
        data?.role === 'admin';

      const allPermissions: UserPermissions = {
        dashboard: true, create_loan: true, loans: true, delete_loans: true,
        finance: true, machines: true, card_flags: true, leads: true,
        customers: true, reports: true, users: true, audit: true,
        lucros: true, novo_emprestimo: true, solicitacoes: true, financeiro: true,
        maquininhas: true, taxas_simulador: true, relatorios: true, usuarios: true,
        logs: true, pessoas: true, simulador: true
      };

      const userToSet: AdminUser = {
        id: userId,
        nome: isSuperAdmin ? 'Caique' : (data?.full_name || email.split('@')[0]),
        email: email,
        perfil: (isSuperAdmin || isAdminUser) ? 'admin' : ((data?.role as any) || 'consultant'),
        status: isSuperAdmin ? 'active' : ((data?.status as any) || 'active'),
        commission_percentage: data?.commission_percentage ? Number(data.commission_percentage) : 0,
        permissions: (isSuperAdmin || isAdminUser) ? allPermissions : (data?.permissions ? {
          ...data.permissions,
          finance: true,
          financeiro: true
        } : {
          dashboard: true, create_loan: true, loans: true, delete_loans: false,
          finance: true, machines: false, card_flags: false, leads: true,
          customers: true, reports: false, users: false, audit: false,
          lucros: false, novo_emprestimo: true, solicitacoes: true, financeiro: true,
          maquininhas: false, taxas_simulador: false, relatorios: false, usuarios: false,
          logs: false, pessoas: true, simulador: true
        }),
        dataCriacao: data?.created_at || new Date().toISOString(),
        ultimoLogin: new Date().toISOString()
      };

      setCurrentUser(userToSet);
      try {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userToSet));
      } catch {}
    } catch (err) {
      console.error('Error fetching profile, using fallback:', err);
      if (fallbackEmail || currentUser?.email) {
        const targetEmail = fallbackEmail || currentUser?.email || '';
        const isSuperAdminFallback = targetEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
          targetEmail.toLowerCase().includes('caique') ||
          targetEmail.toLowerCase() === 'caique@cmcred.com.br';
        const fallbackUser: AdminUser = {
          id: userId,
          nome: isSuperAdminFallback ? 'Caique' : targetEmail.split('@')[0],
          email: targetEmail,
          perfil: isSuperAdminFallback ? 'admin' : 'consultant',
          status: 'active',
          commission_percentage: 0,
          permissions: {
            dashboard: true, create_loan: true, loans: true, delete_loans: true,
            finance: true, machines: true, card_flags: true, leads: true,
            customers: true, reports: true, users: true, audit: true,
            lucros: true, novo_emprestimo: true, solicitacoes: true, financeiro: true,
            maquininhas: true, taxas_simulador: true, relatorios: true, usuarios: true,
            logs: true, pessoas: true, simulador: true
          },
          dataCriacao: new Date().toISOString(),
          ultimoLogin: new Date().toISOString()
        };
        setCurrentUser(fallbackUser);
        try {
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(fallbackUser));
        } catch {}
      }
    }
  }, [currentUser?.email]);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout to ensure app unblocks after refresh
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 600);

    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user?.id) {
        await fetchProfile(session.user.id, session.user.email);
      }
      setIsLoading(false);
    }).catch(err => {
      console.error('Session retrieval error:', err);
      if (isMounted) setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      if (newSession?.user?.id) {
        setSession(newSession);
        await fetchProfile(newSession.user.id, newSession.user.email);
      } else if (_event === 'SIGNED_OUT') {
        // Apenas limpa a sessão se o logout foi explicitamente solicitado pelo usuário
        if (isExplicitLogoutRef.current) {
          setSession(null);
          setCurrentUser(null);
          try { localStorage.removeItem(CACHED_USER_KEY); } catch {}
        } else {
          // Evento transiente de sincronização/troca de abas do navegador: tenta recuperar a sessão ativa
          try {
            const { data: currentSess } = await supabase.auth.getSession();
            if (currentSess?.session?.user) {
              setSession(currentSess.session);
              await fetchProfile(currentSess.session.user.id, currentSess.session.user.email);
            }
          } catch (e) {
            console.warn('Recuperação de sessão transiente:', e);
          }
        }
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificação de Rate Limit / Brute Force Protection
    const rateLimit = checkLoginRateLimit(cleanEmail);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Acesso temporariamente bloqueado por excesso de tentativas. Aguarde ${rateLimit.remainingSeconds} segundos.`,
        remainingSeconds: rateLimit.remainingSeconds
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const failureResult = recordFailedLogin(cleanEmail);
        if (failureResult.locked) {
          return {
            success: false,
            error: `Conta temporariamente bloqueada por 5 minutos após ${5} tentativas incorretas.`,
            remainingSeconds: failureResult.remainingSeconds
          };
        }
        throw error;
      }

      if (data.session?.user) {
        setSession(data.session);
        await fetchProfile(data.session.user.id, data.session.user.email);
      }

      // Login bem-sucedido -> limpa tentativas registradas
      clearLoginAttempts(cleanEmail);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Credenciais inválidas' };
    }
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    isExplicitLogoutRef.current = true;
    try {
      await supabase.auth.signOut();
    } catch {}
    setCurrentUser(null);
    setSession(null);
    try { localStorage.removeItem(CACHED_USER_KEY); } catch {}
    isExplicitLogoutRef.current = false;
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  }, []);

  const addNotification = useCallback((mensagem: string, tipo: 'info' | 'sucesso' | 'alerta' | 'lead' | 'solicitacao' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif = {
      id,
      tipo,
      mensagem,
      dataHora: new Date().toISOString(),
      lida: false,
      isNew: true
    } as Notification & { isNew?: boolean };

    setNotifications(prev => [newNotif, ...prev]);

    setTimeout(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isNew: false } : n));
    }, 6000);
  }, []);

  const logAudit = useCallback(async (_action: string, _description: string) => {
    // Sistema de auditoria desativado para otimizar recursos do Supabase
    return;
  }, []);

  const unreadCount = notifications.filter(n => !n.lida).length;

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        resolve
      });
    });
  }, []);

  const handleConfirmResponse = useCallback((response: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(response);
    }
    setConfirmState({
      isOpen: false,
      message: '',
      resolve: null
    });
  }, [confirmState]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!session || !!currentUser,
      isLoading,
      sidebarOpen,
      notifications,
      login,
      logout,
      toggleSidebar,
      markNotificationRead,
      unreadCount,
      logAudit,
      addNotification,
      authUserEmail: session?.user?.email || currentUser?.email || null,
      showConfirm
    }}>
      {children}
      {confirmState.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'confirmFadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '2rem',
            width: '90%',
            maxWidth: '420px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            border: '1px solid #f1f5f9',
            animation: 'confirmScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#fef2f2',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.5rem auto',
              color: '#dc2626',
              fontSize: '1.8rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)'
            }}>
              ⚠️
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.2rem', fontWeight: 900 }}>Confirmar Ação</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 }}>
                {confirmState.message}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => handleConfirmResponse(false)}
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmResponse(true)}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
                onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
              >
                Confirmar
              </button>
            </div>
          </div>
          <style>{`
            @keyframes confirmFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes confirmScaleIn {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
