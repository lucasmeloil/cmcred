import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  Wallet,
  PlusCircle,
  ArrowUpCircle,
  CheckCircle2,
  FileText,
  Percent,
  Users,
  CreditCard,
  CalendarDays,
  Share2,
  TrendingUp,
  Coins,
  QrCode,
  Sparkles,
  UserCheck,
  Send,
  Lock,
  Cpu,
  ArrowRight,
  Calculator,
  Sliders,
  Copy
} from 'lucide-react';
import type { Lead, Customer, LoanType } from './types';
import {
  getRateForFlagAndInstallment,
  calculateLoanSimulation,
  buildWhatsAppSimulationMessage,
  getCustomCardFlags,
  fetchRatesFromDatabase,
  resolveMachineFeeRate,
  type CardFlagOption,
  type RateTableType,
  TABLE_OPTIONS
} from '../lib/rates';
import { useAutoRefresh } from '../lib/useAutoRefresh';

const CreateLoan: React.FC = () => {
  const { currentUser, addNotification, logAudit } = useAuth();
  const email = currentUser?.email?.toLowerCase() || '';
  const isAdmin = email === 'caique@cmcred.com.br' ||
    email.includes('caique') ||
    email.includes('admin') ||
    currentUser?.perfil === 'admin';
  const isConsultant = !isAdmin && currentUser?.perfil === 'consultant';

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Dados para selects
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [flags, setFlags] = useState<CardFlagOption[]>(getCustomCardFlags());

  // Modo de seleção de cliente
  const [selectionType, setSelectionType] = useState<'customer' | 'lead' | 'manual'>('customer');

  // Opções de Tabela de Taxas (Tabela 1 ou Tabela 2)
  const [rateTableType, setRateTableType] = useState<RateTableType>('tabela_1');

  // Tipo de cálculo oficial do Simulador HTML
  const [calculationMode, setCalculationMode] = useState<'Valor Líquido' | 'Valor Bruto'>('Valor Bruto');

  // Taxa customizada da maquininha (se o operador desejar ajustar manualmente)
  const [customMachineFeeRate, setCustomMachineFeeRate] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    customer_id: '' as string,
    lead_id: '' as string,
    manual_name: '',
    manual_cpf: '',
    manual_phone: '',
    pix_key: '',
    pix_key_type: 'CPF' as 'CPF' | 'Telefone' | 'E-mail' | 'Aleatória' | 'Chave/Conta',
    card_last_digits: '',
    card_flag_id: 'VISA_MASTER',
    machine_id: '' as string,
    machine_name: 'Stone Smart POS' as string,
    channel: 'Presencial (Máquina Balcão)' as string,
    requested_amount: 1800,
    installments: 8, // Quantidade de vezes (1 a 18x)
    interest_rate: 11.75,
    consultant_id: '' as string | null,
    observations: ''
  });

  const fetchData = async () => {
    try {
      const [leadsRes, customersRes, machinesRes, profilesRes] = await Promise.all([
        supabase.from('leads').select('*').order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('machines').select('id, name, fee_percentage, installment_fees, bank_id').order('name'),
        supabase.from('profiles').select('*').in('role', ['consultant', 'operator', 'manager', 'admin']).eq('status', 'active').order('full_name')
      ]);

      if (leadsRes.data) setLeads(leadsRes.data);
      if (customersRes.data) {
        setCustomers(customersRes.data);
        if (!formData.customer_id && customersRes.data.length > 0) {
          setFormData(prev => ({
            ...prev,
            customer_id: customersRes.data[0].id.toString(),
            pix_key: customersRes.data[0].pix_key || customersRes.data[0].cpf || ''
          }));
        }
      }
      if (machinesRes.data && machinesRes.data.length > 0) {
        setMachines(machinesRes.data);
        if (!formData.machine_id) {
          setFormData(prev => ({
            ...prev,
            machine_id: machinesRes.data[0].id.toString(),
            machine_name: machinesRes.data[0].name
          }));
        }
      } else {
        // Opções padrão
        const defaultMachines = [
          { id: 1, name: 'Moderninha Pro PagBank' },
          { id: 2, name: 'Stone Smart POS' },
          { id: 3, name: 'PagBank Pro 2' },
          { id: 4, name: 'Cielo Lio V2' },
          { id: 5, name: 'Rede Smart POS' },
          { id: 6, name: 'Ton T3 Smart' },
          { id: 7, name: 'Mercado Pago Point Pro' }
        ];
        setMachines(defaultMachines);
        if (!formData.machine_id) {
          setFormData(prev => ({ ...prev, machine_id: '1', machine_name: defaultMachines[0].name }));
        }
      }
      if (profilesRes.data) setConsultants(profilesRes.data);

      const { flags: dbFlags } = await fetchRatesFromDatabase();
      if (dbFlags && dbFlags.length > 0) {
        setFlags(dbFlags);
      } else {
        setFlags(getCustomCardFlags());
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    if (currentUser && ['consultant', 'operator', 'manager'].includes(currentUser.perfil)) {
      setFormData(prev => ({ ...prev, consultant_id: currentUser.id }));
    }

    const handleRatesUpdate = () => {
      setFlags(getCustomCardFlags());
      const updatedRate = getRateForFlagAndInstallment(formData.card_flag_id, formData.installments, rateTableType);
      setFormData(prev => ({ ...prev, interest_rate: updatedRate }));
    };
    window.addEventListener('cmcred_rates_updated', handleRatesUpdate);
    window.addEventListener('cmcred_flags_updated', handleRatesUpdate);
    window.addEventListener('cmcred_rates_updated', handleRatesUpdate);
    window.addEventListener('cmcred_flags_updated', handleRatesUpdate);
    return () => {
      window.removeEventListener('cmcred_rates_updated', handleRatesUpdate);
      window.removeEventListener('cmcred_flags_updated', handleRatesUpdate);
      window.removeEventListener('cmcred_rates_updated', handleRatesUpdate);
      window.removeEventListener('cmcred_flags_updated', handleRatesUpdate);
    };
  }, [currentUser, rateTableType]);

  // Atualização automática dos dados a cada 30 segundos e ao alternar de aba (sem F5)
  useAutoRefresh(fetchData, 30000);

  // Atualizar a taxa padrão automaticamente ao trocar de tabela, bandeira ou quantidade de vezes
  useEffect(() => {
    const defaultRate = getRateForFlagAndInstallment(formData.card_flag_id, formData.installments, rateTableType);
    setFormData(prev => ({ ...prev, interest_rate: defaultRate }));
  }, [formData.card_flag_id, formData.installments, rateTableType]);

  // Atualizar dados de PIX e cliente ao selecionar cliente existente
  const handleSelectCustomer = (customerId: string) => {
    const c = customers.find(item => item.id.toString() === customerId);
    if (c) {
      setFormData(prev => ({
        ...prev,
        customer_id: customerId,
        lead_id: '',
        manual_name: c.name || '',
        manual_cpf: c.cpf || '',
        manual_phone: c.phone || '',
        pix_key: c.pix_key || c.cpf || prev.pix_key
      }));
    }
  };

  // Atualizar dados ao selecionar lead
  const handleSelectLead = (leadId: string) => {
    const l = leads.find(item => item.id.toString() === leadId);
    if (l) {
      setFormData(prev => ({
        ...prev,
        lead_id: leadId,
        customer_id: '',
        manual_name: l.name || '',
        manual_cpf: l.cpf || '',
        manual_phone: l.phone || '',
        pix_key: l.pix_key || l.cpf || prev.pix_key
      }));
    }
  };

  // Formatação segura de moeda
  const formatCurrency = (val: number | undefined | null) => {
    const n = Number(val) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // CÁLCULO 100% BASEADO NA FÓRMULA OFICIAL DO HTML
  const simResult = useMemo(() => {
    return calculateLoanSimulation({
      valorDesejado: formData.requested_amount,
      parcelas: formData.installments,
      tipoCalculo: calculationMode,
      bandeiraCartao: formData.card_flag_id,
      tableType: rateTableType,
      customTaxa: formData.interest_rate
    });
  }, [formData.requested_amount, formData.installments, calculationMode, formData.card_flag_id, rateTableType, formData.interest_rate]);

  const currentInstallments = Number(formData.installments) || 1;
  const safeGrossAmount = simResult.valorTotal; // Total passado no cartão
  const pixToClient = simResult.valorSolicitado; // Valor liberado no PIX do cliente
  const installmentValue = simResult.valorParcela; // Valor de cada parcela mensal
  const operationProfit = simResult.valorJuros; // Ganhos totais da operação (Juros)

  // CÁLCULO PRECISO DA RETENÇÃO DA MAQUININHA (MDR)
  const selectedMach = machines.find(m => m.id.toString() === formData.machine_id);
  const machRetentionInfo = useMemo(() => {
    return resolveMachineFeeRate({
      machine: selectedMach,
      cardFlag: formData.card_flag_id,
      installments: currentInstallments,
      explicitRate: customMachineFeeRate !== null ? customMachineFeeRate : undefined,
      grossAmount: safeGrossAmount
    });
  }, [selectedMach, formData.card_flag_id, currentInstallments, customMachineFeeRate, safeGrossAmount]);

  const machFeePercent = machRetentionInfo.rate;
  const machineFeeAmount = machRetentionInfo.amount;

  // Cálculo da comissão do consultor/operador
  const selectedConsultant = consultants.find(c => c.id === formData.consultant_id);
  const consultantCommPercent = selectedConsultant?.commission_percentage || 0;
  const consultantCommission = operationProfit > 0 ? Number(((operationProfit * (consultantCommPercent / 100))).toFixed(2)) : 0;

  // Lucro Líquido Real que SOBRA para a CM CRED:
  // Ganhos (Juros) - Retenção da Maquininha (MDR) - Comissão do Operador
  const companyNetProfit = Number(Math.max(0, operationProfit - machineFeeAmount - consultantCommission).toFixed(2));

  const selectedFlagObj = flags.find(f => f.key === formData.card_flag_id) || flags[0] || { name: 'VISA / MASTER' };

  const handleShareWhatsApp = () => {
    const message = buildWhatsAppSimulationMessage({
      valorSolicitado: pixToClient,
      valorTotal: safeGrossAmount,
      parcelas: currentInstallments,
      valorParcela: installmentValue,
      bandeira: selectedFlagObj.name
    });

    let clientPhone = '';
    if (selectionType === 'customer') {
      const c = customers.find(item => item.id.toString() === formData.customer_id);
      clientPhone = c?.phone || '';
    } else if (selectionType === 'lead') {
      const l = leads.find(item => item.id.toString() === formData.lead_id);
      clientPhone = l?.phone || '';
    } else {
      clientPhone = formData.manual_phone || '';
    }

    const cleanPhone = clientPhone.replace(/\D/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    }
    window.open(url, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectionType === 'customer' && !formData.customer_id) return addNotification('Selecione um cliente cadastrado', 'alerta');
    if (selectionType === 'lead' && !formData.lead_id) return addNotification('Selecione um lead', 'alerta');
    if (selectionType === 'manual' && !formData.manual_name) return addNotification('Informe o nome do cliente', 'alerta');

    setLoading(true);

    try {
      let personName = '';
      if (selectionType === 'customer') {
        personName = customers.find(c => c.id.toString() === formData.customer_id)?.name || 'Cliente';
      } else if (selectionType === 'lead') {
        personName = leads.find(l => l.id.toString() === formData.lead_id)?.name || 'Lead';
      } else {
        personName = formData.manual_name;
      }

      const machineLabel = formData.machine_name || 'Maquininha Padrão';

      const insertLoan = {
        lead_id: selectionType === 'lead' ? formData.lead_id : null,
        customer_id: selectionType === 'customer' ? formData.customer_id : null,
        type: 'cartão' as LoanType,
        requested_amount: pixToClient, // Valor líquido do PIX repassado ao cliente
        approved_amount: safeGrossAmount, // Valor bruto passado no cartão
        gross_amount: safeGrossAmount,
        installments: formData.installments,
        interest_rate: formData.interest_rate,
        machine_id: formData.machine_id ? Number(formData.machine_id) || null : null,
        consultant_id: formData.consultant_id || (isConsultant ? currentUser?.id : null),
        machine_fee_percentage: machFeePercent,
        machine_fee_amount: machineFeeAmount,
        net_bank_amount: Number((safeGrossAmount - machineFeeAmount).toFixed(2)),
        observations: `${formData.observations ? formData.observations + ' | ' : ''}Maquininha: ${machineLabel} (Retenção ${machFeePercent.toFixed(2)}% = R$ ${machineFeeAmount.toFixed(2)}) | Bandeira: ${formData.card_flag_id} | Canal: ${formData.channel} | PIX: ${formData.pix_key || 'Não informado'} | Final Cartão: ${formData.card_last_digits || 'N/A'}`,
        profit: operationProfit,
        consultant_commission_amount: consultantCommission,
        company_net_profit: companyNetProfit,
        status: 'completed'
      };

      const { data: insertedLoans, error: loanError } = await supabase.from('loans').insert([insertLoan]).select();
      if (loanError) throw loanError;

      const createdLoanId = insertedLoans && insertedLoans[0] ? insertedLoans[0].id : null;

      // Lançamento automático no fluxo financeiro da empresa
      const financeEntries = [
        {
          loan_id: createdLoanId,
          description: `Repasse PIX ao Cliente: ${personName}`,
          amount: pixToClient,
          gross_amount: safeGrossAmount,
          due_date: new Date().toISOString().split('T')[0],
          type: 'payable',
          status: 'paid',
          category: 'Repasse PIX Cliente',
          machine_id: formData.machine_id ? Number(formData.machine_id) || null : null
        },
        {
          loan_id: createdLoanId,
          description: `Entrada Operação Cartão (${formData.installments}x) [${machineLabel}]: ${personName}`,
          amount: safeGrossAmount,
          gross_amount: safeGrossAmount,
          due_date: new Date().toISOString().split('T')[0],
          type: 'receivable',
          status: 'paid',
          category: 'Venda Cartão de Crédito',
          machine_id: formData.machine_id ? Number(formData.machine_id) || null : null
        }
      ];

      const { error: finError } = await supabase.from('finance').insert(financeEntries);
      if (finError) console.warn('Aviso financeiro:', finError.message);

      await logAudit('operação', `Empréstimo de R$ ${formatCurrency(safeGrossAmount)} em ${formData.installments}x (${machineLabel}) registrado para ${personName}`);
      addNotification(`Operação de ${formData.installments}x (${machineLabel}) finalizada para ${personName} com sucesso!`, 'sucesso');

      setSuccess(true);
      setFormData(prev => ({
        ...prev,
        manual_name: '',
        manual_cpf: '',
        requested_amount: 1000,
        installments: 4,
        observations: '',
        card_last_digits: ''
      }));
      fetchData();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      addNotification('Erro ao registrar operação: ' + (err.message || 'Erro desconhecido'), 'alerta');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '24px',
    padding: 'clamp(1.5rem, 3vw, 2.5rem)',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.04)',
    width: '100%',
    boxSizing: 'border-box'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.85rem 1rem',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    borderRadius: '12px',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: 700,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s'
  };

  const labelStyle: React.CSSProperties = {
    color: '#0f172a',
    fontSize: '0.78rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    letterSpacing: '0.5px'
  };

  return (
    <div style={{ padding: 'clamp(1rem, 2.5vw, 2.5rem)', width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box' }}>

      {/* Header */}
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', color: '#d97706', padding: '0.4rem 1rem', borderRadius: '30px', fontWeight: 800, fontSize: '0.8rem', marginBottom: '0.75rem', border: '1px solid #bbf7d0' }}>
          <Sparkles size={14} /> Cálculo Oficial do Simulador Integrado
        </div>
        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.35rem)', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Wallet size={36} color="#d29804ff" /> Lançar Operação CM Cred
        </h1>
        <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
          Selecione a quantidade de vezes (1x a 18x) e os valores de repasse ao cliente serão calculados instantaneamente
        </p>
      </header>

      <form onSubmit={handleSubmit} style={cardStyle}>

        {success && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #d97706', color: '#059669', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', textAlign: 'center', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 4px 12px rgba(0,168,89,0.15)' }}>
            <CheckCircle2 size={24} color="#d97706" /> Operação Finalizada com Sucesso! Contrato registrado no sistema.
          </div>
        )}

        {/* Seleção da Tabela de Taxas (Tabela 1 ou Tabela 2) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Sliders size={16} color="#d97706" /> Tabela de Taxas Aplicada:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {TABLE_OPTIONS.map(opt => {
              const isSelected = rateTableType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRateTableType(opt.id)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                    border: `2px solid ${isSelected ? '#d97706' : '#e2e8f0'}`,
                    background: isSelected ? '#f0fdf4' : '#ffffff',
                    color: isSelected ? '#d97706' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 4px 10px rgba(0,168,89,0.15)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '0.95rem', fontWeight: 900 }}>{opt.name}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isSelected ? '#059669' : '#94a3b8' }}>{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Alternância do Tipo de Cálculo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '2rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '16px' }}>
          <button
            type="button"
            onClick={() => setCalculationMode('Valor Líquido')}
            style={{
              padding: '0.9rem',
              borderRadius: '12px',
              border: 'none',
              background: calculationMode === 'Valor Líquido' ? '#d97706' : 'transparent',
              color: calculationMode === 'Valor Líquido' ? '#ffffff' : '#64748b',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: calculationMode === 'Valor Líquido' ? '0 4px 12px rgba(0,168,89,0.25)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <ArrowUpCircle size={16} /> Valor Líquido (Passar valor fechado no cartão)
          </button>
          <button
            type="button"
            onClick={() => setCalculationMode('Valor Bruto')}
            style={{
              padding: '0.9rem',
              borderRadius: '12px',
              border: 'none',
              background: calculationMode === 'Valor Bruto' ? '#d97706' : 'transparent',
              color: calculationMode === 'Valor Bruto' ? '#ffffff' : '#64748b',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: calculationMode === 'Valor Bruto' ? '0 4px 12px rgba(0,168,89,0.25)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <PlusCircle size={16} /> Valor Bruto (Cliente define quanto quer no PIX)
          </button>
        </div>

        {/* Grid Principal de Campos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.75rem', marginBottom: '2rem' }}>

          {/* Identificação do Cliente */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ ...labelStyle, margin: 0 }}><Users size={15} color="#d97706" /> Identificação do Portador / Cliente</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectionType('customer')}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: selectionType === 'customer' ? '#d97706' : '#e2e8f0',
                    color: selectionType === 'customer' ? '#fff' : '#64748b',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Clientes Cadastrados
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionType('lead')}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: selectionType === 'lead' ? '#d97706' : '#e2e8f0',
                    color: selectionType === 'lead' ? '#fff' : '#64748b',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Leads
                </button>
              </div>
            </div>

            {selectionType === 'customer' ? (
              <select
                style={{ ...inputStyle, height: '50px' }}
                value={formData.customer_id}
                onChange={e => handleSelectCustomer(e.target.value)}
                required
              >
                <option value="">Selecione o cliente na lista...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name} — CPF: {c.cpf || 'Não cadastrado'}
                  </option>
                ))}
              </select>
            ) : (
              <select
                style={{ ...inputStyle, height: '50px' }}
                value={formData.lead_id}
                onChange={e => handleSelectLead(e.target.value)}
                required
              >
                <option value="">Selecione o lead na lista...</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id.toString()}>
                    {l.name} — {l.phone || l.cpf || 'Lead'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Chave PIX do Cliente para Repasse */}
          <div>
            <label style={labelStyle}><QrCode size={15} color="#d97706" /> Chave PIX p/ Envio do Dinheiro</label>
            <input
              type="text"
              style={inputStyle}
              value={formData.pix_key}
              onChange={e => setFormData({ ...formData, pix_key: e.target.value })}
              placeholder="CPF, Telefone, E-mail ou Chave Aleatória"
            />
          </div>

          {/* Operador / Consultor */}
          <div>
            <label style={labelStyle}><UserCheck size={15} color="#d97706" /> Operador / Consultor Responsável</label>
            <select
              style={{ ...inputStyle, background: currentUser?.perfil === 'consultant' ? '#f8fafc' : '#ffffff', height: '50px' }}
              value={formData.consultant_id || ''}
              onChange={e => setFormData({ ...formData, consultant_id: e.target.value || null })}
              disabled={currentUser?.perfil === 'consultant'}
            >
              {!['consultant', 'operator', 'manager'].includes(currentUser?.perfil || '') && (
                <option value="">Operação Direta da Empresa (Sem Consultor)</option>
              )}
              {['consultant', 'operator', 'manager'].includes(currentUser?.perfil || '') ? (
                <option value={currentUser?.id}>{currentUser?.nome} (Sua Operação)</option>
              ) : (
                consultants.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.role.toUpperCase()}) {isAdmin ? `— ${c.commission_percentage}% de Comissão` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Valor Desejado */}
          <div>
            <label style={labelStyle}>
              {calculationMode === 'Valor Líquido' ? (
                <><ArrowUpCircle size={15} color="#d97706" /> Valor Desejado (R$)</>
              ) : (
                <><PlusCircle size={15} color="#2563eb" /> Valor Desejado no PIX (R$)</>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: '#d97706', fontSize: '1.1rem' }}>R$</span>
              <input
                type="number" step="0.01" min="10"
                style={{ ...inputStyle, paddingLeft: '2.8rem', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}
                value={formData.requested_amount || ''}
                onChange={e => setFormData({ ...formData, requested_amount: Number(e.target.value) })}
                placeholder="1800,00" required
              />
            </div>
          </div>

          {/* Bandeira do Cartão */}
          <div>
            <label style={labelStyle}><CreditCard size={15} color="#d97706" /> Bandeira do Cartão</label>
            <select
              style={{ ...inputStyle, height: '50px' }}
              value={formData.card_flag_id}
              onChange={e => setFormData({ ...formData, card_flag_id: e.target.value })}
              required
            >
              {flags.map(f => (
                <option key={f.key} value={f.key}>
                  {f.name} {isAdmin ? `(Taxa ${formData.installments}x: ${getRateForFlagAndInstallment(f.key, formData.installments, rateTableType)}%)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* MAQUININHA UTILIZADA */}
          <div>
            <label style={labelStyle}><Cpu size={15} color="#d97706" /> Maquininha POS Utilizada</label>
            <select
              style={{ ...inputStyle, height: '50px' }}
              value={formData.machine_id}
              onChange={e => {
                const val = e.target.value;
                const m = machines.find(item => item.id.toString() === val);
                setFormData(prev => ({
                  ...prev,
                  machine_id: val,
                  machine_name: m?.name || val
                }));
              }}
              required
            >
              {machines.map(m => (
                <option key={m.id} value={m.id.toString()}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Canal da Operação */}
          <div>
            <label style={labelStyle}><Send size={15} color="#64748b" /> Canal da Operação</label>
            <select
              style={{ ...inputStyle, height: '50px' }}
              value={formData.channel}
              onChange={e => setFormData({ ...formData, channel: e.target.value })}
            >
              <option value="Presencial (Máquina Balcão)">Presencial (Máquina Balcão)</option>
              <option value="Link de Pagamento Online">Link de Pagamento Online</option>
              <option value="Operação Externa / Consultor">Operação Externa / Consultor</option>
            </select>
          </div>

          {/* 4 Últimos Dígitos do Cartão */}
          <div>
            <label style={labelStyle}><Lock size={15} color="#64748b" /> 4 Últimos Dígitos do Cartão (Opcional)</label>
            <input
              type="text"
              maxLength={4}
              style={inputStyle}
              value={formData.card_last_digits}
              onChange={e => setFormData({ ...formData, card_last_digits: e.target.value.replace(/\D/g, '') })}
              placeholder="Ex: 4892"
            />
          </div>

          {/* SELEÇÃO DA QUANTIDADE DE VEZES QUE O CLIENTE SOLICITOU (1x a 18x) */}
          <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ ...labelStyle, margin: 0, fontSize: '0.85rem' }}>
                <CalendarDays size={16} color="#d97706" /> Quantidade de Vezes Solicitada pelo Cliente (1 a 18x):
              </label>
              <div style={{ background: '#d97706', color: '#fff', padding: '0.35rem 0.9rem', borderRadius: '10px', fontWeight: 900, fontSize: '0.9rem' }}>
                Selecionado: {formData.installments}x {isAdmin ? `(Taxa: ${getRateForFlagAndInstallment(formData.card_flag_id, formData.installments, rateTableType)}%)` : ''}
              </div>
            </div>

            {/* Grid Interativo de 1x a 18x */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '0.5rem' }}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
                const isSelected = formData.installments === n;
                const r = getRateForFlagAndInstallment(formData.card_flag_id, n, rateTableType);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, installments: n }))}
                    style={{
                      padding: '0.85rem 0.4rem',
                      background: isSelected ? '#d97706' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      border: `2px solid ${isSelected ? '#d97706' : '#cbd5e1'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem',
                      boxShadow: isSelected ? '0 4px 12px rgba(0,168,89,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: '1.05rem' }}>{n}x</span>
                    {isAdmin && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isSelected ? '#dcfce7' : '#ef4444' }}>
                        {r.toFixed(1)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Taxas da Operação: Cliente e Maquininha (Exclusivo Admin) */}
          {isAdmin && (
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Taxa Aplicada ao Cliente (%) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, margin: 0 }}>
                    <Percent size={15} color="#ef4444" /> Taxa de Juros Aplicada ao Cliente (%)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tabela Oficial ({formData.installments}x)</span>
                </div>
                <input
                  type="number" step="0.01"
                  style={{
                    ...inputStyle,
                    color: '#ef4444',
                    fontWeight: 900,
                    fontSize: '1.15rem'
                  }}
                  value={formData.interest_rate}
                  onChange={e => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                  required
                />
              </div>

              {/* Taxa de Retenção da Maquininha (MDR) (%) - Exclusivo Admin */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, margin: 0 }}><Cpu size={15} color="#ef4444" /> Retenção MDR Maquininha (%)</label>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    {machRetentionInfo.source === 'machine_flag_tier' ? 'Faixa por Bandeira' : machRetentionInfo.source === 'machine_tier' ? 'Faixa da Máquina' : machRetentionInfo.source === 'machine_flat' ? 'Taxa Fixa da Máquina' : 'Tabela Oficial'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number" step="0.01"
                    style={{ ...inputStyle, color: '#dc2626', fontWeight: 900, fontSize: '1.1rem' }}
                    value={customMachineFeeRate !== null ? customMachineFeeRate : machFeePercent}
                    onChange={e => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setCustomMachineFeeRate(val);
                    }}
                    placeholder={machFeePercent.toFixed(2)}
                    required
                  />
                  {customMachineFeeRate !== null && (
                    <button
                      type="button"
                      onClick={() => setCustomMachineFeeRate(null)}
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      title="Restaurar taxa automática calculada pela maquininha"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAINEL DE RESULTADOS PASSO A PASSO COM RETENÇÃO PRECISA E LUCRO REAL */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', padding: '1.75rem', borderRadius: '20px', border: '2px solid #bbf7d0', boxShadow: '0 4px 15px rgba(0,168,89,0.05)' }}>

            {/* 1. Parcela Mensal */}
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Plano de Parcelamento</span>
              <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.5rem' }}>{currentInstallments}x de R$ {formatCurrency(installmentValue)}</span>
              <div style={{ fontSize: '0.8rem', color: '#1e40af', marginTop: '0.4rem', fontWeight: 800 }}>
                Total Cartão: R$ {formatCurrency(safeGrossAmount)}
              </div>
            </div>

            {/* 2. Repasse PIX Cliente */}
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Repasse PIX ao Cliente</span>
              <span style={{ color: '#d97706', fontWeight: 900, fontSize: '1.5rem' }}>R$ {formatCurrency(pixToClient)}</span>
              <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '0.4rem', fontWeight: 700 }}>
                Valor líquido liberado na conta
              </div>
            </div>

            {/* 3. Ganhos / Juros da Operação */}
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Ganhos / Juros Brutos</span>
              <span style={{ color: '#059669', fontWeight: 900, fontSize: '1.5rem' }}>+ R$ {formatCurrency(operationProfit)}</span>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem', fontWeight: 600 }}>
                {isAdmin ? `Taxa Cliente: ${formData.interest_rate.toFixed(2)}% (${currentInstallments}x)` : `Plano Oficial (${currentInstallments}x)`}
              </div>
            </div>

            {/* 4. Retenção da Maquininha (MDR) - Exclusivo Admin */}
            {isAdmin && (
              <div style={{ background: '#fff5f5', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #fecaca', boxShadow: '0 2px 6px rgba(185,28,28,0.05)' }}>
                <span style={{ color: '#991b1b', fontSize: '0.75rem', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Retenção Maquininha</span>
                <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '1.5rem' }}>- R$ {formatCurrency(machineFeeAmount)}</span>
                <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.4rem', fontWeight: 700 }}>
                  Taxa MDR: {machFeePercent.toFixed(2)}% da máquina
                </div>
              </div>
            )}

            {/* 5. Lucro Real que Sobra para a CM CRED - Exclusivo Admin */}
            {isAdmin && (
              <div style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #d97706', boxShadow: '0 6px 16px rgba(0,168,89,0.25)' }}>
                <span style={{ color: '#86efac', fontSize: '0.75rem', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Lucro Real CM CRED</span>
                <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.65rem' }}>R$ {formatCurrency(companyNetProfit)}</span>
                {consultantCommission > 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#fde047', marginTop: '0.4rem', fontWeight: 800 }}>
                    Comissão Operador: R$ {formatCurrency(consultantCommission)} ({consultantCommPercent}%)
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#bbf7d0', marginTop: '0.4rem', fontWeight: 700 }}>
                    100% que sobra para a empresa
                  </div>
                )}
              </div>
            )}

            {/* 6. Comissão do Consultor (Visão do Consultor) */}
            {!isAdmin && consultantCommission > 0 && (
              <div style={{ background: '#fefce8', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #fde047', boxShadow: '0 2px 6px rgba(234,179,8,0.05)' }}>
                <span style={{ color: '#854d0e', fontSize: '0.75rem', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Sua Comissão Prevista</span>
                <span style={{ color: '#ca8a04', fontWeight: 900, fontSize: '1.5rem' }}>R$ {formatCurrency(consultantCommission)}</span>
                <div style={{ fontSize: '0.8rem', color: '#a16207', marginTop: '0.4rem', fontWeight: 700 }}>
                  Previsão de comissão da operação
                </div>
              </div>
            )}

          </div>

          {/* Observações */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}><FileText size={15} color="#64748b" /> Observações Internas / Memorial</label>
            <textarea
              style={{ ...inputStyle, height: '70px', resize: 'none', fontSize: '0.9rem' }}
              value={formData.observations}
              onChange={e => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Detalhes ou anotações específicas desta transação..."
            />
          </div>

        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            style={{
              padding: '1.15rem 1.75rem',
              background: '#25D366',
              border: 'none',
              borderRadius: '16px',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 8px 16px -4px rgba(37, 211, 102, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <Share2 size={18} /> Enviar no WhatsApp
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              minWidth: '260px',
              padding: '1.15rem',
              borderRadius: '16px',
              background: '#d97706',
              border: 'none',
              color: '#fff',
              fontWeight: 900,
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 20px -5px rgba(0, 168, 89, 0.35)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}>
            {loading ? 'Gravando Operação...' : `Finalizar Operação (${formData.installments}x de R$ ${formatCurrency(installmentValue)})`}
          </button>
        </div>

      </form>
    </div>
  );
};

export default CreateLoan;
