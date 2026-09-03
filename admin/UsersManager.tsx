import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { 
  UserPlus, Shield, Users, Lock, Unlock, Search, Mail, UserCheck, 
  Trash2, Edit3, Save, X, Percent, CheckCircle, CheckSquare, Square, 
  Sliders, Key, FileText, DollarSign, CreditCard, Activity, HelpCircle, Calculator
} from 'lucide-react';
import { useAuth } from './AuthContext';
import type { AdminUser, UserRole, UserStatus, UserPermissions } from './types';
import { DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS } from './types';

const roleConfig: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  admin:      { color: '#d97706', bg: '#fffbeb', label: 'Administrador (Super Admin)', icon: <Shield size={14} /> },
  manager:    { color: '#2563eb', bg: '#eff6ff', label: 'Gestor de Equipe',            icon: <UserCheck size={14} /> },
  consultant: { color: '#d97706', bg: '#fffbeb', label: 'Consultor Financeiro',       icon: <Users size={14} /> },
  operator:   { color: '#7c3aed', bg: '#f5f3ff', label: 'Operador de Sistema',         icon: <Users size={14} /> },
};

const PERMISSION_DEFINITIONS: Array<{
  key: keyof UserPermissions;
  altKeys: (keyof UserPermissions)[];
  label: string;
  desc: string;
  icon: React.ReactNode;
  danger?: boolean;
}> = [
  { key: 'dashboard', altKeys: [], label: 'Painel Geral (Dashboard)', desc: 'Visualizar faturamento, gráficos de 12 meses e métricas gerais', icon: <Activity size={16} color="#0ea5e9" /> },
  { key: 'simulador', altKeys: [], label: 'Simulador de Crédito', desc: 'Acessar e realizar simulações de crédito e parcelamento', icon: <Calculator size={16} color="#d97706" /> },
  { key: 'create_loan', altKeys: ['novo_emprestimo'], label: 'Lançar Operação (Novo Empréstimo)', desc: 'Registrar e formalizar novas operações de empréstimo no cartão', icon: <DollarSign size={16} color="#10b981" /> },
  { key: 'customers', altKeys: ['pessoas'], label: 'Gestão de Clientes', desc: 'Cadastrar novos clientes e consultar a base cadastral', icon: <Users size={16} color="#2563eb" /> },
  { key: 'loans', altKeys: ['solicitacoes'], label: 'Contratos & Empréstimos Realizados', desc: 'Consultar histórico de contratos, status e comprovantes', icon: <FileText size={16} color="#3b82f6" /> },
  { key: 'delete_loans', altKeys: [], label: 'Excluir Contratos', desc: 'Permissão especial para exclusão definitiva de operações', icon: <Trash2 size={16} color="#dc2626" />, danger: true },
  { key: 'machines', altKeys: ['maquininhas'], label: 'Gestão de Máquinas POS', desc: 'Visualizar e cadastrar terminais POS e adquirentes', icon: <CreditCard size={16} color="#f59e0b" /> },
  { key: 'taxas_simulador', altKeys: ['card_flags'], label: 'Editor de Taxas do Simulador', desc: 'Alterar taxas de 1x a 18x das tabelas do simulador', icon: <Sliders size={16} color="#d97706" />, danger: true },
  { key: 'finance', altKeys: ['financeiro', 'lucros'], label: 'Módulo Financeiro & Lucros', desc: 'Acessar contas a pagar/receber, conciliação e repasses PIX', icon: <DollarSign size={16} color="#dc2626" />, danger: true },
  { key: 'reports', altKeys: ['relatorios'], label: 'Relatórios Gerais & Exportação', desc: 'Exportar relatórios contábeis e analíticos em PDF e planilhas', icon: <FileText size={16} color="#6366f1" /> },
  { key: 'users', altKeys: ['usuarios'], label: 'Gestão de Acessos', desc: 'Criar outros usuários e modificar privilégios de acesso', icon: <Key size={16} color="#dc2626" />, danger: true },
  { key: 'audit', altKeys: ['logs'], label: 'Auditoria do Sistema', desc: 'Visualizar logs de segurança e rastreamento forense', icon: <Shield size={16} color="#475569" /> },
];

const TABS = [
  { id: 'all',        label: 'Todos'         },
  { id: 'consultant', label: 'Consultores'   },
  { id: 'manager',    label: 'Gestores'      },
  { id: 'admin',      label: 'Admins'        },
];

const UsersManager: React.FC = () => {
  const { addNotification, logAudit, authUserEmail, showConfirm, currentUser } = useAuth();
  
  const isSuperAdmin = authUserEmail?.toLowerCase().includes('admin') ||
                       authUserEmail?.toLowerCase().includes('cmcred') ||
                       authUserEmail?.toLowerCase() === 'caique@cmcred.com.br' ||
                       authUserEmail?.toLowerCase().includes('caique') ||
                       currentUser?.perfil === 'admin';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'consultant' as UserRole,
    permissions: { ...DEFAULT_PERMISSIONS }
  });

  const handleRoleChangeNew = (role: UserRole) => {
    if (role === 'admin') {
      setNewUser(prev => ({ ...prev, role, permissions: { ...ADMIN_PERMISSIONS } }));
    } else {
      setNewUser(prev => ({ ...prev, role, permissions: { ...DEFAULT_PERMISSIONS } }));
    }
  };

  const toggleNewPermission = (p: typeof PERMISSION_DEFINITIONS[0]) => {
    const nextVal = !newUser.permissions[p.key];
    const updated = { ...newUser.permissions, [p.key]: nextVal };
    if (p.altKeys) {
      p.altKeys.forEach(k => {
        (updated as any)[k] = nextVal;
      });
    }
    setNewUser(prev => ({ ...prev, permissions: updated }));
  };

  const toggleEditPermission = (p: typeof PERMISSION_DEFINITIONS[0]) => {
    if (!editingUser) return;
    const currentPerms = editingUser.permissions || { ...DEFAULT_PERMISSIONS };
    const nextVal = !currentPerms[p.key];
    const updated = { ...currentPerms, [p.key]: nextVal };
    if (p.altKeys) {
      p.altKeys.forEach(k => {
        (updated as any)[k] = nextVal;
      });
    }
    setEditingUser({
      ...editingUser,
      permissions: updated
    });
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      
      let mappedUsers: AdminUser[] = [];
      if (data && data.length > 0) {
        mappedUsers = data.map(d => {
          const isSuperAdminAccount = d.email?.toLowerCase() === 'caique@cmcred.com.br' || d.email?.toLowerCase().includes('caique');
          const isAdminUser = isSuperAdminAccount || d.email?.toLowerCase().includes('admin') || d.role === 'admin';
          const role = isAdminUser ? 'admin' : (d.role as UserRole);
          const perms = isAdminUser || role === 'admin' ? ADMIN_PERMISSIONS : (d.permissions || DEFAULT_PERMISSIONS);

          return {
            id: d.id,
            nome: d.full_name || (isSuperAdminAccount ? 'Caique (Super Admin)' : (isAdminUser ? 'Administrador CM CRED' : 'Consultor')),
            email: d.email || '',
            perfil: role,
            status: d.status as UserStatus,
            dataCriacao: d.created_at,
            commission_percentage: d.commission_percentage ? Number(d.commission_percentage) : 0,
            permissions: perms,
          };
        });
      }

      // Garante que o Super Admin Caique sempre apareça na lista de acessos
      if (!mappedUsers.some(u => u.email.toLowerCase() === 'caique@cmcred.com.br')) {
        mappedUsers.unshift({
          id: 'a0e73455-9526-4cdf-a0f5-7bf47e2e3ce8',
          nome: 'Caique (Super Admin)',
          email: 'caique@cmcred.com.br',
          perfil: 'admin',
          status: 'active',
          dataCriacao: new Date().toISOString(),
          commission_percentage: 0,
          permissions: ADMIN_PERMISSIONS
        });
      }

      setUsers(mappedUsers);
    } catch (err: any) {
      console.error('Erro ao buscar usuários:', err);
      // Fallback para exibir o Super Admin
      setUsers([{
        id: 'a0e73455-9526-4cdf-a0f5-7bf47e2e3ce8',
        nome: 'Caique (Super Admin)',
        email: 'caique@cmcred.com.br',
        perfil: 'admin',
        status: 'active',
        dataCriacao: new Date().toISOString(),
        commission_percentage: 0,
        permissions: ADMIN_PERMISSIONS
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchUsers(); 

    // Sincronização em tempo real de usuários e permissões
    const channel = supabase
      .channel('realtime-profiles-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = newUser.email.trim().toLowerCase();
      const password = newUser.password.trim();
      const fullName = newUser.full_name.trim();

      // 1. Criação no Supabase Auth via Admin API ou SignUp
      let createdUserId = '';
      const { data: adminAuthData, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: newUser.role
        }
      });

      if (adminAuthData?.user?.id) {
        createdUserId = adminAuthData.user.id;
      } else if (adminAuthError) {
        console.warn('Admin API createUser falhou, tentando fallback via SignUp:', adminAuthError.message);
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: newUser.role
            }
          }
        });
        if (signUpError) throw signUpError;
        if (signUpData.user?.id) {
          createdUserId = signUpData.user.id;
        } else {
          throw new Error('Não foi possível registrar o usuário no sistema de autenticação.');
        }
      }

      if (createdUserId) {
        // 2. Salva o perfil com salário fixo e permissões exatas
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: createdUserId,
          email,
          full_name: fullName,
          role: newUser.role,
          commission_percentage: 0,
          permissions: newUser.permissions,
          status: 'active'
        });

        if (profileError) throw profileError;

        await logAudit('criação', `Novo acesso criado: ${fullName} (${newUser.role}) com modelo de salário fixo.`);
        addNotification(`Usuário ${fullName} criado com sucesso! O login com as credenciais já está liberado.`, 'sucesso');
        setShowNew(false);
        setNewUser({ full_name: '', email: '', password: '', role: 'consultant', permissions: { ...DEFAULT_PERMISSIONS } });
        await fetchUsers();
      }
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      addNotification('Erro ao criar usuário: ' + (err.message || 'Erro desconhecido'), 'alerta');
    } finally { 
      setLoading(false); 
    }
  };

  const toggleStatus = async (id: string, current: UserStatus) => {
    const target = users.find(u => u.id === id);
    if (target?.email?.toLowerCase() === 'caique@cmcred.com.br') {
      addNotification('O Super Administrador Principal (Caique) não pode ser bloqueado por segurança.', 'alerta');
      return;
    }

    const ns: UserStatus = current === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: ns }).eq('id', id);
    if (error) addNotification('Erro: ' + error.message, 'alerta');
    else { addNotification(`Acesso ${ns === 'active' ? 'liberado' : 'bloqueado'}!`, 'sucesso'); fetchUsers(); }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const isSuperAdminUser = editingUser.email.toLowerCase() === 'caique@cmcred.com.br';
      const finalRole = isSuperAdminUser ? 'admin' : editingUser.perfil;
      const finalPerms = isSuperAdminUser ? ADMIN_PERMISSIONS : (editingUser.permissions || DEFAULT_PERMISSIONS);

      const { error } = await supabase.from('profiles').update({
        full_name: editingUser.nome,
        role: finalRole,
        commission_percentage: editingUser.commission_percentage,
        permissions: finalPerms
      }).eq('id', editingUser.id);

      if (error) throw error;

      // Atualiza senha se foi preenchida
      if (editPassword.trim()) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(editingUser.id, {
          password: editPassword.trim()
        });
        if (pwError) {
          addNotification('Perfil atualizado, mas houve erro ao trocar senha: ' + pwError.message, 'alerta');
        } else {
          addNotification('Perfil e nova senha atualizados com sucesso!', 'sucesso');
        }
        setEditPassword('');
      } else {
        addNotification('Perfil e permissões atualizados com sucesso!', 'sucesso');
      }

      await logAudit('edição', `Permissões/Taxas de ${editingUser.nome} atualizadas.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      addNotification('Erro ao atualizar: ' + err.message, 'alerta');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.email?.toLowerCase() === 'caique@cmcred.com.br') {
      addNotification('Ação Bloqueada: O Super Administrador Principal (Caique) possui imunidade contra exclusão.', 'alerta');
      return;
    }

    const confirmed = await showConfirm('Excluir este perfil permanentemente? Todos os empréstimos vinculados passarão a ser órfãos (do Admin).');
    if (!confirmed) return;
    
    // Unlink loans to prevent foreign key violation
    await supabase.from('loans').update({ consultant_id: null }).eq('consultant_id', id);

    // Remove from auth.users and profiles
    await supabaseAdmin.auth.admin.deleteUser(id).catch(err => console.warn('Erro ao deletar do auth:', err));
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) addNotification('Erro: ' + error.message, 'alerta');
    else { addNotification('Perfil e login removidos com sucesso.', 'sucesso'); fetchUsers(); }
  };

  const inputStyle: React.CSSProperties = {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '0.85rem 1rem', color: '#1e293b', fontSize: '0.9rem',
    outline: 'none', width: '100%', boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)', marginBottom: '1rem'
  };

  const tabFiltered = users
    .filter(u => activeTab === 'all' || u.perfil === activeTab)
    .filter(u => u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '2.5rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', fontSize: '2.2rem', margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.5px' }}>
            <Shield size={34} color="#d97706" /> Gestão de Acessos & Permissões
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontWeight: 600 }}>
            Controle detalhado de taxas de comissão e privilégios de consultores, gestores e operadores
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setShowNew(true)} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '0.9rem 1.75rem', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 20px -3px rgba(217,119,6,0.3)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem' }}>
            <UserPlus size={20} /> Novo Consultor / Acesso
          </button>
        )}
      </header>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total Usuários', value: users.length,                                      color: '#2563eb' },
          { label: 'Acessos Ativos', value: users.filter(u => u.status === 'active').length,   color: '#059669' },
          { label: 'Bloqueados',     value: users.filter(u => u.status === 'inactive').length, color: '#dc2626' },
          { label: 'Consultores',    value: users.filter(u => u.perfil === 'consultant').length, color: '#d97706' },
          { label: 'Gestores',       value: users.filter(u => u.perfil === 'manager').length,  color: '#2563eb' },
          { label: 'Super Admins',   value: users.filter(u => u.perfil === 'admin').length,    color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '1.25rem', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            <div style={{ color: s.color, fontSize: '2.2rem', fontWeight: 900 }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '2rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '14px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s',
              background: activeTab === t.id ? '#fff' : 'transparent',
              color: activeTab === t.id ? '#0f172a' : '#64748b',
              boxShadow: activeTab === t.id ? '0 4px 6px -1px rgba(0,0,0,0.07)' : 'none'
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.75rem', marginBottom: 0 }} />
        </div>
      </div>

      {/* Users Grid */}
      {loading && users.length === 0 ? (
        <div style={{ color: '#d97706', textAlign: 'center', padding: '5rem', fontWeight: 700 }}>Sincronizando acessos do banco...</div>
      ) : tabFiltered.length === 0 ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '4rem', fontWeight: 600 }}>Nenhum usuário encontrado nesta categoria.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.75rem' }}>
          {tabFiltered.map(user => {
            const isSuperAdminUser = user.email.toLowerCase() === 'caique@cmcred.com.br';
            const isAdminUser = isSuperAdminUser || user.email.toLowerCase().includes('admin') || user.perfil === 'admin';
            const rc = isAdminUser ? roleConfig.admin : (roleConfig[user.perfil] || roleConfig.operator);
            const isActive = user.status === 'active';
            const perms = user.permissions || DEFAULT_PERMISSIONS;

            return (
              <div key={user.id} style={{ 
                background: '#fff', 
                border: isSuperAdminUser ? '2.5px solid #d97706' : (isAdminUser ? '2px solid #f59e0b' : '1px solid #f1f5f9'), 
                borderRadius: '24px', 
                padding: '1.75rem', 
                boxShadow: isSuperAdminUser ? '0 8px 25px -4px rgba(217,119,6,0.2)' : '0 4px 10px -2px rgba(0,0,0,0.05)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem',
                position: 'relative'
              }}>
                {isAdminUser && (
                  <div style={{ 
                    position: 'absolute', top: '-12px', right: '20px', 
                    background: isSuperAdminUser ? 'linear-gradient(135deg, #b45309 0%, #d97706 100%)' : '#d97706', 
                    color: '#fff', fontSize: '0.7rem', 
                    fontWeight: 900, padding: '4px 14px', borderRadius: '100px', 
                    boxShadow: '0 2px 10px rgba(217,119,6,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' 
                  }}>
                    {isSuperAdminUser ? '👑 Super Administrador Geral' : '👑 Administrador CM CRED'}
                  </div>
                )}

                {/* User Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', background: `linear-gradient(135deg, ${rc.color}, ${rc.color}cc)`, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: `0 4px 10px ${rc.color}33` }}>
                    {(user.nome || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.nome || 'Usuário'}
                      </div>
                      {isSuperAdmin && (
                        <button onClick={() => setEditingUser(user)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', cursor: 'pointer', padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800 }} title="Editar Perfil e Permissões">
                          <Sliders size={14} color="#d97706" /> Configurar
                        </button>
                      )}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', fontWeight: 600 }}>
                      <Mail size={13} /> {user.email}
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ background: rc.bg, color: rc.color, borderRadius: '10px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem', border: `1px solid ${rc.color}25` }}>
                    {rc.icon} {rc.label.toUpperCase()}
                  </span>
                  <span style={{ background: isActive ? '#f0fdf4' : '#fef2f2', color: isActive ? '#059669' : '#dc2626', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, padding: '0.4rem 0.8rem', border: `1px solid ${isActive ? '#dcfce7' : '#fecaca'}` }}>
                    {isActive ? '● ATIVO' : '○ BLOQUEADO'}
                  </span>
                </div>

                {/* Remuneração: Salário Fixo */}
                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '0.85rem 1.25rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.8rem', fontWeight: 800 }}>
                    <DollarSign size={16} color="#10b981" /> MODELO DE REMUNERAÇÃO
                  </div>
                  <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: 800, padding: '0.35rem 0.85rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    SALÁRIO FIXO
                  </span>
                </div>

                {/* Permissions Preview Pills */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Key size={13} /> Privilégios & Acessos Ativos
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {PERMISSION_DEFINITIONS.map(p => {
                      const hasPerm = isSuperAdminUser || user.perfil === 'admin' || !!perms[p.key];
                      return (
                        <span key={p.key} style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: hasPerm ? '#f0fdf4' : '#f8fafc',
                          color: hasPerm ? '#059669' : '#94a3b8',
                          border: `1px solid ${hasPerm ? '#bbf7d0' : '#e2e8f0'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          {hasPerm ? '✓' : '✗'} {p.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                {isSuperAdmin && !isSuperAdminUser && (
                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <button onClick={() => toggleStatus(user.id, user.status)} style={{ flex: 1, padding: '0.75rem', background: isActive ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isActive ? '#fecaca' : '#dcfce7'}`, borderRadius: '12px', color: isActive ? '#dc2626' : '#059669', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}>
                      {isActive ? <><Lock size={15} /> Bloquear Acesso</> : <><Unlock size={15} /> Liberar Acesso</>}
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} style={{ padding: '0.75rem 1rem', background: '#fff', border: '1px solid #fee2e2', borderRadius: '12px', color: '#ef4444', cursor: 'pointer' }} title="Excluir Usuário">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Usuário / Consultor com Permissões */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <form onSubmit={handleCreateUser} style={{ background: '#fff', borderRadius: '32px', padding: '2.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ color: '#0f172a', margin: 0, fontWeight: 900, fontSize: '1.5rem' }}>Cadastrar Novo Acesso</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Configure as credenciais e defina com precisão o que o consultor pode ver ou alterar</p>
              </div>
              <button type="button" onClick={() => setShowNew(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', color: '#64748b', cursor: 'pointer', padding: '0.6rem' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Nome Completo</label>
                <input required style={inputStyle} placeholder="Ex: Lucas Melo" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>E-mail de Login</label>
                <input required type="email" style={inputStyle} placeholder="consultor@cmcred.com.br" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Senha de Acesso</label>
                <input required type="password" style={inputStyle} placeholder="••••••••" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Função / Cargo</label>
                <select style={inputStyle} value={newUser.role} onChange={e => handleRoleChangeNew(e.target.value as UserRole)}>
                  <option value="consultant">Consultor (Salário Fixo)</option>
                  <option value="manager">Gestor</option>
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Key size={16} color="#d97706" /> Marcar / Desmarcar Permissões do Sistema
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>O que este usuário pode acessar</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {PERMISSION_DEFINITIONS.map(p => {
                  const isChecked = newUser.permissions[p.key];
                  return (
                    <label key={p.key} onClick={() => toggleNewPermission(p)} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      background: isChecked ? '#ffffff' : '#f1f5f9',
                      border: `1px solid ${isChecked ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: '12px', padding: '0.75rem 1rem', cursor: 'pointer',
                      transition: 'all 0.2s', boxShadow: isChecked ? '0 2px 4px rgba(217,119,6,0.08)' : 'none'
                    }}>
                      <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ marginTop: '3px', accentColor: '#d97706', width: '16px', height: '16px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isChecked ? '#0f172a' : '#64748b', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {p.icon} {p.label}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px', lineHeight: 1.3 }}>
                          {p.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '1.1rem', borderRadius: '16px', cursor: 'pointer', fontWeight: 900, fontSize: '1.05rem', boxShadow: '0 10px 20px -3px rgba(217,119,6,0.35)' }}>
              {loading ? 'Salvando no Banco...' : 'Confirmar e Criar Acesso'}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Editar Perfil e Permissões */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <form onSubmit={handleUpdateUser} style={{ background: '#fff', borderRadius: '32px', padding: '2.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ color: '#0f172a', margin: 0, fontWeight: 900, fontSize: '1.5rem' }}>Configurar Acesso & Permissões</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Editando privilégios e permissões de {editingUser.nome}</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', color: '#64748b', cursor: 'pointer', padding: '0.6rem' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Nome Completo</label>
                <input required style={inputStyle} value={editingUser.nome} onChange={e => setEditingUser({ ...editingUser, nome: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Nível de Acesso</label>
                <select style={inputStyle} value={editingUser.perfil} onChange={e => {
                  const newRole = e.target.value as UserRole;
                  const perms = newRole === 'admin' ? ADMIN_PERMISSIONS : (editingUser.permissions || DEFAULT_PERMISSIONS);
                  setEditingUser({ ...editingUser, perfil: newRole, permissions: perms });
                }}>
                  <option value="consultant">Consultor (Salário Fixo)</option>
                  <option value="manager">Gestor</option>
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador (Super Admin)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Redefinir Senha (Opcional - preencha apenas se desejar trocar a senha)
              </label>
              <input type="password" style={{ ...inputStyle, marginBottom: 0 }} placeholder="Digite nova senha para o usuário..." value={editPassword} onChange={e => setEditPassword(e.target.value)} />
            </div>

            {/* Permissions Matrix */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '1.25rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Key size={16} color="#d97706" /> Marcar / Desmarcar Permissões do Usuário
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Altere o que pode ser visto ou modificado</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {PERMISSION_DEFINITIONS.map(p => {
                  const currentPerms = editingUser.permissions || DEFAULT_PERMISSIONS;
                  const isChecked = !!currentPerms[p.key];
                  return (
                    <label key={p.key} onClick={() => toggleEditPermission(p)} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      background: isChecked ? '#ffffff' : '#f1f5f9',
                      border: `1px solid ${isChecked ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: '12px', padding: '0.75rem 1rem', cursor: 'pointer',
                      transition: 'all 0.2s', boxShadow: isChecked ? '0 2px 4px rgba(217,119,6,0.08)' : 'none'
                    }}>
                      <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ marginTop: '3px', accentColor: '#d97706', width: '16px', height: '16px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isChecked ? '#0f172a' : '#64748b', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {p.icon} {p.label}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px', lineHeight: 1.3 }}>
                          {p.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '1.1rem', borderRadius: '16px', cursor: 'pointer', fontWeight: 900, fontSize: '1.05rem', boxShadow: '0 10px 20px -3px rgba(217,119,6,0.35)' }}>
              {loading ? 'Salvando Alterações...' : 'Salvar Alterações no Banco'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default UsersManager;
