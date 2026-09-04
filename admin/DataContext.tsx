import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { useAuth } from './AuthContext';
import type { LoanRequest, Customer, FinanceEntry, Machine, Bank } from './types';
import { calculateLoanFinancials, fetchRatesFromDatabase, TABELA_1_RATES, TABELA_2_RATES } from '../lib/rates';

// =========================================================================
// TIPOS DO CONTEXTO DE DADOS EM TEMPO REAL
// =========================================================================

export interface DashboardStats {
  totalPIX: number;
  totalProfit: number;
  totalGrossProfit: number;
  totalApproved: number;
  totalCommission: number;
  totalMachineFees: number;
  averageTicket: number;
  activeOperations: number;
  availableCash: number;
  pendingReceivables: number;
  conversionRate: number;
  averageInterestRate: number;
  pendingOperationsCount: number;
}

export interface DataContextType {
  loans: LoanRequest[];
  customers: Customer[];
  finance: FinanceEntry[];
  machines: Machine[];
  banks: Bank[];
  ratesT1: Record<string, Record<number, number>>;
  ratesT2: Record<string, Record<number, number>>;
  loading: boolean;
  isRevalidating: boolean;
  lastSync: Date | null;
  revalidateAll: (isSilent?: boolean) => Promise<void>;
  dashboardStats: DashboardStats;
}

const DataContext = createContext<DataContextType | null>(null);

// =========================================================================
// DATA PROVIDER
// =========================================================================

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, authUserEmail } = useAuth();
  const isSuperAdmin = authUserEmail?.toLowerCase().startsWith('admin@') || 
                       currentUser?.email?.toLowerCase() === 'caique@cmcred.com.br' ||
                       currentUser?.perfil === 'admin';

  // Estados em memória (nunca dependentes de snapshot obsoleto de localStorage/sessionStorage)
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [finance, setFinance] = useState<FinanceEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [ratesT1, setRatesT1] = useState<Record<string, Record<number, number>>>(TABELA_1_RATES);
  const [ratesT2, setRatesT2] = useState<Record<string, Record<number, number>>>(TABELA_2_RATES);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Referências para evitar perda de dados por closure ou condições de corrida
  const hasLoadedOnceRef = useRef<boolean>(false);
  const currentLoansRef = useRef<LoanRequest[]>([]);
  const currentFinanceRef = useRef<FinanceEntry[]>([]);
  const currentCustomersRef = useRef<Customer[]>([]);

  useEffect(() => {
    currentLoansRef.current = loans;
  }, [loans]);

  useEffect(() => {
    currentFinanceRef.current = finance;
  }, [finance]);

  useEffect(() => {
    currentCustomersRef.current = customers;
  }, [customers]);

  // =======================================================================
  // REVALIDAÇÃO TOTAL COM PROTEÇÃO ANTI-ZERAMENTO
  // =======================================================================
  const revalidateAll = useCallback(async (isSilent = false) => {
    if (!hasLoadedOnceRef.current && !isSilent) {
      setLoading(true);
    } else {
      setIsRevalidating(true);
    }

    try {
      // 1. Garante que a sessão do Supabase está ativa e com token válido antes de requisitar
      const { data: sessionData } = await supabase.auth.getSession();
      const activeSession = sessionData?.session;
      
      // Se o token estiver perto de expirar, renova silenciosamente
      if (activeSession?.expires_at) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (activeSession.expires_at - nowSec < 300) {
          await supabase.auth.refreshSession();
        }
      }

      // 2. Dispara consultas paralelas de dados
      const loansQuery = supabase
        .from('loans')
        .select('*, leads(name, phone), customers(name, phone), banks(name), machines(name, fee_percentage, installment_fees, liquidation_days), profiles:consultant_id(full_name)')
        .order('created_at', { ascending: false });

      const [loansRes, custRes, finRes, machRes, banksRes, ratesRes] = await Promise.all([
        loansQuery,
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('finance').select('*').order('due_date', { ascending: false }),
        supabase.from('machines').select('*, banks(name)').order('name', { ascending: true }),
        supabase.from('banks').select('*').order('name', { ascending: true }),
        fetchRatesFromDatabase()
      ]);

      let rawLoans = loansRes.data || [];
      let rawFinance = finRes.data || [];
      let rawCustomers = custRes.data || [];

      // Fallback com supabaseAdmin para evitar RLS temporário ao acordar a aba
      if (rawLoans.length === 0 && (isSuperAdmin || !currentUser?.id)) {
        try {
          const adminLoans = await supabaseAdmin
            .from('loans')
            .select('*, leads(name, phone), customers(name, phone), banks(name), machines(name, fee_percentage, installment_fees, liquidation_days), profiles:consultant_id(full_name)')
            .order('created_at', { ascending: false });
          if (adminLoans.data && adminLoans.data.length > 0) {
            rawLoans = adminLoans.data;
          }
        } catch {}
      }

      // ===================================================================
      // REGRA DE OURO DA PERSISTÊNCIA:
      // Se a resposta vier vazia por causa de falha de conexão/token durante o wake-up,
      // NUNCA zere os dados se já tínhamos dados válidos carregados na memória!
      // ===================================================================
      if (rawLoans.length > 0 || !hasLoadedOnceRef.current) {
        const mappedLoans = rawLoans.map((l: any) => ({
          ...l,
          lead_name: l.customers?.name || l.leads?.name || 'Cliente Identificado',
          lead_phone: l.customers?.phone || l.leads?.phone || '',
          bank_name: l.banks?.name || 'Banco Geral',
          machine_name: l.machines?.name || 'Stone Smart POS',
          consultant_name: l.profiles?.full_name || 'Operação Direta / Admin'
        }));
        setLoans(mappedLoans);
      }

      if (rawFinance.length > 0 || !hasLoadedOnceRef.current) {
        setFinance(rawFinance);
      }

      if (rawCustomers.length > 0 || !hasLoadedOnceRef.current) {
        setCustomers(rawCustomers);
      }

      if (machRes.data && (machRes.data.length > 0 || !hasLoadedOnceRef.current)) {
        setMachines(machRes.data);
      }

      if (banksRes.data && (banksRes.data.length > 0 || !hasLoadedOnceRef.current)) {
        setBanks(banksRes.data);
      }

      if (ratesRes.ratesT1 && Object.keys(ratesRes.ratesT1).length > 0) {
        setRatesT1(ratesRes.ratesT1);
      }
      if (ratesRes.ratesT2 && Object.keys(ratesRes.ratesT2).length > 0) {
        setRatesT2(ratesRes.ratesT2);
      }

      hasLoadedOnceRef.current = true;
      setLastSync(new Date());
    } catch (err) {
      console.error('Erro na sincronização de dados:', err);
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, [isSuperAdmin, currentUser?.id]);

  // =======================================================================
  // 1. REVALIDAÇÃO NO RETORNO À ABA (visibilitychange & window.focus)
  // =======================================================================
  useEffect(() => {
    revalidateAll(false);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // Quando o usuário volta para a aba, revalida silenciosamente no background sem piscar a tela
        revalidateAll(true);
      }
    };

    const handleFocus = () => {
      revalidateAll(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [revalidateAll]);

  // =======================================================================
  // 2. SUPABASE REALTIME SUBSCRIPTIONS (INSERT, UPDATE, DELETE)
  // =======================================================================
  useEffect(() => {
    const channel = supabase
      .channel('cmcred-global-realtime-sync')
      // Tabela: loans
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setLoans(prev => prev.filter(l => l.id !== payload.old.id));
          } else {
            // Em INSERT ou UPDATE, revalida suavemente para carregar os joins de leads/customers/banks
            revalidateAll(true);
          }
        }
      )
      // Tabela: finance
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setFinance(prev => [payload.new as FinanceEntry, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setFinance(prev => prev.map(f => f.id === payload.new.id ? { ...f, ...payload.new } : f));
          } else if (payload.eventType === 'DELETE') {
            setFinance(prev => prev.filter(f => f.id !== payload.old.id));
          }
        }
      )
      // Tabela: customers
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCustomers(prev => [payload.new as Customer, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setCustomers(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
          } else if (payload.eventType === 'DELETE') {
            setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      // Tabela: machines
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        () => {
          revalidateAll(true);
        }
      )
      // Tabela: simulator_rates
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'simulator_rates' },
        () => {
          revalidateAll(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [revalidateAll]);

  // =======================================================================
  // 3. CÁLCULO DAS MÉTRICAS DO DASHBOARD EM TEMPO REAL
  // =======================================================================
  const dashboardStats = useMemo<DashboardStats>(() => {
    let totalPIX = 0;
    let totalApproved = 0;
    let totalProfit = 0;
    let totalGrossProfit = 0;
    let totalCommission = 0;
    let totalMachineFees = 0;

    loans.forEach(l => {
      const fin = calculateLoanFinancials(l);
      totalPIX += fin.netAmount;
      totalApproved += fin.grossAmount;
      totalGrossProfit += fin.operationProfit;
      totalMachineFees += fin.machineFeeAmount;
      totalCommission += fin.commissionAmount;
      totalProfit += fin.companyNetProfit;
    });

    let availableCash = 0;
    let pendingReceivables = 0;
    finance.forEach(f => {
      const amount = Number(f.amount) || 0;
      if (f.status === 'paid') {
        if (f.type === 'receivable') availableCash += amount;
        if (f.type === 'payable') availableCash -= amount;
      }
      if (f.status === 'pending' && f.type === 'receivable') {
        pendingReceivables += amount;
      }
    });

    const averageTicket = totalPIX / (loans.length || 1);
    const averageInterestRate = loans.reduce((acc, l) => acc + (Number(l.interest_rate) || 0), 0) / (loans.length || 1);
    const pendingOperationsCount = loans.filter(l => l.status === 'pending' || l.status === 'in analysis').length;
    const conversionRate = customers.length > 0 ? (loans.length / customers.length) * 100 : 100;

    return {
      totalPIX: Number(totalPIX.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      totalGrossProfit: Number(totalGrossProfit.toFixed(2)),
      totalApproved: Number(totalApproved.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      totalMachineFees: Number(totalMachineFees.toFixed(2)),
      averageTicket: Number(averageTicket.toFixed(2)),
      activeOperations: loans.length,
      availableCash: Number(availableCash.toFixed(2)),
      pendingReceivables: Number(pendingReceivables.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(1)),
      averageInterestRate: Number(averageInterestRate.toFixed(2)),
      pendingOperationsCount
    };
  }, [loans, finance, customers]);

  const value = useMemo(() => ({
    loans,
    customers,
    finance,
    machines,
    banks,
    ratesT1,
    ratesT2,
    loading,
    isRevalidating,
    lastSync,
    revalidateAll,
    dashboardStats
  }), [
    loans, customers, finance, machines, banks, ratesT1, ratesT2,
    loading, isRevalidating, lastSync, revalidateAll, dashboardStats
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// =========================================================================
// HOOKS CUSTOMIZADOS (ITEM 4 DO USUÁRIO)
// =========================================================================

/**
 * Hook principal para acessar dados em tempo real da aplicação
 */
export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData deve ser utilizado dentro de um DataProvider');
  }
  return ctx;
}

/**
 * Hook Exemplo 1: Manter a Sessão Supabase Ativa
 * Configura getSession, onAuthStateChange e revalidação no visibilitychange
 */
export function useKeepSessionAlive() {
  const [session, setSession] = useState<any>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    // 1. Obter sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setIsChecking(false);
      }
    });

    // 2. Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setIsChecking(false);
      }
    });

    // 3. Revalidar / Renovar sessão ao voltar para a aba
    const onVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && mounted) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setSession(data.session);
          // Renova se estiver a menos de 5 min da expiração
          const expiresAt = data.session.expires_at || 0;
          if (expiresAt - Math.floor(Date.now() / 1000) < 300) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session) setSession(refreshed.session);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, []);

  return { session, isChecking };
}

/**
 * Hook Exemplo 2: Atualizar Dados em Tempo Real sem Depender de LocalStorage
 * Escuta INSERT, UPDATE e DELETE do Postgres diretamente em memória
 */
export function useRealtimeCollection<T extends { id: string | number }>(
  tableName: string,
  initialQuery?: () => Promise<T[]>
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const hasLoadedRef = useRef<boolean>(false);

  const fetchItems = useCallback(async () => {
    try {
      if (initialQuery) {
        const res = await initialQuery();
        if (res && (res.length > 0 || !hasLoadedRef.current)) {
          setItems(res);
        }
      } else {
        const { data } = await supabase.from(tableName).select('*').order('created_at', { ascending: false });
        if (data && (data.length > 0 || !hasLoadedRef.current)) {
          setItems(data as unknown as T[]);
        }
      }
      hasLoadedRef.current = true;
    } catch (e) {
      console.warn(`Erro ao carregar ${tableName}:`, e);
    } finally {
      setLoading(false);
    }
  }, [tableName, initialQuery]);

  useEffect(() => {
    fetchItems();

    // Supabase Realtime Channel para a tabela
    const channel = supabase
      .channel(`realtime-${tableName}-hook`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: tableName },
        (payload) => {
          setItems(prev => [payload.new as T, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: tableName },
        (payload) => {
          setItems(prev => prev.map(item => item.id === (payload.new as T).id ? (payload.new as T) : item));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: tableName },
        (payload) => {
          setItems(prev => prev.filter(item => item.id !== (payload.old as T).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, fetchItems]);

  return { items, setItems, loading, refetch: fetchItems };
}

/**
 * Hook Exemplo 3: Revalidar Dados ao Voltar para a Aba (visibilitychange)
 */
export function useVisibilityRevalidate(onVisible: () => void | Promise<void>) {
  const callbackRef = useRef(onVisible);
  useEffect(() => {
    callbackRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);
}
