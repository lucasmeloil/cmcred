import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { useAuth } from './AuthContext';
import { 
  Users, 
  Plus, 
  Search, 
  QrCode, 
  Phone, 
  Mail, 
  FileText, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  ArrowRight,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import type { Customer } from './types';
import { validatePixKey } from '../lib/pixValidator';
import { useAutoRefresh } from '../lib/useAutoRefresh';

const CustomersManager: React.FC = () => {
  const { addNotification, logAudit, showConfirm } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    pix_key: '',
    notes: '',
    status: 'active' as 'active' | 'inactive'
  });

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setCustomers(data);
      } else {
        const adminRes = await supabaseAdmin
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });
        if (adminRes.data) setCustomers(adminRes.data);
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();

    // Sincronização em tempo real via Supabase Realtime Channels
    const channel = supabase
      .channel('realtime-customers-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCustomers]);

  // Auto-refresh a cada 30 segundos e ao retornar para a aba (sem necessidade de F5)
  useAutoRefresh(fetchCustomers, 30000);

  // Validação em tempo real da Chave PIX
  const pixValidation = useMemo(() => {
    return validatePixKey(formData.pix_key);
  }, [formData.pix_key]);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      cpf: '',
      phone: '',
      email: '',
      pix_key: '',
      notes: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name || '',
      cpf: customer.cpf || '',
      phone: customer.phone || '',
      email: customer.email || '',
      pix_key: customer.pix_key || '',
      notes: customer.notes || '',
      status: customer.status || 'active'
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  // Copiar CPF ou Telefone para Chave PIX com 1 clique
  const handleCopyCpfToPix = () => {
    if (!formData.cpf.trim()) {
      return addNotification('Preencha o CPF do cliente primeiro.', 'alerta');
    }
    setFormData(prev => ({ ...prev, pix_key: prev.cpf.trim() }));
  };

  const handleCopyPhoneToPix = () => {
    if (!formData.phone.trim()) {
      return addNotification('Preencha o telefone do cliente primeiro.', 'alerta');
    }
    setFormData(prev => ({ ...prev, pix_key: prev.phone.trim() }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return addNotification('O nome do cliente é obrigatório.', 'alerta');
    }

    // Validação estrita da Chave PIX obrigatória
    if (!pixValidation.isValid) {
      return addNotification(pixValidation.error || 'A Chave PIX informada é inválida. Corrija antes de salvar.', 'alerta');
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        cpf: formData.cpf.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        pix_key: pixValidation.formatted || formData.pix_key.trim(),
        notes: formData.notes.trim() || null,
        status: formData.status
      };

      if (editingId) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        addNotification(`Cliente "${formData.name}" atualizado com sucesso!`, 'sucesso');
        await logAudit('edição_cliente', `Cliente ${formData.name} atualizado (Chave PIX: ${pixValidation.label})`);
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload]);

        if (error) throw error;
        addNotification(`Cliente "${formData.name}" cadastrado com sucesso com Chave PIX!`, 'sucesso');
        await logAudit('cadastro_cliente', `Cliente ${formData.name} cadastrado com Chave PIX (${pixValidation.label})`);
      }

      handleCloseModal();
      fetchCustomers();
    } catch (err: any) {
      addNotification('Erro ao salvar cliente: ' + (err.message || 'Erro desconhecido'), 'alerta');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPixKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      addNotification('Chave PIX copiada para a área de transferência!', 'sucesso');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      addNotification('Não foi possível copiar.', 'alerta');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#0f172a',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontWeight: 600,
    transition: 'border-color 0.2s'
  };

  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.cpf?.includes(search) || 
    c.phone?.includes(search) ||
    c.pix_key?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '2.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={34} color="#d97706" /> Gestão de Clientes & Base PIX
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Base oficial de clientes com validação obrigatória de Chave PIX e auto-preenchimento no lançamento de crédito
          </p>
        </div>

        <button 
          type="button"
          onClick={handleOpenNew}
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
          <Plus size={18} /> Cadastrar Novo Cliente
        </button>
      </div>

      {/* Barra de Busca e Métricas */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
        <Search size={20} color="#94a3b8" />
        <input 
          type="text" 
          placeholder="Buscar cliente por nome, CPF, telefone ou Chave PIX..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}
        />
        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
          {filtered.length} Clientes Cadastrados
        </span>
      </div>

      {/* Tabela de Clientes */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '5rem', textAlign: 'center', color: '#d97706', fontWeight: 800 }}>
            CARREGANDO BASE DE CLIENTES...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  {['Cliente', 'CPF', 'Contato', 'Chave PIX Obrigatória', 'Status', 'Cadastro', 'Ações'].map((h, i) => (
                    <th key={h} style={{ padding: '1.1rem 1.25rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const keyVal = validatePixKey(c.pix_key || '');
                  return (
                    <tr 
                      key={c.id} 
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>{c.name}</div>
                        {c.email && <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.15rem' }}>{c.email}</div>}
                      </td>

                      {/* CPF */}
                      <td style={{ padding: '1.1rem 1.25rem', color: '#334155', fontWeight: 700, fontSize: '0.88rem' }}>
                        {c.cpf || <span style={{ color: '#94a3b8' }}>Não informado</span>}
                      </td>

                      {/* Telefone */}
                      <td style={{ padding: '1.1rem 1.25rem', color: '#334155', fontWeight: 700, fontSize: '0.88rem' }}>
                        {c.phone || <span style={{ color: '#94a3b8' }}>Não informado</span>}
                      </td>

                      {/* Chave PIX */}
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        {c.pix_key ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.35rem 0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <QrCode size={14} color="#15803d" />
                              <span style={{ color: '#15803d', fontWeight: 800, fontSize: '0.82rem' }}>
                                {keyVal.formatted || c.pix_key}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700, background: '#dcfce7', padding: '2px 6px', borderRadius: '6px' }}>
                                {keyVal.label}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyPixKey(c.pix_key!)}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}
                              title="Copiar Chave PIX"
                            >
                              {copiedKey === c.pix_key ? <Check size={13} color="#15803d" /> : <Copy size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <AlertCircle size={12} /> Pendente de Chave
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <span style={{ 
                          background: c.status === 'active' ? '#dcfce7' : '#fee2e2', 
                          color: c.status === 'active' ? '#15803d' : '#b91c1c', 
                          padding: '0.3rem 0.75rem', 
                          borderRadius: '100px', 
                          fontSize: '0.75rem', 
                          fontWeight: 800 
                        }}>
                          {c.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Cadastro */}
                      <td style={{ padding: '1.1rem 1.25rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <button 
                          type="button"
                          onClick={() => handleEdit(c)}
                          style={{ 
                            background: '#f8fafc', 
                            border: '1.5px solid #cbd5e1', 
                            color: '#0f172a', 
                            padding: '0.45rem 0.85rem', 
                            borderRadius: '10px', 
                            fontSize: '0.8rem', 
                            cursor: 'pointer', 
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          <Edit3 size={13} color="#2563eb" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO DE CLIENTE COM VALIDAÇÃO DE CHAVE PIX */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#ffffff', borderRadius: '28px', padding: '2.5rem', width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Users size={26} color="#d97706" /> {editingId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.2rem 0 0', fontWeight: 500 }}>
                  A Chave PIX é obrigatória para repasse automático nos lançamentos de empréstimo.
                </p>
              </div>

              <button type="button" onClick={handleCloseModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Nome Completo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Nome Completo *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Nome do cliente portador"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* CPF e Telefone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    CPF do Cliente
                  </label>
                  <input 
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Telefone Celular / WhatsApp
                  </label>
                  <input 
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  E-mail
                </label>
                <input 
                  type="email"
                  placeholder="cliente@email.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* CAMPO OBRIGATÓRIO: CHAVE PIX COM VALIDAÇÃO AUTOMÁTICA */}
              <div style={{ background: '#fffbeb', border: '2px solid #fde68a', borderRadius: '18px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ color: '#b45309', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase' }}>
                    <QrCode size={18} color="#d97706" /> Chave PIX para Repasse (Obrigatória) *
                  </label>

                  {/* Ações Rápidas de Cópia */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={handleCopyCpfToPix}
                      style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', cursor: 'pointer' }}
                    >
                      Copiar CPF
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPhoneToPix}
                      style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', cursor: 'pointer' }}
                    >
                      Copiar Telefone
                    </button>
                  </div>
                </div>

                <input 
                  type="text"
                  required
                  placeholder="Informe o CPF, CNPJ, E-mail, Celular ou Chave Aleatória"
                  value={formData.pix_key}
                  onChange={e => setFormData({ ...formData, pix_key: e.target.value })}
                  style={{
                    ...inputStyle,
                    border: pixValidation.isValid ? '2px solid #15803d' : formData.pix_key ? '2px solid #dc2626' : '2px solid #cbd5e1',
                    fontSize: '1rem',
                    fontWeight: 800
                  }}
                />

                {/* Feedback e Detecção em Tempo Real */}
                <div style={{ marginTop: '0.65rem' }}>
                  {pixValidation.isValid ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontSize: '0.82rem', fontWeight: 800 }}>
                      <CheckCircle2 size={16} />
                      <span>Chave PIX válida: <strong>{pixValidation.label}</strong> ({pixValidation.formatted})</span>
                    </div>
                  ) : formData.pix_key ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}>
                      <AlertCircle size={15} />
                      <span>{pixValidation.error}</span>
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                      Formatos aceitos: CPF (11 dígitos), CNPJ (14 dígitos), E-mail, Celular com DDD ou Chave Aleatória (EVP/UUID).
                    </div>
                  )}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Observações Internas (Opcional)
                </label>
                <textarea 
                  placeholder="Anotações sobre preferências, limite de cartão, etc."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'none' }}
                />
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
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
                  disabled={saving || !pixValidation.isValid}
                  style={{
                    flex: 2,
                    padding: '1rem',
                    background: pixValidation.isValid ? '#d97706' : '#94a3b8',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '1rem',
                    cursor: saving || !pixValidation.isValid ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    boxShadow: pixValidation.isValid ? '0 8px 16px -4px rgba(217,119,6,0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <CheckCircle2 size={20} />
                  {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default CustomersManager;
