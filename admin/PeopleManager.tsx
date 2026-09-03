import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Search, Filter, Edit2, Trash2, Users } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { Customer } from './types';

const PeopleManager: React.FC = () => {
  const { addNotification, logAudit, showConfirm } = useAuth();
  const [people, setPeople] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialPerson: Partial<Customer> = {
    name: '', cpf: '', phone: '', email: '', notes: '', status: 'active', person_type: 'customer'
  };
  
  const [formData, setFormData] = useState<Partial<Customer>>(initialPerson);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setPeople(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleSave = async () => {
    if (editingId) {
      const { error } = await supabase
        .from('customers')
        .update(formData)
        .eq('id', editingId);
        
      if (!error) {
        await logAudit('edição', `Perfil de ${formData.name} atualizado (ID: ${editingId}).`);
        addNotification(`${formData.name} atualizado com sucesso!`, 'sucesso');
        fetchPeople();
        handleClose();
      } else {
        addNotification('Erro ao atualizar: ' + error.message, 'alerta');
      }
    } else {
      const { error } = await supabase.from('customers').insert([formData]);
      if (!error) {
        await logAudit('criação', `Novo cadastro criado: ${formData.name} (Tipo: ${formData.person_type}).`);
        addNotification(`${formData.name} cadastrado com sucesso!`, 'sucesso');
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
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(initialPerson);
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
    const matchSearch = (c.name?.toLowerCase().includes(search.toLowerCase()) || c.cpf?.includes(search));
    const matchType = typeFilter === 'all' || c.person_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={32} color="#d97706" /> Gestão de Pessoas
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Administre o ecossistema de clientes e colaboradores da CM CRED.</p>
        </div>
        <button 
          className="action-button"
          onClick={() => setShowForm(true)}
          style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.85rem 1.75rem', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(217,119,6,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
        >
          <UserPlus size={20} /> Cadastrar Pessoa
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Search size={18} /></span>
          <input 
            placeholder="Buscar por nome completo, e-mail ou CPF..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ ...inputStyle, paddingLeft: '2.75rem' }} 
          />
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Filter size={18} /></span>
          <select 
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.75rem' }}
          >
            <option value="all">Todos os Tipos</option>
            <option value="customer">Clientes</option>
            <option value="employee">Funcionários</option>
            <option value="admin">Administradores</option>
          </select>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '5rem', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>Sincronizando base de dados CM CRED...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['Informações Básicas', 'Perfil', 'Documento', 'Telefone', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '1.25rem 1.5rem', color: '#64748b', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ color: '#0f172a', fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>{p.email}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ background: `${typeColors[p.person_type || 'customer']}10`, color: typeColors[p.person_type || 'customer'], padding: '0.35rem 0.85rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {typeLabels[p.person_type || 'customer'].toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#1e293b', fontWeight: 600 }}>{p.cpf}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontWeight: 500 }}>{p.phone}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: p.status === 'active' ? '#059669' : '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.status === 'active' ? '#059669' : '#ef4444' }}></span>
                      {p.status === 'active' ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleEdit(p)}
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(p.id)}
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

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#ffffff', padding: '3rem', borderRadius: '32px', width: '100%', maxWidth: '540px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
            <h2 style={{ color: '#0f172a', marginTop: 0, marginBottom: '2rem', fontWeight: 800, fontSize: '1.75rem' }}>{editingId ? '📝 Auditoria de Perfil' : '👤 Novo Cadastro'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>TIPO DE PERFIL NO SISTEMA</label>
                <select style={inputStyle} value={formData.person_type} onChange={e => setFormData({...formData, person_type: e.target.value as any})}>
                  <option value="customer">Cliente Final</option>
                  <option value="employee">Funcionário / Agente</option>
                  <option value="admin">Administrador Associado</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <input placeholder="Nome Completo do Portador" style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <input placeholder="CPF (Apenas números)" style={inputStyle} value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              <input placeholder="Telefone / WhatsApp" style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <div style={{ gridColumn: 'span 2' }}>
                <input placeholder="E-mail Institucional" style={inputStyle} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <textarea placeholder="Memorial / Observações sobre este cadastro..." style={{ ...inputStyle, minHeight: '100px', resize: 'none' }} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>STATUS OPERACIONAL</label>
                <select style={inputStyle} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                  <option value="active">Ativo (Permitir Operações)</option>
                  <option value="inactive">Inativo (Bloquear Operações)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <button onClick={handleClose} style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', padding: '0.85rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Descartar</button>
              <button onClick={handleSave} style={{ flex: 1, background: '#d97706', color: '#fff', border: 'none', padding: '0.85rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,168,89,0.2)' }}>
                {editingId ? 'Salvar Auditoria' : 'Confirmar Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleManager;
