import React, { useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { 
  BookOpen, 
  Search, 
  Calculator, 
  PlusCircle, 
  Users, 
  ClipboardList, 
  Wallet, 
  Cpu, 
  ShieldCheck, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Printer, 
  Smartphone, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Sparkles,
  Info,
  Clock
} from 'lucide-react';

interface TutorialItem {
  id: string;
  title: string;
  category: 'consultor' | 'admin' | 'simulador' | 'clientes' | 'operacao' | 'financeiro' | 'faq';
  targetRole: 'todos' | 'consultor' | 'admin';
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  shortDesc: string;
  steps: Array<{
    title: string;
    description: string;
    tip?: string;
    warning?: string;
  }>;
  quickAction?: {
    label: string;
    sectionId: string;
  };
  tags: string[];
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface TutorialsProps {
  onNavigate?: (sectionId: string) => void;
}

export const Tutorials: React.FC<TutorialsProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [expandedTutorials, setExpandedTutorials] = useState<Record<string, boolean>>({
    'simulador-vendas': true,
    'cadastro-pix': true
  });
  const [expandedFAQ, setExpandedFAQ] = useState<Record<number, boolean>>({ 0: true });

  const isAdmin = currentUser?.perfil === 'admin' || 
                  currentUser?.email?.toLowerCase() === 'caique@cmcred.com.br' ||
                  currentUser?.email?.toLowerCase().startsWith('admin@');

  const toggleTutorial = (id: string) => {
    setExpandedTutorials(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const tutorials: TutorialItem[] = [
    {
      id: 'simulador-vendas',
      title: 'Como Usar o Simulador Oficial de Troca de Limite',
      category: 'simulador',
      targetRole: 'todos',
      icon: <Calculator size={22} />,
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      shortDesc: 'Apresente opções claras e rápidas de parcelamento de 1x a 18x durante o atendimento ao cliente.',
      quickAction: { label: 'Abrir Simulador', sectionId: 'simulador' },
      tags: ['simulador', 'cálculo', 'parcelas', 'flex', 'tabela', 'proposta', 'whatsapp', 'juros'],
      steps: [
        {
          title: '1. Escolha a Matriz de Cálculo',
          description: 'Selecione entre a "Tabela Padrão Oficial" (matriz padrão da empresa) ou a "Tabela Flex Reduzida" (taxas promocionais para clientes indecisos).'
        },
        {
          title: '2. Defina o Modo de Entrada do Valor',
          description: 'Você pode calcular a partir do "Valor Liberado no PIX" (quanto o cliente precisa na mão) OU a partir do "Total a Passar no Cartão" (limite total disponível).'
        },
        {
          title: '3. Análise da Tabela de 1x a 18x',
          description: 'O sistema calcula automaticamente o valor exato de cada parcela e o total cobrado na maquininha para todas as opções de parcelamento.',
          tip: 'Para consultores, o percentual de taxa de juros e o lucro da empresa são omitidos para focar na proposta comercial e no valor da parcela.'
        },
        {
          title: '4. Envio Direto ao WhatsApp do Cliente',
          description: 'Clique em "Copiar Proposta Comercial" para enviar um texto formatado e profissional diretamente para a conversa do cliente no WhatsApp.'
        }
      ]
    },
    {
      id: 'cadastro-pix',
      title: 'Cadastro Obrigatório de Clientes com Validação PIX',
      category: 'clientes',
      targetRole: 'todos',
      icon: <Users size={22} />,
      iconBg: '#f0fdf4',
      iconColor: '#059669',
      shortDesc: 'Cadastre o cliente com validação imediata da chave Pix para evitar erros na hora do repasse.',
      quickAction: { label: 'Gestão de Clientes', sectionId: 'pessoas' },
      tags: ['clientes', 'pix', 'chave pix', 'cpf', 'cnpj', 'celular', 'email', 'aleatoria', 'cadastro'],
      steps: [
        {
          title: '1. Acesse o Módulo de Clientes',
          description: 'No menu lateral, clique em "Gestão de Clientes" e depois no botão "+ Novo Cliente".'
        },
        {
          title: '2. Preencha os Dados Obrigatórios',
          description: 'Informe o Nome Completo, CPF/CNPJ e Telefone com DDD do cliente titular do cartão.'
        },
        {
          title: '3. Validação Automática da Chave PIX',
          description: 'Ao digitar a chave no campo obrigatório, o validador reconhece o formato em tempo real (CPF, CNPJ, Celular, E-mail ou Chave Aleatória EVP/UUID). O indicador ficará verde assim que o formato estiver correto.',
          tip: 'Use os botões de atalho "Copiar CPF" ou "Copiar Telefone" para preencher instantaneamente caso a chave seja o mesmo documento ou número.',
          warning: 'O sistema bloqueia o salvamento caso a chave Pix esteja em formato inválido ou com dígitos a menos.'
        },
        {
          title: '4. Norma de Segurança na Titularidade',
          description: 'Por política antifraude da CM CRED, a chave Pix informada deve pertencer obrigatoriamente ao mesmo CPF/CNPJ do titular do cartão de crédito utilizado.'
        }
      ]
    },
    {
      id: 'lancar-operacao',
      title: 'Lançamento de Operações e Auto-Preenchimento',
      category: 'operacao',
      targetRole: 'todos',
      icon: <PlusCircle size={22} />,
      iconBg: '#fff7ed',
      iconColor: '#ea580c',
      shortDesc: 'Concretize o empréstimo vinculando o cliente e a maquininha sem digitar dados repetidos.',
      quickAction: { label: 'Lançar Operação', sectionId: 'novo_emprestimo' },
      tags: ['lançar operação', 'empréstimo', 'cartão', 'maquininha', 'auto-preenchimento', 'repasse pix'],
      steps: [
        {
          title: '1. Seleção do Cliente Cadastrado',
          description: 'No campo de busca de clientes, comece a digitar o nome ou CPF. Ao clicar no cliente, todos os dados (inclusive a Chave Pix validada) são preenchidos automaticamente.'
        },
        {
          title: '2. Selecione a Maquininha Utilizada',
          description: 'Escolha a adquirente e maquininha física onde a cobrança no cartão foi ou será realizada (ex: Stone Smart POS, PagSeguro, Ton, etc.).'
        },
        {
          title: '3. Informe o Valor Líquido e Prazo',
          description: 'Digite o valor que será repassado via PIX ao cliente e selecione a quantidade de parcelas (1x até 18x).'
        },
        {
          title: '4. Conferência do Valor a Passar no Cartão',
          description: 'O sistema calcula na hora o valor bruto exato que deve ser passado na maquininha. Confira na tela da máquina antes de solicitar a senha do cliente.'
        },
        {
          title: '5. Conclusão e Registro com Auditoria',
          description: 'Clique em "Confirmar e Registrar Operação". O contrato é gerado imediatamente e seu nome fica registrado como Operador Responsável.'
        }
      ]
    },
    {
      id: 'acompanhamento-contratos',
      title: 'Acompanhamento de Contratos e Comprovantes',
      category: 'operacao',
      targetRole: 'todos',
      icon: <ClipboardList size={22} />,
      iconBg: '#f5f3ff',
      iconColor: '#7c3aed',
      shortDesc: 'Acompanhe todos os contratos realizados na rede e envie comprovantes ao cliente com 1 clique.',
      quickAction: { label: 'Ver Empréstimos', sectionId: 'solicitacoes' },
      tags: ['contratos', 'empréstimos', 'comprovante', 'status', 'whatsapp', 'operador', 'consulta'],
      steps: [
        {
          title: '1. Visão Geral dos Contratos',
          description: 'Na página de Empréstimos, você visualiza todos os contratos emitidos pela empresa. A coluna "Operador / Responsável" identifica claramente quem realizou cada um.'
        },
        {
          title: '2. Sigilo das Margens Financeiras',
          description: 'Para consultores, colunas confidenciais (Retenção da Maquininha MDR, Lucro da CM CRED e Taxas de Juros) são ocultadas automaticamente pelo perfil de segurança.'
        },
        {
          title: '3. Status Operacional',
          description: 'Acompanhe se a operação está "Concluída" (valor pago e compensado), "Aguardando Liberação" ou "Em Análise".'
        },
        {
          title: '4. Disparo de Comprovante no WhatsApp',
          description: 'Clique no ícone do WhatsApp na linha do contrato para enviar a confirmação completa da operação formatada direto para o celular do cliente.'
        }
      ]
    },
    {
      id: 'financeiro-baixas',
      title: 'Módulo Financeiro: Lançamentos e Ação de Dar Baixa',
      category: 'financeiro',
      targetRole: 'todos',
      icon: <Wallet size={22} />,
      iconBg: '#fefce8',
      iconColor: '#ca8a04',
      shortDesc: 'Gerencie entradas, despesas operacionais e liquide contas pendentes no caixa.',
      quickAction: { label: 'Abrir Financeiro', sectionId: 'financeiro' },
      tags: ['financeiro', 'baixa', 'dar baixa', 'despesas', 'receitas', 'contas a pagar', 'contas a receber', 'caixa'],
      steps: [
        {
          title: '1. Lançamento de Despesas e Receitas',
          description: 'Use os botões "+ Nova Despesa" ou "+ Nova Receita" para registrar despesas operacionais (ex: aluguel, bobinas, lanche) ou receitas manuais.'
        },
        {
          title: '2. Como Dar Baixa em Contas',
          description: 'Na lista de contas a pagar ou a receber com status "Pendente", clique no botão verde "Dar Baixa". O status mudará imediatamente para "Pago / Liquidado".'
        },
        {
          title: '3. Registro de Auditoria',
          description: 'Toda baixa efetuada grava o nome do colaborador responsável e a data/hora exata da liquidação para histórico seguro.'
        },
        {
          title: '4. Restrições de Integridade para Consultores',
          description: 'Para garantir fechamento de caixa auditável, consultores não possuem permissão de excluir contas nem estornar contas já baixadas (ações exclusivas do Administrador).'
        }
      ]
    },
    {
      id: 'admin-maquininhas',
      title: 'Configuração de Maquininhas POS e Retenção MDR',
      category: 'admin',
      targetRole: 'admin',
      icon: <Cpu size={22} />,
      iconBg: '#eff6ff',
      iconColor: '#1d4ed8',
      shortDesc: 'Controle taxas de adquirentes e retenções dinâmicas para apuração centavo por centavo do lucro líquido.',
      quickAction: { label: 'Gerenciar Máquinas', sectionId: 'maquininhas' },
      tags: ['maquininhas', 'adquirentes', 'mdr', 'retenção', 'pos', 'stone', 'taxas', 'lucro real'],
      steps: [
        {
          title: '1. Cadastro de Novas Adquirentes',
          description: 'Adicione as maquininhas utilizadas pela equipe (Stone, PagBank, Ton, Cielo) definindo o nome e a taxa média padrão.'
        },
        {
          title: '2. Configuração de Retenção Dinâmica por Faixa',
          description: 'Defina a retenção MDR por faixas de parcelamento (1x à vista, 2x a 6x, 7x a 12x, 13x a 18x) ou custo fixo de transação.'
        },
        {
          title: '3. Impacto Automático no Lucro Real',
          description: 'O sistema desconta o custo do MDR instantaneamente de cada contrato, exibindo o Lucro Real CM CRED com precisão matemática.'
        }
      ]
    },
    {
      id: 'admin-usuarios',
      title: 'Gestão de Consultores, Comissões e Acessos',
      category: 'admin',
      targetRole: 'admin',
      icon: <ShieldCheck size={22} />,
      iconBg: '#fef2f2',
      iconColor: '#dc2626',
      shortDesc: 'Crie logins de consultores, defina percentuais de comissão e gerencie privilégios.',
      quickAction: { label: 'Gerenciar Acessos', sectionId: 'usuarios' },
      tags: ['usuários', 'consultores', 'comissão', 'permissões', 'acessos', 'segurança', 'admin'],
      steps: [
        {
          title: '1. Cadastro de Novos Colaboradores',
          description: 'No módulo "Acessos", clique em "+ Novo Usuário". Cadastre Nome, E-mail corporativo, Senha e atribua o perfil (Consultor, Gestor ou Admin).'
        },
        {
          title: '2. Definição da Comissão %',
          description: 'Configure a taxa de comissão de cada consultor. O sistema calculará automaticamente a comissão acumulada nas vendas dele.'
        },
        {
          title: '3. Bloqueio Imediato de Acessos',
          description: 'Em caso de desligamento ou troca de equipe, inative o usuário com um clique para revogar o acesso imediatamente.'
        }
      ]
    }
  ];

  const faqs: FAQItem[] = [
    {
      category: 'clientes',
      question: 'O cliente quer receber em conta bancária de outra pessoa. É permitido?',
      answer: 'Não. Por política antifraude da CM CRED e normas das adquirentes, a chave Pix deve pertencer obrigatoriamente ao mesmo CPF ou CNPJ do titular do cartão de crédito utilizado. Isso previne golpes e contestações (chargeback).'
    },
    {
      category: 'clientes',
      question: 'Por que o botão "Salvar" do cadastro de clientes fica desabilitado?',
      answer: 'O sistema exige que a Chave Pix seja informada e reconhecida como válida pelo validador em tempo real. Se o formato estiver incompleto ou incorreto, o botão permanecerá bloqueado até a correção.'
    },
    {
      category: 'consultor',
      question: 'Por que o consultor não visualiza as taxas de juros (%) e o lucro da CM CRED?',
      answer: 'Para garantir foco exclusivamente comercial e proteção estratégica da empresa, o perfil de consultor visualiza apenas os valores operacionais (valor liberado no PIX, total a passar no cartão, parcelas e comissão pessoal).'
    },
    {
      category: 'sistema',
      question: 'Como funciona a atualização automática sem precisar apertar F5?',
      answer: 'O sistema possui um recurso nativo de auto-refresh em tempo real que sincroniza automaticamente os dados a cada 30 segundos. Além disso, sempre que você alternar de aba no computador e retornar à CM CRED, os dados são atualizados instantaneamente.'
    },
    {
      category: 'financeiro',
      question: 'O que fazer se uma transação for cancelada na maquininha após o lançamento?',
      answer: 'Avise imediatamente o Administrador Geral. Ele alterará o status do contrato para "Recusado / Cancelado" na auditoria e removerá a previsão de saída no módulo Financeiro.'
    },
    {
      category: 'financeiro',
      question: 'Um consultor pode estornar uma baixa feita no Financeiro por engano?',
      answer: 'Não. Para garantir conformidade contábil e auditoria de caixa, a ação de estornar contas já baixadas é restrita exclusivamente a administradores do sistema.'
    },
    {
      category: 'simulador',
      question: 'Qual a diferença entre a Tabela 1 (Padrão) e a Tabela 2 (Flex)?',
      answer: 'A Tabela 1 segue a matriz tarifária oficial padrão da empresa. A Tabela 2 (Flex) conta com taxas reduzidas estratégicas, ideal para negociações com clientes indecisos ou operações de ticket mais alto.'
    }
  ];

  // Filtro de tutoriais
  const filteredTutorials = useMemo(() => {
    return tutorials.filter(t => {
      // Filtro de Perfil
      if (!isAdmin && t.targetRole === 'admin') return false;

      // Filtro de Categoria
      const matchCategory = activeCategory === 'todos' || t.category === activeCategory;

      // Filtro de Busca
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCategory;

      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.shortDesc.toLowerCase().includes(q);
      const matchTags = t.tags.some(tag => tag.toLowerCase().includes(q));
      const matchSteps = t.steps.some(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));

      return matchCategory && (matchTitle || matchDesc || matchTags || matchSteps);
    });
  }, [tutorials, activeCategory, searchQuery, isAdmin]);

  // Filtro de FAQ
  const filteredFAQs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return faqs;
    return faqs.filter(f => 
      f.question.toLowerCase().includes(q) || 
      f.answer.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header com Branding e Ação de Imprimir/Exportar */}
      <header style={{ 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
        borderRadius: '24px', 
        padding: '2.5rem', 
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)'
      }}>
        <div style={{ maxWidth: '800px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(217, 119, 6, 0.15)', border: '1px solid #d97706', padding: '6px 14px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.75rem' }}>
            <Sparkles size={14} /> CENTRAL DE AJUDA & BASE DE CONHECIMENTO
          </div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
            Manuais de Treinamento & Tutoriais CM CRED
          </h1>
          <p style={{ margin: '0.6rem 0 0', color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
            Guias operacionais passo a passo, normas de segurança e respostas para as principais dúvidas do dia a dia de Consultores e Administradores.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.85rem 1.4rem',
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255,255,255,0.15)',
              transition: 'all 0.2s'
            }}
          >
            <Printer size={18} color="#d97706" /> Imprimir / Salvar em PDF
          </button>
        </div>
      </header>

      {/* Barra de Pesquisa em Tempo Real */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '20px', 
        padding: '0.85rem 1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        border: '1px solid #e2e8f0'
      }}>
        <Search size={22} color="#94a3b8" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="O que você deseja aprender hoje? Digite aqui (ex: validar pix, simular empréstimo, dar baixa, maquininhas, comissão)..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '1rem',
            color: '#0f172a',
            fontWeight: 600,
            background: 'transparent'
          }}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontWeight: 800, fontSize: '0.75rem' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Categorias e Filtros Rápidos */}
      <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { id: 'todos', label: 'Todos os Tutoriais' },
          { id: 'simulador', label: 'Simulador & Vendas' },
          { id: 'clientes', label: 'Cadastro & Chave PIX' },
          { id: 'operacao', label: 'Lançamento de Contratos' },
          { id: 'financeiro', label: 'Financeiro & Baixas' },
          ...(isAdmin ? [{ id: 'admin', label: 'Gestão Administrativa' }] : []),
          { id: 'faq', label: 'Dúvidas Frequentes (FAQ)' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              background: activeCategory === cat.id ? '#0f172a' : '#ffffff',
              color: activeCategory === cat.id ? '#ffffff' : '#64748b',
              border: '1px solid',
              borderColor: activeCategory === cat.id ? '#0f172a' : '#e2e8f0',
              padding: '0.65rem 1.25rem',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              boxShadow: activeCategory === cat.id ? '0 4px 10px rgba(15,23,42,0.15)' : 'none'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Lista de Tutoriais */}
      {activeCategory !== 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={22} color="#d97706" /> Tutoriais e Manuais Práticos ({filteredTutorials.length})
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
              Clique em um tutorial para expandir o passo a passo
            </span>
          </div>

          {filteredTutorials.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '3.5rem', textAlign: 'center' }}>
              <Info size={36} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800 }}>Nenhum tutorial encontrado</h3>
              <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                Tente buscar por termos como "pix", "simular", "maquininha", "baixa" ou selecione outra categoria.
              </p>
            </div>
          ) : (
            filteredTutorials.map(tut => {
              const isExpanded = Boolean(expandedTutorials[tut.id]);

              return (
                <div 
                  key={tut.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Cabeçalho do Card (Clicável) */}
                  <div 
                    onClick={() => toggleTutorial(tut.id)}
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isExpanded ? '#f8fafc' : '#ffffff',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: tut.iconBg,
                        color: tut.iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {tut.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                          <span style={{ 
                            background: tut.targetRole === 'admin' ? '#fee2e2' : '#fef3c7',
                            color: tut.targetRole === 'admin' ? '#b91c1c' : '#b45309',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            textTransform: 'uppercase'
                          }}>
                            {tut.targetRole === 'admin' ? 'Administrador' : (tut.targetRole === 'consultor' ? 'Consultor' : 'Geral')}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>• {tut.steps.length} Passos Práticos</span>
                        </div>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 900 }}>
                          {tut.title}
                        </h3>
                        <p style={{ margin: '0.3rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                          {tut.shortDesc}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {tut.quickAction && onNavigate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(tut.quickAction!.sectionId);
                          }}
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.6rem 1.1rem',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 2px 6px rgba(15,23,42,0.15)'
                          }}
                        >
                          {tut.quickAction.label} <ExternalLink size={14} />
                        </button>
                      )}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b'
                      }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo do Passo a Passo (Accordion) */}
                  {isExpanded && (
                    <div style={{ padding: '2rem', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {tut.steps.map((step, idx) => (
                          <div 
                            key={idx}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '16px',
                              padding: '1.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              position: 'relative'
                            }}
                          >
                            <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <CheckCircle2 size={18} color="#059669" /> {step.title}
                            </h4>
                            <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 500 }}>
                              {step.description}
                            </p>

                            {step.tip && (
                              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: 'auto' }}>
                                <Sparkles size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ color: '#065f46', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.4 }}>
                                  Dica de Ouro: {step.tip}
                                </span>
                              </div>
                            )}

                            {step.warning && (
                              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: 'auto' }}>
                                <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.4 }}>
                                  Atenção: {step.warning}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {tut.quickAction && onNavigate && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                          <button
                            onClick={() => onNavigate(tut.quickAction!.sectionId)}
                            style={{
                              background: '#d97706',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '12px',
                              padding: '0.85rem 1.75rem',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: '0 4px 12px rgba(217,119,6,0.25)'
                            }}
                          >
                            Acessar {tut.quickAction.label} Agora <ArrowRight size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Seção de Perguntas Frequentes (FAQ) */}
      {(activeCategory === 'todos' || activeCategory === 'faq') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={22} color="#0284c7" /> Dúvidas Frequentes & Normas Operacionais ({filteredFAQs.length})
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
              Perguntas e respostas para orientar atendimentos diários
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredFAQs.map((faq, index) => {
              const isExpanded = Boolean(expandedFAQ[index]);

              return (
                <div 
                  key={index}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}
                >
                  <div
                    onClick={() => toggleFAQ(index)}
                    style={{
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isExpanded ? '#f8fafc' : '#ffffff'
                    }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      {faq.question}
                    </span>
                    <div style={{ color: '#64748b' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', background: '#ffffff', color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 500 }}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dicas Finais e Suporte */}
      <footer style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>Auto-Refresh Ativo em Tempo Real</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>O sistema sincroniza automaticamente a cada 30 segundos. Sem necessidade de F5.</div>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>
          CM CRED — Sistema de Operações e Troca de Limite
        </div>
      </footer>

      {/* Estilos para impressão / PDF */}
      <style>{`
        @media print {
          body { background: #ffffff !important; }
          header { background: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
          button { display: none !important; }
          input { display: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Tutorials;
