import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UserPlus, Search, Filter, Edit2, Trash2, Users, Copy, Check, Sparkles, 
  MapPin, Home, Loader2, Navigation, Building2, X, CheckCircle, ShieldCheck
} from 'lucide-react';
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
  
  // Responsividade adaptativa
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 900 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // CEP Lookup States
  const [cepLoading, setCepLoading] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const addressNumberRef = useRef<HTMLInputElement>(null);

  const initialPerson: Partial<Customer> = {
    name: '', 
    cpf: '', 
    phone: '', 
    email: '', 
    pix_key: '', 
    notes: '', 
    status: 'active', 
    person_type: 'customer',
    cep: '',
    address: '',
    address_number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  };
  
  const [formData, setFormData] = useState<Partial<Customer>>(initialPerson);

  const fetchPeople = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setPeople(data);
      }
    } catch (err) {
      console.error('Erro ao buscar pessoas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();

    // Sincronização em tempo real do banco de dados Supabase
    const channel = supabase
      .channel('realtime-customers-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchPeople(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPeople]);

  // Atualização automática em tempo real a cada 30 segundos
  useAutoRefresh(fetchPeople, 30000);

  const formatCep = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 8);
    if (raw.length > 5) {
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    return raw;
  };

  const formatCpf = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 3) return raw;
    if (raw.length <= 6) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
    if (raw.length <= 9) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw ? `(${raw}` : '';
    if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  };

  const handleCepLookup = async (cepInput: string) => {
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      if (cleanCep.length > 0 && cleanCep.length < 8) {
        setCepStatus({ message: 'Digite os 8 dígitos do CEP para busca automática.', isError: true });
      }
      return;
    }

    setCepLoading(true);
    setCepStatus({ message: 'Buscando endereço via CEP...' });

    try {
      let found = false;

      // 1. ViaCEP primário
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              cep: formatCep(cleanCep),
              address: data.logradouro || prev.address || '',
              neighborhood: data.bairro || prev.neighborhood || '',
              city: data.localidade || prev.city || '',
              state: data.uf || prev.state || '',
              complement: prev.complement || data.complemento || ''
            }));
            setCepStatus({ message: `✓ Endereço localizado: ${data.localidade || ''} - ${data.uf || ''}` });
            found = true;
            setTimeout(() => addressNumberRef.current?.focus(), 150);
          }
        }
      } catch (err) {
        console.warn('ViaCEP indisponível, tentando BrasilAPI...');
      }

      // 2. BrasilAPI fallback
      if (!found) {
        try {
          const bRes = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
          if (bRes.ok) {
            const bData = await bRes.json();
            setFormData(prev => ({
              ...prev,
              cep: formatCep(cleanCep),
              address: bData.street || prev.address || '',
              neighborhood: bData.neighborhood || prev.neighborhood || '',
              city: bData.city || prev.city || '',
              state: bData.state || prev.state || '',
              complement: prev.complement || ''
            }));
            setCepStatus({ message: `✓ Endereço localizado: ${bData.city || ''} - ${bData.state || ''}` });
            found = true;
            setTimeout(() => addressNumberRef.current?.focus(), 150);
          }
        } catch (be) {
          console.warn('BrasilAPI indisponível');
        }
      }

      if (!found) {
        setCepStatus({ message: 'CEP não encontrado. Preencha o endereço manualmente.', isError: true });
      }
    } catch (err) {
      setCepStatus({ message: 'Erro ao consultar CEP. Preencha manualmente.', isError: true });
    } finally {
      setCepLoading(false);
    }
  };

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
      addNotification('O nome do portador é obrigatório.', 'alerta');
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
      person_type: formData.person_type || 'customer',
      cep: formData.cep?.trim() || '',
      address: formData.address?.trim() || '',
      address_number: formData.address_number?.trim() || '',
      complement: formData.complement?.trim() || '',
      neighborhood: formData.neighborhood?.trim() || '',
      city: formData.city?.trim() || '',
      state: formData.state?.trim() || ''
    };

    if (editingId) {
      const { error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', editingId);
        
      if (!error) {
        await logAudit('edição', `Perfil de ${payload.name} atualizado (Chave PIX: ${payload.pix_key}, CEP: ${payload.cep || 'N/A'}).`);
        addNotification(`${payload.name} atualizado com sucesso!`, 'sucesso');
        fetchPeople();
        handleClose();
      } else {
        addNotification('Erro ao atualizar: ' + error.message, 'alerta');
      }
    } else {
      const { error } = await supabase.from('customers').insert([payload]);
      if (!error) {
        await logAudit('criação', `Novo cadastro criado: ${payload.name} (Chave PIX: ${payload.pix_key}, CEP: ${payload.cep || 'N/A'}).`);
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
    setFormData({
      ...initialPerson,
      ...person,
      cep: person.cep || '',
      address: person.address || '',
      address_number: person.address_number || '',
      complement: person.complement || '',
      neighborhood: person.neighborhood || '',
      city: person.city || '',
      state: person.state || ''
    });
    setCepStatus(person.city ? { message: `✓ Endereço cadastrado: ${person.city} - ${person.state || ''}` } : null);
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
    setCepStatus(null);
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
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px', padding: '0.8rem 1rem',
    color: '#1e293b', fontSize: '0.9rem', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    transition: 'all 0.2s'
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
      c.phone?.includes(search) ||
      c.city?.toLowerCase().includes(q) ||
      c.neighborhood?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.cep?.includes(search)
    );
    const matchType = typeFilter === 'all' || c.person_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{ padding: isMobile ? '1.25rem' : '2.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', fontSize: isMobile ? '1.5rem' : '2rem', margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={isMobile ? 26 : 32} color="#d97706" /> Gestão de Clientes & Pessoas
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontWeight: 500, fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
            Administre a base de clientes com endereço completo integrado à API de CEP e Chave Pix validada para repasses.
          </p>
        </div>
        <button 
          className="action-button"
          onClick={() => {
            setFormData(initialPerson);
            setPixValidation(null);
            setCepStatus(null);
            setEditingId(null);
            setShowForm(true);
          }}
          style={{ 
            background: '#d97706', color: '#fff', border: 'none', 
            padding: '0.85rem 1.75rem', borderRadius: '14px', fontWeight: 700, 
            cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(217,119,6,0.2)', 
            display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap',
            width: isMobile ? '100%' : 'auto', justifyContent: 'center'
          }}
        >
          <UserPlus size={20} /> Cadastrar Cliente
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Search size={18} /></span>
          <input 
            placeholder="Buscar por nome, CPF, telefone, chave PIX, endereço ou cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.75rem' }}
          />
        </div>
        <div style={{ width: isMobile ? '100%' : '220px' }}>
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Portador / E-mail', 'Tipo', 'CPF', 'Telefone', 'Endereço Completo', 'Chave PIX (Para Repasse)', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '1.25rem 1.5rem', color: '#64748b', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1.25rem 1.5rem', minWidth: '180px' }}>
                      <div style={{ color: '#0f172a', fontWeight: 700 }}>{p.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>{p.email || 'Sem e-mail'}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', whiteSpace: 'nowrap' }}>
                      <span style={{ background: `${typeColors[p.person_type || 'customer']}10`, color: typeColors[p.person_type || 'customer'], padding: '0.35rem 0.85rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {typeLabels[p.person_type || 'customer'].toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.cpf || '—'}</td>
                    <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.phone || '—'}</td>
                    
                    {/* Endereço Completo */}
                    <td style={{ padding: '1.25rem 1.5rem', minWidth: '220px' }}>
                      {p.address || p.city ? (
                        <div>
                          <div style={{ color: '#0f172a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MapPin size={13} color="#d97706" style={{ flexShrink: 0 }} />
                            <span>
                              {p.address ? `${p.address}${p.address_number ? `, nº ${p.address_number}` : ''}` : ''}
                              {p.complement ? ` (${p.complement})` : ''}
                            </span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px', paddingLeft: '1.1rem' }}>
                            {[p.neighborhood, p.city, p.state].filter(Boolean).join(' • ')}
                            {p.cep && <span style={{ marginLeft: '6px', color: '#94a3b8', fontFamily: 'monospace' }}>CEP {p.cep}</span>}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Não informado</span>
                      )}
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem', whiteSpace: 'nowrap' }}>
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
                    <td style={{ padding: '1.25rem 1.5rem', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: p.status === 'active' ? '#059669' : '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.status === 'active' ? '#059669' : '#ef4444' }}></span>
                        {p.status === 'active' ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL RESPONSIVO: DESKTOP HORIZONTAL (2 COLUNAS) & MOBILE NATIVO */}
      {showForm && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(15,23,42,0.65)', 
          backdropFilter: 'blur(10px)', 
          display: 'flex', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          justifyContent: 'center', 
          zIndex: 100, 
          padding: isMobile ? 0 : '1.5rem',
          overflowY: 'auto'
        }}>
          <div style={{ 
            background: '#ffffff', 
            borderRadius: isMobile ? '0px' : '28px', 
            width: isMobile ? '100vw' : '96vw', 
            maxWidth: isMobile ? '100vw' : '1100px', 
            minHeight: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? 'none' : '90vh', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', 
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: isMobile ? 'none' : '1px solid #f1f5f9'
          }}>
            {/* Header Fixo / Sticky do Modal */}
            <div style={{ 
              padding: isMobile ? '1.25rem 1.5rem' : '1.5rem 2.25rem', 
              borderBottom: '1px solid #f1f5f9', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: '#ffffff',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ color: '#0f172a', margin: 0, fontWeight: 900, fontSize: isMobile ? '1.35rem' : '1.7rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {editingId ? '📝 Editar Cadastro de Cliente' : '👤 Novo Cadastro de Cliente'}
                </h2>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                  Preencha os dados do cliente, chave PIX e endereço integrado com consulta CEP automática.
                </p>
              </div>
              <button 
                type="button" 
                onClick={handleClose} 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', cursor: 'pointer', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Corpo do Formulário com Scroll Suave */}
            <div style={{ 
              padding: isMobile ? '1.25rem' : '1.75rem 2.25rem', 
              overflowY: 'auto', 
              flex: 1 
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr', 
                gap: isMobile ? '1.5rem' : '2rem',
                alignItems: 'start'
              }}>
                {/* ============================================================ */}
                {/* COLUNA ESQUERDA: DADOS PESSOAIS, CONTATO & CHAVE PIX        */}
                {/* ============================================================ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Bloco 1: Perfil & Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Tipo de Perfil
                      </label>
                      <select style={inputStyle} value={formData.person_type} onChange={e => setFormData({...formData, person_type: e.target.value as any})}>
                        <option value="customer">Cliente Final</option>
                        <option value="employee">Funcionário / Agente</option>
                        <option value="admin">Administrador Associado</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Status no Sistema
                      </label>
                      <select style={inputStyle} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value="active">● Ativo (Liberar)</option>
                        <option value="inactive">○ Inativo (Bloquear)</option>
                      </select>
                    </div>
                  </div>

                  {/* Nome Completo */}
                  <div>
                    <label style={{ color: '#0f172a', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                      Nome Completo do Portador <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input 
                      placeholder="Nome completo do cliente" 
                      style={inputStyle} 
                      value={formData.name || ''} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>

                  {/* CPF & Telefone Lado a Lado */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ color: '#0f172a', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        CPF (Apenas números) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input 
                        placeholder="000.000.000-00" 
                        maxLength={14}
                        style={inputStyle} 
                        value={formData.cpf || ''} 
                        onChange={e => setFormData({...formData, cpf: formatCpf(e.target.value)})} 
                      />
                    </div>

                    <div>
                      <label style={{ color: '#0f172a', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Telefone / WhatsApp <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input 
                        placeholder="(00) 00000-0000" 
                        maxLength={15}
                        style={inputStyle} 
                        value={formData.phone || ''} 
                        onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})} 
                      />
                    </div>
                  </div>

                  {/* E-mail */}
                  <div>
                    <label style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                      E-mail (Opcional)
                    </label>
                    <input 
                      placeholder="cliente@email.com" 
                      type="email"
                      style={inputStyle} 
                      value={formData.email || ''} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>

                  {/* CAMPO DE CHAVE PIX OBRIGATÓRIA COM VALIDAÇÃO EM TEMPO REAL */}
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '18px', border: '1.5px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label style={{ color: '#0f172a', fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                        placeholder="Digite a Chave Pix (CPF, Celular, E-mail ou Aleatória)"
                        style={{
                          ...inputStyle,
                          borderColor: pixValidation ? (pixValidation.isValid ? '#10b981' : '#ef4444') : '#cbd5e1',
                          borderWidth: pixValidation ? '2px' : '1.5px',
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
                        <Sparkles size={13} /> Chave reconhecida: <strong>{pixValidation.label}</strong>
                      </p>
                    )}
                  </div>

                  {/* Observações */}
                  <div>
                    <label style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                      Memorial / Observações
                    </label>
                    <textarea 
                      placeholder="Observações complementares sobre este cliente..." 
                      style={{ ...inputStyle, minHeight: '70px', resize: 'none' }} 
                      value={formData.notes || ''} 
                      onChange={e => setFormData({...formData, notes: e.target.value})} 
                    />
                  </div>
                </div>

                {/* ============================================================ */}
                {/* COLUNA DIREITA: ENDEREÇO COMPLETO COM INTEGRAÇÃO DE CEP    */}
                {/* ============================================================ */}
                <div style={{ 
                  background: '#fffdfa', 
                  padding: isMobile ? '1.25rem' : '1.75rem', 
                  borderRadius: '24px', 
                  border: '1.5px solid #fde68a', 
                  boxShadow: '0 4px 20px -4px rgba(217,119,6,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.1rem'
                }}>
                  {/* Cabeçalho da Seção de Endereço */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fef3c7', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontWeight: 900, fontSize: '0.95rem' }}>
                      <MapPin size={20} color="#d97706" /> ENDEREÇO DO CLIENTE
                    </div>
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                      ViaCEP Automático
                    </span>
                  </div>

                  {/* Campo CEP com Botão Buscar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ color: '#78350f', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        CEP (Auto Preenchimento)
                      </label>
                      {cepLoading && (
                        <span style={{ fontSize: '0.75rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                          <Loader2 size={13} className="animate-spin" /> Consultando...
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        placeholder="00000-000"
                        maxLength={9}
                        style={{ ...inputStyle, flex: 1, fontWeight: 700, letterSpacing: '0.5px' }} 
                        value={formData.cep || ''} 
                        onChange={e => {
                          const formatted = formatCep(e.target.value);
                          setFormData({ ...formData, cep: formatted });
                          if (formatted.replace(/\D/g, '').length === 8) {
                            handleCepLookup(formatted);
                          }
                        }}
                        onBlur={() => {
                          if (formData.cep) handleCepLookup(formData.cep);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => formData.cep && handleCepLookup(formData.cep)}
                        disabled={cepLoading || !formData.cep}
                        style={{ 
                          background: '#d97706', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '12px', 
                          padding: '0 1.25rem', 
                          fontWeight: 800, 
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 6px rgba(217,119,6,0.25)'
                        }}
                      >
                        {cepLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Buscar CEP
                      </button>
                    </div>

                    {cepStatus && (
                      <p style={{ 
                        margin: '0.4rem 0 0', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        color: cepStatus.isError ? '#dc2626' : '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        {cepStatus.message}
                      </p>
                    )}
                  </div>

                  {/* Logradouro / Rua */}
                  <div>
                    <label style={{ color: '#78350f', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                      Logradouro / Rua / Avenida
                    </label>
                    <input 
                      placeholder="Ex: Rua das Flores" 
                      style={inputStyle} 
                      value={formData.address || ''} 
                      onChange={e => setFormData({ ...formData, address: e.target.value })} 
                    />
                  </div>

                  {/* Número da Casa & Complemento */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ color: '#78350f', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Número da Casa
                      </label>
                      <input 
                        ref={addressNumberRef}
                        placeholder="Ex: 123 ou S/N" 
                        style={inputStyle} 
                        value={formData.address_number || ''} 
                        onChange={e => setFormData({ ...formData, address_number: e.target.value })} 
                      />
                    </div>

                    <div>
                      <label style={{ color: '#78350f', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Complemento
                      </label>
                      <input 
                        placeholder="Ex: Apto 42, Bloco B" 
                        style={inputStyle} 
                        value={formData.complement || ''} 
                        onChange={e => setFormData({ ...formData, complement: e.target.value })} 
                      />
                    </div>
                  </div>

                  {/* Bairro & Cidade */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.2fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ color: '#78350f', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Bairro
                      </label>
                      <input 
                        placeholder="Ex: Centro" 
                        style={inputStyle} 
                        value={formData.neighborhood || ''} 
                        onChange={e => setFormData({ ...formData, neighborhood: e.target.value })} 
                      />
                    </div>

                    <div>
                      <label style={{ color: '#78350f', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                        Cidade
                      </label>
                      <input 
                        placeholder="Ex: São Paulo" 
                        style={inputStyle} 
                        value={formData.city || ''} 
                        onChange={e => setFormData({ ...formData, city: e.target.value })} 
                      />
                    </div>
                  </div>

                  {/* Estado (UF) */}
                  <div>
                    <label style={{ color: '#78350f', fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                      Estado (UF)
                    </label>
                    <input 
                      placeholder="Ex: SP, RJ, SE..." 
                      maxLength={2}
                      style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }} 
                      value={formData.state || ''} 
                      onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })} 
                    />
                  </div>

                  {/* Resumo Dinâmico da Localização */}
                  {(formData.city || formData.address) && (
                    <div style={{ background: '#fef3c7', padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <CheckCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                      <div style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.3 }}>
                        {formData.address ? `${formData.address}${formData.address_number ? `, nº ${formData.address_number}` : ''}` : ''}
                        {formData.neighborhood ? ` - ${formData.neighborhood}` : ''}
                        {formData.city ? ` (${formData.city} / ${formData.state || 'UF'})` : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Fixo com Botões de Ação */}
            <div style={{ 
              padding: isMobile ? '1rem 1.25rem' : '1.25rem 2.25rem', 
              borderTop: '1px solid #f1f5f9', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center', 
              gap: '1rem',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <button 
                type="button"
                onClick={handleClose} 
                style={{ 
                  background: '#ffffff', 
                  border: '1.5px solid #cbd5e1', 
                  color: '#64748b', 
                  padding: '0.85rem 1.75rem', 
                  borderRadius: '14px', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  flex: isMobile ? 1 : 'none'
                }}
              >
                Descartar
              </button>
              <button 
                type="button"
                onClick={handleSave} 
                style={{ 
                  background: '#d97706', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '0.85rem 2.25rem', 
                  borderRadius: '14px', 
                  fontWeight: 800, 
                  fontSize: '0.95rem',
                  cursor: 'pointer', 
                  boxShadow: '0 4px 14px rgba(217,119,6,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  flex: isMobile ? 1.5 : 'none'
                }}
              >
                <Check size={18} />
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
