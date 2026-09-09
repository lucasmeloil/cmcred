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
import { supabaseAdmin } from '../lib/supabaseAdmin';
import MachinesManager from './MachinesManager';
import { useRealtimeSync } from '../lib/useRealtimeSync';
import { RealtimeStatusBadge } from './RealtimeStatusBadge';
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
  TABLE_OPTIONS,
  criarNovaTabelaTaxas,
  calcularValorLiquido,
  type NovaTabelaTaxasResultado
} from '../lib/rates';
import { RateInput } from './RateInput';


const RatesSettingsManager: React.FC = () => {
  const { currentUser, addNotification, logAudit, isSuperAdmin, canEditRates } = useAuth();
  
  const isAdmin = isSuperAdmin || canEditRates;

  // Tab ativa: 'rates' (Taxas 1x a 18x) | 'machines' (Gestão de Maquininhas POS)
  const [activeMainTab, setActiveMainTab] = useState<'rates' | 'machines'>('rates');

  // Tabela selecionada: 'tabela_1' ou 'tabela_2'
  const [activeTable, setActiveTable] = useState<RateTableType>('tabela_1');

  // Estados para Criação de Nova Tabela (Apenas Administrador)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customTables, setCustomTables] = useState<NovaTabelaTaxasResultado[]>(() => {
    try {
      const stored = localStorage.getItem('cmcred_custom_tables_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [newTableForm, setNewTableForm] = useState({
    nomeTabela: '',
    tipoTabela: 'Flex',
    minTaxa: 5.5,
    maxTaxa: 18.5,
    bandeiras: ['VISA', 'MASTER', 'AMEX', 'ELO'],
    newFlagName: '',
    taxasPorParcelas: {
      1: 7.10, 2: 8.25, 3: 8.75, 4: 9.50, 5: 9.99, 6: 10.75,
      7: 11.25, 8: 11.75, 9: 12.25, 10: 12.99, 11: 13.75, 12: 14.49,
      13: 15.50, 14: 16.00, 15: 16.80, 16: 17.50, 17: 18.00, 18: 18.50
    } as Record<number, number>,
    simGrossAmount: 1000,
    simInstallment: 10
  });

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

  const latestRef = React.useRef({ ratesT1, ratesT2, flags, activeTable, hasChanges });
  useEffect(() => {
    latestRef.current = { ratesT1, ratesT2, flags, activeTable, hasChanges };
  }, [ratesT1, ratesT2, flags, activeTable, hasChanges]);

  const onRealtimeDataChange = React.useCallback(async () => {
    if (!latestRef.current.hasChanges) {
      await loadDatabaseRates();
    }
  }, []);

  const { syncStatus, lastSyncTime, forceSync } = useRealtimeSync({
    table: 'simulator_rates',
    onDataChange: onRealtimeDataChange,
    heartbeatIntervalMs: 45000,
  });

  useEffect(() => {
    const onBeforeUnload = () => {
      if (latestRef.current.hasChanges) {
        const d = latestRef.current.activeTable === 'tabela_1' ? latestRef.current.ratesT1 : latestRef.current.ratesT2;
        saveAllRatesToDatabase(d, latestRef.current.flags, latestRef.current.activeTable);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (latestRef.current.hasChanges) {
        const d = latestRef.current.activeTable === 'tabela_1' ? latestRef.current.ratesT1 : latestRef.current.ratesT2;
        saveAllRatesToDatabase(d, latestRef.current.flags, latestRef.current.activeTable);
      }
    };
  }, []);

  // Auto-save inteligente: Salva automaticamente no banco Supabase após 2 segundos sem digitação
  useEffect(() => {
    if (!hasChanges || !isAdmin) return;
    const timer = setTimeout(() => {
      const activeData = activeTable === 'tabela_1' ? ratesT1 : ratesT2;
      saveAllRatesToDatabase(activeData, flags, activeTable).then(res => {
        if (res.success) {
          setHasChanges(false);
          logAudit('edição_taxas', `Taxas (${activeTable}) sincronizadas automaticamente com precisão no banco.`);
        }
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasChanges, ratesT1, ratesT2, flags, activeTable, logAudit]);

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
    if (!isAdmin) {
      addNotification('Permissão negada: você não possui privilégio para alterar taxas.', 'alerta');
      return;
    }
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
    if (!isAdmin) {
      addNotification('Permissão negada: você não possui privilégio para restaurar taxas.', 'alerta');
      return;
    }
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
    if (!isAdmin) {
      addNotification('Permissão negada: você não possui privilégio para cadastrar bandeiras.', 'alerta');
      return;
    }
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
    if (!isAdmin) {
      addNotification('Permissão negada: você não possui privilégio para remover bandeiras.', 'alerta');
      return;
    }
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

  // Adicionar nova bandeira dinamicamente à nova tabela
  const handleAddFlagToNewTable = () => {
    if (!newTableForm.newFlagName.trim()) return;
    const clean = newTableForm.newFlagName.trim().toUpperCase();
    if (newTableForm.bandeiras.includes(clean)) {
      addNotification('Esta bandeira já consta na lista da tabela.', 'alerta');
      return;
    }
    setNewTableForm(prev => ({
      ...prev,
      bandeiras: [...prev.bandeiras, clean],
      newFlagName: ''
    }));
    addNotification(`Bandeira ${clean} adicionada!`, 'sucesso');
  };

  const handleRemoveFlagFromNewTable = (flagToRemove: string) => {
    if (newTableForm.bandeiras.length <= 1) {
      addNotification('A tabela deve conter ao menos uma bandeira.', 'alerta');
      return;
    }
    setNewTableForm(prev => ({
      ...prev,
      bandeiras: prev.bandeiras.filter(b => b !== flagToRemove)
    }));
  };

  const handleRateChangeInNewTable = (installment: number, val: number) => {
    setNewTableForm(prev => ({
      ...prev,
      taxasPorParcelas: {
        ...prev.taxasPorParcelas,
        [installment]: val
      }
    }));
  };

  // Função central para Criar Nova Tabela de Taxas (Exclusivo Administrador)
  const handleCriarNovaTabela = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSuperAdmin) {
      addNotification('Permissão negada: Consultores não podem criar novas tabelas de taxas. Acesso exclusivo ao Administrador.', 'alerta');
      return;
    }

    try {
      const resultado = criarNovaTabelaTaxas({
        nomeTabela: newTableForm.nomeTabela,
        tipoTabela: newTableForm.tipoTabela,
        faixaTaxas: { min: Number(newTableForm.minTaxa), max: Number(newTableForm.maxTaxa) },
        bandeiras: newTableForm.bandeiras,
        taxasPorParcelas: newTableForm.taxasPorParcelas
      });

      const updated = [...customTables, resultado];
      setCustomTables(updated);
      try {
        localStorage.setItem('cmcred_custom_tables_v1', JSON.stringify(updated));
      } catch {}

      addNotification(`Nova tabela "${resultado.nomeTabela}" (${resultado.tipoTabela}) criada e validada com sucesso!`, 'sucesso');
      logAudit('criação_tabela_taxas', `Nova tabela de taxas "${resultado.nomeTabela}" criada pelo Administrador.`);
      setShowCreateModal(false);
      setNewTableForm(prev => ({ ...prev, nomeTabela: '' }));
    } catch (err: any) {
      addNotification('Validação falhou: ' + err.message, 'alerta');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Sliders size={34} color="#d97706" /> Configurações de Taxas & Maquininhas
            </h1>
            <RealtimeStatusBadge status={syncStatus} lastSyncTime={lastSyncTime} onRefresh={forceSync} />
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

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    padding: '0.85rem 1.4rem',
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)'
                  }}
                  title="Criar Nova Tabela de Taxas (Exclusivo Administrador)"
                >
                  <Plus size={18} /> Criar Nova Tabela
                </button>
              )}

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
          <Cpu size={18} /> Gestão de Maquininhas POS
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', maxWidth: '1000px' }}>
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

              {/* Tabelas Personalizadas Criadas pelo Administrador */}
              {customTables.map(ct => (
                <div
                  key={ct.id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '16px',
                    border: '2px solid #fed7aa',
                    background: '#fffbeb',
                    color: '#9a3412',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900 }}>{ct.nomeTabela}</span>
                    <span style={{ fontSize: '0.7rem', background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                      {ct.tipoTabela}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b45309' }}>
                    Faixa: {ct.faixaTaxas.min}% a {ct.faixaTaxas.max}% • {ct.bandeiras.join(', ')}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#9a3412', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Criada em: {ct.dataCriacaoFormatada}</span>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Excluir a tabela "${ct.nomeTabela}"?`)) {
                            const filtered = customTables.filter(t => t.id !== ct.id);
                            setCustomTables(filtered);
                            localStorage.setItem('cmcred_custom_tables_v1', JSON.stringify(filtered));
                            addNotification(`Tabela "${ct.nomeTabela}" removida.`, 'info');
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
        <div style={{ marginTop: '0.5rem' }}>
          <MachinesManager />
        </div>
      )}

      {/* MODAL DE CRIAÇÃO DE NOVA TABELA DE TAXAS (EXCLUSIVO ADMINISTRADOR) */}
      {showCreateModal && isSuperAdmin && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            position: 'relative'
          }}>
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
              <div>
                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Exclusivo Administrador
                </span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={24} color="#d97706" /> Criar Nova Tabela de Taxas
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.35rem', fontWeight: 500 }}>
                  Defina o nome, tipo, faixa mínima e máxima de taxas, bandeiras aceitas e valores percentuais de 1x a 18x.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '0.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCriarNovaTabela}>
              {/* Linha 1: Nome e Tipo da Tabela */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Nome da Nova Tabela *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tabela 3 - Promocional"
                    value={newTableForm.nomeTabela}
                    onChange={e => setNewTableForm(prev => ({ ...prev, nomeTabela: e.target.value }))}
                    style={{ ...inputRateStyle, textAlign: 'left', padding: '0.8rem 1rem', fontSize: '1rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Tipo da Tabela
                  </label>
                  <select
                    value={newTableForm.tipoTabela}
                    onChange={e => setNewTableForm(prev => ({ ...prev, tipoTabela: e.target.value }))}
                    style={{ ...inputRateStyle, textAlign: 'left', padding: '0.8rem 1rem', fontSize: '1rem', fontWeight: 700 }}
                  >
                    <option value="Padrão">Padrão</option>
                    <option value="Reduzida">Reduzida</option>
                    <option value="Flex">Flex</option>
                    <option value="Promocional">Promocional</option>
                    <option value="Personalizada">Personalizada</option>
                  </select>
                </div>
              </div>

              {/* Linha 2: Faixa de Taxas (Min e Max) */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Faixa de Taxas Permitida (%) *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Taxa Mínima (%):</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newTableForm.minTaxa}
                      onChange={e => setNewTableForm(prev => ({ ...prev, minTaxa: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputRateStyle, textAlign: 'center', padding: '0.65rem', fontWeight: 800 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Taxa Máxima (%):</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newTableForm.maxTaxa}
                      onChange={e => setNewTableForm(prev => ({ ...prev, maxTaxa: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputRateStyle, textAlign: 'center', padding: '0.65rem', fontWeight: 800 }}
                    />
                  </div>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Todas as taxas de 1x a 18x deverão estar entre <strong>{newTableForm.minTaxa}%</strong> e <strong>{newTableForm.maxTaxa}%</strong>.
                </p>
              </div>

              {/* Linha 3: Bandeiras Aceitas com Adição Dinâmica */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Bandeiras Aceitas na Tabela (Dinâmico) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {newTableForm.bandeiras.map(b => (
                    <span
                      key={b}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        border: '1px solid #bfdbfe'
                      }}
                    >
                      💳 {b}
                      <button
                        type="button"
                        onClick={() => handleRemoveFlagFromNewTable(b)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, fontSize: '0.8rem', fontWeight: 900 }}
                        title="Remover bandeira"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
                  <input
                    type="text"
                    placeholder="Adicionar nova bandeira (Ex: HIPERCARD, CABAL)"
                    value={newTableForm.newFlagName}
                    onChange={e => setNewTableForm(prev => ({ ...prev, newFlagName: e.target.value }))}
                    style={{ ...inputRateStyle, textAlign: 'left', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddFlagToNewTable}
                    style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                  >
                    + Adicionar
                  </button>
                </div>
              </div>

              {/* Linha 4: Grade de Taxas de 1x a 18x */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Taxas Percentuais por Parcela (1x a 18x)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem' }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(installment => {
                    const currentVal = newTableForm.taxasPorParcelas[installment] ?? 0;
                    const isOutOfRange = currentVal < newTableForm.minTaxa || currentVal > newTableForm.maxTaxa;

                    return (
                      <div
                        key={installment}
                        style={{
                          background: isOutOfRange ? '#fef2f2' : '#ffffff',
                          border: `1.5px solid ${isOutOfRange ? '#ef4444' : '#cbd5e1'}`,
                          borderRadius: '12px',
                          padding: '0.5rem',
                          textAlign: 'center'
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isOutOfRange ? '#dc2626' : '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                          {installment}x
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={currentVal}
                          onChange={e => handleRateChangeInNewTable(installment, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            color: isOutOfRange ? '#dc2626' : '#0f172a',
                            outline: 'none'
                          }}
                        />
                        {isOutOfRange && (
                          <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 800, display: 'block', marginTop: '0.1rem' }}>
                            Fora!
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Linha 5: Simulador de Teste com calcularValorLiquido */}
              <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #bbf7d0', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: 900, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  <Calculator size={18} color="#16a34a" /> Prévia com Função Auxiliar calcularValorLiquido()
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>Valor Bruto no Cartão (R$):</span>
                    <input
                      type="number"
                      step="100"
                      min="1"
                      value={newTableForm.simGrossAmount}
                      onChange={e => setNewTableForm(prev => ({ ...prev, simGrossAmount: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputRateStyle, textAlign: 'left', padding: '0.5rem 0.8rem', fontSize: '0.9rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>Parcelas:</span>
                    <select
                      value={newTableForm.simInstallment}
                      onChange={e => setNewTableForm(prev => ({ ...prev, simInstallment: Number(e.target.value) }))}
                      style={{ ...inputRateStyle, textAlign: 'left', padding: '0.5rem 0.8rem', fontSize: '0.9rem', fontWeight: 700 }}
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #86efac' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                      Taxa Aplicada: <strong>{newTableForm.taxasPorParcelas[newTableForm.simInstallment] || 0}%</strong>
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#15803d' }}>
                      Líquido: R$ {calcularValorLiquido(newTableForm.simGrossAmount, newTableForm.simInstallment, newTableForm.taxasPorParcelas[newTableForm.simInstallment] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botões do Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.85rem 1.5rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.85rem 2rem',
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(217, 119, 6, 0.3)'
                  }}
                >
                  Validar e Criar Tabela
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
