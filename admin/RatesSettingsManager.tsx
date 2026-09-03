import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sliders, 
  RotateCcw, 
  Save, 
  CreditCard, 
  CheckCircle2, 
  Calculator, 
  Layers, 
  Coins, 
  Sparkles, 
  Plus, 
  Trash2,
  TrendingUp,
  AlertCircle,
  Database,
  RefreshCw,
  Cpu,
  Edit2,
  X,
  Smartphone,
  Calendar,
  Landmark
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { 
  getCustomCardRates, 
  getCustomCardFlags,
  fetchRatesFromDatabase,
  saveAllRatesToDatabase,
  saveRateToDatabase,
  deleteRateFromDatabase,
  resetAllRatesInDatabase,
  calculateLoanSimulation, 
  DEFAULT_CARD_RATES,
  type CardFlagOption,
  type RateTableType,
  TABLE_OPTIONS
} from '../lib/rates';
import { RateInput } from './RateInput';


interface MachineItem {
  id: number;
  name: string;
  bank_id?: number | null;
  liquidation_days?: number;
  fee_percentage?: number;
  installment_fees?: Record<string, number>;
}

const RatesSettingsManager: React.FC = () => {
  const { currentUser, addNotification, logAudit } = useAuth();
  
  const isAdmin = currentUser?.perfil === 'admin' || 
                  currentUser?.email?.toLowerCase().includes('admin') || 
                  currentUser?.email?.toLowerCase().includes('cmcred');

  // Tab ativa: 'rates' (Taxas 1x a 18x) | 'machines' (Gestão de Maquininhas POS)
  const [activeMainTab, setActiveMainTab] = useState<'rates' | 'machines'>('rates');

  // Tabela selecionada: 'tabela_1' ou 'tabela_2'
  const [activeTable, setActiveTable] = useState<RateTableType>('tabela_1');

  // Estados de Taxas
  const [ratesT1, setRatesT1] = useState<Record<string, Record<number, number>>>(getCustomCardRates('tabela_1'));
  const [ratesT2, setRatesT2] = useState<Record<string, Record<number, number>>>(getCustomCardRates('tabela_2'));
  const [flags, setFlags] = useState<CardFlagOption[]>(getCustomCardFlags());
  const [selectedFlagKey, setSelectedFlagKey] = useState<string>('VISA_MASTER');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Estados do Simulador de Teste Rápido
  const [testAmount, setTestAmount] = useState<number>(1800);
  const [testInstallments, setTestInstallments] = useState<number>(8);
  const [testType, setTestType] = useState<'Valor Líquido' | 'Valor Bruto'>('Valor Líquido');

  const currentRates = activeTable === 'tabela_1' ? ratesT1 : ratesT2;

  // Estados de Maquininhas
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [loadingMachines, setLoadingMachines] = useState<boolean>(false);
  const [showMachineModal, setShowMachineModal] = useState<boolean>(false);
  const [editingMachine, setEditingMachine] = useState<MachineItem | null>(null);
  const [machineFormData, setMachineFormData] = useState({
    name: '',
    liquidation_days: 1
  });

  // Carregar dados diretamente do Banco de Dados Supabase ao iniciar
  const loadDatabaseRates = async () => {
    setLoading(true);
    try {
      const { ratesT1: dbT1, ratesT2: dbT2, flags: dbFlags } = await fetchRatesFromDatabase();
      if (dbT1 && Object.keys(dbT1).length > 0) {
        setRatesT1(dbT1);
      }
      if (dbT2 && Object.keys(dbT2).length > 0) {
        setRatesT2(dbT2);
      }
      if (dbFlags && dbFlags.length > 0) {
        setFlags(dbFlags);
        if (!dbFlags.some(f => f.key === selectedFlagKey)) {
          setSelectedFlagKey(dbFlags[0].key);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar taxas do banco:', e);
    } finally {
      setLoading(false);
    }
  };

  // Carregar Maquininhas do Banco
  const loadMachines = async () => {
    setLoadingMachines(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('name');
      
      if (error) throw error;
      if (data) setMachines(data);
    } catch (err: any) {
      console.error('Erro ao carregar maquininhas:', err);
    } finally {
      setLoadingMachines(false);
    }
  };

  useEffect(() => {
    loadDatabaseRates();
    loadMachines();
  }, []);

  // Alterar taxa individual
  const handleRateChange = (flagKey: string, installment: number, value: number | string) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    const cleanVal = isNaN(num) ? 0 : Math.max(0, num);
    
    if (activeTable === 'tabela_1') {
      setRatesT1(prev => ({
        ...prev,
        [flagKey]: {
          ...(prev[flagKey] || {}),
          [installment]: cleanVal
        }
      }));
    } else {
      setRatesT2(prev => ({
        ...prev,
        [flagKey]: {
          ...(prev[flagKey] || {}),
          [installment]: cleanVal
        }
      }));
    }
    setHasChanges(true);
  };


  // Salvar alterações no Banco de Dados Supabase (POST / UPSERT)
  const handleSave = async () => {
    setSaving(true);
    try {
      const activeData = activeTable === 'tabela_1' ? ratesT1 : ratesT2;
      const result = await saveAllRatesToDatabase(activeData, flags, activeTable);
      if (result.success) {
        setHasChanges(false);
        addNotification(`Taxas da ${activeTable === 'tabela_1' ? 'Tabela 1' : 'Tabela 2'} salvas no Banco Supabase!`, 'sucesso');
        await logAudit('edição_taxas', `Taxas (${activeTable}) do simulador atualizadas no banco de dados.`);
      } else {
        addNotification('Aviso: As taxas foram salvas localmente: ' + result.error, 'alerta');
      }
    } catch (err: any) {
      addNotification('Erro ao salvar no banco de dados: ' + (err.message || 'Erro desconhecido'), 'alerta');
    } finally {
      setSaving(false);
    }
  };

  // Restaurar padrões originais no Banco de Dados
  const handleReset = async () => {
    const tableName = activeTable === 'tabela_1' ? 'Tabela 1 (Padrão 7% a 19.99%)' : 'Tabela 2 (Reduzida 5.5% a 18.5%)';
    if (window.confirm(`Deseja restaurar as taxas padrão da ${tableName} no Banco de Dados?`)) {
      setSaving(true);
      try {
        const res = await resetAllRatesInDatabase(activeTable);
        if (res.success) {
          await loadDatabaseRates();
          setHasChanges(false);
          addNotification(`Taxas da ${tableName} restauradas para o padrão oficial!`, 'sucesso');
        } else {
          addNotification('Erro ao restaurar: ' + res.error, 'alerta');
        }
      } finally {
        setSaving(false);
      }
    }
  };

  // Adicionar nova bandeira no Banco de Dados
  const handleAddFlag = async () => {
    const name = window.prompt('Digite o nome da nova bandeira / categoria (Ex: HIPERCARD, CABAL):');
    if (!name || !name.trim()) return;
    const cleanName = name.trim().toUpperCase();
    const key = cleanName.replace(/[^A-Z0-9]/g, '_');
    
    if (flags.some(f => f.key === key)) {
      addNotification('Esta bandeira já existe na lista!', 'alerta');
      return;
    }

    const newFlag: CardFlagOption = {
      id: key.toLowerCase(),
      key: key,
      name: cleanName,
      icon: '💳',
      color: '#6366f1'
    };

    const initialRates: Record<number, number> = {};
    for (let i = 1; i <= 18; i++) {
      initialRates[i] = currentRates['VISA_MASTER']?.[i] ?? (5.0 + i * 0.75);
    }

    const newFlags = [...flags, newFlag];
    if (activeTable === 'tabela_1') {
      setRatesT1(prev => ({ ...prev, [key]: initialRates }));
    } else {
      setRatesT2(prev => ({ ...prev, [key]: initialRates }));
    }
    setFlags(newFlags);
    setSelectedFlagKey(key);
    setHasChanges(true);

    // Salvar imediatamente no banco
    await saveRateToDatabase(key, cleanName, '💳', '#6366f1', initialRates, activeTable);
    addNotification(`Bandeira ${cleanName} cadastrada no banco de dados!`, 'sucesso');
  };
    
  // Remover bandeira do Banco de Dados
  const handleRemoveFlag = async (flagKey: string) => {
    if (['VISA_MASTER', 'BANESE/ELO', 'AMEX'].includes(flagKey)) {
      addNotification('As bandeiras oficiais principais não podem ser removidas.', 'alerta');
      return;
    }
    if (window.confirm(`Excluir a bandeira ${flagKey} permanentemente do banco de dados?`)) {
      setSaving(true);
      try {
        const res = await deleteRateFromDatabase(flagKey);
        if (res.success) {
          const updatedFlags = flags.filter(f => f.key !== flagKey);
          const updatedRates1 = { ...ratesT1 };
          const updatedRates2 = { ...ratesT2 };
          delete updatedRates1[flagKey];
          delete updatedRates2[flagKey];
          setFlags(updatedFlags);
          setRatesT1(updatedRates1);
          setRatesT2(updatedRates2);
          setSelectedFlagKey('VISA_MASTER');
          setHasChanges(false);
          addNotification('Bandeira excluída do banco de dados com sucesso!', 'sucesso');
        } else {
          addNotification('Erro ao excluir do banco: ' + res.error, 'alerta');
        }
      } finally {
        setSaving(false);
      }
    }
  };

  // =========================================================================
  // GESTÃO DE MAQUININHAS (CRUD SUPABASE)
  // =========================================================================
  const openNewMachineModal = () => {
    setEditingMachine(null);
    setMachineFormData({ name: '', liquidation_days: 1 });
    setShowMachineModal(true);
  };

  const openEditMachineModal = (m: MachineItem) => {
    setEditingMachine(m);
    setMachineFormData({
      name: m.name,
      liquidation_days: m.liquidation_days || 1
    });
    setShowMachineModal(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineFormData.name.trim()) {
      addNotification('Informe o nome da maquininha.', 'alerta');
      return;
    }

    setSaving(true);
    try {
      if (editingMachine) {
        // UPDATE
        const { error } = await supabase
          .from('machines')
          .update({
            name: machineFormData.name.trim(),
            liquidation_days: Number(machineFormData.liquidation_days) || 1
          })
          .eq('id', editingMachine.id);

        if (error) throw error;
        addNotification(`Maquininha ${machineFormData.name} atualizada no banco!`, 'sucesso');
      } else {
        // INSERT
        const { error } = await supabase
          .from('machines')
          .insert([{
            name: machineFormData.name.trim(),
            liquidation_days: Number(machineFormData.liquidation_days) || 1
          }]);

        if (error) throw error;
        addNotification(`Maquininha ${machineFormData.name} cadastrada no banco!`, 'sucesso');
      }

      setShowMachineModal(false);
      loadMachines();
    } catch (err: any) {
      addNotification('Erro ao salvar maquininha: ' + err.message, 'alerta');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMachine = async (machineId: number, machineName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a maquininha "${machineName}" do banco de dados?`)) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('machines')
          .delete()
          .eq('id', machineId);

        if (error) throw error;
        addNotification(`Maquininha ${machineName} removida do banco de dados.`, 'sucesso');
        loadMachines();
      } catch (err: any) {
        addNotification('Erro ao excluir: ' + err.message, 'alerta');
      } finally {
        setSaving(false);
      }
    }
  };

  // Simulação de teste em tempo real com as taxas ativas
  const testSimulation = useMemo(() => {
    const currentRate = currentRates[selectedFlagKey]?.[testInstallments] ?? 0;
    return calculateLoanSimulation({
      valorDesejado: testAmount,
      parcelas: testInstallments,
      tipoCalculo: testType,
      bandeiraCartao: selectedFlagKey,
      tableType: activeTable,
      customTaxa: currentRate
    });
  }, [testAmount, testInstallments, testType, selectedFlagKey, currentRates, activeTable]);

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '24px',
    padding: '2rem',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.04)'
  };

  const inputRateStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.5rem',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    borderRadius: '10px',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: 800,
    textAlign: 'center',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const activeFlag = flags.find(f => f.key === selectedFlagKey) || flags[0];

  return (
    <div style={{ padding: '2.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Banner de Modo Visualização para Consultores / Não-Admins */}
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
          <span><strong>Modo Consulta de Taxas:</strong> Acesso de visualização liberado pelo Administrador. A alteração de taxas oficiais e cadastro de maquininhas é exclusivo da diretoria.</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Sliders size={34} color="#d97706" /> Configurações de Taxas & Maquininhas
            </h1>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              background: '#f0fdf4', 
              color: '#d97706', 
              border: '1px solid #bbf7d0',
              padding: '0.3rem 0.75rem', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: 800 
            }}>
              <Database size={13} /> Sincronizado com Banco Supabase
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.5rem', fontWeight: 500 }}>
            Gerencie e personalize taxas de 1x a 18x por bandeira e cadastre as maquininhas POS com gravação direta no banco.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {activeMainTab === 'rates' && (
            <>
              <button
                type="button"
                onClick={loadDatabaseRates}
                disabled={loading}
                style={{
                  padding: '0.85rem 1.1rem',
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Recarregar
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    style={{
                      padding: '0.85rem 1.25rem',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '14px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <RotateCcw size={16} /> Restaurar Padrão HTML
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '0.85rem 1.75rem',
                      background: hasChanges ? '#d97706' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '14px',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      boxShadow: hasChanges ? '0 8px 16px -4px rgba(0, 168, 89, 0.4)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Save size={18} /> {saving ? 'Gravando no Banco...' : hasChanges ? 'Gravar Alterações no Banco *' : 'Taxas Gravadas no Banco'}
                  </button>
                </>
              )}
            </>
          )}

          {activeMainTab === 'machines' && isAdmin && (
            <button
              type="button"
              onClick={openNewMachineModal}
              style={{
                padding: '0.85rem 1.5rem',
                background: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 8px 16px -4px rgba(0, 168, 89, 0.35)'
              }}
            >
              <Plus size={18} /> Cadastrar Nova Maquininha
            </button>
          )}
        </div>
      </div>

      {/* SELETOR DE SEÇÃO PRINCIPAL (TABS) */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '16px', maxWidth: '600px' }}>
        <button
          type="button"
          onClick={() => setActiveMainTab('rates')}
          style={{
            flex: 1,
            padding: '0.85rem',
            borderRadius: '12px',
            border: 'none',
            background: activeMainTab === 'rates' ? '#d97706' : 'transparent',
            color: activeMainTab === 'rates' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: activeMainTab === 'rates' ? '0 4px 10px rgba(0,168,89,0.25)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <CreditCard size={18} /> Taxas 1x a 18x (Bandeiras)
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('machines')}
          style={{
            flex: 1,
            padding: '0.85rem',
            borderRadius: '12px',
            border: 'none',
            background: activeMainTab === 'machines' ? '#d97706' : 'transparent',
            color: activeMainTab === 'machines' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: activeMainTab === 'machines' ? '0 4px 10px rgba(0,168,89,0.25)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Cpu size={18} /> Gestão de Maquininhas POS ({machines.length})
        </button>
      </div>

      {/* ABA 1: EDITOR DE TAXAS POR BANDEIRA */}
      {activeMainTab === 'rates' && (
        <>
          {hasChanges && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '1rem 1.5rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>
              <AlertCircle size={20} color="#d97706" /> Você editou taxas que ainda não foram enviadas ao banco. Clique em "Gravar Alterações no Banco" para salvar permanentemente.
            </div>
          )}

          {/* SELEÇÃO DA TABELA DE TAXAS (TABELA 1 OU TABELA 2) */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Sliders size={16} color="#d97706" /> Tabela de Taxas em Edição:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', maxWidth: '700px' }}>
              {TABLE_OPTIONS.map(opt => {
                const isSelected = activeTable === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setActiveTable(opt.id);
                      setHasChanges(false);
                    }}
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '16px',
                      border: `2px solid ${isSelected ? '#d97706' : '#e2e8f0'}`,
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      color: isSelected ? '#d97706' : '#475569',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 12px rgba(0,168,89,0.15)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.05rem', fontWeight: 900 }}>{opt.name}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#059669' : '#94a3b8' }}>{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabs de Seleção de Bandeira */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '2rem' }}>
            {flags.map(f => {
              const isSelected = selectedFlagKey === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSelectedFlagKey(f.key)}
                  style={{
                    padding: '0.9rem 1.4rem',
                    borderRadius: '16px',
                    border: `2px solid ${isSelected ? '#d97706' : '#e2e8f0'}`,
                    background: isSelected ? '#f0fdf4' : '#ffffff',
                    color: isSelected ? '#d97706' : '#334155',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    boxShadow: isSelected ? '0 4px 12px rgba(0,168,89,0.15)' : '0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{f.icon}</span>
                  <span>{f.name}</span>
                </button>
              );
            })}

            {isAdmin && (
              <button
                type="button"
                onClick={handleAddFlag}
                style={{
                  padding: '0.9rem 1.25rem',
                  borderRadius: '16px',
                  border: '2px dashed #cbd5e1',
                  background: 'transparent',
                  color: '#64748b',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={16} /> Nova Bandeira
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '2.5rem', alignItems: 'start' }}>
            
            {/* Editor de Taxas 1x a 18x */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{activeFlag?.icon}</span> Taxas: {activeFlag?.name} ({activeTable === 'tabela_1' ? 'Tabela 1' : 'Tabela 2'})
                  </h2>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                    {isAdmin ? 'Edite as taxas percentuais aplicadas para cada quantidade de parcelas (1x a 18x)' : 'Visualização das taxas percentuais oficiais aplicadas ao simulador (1x a 18x)'}
                  </span>
                </div>

                {isAdmin && !['VISA_MASTER', 'BANESE/ELO', 'AMEX'].includes(selectedFlagKey) && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFlag(selectedFlagKey)}
                    style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Trash2 size={14} /> Excluir Bandeira
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
                  const currentVal = currentRates[selectedFlagKey]?.[n] ?? 0;
                  return (
                    <div 
                      key={n}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.1rem' }}>
                        {n}x
                      </span>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <RateInput
                          key={`${activeTable}-${selectedFlagKey}-${n}`}
                          value={currentVal}
                          readOnly={!isAdmin}
                          onChange={newVal => {
                            if (!isAdmin) return;
                            handleRateChange(selectedFlagKey, n, newVal);
                          }}
                          style={{
                            ...inputRateStyle,
                            background: !isAdmin ? '#f1f5f9' : '#ffffff',
                            cursor: !isAdmin ? 'default' : 'text'
                          }}
                          placeholder="0,00"
                        />
                        <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800, pointerEvents: 'none' }}>
                          %
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isAdmin && (
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '1rem 2rem',
                      background: '#d97706',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '14px',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      boxShadow: '0 8px 16px -4px rgba(0, 168, 89, 0.4)'
                    }}
                  >
                    <Save size={18} /> {saving ? 'Gravando no Banco...' : 'Gravar Alterações no Banco'}
                  </button>
                </div>
              )}
            </div>

            {/* Simulador de Teste Imediato */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ ...cardStyle, background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)', border: '2px solid #bbf7d0' }}>
                <h3 style={{ margin: '0 0 1.25rem 0', color: '#0f172a', fontWeight: 900, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calculator size={22} color="#d97706" /> Teste Rápido em Tempo Real
                </h3>
                
                {/* Tipo de Cálculo */}
                <div style={{ display: 'flex', gap: '0.5rem', background: '#e2e8f0', padding: '0.3rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setTestType('Valor Líquido')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', background: testType === 'Valor Líquido' ? '#d97706' : 'transparent', color: testType === 'Valor Líquido' ? '#fff' : '#475569', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Valor Líquido
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestType('Valor Bruto')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', background: testType === 'Valor Bruto' ? '#d97706' : 'transparent', color: testType === 'Valor Bruto' ? '#fff' : '#475569', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Valor Bruto
                  </button>
                </div>

                {/* Inputs de Teste */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Valor Teste (R$)</label>
                    <input
                      type="number"
                      value={testAmount}
                      onChange={e => setTestAmount(Number(e.target.value))}
                      style={{ ...inputRateStyle, textAlign: 'left', padding: '0.75rem', fontSize: '1rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Vezes (Parcelas)</label>
                    <select
                      value={testInstallments}
                      onChange={e => setTestInstallments(Number(e.target.value))}
                      style={{ ...inputRateStyle, textAlign: 'left', padding: '0.75rem', fontSize: '1rem' }}
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Resultados do Teste */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Bandeira:</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{activeFlag?.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Taxa ({testInstallments}x):</span>
                    <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>{testSimulation.taxaJuros.toFixed(2)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Valor Solicitado (PIX):</span>
                    <strong style={{ color: '#d97706', fontSize: '1rem' }}>R$ {testSimulation.valorSolicitado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Valor Total Cartão:</span>
                    <strong style={{ color: '#0f172a', fontSize: '1rem' }}>R$ {testSimulation.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ borderTop: '2px dashed #e2e8f0', margin: '0.2rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#0f172a', fontSize: '0.95rem', fontWeight: 800 }}>Valor da Parcela:</span>
                    <strong style={{ color: '#d97706', fontSize: '1.4rem' }}>
                      {testInstallments}x de R$ {testSimulation.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </>
      )}

      {/* ABA 2: GESTÃO DE MAQUININHAS POS (BANCO DE DADOS) */}
      {activeMainTab === 'machines' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={24} color="#d97706" /> Maquininhas POS Cadastradas no Banco de Dados
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.3rem 0 0 0', fontWeight: 500 }}>
                Cadastre e edite as maquininhas de cartão disponíveis para seleção no momento do lançamento da operação.
              </p>
            </div>

            <button
              type="button"
              onClick={openNewMachineModal}
              style={{
                padding: '0.75rem 1.25rem',
                background: '#d97706',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 10px rgba(0,168,89,0.25)'
              }}
            >
              <Plus size={16} /> Nova Maquininha
            </button>
          </div>

          {loadingMachines ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#d97706', fontWeight: 800 }}>
              CARREGANDO MAQUININHAS DO BANCO...
            </div>
          ) : machines.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
              Nenhuma maquininha cadastrada no banco de dados. Clique em "Nova Maquininha" para cadastrar.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {machines.map(m => (
                <div
                  key={m.id}
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '18px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.6rem', borderRadius: '12px' }}>
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: '1.05rem' }}>
                          {m.name}
                        </h4>
                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>
                          ID: #{m.id}
                        </span>
                      </div>
                    </div>

                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '8px' }}>
                      Ativa
                    </span>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>Liquidação:</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>D+{m.liquidation_days || 1} dia útil</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => openEditMachineModal(m)}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        color: '#0f172a',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Edit2 size={13} color="#2563eb" /> Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMachine(m.id, m.name)}
                      style={{
                        padding: '0.6rem 0.85rem',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderRadius: '10px',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE MAQUININHA */}
      {showMachineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={22} color="#d97706" /> {editingMachine ? 'Editar Maquininha' : 'Cadastrar Nova Maquininha'}
              </h3>
              <button
                type="button"
                onClick={() => setShowMachineModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMachine} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Nome da Maquininha / Modelo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Stone Smart POS Balcão"
                  value={machineFormData.name}
                  onChange={e => setMachineFormData({ ...machineFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none', fontWeight: 700, color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Prazo de Liquidação (Dias)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  required
                  placeholder="1"
                  value={machineFormData.liquidation_days}
                  onChange={e => setMachineFormData({ ...machineFormData, liquidation_days: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none', fontWeight: 700, color: '#0f172a', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem', display: 'block' }}>
                  Ex: 1 = D+1 (recebe no dia útil seguinte) | 0 = D+0 (na hora)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowMachineModal(false)}
                  style={{ flex: 1, padding: '0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, padding: '0.85rem', background: '#d97706', border: 'none', borderRadius: '12px', fontWeight: 800, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(0,168,89,0.3)' }}
                >
                  {saving ? 'Gravando...' : 'Salvar no Banco'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default RatesSettingsManager;
