import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import {
  Download,
  CreditCard,
  Layers,
  Calculator,
  Share2,
  Coins,
  CheckCircle2,
  TrendingUp,
  Percent,
  CalendarDays,
  Banknote,
  Smartphone,
  Send,
  Sliders,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  getCustomCardFlags,
  getRateForFlagAndInstallment,
  calculateLoanSimulation,
  buildWhatsAppSimulationMessage,
  fetchRatesFromDatabase,
  type CardFlagOption,
  type RateTableType,
  TABLE_OPTIONS
} from '../lib/rates';

const Simulator: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.perfil === 'admin' ||
    currentUser?.email?.toLowerCase().includes('admin') ||
    currentUser?.email?.toLowerCase().includes('cmcred');

  const [flags, setFlags] = useState<CardFlagOption[]>(getCustomCardFlags());
  const [tabelaTaxa, setTabelaTaxa] = useState<RateTableType>('tabela_1');
  const [tipoCalculo, setTipoCalculo] = useState<'Valor Líquido' | 'Valor Bruto'>('Valor Líquido');
  const [parcelas, setParcelas] = useState<number>(8);
  const [valorDesejado, setValorDesejado] = useState<number>(1800);
  const [bandeiraCartao, setBandeiraCartao] = useState<string>('VISA_MASTER');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ratesVersion, setRatesVersion] = useState(0);

  useEffect(() => {
    fetchRatesFromDatabase().then(({ flags: dbFlags }) => {
      if (dbFlags && dbFlags.length > 0) {
        setFlags(dbFlags);
      }
      setRatesVersion(v => v + 1);
    });

    const handleUpdate = () => {
      setFlags(getCustomCardFlags());
      setRatesVersion(v => v + 1);
    };
    window.addEventListener('cmcred_rates_updated', handleUpdate);
    window.addEventListener('cmcred_flags_updated', handleUpdate);
    window.addEventListener('cmcred_rates_updated', handleUpdate);
    window.addEventListener('cmcred_flags_updated', handleUpdate);
    return () => {
      window.removeEventListener('cmcred_rates_updated', handleUpdate);
      window.removeEventListener('cmcred_flags_updated', handleUpdate);
      window.removeEventListener('cmcred_rates_updated', handleUpdate);
      window.removeEventListener('cmcred_flags_updated', handleUpdate);
    };
  }, []);

  // Cálculo em tempo real usando a fórmula e taxas oficiais do HTML
  const simulation = useMemo(() => {
    return calculateLoanSimulation({
      valorDesejado,
      parcelas,
      tipoCalculo,
      bandeiraCartao,
      tableType: tabelaTaxa
    });
  }, [valorDesejado, parcelas, tipoCalculo, bandeiraCartao, tabelaTaxa, ratesVersion]);

  // Tabela comparativa de 1x a 18x para a bandeira selecionada
  const installmentTable = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const p = i + 1;
      const res = calculateLoanSimulation({
        valorDesejado,
        parcelas: p,
        tipoCalculo,
        bandeiraCartao,
        tableType: tabelaTaxa
      });
      return {
        parcelas: p,
        taxa: res.taxaJuros,
        solicitado: res.valorSolicitado,
        total: res.valorTotal,
        parcela: res.valorParcela
      };
    });
  }, [valorDesejado, tipoCalculo, bandeiraCartao, tabelaTaxa, ratesVersion]);

  const selectedFlagObj = flags.find(f => f.key === bandeiraCartao) || flags[0] || { name: 'VISA / MASTER' };

  const getSimMessage = () => {
    return buildWhatsAppSimulationMessage({
      valorSolicitado: simulation.valorSolicitado,
      valorTotal: simulation.valorTotal,
      parcelas: simulation.parcelas,
      valorParcela: simulation.valorParcela,
      bandeira: selectedFlagObj.name
    });
  };

  const handleCopySimulation = async () => {
    try {
      const message = getSimMessage();
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Erro ao copiar texto:', e);
    }
  };

  const handleWhatsAppShare = () => {
    const message = getSimMessage();
    const cleanPhone = clientPhone.replace(/\D/g, '');
    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    if (cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
    }
    window.open(url, '_blank');
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFillColor(0, 168, 89);
    doc.rect(0, 0, 210, 15, 'F');

    try {
      const img = new Image();
      img.src = '/cmcred-logo.png';
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 15, 20, 20, 20);
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text('CM CRED', 38, 30);
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.setFont('helvetica', 'normal');
        doc.text('SOLUÇÕES FINANCEIRAS', 38, 36);
      } else {
        doc.setFontSize(24);
        doc.setTextColor(217, 119, 6);
        doc.text('CM CRED', 15, 35);
      }
    } catch (e) {
      console.error(e);
    }

    const flagLabel = selectedFlagObj.name;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data da Simulação: ${new Date().toLocaleDateString('pt-BR')}`, 145, 35);

    doc.setFontSize(22);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Proposta de Simulação de Empréstimo', 15, 60);

    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(1);
    doc.line(15, 65, 55, 65);

    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, 75, 180, 45, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9);
    doc.text('VALOR DAS PARCELAS', 25, 87);

    doc.setFontSize(28);
    doc.setTextColor(180, 83, 9);
    doc.text(`${simulation.parcelas}x de R$ ${simulation.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 25, 105);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bandeira: ${flagLabel} | Modo: ${tipoCalculo}`, 25, 115);

    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhamento da Proposta', 15, 140);

    const startY = 150;
    const rowHeight = 12;
    const labels = [
      ['Tipo de Operação', `Crédito Parcelado (${tipoCalculo})`],
      ['Bandeira do Cartão', flagLabel],
      ['Valor Liberado / Recebido no PIX', `R$ ${simulation.valorSolicitado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Prazo / Parcelas', `${simulation.parcelas} parcelas mensais`],
      ['Valor de Cada Parcela', `R$ ${simulation.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Total a Passar no Cartão', `R$ ${simulation.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
    ];

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    labels.forEach((row, i) => {
      doc.setTextColor(100, 100, 100);
      doc.text(row[0], 20, startY + (i * rowHeight));
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(row[1], 185, startY + (i * rowHeight), { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(240, 240, 240);
      doc.line(15, startY + (i * rowHeight) + 4, 195, startY + (i * rowHeight) + 4);
    });

    doc.setFillColor(217, 119, 6);
    doc.roundedRect(15, 235, 180, 22, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL A PASSAR NO CARTÃO', 25, 249);
    doc.setFontSize(16);
    doc.text(`R$ ${simulation.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 185, 249, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Esta simulação não garante a aprovação do crédito. Proposta válida por 24 horas.', 15, 280);

    doc.save(`Simulacao_CMCRED_${Date.now()}.pdf`);
    setIsGenerating(false);
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '24px',
    padding: '2rem',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.04)'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.9rem 1.25rem',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    color: '#0f172a',
    fontSize: '1.1rem',
    fontWeight: 700,
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ padding: '2.5rem', width: '100%', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Coins size={36} color="#d97706" /> Simulador de Empréstimo CM CRED
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.5rem', fontWeight: 500 }}>
          Cálculo dinâmico preciso de taxas por bandeira e parcelamento (1x a 18x)
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '2.5rem', alignItems: 'start' }}>

        {/* Coluna da Esquerda: Formulário de Simulação */}
        <div style={cardStyle}>

          {/* Opções de Tabela de Taxas (Tabela 1 ou Tabela 2) */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Sliders size={16} color="#d97706" /> Tabela de Taxas:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {TABLE_OPTIONS.map(opt => {
                const isSelected = tabelaTaxa === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTabelaTaxa(opt.id)}
                    style={{
                      padding: '0.9rem 1rem',
                      borderRadius: '14px',
                      border: `2px solid ${isSelected ? '#d97706' : '#e2e8f0'}`,
                      background: isSelected ? '#fffbeb' : '#ffffff',
                      color: isSelected ? '#b45309' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 12px rgba(217,119,6,0.15)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 900 }}>{opt.name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isSelected ? '#059669' : '#94a3b8' }}>{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tipo de Cálculo (Radio / Toggle) */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tipo de Cálculo:
            </label>
            <div style={{ display: 'flex', gap: '1rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '16px' }}>
              <button
                type="button"
                onClick={() => setTipoCalculo('Valor Líquido')}
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: tipoCalculo === 'Valor Líquido' ? '#d97706' : 'transparent',
                  color: tipoCalculo === 'Valor Líquido' ? '#ffffff' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tipoCalculo === 'Valor Líquido' ? '0 4px 10px rgba(217,119,6,0.25)' : 'none'
                }}
              >
                💵 Valor Líquido
              </button>
              <button
                type="button"
                onClick={() => setTipoCalculo('Valor Bruto')}
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: tipoCalculo === 'Valor Bruto' ? '#d97706' : 'transparent',
                  color: tipoCalculo === 'Valor Bruto' ? '#ffffff' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tipoCalculo === 'Valor Bruto' ? '0 4px 10px rgba(217,119,6,0.25)' : 'none'
                }}
              >
                💳 Valor Bruto
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Valor Desejado */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.6rem' }}>
                <Banknote size={16} color="#d97706" /> Valor Desejado (R$):
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={valorDesejado || ''}
                onChange={e => setValorDesejado(Math.max(0, Number(e.target.value)))}
                style={{ ...inputStyle, border: '2px solid #cbd5e1' }}
                placeholder="1000"
              />
            </div>

            {/* Número de Parcelas */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.6rem' }}>
                <CalendarDays size={16} color="#d97706" /> Número de Parcelas (1 a 18):
              </label>
              <input
                type="number"
                min="1"
                max="18"
                value={parcelas}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setParcelas(Math.min(18, Math.max(1, val)));
                }}
                style={{ ...inputStyle, border: '2px solid #cbd5e1' }}
              />
            </div>
          </div>

          {/* Bandeira do Cartão */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              <CreditCard size={16} color="#d97706" /> Bandeira do Cartão:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
              {flags.map(flag => {
                const isSelected = bandeiraCartao === flag.key;
                const currentFee = getRateForFlagAndInstallment(flag.key, parcelas, tabelaTaxa);
                return (
                  <button
                    key={flag.key}
                    type="button"
                    onClick={() => setBandeiraCartao(flag.key)}
                    style={{
                      padding: '1.25rem 0.75rem',
                      background: isSelected ? '#fffbeb' : '#ffffff',
                      border: `2px solid ${isSelected ? '#d97706' : '#e2e8f0'}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 12px rgba(217,119,6,0.15)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.75rem' }}>{flag.icon}</span>
                    <span style={{ color: isSelected ? '#b45309' : '#0f172a', fontSize: '0.85rem', fontWeight: 800, textAlign: 'center' }}>
                      {flag.name}
                    </span>
                    {isAdmin && (
                      <span style={{ color: isSelected ? '#b45309' : '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>
                        Taxa {parcelas}x: {currentFee.toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seleção Rápida de Parcelamento */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Layers size={14} /> Seleção Rápida de Parcelas:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setParcelas(n)}
                  style={{
                    padding: '0.65rem 0.25rem',
                    background: parcelas === n ? '#d97706' : '#f8fafc',
                    border: `1px solid ${parcelas === n ? '#d97706' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    color: parcelas === n ? '#ffffff' : '#334155',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.15s'
                  }}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Coluna da Direita: Resultado do Simulador e Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ ...cardStyle, background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)', border: '2px solid #fde68a' }}>

            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <span style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Valor da Parcela
              </span>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem', letterSpacing: '-1px' }}>
                <span style={{ fontSize: '1.5rem', color: '#d97706', verticalAlign: 'top', marginRight: '4px' }}>R$</span>
                {simulation.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.25rem' }}>
                {simulation.parcelas} parcelas no {selectedFlagObj.name} ({tabelaTaxa === 'tabela_1' ? 'Tabela 1' : 'Tabela 2'})
              </div>
            </div>

            {/* Resultado Estruturado */}
            <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Valor Liberado (Líquido):</span>
                <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>
                  R$ {simulation.valorSolicitado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Total a Passar no Cartão:</span>
                <strong style={{ color: '#d97706', fontSize: '1.1rem' }}>
                  R$ {simulation.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Prazo / Parcelas:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                  {simulation.parcelas}x
                </strong>
              </div>

              {isAdmin && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Taxa de Juros:</span>
                  <span style={{ color: '#ef4444', fontWeight: 800, background: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>
                    {simulation.taxaJuros.toFixed(2)}%
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Total de Juros:</span>
                <strong style={{ color: '#ef4444' }}>
                  R$ {simulation.valorJuros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ borderTop: '2px dashed #e2e8f0', margin: '0.3rem 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Valor da Parcela:</span>
                <strong style={{ color: '#d97706', fontSize: '1.25rem' }}>
                  R$ {simulation.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {/* Input de WhatsApp do Cliente */}
            <div style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                <Smartphone size={15} color="#25D366" /> WhatsApp do Cliente (Opcional):
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                placeholder="(79) 99999-9999"
                style={{ ...inputStyle, padding: '0.75rem 1rem', fontSize: '0.95rem' }}
              />
            </div>

            {/* Botões de Ação: WhatsApp, Copiar & PDF */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                style={{
                  width: '100%',
                  padding: '1.1rem',
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 8px 16px -4px rgba(37, 211, 102, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                <Send size={20} /> Enviar no WhatsApp do Cliente
              </button>

              <button
                type="button"
                onClick={handleCopySimulation}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  background: copied ? '#fffbeb' : '#f8fafc',
                  color: copied ? '#b45309' : '#334155',
                  border: `1.5px solid ${copied ? '#d97706' : '#cbd5e1'}`,
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? <Check size={18} color="#d97706" /> : <Copy size={18} />}
                {copied ? 'Mensagem Copiada com Sucesso!' : 'Copiar Texto da Simulação'}
              </button>

              <button
                type="button"
                onClick={generatePDF}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                <Download size={18} /> {isGenerating ? 'Gerando...' : 'Exportar Proposta PDF'}
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Tabela Completa de Parcelas (1x a 18x) */}
      <div style={{ marginTop: '3rem', ...cardStyle }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: '#0f172a', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={20} color="#d97706" /> Tabela Comparativa de Parcelamento (1x a 18x) — {flags.find(f => f.key === bandeiraCartao)?.name}
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 800 }}>Parcelas</th>
                {isAdmin && <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 800 }}>Taxa %</th>}
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 800 }}>Valor Solicitado</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 800 }}>Valor Total no Cartão</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 800 }}>Valor da Parcela</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 800, textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {installmentTable.map(row => {
                const isSelected = row.parcelas === parcelas;
                return (
                  <tr
                    key={row.parcelas}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#fffbeb' : 'transparent',
                      fontWeight: isSelected ? 700 : 500
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', color: isSelected ? '#d97706' : '#0f172a', fontWeight: 800 }}>
                      {row.parcelas}x
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0.85rem 1rem', color: '#ef4444' }}>
                        {row.taxa.toFixed(2)}%
                      </td>
                    )}
                    <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                      R$ {row.solicitado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#d97706', fontWeight: 700 }}>
                      R$ {row.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#0f172a', fontWeight: 800 }}>
                      {row.parcelas}x de R$ {row.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setParcelas(row.parcelas)}
                        style={{
                          background: isSelected ? '#d97706' : '#f1f5f9',
                          color: isSelected ? '#fff' : '#475569',
                          border: 'none',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        {isSelected ? 'Selecionado' : 'Simular'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Simulator;
