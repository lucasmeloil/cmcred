import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Landmark,
  Smartphone,
  Activity,
  PiggyBank,
  Clock,
  Award,
  Layers,
  ShieldAlert,
  Percent,
  PercentIcon
} from 'lucide-react';
import { calculateLoanFinancials } from '../lib/rates';
import { useAuth } from './AuthContext';
import { useAutoRefresh } from '../lib/useAutoRefresh';

const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color?: string; trendType?: 'up' | 'down' | 'neutral'; trendText?: string;
}> = ({ icon, label, value, sub, color = '#d97706', trendType, trendText }) => (
  <div style={{
    background: '#ffffff',
    border: `1px solid #f1f5f9`,
    borderRadius: '24px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)',
    transition: 'all 0.2s ease-in-out',
    position: 'relative',
    overflow: 'hidden'
  }} className="dashboard-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{
        width: '48px', height: '48px',
        borderRadius: '16px',
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color
      }}>
        {icon}
      </div>
      {trendType && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          fontSize: '0.75rem', fontWeight: 800,
          color: trendType === 'up' ? '#d97706' : '#ef4444',
          background: trendType === 'up' ? '#fffbeb' : '#fef2f2',
          padding: '0.25rem 0.6rem', borderRadius: '20px'
        }}>
          {trendType === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendText}
        </span>
      )}
    </div>
    <div>
      <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ color: '#0f172a', fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.25rem', fontWeight: 600 }}>{sub}</div>}
    </div>
  </div>
);

const MetricPill: React.FC<{
  label: string; value: string | number; subValue?: string; color?: string; icon?: React.ReactNode;
}> = ({ label, value, subValue, color = '#d97706', icon }) => (
  <div style={{
    background: '#ffffff',
    border: '1px solid #f1f5f9',
    borderRadius: '20px',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
  }}>
    <div style={{
      width: '40px', height: '40px',
      background: `${color}08`, color: color, borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0
    }}>{icon}</div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 900, marginTop: '0.15rem' }}>{value}</div>
    </div>
    {subValue && (
      <div style={{ textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', background: '#f8fafc', padding: '4px 8px', borderRadius: '8px' }}>
        {subValue}
      </div>
    )}
  </div>
);

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const email = (currentUser?.email || '').toLowerCase();
  const isAdmin = email === 'caique@cmcred.com.br' || 
                  email.startsWith('admin@') || 
                  currentUser?.perfil === 'admin';
  const isConsultant = !isAdmin && (currentUser?.perfil === 'consultant' || currentUser?.perfil === 'operator');

  const [stats, setStats] = useState({
    totalPIX: 0,
    totalProfit: 0,
    totalGrossProfit: 0,
    totalApproved: 0,
    totalCommission: 0,
    totalMachineFees: 0,
    averageTicket: 0,
    activeOperations: 0,
    availableCash: 0,
    pendingReceivables: 0,
    conversionRate: 0,
    averageInterestRate: 0,
    pendingOperationsCount: 0,
    bankStats: [] as { name: string; value: number }[],
    machineStats: [] as { name: string; value: number }[],
    installmentStats: [] as { name: string; value: number }[],
    consultantStats: [] as { name: string; count: number; volume: number; profit: number }[],
    evolutionStats: [] as { date: string; volume: number; lucro: number }[],
    monthlyStats: [] as { key: string; month: string; volume: number; faturamento: number; lucro: number; count: number }[]
  });
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vendas' | 'operacoes'>('vendas');
  const hasLoadedOnceRef = useRef(false);

  const myOperations = useMemo(() => {
    return recentLoans.filter(l => {
      if (!currentUser) return false;
      if (currentUser.id && l.consultant_id === currentUser.id) return true;
      const currentUserName = (currentUser.nome || currentUser.full_name || '').trim().toLowerCase();
      if (currentUserName && l.consultant_name && l.consultant_name.trim().toLowerCase() === currentUserName) return true;
      return false;
    });
  }, [recentLoans, currentUser]);

  const fetchData = async (isSilent = false) => {
    if (!hasLoadedOnceRef.current && !isSilent) {
      setLoading(true);
    }
    try {
      // Carrega todas as operações da empresa (feitas pelo consultor, outros consultores e admin)
      let loansQuery = supabase.from('loans').select('*, leads(name), customers(name), banks(name), machines(name, fee_percentage, installment_fees), profiles:consultant_id(full_name)').order('created_at', { ascending: false });

      const [loansRes, leadsRes, customersRes, financeRes] = await Promise.all([
        loansQuery,
        supabase.from('leads').select('count', { count: 'exact' }),
        supabase.from('customers').select('count', { count: 'exact' }),
        supabase.from('finance').select('*')
      ]);

      let loans = loansRes.data || [];
      let finance = financeRes.data || [];

      // Fallback resiliente caso a consulta padrão sofra atraso de sincronização de token
      if (loans.length === 0 && (isAdmin || !currentUser?.id)) {
        try {
          const fallbackRes = await supabaseAdmin.from('loans').select('*, leads(name), customers(name), banks(name), machines(name, fee_percentage, installment_fees), profiles:consultant_id(full_name)').order('created_at', { ascending: false });
          if (fallbackRes.data && fallbackRes.data.length > 0) {
            loans = fallbackRes.data;
          }
        } catch {}
      }

      // Se houver erro na revalidação de background, não sobrescreve os dados existentes com zero
      if (loansRes.error) {
        console.warn('Aviso ao consultar loans no dashboard:', loansRes.error.message);
        if (hasLoadedOnceRef.current) return;
      }
      if (loans.length === 0 && hasLoadedOnceRef.current && recentLoans.length > 0 && isSilent) {
        return;
      }

      const mappedRecent = loans.map((l: any) => ({
        ...l,
        clienteNome: l.leads?.name || l.customers?.name || 'Cliente Portador',
        consultant_name: l.profiles?.full_name || 'Operação Direta / Admin'
      }));
      setRecentLoans(mappedRecent);

      let totalPIX = 0;
      let totalApproved = 0;
      let totalProfit = 0; // Lucro Líquido Real que SOBRA para a CM CRED
      let totalGrossProfit = 0; // Juros Brutos da Operação
      let totalCommission = 0;
      let totalMachineFees = 0;

      loans.forEach(l => {
        const fin = calculateLoanFinancials(l);
        totalPIX += fin.netAmount;
        totalApproved += fin.grossAmount;
        totalGrossProfit += fin.operationProfit;
        if (isAdmin || l.consultant_id === currentUser?.id) {
          totalCommission += fin.commissionAmount;
        }
        totalMachineFees += fin.machineFeeAmount;
        totalProfit += fin.companyNetProfit;
      });

      totalProfit = Number(totalProfit.toFixed(2));
      totalGrossProfit = Number(totalGrossProfit.toFixed(2));
      totalMachineFees = Number(totalMachineFees.toFixed(2));
      totalCommission = Number(totalCommission.toFixed(2));

      // Ticket Médio
      const averageTicket = totalPIX / (loans.length || 1);

      // Caixa disponível e contas a receber
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

      // Mapas de adquirentes e bancos
      const bankMap: Record<string, number> = {};
      const machineMap: Record<string, number> = {};
      loans.forEach(l => {
        const bName = l.banks?.name || 'Não Informado';
        const mName = l.machines?.name || 'Stone Smart POS';
        bankMap[bName] = (bankMap[bName] || 0) + (Number(l.requested_amount) || 0);
        machineMap[mName] = (machineMap[mName] || 0) + (Number(l.requested_amount) || 0);
      });

      // Taxas operacionais
      const totalLeads = (leadsRes.count || 0) + (customersRes.count || 0);
      const conversionRate = (loans.length / (totalLeads || 1)) * 100;
      const averageInterestRate = loans.reduce((acc, l) => acc + (Number(l.interest_rate) || 0), 0) / (loans.length || 1);
      const pendingOperationsCount = loans.filter(l => l.status === 'pending' || l.status === 'in analysis').length;

      // Preferência de Parcelamento (Agrupado por termos do negócio)
      const installmentGroups = {
        '1x (À vista)': 0,
        '2x a 6x': 0,
        '7x a 12x': 0,
        '13x a 18x': 0
      };
      loans.forEach(l => {
        const inst = Number(l.installments) || 1;
        if (inst === 1) installmentGroups['1x (À vista)'] += Number(l.requested_amount || 0);
        else if (inst >= 2 && inst <= 6) installmentGroups['2x a 6x'] += Number(l.requested_amount || 0);
        else if (inst >= 7 && inst <= 12) installmentGroups['7x a 12x'] += Number(l.requested_amount || 0);
        else if (inst >= 13 && inst <= 18) installmentGroups['13x a 18x'] += Number(l.requested_amount || 0);
      });
      const installmentStats = Object.entries(installmentGroups).map(([name, value]) => ({ name, value }));

      // Rankings de Consultores / Operadores
      const consultantMap: Record<string, { name: string; count: number; volume: number; profit: number }> = {};
      loans.forEach(l => {
        const name = l.profiles?.full_name || 'Operação Direta / Admin';
        const fin = calculateLoanFinancials(l);

        if (!consultantMap[name]) {
          consultantMap[name] = { name, count: 0, volume: 0, profit: 0 };
        }
        consultantMap[name].count += 1;
        consultantMap[name].volume += fin.netAmount;
        consultantMap[name].profit += fin.companyNetProfit;
      });
      const consultantStats = Object.values(consultantMap).sort((a, b) => b.profit - a.profit).slice(0, 5);

      // Evolução Operacional (Faturamento Bruto vs Lucro CM CRED - Últimos Dias)
      const dailyMap: Record<string, { date: string; volume: number; lucro: number }> = {};
      loans.forEach(l => {
        const date = new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const fin = calculateLoanFinancials(l);

        if (!dailyMap[date]) {
          dailyMap[date] = { date, volume: 0, lucro: 0 };
        }
        dailyMap[date].volume += fin.netAmount;
        dailyMap[date].lucro += fin.companyNetProfit;
      });
      const evolutionStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);

      // Evolução dos Últimos 12 Meses (Histórico Anual)
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const now = new Date();
      const last12Months: Array<{ key: string; month: string; volume: number; faturamento: number; lucro: number; count: number }> = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
        last12Months.push({
          key,
          month: label,
          volume: 0,
          faturamento: 0,
          lucro: 0,
          count: 0
        });
      }

      loans.forEach(l => {
        const d = new Date(l.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const target = last12Months.find(m => m.key === key);
        if (target) {
          const fin = calculateLoanFinancials(l);
          target.volume += fin.netAmount;
          target.faturamento += fin.grossAmount;
          target.lucro += fin.companyNetProfit;
          target.count += 1;
        }
      });

      // Métricas pessoais do consultor logado
      let myPIX = 0;
      let myApproved = 0;
      let myCommission = 0;
      let myOperationsCount = 0;

      const currentUserName = (currentUser?.nome || currentUser?.full_name || '').trim().toLowerCase();

      loans.forEach(l => {
        const isMine = (currentUser?.id && l.consultant_id === currentUser.id) ||
                       (currentUserName && l.profiles?.full_name && l.profiles.full_name.trim().toLowerCase() === currentUserName) ||
                       (currentUserName && l.consultant_name && l.consultant_name.trim().toLowerCase() === currentUserName);
        if (isMine) {
          const fin = calculateLoanFinancials(l);
          myPIX += fin.netAmount;
          myApproved += fin.grossAmount;
          myCommission += fin.commissionAmount;
          myOperationsCount++;
        }
      });
      const myAverageTicket = myOperationsCount > 0 ? (myPIX / myOperationsCount) : 0;

      const computedStats = {
        totalPIX,
        totalProfit,
        totalGrossProfit,
        totalApproved,
        totalCommission: isConsultant ? myCommission : totalCommission,
        totalMachineFees,
        averageTicket,
        activeOperations: loans.length,
        availableCash,
        pendingReceivables,
        conversionRate,
        averageInterestRate,
        pendingOperationsCount,
        bankStats: Object.entries(bankMap).map(([name, value]) => ({ name, value })),
        machineStats: Object.entries(machineMap).map(([name, value]) => ({ name, value })),
        installmentStats,
        consultantStats,
        evolutionStats,
        monthlyStats: last12Months
      };
      setStats(computedStats);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Erro ao processar dados estratégicos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1000);

    fetchData();

    // Sincronização em tempo real via Supabase Realtime Channels (loans, finance, customers)
    const channel = supabase
      .channel('dashboard-realtime-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          fetchData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance' },
        () => {
          fetchData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchData(true);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, isConsultant, currentUser?.id, currentUser?.email]);

  // Atualização automática dos dados a cada 30 segundos e ao alternar de aba (sem F5)
  useAutoRefresh(fetchData, 30000);

  const COLORS = ['#d97706', '#2563eb', '#f59e0b', '#7c3aed', '#ec4899', '#06b6d4'];
  const GRADIENT_COLORS = ['#d97706', '#f59e0b', '#b45309', '#8b5cf6'];

  if (loading) {
    return (
      <div style={{
        padding: '5rem 2rem',
        color: '#d97706',
        textAlign: 'center',
        fontWeight: 800,
        background: '#f8fafc',
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        letterSpacing: '2px'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '4px solid #fde68a',
          borderTopColor: '#d97706',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ textTransform: 'uppercase', fontSize: '0.9rem', color: '#b45309', fontWeight: 900 }}>
          Sincronizando Painel Estratégico CM CRED...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Strategic Dashboard Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.75px' }}>
            Painel Estratégico Real-Time
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.35rem', fontWeight: 600 }}>
            Auditoria estratégica do fluxo de troca de limite de cartão por dinheiro.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '6px 14px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800 }}>
          <span style={{ width: '8px', height: '8px', background: '#d97706', borderRadius: '50%', display: 'inline-block', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
          SISTEMA ONLINE & AUDITADO
        </div>
      </header>

      {/* Abas Personalizadas para Perfil Consultor */}
      {isConsultant && (
        <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('vendas')}
            style={{
              background: activeTab === 'vendas' ? '#d97706' : '#f8fafc',
              color: activeTab === 'vendas' ? '#ffffff' : '#64748b',
              border: '1px solid',
              borderColor: activeTab === 'vendas' ? '#d97706' : '#cbd5e1',
              padding: '0.75rem 1.4rem',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'vendas' ? '0 4px 12px rgba(217,119,6,0.25)' : 'none'
            }}
          >
            <CreditCard size={18} /> Aba Vendas & Produção
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operacoes')}
            style={{
              background: activeTab === 'operacoes' ? '#0f172a' : '#f8fafc',
              color: activeTab === 'operacoes' ? '#ffffff' : '#64748b',
              border: '1px solid',
              borderColor: activeTab === 'operacoes' ? '#0f172a' : '#cbd5e1',
              padding: '0.75rem 1.4rem',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'operacoes' ? '0 4px 12px rgba(15,23,42,0.25)' : 'none'
            }}
          >
            <Layers size={18} /> Minhas Operações Realizadas ({myOperations.length})
          </button>
        </div>
      )}

      {/* Primary Financial KPIs (Aba Vendas para Consultor ou Visão Completa para Admin) */}
      {(isAdmin || activeTab === 'vendas') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {isAdmin ? (
            <>
              <StatCard 
                icon={<CreditCard size={20} />} 
                label="Passagem Bruta (Cartão)" 
                value={`R$ ${stats.totalApproved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Volume bruto passado na rede" 
                color="#3b82f6" 
                trendType="up"
                trendText="Vendas" 
              />
              <StatCard 
                icon={<TrendingDown size={20} />} 
                label="Repasses Realizados (PIX)" 
                value={`R$ ${stats.totalPIX.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Líquido transferido aos clientes" 
                color="#ef4444" 
                trendType="down"
                trendText="Saída Caixa" 
              />
              <StatCard 
                icon={<TrendingUp size={20} />} 
                label="Ganhos Brutos (Juros)" 
                value={`R$ ${stats.totalGrossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Diferença Bruta (Cartão - PIX)" 
                color="#10b981" 
                trendType="up"
                trendText="Spread Bruto" 
              />
              <StatCard 
                icon={<Landmark size={20} />} 
                label="Custo de Taxas MDR" 
                value={`- R$ ${stats.totalMachineFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Taxas retidas pelas adquirentes" 
                color="#dc2626" 
                trendType="neutral"
                trendText="Intercâmbio" 
              />
              <StatCard 
                icon={<DollarSign size={20} />} 
                label="Lucro Real CM CRED" 
                value={`R$ ${stats.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Lucro líquido retido na empresa" 
                color="#d97706" 
                trendType="up"
                trendText="Lucro Líquido" 
              />
            </>
          ) : (
            <>
              <StatCard 
                icon={<CreditCard size={20} />} 
                label="Meu Volume Bruto (Cartão)" 
                value={`R$ ${stats.totalApproved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Valores totais de empréstimos passados no cartão" 
                color="#3b82f6" 
                trendType="down"
                trendText="Saída Caixa" 
              />
              <StatCard 
                icon={<TrendingDown size={20} />} 
                label="Meus Repasses PIX" 
                value={`R$ ${stats.totalPIX.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Líquido liberado a seus clientes" 
                color="#ef4444" 
                trendType="up"
                trendText="Produção" 
              />
              <StatCard 
                icon={<Layers size={20} />} 
                label="Minhas Operações" 
                value={`${stats.activeOperations} ops`} 
                sub="Contratos concluídos" 
                color="#059669" 
                trendType="neutral"
                trendText="Média" 
              />
              <StatCard 
                icon={<Activity size={20} />} 
                label="Ticket Médio" 
                value={`R$ ${stats.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                sub="Média por operação e valores totais realizados" 
                color="#0ea5e9" 
                trendType="neutral"
                trendText="Média" 
              />
              {Number(currentUser?.commission_percentage || 0) > 0 && (
                <StatCard 
                  icon={<Award size={20} />} 
                  label="Minha Comissão Gerada" 
                  value={`R$ ${stats.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                  sub="Comissão acumulada na sua produção" 
                  color="#f59e0b" 
                  trendType="up"
                  trendText="Comissão" 
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Secondary Operational Efficiency metrics - Exclusivo Admin */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          <MetricPill 
            label="Taxa de Conversão" 
            value={`${stats.conversionRate.toFixed(1)}%`} 
            subValue="Leads p/ Venda"
            color="#0ea5e9"
            icon={<Activity size={18} />}
          />
          <MetricPill 
            label="Juros Médio Praticado" 
            value={`${stats.averageInterestRate.toFixed(1)}%`} 
            subValue="Margem CM CRED"
            color="#10b981"
            icon={<Percent size={18} />}
          />
          <MetricPill 
            label="Operações em Auditoria" 
            value={stats.pendingOperationsCount} 
            subValue="Aguardando liberação"
            color={stats.pendingOperationsCount > 0 ? '#ef4444' : '#64748b'}
            icon={<ShieldAlert size={18} />}
          />
          <MetricPill 
            label="Capital de Giro Disponível" 
            value={`R$ ${stats.availableCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
            subValue="Liquidez Imediata"
            color="#10b981"
            icon={<PiggyBank size={18} />}
          />
        </div>
      )}

      {/* Seção Vendas: Gráficos e Feed Operacional */}
      {(isAdmin || activeTab === 'vendas') && (
        <>
          {/* 12-Month Loan Evolution Bar Chart (Full Width Spotlight) */}
          <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.3px' }}>
                  Evolução de Empréstimos — Histórico dos Últimos 12 Meses
                </h3>
                <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                  Volume mensal de empréstimos concedidos (PIX) vs Faturamento Bruto de Cartão
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Pills for 12 Months */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem 0.9rem', textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Volume 12M (PIX)</div>
              <div style={{ fontSize: '0.95rem', color: '#d97706', fontWeight: 900 }}>
                R$ {(stats.monthlyStats || []).reduce((acc, m) => acc + m.volume, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem 0.9rem', textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Bruto Cartão 12M</div>
              <div style={{ fontSize: '0.95rem', color: '#2563eb', fontWeight: 900 }}>
                R$ {(stats.monthlyStats || []).reduce((acc, m) => acc + m.faturamento, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            {isAdmin && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem 0.9rem', textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Lucro Acumulado</div>
                <div style={{ fontSize: '0.95rem', color: '#d97706', fontWeight: 900 }}>
                  R$ {(stats.monthlyStats || []).reduce((acc, m) => acc + m.lucro, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem 0.9rem', textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Contratos Realizados</div>
              <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 900 }}>
                {(stats.monthlyStats || []).reduce((acc, m) => acc + m.count, 0)} ops
              </div>
            </div>
          </div>
        </div>

        {/* 12-Month Bar Chart */}
        <div style={{ height: '360px', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={stats.monthlyStats || []} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 800 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
              <Tooltip 
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 700, padding: '12px 16px' }}
                formatter={(val: number, name: string) => [
                  `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name
                ]}
                labelFormatter={(label) => `Mês de Referência: ${label}`}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontWeight: 700, fontSize: '0.85rem' }} />
              <Bar dataKey="faturamento" name="Bruto Passado no Cartão (R$)" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={30} />
              <Bar dataKey="volume" name="Valor Líquido Empréstimo / PIX (R$)" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={30} />
              {isAdmin && (
                <Bar dataKey="lucro" name="Lucro CM CRED (R$)" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={30} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Advanced Analytic Charts (First Row) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
        
        {/* Faturamento vs Margem Líquida */}
        <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <Activity size={18} color="#d97706" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>
              {isAdmin ? "Evolução de Fluxo: Repasse (Caixa) vs Lucro Real" : "Evolução de Fluxo de Repasses (PIX)"}
            </h3>
          </div>
          <div style={{ height: '320px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={stats.evolutionStats} margin={{ left: 10, right: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLucroReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontWeight: 700 }}
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`]}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '15px', fontWeight: 700, fontSize: '0.8rem'}} />
                <Area type="monotone" dataKey="volume" name="Faturamento (PIX)" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                {isAdmin && (
                  <Area type="monotone" dataKey="lucro" name="Lucro CM CRED" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLucroReal)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Parcelamento */}
        <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <Layers size={18} color="#d97706" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Liquidez: Preferência de Termos (Parcelas)</h3>
          </div>
          <div style={{ height: '320px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.installmentStats} margin={{ bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 800}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontWeight: 700 }}
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`, 'Total Repassado']}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={42}>
                  {stats.installmentStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GRADIENT_COLORS[index % GRADIENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Machine Performance and Liquidity Distribution (Second Row) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
        
        {/* Acquirer Machine Performance */}
        <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <Smartphone size={18} color="#d97706" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Performance Financeira por Maquininha</h3>
          </div>
          <div style={{ height: '300px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.machineStats} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={110} fontWeight={800} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontWeight: 700 }}
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`, 'Volume Passado']}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={18}>
                  {stats.machineStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Banking Distribution */}
        <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <Landmark size={18} color="#d97706" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Destino da Liquidez por Instituição Bancária</h3>
          </div>
          <div style={{ height: '300px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={stats.bankStats}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  labelLine={false}
                  stroke="none"
                >
                  {stats.bankStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontWeight: 700 }} formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`]} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '10px', fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Leaderboard and Conciliation Feed (Double Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Leaderboard Section */}
        <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <Award size={18} color="#d97706" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Ranking de Performance</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
            {stats.consultantStats.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhum consultor registrado no período.</div>
            ) : stats.consultantStats.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div style={{ 
                  width: '32px', height: '32px', 
                  background: i === 0 ? '#fef3c7' : (i === 1 ? '#e2e8f0' : '#f8fafc'), 
                  border: `1px solid ${i === 0 ? '#fcd34d' : '#e2e8f0'}`,
                  borderRadius: '10px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 900, fontSize: '0.85rem',
                  color: i === 0 ? '#b45309' : '#475569' 
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>Volume: R$ {c.volume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {isAdmin ? (
                    <div style={{ color: '#d97706', fontWeight: 900, fontSize: '0.9rem' }}>R$ {c.profit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                  ) : (
                    <div style={{ color: '#0284c7', fontWeight: 900, fontSize: '0.9rem' }}>R$ {c.volume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                  )}
                  <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800 }}>{c.count} Op.</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conciliation Feed */}
        <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <Activity size={18} color="#d97706" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Feed de Operações em Tempo Real</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {(isAdmin 
                    ? ['Portador / Cliente', 'Operador', 'Maquininha', 'Prazo', 'Bruto Cartão', 'Repasse (PIX)', 'Lucro Líquido', 'Status']
                    : ['Portador / Cliente', 'Operador', 'Maquininha', 'Prazo', 'Bruto Cartão', 'Repasse (PIX)', 'Status']
                  ).map(h => (
                    <th key={h} style={{ padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLoans.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma transação recente encontrada.</td>
                  </tr>
                ) : recentLoans.map(loan => {
                  const fin = calculateLoanFinancials(loan);
                  const statusColors = {
                    'completed': { color: '#059669', bg: '#ecfdf5', label: 'Concluído' },
                    'approved': { color: '#2563eb', bg: '#eff6ff', label: 'Aprovado' },
                    'pending': { color: '#d97706', bg: '#fffbeb', label: 'Aguardando' },
                    'in analysis': { color: '#7c3aed', bg: '#f5f3ff', label: 'Análise' },
                    'rejected': { color: '#dc2626', bg: '#fef2f2', label: 'Recusado' }
                  };
                  const sc = statusColors[loan.status as keyof typeof statusColors] || { color: '#64748b', bg: '#f8fafc', label: loan.status };
                  
                  return (
                    <tr key={loan.id} style={{ background: '#f8fafc', transition: 'all 0.2s' }} className="dashboard-row">
                      <td style={{ padding: '0.85rem 1rem', borderRadius: '12px 0 0 12px' }}>
                        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.85rem' }}>{loan.clienteNome}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: '#475569', fontWeight: 700, fontSize: '0.75rem' }}>
                          {loan.consultant_name || 'Direta / Admin'}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 700, fontSize: '0.75rem' }}>
                          <Smartphone size={12} /> {loan.machines?.name || 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: '#d97706', fontWeight: 800, fontSize: '0.75rem' }}>{fin.installments}x</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#2563eb', fontWeight: 800, fontSize: '0.8rem' }}>R$ {fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#ef4444', fontWeight: 800, fontSize: '0.8rem' }}>R$ {fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      {isAdmin && (
                        <td style={{ padding: '0.85rem 1rem', color: '#d97706', fontWeight: 900, fontSize: '0.85rem' }}>
                          R$ {fin.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td style={{ padding: '0.85rem 1rem', borderRadius: '0 12px 12px 0' }}>
                        <span style={{ 
                          background: sc.bg, 
                          color: sc.color, 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          fontSize: '0.65rem', 
                          fontWeight: 900,
                          display: 'inline-block',
                          textTransform: 'uppercase'
                        }}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )}

      {/* Tabela Exclusiva para Consultor: Minhas Operações Realizadas */}
      {isConsultant && activeTab === 'operacoes' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={22} color="#d97706" /> Minhas Operações Concluídas
              </h3>
              <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                Acompanhamento de contratos concedidos aos seus clientes (apenas valores de empréstimo)
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px' }}>
              {myOperations.length} Contratos Realizados no seu Nome
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  {['Contrato', 'Cliente', 'Operador', 'Data', 'Maquininha', 'Prazo', 'Total Cartão (Bruto)', 'Valor Concedido (PIX)', 'Status'].map((h, i) => (
                    <th key={h} style={{ padding: '1rem', color: '#475569', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0', textAlign: i >= 6 && i <= 7 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myOperations.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                      Nenhuma operação realizada no seu nome até o momento.
                    </td>
                  </tr>
                ) : myOperations.map(loan => {
                  const fin = calculateLoanFinancials(loan);
                  return (
                    <tr key={loan.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 800, color: '#94a3b8', fontSize: '0.8rem' }}>
                        #{((loan.id || '').slice(0, 8)).toUpperCase()}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        {loan.clienteNome || 'Cliente Portador'}
                      </td>
                      <td style={{ padding: '1rem', color: '#0284c7', fontWeight: 700, fontSize: '0.85rem' }}>
                        {loan.consultant_name || 'Operação Direta / Admin'}
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        {new Date(loan.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '1rem', color: '#334155', fontWeight: 700, fontSize: '0.85rem' }}>
                        {loan.machines?.name || 'Smart POS'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>
                          {fin.installments}x
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#2563eb', fontWeight: 900, fontSize: '0.95rem' }}>
                        R$ {fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#059669', fontWeight: 900, fontSize: '0.95rem' }}>
                        R$ {fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                          {loan.status === 'completed' ? 'Concluído' : (loan.status || 'Ativo')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .dashboard-card:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -5px rgba(0,0,0,0.06) !important; }
        .dashboard-row:hover { background: #f1f5f9 !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; borderRadius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default Dashboard;
