import type { AdminUser, Lead, LoanRequest, AuditLog, Notification, FinanceEntry } from './types';

// Estes dados serão substituídos pelas chamadas ao Supabase
export const MOCK_USERS: AdminUser[] = [];
export const MOCK_LEADS: Lead[] = [];
export const MOCK_LOANS: LoanRequest[] = [];
export const MOCK_FINANCE: FinanceEntry[] = [];
export const MOCK_LOGS: AuditLog[] = [];
export const MOCK_NOTIFICATIONS: Notification[] = [];

export const CHART_DATA_LEADS = [
  { name: 'Seg', leads: 0 },
  { name: 'Ter', leads: 0 },
  { name: 'Qua', leads: 0 },
  { name: 'Qui', leads: 0 },
  { name: 'Sex', leads: 0 },
  { name: 'Sáb', leads: 0 },
  { name: 'Dom', leads: 0 },
];

export const CHART_DATA_STATUS = [
  { name: 'Aprovado', value: 0, color: '#d97706' },
  { name: 'Em Análise', value: 0, color: '#f59e0b' },
  { name: 'Pendente', value: 0, color: '#3b82f6' },
  { name: 'Recusado', value: 0, color: '#ef4444' },
  { name: 'Concluído', value: 0, color: '#8b5cf6' },
];

export const CHART_DATA_TIPO = [
  { name: 'FGTS', value: 0 },
  { name: 'Consignado', value: 0 },
  { name: 'Cartão', value: 0 },
  { name: 'Pessoal', value: 0 },
];
