// =========================================================================
// VALIDADOR E DETECTOR AUTOMÁTICO DE CHAVES PIX - CM CRED
// Suporta: CPF, CNPJ, E-mail, Telefone Celular e Chave Aleatória (EVP)
// =========================================================================

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | 'invalid';

export interface PixValidationResult {
  isValid: boolean;
  type: PixKeyType;
  label: string;
  formatted: string;
  error?: string;
}

// Validador de dígitos verificadores de CPF
function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
}

// Validador de dígitos verificadores de CNPJ
function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Detecta e valida automaticamente qualquer formato de Chave PIX
 */
export function validatePixKey(input: string): PixValidationResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      type: 'invalid',
      label: 'Não informada',
      formatted: '',
      error: 'A chave PIX é obrigatória.'
    };
  }

  const raw = input.trim();
  const digitsOnly = raw.replace(/\D/g, '');

  // 1. E-mail
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(raw)) {
    return {
      isValid: true,
      type: 'email',
      label: 'E-mail',
      formatted: raw.toLowerCase()
    };
  }

  // 2. Chave Aleatória (EVP / UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cleanHex32 = raw.replace(/[^0-9a-fA-F]/g, '');
  if (uuidRegex.test(raw) || (cleanHex32.length === 32 && !digitsOnly.length)) {
    return {
      isValid: true,
      type: 'random',
      label: 'Chave Aleatória (EVP)',
      formatted: raw.toLowerCase()
    };
  }

  // 3. CPF (11 dígitos)
  if (digitsOnly.length === 11 && !raw.startsWith('+55')) {
    const isCpfValid = isValidCPF(digitsOnly);
    const formattedCpf = digitsOnly.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (isCpfValid) {
      return {
        isValid: true,
        type: 'cpf',
        label: 'CPF',
        formatted: formattedCpf
      };
    } else {
      // Se tiver 11 dígitos, pode ser também celular sem o código do país
      // Vamos verificar se tem DDD válido (11 a 99) e começa com 9
      const ddd = parseInt(digitsOnly.slice(0, 2), 10);
      const isMobile = digitsOnly[2] === '9' && ddd >= 11 && ddd <= 99;
      if (isMobile) {
        const formattedPhone = `+55 (${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
        return {
          isValid: true,
          type: 'phone',
          label: 'Telefone Celular',
          formatted: formattedPhone
        };
      }
      return {
        isValid: false,
        type: 'cpf',
        label: 'CPF Inválido',
        formatted: raw,
        error: 'Número de CPF inválido (dígitos verificadores incorretos).'
      };
    }
  }

  // 4. CNPJ (14 dígitos)
  if (digitsOnly.length === 14) {
    const isCnpjValid = isValidCNPJ(digitsOnly);
    const formattedCnpj = digitsOnly.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (isCnpjValid) {
      return {
        isValid: true,
        type: 'cnpj',
        label: 'CNPJ',
        formatted: formattedCnpj
      };
    } else {
      return {
        isValid: false,
        type: 'cnpj',
        label: 'CNPJ Inválido',
        formatted: raw,
        error: 'Número de CNPJ inválido (dígitos verificadores incorretos).'
      };
    }
  }

  // 5. Telefone Celular (+55 ou 10/11 dígitos com DDD)
  if (raw.startsWith('+55') || (digitsOnly.length >= 10 && digitsOnly.length <= 13)) {
    let cleanPhone = digitsOnly;
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      const ddd = cleanPhone.slice(0, 2);
      const num = cleanPhone.slice(2);
      const formatted = cleanPhone.length === 11
        ? `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
        : `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;

      return {
        isValid: true,
        type: 'phone',
        label: 'Telefone Celular',
        formatted
      };
    }
  }

  // Se nenhum dos padrões foi atendido
  return {
    isValid: false,
    type: 'invalid',
    label: 'Formato Desconhecido',
    formatted: raw,
    error: 'Chave PIX inválida. Informe um CPF, CNPJ, Telefone com DDD, E-mail ou Chave Aleatória (UUID).'
  };
}
