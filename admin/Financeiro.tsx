import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Printer, 
  Calendar, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  FileText, 
  Activity, 
  Landmark, 
  Smartphone, 
  Clock, 
  CheckCircle2, 
  X, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  Layers, 
  Plus, 
  Trash2, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from './AuthContext';
import type { FinanceEntry, LoanRequest } from './types';
import { calculateLoanFinancials } from '../lib/rates';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { MachineSettlementAlertBanner } from './MachineSettlementAlertBanner';

const Financeiro: React.FC = () => {
  const { addNotification, logAudit, currentUser, authUserEmail } = useAuth();
  
  const isSuperAdmin = authUserEmail?.toLowerCase().startsWith('admin@') || 
                       currentUser?.email?.toLowerCase() === 'caique@cmcred.com.br' || 
                       currentUser?.perfil === 'admin' ||
                       currentUser?.perfil === 'manager';

  const [data, setData] = useState<FinanceEntry[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Modais de cadastro manual
  const [showModal, setShowModal] = useState<null | 'payable' | 'receivable'>(null);
  const [formData, setFormData] = useState({ 
    description: '', 
    amount: '', 
    due_date: new Date().toISOString().split('T')[0], 
    category: 'Operacional',
    status: 'pending' as 'pending' | 'paid'
  });

  // Abas: Visão Geral | Métricas dos Empréstimos | Contas a Pagar / Receber
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'history'>('overview');
  
  // Filtros temporais
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  // Filtros de busca nas abas
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsTypeFilter, setAnalyticsTypeFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'payable' | 'receivable'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [historyOriginFilter, setHistoryOriginFilter] = useState<'all' | 'loan' | 'manual'>('all');

  const hasLoadedOnceRef = React.useRef(data.length > 0 || loans.length > 0);

  // Buscar dados integrados do Supabase com proteção de persistência total
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!hasLoadedOnceRef.current && !isSilent) {
        setLoading(true);
      }
      
      let financeQuery = supabase.from('finance').select('*').order('due_date', { ascending: false });
      // Carrega todas as operações da empresa (feitas pelo consultor, outros consultores e admin)
      let loansQuery = supabase.from('loans').select('*, leads(name), customers(name), banks(name), machines(name, fee_percentage, installment_fees, liquidation_days)').order('created_at', { ascending: false });

      const now = new Date();
      if (dateRange === 'day') {
        const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
        financeQuery = financeQuery.gte('due_date', todayStr);
        loansQuery = loansQuery.gte('created_at', todayStr);
      } else if (dateRange === 'week') {
        const weekAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        financeQuery = financeQuery.gte('due_date', weekAgoStr);
        loansQuery = loansQuery.gte('created_at', weekAgoStr);
      } else if (dateRange === 'month') {
        const monthAgoStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        financeQuery = financeQuery.gte('due_date', monthAgoStr);
        loansQuery = loansQuery.gte('created_at', monthAgoStr);
      } else if (dateRange === 'year') {
        const startOfYearStr = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        financeQuery = financeQuery.gte('due_date', startOfYearStr);
        loansQuery = loansQuery.gte('created_at', startOfYearStr);
      } else if (dateRange === 'custom' && customRange.start && customRange.end) {
        financeQuery = financeQuery.gte('due_date', customRange.start).lte('due_date', customRange.end);
        loansQuery = loansQuery.gte('created_at', customRange.start).lte('created_at', customRange.end);
      }

      const [financeRes, loansRes] = await Promise.all([financeQuery, loansQuery]);

      let rawFinance = financeRes.data || [];
      let rawLoans = loansRes.data || [];

      // Fallback resiliente com supabaseAdmin para evitar RLS/token latency ao voltar de aba
      if ((rawLoans.length === 0 || rawFinance.length === 0) && supabaseAdmin) {
        try {
          if (rawLoans.length === 0) {
            let adminLoansQuery = supabaseAdmin.from('loans').select('*, leads(name), customers(name), banks(name), machines(name, fee_percentage, installment_fees, liquidation_days)').order('created_at', { ascending: false });
            if (dateRange === 'month') {
              const monthAgoStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
              adminLoansQuery = adminLoansQuery.gte('created_at', monthAgoStr);
            }
            const fallbackLoansRes = await adminLoansQuery;
            if (fallbackLoansRes.data && fallbackLoansRes.data.length > 0) {
              rawLoans = fallbackLoansRes.data;
            }
          }
          if (rawFinance.length === 0) {
            let adminFinanceQuery = supabaseAdmin.from('finance').select('*').order('due_date', { ascending: false });
            if (dateRange === 'month') {
              const monthAgoStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
              adminFinanceQuery = adminFinanceQuery.gte('due_date', monthAgoStr);
            }
            const fallbackFinanceRes = await adminFinanceQuery;
            if (fallbackFinanceRes.data && fallbackFinanceRes.data.length > 0) {
              rawFinance = fallbackFinanceRes.data;
            }
          }
        } catch {}
      }

      if (financeRes.error || loansRes.error) {
        if (financeRes.error) console.warn('Aviso financeiro:', financeRes.error.message);
        if (loansRes.error) console.warn('Aviso loans:', loansRes.error.message);
        if (hasLoadedOnceRef.current) return;
      }
      if ((rawFinance.length === 0 || rawLoans.length === 0) && hasLoadedOnceRef.current && (data.length > 0 || loans.length > 0)) {
        return;
      }

      // REGRA DE OURO: Nunca apague dados válidos existentes na tela durante atualização de background
      if (rawFinance.length > 0 || !hasLoadedOnceRef.current) {
        setData(rawFinance);
      }
      if (rawLoans.length > 0 || !hasLoadedOnceRef.current) {
        const mappedLoans = rawLoans.map((l: any) => ({
          ...l,
          lead_name: l.leads?.name || l.customers?.name || 'Cliente Identificado',
          bank_name: l.banks?.name,
          machine_name: l.machines?.name
        }));
        setLoans(mappedLoans);
      }
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      console.error('Erro ao buscar dados financeiros:', err);
      if (!hasLoadedOnceRef.current) {
        addNotification('Erro ao carregar dados financeiros: ' + err.message, 'alerta');
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, customRange, isSuperAdmin, currentUser?.id, addNotification]);

  useEffect(() => {
    fetchData();

    // Sincronização em tempo real via Supabase Realtime Channels
    const channel = supabase
      .channel('finance-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance' },
        () => {
          fetchData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          fetchData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Atualização automática a cada 30 segundos e ao alternar de aba (sem F5 e sem piscar a tela)
  useAutoRefresh(fetchData, 30000);

  // Sincronizar empréstimos com a tabela financeira
  // Garante que cada empréstimo tenha registrado o repasse PIX (a pagar/pago) e a entrada do cartão (a receber/recebido)
  const handleSyncLoansToFinance = async () => {
    try {
      setSyncing(true);
      const existingLoanIds = new Set(data.filter(d => d.loan_id).map(d => d.loan_id));
      const entriesToInsert: any[] = [];

      for (const loan of loans) {
        if (!existingLoanIds.has(loan.id) && loan.status !== 'rejected') {
          const fin = calculateLoanFinancials(loan);
          const loanDate = (loan.created_at || new Date().toISOString()).split('T')[0];
          const clientName = loan.lead_name || 'Cliente';

          // 1. Repasse PIX (Conta a Pagar)
          entriesToInsert.push({
            loan_id: loan.id,
            description: `Repasse PIX ao Cliente: ${clientName}`,
            amount: fin.netAmount,
            gross_amount: fin.grossAmount,
            due_date: loanDate,
            type: 'payable',
            status: loan.status === 'completed' ? 'paid' : 'pending',
            category: 'Repasse PIX Cliente',
            machine_id: loan.machine_id || null
          });

          // 2. Recebível / Entrada Cartão (Conta a Receber Líquido no Banco)
          entriesToInsert.push({
            loan_id: loan.id,
            description: `Entrada Operação Cartão (${fin.installments}x) [${fin.cardBrand}]: ${clientName}`,
            amount: fin.machineNetReceipt,
            gross_amount: fin.grossAmount,
            due_date: fin.settlementDueDate || loanDate,
            type: 'receivable',
            status: fin.isSettled ? 'paid' : 'pending',
            category: 'Venda Cartão de Crédito',
            machine_id: loan.machine_id || null
          });
        }
      }

      if (entriesToInsert.length > 0) {
        const { error } = await supabase.from('finance').insert(entriesToInsert);
        if (error) throw error;
        addNotification(`Sincronização concluída! ${entriesToInsert.length} lançamentos gerados com precisão.`, 'sucesso');
        await logAudit('sincronização_financeira', `Sincronizados ${entriesToInsert.length} registros de empréstimos no financeiro`);
        fetchData();
      } else {
        addNotification('Todas as operações de empréstimos já estão sincronizadas com o financeiro!', 'info');
      }
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      addNotification('Erro ao sincronizar com financeiro: ' + err.message, 'alerta');
    } finally {
      setSyncing(false);
    }
  };

  // DAR BAIXA / ESTORNAR BAIXA (Restrito: Consultores não podem estornar)
  const handleToggleStatus = async (entry: FinanceEntry) => {
    // Se a conta já está baixada/paga e o usuário tenta estornar:
    if (entry.status === 'paid' && !isSuperAdmin) {
      addNotification('Apenas administradores possuem permissão para estornar baixas (Proteção de Auditoria CM CRED).', 'alerta');
      return;
    }

    const newStatus = entry.status === 'paid' ? 'pending' : 'paid';
    const actionLabel = newStatus === 'paid' ? 'Baixa registrada' : 'Baixa estornada';
    try {
      const { error } = await supabase
        .from('finance')
        .update({ status: newStatus })
        .eq('id', entry.id);

      if (error) throw error;

      setData(prev => prev.map(item => item.id === entry.id ? { ...item, status: newStatus } : item));
      addNotification(`${actionLabel} com sucesso: ${entry.description}`, 'sucesso');
      await logAudit('baixa_financeira', `${actionLabel} para R$ ${entry.amount.toFixed(2)} (${entry.description})`);
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      addNotification('Erro ao atualizar baixa: ' + err.message, 'alerta');
    }
  };

  // Excluir Lançamento Manual (Restrito estritamente a administradores)
  const handleDeleteEntry = async (id: string, desc: string) => {
    if (!isSuperAdmin) {
      addNotification('Apenas administradores possuem permissão para excluir registros financeiros.', 'alerta');
      return;
    }
    if (!window.confirm(`Deseja realmente remover o lançamento "${desc}"?`)) return;
    try {
      const { error } = await supabase.from('finance').delete().eq('id', id);
      if (error) throw error;

      setData(prev => prev.filter(d => d.id !== id));
      addNotification('Lançamento removido com sucesso!', 'sucesso');
      await logAudit('exclusão_financeira', `Lançamento removido: ${desc} (ID: ${id})`);
    } catch (err: any) {
      console.error('Erro ao excluir lançamento:', err);
      addNotification('Erro ao excluir lançamento: ' + err.message, 'alerta');
    }
  };

  // Inserir Lançamento Manual (Nova Receita ou Despesa)
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModal) return;
    try {
      const amountVal = parseFloat(formData.amount);
      if (isNaN(amountVal) || amountVal <= 0) {
        addNotification('Informe um valor numérico válido', 'alerta');
        return;
      }

      const { error } = await supabase.from('finance').insert([{
        description: formData.description.trim(),
        amount: amountVal,
        due_date: formData.due_date,
        category: formData.category,
        type: showModal,
        status: formData.status
      }]);

      if (error) throw error;
      addNotification(`Lançamento de ${showModal === 'receivable' ? 'Receita' : 'Despesa'} registrado com sucesso!`, 'sucesso');
      await logAudit('criação', `Lançamento ${showModal}: ${formData.description} - R$ ${formData.amount} (Status: ${formData.status})`);
      setShowModal(null);
      setFormData({ 
        description: '', 
        amount: '', 
        due_date: new Date().toISOString().split('T')[0], 
        category: 'Operacional',
        status: 'pending'
      });
      fetchData();
    } catch (err: any) {
      addNotification('Erro ao criar lançamento: ' + err.message, 'alerta');
    }
  };

  // =========================================================================
  // CÁLCULOS ESTATÍSTICOS CONSOLIDADOS (EMPRÉSTIMOS E CAIXA)
  // =========================================================================
  const stats = useMemo(() => {
    // 1. Métricas Diretas dos Empréstimos Realizados
    let totalPixRepassado = 0;
    let totalBrutoCartao = 0;
    let totalLucroOperacoes = 0;
    let totalRetencaoMaquinas = 0;
    let totalLiquidoMaquinas = 0;
    let totalContratos = loans.length;

    const modalidadeStats: Record<string, { count: number; volumePix: number; volumeBruto: number; lucro: number }> = {};
    const machineStats: Record<string, { name: string; count: number; volumeBruto: number; retencao: number; liquidoReceber: number; lucro: number }> = {};
    const installmentStats: Record<string, { count: number; volumeBruto: number }> = {
      '1x a 6x': { count: 0, volumeBruto: 0 },
      '7x a 12x': { count: 0, volumeBruto: 0 },
      '13x a 18x': { count: 0, volumeBruto: 0 }
    };
    const dailyData: Record<string, any> = {};

    loans.forEach(l => {
      const fin = calculateLoanFinancials(l);
      totalPixRepassado += fin.netAmount;
      totalBrutoCartao += fin.grossAmount;
      totalLucroOperacoes += fin.companyNetProfit;
      totalRetencaoMaquinas += fin.machineFeeAmount;
      totalLiquidoMaquinas += fin.machineNetReceipt;

      // Modalidade
      const mod = (l.type || 'Cartão').toUpperCase();
      if (!modalidadeStats[mod]) modalidadeStats[mod] = { count: 0, volumePix: 0, volumeBruto: 0, lucro: 0 };
      modalidadeStats[mod].count += 1;
      modalidadeStats[mod].volumePix += fin.netAmount;
      modalidadeStats[mod].volumeBruto += fin.grossAmount;
      modalidadeStats[mod].lucro += fin.companyNetProfit;

      // Maquininha
      const mName = l.machine_name || 'Direto / Sem Maquininha';
      if (!machineStats[mName]) machineStats[mName] = { name: mName, count: 0, volumeBruto: 0, retencao: 0, liquidoReceber: 0, lucro: 0 };
      machineStats[mName].count += 1;
      machineStats[mName].volumeBruto += fin.grossAmount;
      machineStats[mName].retencao += fin.machineFeeAmount;
      machineStats[mName].liquidoReceber += fin.machineNetReceipt;
      machineStats[mName].lucro += fin.companyNetProfit;

      // Parcelamento
      const inst = fin.installments;
      if (inst <= 6) {
        installmentStats['1x a 6x'].count += 1;
        installmentStats['1x a 6x'].volumeBruto += fin.grossAmount;
      } else if (inst <= 12) {
        installmentStats['7x a 12x'].count += 1;
        installmentStats['7x a 12x'].volumeBruto += fin.grossAmount;
      } else {
        installmentStats['13x a 18x'].count += 1;
        installmentStats['13x a 18x'].volumeBruto += fin.grossAmount;
      }

      // Evolução temporal
      const date = new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!dailyData[date]) dailyData[date] = { date, volumePix: 0, lucro: 0, volumeBruto: 0 };
      dailyData[date].volumePix += fin.netAmount;
      dailyData[date].lucro += fin.companyNetProfit;
      dailyData[date].volumeBruto += fin.grossAmount;
    });

    const ticketMedio = totalContratos > 0 ? (totalPixRepassado / totalContratos) : 0;
    const margemMediaLucro = totalBrutoCartao > 0 ? ((totalLucroOperacoes / totalBrutoCartao) * 100) : 0;
    const evolutionChart = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // 2. Fluxo de Caixa Integrado (Contas a Pagar e Receber da tabela finance)
    const payables = data.filter(d => d.type === 'payable');
    const receivables = data.filter(d => d.type === 'receivable');

    const totalPagarPendente = payables.filter(d => d.status === 'pending').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalPagarBaixado = payables.filter(d => d.status === 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalPagarGeral = totalPagarPendente + totalPagarBaixado;

    const totalReceberPendente = receivables.filter(d => d.status === 'pending').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalReceberBaixado = receivables.filter(d => d.status === 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalReceberGeral = totalReceberPendente + totalReceberBaixado;

    // Despesas manuais avulsas (para gráfico de pizza)
    const categoryDistributionMap: Record<string, number> = {};
    payables.forEach(d => {
      const cat = d.category || 'Outros';
      categoryDistributionMap[cat] = (categoryDistributionMap[cat] || 0) + Number(d.amount);
    });
    const categoryDistribution = Object.entries(categoryDistributionMap).map(([name, value]) => ({ name, value }));

    // Lucro Líquido Real CM CRED no período:
    // Lucro Líquido dos Empréstimos + Receitas Extras Baixadas - Despesas Avulsas Baixadas
    const manualReceitasBaixadas = receivables.filter(d => !d.loan_id && d.status === 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const manualDespesasBaixadas = payables.filter(d => !d.loan_id && d.status === 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const saldoLucroReal = Number((totalLucroOperacoes + manualReceitasBaixadas - manualDespesasBaixadas).toFixed(2));

    return {
      totalPixRepassado: Number(totalPixRepassado.toFixed(2)),
      totalBrutoCartao: Number(totalBrutoCartao.toFixed(2)),
      totalLucroOperacoes: Number(totalLucroOperacoes.toFixed(2)),
      totalRetencaoMaquinas: Number(totalRetencaoMaquinas.toFixed(2)),
      totalLiquidoMaquinas: Number(totalLiquidoMaquinas.toFixed(2)),
      totalContratos,
      ticketMedio: Number(ticketMedio.toFixed(2)),
      margemMediaLucro: Number(margemMediaLucro.toFixed(2)),
      modalidadeList: Object.entries(modalidadeStats).map(([name, val]) => ({ name, ...val })),
      machineList: Object.values(machineStats),
      installmentList: Object.entries(installmentStats).map(([name, val]) => ({ name, ...val })),
      evolutionChart,
      totalPagarPendente,
      totalPagarBaixado,
      totalPagarGeral,
      totalReceberPendente,
      totalReceberBaixado,
      totalReceberGeral,
      saldoLucroReal,
      categoryDistribution
    };
  }, [loans, data]);

  // =========================================================================
  // GERAÇÃO PROFISSIONAL DO RELATÓRIO PDF (COM LOGO CM CRED E TEMA OFICIAL)
  // =========================================================================
  const generateFinancialPDF = async () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Barra superior dourada CM CRED
      doc.setFillColor(217, 119, 6); // #d97706
      doc.rect(0, 0, 210, 6, 'F');

      // Cabeçalho Fundo Escuro Corporativo CM CRED (Navy #0f172a)
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(0, 6, 210, 36, 'F');

      // Carregar e estampar o logotipo da CM CRED
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/cmcred-logo.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });

        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 14, 10, 26, 26);
        }
      } catch (imgErr) {
        console.warn('Logo da CM CRED não pôde ser carregada no PDF:', imgErr);
      }

      // Título e Subtítulo
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('CM CRED', 45, 20);
      
      doc.setFontSize(8.5);
      doc.setTextColor(217, 119, 6); // Gold #d97706
      doc.setFont('helvetica', 'bold');
      doc.text('SOLUÇÕES FINANCEIRAS & CRÉDITO', 45, 26);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.setFont('helvetica', 'normal');
      doc.text(`RELATÓRIO DE CONTROLE FINANCEIRO & EMPRÉSTIMOS`, 45, 33);

      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`EMISSÃO: ${dateStr} às ${timeStr}`, 145, 20);
      doc.text(`PERÍODO: ${dateRange.toUpperCase()}`, 145, 26);

      let y = 48;

      // Resumo Executivo em Grid (AutoTable)
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. RESUMO EXECUTIVO DO FLUXO FINANCEIRO & EMPRÉSTIMOS', 14, y);

      y += 4;
      const kpiData = [
        [
          `Volume Concedido (PIX):\nR$ ${stats.totalPixRepassado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `Faturamento Bruto Cartão:\nR$ ${stats.totalBrutoCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `A Receber Líquido Máquinas:\nR$ ${stats.totalLiquidoMaquinas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ],
        [
          `Lucro Líquido Real CM CRED:\nR$ ${stats.saldoLucroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `Contas a Receber (Pendente/Total):\nR$ ${stats.totalReceberPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ ${stats.totalReceberGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `Contas a Pagar (Pendente/Total):\nR$ ${stats.totalPagarPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ ${stats.totalPagarGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]
      ];

      autoTable(doc, {
        startY: y,
        body: kpiData,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3, fontStyle: 'bold', textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.2
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Tabela de Empréstimos Realizados
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`2. EMPRÉSTIMOS REALIZADOS NO PERÍODO (${loans.length} operações)`, 14, y);

      const loansRows = loans.slice(0, 40).map(l => {
        const fin = calculateLoanFinancials(l);
        return [
          new Date(l.created_at).toLocaleDateString('pt-BR'),
          l.lead_name || 'Cliente',
          l.type ? l.type.toUpperCase() : 'CARTÃO',
          l.machine_name || 'Maquininha',
          `${fin.installments}x`,
          `R$ ${fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${fin.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          l.status || 'concluído'
        ];
      });

      autoTable(doc, {
        startY: y + 4,
        head: [['Data', 'Cliente', 'Tipo', 'Maquininha', 'Parc.', 'PIX Repasse', 'Bruto Cartão', 'Lucro CM CRED', 'Status']],
        body: loansRows.length > 0 ? loansRows : [['-', 'Nenhum empréstimo no período', '-', '-', '-', '-', '-', '-', '-']],
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Se o espaço na página for insuficiente para Contas a Pagar/Receber, adiciona nova página
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      // Tabela de Contas a Pagar e Receber
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('3. FLUXO INTEGRADO: CONTAS A PAGAR & CONTAS A RECEBER', 14, y);

      const financeRows = data.slice(0, 40).map(d => [
        new Date(d.due_date).toLocaleDateString('pt-BR'),
        d.description,
        d.category || 'Geral',
        d.type === 'payable' ? 'A PAGAR' : 'A RECEBER',
        `R$ ${Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        d.status === 'paid' ? 'BAIXADO (PAGO)' : 'PENDENTE'
      ]);

      autoTable(doc, {
        startY: y + 4,
        head: [['Vencimento', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status de Baixa']],
        body: financeRows.length > 0 ? financeRows : [['-', 'Nenhuma movimentação registrada', '-', '-', '-', '-']],
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      // Rodapé Oficial
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `CM CRED Soluções Financeiras • Documento confidencial • Página ${i} de ${pageCount}`,
          105,
          290,
          { align: 'center' }
        );
      }

      doc.save(`Controle_Financeiro_CMCRED_${dateStr.replace(/\//g, '-')}.pdf`);
      addNotification('Relatório Financeiro CM CRED exportado em PDF com sucesso!', 'sucesso');
    } catch (pdfErr: any) {
      console.error('Erro ao gerar PDF:', pdfErr);
      addNotification('Erro ao gerar relatório PDF: ' + pdfErr.message, 'alerta');
    }
  };

  // Filtragem dos lançamentos em Contas a Pagar / Receber
  const filteredHistory = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.description.toLowerCase().includes(historySearch.toLowerCase()) ||
                          (item.category || '').toLowerCase().includes(historySearch.toLowerCase());
      const matchType = historyTypeFilter === 'all' || item.type === historyTypeFilter;
      const matchStatus = historyStatusFilter === 'all' || item.status === historyStatusFilter;
      
      let matchOrigin = true;
      if (historyOriginFilter === 'loan') matchOrigin = !!item.loan_id;
      if (historyOriginFilter === 'manual') matchOrigin = !item.loan_id;

      return matchSearch && matchType && matchStatus && matchOrigin;
    });
  }, [data, historySearch, historyTypeFilter, historyStatusFilter, historyOriginFilter]);

  // Filtragem da tabela analítica de Empréstimos
  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const s = analyticsSearch.toLowerCase();
      const matchText = (l.lead_name || '').toLowerCase().includes(s) ||
                        (l.machine_name || '').toLowerCase().includes(s) ||
                        (l.id || '').toLowerCase().includes(s);
      const matchType = analyticsTypeFilter === 'all' || (l.type || 'cartão').toLowerCase() === analyticsTypeFilter.toLowerCase();
      return matchText && matchType;
    });
  }, [loans, analyticsSearch, analyticsTypeFilter]);

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* ========================================================================= */}
      {/* CABEÇALHO PRINCIPAL COM IDENTIDADE CM CRED */}
      {/* ========================================================================= */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '2.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.5px' }}>
            <Landmark size={32} color="#d97706" /> 
            Controle Financeiro & Empréstimos
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.4rem', fontWeight: 600 }}>
            Gestão integrada de fluxo de caixa, contas a pagar e receber, liquidação de maquininhas e inteligência operacional
          </p>
        </div>

        {/* Filtros Globais de Período */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#e2e8f0', padding: '0.35rem', borderRadius: '14px', flexWrap: 'wrap' }}>
          {[
            { id: 'day',   label: 'Hoje' },
            { id: 'week',  label: 'Semana' },
            { id: 'month', label: 'Mês' },
            { id: 'year',  label: 'Ano' },
            { id: 'custom', label: 'Personalizado' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setDateRange(t.id as any)}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                background: dateRange === t.id ? '#d97706' : 'transparent',
                color: dateRange === t.id ? '#ffffff' : '#475569',
                boxShadow: dateRange === t.id ? '0 4px 10px rgba(217,119,6,0.3)' : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Datepicker Personalizado */}
      {dateRange === 'custom' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#ffffff', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', flexWrap: 'wrap', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} color="#d97706" /> Período Personalizado:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>De:</label>
            <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: 700 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Até:</label>
            <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: 700 }} />
          </div>
          <button onClick={() => fetchData()} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>Filtrar</button>
        </div>
      )}

      {/* BANNER INTELIGENTE DE CONFIRMAÇÃO DE LIQUIDAÇÃO DE MÁQUINAS (OPÇÃO 2: 1 CLIQUE) */}
      <MachineSettlementAlertBanner loans={loans} onSettlementSuccess={() => fetchData()} />

      {/* ========================================================================= */}
      {/* ABAS DE NAVEGAÇÃO & AÇÕES RÁPIDAS (EXPORTAR PDF, RECEITA, DESPESA, SYNC) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => setActiveTab('overview')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === 'overview' ? '3px solid #d97706' : '3px solid transparent', 
              padding: '0.75rem 1rem', 
              fontWeight: activeTab === 'overview' ? 900 : 700, 
              color: activeTab === 'overview' ? '#d97706' : '#64748b', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            📊 Visão Geral
          </button>
          
          <button 
            onClick={() => setActiveTab('analytics')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === 'analytics' ? '3px solid #d97706' : '3px solid transparent', 
              padding: '0.75rem 1rem', 
              fontWeight: activeTab === 'analytics' ? 900 : 700, 
              color: activeTab === 'analytics' ? '#d97706' : '#64748b', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Activity size={18} /> Métricas dos Empréstimos
          </button>

          <button 
            onClick={() => setActiveTab('history')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === 'history' ? '3px solid #d97706' : '3px solid transparent', 
              padding: '0.75rem 1rem', 
              fontWeight: activeTab === 'history' ? 900 : 700, 
              color: activeTab === 'history' ? '#d97706' : '#64748b', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <FileText size={18} /> Contas a Pagar / Receber
          </button>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isSuperAdmin && (
            <button 
              onClick={handleSyncLoansToFinance} 
              disabled={syncing}
              title="Garante que todas as operações de empréstimo estejam devidamente lançadas em Contas a Pagar e Receber"
              style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                color: '#334155', 
                padding: '0.65rem 1.1rem', 
                borderRadius: '12px', 
                fontWeight: 800, 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                fontSize: '0.85rem' 
              }}
            >
              <RefreshCw size={15} color="#d97706" /> 
              {syncing ? 'Sincronizando...' : 'Sincronizar Operações'}
            </button>
          )}

          <button 
            onClick={generateFinancialPDF} 
            style={{ 
              background: '#0f172a', 
              border: 'none', 
              color: '#ffffff', 
              padding: '0.65rem 1.2rem', 
              borderRadius: '12px', 
              fontWeight: 800, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              fontSize: '0.85rem',
              boxShadow: '0 4px 10px rgba(15,23,42,0.2)'
            }}
          >
            <Printer size={16} color="#d97706" /> Exportar PDF
          </button>

          {isSuperAdmin && (
            <>
              <button 
                onClick={() => setShowModal('receivable')} 
                style={{ 
                  background: '#ecfdf5', 
                  border: '1px solid #a7f3d0', 
                  color: '#059669', 
                  padding: '0.65rem 1.1rem', 
                  borderRadius: '12px', 
                  fontWeight: 800, 
                  cursor: 'pointer', 
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Plus size={16} /> Nova Receita
              </button>
              <button 
                onClick={() => setShowModal('payable')} 
                style={{ 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  color: '#dc2626', 
                  padding: '0.65rem 1.1rem', 
                  borderRadius: '12px', 
                  fontWeight: 800, 
                  cursor: 'pointer', 
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Plus size={16} /> Nova Despesa
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: 📊 VISÃO GERAL (OVERVIEW) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Grid de Cards de Destaque Financeiro */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            
            {/* Lucro Líquido Real CM CRED */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '6px solid #d97706', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Lucro Líquido Real CM CRED</span>
                <Landmark size={18} color="#d97706" />
              </div>
              <div style={{ color: stats.saldoLucroReal >= 0 ? '#d97706' : '#dc2626', fontSize: '2.1rem', fontWeight: 900 }}>
                R$ {stats.saldoLucroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#059669', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <TrendingUp size={14} /> Margem Operacional Média: {stats.margemMediaLucro.toFixed(1)}%
              </div>
            </div>

            {/* Volume Repassado aos Clientes (PIX) */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '6px solid #0284c7', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Volume Repassado (PIX)</span>
                <DollarSign size={18} color="#0284c7" />
              </div>
              <div style={{ color: '#0284c7', fontSize: '2.1rem', fontWeight: 900 }}>
                R$ {stats.totalPixRepassado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: 600 }}>
                {stats.totalContratos} operações efetuadas
              </div>
            </div>

            {/* Passagem Bruta no Cartão */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '6px solid #1e40af', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Bruto nas Maquininhas</span>
                <CreditCard size={18} color="#1e40af" />
              </div>
              <div style={{ color: '#1e40af', fontSize: '2.1rem', fontWeight: 900 }}>
                R$ {stats.totalBrutoCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: 600 }}>
                Total transacionado
              </div>
            </div>

            {/* A Receber das Maquininhas (Líquido) */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '6px solid #059669', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#047857', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>A Receber das Máquinas (Líquido)</span>
                <CheckCircle2 size={18} color="#059669" />
              </div>
              <div style={{ color: '#059669', fontSize: '2.1rem', fontWeight: 900 }}>
                R$ {stats.totalLiquidoMaquinas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: 600 }}>
                Já abatida taxa de -R$ {stats.totalRetencaoMaquinas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Contas a Receber */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '6px solid #059669', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Contas a Receber</span>
                <CheckCircle2 size={18} color="#059669" />
              </div>
              <div style={{ color: '#059669', fontSize: '1.9rem', fontWeight: 900 }}>
                R$ {stats.totalReceberGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 700 }}>
                <span style={{ color: '#059669' }}>Baixado: R$ {stats.totalReceberBaixado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> • Pendente: R$ {stats.totalReceberPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Contas a Pagar */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '6px solid #b91c1c', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Contas a Pagar</span>
                <AlertCircle size={18} color="#b91c1c" />
              </div>
              <div style={{ color: '#b91c1c', fontSize: '1.9rem', fontWeight: 900 }}>
                R$ {stats.totalPagarGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 700 }}>
                <span style={{ color: '#059669' }}>Baixado: R$ {stats.totalPagarBaixado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> • Pendente: R$ {stats.totalPagarPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

          </div>

          {/* Gráfico de Evolução Financeira Operacional (PIX vs Lucro Líquido Real) */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={22} color="#d97706" />
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 900 }}>
                  Evolução Financeira: Volume Operado (PIX) vs Lucro Operacional CM CRED
                </h3>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: '8px' }}>
                Período: {dateRange.toUpperCase()}
              </span>
            </div>
            
            <div style={{ height: '330px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionChart}>
                  <defs>
                    <linearGradient id="colorVolPix" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLucroReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip 
                    formatter={(val: number) => [`R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 800 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px', fontWeight: 800 }} />
                  <Area type="monotone" dataKey="volumePix" name="Volume Repassado ao Cliente (PIX)" stroke="#0284c7" strokeWidth={3} fill="url(#colorVolPix)" />
                  <Area type="monotone" dataKey="lucro" name="Lucro Líquido CM CRED" stroke="#d97706" strokeWidth={3} fill="url(#colorLucroReal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: 📈 MÉTRICAS AVANÇADAS DOS EMPRÉSTIMOS REALIZADOS */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Header & Destaques de Empréstimos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
            
            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Total de Contratos
              </div>
              <div style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 900 }}>
                {stats.totalContratos} <span style={{ fontSize: '1rem', fontWeight: 700, color: '#64748b' }}>operações</span>
              </div>
              <div style={{ color: '#059669', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 700 }}>
                Empréstimos processados
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Volume Concedido (PIX)
              </div>
              <div style={{ color: '#0284c7', fontSize: '1.9rem', fontWeight: 900 }}>
                R$ {stats.totalPixRepassado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 600 }}>
                Líquido transferido
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Ticket Médio
              </div>
              <div style={{ color: '#d97706', fontSize: '1.9rem', fontWeight: 900 }}>
                R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 600 }}>
                Média por contrato
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Lucro das Operações
              </div>
              <div style={{ color: '#059669', fontSize: '1.9rem', fontWeight: 900 }}>
                R$ {stats.totalLucroOperacoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#059669', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 700 }}>
                Margem média: {stats.margemMediaLucro.toFixed(1)}%
              </div>
            </div>

          </div>

          {/* Gráficos de Inteligência de Empréstimos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
            
            {/* Gráfico 1: Desempenho por Modalidade de Empréstimo */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 1.5rem', color: '#0f172a', fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} color="#d97706" /> Volume e Lucro por Modalidade de Empréstimo
              </h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.modalidadeList}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontWeight: 800, fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={val => `R$ ${(val/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val: number) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]} />
                    <Legend wrapperStyle={{ fontWeight: 700 }} />
                    <Bar dataKey="volumePix" name="Volume Repassado (PIX)" fill="#0284c7" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="lucro" name="Lucro CM CRED" fill="#d97706" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Desempenho por Maquininha / Adquirente */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 1.5rem', color: '#0f172a', fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={20} color="#d97706" /> Desempenho por Maquininha / Adquirente
              </h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.machineList} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tickFormatter={val => `R$ ${(val/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontWeight: 800, fontSize: 11 }} />
                    <Tooltip formatter={(val: number) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]} />
                    <Legend wrapperStyle={{ fontWeight: 700 }} />
                    <Bar dataKey="volumeBruto" name="Bruto Cartão" fill="#1e40af" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="lucro" name="Lucro CM CRED" fill="#d97706" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* TABELA DETALHADA DOS EMPRÉSTIMOS REALIZADOS (SEM COMISSÕES A PAGAR) */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CreditCard size={22} color="#d97706" /> Detalhamento dos Empréstimos Realizados
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                  Acompanhe cada operação, valores repassados, passagem em cartão e rentabilidade gerada
                </p>
              </div>

              {/* Filtro de Busca da Tabela */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, máquina..."
                    value={analyticsSearch}
                    onChange={e => setAnalyticsSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                  />
                </div>

                <select
                  value={analyticsTypeFilter}
                  onChange={e => setAnalyticsTypeFilter(e.target.value)}
                  style={{ padding: '0.65rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, fontSize: '0.85rem', color: '#334155', outline: 'none' }}
                >
                  <option value="all">Todas Modalidades</option>
                  <option value="cartão">Cartão de Crédito</option>
                  <option value="fgts">FGTS</option>
                  <option value="consignado">Consignado</option>
                  <option value="pessoal">Pessoal</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Data</th>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Cliente</th>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Modalidade</th>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Maquininha</th>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Parc.</th>
                    <th style={{ padding: '1rem', color: '#0284c7', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Valor PIX (Repasse)</th>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Bruto Cartão</th>
                    <th style={{ padding: '1rem', color: '#047857', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>A Receber Máq. (Líquido)</th>
                    <th style={{ padding: '1rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Lucro CM CRED</th>
                    <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                        Nenhum empréstimo encontrado para o período ou filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map(l => {
                      const fin = calculateLoanFinancials(l);
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
                            {new Date(l.created_at).toLocaleDateString('pt-BR')}
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td style={{ padding: '1rem', color: '#0f172a', fontWeight: 800 }}>
                            {l.lead_name}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ background: '#eff6ff', color: '#1e40af', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                              {l.type}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>
                            {l.machine_name || '—'}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                            {fin.installments}x
                          </td>
                          <td style={{ padding: '1rem', color: '#0284c7', fontWeight: 900, fontSize: '0.95rem' }}>
                            R$ {fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem', color: '#334155', fontWeight: 700 }}>
                            R$ {fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem', color: '#047857', fontWeight: 900, background: '#f0fdf4' }}>
                            R$ {fin.machineNetReceipt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>Taxa: -R$ {fin.machineFeeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td style={{ padding: '1rem', color: '#d97706', fontWeight: 900, fontSize: '1rem' }}>
                            R$ {fin.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span style={{ background: '#dcfce7', color: '#059669', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800 }}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: 📜 CONTAS A PAGAR / RECEBER COM OPÇÃO DE "DAR BAIXA" */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Resumo de Liquidação e Baixas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            
            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.25rem', border: '1px solid #fee2e2', borderLeft: '5px solid #dc2626' }}>
              <div style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Contas a Pagar (Pendentes)</div>
              <div style={{ color: '#dc2626', fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem' }}>
                R$ {stats.totalPagarPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>Aguardando pagamento</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.25rem', border: '1px solid #dcfce7', borderLeft: '5px solid #059669' }}>
              <div style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Contas a Pagar (Baixadas)</div>
              <div style={{ color: '#059669', fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem' }}>
                R$ {stats.totalPagarBaixado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>Pagas com sucesso</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.25rem', border: '1px solid #e0f2fe', borderLeft: '5px solid #0284c7' }}>
              <div style={{ color: '#0284c7', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Contas a Receber (Pendentes)</div>
              <div style={{ color: '#0284c7', fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem' }}>
                R$ {stats.totalReceberPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>Aguardando liquidação</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '1.25rem', border: '1px solid #fef3c7', borderLeft: '5px solid #d97706' }}>
              <div style={{ color: '#d97706', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Contas a Receber (Baixadas)</div>
              <div style={{ color: '#d97706', fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem' }}>
                R$ {stats.totalReceberBaixado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>Liquidadas no banco</div>
            </div>

          </div>

          {/* Painel Principal de Contas a Pagar / Receber com Filtros e Ação de Dar Baixa */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
            
            {/* Barra de Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={22} color="#d97706" /> Movimentações de Contas a Pagar & Receber
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                  Realize a conferência e dê baixa em recebíveis e despesas com registro imediato
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {/* Busca */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Buscar lançamento..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.8rem 0.6rem 2.2rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', outline: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                  />
                </div>

                {/* Filtro Tipo */}
                <select
                  value={historyTypeFilter}
                  onChange={e => setHistoryTypeFilter(e.target.value as any)}
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="payable">Apenas A Pagar (Despesas)</option>
                  <option value="receivable">Apenas A Receber (Receitas)</option>
                </select>

                {/* Filtro Status */}
                <select
                  value={historyStatusFilter}
                  onChange={e => setHistoryStatusFilter(e.target.value as any)}
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="all">Todos os Status</option>
                  <option value="pending">⏳ Apenas Pendentes</option>
                  <option value="paid">✅ Apenas Baixados / Pagos</option>
                </select>

                {/* Filtro Origem */}
                <select
                  value={historyOriginFilter}
                  onChange={e => setHistoryOriginFilter(e.target.value as any)}
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="all">Todas as Origens</option>
                  <option value="loan">Origem: Empréstimos</option>
                  <option value="manual">Origem: Lançamentos Manuais</option>
                </select>
              </div>
            </div>

            {/* Tabela de Contas com Ações de Baixa */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Vencimento</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Descrição</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Categoria</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Tipo</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Origem</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Valor</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.9rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textAlign: 'center' }}>Ação de Baixa</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                        <td style={{ padding: '1rem 0.9rem', color: '#475569', fontWeight: 700, fontSize: '0.85rem' }}>
                          {new Date(d.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ padding: '1rem 0.9rem', color: '#0f172a', fontWeight: 800, fontSize: '0.9rem' }}>
                          {d.description}
                        </td>
                        <td style={{ padding: '1rem 0.9rem', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                          {d.category || 'Geral'}
                        </td>
                        <td style={{ padding: '1rem 0.9rem' }}>
                          <span style={{ 
                            background: d.type === 'payable' ? '#fef2f2' : '#f0fdf4', 
                            color: d.type === 'payable' ? '#dc2626' : '#059669', 
                            padding: '4px 10px', 
                            borderRadius: '8px', 
                            fontSize: '0.75rem', 
                            fontWeight: 800 
                          }}>
                            {d.type === 'payable' ? 'A Pagar' : 'A Receber'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.9rem' }}>
                          <span style={{ 
                            background: d.loan_id ? '#eff6ff' : '#f8fafc', 
                            color: d.loan_id ? '#1e40af' : '#64748b', 
                            border: '1px solid #e2e8f0', 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.72rem', 
                            fontWeight: 700 
                          }}>
                            {d.loan_id ? 'Empréstimo' : 'Manual'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.9rem', fontWeight: 900, fontSize: '1rem', color: d.type === 'payable' ? '#dc2626' : '#059669' }}>
                          R$ {Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '1rem 0.9rem', textAlign: 'center' }}>
                          <span style={{ 
                            background: d.status === 'paid' ? '#dcfce7' : '#fef3c7', 
                            color: d.status === 'paid' ? '#059669' : '#d97706', 
                            padding: '4px 10px', 
                            borderRadius: '8px', 
                            fontSize: '0.75rem', 
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {d.status === 'paid' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                            {d.status === 'paid' ? 'Baixado' : 'Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.9rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            {d.status === 'pending' ? (
                              <button
                                onClick={() => handleToggleStatus(d)}
                                style={{
                                  background: '#059669',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 14px',
                                  borderRadius: '8px',
                                  fontWeight: 800,
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
                                }}
                              >
                                <Check size={14} /> Dar Baixa
                              </button>
                            ) : isSuperAdmin ? (
                              <button
                                onClick={() => handleToggleStatus(d)}
                                title="Desfazer baixa e retornar ao status pendente (Apenas Admin)"
                                style={{
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1',
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <RotateCcw size={12} /> Estornar
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 800 }}>
                                Liquidado
                              </span>
                            )}

                            {/* Se for lançamento manual, permite excluir */}
                            {!d.loan_id && isSuperAdmin && (
                              <button
                                onClick={() => handleDeleteEntry(d.id, d.description)}
                                title="Excluir lançamento manual"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '6px'
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO LANÇAMENTO MANUAL (RECEITA / DESPESA) */}
      {/* ========================================================================= */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(6px)' }}>
          <form onSubmit={handleCreateManual} style={{ background: '#ffffff', borderRadius: '28px', padding: '2.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Landmark size={22} color={showModal === 'receivable' ? '#059669' : '#dc2626'} />
                {showModal === 'receivable' ? 'Nova Receita Extra' : 'Nova Despesa / Conta a Pagar'}
              </h2>
              <button type="button" onClick={() => setShowModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', color: '#64748b', cursor: 'pointer', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Descrição do Lançamento</label>
                <input required style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} placeholder="Ex: Aluguel ponto, Energia, Marketing..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Valor (R$)</label>
                <input required type="number" step="0.01" min="0.01" style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 900, fontSize: '1.15rem', color: showModal === 'receivable' ? '#059669' : '#dc2626', outline: 'none', boxSizing: 'border-box' }} placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Vencimento</label>
                  <input required type="date" style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Categoria</label>
                  <select style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="Operacional">Operacional</option>
                    <option value="Infraestrutura">Infraestrutura</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Impostos / Tributos">Impostos / Tributos</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Status Inicial</label>
                <select style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, outline: 'none', boxSizing: 'border-box' }} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                  <option value="pending">⏳ Pendente (A Pagar / Receber)</option>
                  <option value="paid">✅ Já Baixado (Pago / Recebido)</option>
                </select>
              </div>
            </div>

            <button type="submit" style={{ width: '100%', background: showModal === 'receivable' ? '#059669' : '#dc2626', color: '#fff', border: 'none', padding: '1.1rem', borderRadius: '16px', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', marginTop: '1.5rem', boxShadow: '0 10px 20px -3px rgba(0,0,0,0.15)' }}>
              Registrar {showModal === 'receivable' ? 'Receita' : 'Despesa'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default Financeiro;
