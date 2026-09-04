import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Landmark, 
  Cpu, 
  Save, 
  RotateCcw, 
  CreditCard, 
  Search, 
  X, 
  CheckCircle2, 
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Calculator,
  Sliders,
  DollarSign,
  TrendingUp,
  Percent
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { getCustomCardFlags, type CardFlagOption } from '../lib/rates';
import type { Bank } from './types';
import { RateInput } from './RateInput';


// Baseline de custo MDR padrão de mercado para adquirentes (Stone, PagBank, Cielo, etc.)
// 100% ajustável pelo administrador
export const DEFAULT_MACHINE_MDR_RATES: Record<string, Record<number, number>> = {
  "VISA_MASTER": {
    1: 1.20, 2: 1.80, 3: 2.10, 4: 2.40, 5: 2.70, 6: 3.00,
    7: 3.30, 8: 3.60, 9: 3.90, 10: 4.20, 11: 4.50,
    12: 4.80, 13: 5.10, 14: 5.40, 15: 5.70, 16: 6.00, 17: 6.20, 18: 6.50
  },
  "BANESE/ELO": {
    1: 1.80, 2: 2.40, 3: 2.80, 4: 3.10, 5: 3.50, 6: 3.90,
    7: 4.20, 8: 4.60, 9: 4.90, 10: 5.30, 11: 5.60,
    12: 6.00, 13: 6.30, 14: 6.70, 15: 7.00, 16: 7.30, 17: 7.60, 18: 8.00
  },
  "AMEX": {
    1: 1.90, 2: 2.50, 3: 2.90, 4: 3.20, 5: 3.60, 6: 4.00,
    7: 4.30, 8: 4.70, 9: 5.00, 10: 5.40, 11: 5.70,
    12: 6.10, 13: 6.40, 14: 6.80, 15: 7.10, 16: 7.40, 17: 7.70, 18: 8.10
  }
};

interface MachineModel {
  id: number;
  name: string;
  bank_id?: number | null;
  bank_name?: string;
  fee_percentage?: number;
  liquidation_days?: number;
  installment_fees?: Record<string, any>;
  card_rates?: Record<string, Record<number, number>>;
  created_at?: string;
}

const MachinesManager: React.FC = () => {
  const { addNotification, currentUser, logAudit, showConfirm } = useAuth();
  const isAdmin = currentUser?.perfil === 'admin' || 
                  currentUser?.email?.toLowerCase().includes('admin') || 
                  currentUser?.email?.toLowerCase().includes('cmcred');
  
  const [machines, setMachines] = useState<MachineModel[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [activeFlagTab, setActiveFlagTab] = useState<string>('VISA_MASTER');
  const [formData, setFormData] = useState({
    name: '',
    bank_id: '',
    fee_percentage: '',
    liquidation_days: '1',
    fixed_fee: '0.00',
    rates_by_flag: JSON.parse(JSON.stringify(DEFAULT_MACHINE_MDR_RATES)) as Record<string, Record<number, number>>
  });

  // Ferramenta de Preenchimento em Lote
  const [batchInitialRate, setBatchInitialRate] = useState('1.5');
  const [batchStepRate, setBatchStepRate] = useState('0.3');

  // Testador de Cálculo em Tempo Real no Cadastro
  const [testAmount, setTestAmount] = useState<number>(1000);
  const [testInstallments, setTestInstallments] = useState<number>(10);
  const [testFlag, setTestFlag] = useState<string>('VISA_MASTER');

  const [newBankName, setNewBankName] = useState('');
  const flags = getCustomCardFlags();
  const hasLoadedOnceRef = React.useRef(machines.length > 0);

  const fetchData = async (isSilent = false) => {
    if (!hasLoadedOnceRef.current && !isSilent) {
      setLoading(true);
    }
    try {
      const [machRes, bankRes] = await Promise.all([
        supabase.from('machines').select('*, banks(name)').order('name', { ascending: true }),
        supabase.from('banks').select('*').order('name', { ascending: true })
      ]);

      if (machRes.data) {
        const mapped = machRes.data.map((m: any) => ({
          ...m,
          bank_name: m.banks?.name || 'Banco Geral',
          installment_fees: m.installment_fees || {},
          card_rates: m.installment_fees?.rates_by_flag || (m.installment_fees ? m.installment_fees : DEFAULT_MACHINE_MDR_RATES)
        }));
        setMachines(mapped);
      }
      if (bankRes.data) setBanks(bankRes.data);
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      console.error('Erro ao buscar maquininhas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('realtime-machines-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banks' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Preencher com sugestão de mercado de adquirentes (Stone/PagBank/Cielo)
  const handleLoadMarketDefaults = () => {
    setFormData(prev => ({
      ...prev,
      rates_by_flag: JSON.parse(JSON.stringify(DEFAULT_MACHINE_MDR_RATES))
    }));
    addNotification('Taxas de referência de adquirente carregadas nos campos (100% editáveis)!', 'sucesso');
  };

  // Zerar todas as taxas para preenchimento manual livre
  const handleZeroRates = () => {
    const zeroObj: Record<string, Record<number, number>> = {};
    flags.forEach(f => {
      zeroObj[f.key] = {};
      for (let i = 1; i <= 18; i++) {
        zeroObj[f.key][i] = 0;
      }
    });
    setFormData(prev => ({
      ...prev,
      rates_by_flag: zeroObj
    }));
    addNotification('Todas as taxas foram zeradas. Preencha os campos como desejar.', 'info');
  };

  // Preencher em lote na bandeira ativa
  const handleApplyBatchRates = () => {
    const start = parseFloat(batchInitialRate.replace(',', '.')) || 0;
    const step = parseFloat(batchStepRate.replace(',', '.')) || 0;

    setFormData(prev => {
      const updatedFlagRates: Record<number, number> = {};
      for (let i = 1; i <= 18; i++) {
        updatedFlagRates[i] = Number((start + (i - 1) * step).toFixed(2));
      }
      return {
        ...prev,
        rates_by_flag: {
          ...prev.rates_by_flag,
          [activeFlagTab]: updatedFlagRates
        }
      };
    });
    addNotification(`Escalonamento aplicado na bandeira ${activeFlagTab}!`, 'sucesso');
  };

  // Alterar taxa individual na modal
  const handleRateChange = (flagKey: string, installment: number, value: number | string) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    const cleanVal = isNaN(num) ? 0 : Math.max(0, num);

    setFormData(prev => ({
      ...prev,
      rates_by_flag: {
        ...prev.rates_by_flag,
        [flagKey]: {
          ...(prev.rates_by_flag[flagKey] || {}),
          [installment]: cleanVal
        }
      }
    }));
  };


  // Salvar no Banco de Dados Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return addNotification('Informe o nome da maquininha.', 'alerta');

    setSaving(true);
    try {
      const feePercentVal = parseFloat(formData.fee_percentage.replace(',', '.')) || null;
      const fixedFeeVal = parseFloat(formData.fixed_fee.replace(',', '.')) || 0;

      const dataToSave = {
        name: formData.name.trim(),
        bank_id: formData.bank_id ? parseInt(formData.bank_id) : null,
        fee_percentage: feePercentVal,
        liquidation_days: parseInt(formData.liquidation_days) || 1,
        installment_fees: {
          rates_by_flag: formData.rates_by_flag,
          fixed_fee: fixedFeeVal,
          // Compatibilidade com campos legados
          ...formData.rates_by_flag['VISA_MASTER']
        }
      };

      if (editingId) {
        const { error } = await supabase
          .from('machines')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        addNotification(`Maquininha "${formData.name}" atualizada com sucesso no banco!`, 'sucesso');
        await logAudit('edição_máquina', `Maquininha ${formData.name} atualizada no banco.`);
      } else {
        const { error } = await supabase
          .from('machines')
          .insert([dataToSave]);

        if (error) throw error;
        addNotification(`Maquininha "${formData.name}" cadastrada com sucesso no banco!`, 'sucesso');
        await logAudit('criação_máquina', `Maquininha ${formData.name} cadastrada no banco.`);
      }

      closeModal();
      fetchData();
    } catch (err: any) {
      addNotification('Erro ao salvar no banco: ' + err.message, 'alerta');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m: MachineModel) => {
    setEditingId(m.id);
    
    // Tenta carregar as taxas da máquina ou usar as padrão de adquirente
    let machineRates = JSON.parse(JSON.stringify(DEFAULT_MACHINE_MDR_RATES));
    if (m.installment_fees && m.installment_fees.rates_by_flag) {
      machineRates = m.installment_fees.rates_by_flag;
    } else if (m.installment_fees) {
      // Garante suporte a formatos legados
      machineRates = {
        'VISA_MASTER': { ...m.installment_fees },
        'BANESE/ELO': { ...m.installment_fees },
        'AMEX': { ...m.installment_fees }
      };
    }

    setFormData({
      name: m.name,
      bank_id: m.bank_id ? m.bank_id.toString() : '',
      fee_percentage: m.fee_percentage !== undefined && m.fee_percentage !== null ? String(m.fee_percentage) : '',
      liquidation_days: m.liquidation_days ? String(m.liquidation_days) : '1',
      fixed_fee: m.installment_fees?.fixed_fee ? String(m.installment_fees.fixed_fee) : '0.00',
      rates_by_flag: machineRates
    });
    setShowModal(true);
  };

  const openNewMachine = () => {
    setEditingId(null);
    setFormData({
      name: '',
      bank_id: banks.length > 0 ? banks[0].id.toString() : '',
      fee_percentage: '',
      liquidation_days: '1',
      fixed_fee: '0.00',
      rates_by_flag: JSON.parse(JSON.stringify(DEFAULT_MACHINE_MDR_RATES))
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleDeleteMachine = async (id: number, name: string) => {
    const confirmed = await showConfirm(`Tem certeza que deseja excluir a maquininha "${name}" permanentemente do banco de dados?`);
    if (!confirmed) return;
    
    try {
      const { error } = await supabase.from('machines').delete().eq('id', id);
      if (error) throw error;
      await logAudit('exclusão_máquina', `Equipamento ${name} removido do sistema.`);
      addNotification(`Maquininha "${name}" excluída com sucesso.`, 'sucesso');
      fetchData();
    } catch (err: any) {
      addNotification('Erro ao excluir: ' + err.message, 'alerta');
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;
    try {
      const { data, error } = await supabase.from('banks').insert([{ name: newBankName.trim() }]).select();
      if (error) throw error;
      addNotification('Instituição bancária adicionada!', 'sucesso');
      setShowBankModal(false);
      setNewBankName('');
      await fetchData();
      if (data && data[0]) {
        setFormData(prev => ({ ...prev, bank_id: data[0].id.toString() }));
      }
    } catch (err: any) {
      addNotification('Erro ao salvar banco: ' + err.message, 'alerta');
    }
  };

  const filteredMachines = machines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.bank_name && m.bank_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Cálculo da simulação de teste no modal
  const simulatedRetention = (() => {
    const flagRates = formData.rates_by_flag[testFlag] || {};
    let rate = flagRates[testInstallments];
    
    // Se não encontrou por bandeira, tenta taxa geral flat
    if (rate === undefined || rate === null) {
      const flat = parseFloat(formData.fee_percentage.replace(',', '.'));
      rate = !isNaN(flat) && flat > 0 ? flat : 0;
    }

    const fixed = parseFloat(formData.fixed_fee.replace(',', '.')) || 0;
    const amount = Number((testAmount * (rate / 100) + fixed).toFixed(2));
    const net = Number((testAmount - amount).toFixed(2));

    return { rate, fixed, amount, net };
  })();

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#0f172a',
    width: '100%',
    outline: 'none',
    fontSize: '0.95rem',
    fontWeight: 700,
    boxSizing: 'border-box'
  };

  return (
    <div style={{ padding: '2.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Banner de Modo Visualização para Consultores */}
      {!isAdmin && (
        <div style={{ 
          padding: '1rem 1.5rem', 
          background: '#eff6ff', 
          color: '#1e40af', 
          borderRadius: '16px', 
          border: '1.5px solid #bfdbfe', 
          fontWeight: 800, 
          fontSize: '0.88rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.65rem', 
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(37,99,235,0.06)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🔒</span>
          <span><strong>Modo Consulta de Maquininhas:</strong> Acesso de visualização liberado pelo Administrador. O cadastro, alteração e exclusão de equipamentos é exclusivo da diretoria.</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Cpu size={34} color="#d97706" /> Gestão de Maquininhas POS & Retenção
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Configuração 100% dinâmica e ajustável das taxas de retenção (MDR de adquirente) por parcela (1x a 18x) e bandeira
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={openNewMachine}
              style={{ 
                background: '#d97706', 
                color: '#fff', 
                border: 'none', 
                padding: '0.85rem 1.6rem', 
                borderRadius: '14px', 
                fontWeight: 800, 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                fontSize: '0.95rem',
                boxShadow: '0 8px 16px -4px rgba(217,119,6,0.35)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={18} /> Cadastrar Nova Maquininha
            </button>
          </div>
        )}
      </div>

      {/* Barra de Busca */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
        <Search size={20} color="#94a3b8" />
        <input 
          type="text" 
          placeholder="Buscar maquininha por nome ou banco vinculado..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}
        />
        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
          {filteredMachines.length} Maquininhas
        </span>
      </div>

      {/* Grid de Maquininhas */}
      {loading ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: '#d97706', fontWeight: 800 }}>
          CARREGANDO EQUIPAMENTOS DO BANCO DE DADOS...
        </div>
      ) : filteredMachines.length === 0 ? (
        <div style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
          Nenhuma maquininha encontrada.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredMachines.map(m => {
            const sampleRates = m.card_rates?.['VISA_MASTER'] || m.installment_fees?.['VISA_MASTER'] || DEFAULT_MACHINE_MDR_RATES['VISA_MASTER'];
            return (
              <div 
                key={m.id} 
                style={{ 
                  background: '#ffffff', 
                  border: '1.5px solid #e2e8f0', 
                  borderRadius: '24px', 
                  padding: '1.75rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem', 
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.03)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '52px', height: '52px', 
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                      borderRadius: '16px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: '#d97706',
                      fontSize: '1.5rem',
                      boxShadow: '0 4px 10px rgba(217,119,6,0.15)'
                    }}>
                      📟
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: '1.2rem' }}>{m.name}</h3>
                      <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <Landmark size={14} color="#d97706" /> {m.bank_name}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        type="button" 
                        onClick={() => handleEdit(m)}
                        style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer' }}
                        title="Editar Maquininha e Taxas"
                      >
                        <Edit3 size={15} color="#2563eb" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteMachine(m.id, m.name)}
                        style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer' }}
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Estatísticas Rápidas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div style={{ 
                    background: Number(m.liquidation_days) === 0 ? '#ecfdf5' : '#fffbeb', 
                    padding: '0.75rem', 
                    borderRadius: '14px', 
                    border: `1px solid ${Number(m.liquidation_days) === 0 ? '#a7f3d0' : '#fde68a'}` 
                  }}>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      color: Number(m.liquidation_days) === 0 ? '#047857' : '#b45309', 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      display: 'block' 
                    }}>
                      Prazo de Recebimento
                    </span>
                    <strong style={{ 
                      fontSize: '0.92rem', 
                      color: Number(m.liquidation_days) === 0 ? '#059669' : '#d97706', 
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      marginTop: '0.2rem'
                    }}>
                      {Number(m.liquidation_days) === 0 ? '⚡ D+0 (Mesmo Dia / Na Hora)' : `📅 D+${m.liquidation_days || 1} (${m.liquidation_days === 1 ? 'Próximo dia útil' : `${m.liquidation_days} dias úteis`})`}
                    </strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Taxa Geral Flat</span>
                    <strong style={{ fontSize: '0.9rem', color: m.fee_percentage ? '#0f172a' : '#94a3b8', fontWeight: 900 }}>
                      {m.fee_percentage ? `${m.fee_percentage}%` : 'Por Parcela'}
                    </strong>
                  </div>
                </div>

                {/* Resumo de Taxas da Máquina */}
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Retenção MDR (VISA / MASTER):
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                    <span>1x: <b style={{ color: '#059669' }}>{(sampleRates?.[1] ?? 1.2).toFixed(2)}%</b></span>
                    <span>4x: <b style={{ color: '#059669' }}>{(sampleRates?.[4] ?? 2.4).toFixed(2)}%</b></span>
                    <span>10x: <b style={{ color: '#059669' }}>{(sampleRates?.[10] ?? 4.2).toFixed(2)}%</b></span>
                    <span>18x: <b style={{ color: '#059669' }}>{(sampleRates?.[18] ?? 6.5).toFixed(2)}%</b></span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO COMPLETA DE MAQUININHA */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#ffffff', borderRadius: '28px', padding: '2.5rem', width: '100%', maxWidth: '900px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Cpu size={26} color="#d97706" /> {editingId ? 'Editar Maquininha POS & Retenção' : 'Cadastrar Nova Maquininha POS'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.2rem 0 0', fontWeight: 500 }}>
                  Configure o prazo de recebimento bancário (D+0, D+1, etc.) e as taxas de retenção que a adquirente desconta.
                </p>
              </div>

              <button type="button" onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '1rem' }}>
                {/* Nome */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Nome do Terminal / Modelo
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Stone Smart Balcão, Cielo LIO, PagBank"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Banco Parceiro */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      Banco / Conta de Destino
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setShowBankModal(true)} 
                      style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 800 }}
                    >
                      + NOVO
                    </button>
                  </div>
                  <select 
                    value={formData.bank_id}
                    onChange={e => setFormData({ ...formData, bank_id: e.target.value })}
                    style={{ ...inputStyle, height: '48px' }}
                  >
                    <option value="">Selecione...</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id.toString()}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Taxa Fixa por Transação (R$) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Taxa Fixa (R$)
                  </label>
                  <input 
                    type="text"
                    placeholder="0.00"
                    value={formData.fixed_fee}
                    onChange={e => setFormData({ ...formData, fixed_fee: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* SELEÇÃO DO PRAZO DE LIQUIDAÇÃO BANCÁRIA (D+0, D+1, D+2, D+3...) */}
              <div style={{ 
                background: '#f8fafc', 
                padding: '1.25rem', 
                borderRadius: '18px', 
                border: '1.5px solid #e2e8f0' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={16} color="#d97706" /> Prazo de Recebimento na Conta Bancária (Dias de Liquidação)
                    </label>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                      Defina quando o valor líquido desta maquininha cai na conta da empresa para o sistema gerar o alerta inteligente de confirmação.
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 900,
                    padding: '4px 12px',
                    borderRadius: '8px',
                    background: formData.liquidation_days === '0' ? '#ecfdf5' : '#fffbeb',
                    color: formData.liquidation_days === '0' ? '#059669' : '#d97706',
                    border: `1px solid ${formData.liquidation_days === '0' ? '#a7f3d0' : '#fde68a'}`
                  }}>
                    {formData.liquidation_days === '0' ? '⚡ D+0: Entra no mesmo dia' : `📅 D+${formData.liquidation_days}: ${formData.liquidation_days === '1' ? 'Próximo dia útil' : `${formData.liquidation_days} dias úteis`}`}
                  </span>
                </div>

                {/* Botões de Seleção Rápida */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 120px', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, liquidation_days: '0' })}
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: '12px',
                      border: formData.liquidation_days === '0' ? '2px solid #059669' : '1.5px solid #cbd5e1',
                      background: formData.liquidation_days === '0' ? '#ecfdf5' : '#ffffff',
                      color: formData.liquidation_days === '0' ? '#065f46' : '#334155',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>⚡ 0 Dias (D+0)</span>
                    <small style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.8 }}>No mesmo dia / Na hora</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, liquidation_days: '1' })}
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: '12px',
                      border: formData.liquidation_days === '1' ? '2px solid #d97706' : '1.5px solid #cbd5e1',
                      background: formData.liquidation_days === '1' ? '#fffbeb' : '#ffffff',
                      color: formData.liquidation_days === '1' ? '#92400e' : '#334155',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>📅 1 Dia (D+1)</span>
                    <small style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.8 }}>Próximo dia útil (Padrão)</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, liquidation_days: '2' })}
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: '12px',
                      border: formData.liquidation_days === '2' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                      background: formData.liquidation_days === '2' ? '#eff6ff' : '#ffffff',
                      color: formData.liquidation_days === '2' ? '#1e40af' : '#334155',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>📅 2 Dias (D+2)</span>
                    <small style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.8 }}>2 dias úteis</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, liquidation_days: '3' })}
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: '12px',
                      border: formData.liquidation_days === '3' ? '2px solid #7c3aed' : '1.5px solid #cbd5e1',
                      background: formData.liquidation_days === '3' ? '#f5f3ff' : '#ffffff',
                      color: formData.liquidation_days === '3' ? '#5b21b6' : '#334155',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>📅 3 Dias (D+3)</span>
                    <small style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.8 }}>3 dias úteis</small>
                  </button>

                  {/* Campo Numérico Customizado */}
                  <div>
                    <input 
                      type="number"
                      min="0"
                      max="60"
                      required
                      placeholder="Outro"
                      value={formData.liquidation_days}
                      onChange={e => setFormData({ ...formData, liquidation_days: e.target.value })}
                      style={{ ...inputStyle, textAlign: 'center', height: '46px' }}
                      title="Digite a quantidade personalizada de dias"
                    />
                  </div>
                </div>
              </div>

              {/* Bloco de Taxas 1x a 18x 100% Ajustáveis pelo Admin */}
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1.5px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase' }}>
                      Grade de Retenção da Maquininha (1x a 18x)
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      Digite a taxa que a adquirente desconta em cada quantidade de parcelas
                    </span>
                  </div>

                  {/* Ações Rápidas de Configuração */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleLoadMarketDefaults}
                      style={{
                        padding: '0.55rem 0.9rem',
                        background: '#f0fdf4',
                        border: '1.5px solid #bbf7d0',
                        borderRadius: '10px',
                        color: '#047857',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <RotateCcw size={13} /> Sugestão Stone/PagBank
                    </button>
                    <button
                      type="button"
                      onClick={handleZeroRates}
                      style={{
                        padding: '0.55rem 0.9rem',
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        borderRadius: '10px',
                        color: '#dc2626',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Zerar Campos
                    </button>
                  </div>
                </div>

                {/* Abas de Bandeira */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  {flags.map(f => {
                    const isSelected = activeFlagTab === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setActiveFlagTab(f.key)}
                        style={{
                          padding: '0.65rem 1.1rem',
                          borderRadius: '12px',
                          border: `1.5px solid ${isSelected ? '#d97706' : '#cbd5e1'}`,
                          background: isSelected ? '#d97706' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#334155',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s'
                        }}
                      >
                        <span>{f.icon}</span>
                        <span>{f.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Ferramenta de Preenchimento em Lote para a Bandeira Ativa */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Sliders size={14} color="#d97706" /> Preenchimento em Lote ({activeFlagTab}):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Taxa 1x:</span>
                    <input 
                      type="text" 
                      value={batchInitialRate} 
                      onChange={e => setBatchInitialRate(e.target.value)} 
                      style={{ width: '60px', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800, textAlign: 'center', fontSize: '0.8rem' }} 
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>+ por parcela:</span>
                    <input 
                      type="text" 
                      value={batchStepRate} 
                      onChange={e => setBatchStepRate(e.target.value)} 
                      style={{ width: '60px', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800, textAlign: 'center', fontSize: '0.8rem' }} 
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>%</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBatchRates}
                    style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Aplicar na Bandeira
                  </button>
                </div>

                {/* Grid 1x a 18x editável */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem' }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
                    const currentRate = formData.rates_by_flag[activeFlagTab]?.[n] ?? 0;
                    return (
                      <div 
                        key={n}
                        style={{
                          background: '#ffffff',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '0.6rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '0.95rem' }}>{n}x</span>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <RateInput
                            key={`${activeFlagTab}-${n}`}
                            value={currentRate}
                            onChange={newVal => handleRateChange(activeFlagTab, n, newVal)}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.3rem',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              textAlign: 'center',
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: '#0f172a',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            placeholder="0,00"
                          />
                          <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, pointerEvents: 'none' }}>
                            %
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* SIMULADOR DE CONFERÊNCIA EM TEMPO REAL NO CADASTRO */}
              <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)', padding: '1.5rem', borderRadius: '20px', border: '1.5px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Calculator size={20} color="#d97706" />
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 900 }}>
                    Testador Instantâneo de Retenção
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    (Confira o cálculo com as taxas configuradas acima antes de salvar)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Valor Bruto de Teste (R$)</label>
                    <input 
                      type="number"
                      step="100"
                      value={testAmount}
                      onChange={e => setTestAmount(Math.max(1, Number(e.target.value)))}
                      style={{ ...inputStyle, padding: '0.5rem 0.8rem', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Parcelas (1x a 18x)</label>
                    <select
                      value={testInstallments}
                      onChange={e => setTestInstallments(Number(e.target.value))}
                      style={{ ...inputStyle, padding: '0.5rem 0.8rem', fontSize: '0.9rem' }}
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Bandeira</label>
                    <select
                      value={testFlag}
                      onChange={e => setTestFlag(e.target.value)}
                      style={{ ...inputStyle, padding: '0.5rem 0.8rem', fontSize: '0.9rem' }}
                    >
                      {flags.map(f => (
                        <option key={f.key} value={f.key}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Resultado do Teste */}
                  <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #d97706' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                      Retenção: <strong style={{ color: '#dc2626' }}>{simulatedRetention.rate.toFixed(2)}%</strong>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#dc2626', marginTop: '0.1rem' }}>
                      - R$ {simulatedRetention.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '0.2rem' }}>
                      Entra no Banco: R$ {simulatedRetention.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '16px',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 2,
                    padding: '1rem',
                    background: '#d97706',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '1rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    boxShadow: '0 8px 16px -4px rgba(217,119,6,0.35)'
                  }}
                >
                  <Save size={20} /> {saving ? 'Salvando no Banco...' : editingId ? 'Salvar Alterações no Banco' : 'Cadastrar Maquininha no Banco'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal de Banco */}
      {showBankModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(10px)' }}>
          <form onSubmit={handleAddBank} style={{ background: '#ffffff', padding: '2.5rem', borderRadius: '24px', width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#0f172a', marginTop: 0, fontWeight: 900, fontSize: '1.3rem' }}>Adicionar Banco</h3>
            <label style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>NOME DA INSTITUIÇÃO</label>
            <input 
              placeholder="Ex: Stone Pagamentos, PagBank, Itaú..." 
              value={newBankName}
              onChange={e => setNewBankName(e.target.value)}
              style={inputStyle}
              required
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
              <button type="button" onClick={() => setShowBankModal(false)} style={{ flex: 1, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', padding: '0.75rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Voltar</button>
              <button type="submit" style={{ flex: 1, background: '#d97706', border: 'none', color: '#fff', padding: '0.75rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>Salvar Banco</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default MachinesManager;
