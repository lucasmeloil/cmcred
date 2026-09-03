import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Printer, 
  Share2, 
  Filter, 
  Calendar, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  ChevronDown, 
  FileText, 
  Activity, 
  Landmark, 
  Smartphone, 
  Users, 
  Award, 
  Clock, 
  CheckCircle2, 
  FileSpreadsheet, 
  Eye, 
  X, 
  ArrowUpRight,
  ShieldAlert,
  Percent,
  Cpu
} from 'lucide-react';
import { useAuth } from './AuthContext';
import type { FinanceEntry, LoanRequest } from './types';
import { calculateLoanFinancials } from '../lib/rates';

const Financeiro: React.FC = () => {
  const { addNotification, logAudit, currentUser, authUserEmail } = useAuth();
  
  const isSuperAdmin = authUserEmail?.toLowerCase().includes('admin') || 
                       authUserEmail?.toLowerCase().includes('cmcred') || 
                       currentUser?.perfil === 'admin';

  const [data, setData] = useState<FinanceEntry[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<null | 'payable' | 'receivable'>(null);
  const [formData, setFormData] = useState({ description: '', amount: '', due_date: '', category: 'Operacional' });
  const [activeTab, setActiveTab] = useState<'overview' | 'comissoes' | 'analytics' | 'history'>('overview');
  
  // Date filters: day, week, month, year, custom
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  // Selected consultant for detailed modal view
  const [selectedConsultantDetail, setSelectedConsultantDetail] = useState<{
    name: string;
    email: string;
    rate: number;
    totalCommission: number;
    totalVolume: number;
    loans: any[];
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      let financeQuery = supabase.from('finance').select('*').order('due_date', { ascending: false });
      let loansQuery = supabase.from('loans').select('*, leads(name), customers(name), banks(name), machines(name), profiles:consultant_id(full_name, email, role, commission_percentage)').order('created_at', { ascending: false });

      // Privacy Enforcement: If not super admin, consultant only receives their own loans!
      if (!isSuperAdmin && currentUser?.id) {
        loansQuery = loansQuery.eq('consultant_id', currentUser.id);
      }

      const now = new Date();
      if (dateRange === 'day') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        financeQuery = financeQuery.gte('due_date', startOfDay);
        loansQuery = loansQuery.gte('created_at', startOfDay);
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        financeQuery = financeQuery.gte('due_date', weekAgo);
        loansQuery = loansQuery.gte('created_at', weekAgo);
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        financeQuery = financeQuery.gte('due_date', monthAgo);
        loansQuery = loansQuery.gte('created_at', monthAgo);
      } else if (dateRange === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
        financeQuery = financeQuery.gte('due_date', startOfYear);
        loansQuery = loansQuery.gte('created_at', startOfYear);
      } else if (dateRange === 'custom' && customRange.start && customRange.end) {
        financeQuery = financeQuery.gte('due_date', customRange.start).lte('due_date', customRange.end);
        loansQuery = loansQuery.gte('created_at', customRange.start).lte('created_at', customRange.end);
      }

      const [financeRes, loansRes] = await Promise.all([financeQuery, loansQuery]);

      if (financeRes.error) throw financeRes.error;
      if (loansRes.error) throw loansRes.error;

      setData(financeRes.data || []);
      setLoans((loansRes.data || []).map((l: any) => ({
        ...l,
        lead_name: l.leads?.name || l.customers?.name || 'Cliente Identificado',
        bank_name: l.banks?.name,
        machine_name: l.machines?.name,
        consultant_name: l.profiles?.full_name || 'Direto / Matriz',
        consultant_email: l.profiles?.email || '',
        consultant_rate: l.profiles?.commission_percentage ?? 0
      })));
    } catch (err: any) {
      console.error('Erro financeiro:', err);
      addNotification('Erro ao carregar dados financeiros: ' + err.message, 'alerta');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customRange, isSuperAdmin, currentUser?.id, addNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const manualFinance = useMemo(() => {
    return data.filter(d => 
      !d.loan_id &&
      !d.description?.startsWith('PIX p/ Cliente (Repasse)') && 
      !d.description?.startsWith('Recebível Maquininha') &&
      !d.description?.startsWith('Repasse PIX ao Cliente') &&
      !d.description?.startsWith('Entrada Operação Cartão') &&
      d.category !== 'Repasse PIX Cliente' &&
      d.category !== 'Venda Cartão de Crédito'
    );
  }, [data]);

  const stats = useMemo(() => {
    const totalPagar = manualFinance.filter(d => d.type === 'payable').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalReceber = manualFinance.filter(d => d.type === 'receivable').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    
    let totalRepassado = 0;
    let totalBrutoMaq = 0;
    let totalLucroBruto = 0;
    let totalComissao = 0;
    let totalRetencaoMaquinas = 0;
    let totalLucroOperacional = 0;

    const dailyData: Record<string, any> = {};

    loans.forEach(l => {
      const fin = calculateLoanFinancials(l);
      totalRepassado += fin.netAmount;
      totalBrutoMaq += fin.grossAmount;
      totalLucroBruto += fin.operationProfit;
      totalComissao += fin.commissionAmount;
      totalRetencaoMaquinas += fin.machineFeeAmount;
      totalLucroOperacional += fin.companyNetProfit;

      const date = new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!dailyData[date]) dailyData[date] = { date, lucro: 0, volume: 0, comissao: 0 };
      dailyData[date].lucro += fin.companyNetProfit;
      dailyData[date].volume += fin.netAmount;
      dailyData[date].comissao += fin.commissionAmount;
    });

    totalLucroOperacional = Number(totalLucroOperacional.toFixed(2));
    totalRetencaoMaquinas = Number(totalRetencaoMaquinas.toFixed(2));
    totalRepassado = Number(totalRepassado.toFixed(2));
    totalBrutoMaq = Number(totalBrutoMaq.toFixed(2));
    totalLucroBruto = Number(totalLucroBruto.toFixed(2));
    totalComissao = Number(totalComissao.toFixed(2));
    
    // Saldo Final (Lucro Real da Operação + Receitas Manuais - Despesas Manuais)
    const saldoFinal = Number(((totalLucroOperacional + totalReceber) - totalPagar).toFixed(2));

    // Margens
    const margemBruta = totalBrutoMaq > 0 ? (totalLucroBruto / totalBrutoMaq) * 100 : 0;
    const margemLiquida = totalBrutoMaq > 0 ? (totalLucroOperacional / totalBrutoMaq) * 100 : 0;

    const evolutionChart = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // Fechamento de Comissões por Consultor
    const consultantMap: Record<string, {
      id: string;
      name: string;
      email: string;
      rate: number;
      count: number;
      volumePIX: number;
      volumeBruto: number;
      totalComissao: number;
      lucroGerado: number;
      loans: any[];
    }> = {};

    loans.forEach((l: any) => {
      const key = l.consultant_id || l.consultant_name || 'matriz';
      const cName = l.consultant_name || 'Matriz / Direto';
      const cEmail = l.consultant_email || '—';
      const cRate = l.consultant_rate || 0;
      const fin = calculateLoanFinancials(l);

      if (!consultantMap[key]) {
        consultantMap[key] = {
          id: key,
          name: cName,
          email: cEmail,
          rate: cRate,
          count: 0,
          volumePIX: 0,
          volumeBruto: 0,
          totalComissao: 0,
          lucroGerado: 0,
          loans: []
        };
      }

      consultantMap[key].count += 1;
      consultantMap[key].volumePIX += fin.netAmount;
      consultantMap[key].volumeBruto += fin.grossAmount;
      consultantMap[key].totalComissao += fin.commissionAmount;
      consultantMap[key].lucroGerado += fin.companyNetProfit;
      consultantMap[key].loans.push(l);
    });

    const consultantClosures = Object.values(consultantMap).sort((a, b) => b.totalComissao - a.totalComissao);

    // Distribuição de Despesas por Categoria
    const expenseData: Record<string, any> = {};
    manualFinance.filter(d => d.type === 'payable').forEach(d => {
      const cat = d.category || 'Outros';
      if (!expenseData[cat]) expenseData[cat] = { name: cat, value: 0 };
      expenseData[cat].value += Number(d.amount);
    });
    const categoryDistribution = Object.values(expenseData);

    return { 
      totalPagar, totalReceber, totalRepassado, totalLucroBruto, totalBrutoMaq, totalRetencaoMaquinas,
      saldoFinal, totalComissao, totalLucroOperacional, margemBruta, margemLiquida,
      evolutionChart, consultantClosures, categoryDistribution
    };
  }, [data, loans, manualFinance]);

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModal) return;
    try {
      const { error } = await supabase.from('finance').insert([{
        description: formData.description,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        category: formData.category,
        type: showModal,
        status: 'pending'
      }]);
      if (error) throw error;
      addNotification('Lançamento financeiro registrado com sucesso!', 'sucesso');
      await logAudit('criação', `Lançamento ${showModal}: ${formData.description} - R$ ${formData.amount}`);
      setShowModal(null);
      setFormData({ description: '', amount: '', due_date: '', category: 'Operacional' });
      fetchData();
    } catch (err: any) {
      addNotification('Erro ao criar lançamento: ' + err.message, 'alerta');
    }
  };

  // PDF de Fechamento de Comissões Detalhado
  const generateCommissionsPDF = () => {
    const doc = new jsPDF() as any;
    const dateStr = new Date().toLocaleDateString('pt-BR');

    // Header
    doc.setFillColor(0, 168, 89);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CM CRED', 15, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO OFICIAL DE FECHAMENTO DE COMISSÕES', 15, 34);
    doc.text(`PERÍODO: ${dateRange.toUpperCase()} | EMISSÃO: ${dateStr}`, 130, 22);

    let y = 55;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL DE COMISSIONAMENTO', 15, y);

    y += 10;
    const summaryData = [
      ['Total de Comissões no Período:', `R$ ${stats.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Total de Volume Repassado (PIX):', `R$ ${stats.totalRepassado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Total de Operações Concluídas:', `${loans.length} contratos`],
      ['Consultores Ativos com Fechamento:', `${stats.consultantClosures.length} profissionais`]
    ];

    autoTable(doc, {
      startY: y,
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [100, 116, 139] }, 1: { fontStyle: 'bold', textColor: [0, 168, 89] } }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRATO DE REPASSE POR CONSULTOR', 15, y);

    const tableRows = stats.consultantClosures.map(c => [
      c.name,
      `${c.rate}%`,
      `${c.count} ops`,
      `R$ ${c.volumePIX.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${c.volumeBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${c.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: y + 5,
      head: [['Consultor', 'Taxa %', 'Contratos', 'Volume PIX', 'Bruto Cartão', 'Comissão a Receber']],
      body: tableRows,
      headStyles: { fillColor: [0, 168, 89], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Fechamento_Comissoes_CMCRED_${dateStr.replace(/\//g, '-')}.pdf`);
    addNotification('Relatório de comissões em PDF gerado com sucesso!', 'sucesso');
  };

  const filteredClosures = stats.consultantClosures.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '2.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.5px' }}>
            <Landmark size={32} color="#d97706" /> 
            {isSuperAdmin ? 'Gestão Financeira & Comissões' : 'Meu Painel de Comissões & Extrato'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.4rem', fontWeight: 600 }}>
            {isSuperAdmin ? 'Fechamento de comissões, conciliação de adquirentes e controle de fluxo de caixa' : 'Acompanhe seus empréstimos realizados e o cálculo da sua comissão em tempo real'}
          </p>
        </div>

        {/* Global Filter Buttons: Dia, Semana, Mês, Ano */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '14px', flexWrap: 'wrap' }}>
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
                color: dateRange === t.id ? '#fff' : '#64748b',
                boxShadow: dateRange === t.id ? '0 4px 10px rgba(0,168,89,0.3)' : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Custom Date Picker if selected */}
      {dateRange === 'custom' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
          <button onClick={fetchData} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>Filtrar</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setActiveTab('overview')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'overview' ? '3px solid #d97706' : '3px solid transparent', padding: '0.75rem 1rem', fontWeight: activeTab === 'overview' ? 900 : 700, color: activeTab === 'overview' ? '#d97706' : '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}>
            📊 Visão Geral
          </button>
          <button onClick={() => setActiveTab('comissoes')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'comissoes' ? '3px solid #d97706' : '3px solid transparent', padding: '0.75rem 1rem', fontWeight: activeTab === 'comissoes' ? 900 : 700, color: activeTab === 'comissoes' ? '#d97706' : '#64748b', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={18} /> {isSuperAdmin ? 'Fechamento de Comissões' : 'Minhas Comissões'}
          </button>
          {isSuperAdmin && (
            <>
              <button onClick={() => setActiveTab('analytics')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'analytics' ? '3px solid #d97706' : '3px solid transparent', padding: '0.75rem 1rem', fontWeight: activeTab === 'analytics' ? 900 : 700, color: activeTab === 'analytics' ? '#d97706' : '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}>
                📈 Métricas Avançadas
              </button>
              <button onClick={() => setActiveTab('history')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '3px solid #d97706' : '3px solid transparent', padding: '0.75rem 1rem', fontWeight: activeTab === 'history' ? 900 : 700, color: activeTab === 'history' ? '#d97706' : '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}>
                📜 Contas a Pagar / Receber
              </button>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={generateCommissionsPDF} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '0.65rem 1.1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Printer size={16} color="#d97706" /> Exportar PDF
          </button>
          {isSuperAdmin && (
            <>
              <button onClick={() => setShowModal('receivable')} style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '0.65rem 1.1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
                + Nova Receita
              </button>
              <button onClick={() => setShowModal('payable')} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.65rem 1.1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
                + Nova Despesa
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB: FECHAMENTO DE COMISSÕES */}
      {/* ========================================================================= */}
      {activeTab === 'comissoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #d97706', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {isSuperAdmin ? 'Total de Comissões no Período' : 'Minha Comissão a Receber'}
              </div>
              <div style={{ color: '#d97706', fontSize: '2rem', fontWeight: 900 }}>
                R$ {stats.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>
                Filtro: {dateRange.toUpperCase()}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #2563eb', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {isSuperAdmin ? 'Volume Repassado aos Clientes (PIX)' : 'Volume Total Operado'}
              </div>
              <div style={{ color: '#2563eb', fontSize: '2rem', fontWeight: 900 }}>
                R$ {stats.totalRepassado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>
                Líquido transferido
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #7c3aed', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Contratos Concluídos
              </div>
              <div style={{ color: '#7c3aed', fontSize: '2rem', fontWeight: 900 }}>
                {loans.length} <span style={{ fontSize: '1rem', fontWeight: 700 }}>operações</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>
                No período selecionado
              </div>
            </div>

            {isSuperAdmin && (
              <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #d97706', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Lucro Líquido CM CRED
                </div>
                <div style={{ color: '#d97706', fontSize: '2rem', fontWeight: 900 }}>
                  R$ {stats.totalLucroOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>
                  Após dedução das comissões
                </div>
              </div>
            )}
          </div>

          {/* Master Table of Consultant Closures */}
          <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={22} color="#d97706" /> 
                  {isSuperAdmin ? 'Extrato de Fechamento por Consultor' : 'Extrato Detalhado das Minhas Operações'}
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                  {isSuperAdmin ? 'Valores apurados com base na taxa de comissão individual de cada consultor' : 'Consulte a comissão ganha por cada empréstimo realizado'}
                </p>
              </div>

              {isSuperAdmin && (
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Buscar consultor..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                  />
                </div>
              )}
            </div>

            {isSuperAdmin ? (
              /* ADMIN VIEW: TABLE PER CONSULTANT */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Consultor</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Taxa (%)</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Contratos</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Volume PIX</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Bruto Cartão</th>
                      <th style={{ padding: '1rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Comissão a Pagar</th>
                      <th style={{ padding: '1rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Lucro CM CRED</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClosures.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                          Nenhum fechamento registrado para este período.
                        </td>
                      </tr>
                    ) : (
                      filteredClosures.map((c, idx) => (
                        <tr key={c.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1.1rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#d9770615', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem' }}>
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>{c.name}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>{c.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1.1rem 1rem' }}>
                            <span style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>
                              {c.rate}%
                            </span>
                          </td>
                          <td style={{ padding: '1.1rem 1rem', textAlign: 'center' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{c.count}</span>
                          </td>
                          <td style={{ padding: '1.1rem 1rem', fontWeight: 700, color: '#2563eb' }}>
                            R$ {c.volumePIX.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1.1rem 1rem', fontWeight: 700, color: '#475569' }}>
                            R$ {c.volumeBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1.1rem 1rem', fontWeight: 900, color: '#d97706', fontSize: '1.05rem' }}>
                            R$ {c.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1.1rem 1rem', fontWeight: 800, color: '#d97706' }}>
                            R$ {c.lucroGerado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1.1rem 1rem', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedConsultantDetail({
                                name: c.name,
                                email: c.email,
                                rate: c.rate,
                                totalCommission: c.totalComissao,
                                totalVolume: c.volumePIX,
                                loans: c.loans
                              })}
                              style={{ background: '#d97706', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(0,168,89,0.25)' }}
                            >
                              <Eye size={14} /> Extrato
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* CONSULTANT VIEW: DETAILED LIST OF EACH LOAN */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Data</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Cliente</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Tipo</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Valor PIX</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Bruto Cartão</th>
                      <th style={{ padding: '1rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Minha Comissão (R$)</th>
                      <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                          Você ainda não possui empréstimos registrados neste período.
                        </td>
                      </tr>
                    ) : (
                      loans.map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
                            {new Date(l.created_at).toLocaleDateString('pt-BR')} {new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '1rem', color: '#0f172a', fontWeight: 800 }}>{l.lead_name}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                              {l.type}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#2563eb', fontWeight: 800 }}>
                            R$ {Number(l.requested_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem', color: '#475569', fontWeight: 700 }}>
                            R$ {Number(l.approved_amount || Number(l.requested_amount) + Number(l.profit || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem', color: '#d97706', fontWeight: 900, fontSize: '1rem' }}>
                            R$ {Number(l.consultant_commission_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span style={{ background: '#dcfce7', color: '#059669', padding: '3px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800 }}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: VISÃO GERAL (OVERVIEW) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Main KPI Cards (6 Comprehensive Cards) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {isSuperAdmin && (
              <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #d97706', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Lucro Real CM CRED (Líquido)</div>
                <div style={{ color: stats.saldoFinal >= 0 ? '#d97706' : '#dc2626', fontSize: '2rem', fontWeight: 900 }}>
                  R$ {stats.saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: '#059669', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 700 }}>Margem Líquida Real: {stats.margemLiquida.toFixed(1)}%</div>
              </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #0284c7', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Volume Repassado aos Clientes</div>
              <div style={{ color: '#0284c7', fontSize: '2rem', fontWeight: 900 }}>
                R$ {stats.totalRepassado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>Saída PIX Imediato</div>
            </div>

            {isSuperAdmin && (
              <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #3b82f6', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Passagem Bruta no Cartão</div>
                <div style={{ color: '#1e40af', fontSize: '2rem', fontWeight: 900 }}>
                  R$ {stats.totalBrutoMaq.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>Volume nas maquininhas</div>
              </div>
            )}

            {isSuperAdmin && (
              <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #b91c1c', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Retenção Máquinas (MDR)</div>
                <div style={{ color: '#dc2626', fontSize: '2rem', fontWeight: 900 }}>
                  - R$ {stats.totalRetencaoMaquinas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>Taxas de adquirentes</div>
              </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #f59e0b', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {isSuperAdmin ? 'Comissões de Consultores' : 'Minha Comissão no Período'}
              </div>
              <div style={{ color: '#d97706', fontSize: '2rem', fontWeight: 900 }}>
                R$ {stats.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>{loans.length} operação(ões) realizada(s)</div>
            </div>

            {isSuperAdmin && (
              <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderLeft: '5px solid #64748b', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Despesas Operacionais Avulsas</div>
                <div style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 900 }}>
                  R$ {stats.totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>Contas manuais a pagar</div>
              </div>
            )}
          </div>

          {/* Area Chart: Evolução Financeira */}
          <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Activity size={20} color="#d97706" />
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: 900 }}>
                Evolução Operacional: Volume PIX vs Comissões
              </h3>
            </div>
            <div style={{ height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionChart}>
                  <defs>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip formatter={(val: number) => [`R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontWeight: 700 }} />
                  <Area type="monotone" dataKey="volume" name="Volume Repassado (PIX)" stroke="#2563eb" strokeWidth={3} fill="url(#colorVol)" />
                  <Area type="monotone" dataKey="comissao" name="Comissões Ganhas" stroke="#d97706" strokeWidth={3} fill="url(#colorCom)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ANALYTICS & METRICS (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && isSuperAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
          <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: '#0f172a', fontSize: '1.1rem', fontWeight: 900 }}>
              Ranking de Lucro por Consultor
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.consultantClosures} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={val => `R$ ${(val/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontWeight: 800, fontSize: 12 }} />
                  <Tooltip formatter={(val: number) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Lucro Gerado']} />
                  <Bar dataKey="lucroGerado" name="Lucro Gerado" fill="#d97706" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: '#0f172a', fontSize: '1.1rem', fontWeight: 900 }}>
              Composição das Despesas Operacionais
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.categoryDistribution} cx="50%" cy="50%" outerRadius={100} innerRadius={60} dataKey="value" nameKey="name" paddingAngle={5}>
                    {stats.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#d97706', '#2563eb', '#f59e0b', '#dc2626', '#8b5cf6'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`R$ ${Number(val).toLocaleString('pt-BR')}`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: HISTORY / CONTAS A PAGAR E RECEBER (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && isSuperAdmin && (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 1.5rem', color: '#0f172a', fontSize: '1.2rem', fontWeight: 900 }}>
            Lançamentos Financeiros Manuais
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Vencimento</th>
                <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Descrição</th>
                <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Categoria</th>
                <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Tipo</th>
                <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Valor</th>
                <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {manualFinance.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum lançamento manual encontrado.</td></tr>
              ) : (
                manualFinance.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem', color: '#64748b', fontWeight: 700 }}>{new Date(d.due_date).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '0.85rem', color: '#0f172a', fontWeight: 800 }}>{d.description}</td>
                    <td style={{ padding: '0.85rem', color: '#64748b', fontWeight: 600 }}>{d.category}</td>
                    <td style={{ padding: '0.85rem' }}>
                      <span style={{ background: d.type === 'payable' ? '#fef2f2' : '#f0fdf4', color: d.type === 'payable' ? '#dc2626' : '#059669', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {d.type === 'payable' ? 'Despesa' : 'Receita'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem', fontWeight: 900, color: d.type === 'payable' ? '#dc2626' : '#059669' }}>
                      R$ {Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem' }}>
                      <span style={{ background: d.status === 'paid' ? '#dcfce7' : '#fef3c7', color: d.status === 'paid' ? '#059669' : '#d97706', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {d.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXTRATO MINUCIOSO DO CONSULTOR */}
      {/* ========================================================================= */}
      {selectedConsultantDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#fff', borderRadius: '32px', padding: '2.5rem', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={24} color="#d97706" />
                  <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: 900 }}>Extrato de Comissões: {selectedConsultantDetail.name}</h2>
                </div>
                <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                  E-mail: {selectedConsultantDetail.email} | Taxa Cadastrada: <strong>{selectedConsultantDetail.rate}%</strong>
                </p>
              </div>
              <button onClick={() => setSelectedConsultantDetail(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', color: '#64748b', cursor: 'pointer', padding: '0.6rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Totalizer Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '1rem' }}>
                <div style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Comissão a Pagar</div>
                <div style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 900, marginTop: '0.25rem' }}>
                  R$ {selectedConsultantDetail.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '1rem' }}>
                <div style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Volume Operado (PIX)</div>
                <div style={{ color: '#1d4ed8', fontSize: '1.5rem', fontWeight: 900, marginTop: '0.25rem' }}>
                  R$ {selectedConsultantDetail.totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1rem' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Total de Empréstimos</div>
                <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 900, marginTop: '0.25rem' }}>
                  {selectedConsultantDetail.loans.length} operações
                </div>
              </div>
            </div>

            {/* Detailed Loans Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Data</th>
                    <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Cliente</th>
                    <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Modalidade</th>
                    <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Valor PIX</th>
                    <th style={{ padding: '0.85rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800 }}>Bruto Cartão</th>
                    <th style={{ padding: '0.85rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 900 }}>Comissão R$</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedConsultantDetail.loans.map((l: any, i: number) => (
                    <tr key={l.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                        {new Date(l.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '0.85rem', color: '#0f172a', fontWeight: 800, fontSize: '0.85rem' }}>
                        {l.lead_name}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                          {l.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem', color: '#2563eb', fontWeight: 800, fontSize: '0.85rem' }}>
                        R$ {Number(l.requested_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem', color: '#475569', fontWeight: 700, fontSize: '0.85rem' }}>
                        R$ {Number(l.approved_amount || Number(l.requested_amount) + Number(l.profit || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem', color: '#d97706', fontWeight: 900, fontSize: '0.95rem' }}>
                        R$ {Number(l.consultant_commission_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedConsultantDetail(null)}
                style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO LANÇAMENTO MANUAL (RECEITA / DESPESA) */}
      {/* ========================================================================= */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <form onSubmit={handleCreateManual} style={{ background: '#fff', borderRadius: '32px', padding: '2.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: 900 }}>
                {showModal === 'receivable' ? 'Nova Receita Extra' : 'Nova Despesa / Conta'}
              </h2>
              <button type="button" onClick={() => setShowModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', color: '#64748b', cursor: 'pointer', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Descrição</label>
                <input required style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} placeholder="Ex: Aluguel do ponto, Energia, etc." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Valor (R$)</label>
                <input required type="number" step="0.01" style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 800, fontSize: '1.1rem', outline: 'none', boxSizing: 'border-box' }} placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Vencimento</label>
                  <input required type="date" style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Categoria</label>
                  <select style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="Operacional">Operacional</option>
                    <option value="Infraestrutura">Infraestrutura</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Comissões">Comissões</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" style={{ width: '100%', background: showModal === 'receivable' ? '#d97706' : '#dc2626', color: '#fff', border: 'none', padding: '1.1rem', borderRadius: '16px', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', marginTop: '1.5rem', boxShadow: '0 10px 20px -3px rgba(0,0,0,0.15)' }}>
              Registrar Lançamento
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default Financeiro;
