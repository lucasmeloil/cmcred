import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FileDown, 
  Printer, 
  Search, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  FileSpreadsheet, 
  Table, 
  Wallet, 
  Users, 
  Cpu,
  Percent,
  TrendingDown,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { calculateLoanFinancials, groupLoansByMachine, MachineSettlementSummary } from '../lib/rates';
import { MachineSettlementAlertBanner } from './MachineSettlementAlertBanner';
import { useAutoRefresh } from '../lib/useAutoRefresh';

interface LoanReportRow {
  id: string;
  createdAt: string;
  clientName: string;
  clientCpf: string;
  consultantName: string;
  machineName: string;
  cardFlag: string;
  cardBrand: string;
  cardDigits: string;
  cardInfo: string;
  installments: number;
  interestRate: number;
  grossAmount: number; // Valor do Empréstimo / Total no Cartão
  machineFeeRate: number; // Taxa % Retida pela Maquininha
  machineFeeAmount: number; // Valor R$ Retido pela Maquininha
  machineNetReceipt: number; // Valor Líquido que a Maquininha vai depositar para a CM CRED
  netAmount: number; // Valor Repassado ao Cliente (PIX)
  profit: number; // Ganhos / Juros Brutos
  commission: number; // Comissão do Operador
  companyNetProfit: number; // Lucro Líquido Real da CM CRED
  status: string;
  observations: string;
  settlementStatus: string;
  settlementDueDate: string;
  isSettled: boolean;
  settledAt: string | null;
  liquidationDays: number;
}

const ReportsManager: React.FC = () => {
  const { addNotification, logAudit } = useAuth();
  
  // Data State
  const [loans, setLoans] = useState<any[]>([]);
  const [finance, setFinance] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'rejected'>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const hasLoadedOnceRef = React.useRef(loans.length > 0);

  // Fetch initial data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!hasLoadedOnceRef.current && !isSilent) {
      setLoading(true);
    }
    try {
      const [loansRes, financeRes, profilesRes] = await Promise.all([
        supabase.from('loans').select('*, leads(name, cpf), customers(name, cpf), banks(name), machines(name, fee_percentage, installment_fees, liquidation_days), profiles:consultant_id(full_name)').order('created_at', { ascending: false }),
        supabase.from('finance').select('*').order('due_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role')
      ]);

      if (loansRes.data) {
        setLoans(loansRes.data);
      }
      if (financeRes.data) {
        setFinance(financeRes.data);
      }
      if (profilesRes.data) setConsultants(profilesRes.data.filter(p => p.role === 'consultant' || p.role === 'admin' || p.role === 'manager' || p.role === 'operator'));
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      console.error('Erro ao buscar dados do relatório:', err);
      if (!hasLoadedOnceRef.current) {
        addNotification('Erro ao carregar dados: ' + err.message, 'alerta');
      }
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchData();

    // Sincronização em tempo real via Supabase Realtime Channels
    const channel = supabase
      .channel('reports-realtime-channel')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Atualização automática dos relatórios ao alternar de aba (sem F5)
  useAutoRefresh(fetchData, 30000);

  // Processar lista de operações com cálculo rigoroso de retenção da maquininha e lucro real
  const loansReportList = useMemo<LoanReportRow[]>(() => {
    return loans.map(l => {
      const clientName = l.customers?.name || l.leads?.name || 'Cliente Portador';
      const clientCpf = l.customers?.cpf || l.leads?.cpf || '—';
      const consultantName = l.profiles?.full_name || 'Operação Direta / Admin';
      const machineName = l.machines?.name || 'Stone Smart POS';
      
      const fin = calculateLoanFinancials(l);

      let cardDigits = '';
      if (l.observations) {
        const digitsMatch = l.observations.match(/Final Cartão:\s*([^|]+)/i);
        if (digitsMatch && digitsMatch[1] && digitsMatch[1].trim() !== 'N/A') cardDigits = digitsMatch[1].trim();
      }
      const cardInfo = cardDigits ? `${fin.cardBrand} (•••• ${cardDigits})` : fin.cardBrand;

      return {
        id: l.id,
        createdAt: l.created_at,
        clientName,
        clientCpf,
        consultantName,
        machineName,
        cardFlag: fin.cardBrand,
        cardBrand: fin.cardBrand,
        cardDigits,
        cardInfo,
        installments: fin.installments,
        interestRate: fin.interestRate,
        grossAmount: fin.grossAmount,
        machineFeeRate: fin.machineFeeRate,
        machineFeeAmount: fin.machineFeeAmount,
        machineNetReceipt: fin.machineNetReceipt,
        netAmount: fin.netAmount,
        profit: fin.operationProfit,
        commission: fin.commissionAmount,
        companyNetProfit: fin.companyNetProfit,
        status: l.status || 'completed',
        observations: l.observations || '',
        settlementStatus: fin.settlementStatus,
        settlementDueDate: fin.settlementDueDate,
        isSettled: fin.isSettled,
        settledAt: fin.settledAt,
        liquidationDays: fin.liquidationDays
      };
    });
  }, [loans]);

  // Filtrar operações
  const filteredLoans = useMemo(() => {
    return loansReportList.filter(l => {
      // 1. Período
      const d = new Date(l.createdAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let matchPeriod = true;
      if (period === 'today') {
        matchPeriod = d >= today;
      } else if (period === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchPeriod = d >= weekAgo;
      } else if (period === 'month') {
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        matchPeriod = d >= monthAgo;
      } else if (period === 'year') {
        const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        matchPeriod = d >= yearAgo;
      } else if (period === 'custom' && startDate && endDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        matchPeriod = d >= s && d <= e;
      }

      // 2. Status
      let matchStatus = true;
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed') matchStatus = l.status === 'completed' || l.status === 'approved';
        else if (statusFilter === 'pending') matchStatus = l.status === 'pending' || l.status === 'in analysis';
        else matchStatus = l.status === 'rejected';
      }

      // 3. Consultor
      let matchConsultant = true;
      if (consultantFilter !== 'all') {
        const loanRaw = loans.find(raw => raw.id === l.id);
        matchConsultant = loanRaw?.consultant_id === consultantFilter;
      }

      // 4. Busca Livre
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        l.clientName.toLowerCase().includes(term) || 
        l.clientCpf.toLowerCase().includes(term) ||
        l.consultantName.toLowerCase().includes(term) ||
        l.machineName.toLowerCase().includes(term) ||
        l.id.toLowerCase().includes(term);

      return matchPeriod && matchStatus && matchConsultant && matchSearch;
    });
  }, [loansReportList, period, startDate, endDate, statusFilter, consultantFilter, searchTerm, loans]);

  // Totais agregados
  const totals = useMemo(() => {
    let totalGross = 0;
    let totalMachineFee = 0;
    let totalMachineNet = 0;
    let totalNet = 0;
    let totalProfit = 0;
    let totalCommissions = 0;
    let totalCompanyNet = 0;

    filteredLoans.forEach(l => {
      if (l.status === 'rejected') return;
      totalGross += l.grossAmount;
      totalMachineFee += l.machineFeeAmount;
      totalMachineNet += l.machineNetReceipt;
      totalNet += l.netAmount;
      totalProfit += l.profit;
      totalCommissions += l.commission;
      totalCompanyNet += l.companyNetProfit;
    });

    return {
      count: filteredLoans.length,
      totalGross,
      totalMachineFee,
      totalMachineNet,
      totalNet,
      totalProfit,
      totalCommissions,
      totalCompanyNet
    };
  }, [filteredLoans]);

  // Resumo de Conciliação e Valores a Receber por Maquininha (D+1 / D+0)
  const machineSettlementList = useMemo(() => {
    return groupLoansByMachine(filteredLoans.filter(l => l.status !== 'rejected'));
  }, [filteredLoans]);

  // EXPORTADOR EXCEL FORMATADO COM CORES, RETENÇÃO DE MAQUININHA E LUCRO LÍQUIDO REAL
  const exportFormattedExcel = async () => {
    try {
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const timeStr = new Date().toLocaleTimeString('pt-BR');

      const formatBRL = (val: number) => {
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const excelHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Relatório de Operações</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; }
    .header-banner { background-color: #d97706; color: #ffffff; font-size: 16pt; font-weight: bold; padding: 12px; text-align: center; }
    .sub-banner { background-color: #fffbeb; color: #b45309; font-size: 10pt; font-weight: bold; text-align: center; padding: 6px; }
    .kpi-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #64748b; }
    .kpi-card-blue { background-color: #dbeafe; color: #1e40af; font-size: 12pt; font-weight: bold; border: 1.5px solid #3b82f6; text-align: center; padding: 8px; }
    .kpi-card-red { background-color: #fee2e2; color: #dc2626; font-size: 12pt; font-weight: bold; border: 1.5px solid #ef4444; text-align: center; padding: 8px; }
    .kpi-card-green { background-color: #fffbeb; color: #b45309; font-size: 12pt; font-weight: bold; border: 1.5px solid #f59e0b; text-align: center; padding: 8px; }
    .kpi-card-emerald { background-color: #fef3c7; color: #92400e; font-size: 12pt; font-weight: bold; border: 1.5px solid #d97706; text-align: center; padding: 8px; }
    .kpi-card-amber { background-color: #fef3c7; color: #b45309; font-size: 12pt; font-weight: bold; border: 1.5px solid #f59e0b; text-align: center; padding: 8px; }
    .kpi-card-dark { background-color: #0f172a; color: #fbbf24; font-size: 13pt; font-weight: bold; border: 2px solid #d97706; text-align: center; padding: 8px; }
    th { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 10pt; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; }
    td { padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 10pt; mso-number-format: "\\@"; }
    .td-date { text-align: center; color: #475569; width: 140px; }
    .td-id { text-align: center; font-weight: bold; color: #64748b; width: 90px; }
    .td-name { text-align: left; font-weight: bold; color: #0f172a; width: 220px; }
    .td-cpf { text-align: center; color: #475569; width: 130px; }
    .td-op { text-align: left; color: #334155; font-weight: 600; width: 180px; }
    .td-machine { text-align: left; color: #0f172a; font-weight: 600; width: 160px; }
    .td-card-brand { text-align: center; font-weight: bold; background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; width: 170px; }
    .td-installments { text-align: center; font-weight: bold; background-color: #f1f5f9; color: #0f172a; width: 70px; }
    .td-rate { text-align: center; font-weight: bold; color: #dc2626; width: 80px; }
    .td-gross { text-align: right; font-weight: bold; background-color: #eff6ff; color: #1e40af; width: 150px; }
    .td-retention { text-align: right; font-weight: bold; background-color: #fef2f2; color: #dc2626; width: 140px; }
    .td-net { text-align: right; font-weight: bold; background-color: #fffbeb; color: #b45309; width: 150px; }
    .td-profit { text-align: right; font-weight: bold; background-color: #fef3c7; color: #92400e; width: 140px; }
    .td-comm { text-align: right; font-weight: bold; background-color: #fffbeb; color: #b45309; width: 130px; }
    .td-company { text-align: right; font-weight: bold; background-color: #fffbeb; color: #d97706; font-size: 11pt; border: 1.5px solid #d97706; width: 160px; }
    .td-status { text-align: center; font-weight: bold; width: 110px; }
    .status-completed { background-color: #fffbeb; color: #b45309; }
    .status-approved { background-color: #dbeafe; color: #1d4ed8; }
    .status-pending { background-color: #fef3c7; color: #b45309; }
    .status-rejected { background-color: #fee2e2; color: #b91c1c; }
    .total-row { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 11pt; }
    .total-row td { border: 1.5px solid #d97706; padding: 10px 8px; }
  </style>
</head>
<body>

  <!-- BANNER EXECUTIVO -->
  <table>
    <tr>
      <td colspan="15" class="header-banner">
        CM CRED — DEMONSTRATIVO CONSOLIDADO: CONTROLE FINANCEIRO & VALORES A RECEBER POR MAQUININHA
      </td>
    </tr>
    <tr>
      <td colspan="15" class="sub-banner">
        Gerado em: ${dateStr} às ${timeStr} | Filtro: ${period.toUpperCase()} | Total: ${totals.count} Operações Finalizadas
      </td>
    </tr>
    <tr><td colspan="15" style="height: 10px; border: none;"></td></tr>
  </table>

  <!-- QUADRO DE RESUMO GERAL (CARDS) -->
  <table>
    <tr>
      <td colspan="3" class="kpi-title" style="text-align: center;">TOTAL CARTÃO (BRUTO)</td>
      <td colspan="3" class="kpi-title" style="text-align: center;">A RECEBER MÁQUINAS (LÍQUIDO)</td>
      <td colspan="3" class="kpi-title" style="text-align: center;">REPASSE CLIENTES (PIX)</td>
      <td colspan="2" class="kpi-title" style="text-align: center;">COMISSÕES OPERADORES</td>
      <td colspan="4" class="kpi-title" style="text-align: center;">LUCRO LÍQUIDO REAL CM CRED</td>
    </tr>
    <tr>
      <td colspan="3" class="kpi-card-blue">R$ ${formatBRL(totals.totalGross)}</td>
      <td colspan="3" class="kpi-card-green">R$ ${formatBRL(totals.totalMachineNet)}</td>
      <td colspan="3" class="kpi-card-amber">R$ ${formatBRL(totals.totalNet)}</td>
      <td colspan="2" class="kpi-card-amber">R$ ${formatBRL(totals.totalCommissions)}</td>
      <td colspan="4" class="kpi-card-dark">R$ ${formatBRL(totals.totalCompanyNet)}</td>
    </tr>
    <tr><td colspan="15" style="height: 15px; border: none;"></td></tr>
  </table>

  <!-- CONCILIAÇÃO CONSOLIDADA POR MAQUININHA (D+1 / D+0) -->
  <table>
    <thead>
      <tr>
        <th colspan="6" style="background-color: #0f172a; color: #ffffff; text-align: left; padding: 8px 12px; font-size: 11pt;">
          CONCILIAÇÃO DE RECEBÍVEIS POR MAQUININHA (VALORES LÍQUIDOS A RECEBER NA CONTA BANCÁRIA)
        </th>
      </tr>
      <tr>
        <th style="width: 200px; background-color: #334155;">MAQUININHA POS</th>
        <th style="width: 90px; background-color: #334155;">OPERAÇÕES</th>
        <th style="width: 150px; background-color: #1e40af;">BRUTO NO CARTÃO</th>
        <th style="width: 130px; background-color: #b91c1c;">TAXA MDR TOTAL</th>
        <th style="width: 160px; background-color: #047857; color: #ffffff;">LÍQUIDO A RECEBER (CONTA)</th>
        <th style="width: 150px; background-color: #d97706; color: #ffffff;">LUCRO REAL CM CRED</th>
      </tr>
    </thead>
    <tbody>
      ${machineSettlementList.map(m => `
      <tr>
        <td style="font-weight: bold;">${m.machineName}</td>
        <td style="text-align: center;">${m.count}</td>
        <td style="text-align: right; color: #1e40af; font-weight: bold;">R$ ${formatBRL(m.totalGross)}</td>
        <td style="text-align: right; color: #b91c1c;">- R$ ${formatBRL(m.totalFee)}</td>
        <td style="text-align: right; color: #047857; font-weight: bold; background-color: #ecfdf5;">R$ ${formatBRL(m.totalNetReceipt)}</td>
        <td style="text-align: right; color: #d97706; font-weight: bold;">R$ ${formatBRL(m.totalCompanyNetProfit)}</td>
      </tr>`).join('')}
    </tbody>
    <tr><td colspan="6" style="height: 15px; border: none;"></td></tr>
  </table>

  <!-- TABELA PRINCIPAL DE LANÇAMENTOS -->
  <table>
    <thead>
      <tr>
        <th style="width: 140px;">DATA / HORA</th>
        <th style="width: 90px;">CONTRATO</th>
        <th style="width: 200px;">NOME DO CLIENTE</th>
        <th style="width: 120px;">CPF</th>
        <th style="width: 160px;">OPERADOR</th>
        <th style="width: 150px;">MAQUININHA POS</th>
        <th style="width: 160px; background-color: #4f46e5; color: #ffffff;">CARTÃO / BANDEIRA</th>
        <th style="width: 60px;">VEZES</th>
        <th style="width: 70px;">TAXA %</th>
        <th style="width: 150px; background-color: #1e40af;">CARTÃO (BRUTO)</th>
        <th style="width: 160px; background-color: #047857; color: #ffffff;">LÍQUIDO MÁQUINA (A RECEBER)</th>
        <th style="width: 140px; background-color: #92400e;">REPASSE (PIX)</th>
        <th style="width: 150px; background-color: #d97706; color: #ffffff;">LUCRO REAL CM CRED</th>
        <th style="width: 100px;">STATUS</th>
      </tr>
    </thead>
    <tbody>
      ${filteredLoans.map((l, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const dateFmt = new Date(l.createdAt).toLocaleDateString('pt-BR') + ' ' + new Date(l.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const statusClass = l.status === 'completed' ? 'status-completed' : l.status === 'approved' ? 'status-approved' : l.status === 'pending' ? 'status-pending' : 'status-rejected';
        const statusLabel = l.status === 'completed' ? 'Concluído' : l.status === 'approved' ? 'Aprovado' : l.status === 'pending' ? 'Pendente' : 'Recusado';

        return `
        <tr style="background-color: ${rowBg};">
          <td class="td-date">${dateFmt}</td>
          <td class="td-id">#${l.id.slice(0, 6).toUpperCase()}</td>
          <td class="td-name">${l.clientName}</td>
          <td class="td-cpf">${l.clientCpf}</td>
          <td class="td-op">${l.consultantName}</td>
          <td class="td-machine">${l.machineName}</td>
          <td class="td-card-brand">${l.cardInfo}</td>
          <td class="td-installments">${l.installments}x</td>
          <td class="td-rate">${l.interestRate.toFixed(2)}%</td>
          <td class="td-gross">R$ ${formatBRL(l.grossAmount)}</td>
          <td class="td-net" style="color: #047857; font-weight: bold; background-color: #ecfdf5;">R$ ${formatBRL(l.machineNetReceipt)} (taxa: -R$ ${formatBRL(l.machineFeeAmount)})</td>
          <td class="td-net">R$ ${formatBRL(l.netAmount)}</td>
          <td class="td-company">R$ ${formatBRL(l.companyNetProfit)}</td>
          <td class="td-status ${statusClass}">${statusLabel}</td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="9" style="text-align: right; padding-right: 15px;">
          TOTAIS CONSOLIDADOS (${totals.count} OPERAÇÕES):
        </td>
        <td style="text-align: right; background-color: #1e3a8a; color: #93c5fd;">
          R$ ${formatBRL(totals.totalGross)}
        </td>
        <td style="text-align: right; background-color: #064e3b; color: #86efac; font-weight: bold;">
          R$ ${formatBRL(totals.totalMachineNet)}
        </td>
        <td style="text-align: right; background-color: #78350f; color: #fde68a;">
          R$ ${formatBRL(totals.totalNet)}
        </td>
        <td style="text-align: right; background-color: #d97706; color: #ffffff; font-size: 12pt;">
          R$ ${formatBRL(totals.totalCompanyNet)}
        </td>
        <td style="text-align: center; background-color: #0f172a; color: #94a3b8;">
          100% OK
        </td>
      </tr>
    </tfoot>
  </table>

</body>
</html>
`;

      const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_Operacoes_CMCRED_${Date.now()}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await logAudit('exportação', `Planilha Excel com valores a receber por máquina exportada (${totals.count} registros).`);
      addNotification('Planilha Excel com Valores a Receber por Máquina exportada com sucesso!', 'sucesso');
    } catch (e: any) {
      addNotification('Erro ao exportar Excel: ' + e.message, 'alerta');
    }
  };

  // Exportar PDF
  const exportPDF = async () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4') as any;
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const timeStr = new Date().toLocaleTimeString('pt-BR');

      // Top Banner
      doc.setFillColor(217, 119, 6);
      doc.rect(0, 0, 297, 25, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('CM CRED — CONTROLE FINANCEIRO & VALORES A RECEBER POR MAQUININHA', 15, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Emissão: ${dateStr} às ${timeStr} | Total de Lançamentos: ${totals.count}`, 15, 20);

      // Resumo de Totais
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(15, 30, 267, 18, 2, 2, 'F');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cartão (Bruto): R$ ${totals.totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 41);
      doc.text(`A Receber Líquido: R$ ${totals.totalMachineNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 78, 41);
      doc.text(`PIX Clientes: R$ ${totals.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, 41);
      doc.text(`Lucro Real CM CRED: R$ ${totals.totalCompanyNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 202, 41);

      // Tabela de Dados
      const head = [['DATA', 'ID', 'CLIENTE', 'OPERADOR', 'MAQUININHA', 'BANDEIRA', 'VEZES', 'CARTÃO R$', 'A RECEBER MÁQ.', 'PIX R$', 'LUCRO REAL R$', 'STATUS']];
      const body = filteredLoans.map(l => [
        new Date(l.createdAt).toLocaleDateString('pt-BR'),
        `#${l.id.slice(0, 6).toUpperCase()}`,
        l.clientName.length > 15 ? l.clientName.slice(0, 15) + '...' : l.clientName,
        l.consultantName.length > 13 ? l.consultantName.slice(0, 13) + '...' : l.consultantName,
        l.machineName.length > 13 ? l.machineName.slice(0, 13) + '...' : l.machineName,
        l.cardInfo,
        `${l.installments}x`,
        `R$ ${l.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${l.machineNetReceipt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${l.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${l.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        l.status.toUpperCase()
      ]);

      autoTable(doc, {
        startY: 53,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8, halign: 'center' },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          7: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] },
          8: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
          9: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
          10: { halign: 'right', fontStyle: 'bold', textColor: [217, 119, 6] }
        },
        margin: { left: 15, right: 15 }
      });

      doc.save(`Relatorio_Operacoes_CMCRED_${Date.now()}.pdf`);
      await logAudit('exportação', `Relatório PDF consolidado exportado.`);
      addNotification('Relatório PDF exportado com sucesso!', 'sucesso');
    } catch (e: any) {
      addNotification('Erro ao exportar PDF: ' + e.message, 'alerta');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '0.65rem 0.9rem',
    color: '#0f172a',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontWeight: 600
  };

  return (
    <div style={{ padding: '2.5rem', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileDown size={34} color="#d97706" /> Central de Relatórios & Operações
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Visão estilo planilha com detalhamento de retenção da maquininha, valor repassado ao cliente (PIX) e lucro real da CM CRED
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={exportFormattedExcel}
            style={{ 
              background: '#d97706', 
              color: '#ffffff', 
              border: 'none', 
              padding: '0.85rem 1.5rem', 
              borderRadius: '14px', 
              fontWeight: 800, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.95rem',
              transition: 'all 0.2s',
              boxShadow: '0 8px 16px -4px rgba(217,119,6,0.35)'
            }}
          >
            <FileSpreadsheet size={18} /> Baixar Planilha Excel Formatada (.XLS)
          </button>
          
          <button 
            type="button"
            onClick={exportPDF}
            style={{ 
              background: '#ffffff', 
              color: '#0f172a', 
              border: '1.5px solid #cbd5e1', 
              padding: '0.85rem 1.4rem', 
              borderRadius: '14px', 
              fontWeight: 800, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.9rem', 
              transition: 'all 0.2s' 
            }}
          >
            <Printer size={18} /> Imprimir / PDF
          </button>
        </div>
      </header>

      {/* BANNER DE NOTIFICAÇÃO INTELIGENTE: CONFIRMAÇÃO DE RECEBIMENTO COM 1 CLIQUE */}
      <MachineSettlementAlertBanner loans={loans} onSettlementSuccess={fetchData} />

      {/* Cards de Totais Consolidado com Foco no Líquido a Receber e Lucro Real */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* Total Passado no Cartão */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '5px solid #2563eb', borderRadius: '18px', padding: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Valor no Cartão (Bruto)</span>
            <CreditCard size={18} color="#2563eb" />
          </div>
          <div style={{ color: '#1e40af', fontSize: '1.5rem', fontWeight: 900 }}>
            R$ {totals.totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Total transacionado nos clientes</span>
        </div>

        {/* Líquido a Receber das Maquininhas */}
        <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderLeft: '5px solid #059669', borderRadius: '18px', padding: '1.25rem', boxShadow: '0 4px 12px rgba(5,150,105,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ color: '#047857', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>A Receber das Máquinas (Líquido)</span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div style={{ color: '#047857', fontSize: '1.5rem', fontWeight: 900 }}>
            R$ {totals.totalMachineNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ color: '#64748b', fontSize: '0.73rem', fontWeight: 600 }}>
            Cai na conta após taxa de -R$ {totals.totalMachineFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Total Repassado ao Cliente PIX */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '5px solid #d97706', borderRadius: '18px', padding: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Repassado ao Cliente (PIX)</span>
            <Wallet size={18} color="#d97706" />
          </div>
          <div style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 900 }}>
            R$ {totals.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Total líquido liberado ao portador</span>
        </div>

        {/* Lucro Líquido Real da CM CRED */}
        <div style={{ background: '#ffffff', border: '2px solid #d97706', borderLeft: '6px solid #d97706', borderRadius: '18px', padding: '1.25rem', boxShadow: '0 8px 20px rgba(217,119,6,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ color: '#d97706', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>Lucro Real CM CRED</span>
            <DollarSign size={18} color="#d97706" />
          </div>
          <div style={{ color: '#0f172a', fontSize: '1.6rem', fontWeight: 900 }}>
            R$ {totals.totalCompanyNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ color: '#b45309', fontSize: '0.75rem', fontWeight: 800 }}>Líquido retido na empresa (Líquido Máq - PIX)</span>
        </div>

      </div>

      {/* Barra de Filtros Avançados */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
        
        <div>
          <label style={{ display: 'block', color: '#0f172a', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Período</label>
          <select value={period} onChange={e => setPeriod(e.target.value as any)} style={inputStyle}>
            <option value="today">Hoje</option>
            <option value="week">Últimos 7 Dias</option>
            <option value="month">Últimos 30 Dias</option>
            <option value="year">Último Ano</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div>
              <label style={{ display: 'block', color: '#0f172a', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Data Início</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#0f172a', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Data Fim</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        <div>
          <label style={{ display: 'block', color: '#0f172a', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Status da Operação</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={inputStyle}>
            <option value="all">Todos os Status</option>
            <option value="completed">Concluídos / Aprovados</option>
            <option value="pending">Pendentes</option>
            <option value="rejected">Recusados</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', color: '#0f172a', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Filtrar Operador / Consultor</label>
          <select value={consultantFilter} onChange={e => setConsultantFilter(e.target.value)} style={inputStyle}>
            <option value="all">Todos os Operadores</option>
            {consultants.map(c => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', color: '#0f172a', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Busca Rápida (Cliente, CPF, Maquininha ou ID)</label>
          <div style={{ position: 'relative' }}>
            <input 
              placeholder="Digite nome, CPF, maquininha ou código..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ ...inputStyle, paddingLeft: '2.5rem' }} 
            />
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

      </div>

      {/* PAINEL DE CONCILIAÇÃO POR MAQUININHA (A RECEBER LÍQUIDO D+1 / D+0) */}
      {machineSettlementList.length > 0 && (
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '24px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={22} color="#2563eb" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                  Conciliação & Valores a Receber por Maquininha (D+1 / D+0)
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  Valores líquidos que as adquirentes (Cielo, Rede, PagSeguro, Stone, etc.) depositarão na conta bancária da CM CRED já deduzidas as taxas.
                </p>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>
              Total Geral a Cair no Caixa: <strong style={{ color: '#047857', fontSize: '1.05rem', marginLeft: '4px' }}>R$ {totals.totalMachineNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1.1rem' }}>
            {machineSettlementList.map((m, idx) => (
              <div 
                key={idx}
                style={{ 
                  background: '#f8fafc', 
                  border: '1.5px solid #e2e8f0', 
                  borderRadius: '18px', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <CreditCard size={18} color="#2563eb" /> {m.machineName}
                  </span>
                  <span style={{ background: '#e2e8f0', color: '#334155', fontSize: '0.75rem', fontWeight: 800, padding: '3px 9px', borderRadius: '8px' }}>
                    {m.count} {m.count === 1 ? 'operação' : 'operações'}
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1.5px solid #bbf7d0', borderRadius: '14px', padding: '0.85rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                    Líquido a Receber na Conta (D+1 / D+0)
                  </span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#047857', marginTop: '0.2rem' }}>
                    R$ {m.totalNetReceipt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600, marginTop: '0.2rem' }}>
                    Taxa MDR retida: -R$ {m.totalFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', fontWeight: 700, padding: '0 0.2rem' }}>
                  <span>Passado no Cartão:</span>
                  <strong style={{ color: '#1e40af' }}>R$ {m.totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#d97706', fontWeight: 800, background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 10px', borderRadius: '8px' }}>
                  <span>Lucro Real CM CRED:</span>
                  <strong style={{ fontSize: '0.88rem' }}>R$ {m.totalCompanyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLANILHA DE OPERAÇÕES: VALORES A RECEBER E LUCRO REAL */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.04)' }}>
        
        {/* Cabeçalho da Planilha */}
        <div style={{ background: '#0f172a', color: '#ffffff', padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Table size={20} color="#d97706" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.5px' }}>
              Planilha de Lançamentos: Valores a Receber por Máquina & Lucro Real
            </h3>
          </div>
          <div style={{ background: '#d97706', color: '#fff', padding: '0.35rem 0.85rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>
            {filteredLoans.length} Operações Encontradas
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '5rem', textAlign: 'center', color: '#d97706', fontWeight: 800, fontSize: '1.1rem' }}>
            CARREGANDO PLANILHA DE OPERAÇÕES...
          </div>
        ) : filteredLoans.length === 0 ? (
          <div style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
            Nenhuma operação encontrada com os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Data / Hora</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Cliente</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>CPF</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Operador Responsável</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Maquininha</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0', background: '#eef2ff', color: '#4338ca' }}>Cartão / Bandeira</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>Vezes</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>Taxa %</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0', background: '#dbeafe', color: '#1e40af' }}>Valor Cartão (Bruto)</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0', background: '#ecfdf5', color: '#047857' }}>A Receber (Líquido Máquina)</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0', background: '#fffbeb', color: '#b45309' }}>Repasse PIX (Cliente)</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'right', borderRight: '1px solid #e2e8f0', background: '#fffbeb', color: '#d97706', fontWeight: 900 }}>Lucro Real CM CRED</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((l, index) => {
                  const isEven = index % 2 === 0;
                  const statusBadges: Record<string, { bg: string; color: string; label: string }> = {
                    completed: { bg: '#fffbeb', color: '#b45309', label: 'Concluído' },
                    approved: { bg: '#dbeafe', color: '#1d4ed8', label: 'Aprovado' },
                    pending: { bg: '#fef3c7', color: '#b45309', label: 'Pendente' },
                    rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Recusado' }
                  };
                  const badge = statusBadges[l.status] || { bg: '#f1f5f9', color: '#475569', label: l.status };

                  return (
                    <tr 
                      key={l.id} 
                      style={{ 
                        background: isEven ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        transition: 'background 0.15s'
                      }}
                      className="excel-row"
                    >
                      {/* Data / Hora */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {new Date(l.createdAt).toLocaleDateString('pt-BR')} <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(l.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>

                      {/* Cliente */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 800 }}>
                        {l.clientName}
                      </td>

                      {/* CPF */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600, fontSize: '0.8rem' }}>
                        {l.clientCpf}
                      </td>

                      {/* Operador */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', color: '#334155', fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Users size={13} color="#d97706" /> {l.consultantName}
                        </span>
                      </td>

                      {/* Maquininha */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Cpu size={13} color="#0284c7" /> {l.machineName}
                        </span>
                      </td>

                      {/* Cartão / Bandeira */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', background: isEven ? '#fafafe' : '#f3f4fd' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.35rem', 
                          background: '#eef2ff', 
                          color: '#4338ca', 
                          padding: '4px 9px', 
                          borderRadius: '8px', 
                          fontWeight: 800, 
                          fontSize: '0.75rem',
                          border: '1px solid #c7d2fe',
                          whiteSpace: 'nowrap'
                        }}>
                          <CreditCard size={13} color="#6366f1" /> {l.cardInfo}
                        </span>
                      </td>

                      {/* Vezes */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                        <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '3px 8px', borderRadius: '8px', fontWeight: 900, fontSize: '0.85rem' }}>
                          {l.installments}x
                        </span>
                      </td>

                      {/* Taxa */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>
                        {l.interestRate.toFixed(2)}%
                      </td>

                      {/* Valor Empréstimo (Cartão) */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', textAlign: 'right', color: '#1e40af', fontWeight: 900, background: isEven ? '#f0f7ff' : '#e6f0fd' }}>
                        R$ {l.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Líquido a Receber da Máquina */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', textAlign: 'right', background: isEven ? '#f0fdf4' : '#dcfce7' }}>
                        <div style={{ color: '#047857', fontWeight: 900, fontSize: '0.95rem' }}>
                          R$ {l.machineNetReceipt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                          Taxa: -R$ {l.machineFeeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({l.machineFeeRate.toFixed(1)}%)
                        </div>
                      </td>

                      {/* Repasse PIX Cliente */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', textAlign: 'right', color: '#b45309', fontWeight: 900, background: isEven ? '#fffbeb' : '#fef3c7' }}>
                        R$ {l.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Lucro Real CM CRED */}
                      <td style={{ padding: '0.85rem 0.75rem', borderRight: '1px solid #f1f5f9', textAlign: 'right', color: '#d97706', fontWeight: 900, fontSize: '0.98rem', background: '#fffbeb' }}>
                        R$ {l.companyNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                          <span style={{ background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: '8px', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                            {badge.label}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: l.isSettled ? '#ecfdf5' : '#fffbeb',
                            color: l.isSettled ? '#047857' : '#b45309',
                            border: `1px solid ${l.isSettled ? '#a7f3d0' : '#fde68a'}`
                          }}>
                            {l.isSettled ? '✓ Caixa Confirmado' : `⏳ D+${l.liquidationDays} (Pendente)`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Rodapé Somatório Estilo Excel */}
              <tfoot>
                <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 900, fontSize: '0.88rem' }}>
                  <td colSpan={8} style={{ padding: '1rem 0.75rem', textAlign: 'right', letterSpacing: '0.5px' }}>
                    TOTAIS CONSOLIDADOS ({totals.count} OPERAÇÕES):
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#60a5fa', background: '#1e293b' }}>
                    R$ {totals.totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#86efac', background: '#064e3b', fontWeight: 900 }}>
                    R$ {totals.totalMachineNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <div style={{ fontSize: '0.7rem', color: '#fca5a5', fontWeight: 600 }}>
                      Taxas: -R$ {totals.totalMachineFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#fbbf24', background: '#451a03' }}>
                    R$ {totals.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#ffffff', background: '#d97706', fontSize: '1.05rem' }}>
                    R$ {totals.totalCompanyNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>100% OK</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>

      <style>{`
        .excel-row:hover {
          background: #e2e8f0 !important;
        }
      `}</style>

    </div>
  );
};

export default ReportsManager;
