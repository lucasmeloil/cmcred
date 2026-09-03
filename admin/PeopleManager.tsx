import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Search, Filter, Edit2, Trash2, Users, Copy, Check, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { Customer } from './types';
import { validatePixKey, PixValidationResult } from '../lib/pixValidator';
import { useAutoRefresh } from '../lib/useAutoRefresh';

const PeopleManager: React.FC = () => {
  const { addNotification, logAudit, showConfirm } = useAuth();
  const [people, setPeople] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pixValidation, setPixValidation] = useState<PixValidationResult | null>(null);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  
  const initialPerson: Partial<Customer> = {
    name: '', 
    cpf: '', 
    phone: '', 
    email: '', 
    pix_key: '', 
    notes: '', 
    status: 'active', 
    person_type: 'customer'
  };
  
  const [formData, setFormData] = useState<Partial<Customer>>(initialPerson);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setPeople(data);
    } catch (err) {
      console.error('Erro ao buscar pessoas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Atualização automática em tempo real a cada 30 segundos
  useAutoRefresh(fetchPeople, 30000);

  const handlePixChange = (value: string) => {
    setFormData(prev => ({ ...prev, pix_key: value }));
    if (value.trim()) {
      setPixValidation(validatePixKey(value));
    } else {
      setPixValidation(null);
    }
  };

  const handleSave = async () => {
    // Validação de nome
    if (!formData.name?.trim()) {
      addNotification('O nome é obrigatório.', 'alerta');
      return;
    }

    // Validação de CPF para clientes
    if (formData.person_type === 'customer' && !formData.cpf?.trim()) {
      addNotification('O CPF é obrigatório para o cadastro de cliente.', 'alerta');
      return;
    }

    // Validação obrigatória da Chave PIX para clientes
    if (formData.person_type === 'customer') {
      const rawPix = (formData.pix_key || '').trim();
      if (!rawPix) {
        addNotification('A Chave PIX é obrigatória para o cadastro do cliente.', 'alerta');
        return;
      }

      const check = validatePixKey(rawPix);
      if (!check.isValid) {
        addNotification(`Chave PIX inválida: ${check.error || 'formato incorreto'}`, 'alerta');
        return;
      }
    }

    const payload = {
      name: formData.name?.trim(),
      cpf: formData.cpf?.trim() || '',
      phone: formData.phone?.trim() || '',
      email: formData.email?.trim() || '',
      pix_key: formData.pix_key?.trim() || '',
      notes: formData.notes?.trim() || '',
      status: formData.status || 'active',
      person_type: formData.person_type || 'customer'
    };

    if (editingId) {
      const { error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', editingId);
        
      if (!error) {
        await logAudit('edição', `Perfil de ${payload.name} atualizado com Chave PIX: ${payload.pix_key} (ID: ${editingId}).`);
        addNotification(`${payload.name} atualizado com sucesso!`, 'sucesso');
        fetchPeople();
        handleClose();
      } else {
        addNotification('Erro ao atualizar: ' + error.message, 'alerta');
      }
    } else {
      const { error } = await supabase.from('customers').insert([payload]);
      if (!error) {
        await logAudit('criação', `Novo cadastro criado: ${payload.name} (Chave PIX: ${payload.pix_key}, Tipo: ${payload.person_type}).`);
        addNotification(`${payload.name} cadastrado com sucesso!`, 'sucesso');
        fetchPeople();
        handleClose();
      } else {
        addNotification('Erro ao cadastrar: ' + error.message, 'alerta');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    
    const personName = people.find(p => p.id === id)?.name || 'Desconhecido';
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      await logAudit('exclusão', `Cadastro de ${personName} removido do sistema.`);
      addNotification(`Cadastro removido com sucesso.`, 'info');
      fetchPeople();
    } else {
      addNotification('Erro ao excluir: ' + error.message, 'alerta');
    }
  };

  const handleEdit = (person: Customer) => {
    setEditingId(person.id);
    setFormData(person);
    if (person.pix_key) {
      setPixValidation(validatePixKey(person.pix_key));
    } else {
      setPixValidation(null);
    }
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(initialPerson);
    setPixValidation(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPixId(id);
    addNotification(`Chave PIX copiada: ${text}`, 'sucesso');
    setTimeout(() => setCopiedPixId(null), 2500);
  };

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px', padding: '0.8rem 1rem',
    color: '#1e293b', fontSize: '0.9rem', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  };

  const typeLabels: Record<string, string> = {
    customer: 'Cliente',
    employee: 'Funcionário',
    admin: 'Administrador'
  };

  const typeColors: Record<string, string> = {
    customer: '#059669',
    employee: '#2563eb',
    admin: '#d97706'
  };

  const filtered = people.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = (
      c.name?.toLowerCase().includes(q) || 
      c.cpf?.includes(search) ||
      c.pix_key?.toLowerCase().includes(q) ||
      c.phone?.includes(search)
    );
    const matchType = typeFilter === 'all' || c.person_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={32} color="#d97706" /> Gestão de Clientes & Pessoas
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>
            Administre a base de clientes com Chave Pix validada para preenchimento automático nas operações.
          </p>
        </div>
        <button 
          className="action-button"
          onClick={() => {
            setFormData(initialPerson);
            setPixValidation(null);
            setEditingId(null);
            setShowForm(true);
          }}
          style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.85rem 1.75rem', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(217,119,6,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
        >
          <UserPlus size={20} /> Cadastrar Cliente
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Search size={18} /></span>
          <input 
            placeholder="Buscar por nome, CPF, telefone ou chave PIX..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.75rem' }}
          />
        </div>
        <div style={{ width: '220px' }}>
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="all">Todos os Perfis</option>
            <option value="customer">Apenas Clientes</option>
            <option value="employee">Apenas Funcionários</option>
            <option value="admin">Apenas Administradores</option>
          </select>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Carregando cadastros...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Nenhum cadastro encontrado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Portador / E-mail', 'Tipo', 'CPF', 'Telefone', 'Chave PIX (Para Repasse)', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '1.25rem 1.5rem', color: '#64748b', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ color: '#0f172a', fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>{p.email || 'Sem e-mail'}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ background: `${typeColors[p.person_type || 'customer']}10`, color: typeColors[p.person_type || 'customer'], padding: '0.35rem 0.85rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {typeLabels[p.person_type || 'customer'].toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#1e293b', fontWeight: 600 }}>{p.cpf || '—'}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontWeight: 500 }}>{p.phone || '—'}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {p.pix_key ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 800, 
                          color: '#0f172a', 
                          fontSize: '0.8rem', 
                          background: '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          padding: '3px 8px', 
                          borderRadius: '6px' 
                        }}>
                          {p.pix_key}
                        </span>
                        <button
                          type="button"
                          title="Copiar Chave PIX"
                          onClick={() => copyToClipboard(p.pix_key || '', p.id)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: copiedPixId === p.id ? '#059669' : '#94a3b8', 
                            padding: '3px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          {copiedPixId === p.id ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>
                        Pendente
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: p.status === 'active' ? '#059669' : '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.status === 'active' ? '#059669' : '#ef4444' }}></span>
                      {p.status === 'active' ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleEdit(p)}
                      title="Editar e Auditoria"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(p.id)}
                      title="Excluir"
                      style={{ background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Cadastro / Edição */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#ffffff', padding: '2.5rem', borderRadius: '32px', width: '100%', maxWidth: '580px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#0f172a', marginTop: 0, marginBottom: '1.5rem', fontWeight: 800, fontSize: '1.65rem' }}>
              {editingId ? '📝 Editar Cadastro & Chave PIX' : '👤 Novo Cadastro de Cliente'}
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>TIPO DE PERFIL NO SISTEMA</label>
                <select style={inputStyle} value={formData.person_type} onChange={e => setFormData({...formData, person_type: e.target.value as any})}>
                  <option value="customer">Cliente Final</option>
                  <option value="employee">Funcionário / Agente</option>
                  <option value="admin">Administrador Associado</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#0f172a', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>
                  NOME COMPLETO DO PORTADOR <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input placeholder="Nome Completo" style={inputStyle} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div>
                <label style={{ color: '#0f172a', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>
                  CPF (APENAS NÚMEROS) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input placeholder="000.000.000-00" style={inputStyle} value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>

              <div>
                <label style={{ color: '#0f172a', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>
                  TELEFONE / WHATSAPP <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input placeholder="(00) 00000-0000" style={inputStyle} value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>

              {/* CAMPO DE CHAVE PIX OBRIGATÓRIA COM VALIDAÇÃO EM TEMPO REAL */}
              <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    CHAVE PIX PARA REPASSE <span style={{ color: '#dc2626' }}>* (Obrigatório)</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {formData.cpf && (
                      <button
                        type="button"
                        onClick={() => handlePixChange(formData.cpf || '')}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.7rem', padding: '3px 8px', color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Copiar CPF
                      </button>
                    )}
                    {formData.phone && (
                      <button
                        type="button"
                        onClick={() => handlePixChange(formData.phone || '')}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.7rem', padding: '3px 8px', color: '#059669', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Copiar Telefone
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    placeholder="Digite a Chave Pix (CPF, CNPJ, Celular, E-mail ou Aleatória)"
                    style={{
                      ...inputStyle,
                      borderColor: pixValidation ? (pixValidation.isValid ? '#10b981' : '#ef4444') : '#cbd5e1',
                      borderWidth: pixValidation ? '2px' : '1px',
                      background: pixValidation ? (pixValidation.isValid ? '#f0fdf4' : '#fef2f2') : '#ffffff'
                    }}
                    value={formData.pix_key || ''}
                    onChange={e => handlePixChange(e.target.value)}
                  />
                  {pixValidation && (
                    <span style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: pixValidation.isValid ? '#059669' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      {pixValidation.isValid ? (
                        <>✓ {pixValidation.label}</>
                      ) : (
                        <>✕ Inválido</>
                      )}
                    </span>
                  )}
                </div>

                {pixValidation && !pixValidation.isValid && pixValidation.error && (
                  <p style={{ margin: '0.4rem 0 0', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>
                    {pixValidation.error}
                  </p>
                )}
                {pixValidation && pixValidation.isValid && (
                  <p style={{ margin: '0.4rem 0 0', color: '#059669', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Sparkles size={13} /> Chave identificada com sucesso: <strong>{pixValidation.label}</strong>
                  </p>
                )}
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>E-MAIL (OPCIONAL)</label>
                <input placeholder="cliente@email.com" style={inputStyle} value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>MEMORIAL / OBSERVAÇÕES</label>
                <textarea placeholder="Observações sobre este cadastro..." style={{ ...inputStyle, minHeight: '80px', resize: 'none' }} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.4rem', display: 'block', fontWeight: 700 }}>STATUS OPERACIONAL</label>
                <select style={inputStyle} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                  <option value="active">Ativo (Permitir Operações)</option>
                  <option value="inactive">Inativo (Bloquear Operações)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button 
                type="button"
                onClick={handleClose} 
                style={{ flex: 1, background: '#f1f5f9', border: 'none', color: '#64748b', padding: '0.85rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}
              >
                Descartar
              </button>
              <button 
                type="button"
                onClick={handleSave} 
                style={{ 
                  flex: 1, 
                  background: '#d97706', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '0.85rem', 
                  borderRadius: '12px', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  boxShadow: '0 4px 6px -1px rgba(217,119,6,0.25)' 
                }}
              >
                {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleManager;
