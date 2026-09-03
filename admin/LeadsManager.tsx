import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Lead } from './types';

const originColors: Record<string, string> = {
  'LP': '#d97706',
  'campanha': '#f59e0b',
  'indicação': '#8b5cf6',
  'site': '#3b82f6',
  'whatsapp': '#25d366',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: '#3b82f6' },
  contacted: { label: 'Contatado', color: '#f59e0b' },
  qualified: { label: 'Qualificado', color: '#d97706' },
  lost: { label: 'Perdido', color: '#ef4444' },
};

const LeadsManager: React.FC = () => {
  const { addNotification } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [newLead, setNewLead] = useState<Partial<Lead>>({
    name: '', cpf: '', phone: '', email: '', source: 'LP', status: 'new'
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setLeads(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSave = async () => {
    const { error } = await supabase.from('leads').insert([newLead]);
    if (!error) {
      fetchLeads();
      setShowForm(false);
      setNewLead({ name: '', cpf: '', phone: '', email: '', source: 'LP', status: 'new' });
    } else {
      addNotification('Erro ao salvar: ' + error.message, 'alerta');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '0.6rem 0.875rem',
    color: '#e5e7eb', fontSize: '0.85rem', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  const filtered = leads.filter(l => 
    l.name?.toLowerCase().includes(search.toLowerCase()) || 
    l.cpf?.includes(search) || 
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '1.5rem' }}>
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#111', padding: '2rem', borderRadius: '20px', border: '1px solid #333', width: '400px' }}>
            <h2 style={{ color: '#fff', marginTop: 0 }}>➕ Novo Lead</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input placeholder="Nome" style={inputStyle} value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} />
              <input placeholder="CPF" style={inputStyle} value={newLead.cpf} onChange={e => setNewLead({...newLead, cpf: e.target.value})} />
              <input placeholder="Telefone" style={inputStyle} value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} />
              <input placeholder="E-mail" style={inputStyle} value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
              <select style={inputStyle} value={newLead.source} onChange={e => setNewLead({...newLead, source: e.target.value})}>
                <option value="LP">LP</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="site">Site</option>
              </select>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: 'none', border: '1px solid #333', color: '#6b7280', padding: '0.6rem', borderRadius: '8px' }}>Cancelar</button>
                <button onClick={handleSave} style={{ flex: 1, background: '#d97706', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', fontWeight: 600 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <input placeholder="🔍 Buscar leads reais..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => setShowForm(true)} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>+ Novo Lead</button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#d97706' }}>Sincronizando com o servidor seguro...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                {['Nome', 'CPF', 'Telefone', 'Origem', 'Status', 'Data'].map(h => (
                  <th key={h} style={{ padding: '1rem', color: '#6b7280', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '1rem', color: '#fff' }}>{l.name}</td>
                  <td style={{ padding: '1rem', color: '#9ca3af' }}>{l.cpf}</td>
                  <td style={{ padding: '1rem', color: '#9ca3af' }}>{l.phone}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ background: `${originColors[l.source || 'LP']}20`, color: originColors[l.source || 'LP'], padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{l.source}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ background: `${statusLabels[l.status]?.color}20`, color: statusLabels[l.status]?.color, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{statusLabels[l.status]?.label}</span>
                  </td>
                  <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LeadsManager;
