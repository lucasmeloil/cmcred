import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { useAuth } from './AuthContext';
import { 
  FileText, Search, Filter, Calendar, CheckCircle2, XCircle, Clock, 
  Trash2, Download, Landmark, Smartphone, Users, User, FileDown, MessageSquare, CreditCard, Wallet, DollarSign, TrendingDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LoanRequest, LoanStatus, LoanType, Bank, Machine } from './types';
import { calculateLoanFinancials } from '../lib/rates';
import { useAutoRefresh } from '../lib/useAutoRefresh';

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  'in analysis': { color: '#b45309', bg: '#fef3c7', icon: <Clock size={14} />, label: 'Em Análise' },
  'in_analysis': { color: '#b45309', bg: '#fef3c7', icon: <Clock size={14} />, label: 'Em Análise' },
  'approved': { color: '#047857', bg: '#dcfce7', icon: <CheckCircle2 size={14} />, label: 'Aprovado' },
  'rejected': { color: '#b91c1c', bg: '#fee2e2', icon: <XCircle size={14} />, label: 'Recusado' },
  'completed': { color: '#15803d', bg: '#dcfce7', icon: <CheckCircle2 size={14} />, label: 'Concluído' },
  'pending': { color: '#1d4ed8', bg: '#dbeafe', icon: <Clock size={14} />, label: 'Pendente' },
};

const tipoConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  'FGTS': { icon: <Users size={14} />, color: '#059669' },
  'consignado': { icon: <FileText size={14} />, color: '#4f46e5' },
  'cartão': { icon: <Smartphone size={14} />, color: '#d97706' },
  'pessoal': { icon: <Users size={14} />, color: '#db2777' },
};

const LoanRequests: React.FC = () => {
  const { currentUser, authUserEmail, addNotification, logAudit, showConfirm } = useAuth();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMessage, setEditingMessage] = useState('');
  
  const defaultMessages = [
    "Olá! Seu empréstimo foi realizado com sucesso. Conte sempre com a CM CRED! 🚀",
    "Seu contrato foi aprovado! O repasse via PIX será realizado em instantes. CM CRED agradece a preferência.",
    "Tudo pronto! Sua operação foi concluída. Qualquer dúvida, estamos à disposição no WhatsApp (79) 99862-7907.",
    "Olá! Recebemos sua solicitação na CM CRED e já estamos processando. Em breve traremos novidades!"
  ];
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selected, setSelected] = useState<LoanRequest | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const isSuperAdmin = authUserEmail?.toLowerCase().startsWith('admin@') || 
                           currentUser?.email?.toLowerCase() === 'caique@cmcred.com.br' ||
                           currentUser?.perfil === 'admin';

      // Carrega todas as operações da empresa (feitas pelo consultor, outros consultores e admin)
      let loansQuery = supabase.from('loans').select('*, leads(name, phone), customers(name, phone), banks(name), machines(name, fee_percentage, installment_fees), profiles:consultant_id(full_name)').order('created_at', { ascending: false });

      const [loansRes, banksRes, machinesRes] = await Promise.all([
        loansQuery,
        supabase.from('banks').select('*'),
        supabase.from('machines').select('*')
      ]);

      let rawLoans = loansRes.data || [];

      // Fallback resiliente para Super Admin
      if (rawLoans.length === 0 && (isSuperAdmin || !currentUser?.id)) {
        try {
          const fallbackRes = await supabaseAdmin.from('loans').select('*, leads(name, phone), customers(name, phone), banks(name), machines(name, fee_percentage, installment_fees), profiles:consultant_id(full_name)').order('created_at', { ascending: false });
          if (fallbackRes.data && fallbackRes.data.length > 0) {
            rawLoans = fallbackRes.data;
          }
        } catch {}
      }

      setLoans(rawLoans.map((l: any) => ({
        ...l,
        lead_name: l.customers?.name || l.leads?.name || 'Cliente Identificado',
        lead_phone: l.customers?.phone || l.leads?.phone || '',
        bank_name: l.banks?.name || 'Banco Geral',
        machine_name: l.machines?.name || 'Stone Smart POS',
        consultant_name: l.profiles?.full_name || 'Operação Direta / Admin'
      })));

      let rawBanks = banksRes.data || [];
      if (rawBanks.length === 0) {
        try {
          const fb = await supabaseAdmin.from('banks').select('*');
          if (fb.data) rawBanks = fb.data;
        } catch {}
      }
      setBanks(rawBanks);

      let rawMachines = machinesRes.data || [];
      if (rawMachines.length === 0) {
        try {
          const fb = await supabaseAdmin.from('machines').select('*');
          if (fb.data) rawMachines = fb.data;
        } catch {}
      }
      setMachines(rawMachines);
    } catch (err: any) {
      console.error('Erro ao buscar empréstimos:', err);
      addNotification('Erro ao sincronizar empréstimos: ' + err.message, 'alerta');
    } finally {
      setLoading(false);
    }
  }, [authUserEmail, currentUser?.perfil, currentUser?.id, currentUser?.email, addNotification]);

  useEffect(() => {
    fetchInitialData();

    // Sincronização em tempo real via Supabase Realtime Channels
    const channel = supabase
      .channel('loans-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          fetchInitialData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  // Atualização automática dos dados a cada 30 segundos e ao alternar de aba (sem F5)
  useAutoRefresh(fetchInitialData, 30000);

  const downloadReceipt = async (loan: LoanRequest) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date(loan.created_at).toLocaleDateString('pt-BR');
      const timeStr = new Date(loan.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const fin = calculateLoanFinancials(loan);
      const protocol = (loan.id || '').slice(0, 8).toUpperCase();
      const installments = fin.installments || 1;
      const installmentValue = fin.grossAmount / installments;

      // 1. Top Brand Stripe (Emerald Green #d97706)
      doc.setFillColor(0, 168, 89);
      doc.rect(0, 0, 210, 6, 'F');

      // 2. Clean Header (White Background)
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 6, 210, 38, 'F');

      // Load and render CM CRED Logo
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/cmcred-logo.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          doc.addImage(logoImg, 'PNG', 15, 10, 24, 24);
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text('CM CRED', 42, 22);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(180, 83, 9);
          doc.text('SOLUÇÕES FINANCEIRAS', 42, 28);
        } else {
          doc.setTextColor(217, 119, 6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(22);
          doc.text('CM CRED', 15, 24);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text('SOLUÇÕES FINANCEIRAS', 15, 31);
        }
      } catch (e) {
        doc.setTextColor(217, 119, 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('CM CRED', 15, 24);
      }

      // Header Right Metadata
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPROVANTE DE OPERAÇÃO', 195, 18, { align: 'right' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 168, 89);
      doc.text(`Protocolo: #${protocol}`, 195, 25, { align: 'right' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Emissão: ${dateStr} às ${timeStr}`, 195, 31, { align: 'right' });

      // Thin separator line
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(15, 42, 195, 42);

      // 3. Highlighted Hero Cards (Repasse PIX & Parcelamento)
      // Card 1: Valor Liberado PIX (Left)
      doc.setFillColor(240, 253, 244); // light emerald green
      doc.setDrawColor(0, 168, 89); // emerald green border
      doc.setLineWidth(0.6);
      doc.roundedRect(15, 48, 88, 32, 3, 3, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text('VALOR CREDITADO AO CLIENTE (PIX)', 20, 57);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 168, 89);
      doc.text(`R$ ${fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 68);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Disponibilizado na conta do titular', 20, 74);

      // Card 2: Plano de Pagamento no Cartão (Right - NO BLUE!)
      doc.setFillColor(248, 250, 252); // light slate
      doc.setDrawColor(203, 213, 225); // slate border
      doc.roundedRect(107, 48, 88, 32, 3, 3, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('PLANO DE PARCELAMENTO NO CARTÃO', 112, 57);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // Deep Navy / Slate (NO BLUE!)
      doc.text(`${installments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 112, 68);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Autorizado: R$ ${fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 112, 74);

      // 4. Section Title: Detalhes da Contratação
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('DETALHAMENTO DA TRANSAÇÃO', 15, 90);

      // 5. Clean Detailed Table (Customer-Safe: NO internal fees/MDR/profit)
      const clientData = [
        ['Beneficiário / Titular:', loan.lead_name || 'Cliente Portador'],
        ['Modalidade da Operação:', 'Troca de Limite / Cartão de Crédito'],
        ['Bandeira Autorizada:', fin.cardBrand || 'VISA / MASTERCARD'],
        ['Número de Parcelas:', `${installments} parcelas mensais`],
        ['Valor da Parcela:', `R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Valor Total no Cartão (Fatura):', `R$ ${fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Valor Líquido Creditado (PIX):', `R$ ${fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Forma de Liberação:', 'Transferência Instantânea via Chave PIX'],
        ['Data e Hora da Operação:', `${dateStr} às ${timeStr}`],
        ['Status da Transação:', (statusConfig[loan.status]?.label || loan.status || 'Concluído').toUpperCase()]
      ];

      autoTable(doc, {
        startY: 94,
        margin: { left: 15, right: 15 },
        body: clientData,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 3.8,
          textColor: [30, 41, 59],
          lineColor: [241, 245, 249],
          lineWidth: 0.3
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 75 },
          1: { fontStyle: 'bold', textColor: [15, 23, 42], halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;

      // 6. Security & Authenticity Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, finalY, 180, 26, 2, 2, 'FD');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text('AUTENTICAÇÃO DIGITAL & SEGURANÇA', 20, finalY + 7);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Código de Validação: CMCRED-${protocol}-${Date.now().toString().slice(-6)}`, 20, finalY + 13);
      doc.text('Operação registrada eletronicamente pela CM CRED. O valor parcelado será lançado na fatura mensal do cartão.', 20, finalY + 18);
      doc.text('Para dúvidas ou suporte, entre em contato com a equipe de atendimento CM CRED via WhatsApp (79) 99862-7907.', 20, finalY + 23);

      // 7. Footer
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('CMCred Soluções Financeiras — Todos os direitos reservados.', 105, 285, { align: 'center' });

      doc.save(`comprovante-cmcred-${protocol}.pdf`);
      addNotification('Comprovante do cliente gerado com sucesso!', 'sucesso');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      addNotification('Erro ao gerar comprovante: ' + error.message, 'alerta');
    }
  };

  const downloadReport = () => {
    try {
      const doc = new jsPDF('landscape');
      const dateStr = new Date().toLocaleString('pt-BR');

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 297, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('CM CRED - RELATÓRIO DE OPERAÇÕES', 15, 25);
      
      doc.setFontSize(10);
      doc.text(`Período do Filtro: ${dateFilter.toUpperCase()} | Emitido em: ${dateStr}`, 15, 35);

      const tableData = filtered.map(l => {
           const fin = calculateLoanFinancials(l);
           return [
          (l.id || '').slice(0, 8).toUpperCase(),
          new Date(l.created_at).toLocaleDateString('pt-BR'),
          l.lead_name || 'Portador',
          l.consultant_name || 'Admin',
          l.machine_name || 'N/A',
          `${fin.installments}x`,
          `R$ ${fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `- R$ ${fin.machineFeeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fin.machineFeeRate.toFixed(1)}%)`,
          `R$ ${fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${fin.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          (statusConfig[l.status]?.label || l.status || 'Concluído').toUpperCase()
        ];
      });

      autoTable(doc, {
        startY: 60,
        head: [['CONTRATO', 'DATA', 'CLIENTE', 'OPERADOR', 'MAQUININHA', 'VEZES', 'CARTÃO (BRUTO)', 'RETENÇÃO MÁQ.', 'PIX CLIENTE', 'LUCRO REAL', 'STATUS']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8 }
      });

      doc.save(`relatorio-${Date.now()}.pdf`);
    } catch (error: any) {
      addNotification('Erro ao gerar relatório: ' + error.message, 'alerta');
    }
  };

  const handleDeleteLoan = async (id: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja excluir este registro permanentemente?');
    if (!confirmed) return;
    try {
      await supabase.from('finance').delete().eq('loan_id', id);
      const { error } = await supabase.from('loans').delete().eq('id', id);
      if (error) throw error;
      addNotification('Contrato removido com sucesso!', 'sucesso');
      await logAudit('exclusão_empréstimo', `Contrato ${id.slice(0, 8)} removido pelo usuário`);
      fetchInitialData();
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      addNotification('Erro ao excluir: ' + err.message, 'alerta');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: LoanStatus, obs?: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (obs !== undefined) updateData.observations = obs;
      const { error } = await supabase.from('loans').update(updateData).eq('id', id);
      if (error) throw error;
      addNotification(`Status atualizado para "${statusConfig[newStatus]?.label || newStatus}"`, 'sucesso');
      await logAudit('atualização_status', `Contrato ${id.slice(0, 8)} alterado para ${newStatus}`);
      fetchInitialData();
      setSelected(null);
    } catch (err: any) {
      addNotification('Erro ao atualizar: ' + err.message, 'alerta');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '0.85rem 1rem',
    color: '#0f172a',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    fontWeight: 600,
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
  };

  const filtered = loans.filter(l => {
    const s = search.toLowerCase();
    const matchSearch = (l.lead_name || '').toLowerCase().includes(s) || 
                        (l.id || '').toLowerCase().includes(s) ||
                        (l.machine_name || '').toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    
    let matchDate = true;
    if (dateFilter !== 'all') {
      const d = new Date(l.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        matchDate = d >= today;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchDate = d >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        matchDate = d >= monthAgo;
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const isAdmin = authUserEmail?.toLowerCase().startsWith('admin@') || 
                  currentUser?.email?.toLowerCase() === 'caique@cmcred.com.br' || 
                  currentUser?.perfil === 'admin';

  const totals = filtered.reduce((acc, l) => {
    const fin = calculateLoanFinancials(l);
    acc.gross += fin.grossAmount;
    acc.net += fin.netAmount;
    acc.operationProfit += fin.operationProfit;
    acc.machineFee += fin.machineFeeAmount;
    acc.companyProfit += fin.companyNetProfit;
    if (isAdmin || l.consultant_id === currentUser?.id) {
      acc.commission += fin.commissionAmount;
    }
    return acc;
  }, { gross: 0, net: 0, operationProfit: 0, machineFee: 0, companyProfit: 0, commission: 0 });

  const totalApproved = totals.gross;
  const totalRequested = totals.net;
  const totalPIX = totals.net;
  const totalGrossProfit = Number(totals.operationProfit.toFixed(2));
  const totalMachineFee = Number(totals.machineFee.toFixed(2));
  const totalCompanyProfit = Number(totals.companyProfit.toFixed(2));
  const totalCommission = Number(totals.commission.toFixed(2));

  return (
    <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '2rem', fontWeight: 900 }}>Gestão de Empréstimos</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem', fontWeight: 600 }}>Acompanhamento e auditoria de contratos realizados</p>
        </div>
        {isAdmin && (
          <button onClick={downloadReport} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.5rem', background: '#0f172a', color: '#fff', borderRadius: '12px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>
            <Download size={18} /> Exportar Relatório
          </button>
        )}
      </header>

      {/* Stats Cards (5 Financial KPIs para Admin / 3 a 4 KPIs para Consultores) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
        <div style={{ background: '#0f172a', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isAdmin ? 'Passagem no Cartão (Bruto)' : 'Meu Volume no Cartão'}</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>R$ {totalApproved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>Volume total passado</div>
        </div>
        <div style={{ background: '#0284c7', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(2,132,199,0.12)' }}>
            <div style={{ color: '#bae6fd', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isAdmin ? 'Repasse PIX ao Cliente' : 'Meus Repasses PIX'}</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>R$ {totalRequested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: '0.72rem', color: '#e0f2fe', marginTop: '0.25rem', fontWeight: 600 }}>Líquido liberado</div>
        </div>

        {isAdmin ? (
          <>
            <div style={{ background: '#475569', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(71,85,105,0.08)' }}>
                <div style={{ color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ganhos / Juros Brutos</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem', color: '#38bdf8' }}>+ R$ {totalGrossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem', fontWeight: 600 }}>Spread cobrado do cliente</div>
            </div>
            <div style={{ background: '#b91c1c', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(185,28,28,0.12)' }}>
                <div style={{ color: '#fecaca', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Retenção Máquinas (MDR)</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>- R$ {totalMachineFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: '0.25rem', fontWeight: 600 }}>Taxas retidas pelas adquirentes</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #d97706 0%, #059669 100%)', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 8px 16px rgba(0,168,89,0.2)' }}>
                <div style={{ color: '#dcfce7', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lucro Real CM CRED (Acumulado)</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, marginTop: '0.35rem' }}>R$ {totalCompanyProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.72rem', color: '#bbf7d0', marginTop: '0.25rem', fontWeight: 700 }}>Líquido retido na empresa</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: '#0f172a', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contratos Realizados</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>{filtered.length} contratos</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>Empréstimos concedidos</div>
            </div>

            <div style={{ background: '#2563eb', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.15)' }}>
              <div style={{ color: '#bfdbfe', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Bruto (Cartão)</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>R$ {totalApproved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '0.72rem', color: '#93c5fd', marginTop: '0.25rem', fontWeight: 600 }}>Total a passar no cartão</div>
            </div>

            <div style={{ background: '#059669', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(5,150,105,0.15)' }}>
              <div style={{ color: '#a7f3d0', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Repassado (PIX)</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>R$ {totalPIX.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: '0.72rem', color: '#6ee7b7', marginTop: '0.25rem', fontWeight: 600 }}>Líquido concedido aos clientes</div>
            </div>

            <div style={{ background: '#0284c7', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(2,132,199,0.15)' }}>
              <div style={{ color: '#bae6fd', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticket Médio Concedido</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>
                R$ {(filtered.length ? (totalPIX / filtered.length) : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#7dd3fc', marginTop: '0.25rem', fontWeight: 600 }}>Média liberada por operação</div>
            </div>

            {totalCommission > 0 && (
              <div style={{ background: '#d97706', borderRadius: '20px', padding: '1.25rem', color: '#fff', boxShadow: '0 4px 12px rgba(217,119,6,0.15)' }}>
                <div style={{ color: '#fef3c7', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Minha Comissão Estimada</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '0.35rem' }}>R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.72rem', color: '#fde68a', marginTop: '0.25rem', fontWeight: 600 }}>Comissão acumulada na sua produção</div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '6rem', textAlign: 'center', color: '#d97706', fontWeight: 800 }}>SINCRONIZANDO...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {(isAdmin 
                    ? ['Contrato', 'Cliente', 'Operador / Responsável', 'Maquininha', 'Vezes', 'Cartão (Bruto)', 'Retenção Máq.', 'Repasse PIX', 'Lucro Real', 'Status', 'Emissão', 'Ações']
                    : ['Contrato', 'Cliente', 'Operador / Responsável', 'Maquininha', 'Vezes', 'Cartão (Bruto)', 'Repasse PIX', 'Status', 'Emissão', 'Ações']
                  ).map((h, idx) => (
                    <th key={h} style={{ 
                      padding: '1.25rem 0.85rem', 
                      color: '#64748b', 
                      textAlign: idx >= 5 && idx <= (isAdmin ? 8 : 6) ? 'right' : 'left', 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      fontSize: '0.72rem', 
                      borderBottom: '2px solid #f1f5f9',
                      paddingLeft: idx === 0 ? '1.5rem' : '0.85rem'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(loan => {
                  const fin = calculateLoanFinancials(loan);
                  const badge = statusConfig[loan.status] || { color: '#475569', bg: '#f1f5f9', icon: <Clock size={14} />, label: loan.status || 'Concluído' };

                  return (
                    <tr key={loan.id} style={{ transition: 'background 0.2s' }} className="loan-row">
                      <td style={{ padding: '1.25rem 0.85rem', paddingLeft: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace' }}>#{((loan.id || '').slice(0,8)).toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>{loan.lead_name || 'Portador'}</div>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <User size={13} color="#0284c7" />
                          {loan.consultant_name || 'Operação Direta / Admin'}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Smartphone size={13} color="#0284c7" /> {loan.machine_name || 'Stone Smart POS'}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>
                          {fin.installments}x
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                        <div style={{ color: '#1e40af', fontWeight: 900, fontSize: '0.95rem' }}>R$ {fin.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                          <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.9rem' }}>- R$ {fin.machineFeeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 600 }}>({fin.machineFeeRate.toFixed(1)}%)</div>
                        </td>
                      )}
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                        <div style={{ color: '#047857', fontWeight: 900, fontSize: '0.95rem' }}>R$ {fin.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                          <div style={{ color: '#d97706', fontWeight: 900, fontSize: '1rem' }}>R$ {fin.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </td>
                      )}
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ 
                          background: badge.bg, 
                          color: badge.color, 
                          padding: '0.4rem 0.8rem', 
                          borderRadius: '10px', 
                          fontWeight: 800, 
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          {badge.icon}
                          {badge.label.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                          <Calendar size={13} />
                          {new Date(loan.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => {
                              setSelected(loan);
                              setEditingMessage(defaultMessages[0]);
                            }}
                            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '0.5rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Gerenciar Operação"
                          >
                            <MessageSquare size={14} /> Detalhes
                          </button>
                          <button 
                            onClick={() => downloadReceipt(loan)}
                            style={{ background: '#d97706', border: 'none', color: '#fff', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Baixar Comprovante PDF"
                          >
                            <FileDown size={15} />
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteLoan(loan.id)}
                              style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                              title="Excluir Registro"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#ffffff', padding: '2.5rem', borderRadius: '32px', width: '95%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ color: '#0f172a', margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Gerenciar Operação</h3>
                <p style={{ color: '#64748b', fontWeight: 700, margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Protocolo: {(selected.id || '').split('-')[0].toUpperCase()}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 800 }}>FECHAR</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
               <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Cliente</div>
                  <div style={{ color: '#0f172a', fontWeight: 800 }}>{selected.lead_name || 'Cliente Portador'}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{(selected as any).lead_phone || 'Telefone não cadastrado'}</div>
               </div>
               <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Valor Repasse (PIX)</div>
                  <div style={{ color: '#d97706', fontWeight: 900 }}>R$ {Number(selected.requested_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{selected.installments || 1}x {(selected.type || 'Cartão').toUpperCase()}</div>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', color: '#0f172a', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 900 }}>ATUALIZAR STATUS</label>
                <select defaultValue={selected.status} id="status_update" style={{ ...inputStyle, height: '48px', marginBottom: 0 }}>
                  {Object.keys(statusConfig).map(s => (
                    <option key={s} value={s}>{statusConfig[s as LoanStatus]?.label || s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#0f172a', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 900 }}>OBSERVAÇÃO INTERNA</label>
                <input id="obs_update" defaultValue={selected.observations || ''} style={{ ...inputStyle, height: '48px', marginBottom: 0 }} placeholder="Notas privadas..." />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginTop: '1rem' }}>
              <label style={{ color: '#0f172a', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={16} color="#2563eb" /> COMUNICAÇÃO COM O CLIENTE
              </label>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {defaultMessages.map((msg, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setEditingMessage(msg)}
                    style={{ 
                      padding: '0.5rem 0.75rem', 
                      background: editingMessage === msg ? '#eff6ff' : '#f8fafc', 
                      border: editingMessage === msg ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      borderRadius: '8px', 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      color: editingMessage === msg ? '#2563eb' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Modelo {idx + 1}
                  </button>
                ))}
              </div>

              <textarea 
                value={editingMessage}
                onChange={e => setEditingMessage(e.target.value)}
                style={{ ...inputStyle, height: '90px', resize: 'none', marginBottom: '1rem' }}
                placeholder="Escreva uma mensagem..."
              />

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const phone = (selected as any).lead_phone?.replace(/\D/g, '');
                    if (!phone) return addNotification('Cliente sem telefone cadastrado', 'alerta');
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(editingMessage)}`, '_blank');
                  }}
                  style={{ flex: 1, background: '#d97706', color: '#fff', border: 'none', padding: '0.85rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Smartphone size={18} /> Enviar via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const statusEl = document.getElementById('status_update') as HTMLSelectElement;
                    const obsEl = document.getElementById('obs_update') as HTMLInputElement;
                    handleUpdateStatus(selected.id, statusEl.value as LoanStatus, obsEl.value);
                  }}
                  style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.85rem 1.5rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Salvar Alterações
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LoanRequests;
