import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Cpu, 
  DollarSign, 
  X, 
  Landmark, 
  ArrowRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { 
  getPendingSettlementBatches, 
  calculateLoanFinancials, 
  type MachineSettlementBatch 
} from '../lib/rates';

interface MachineSettlementAlertBannerProps {
  loans: any[];
  onSettlementSuccess?: () => void;
}

export const MachineSettlementAlertBanner: React.FC<MachineSettlementAlertBannerProps> = ({
  loans,
  onSettlementSuccess
}) => {
  const { addNotification, logAudit, currentUser } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState<MachineSettlementBatch | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Agrupar os empréstimos em lotes pendentes de liquidação bancária
  const pendingBatches = useMemo(() => {
    return getPendingSettlementBatches(loans);
  }, [loans]);

  // Lotes prontos para confirmação hoje ou que já venceram
  const readyBatches = useMemo(() => {
    return pendingBatches.filter(b => b.isReadyToday);
  }, [pendingBatches]);

  // Detalhes das operações do lote selecionado
  const batchLoansDetails = useMemo(() => {
    if (!selectedBatch) return [];
    return loans.filter(l => selectedBatch.loanIds.includes(l.id)).map(l => {
      const fin = calculateLoanFinancials(l);
      const clientName = l.customers?.name || l.leads?.name || l.lead_name || 'Cliente';
      return {
        id: l.id,
        createdAt: l.created_at,
        clientName,
        cardBrand: fin.cardBrand,
        installments: fin.installments,
        grossAmount: fin.grossAmount,
        machineFeeAmount: fin.machineFeeAmount,
        machineNetReceipt: fin.machineNetReceipt
      };
    });
  }, [selectedBatch, loans]);

  // Se não houver nenhum lote pronto para confirmação hoje, não exibe o banner
  if (readyBatches.length === 0) {
    return null;
  }

  const formatBRL = (val: number) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Executar a baixa do lote com 1 clique após confirmação no banco
  const handleConfirmSettlement = async () => {
    if (!selectedBatch) return;

    setConfirming(true);
    try {
      const nowIso = new Date().toISOString();
      const currentUserId = currentUser?.id || null;

      // 1. Atualizar status de liquidação nos empréstimos do lote
      const { error: loanErr } = await supabase
        .from('loans')
        .update({
          settlement_status: 'settled',
          settled_at: nowIso,
          settled_by: currentUserId
        })
        .in('id', selectedBatch.loanIds);

      if (loanErr) throw loanErr;

      // 2. Atualizar as contas a receber correspondentes na tabela financeira
      const { error: finErr } = await supabase
        .from('finance')
        .update({
          status: 'paid'
        })
        .in('loan_id', selectedBatch.loanIds)
        .eq('type', 'receivable');

      if (finErr) {
        console.warn('Aviso ao atualizar financeiro de recebíveis:', finErr.message);
      }

      // 3. Registrar auditoria do sistema
      await logAudit(
        'confirmação_lote_maquininha',
        `Lote da maquininha "${selectedBatch.machineName}" (${selectedBatch.loansCount} operações) confirmado recebimento bancário com 1 clique. Total Líquido Consolidado: R$ ${formatBRL(selectedBatch.totalNetReceipt)}`
      );

      // 4. Notificar e atualizar
      addNotification(
        `Lote "${selectedBatch.machineName}" (R$ ${formatBRL(selectedBatch.totalNetReceipt)}) liquidado com sucesso! Saldo consolidado no caixa.`,
        'sucesso'
      );

      setSelectedBatch(null);
      if (onSettlementSuccess) {
        onSettlementSuccess();
      }
    } catch (err: any) {
      console.error('Erro ao liquidar lote de maquininha:', err);
      addNotification('Erro ao confirmar recebimento: ' + (err.message || 'Erro de conexão'), 'alerta');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      {/* BANNER DE NOTIFICAÇÃO INTELIGENTE (OPÇÃO 2: 1 CLIQUE) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginBottom: '1.5rem' }}>
        {readyBatches.map(batch => {
          const isOverdue = batch.isOverdue;
          return (
            <div
              key={`${batch.machineId}_${batch.dueDate}`}
              style={{
                background: isOverdue 
                  ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' 
                  : 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)',
                border: isOverdue ? '2px solid #fdba74' : '2px solid #fde047',
                borderRadius: '20px',
                padding: '1.1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 8px 20px -4px rgba(217,119,6,0.15)',
                animation: 'pulse 2s infinite'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: isOverdue ? '#ea580c' : '#ca8a04',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}>
                  <Bell size={22} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: isOverdue ? '#fee2e2' : '#fef3c7',
                      color: isOverdue ? '#b91c1c' : '#92400e',
                      border: `1px solid ${isOverdue ? '#fca5a5' : '#fde68a'}`
                    }}>
                      {isOverdue ? 'Atenção: Vencido / A Confirmar' : 'Disponível para Conferência Hoje'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                      Prazo: D+{batch.liquidationDays} ({new Date(batch.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')})
                    </span>
                  </div>

                  <h3 style={{ margin: '0.3rem 0 0', fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                    🔔 Lote {batch.machineName} a Receber: <strong style={{ color: '#047857' }}>R$ {formatBRL(batch.totalNetReceipt)}</strong> ({batch.loansCount} {batch.loansCount === 1 ? 'operação' : 'operações'})
                  </h3>
                </div>
              </div>

              {/* Botão de 1 Clique */}
              <button
                type="button"
                onClick={() => setSelectedBatch(batch)}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem 1.4rem',
                  borderRadius: '12px',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(4,120,87,0.3)',
                  transition: 'all 0.15s'
                }}
              >
                <CheckCircle2 size={18} /> Conferir no Banco e Confirmar Recebimento
              </button>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CONFERÊNCIA BANCÁRIA E CONFIRMAÇÃO COM 1 CLIQUE */}
      {selectedBatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '2rem',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {/* Cabeçalho do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Landmark size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                    Conferência Bancária de Lote — {selectedBatch.machineName}
                  </h2>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                    Data prevista de depósito: {new Date(selectedBatch.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')} (D+{selectedBatch.liquidationDays})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Caixa Informativa com Instrução de Segurança */}
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              borderRadius: '16px',
              padding: '1.1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <ShieldCheck size={24} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.85rem', color: '#065f46', lineHeight: 1.4 }}>
                <strong style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.92rem' }}>
                  Passo 1: Verifique o aplicativo do seu banco vinculado
                </strong>
                Confirme se a adquirente (Cielo, Rede, Stone, PagBank, etc.) já efetuou o depósito de 
                <strong style={{ color: '#047857', fontSize: '1rem', margin: '0 4px' }}>
                  R$ {formatBRL(selectedBatch.totalNetReceipt)}
                </strong>
                na conta corrente da empresa. Ao clicar em <strong>Confirmar Recebimento</strong>, o sistema dará baixa automática nas {selectedBatch.loansCount} operações, zerando os recebíveis pendentes e consolidando o saldo no caixa.
              </div>
            </div>

            {/* Resumo Financeiro Consolidado do Lote */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem'
            }}>
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Total Bruto Cartão</span>
                <strong style={{ fontSize: '1.15rem', color: '#1e40af', fontWeight: 900 }}>
                  R$ {formatBRL(selectedBatch.totalGross)}
                </strong>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Taxa MDR Retida</span>
                <strong style={{ fontSize: '1.15rem', color: '#b91c1c', fontWeight: 900 }}>
                  - R$ {formatBRL(selectedBatch.totalMachineFee)}
                </strong>
              </div>

              <div style={{ background: '#ecfdf5', padding: '0.9rem', borderRadius: '14px', border: '1.5px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Líquido Depositado</span>
                <strong style={{ fontSize: '1.25rem', color: '#047857', fontWeight: 900 }}>
                  R$ {formatBRL(selectedBatch.totalNetReceipt)}
                </strong>
              </div>
            </div>

            {/* Tabela das Operações do Lote */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                Operações incluídas neste lote ({batchLoansDetails.length}):
              </span>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Data / ID</th>
                      <th style={{ padding: '8px 12px' }}>Cliente</th>
                      <th style={{ padding: '8px 12px' }}>Cartão</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Bruto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>MDR</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#047857' }}>Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchLoansDetails.map((item, idx) => (
                      <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>
                          #{item.id.slice(0, 6).toUpperCase()}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {item.clientName}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>
                          {item.cardBrand} ({item.installments}x)
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>
                          R$ {formatBRL(item.grossAmount)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b91c1c' }}>
                          - R$ {formatBRL(item.machineFeeAmount)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                          R$ {formatBRL(item.machineNetReceipt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ações do Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                disabled={confirming}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Deixar para Depois
              </button>

              <button
                type="button"
                onClick={handleConfirmSettlement}
                disabled={confirming}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem 1.6rem',
                  borderRadius: '12px',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  cursor: confirming ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(4,120,87,0.3)'
                }}
              >
                {confirming ? (
                  'Liquidando Lote...'
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Confirmar Recebimento do Lote (R$ {formatBRL(selectedBatch.totalNetReceipt)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
