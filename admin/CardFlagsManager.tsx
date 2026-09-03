import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit3, CreditCard } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { CardFlag } from './types';

const CardFlagsManager: React.FC = () => {
  const { addNotification, currentUser, authUserEmail, showConfirm } = useAuth();
  const isSuperAdmin = authUserEmail?.toLowerCase().includes('admin') || 
                       authUserEmail?.toLowerCase().includes('cmcred') || 
                       currentUser?.perfil === 'admin';
  const [flags, setFlags] = useState<CardFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    id: '',
    name: '', 
    color: '#d97706', 
    icon: '💳',
    fee_percentage: '0',
    special: false
  });

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('card_flags').select('*').order('name', { ascending: true });
    if (data) setFlags(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      id: editingId ? editingId : formData.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      name: formData.name,
      color: formData.color,
      icon: formData.icon,
      fee_percentage: parseFloat(formData.fee_percentage) || 0,
      special: formData.special
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('card_flags')
        .update(dataToSave)
        .eq('id', editingId)
        .select();

      if (error) {
        addNotification('Erro ao atualizar bandeira: ' + error.message, 'alerta');
      } else if (!data || data.length === 0) {
        addNotification('Aviso: O banco de dados bloqueou a edição. Execute o script SQL para liberar a permissão.', 'alerta');
      } else {
        addNotification(`Bandeira atualizada com sucesso!`, 'sucesso');
        closeModal();
      }
    } else {
      const { data, error } = await supabase.from('card_flags').insert([dataToSave]).select();
      if (error) {
        addNotification('Erro ao salvar bandeira: ' + error.message, 'alerta');
      } else if (!data || data.length === 0) {
        addNotification('Aviso: O banco de dados bloqueou a criação. Execute o script SQL para liberar a permissão.', 'alerta');
      } else {
        addNotification(`Bandeira cadastrada com sucesso!`, 'sucesso');
        closeModal();
      }
    }
    fetchData();
  };

  const handleEdit = (f: CardFlag) => {
    setEditingId(f.id);
    setFormData({ 
      id: f.id,
      name: f.name, 
      color: f.color, 
      icon: f.icon,
      fee_percentage: f.fee_percentage?.toString() || '0',
      special: f.special || false
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ 
      id: '',
      name: '', 
      color: '#d97706', 
      icon: '💳',
      fee_percentage: '0',
      special: false
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('Excluir esta bandeira?');
    if (!confirmed) return;
    
    const { error } = await supabase.from('card_flags').delete().eq('id', id);
    if (!error) {
      addNotification(`Bandeira excluída permanentemente.`, 'info');
      fetchData();
    } else {
      addNotification('Erro ao excluir: ' + error.message, 'alerta');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px', padding: '0.75rem 1rem',
    color: '#1e293b', width: '100%', marginBottom: '1rem',
    outline: 'none', fontSize: '0.9rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CreditCard size={28} color="#d97706" /> Gestão de Bandeiras
          </h2>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontWeight: 500 }}>Controle as taxas e bandeiras de cartão aceitas</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => setShowModal(true)}
            style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.85rem 1.75rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,168,89,0.2)' }}
          >
            <Plus size={20} /> Nova Bandeira
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <div style={{ color: '#d97706', fontWeight: 600, padding: '2rem' }}>Carregando bandeiras...</div>
        ) : flags.map(f => (
          <div key={f.id} style={{ 
            background: '#ffffff', 
            border: '1px solid #f1f5f9', 
            borderRadius: '24px', 
            padding: '1.5rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.02), 0 8px 10px -6px rgba(0,0,0,0.01)', 
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: f.color }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: 0 }}>
                <div style={{ 
                  fontSize: '1.6rem', 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                  width: '56px', height: '56px', 
                  borderRadius: '18px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  flexShrink: 0,
                  boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.6)'
                }}>
                  {f.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '1.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.name}
                  </div>
                  {f.special && <div style={{ color: '#d97706', fontSize: '0.7rem', fontWeight: 800, background: '#f0fdf4', padding: '2px 8px', borderRadius: '8px', display: 'inline-block', marginTop: '4px' }}>Destaque Especial</div>}
                </div>
              </div>

              {isSuperAdmin && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button 
                    onClick={() => handleEdit(f)}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '12px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Editar Bandeira"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(f.id)}
                    style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '12px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Excluir Bandeira"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: 'auto' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', padding: '0.75rem 1rem', borderRadius: '16px', flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taxa Adicional (%)</div>
                <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '1.25rem' }}>{f.fee_percentage || 0}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)' }}>
          <form onSubmit={handleSave} style={{ background: '#ffffff', padding: '2.5rem', borderRadius: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ color: '#0f172a', marginTop: 0, fontWeight: 800, fontSize: '1.5rem' }}>{editingId ? 'Editar Bandeira' : 'Nova Bandeira'}</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 500 }}>Preencha os dados da bandeira de cartão.</p>
            
            <label style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>NOME DA BANDEIRA</label>
            <input 
              placeholder="Ex: Visa, Mastercard..." 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              style={inputStyle}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>ÍCONE / EMOJI</label>
                <input 
                  placeholder="Ex: 💳, 🏦" 
                  value={formData.icon}
                  onChange={e => setFormData({ ...formData, icon: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>COR IDENTIDADE</label>
                <input 
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  style={{ ...inputStyle, padding: '0.3rem', height: '42px' }}
                  required
                />
              </div>
            </div>

            <label style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>TAXA ADICIONAL DA BANDEIRA (%)</label>
            <input 
              type="text"
              placeholder="0.00" 
              value={formData.fee_percentage.toString().replace('.', ',')}
              onChange={e => setFormData({ ...formData, fee_percentage: e.target.value.replace(',', '.') })}
              style={inputStyle}
              required
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#0f172a', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.5rem' }}>
              <input 
                type="checkbox" 
                checked={formData.special}
                onChange={e => setFormData({ ...formData, special: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#d97706' }}
              />
              Bandeira de Destaque / Especial
            </label>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" onClick={closeModal} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '0.85rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, background: '#d97706', border: 'none', color: '#fff', padding: '0.85rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,168,89,0.2)' }}>
                {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CardFlagsManager;
