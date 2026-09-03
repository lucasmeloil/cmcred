// ========================
// Admin Panel Types
// ========================

export type UserRole = 'admin' | 'manager' | 'operator' | 'consultant';
export type UserStatus = 'active' | 'inactive';
export type LeadOrigin = 'LP' | 'campanha' | 'indicação' | 'site' | 'whatsapp';
export type LoanType = 'cartão' | 'consignado' | 'FGTS' | 'pessoal';
export type LoanStatus = 'pending' | 'in analysis' | 'approved' | 'rejected' | 'completed';
export type AuditAction = 'criação' | 'edição' | 'exclusão' | 'login' | 'logout' | 'exportação';

export interface UserPermissions {
  dashboard: boolean;
  create_loan: boolean;
  loans: boolean;
  delete_loans: boolean;
  finance: boolean;
  machines: boolean;
  card_flags: boolean;
  leads: boolean;
  customers: boolean;
  reports: boolean;
  users: boolean;
  audit: boolean;
  lucros?: boolean;
  novo_emprestimo?: boolean;
  solicitacoes?: boolean;
  financeiro?: boolean;
  maquininhas?: boolean;
  taxas_simulador?: boolean;
  relatorios?: boolean;
  usuarios?: boolean;
  logs?: boolean;
  pessoas?: boolean;
  simulador?: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: true,
  create_loan: true,
  loans: true,
  delete_loans: false,
  finance: false,
  machines: false,
  card_flags: false,
  leads: true,
  customers: true,
  reports: false,
  users: false,
  audit: false,
  lucros: false,
  novo_emprestimo: true,
  solicitacoes: true,
  financeiro: false,
  maquininhas: false,
  taxas_simulador: false,
  relatorios: false,
  usuarios: false,
  logs: false,
  pessoas: true,
  simulador: true,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  dashboard: true,
  create_loan: true,
  loans: true,
  delete_loans: true,
  finance: true,
  machines: true,
  card_flags: true,
  leads: true,
  customers: true,
  reports: true,
  users: true,
  audit: true,
  lucros: true,
  novo_emprestimo: true,
  solicitacoes: true,
  financeiro: true,
  maquininhas: true,
  taxas_simulador: true,
  relatorios: true,
  usuarios: true,
  logs: true,
  pessoas: true,
  simulador: true,
};

export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  status: UserStatus;
  avatar?: string;
  dataCriacao: string;
  ultimoLogin?: string;
  commission_percentage?: number;
  permissions?: UserPermissions;
}

export interface Lead {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  pix_key?: string;
  source: string;
  created_at: string;
  status: 'new' | 'contacted' | 'qualified' | 'lost';
}

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  pix_key?: string;
  birth_date?: string;
  address?: string;
  status: 'active' | 'inactive';
  person_type: 'customer' | 'employee' | 'admin';
  notes?: string;
  created_at: string;
}

export interface LoanRequest {
  id: string;
  lead_id?: string;
  customer_id?: string;
  consultant_id?: string;
  consultant_name?: string;
  lead_name?: string;
  type: LoanType;
  requested_amount: number;
  approved_amount: number;
  installments: number;
  interest_rate: number;
  bank_id: number;
  bank_name?: string;
  machine_id: number;
  machine_name?: string;
  status: LoanStatus;
  profit: number;
  consultant_commission_amount?: number;
  company_net_profit?: number;
  created_at: string;
  observations?: string;
}

export interface FinanceEntry {
  id: string;
  loan_id?: string;
  description: string;
  amount: number;
  gross_amount?: number;
  due_date: string;
  type: 'payable' | 'receivable';
  status: 'pending' | 'paid' | 'overdue';
  category: string;
  bank_id?: number;
  machine_id?: number;
  created_at?: string;
}

export interface Bank {
  id: number;
  name: string;
}

export interface Machine {
  id: number;
  name: string;
  bank_id: number;
  fee_percentage?: number;
  liquidation_days?: number;
  bank_name?: string;
  installment_fees?: Record<string, number>;
}

export interface CardFlag {
  id: string;
  name: string;
  color: string;
  icon: string;
  fee_percentage: number;
  special: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: AuditAction;
  description: string;
  created_at: string;
  ip?: string;
}

export interface Notification {
  id: string;
  tipo: 'lead' | 'solicitacao' | 'sistema';
  mensagem: string;
  lida: boolean;
  dataHora: string;
}
