import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { useAuth } from './AuthContext';
import type { Customer } from './types';

const CustomersManager: React.FC = () => {
  const { addNotification } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '', cpf: '', phone: '', email: '', notes: '', status: 'active'
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
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
  }, [fetchCustomers]);

  const handleSave = async () => {
    const { error } = await supabase.from('customers').insert([newCustomer]);
    if (!error) {
      fetchCustomers();
      setShowForm(false);
      setNewCustomer({ name: '', cpf: '', phone: '', email: '', notes: '', status: 'active' });
    } else {
      addNotification('Erro ao cadastrar cliente: ' + error.message, 'alerta');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', padding: '0.8rem 1rem',
    color: '#fff', fontSize: '0.9rem', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };

  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.cpf?.includes(search) || 
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.75rem', margin: 0, fontWeight: 700 }}>Clientes & Prospecção</h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Gerencie sua base de clientes para ofertas de crédito.</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,168,89,0.3)' }}
        >
          + Cadastrar Cliente
        </button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#0f0f0f', padding: '2.5rem', borderRadius: '24px', border: '1px solid #222', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👤 Novo Cliente
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <input placeholder="Nome Completo" style={inputStyle} value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
              </div>
              <input placeholder="CPF" style={inputStyle} value={newCustomer.cpf} onChange={e => setNewCustomer({...newCustomer, cpf: e.target.value})} />
              <input placeholder="Telefone" style={inputStyle} value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
              <div style={{ gridColumn: 'span 2' }}>
                <input placeholder="E-mail" style={inputStyle} value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <textarea placeholder="Observações para Prospecção" style={{ ...inputStyle, minHeight: '100px', resize: 'none' }} value={newCustomer.notes} onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #333', color: '#9ca3af', padding: '0.8rem', borderRadius: '12px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSave} style={{ flex: 1, background: '#d97706', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Salvar Cliente</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <input 
          placeholder="🔍 Buscar por nome, CPF ou e-mail..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', fontSize: '1rem' }} 
        />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#d97706' }}>Carregando base de clientes...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Cliente', 'Contato', 'CPF', 'Status', 'Cadastro', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '1.25rem 1.5rem', color: '#6b7280', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#9ca3af' }}>{c.phone}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#9ca3af' }}>{c.cpf}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ background: c.status === 'active' ? 'rgba(0,168,89,0.1)' : 'rgba(239,68,68,0.1)', color: c.status === 'active' ? '#d97706' : '#ef4444', padding: '0.3rem 0.75rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {c.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: '#6b7280', fontSize: '0.85rem' }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <button style={{ background: 'rgba(0,168,89,0.1)', color: '#d97706', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>Simular Empréstimo</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: '#4b5563' }}>Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CustomersManager;
