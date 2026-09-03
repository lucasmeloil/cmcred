import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Shield, Mail, Lock, LogIn, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (lockCountdown && lockCountdown > 0) {
      interval = setInterval(() => {
        setLockCountdown(prev => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockCountdown && lockCountdown > 0) return;
    
    setLoading(true);
    setError('');
    
    const cleanEmail = email.trim().toLowerCase();
    const result = await login(cleanEmail, password);
    
    if (!result.success) {
      if (result.remainingSeconds) {
        setLockCountdown(result.remainingSeconds);
      }
      setError(
        result.error?.includes('Failed to fetch') 
          ? 'Erro de Conexão com o Supabase. Verifique a internet e configurações do projeto.' 
          : `Falha no acesso: ${result.error || 'Credenciais incorretas'}`
      );
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container" style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Inter', sans-serif",
      backgroundColor: '#ffffff'
    }}>
      {/* Left Column: Form */}
      <div className="login-form-column" style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}>
        <div style={{ position: 'relative', zIndex: 1, padding: '0 1rem' }}>
          <div className="mobile-header" style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <img className="mobile-logo" src="/cmcred-logo.png" alt="CMCred" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <h2 className="mobile-title" style={{ color: '#0f172a', fontSize: '2.25rem', fontWeight: 900, margin: '0 0 0.5rem 0', letterSpacing: '-1px' }}>
              Acesso Corporativo
            </h2>
            <p className="mobile-subtitle" style={{ color: '#64748b', fontSize: '1rem', margin: 0, fontWeight: 500 }}>
              Insira suas credenciais para acessar o painel de gestão CM CRED.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', color: '#334155', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>E-MAIL PROFISSIONAL</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Mail size={18} /></span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com.br"
                  required
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.25rem 1.1rem 3.25rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    color: '#0f172a',
                    fontSize: '1rem',
                    fontWeight: 600,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d97706'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#334155', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>SENHA DE ACESSO</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Lock size={18} /></span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '1.1rem 1.25rem 1.1rem 3.25rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    color: '#0f172a',
                    fontSize: '1rem',
                    fontWeight: 600,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d97706'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                color: '#dc2626',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                animation: 'shake 0.5s ease-in-out'
              }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{error}</span>
              </div>
            )}

            {lockCountdown !== null && lockCountdown > 0 && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '14px',
                padding: '0.85rem 1.25rem',
                color: '#b45309',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Shield size={16} color="#d97706" />
                Proteção Ativa: Nova tentativa liberada em {lockCountdown} segundos.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1.25rem',
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #b45309 100%)',
                border: 'none',
                borderRadius: '16px',
                color: '#0a0b0e',
                fontWeight: 900,
                fontSize: '1.1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 10px 25px -5px rgba(217, 119, 6, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginTop: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {loading ? 'Validando Credenciais...' : <><LogIn size={20} /> Acessar Painel CM CRED <ArrowRight size={18} /></>}
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
            <Shield size={16} color="#d97706" /> 
            Conexão Segura e Criptografada — CM CRED Oficial
          </div>
        </div>
      </div>

      {/* Right Column: Visual/Brand */}
      <div className="login-visual-column" style={{
        flex: '1.2',
        background: 'linear-gradient(135deg, #0a0b0e 0%, #161922 100%)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4rem',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 60%)', borderRadius: '50%', filter: 'blur(40px)' }} />
        
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(245,158,11,0.2)', padding: '2.5rem', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '6px 16px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '100px', marginBottom: '1.5rem' }}>
              <CheckCircle size={14} color="#f59e0b" />
              <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Plataforma Unificada CM CRED</span>
            </div>
            <h1 style={{ color: '#ffffff', fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-1px' }}>
              Gestão Financeira & <br/><span style={{ color: '#f59e0b' }}>Simulação de Empréstimos</span>
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Controle de operações no cartão em até 18x, auditoria de comissionamento de consultores, repasses PIX e fluxo financeiro em tempo real.
            </p>
            
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div>
                <div style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 900 }}>1x a 18x</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Parcelamento</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 900 }}>PIX</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Liberação Imediata</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .login-visual-column {
            display: none !important;
          }
          .login-container {
            background: linear-gradient(135deg, #0a0b0e 0%, #161922 100%) !important;
            padding: 1.5rem !important;
            align-items: center !important;
          }
          .login-form-column {
            background: #ffffff !important;
            border-radius: 32px !important;
            padding: 3rem 1.5rem !important;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important;
            max-width: 100% !important;
            margin: auto !important;
          }
          .mobile-header {
            text-align: center !important;
          }
          .mobile-logo {
            margin: 0 auto 1.5rem auto !important;
            height: 48px !important;
            display: block !important;
          }
          .mobile-title {
            font-size: 1.75rem !important;
            text-align: center !important;
          }
          .mobile-subtitle {
            text-align: center !important;
            font-size: 0.95rem !important;
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
      `}</style>
    </div>
  );
};

export default AdminLogin;

