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
  ArrowRight
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { DEFAULT_CARD_RATES, getCustomCardFlags, type CardFlagOption } from '../lib/rates';
import type { Bank } from './types';

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
    fee_percentage: '0',
    liquidation_days: '1',
    rates_by_flag: JSON.parse(JSON.stringify(DEFAULT_CARD_RATES)) as Record<string, Record<number, number>>
  });

  const [newBankName, setNewBankName] = useState('');
  const flags = getCustomCardFlags();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [machRes, bankRes] = await Promise.all([
        supabase.from('machines').select('*, banks(name)').order('name', { ascending: true }),
        supabase.from('banks').select('*').order('name', { ascending: true })
      ]);

      if (machRes.data) {
        setMachines(machRes.data.map((m: any) => ({
          ...m,
          bank_name: m.banks?.name || 'Banco Geral',
          installment_fees: m.installment_fees || {},
          card_rates: m.installment_fees?.rates_by_flag || (m.installment_fees ? m.installment_fees : DEFAULT_CARD_RATES)
        })));
      }
      if (bankRes.data) setBanks(bankRes.data);
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

  // Preencher com padrão do HTML
  const handleLoadHtmlDefaults = () => {
    setFormData(prev => ({
      ...prev,
      rates_by_flag: JSON.parse(JSON.stringify(DEFAULT_CARD_RATES))
    }));
    addNotification('Taxas padrão oficiais do HTML carregadas!', 'sucesso');
  };

  // Alterar taxa individual na modal
  const handleRateChange = (flagKey: string, installment: number, valueStr: string) => {
    const val = parseFloat(valueStr.replace(',', '.'));
    const cleanVal = isNaN(val) ? 0 : Math.max(0, val);

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
      const dataToSave = {
        name: formData.name.trim(),
        bank_id: formData.bank_id ? parseInt(formData.bank_id) : null,
        fee_percentage: parseFloat(formData.fee_percentage.replace(',', '.')) || 0,
        liquidation_days: parseInt(formData.liquidation_days) || 1,
        installment_fees: {
          rates_by_flag: formData.rates_by_flag,
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
    
    // Tenta carregar as taxas da máquina ou usar as padrão
    let machineRates = JSON.parse(JSON.stringify(DEFAULT_CARD_RATES));
    if (m.installment_fees && m.installment_fees.rates_by_flag) {
      machineRates = m.installment_fees.rates_by_flag;
    }

    setFormData({
      name: m.name,
      bank_id: m.bank_id ? m.bank_id.toString() : '',
      fee_percentage: m.fee_percentage ? String(m.fee_percentage) : '0',
      liquidation_days: m.liquidation_days ? String(m.liquidation_days) : '1',
      rates_by_flag: machineRates
    });
    setShowModal(true);
  };

  const openNewMachine = () => {
    setEditingId(null);
    setFormData({
      name: '',
      bank_id: banks.length > 0 ? banks[0].id.toString() : '',
      fee_percentage: '0',
      liquidation_days: '1',
      rates_by_flag: JSON.parse(JSON.stringify(DEFAULT_CARD_RATES))
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
            <Cpu size={34} color="#d97706" /> Gestão de Maquininhas POS
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Configure e cadastre equipamentos com as tabelas de taxas 1x a 18x exatas do simulador HTML salvas no banco de dados
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
                boxShadow: '0 8px 16px -4px rgba(0,168,89,0.35)',
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
            const sampleRates = m.card_rates?.['VISA_MASTER'] || DEFAULT_CARD_RATES['VISA_MASTER'];
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
                      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
                      borderRadius: '16px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: '#d97706',
                      fontSize: '1.5rem',
                      boxShadow: '0 4px 10px rgba(0,168,89,0.15)'
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
                        title="Editar"
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Liquidação</span>
                    <strong style={{ fontSize: '1rem', color: '#d97706', fontWeight: 900 }}>D+{m.liquidation_days || 1} dia útil</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Status</span>
                    <strong style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle2 size={14} color="#15803d" /> Ativa no Balcão
                    </strong>
                  </div>
                </div>

                {/* Resumo de Taxas da Máquina */}
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Amostra de Taxas (VISA / MASTER):
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                    <span>1x: <b style={{ color: '#ef4444' }}>{(sampleRates?.[1] ?? 5.5).toFixed(1)}%</b></span>
                    <span>4x: <b style={{ color: '#ef4444' }}>{(sampleRates?.[4] ?? 8.0).toFixed(1)}%</b></span>
                    <span>12x: <b style={{ color: '#ef4444' }}>{(sampleRates?.[12] ?? 13.0).toFixed(1)}%</b></span>
                    <span>18x: <b style={{ color: '#ef4444' }}>{(sampleRates?.[18] ?? 18.5).toFixed(1)}%</b></span>
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
          <div style={{ background: '#ffffff', borderRadius: '28px', padding: '2.5rem', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Cpu size={26} color="#d97706" /> {editingId ? 'Editar Maquininha POS' : 'Cadastrar Nova Maquininha POS'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.2rem 0 0', fontWeight: 500 }}>
                  Configure os dados do terminal e as taxas de parcelamento 1x a 18x exatas do HTML.
                </p>
              </div>

              <button type="button" onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem' }}>
                {/* Nome */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Nome da Maquininha / Modelo
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Stone Smart POS Balcão"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Banco Parceiro */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      Banco Vinculado
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setShowBankModal(true)} 
                      style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 800 }}
                    >
                      + NOVO BANCO
                    </button>
                  </div>
                  <select 
                    value={formData.bank_id}
                    onChange={e => setFormData({ ...formData, bank_id: e.target.value })}
                    style={{ ...inputStyle, height: '48px' }}
                  >
                    <option value="">Selecione a instituição...</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id.toString()}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Prazo de Liquidação */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Liquidação (Dias)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="30"
                    required
                    placeholder="1"
                    value={formData.liquidation_days}
                    onChange={e => setFormData({ ...formData, liquidation_days: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Bloco de Taxas 1x a 18x Conforme o HTML */}
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1.5px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase' }}>
                      Tabela de Taxas por Bandeira da Maquininha (1x a 18x)
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      Estrutura exata do arquivo HTML fornecido
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadHtmlDefaults}
                    style={{
                      padding: '0.6rem 1rem',
                      background: '#f0fdf4',
                      border: '1.5px solid #bbf7d0',
                      borderRadius: '12px',
                      color: '#047857',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <RotateCcw size={14} /> Carregar Padrão do HTML
                  </button>
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

                {/* Grid 1x a 18x */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem' }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
                    const currentRate = formData.rates_by_flag[activeFlagTab]?.[n] ?? (5.0 + n * 0.75);
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
                          <input 
                            type="text"
                            value={currentRate.toString().replace('.', ',')}
                            onChange={e => handleRateChange(activeFlagTab, n, e.target.value)}
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
                    boxShadow: '0 8px 16px -4px rgba(0,168,89,0.35)'
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
