// =========================================================================
// TABELA OFICIAL DE TAXAS POR BANDEIRA E PARCELAS (1 a 18) - CM CRED
// Suporte a 2 Tabelas de Taxas Oficiais (Tabela 1 e Tabela 2)
// Sincronizado com o Supabase Database e LocalStorage
// =========================================================================

import { supabase } from './supabase';

export type RateTableType = 'tabela_1' | 'tabela_2';

export const TABLE_OPTIONS: { id: RateTableType; name: string; description: string }[] = [
  { id: 'tabela_1', name: 'Tabela 1 (Padrão)', description: 'Taxas padrão (7,00% a 19,99%)' },
  { id: 'tabela_2', name: 'Tabela 2 (Reduzida / Flex)', description: 'Taxas reduzidas (5,50% a 18,50%)' }
];

// TABELA 1 (HTML 1 - Padrão: 7.00% a 19.99%)
export const TABELA_1_RATES: Record<string, Record<number, number>> = {
  "VISA_MASTER": {
    1: 7.00, 2: 8.25, 3: 8.75, 4: 9.50, 5: 9.99, 6: 10.75,
    7: 11.25, 8: 11.75, 9: 12.25, 10: 12.99, 11: 13.75,
    12: 14.49, 13: 16.50, 14: 17.00, 15: 17.49, 16: 18.00, 17: 19.00, 18: 19.99
  },
  "BANESE/ELO": {
    1: 8.00, 2: 9.00, 3: 10.00, 4: 10.50, 5: 11.50, 6: 12.50,
    7: 13.00, 8: 14.00, 9: 14.50, 10: 14.99, 11: 15.75,
    12: 16.75, 13: 17.50, 14: 17.75, 15: 22.50, 16: 21.00, 17: 21.50, 18: 24.75
  },
  "AMEX": {
    1: 8.00, 2: 9.00, 3: 10.00, 4: 10.50, 5: 11.50, 6: 12.50,
    7: 13.00, 8: 14.00, 9: 14.50, 10: 14.99, 11: 15.75,
    12: 16.75, 13: 17.50, 14: 17.75, 15: 22.50, 16: 21.00, 17: 21.50, 18: 24.75
  }
};

// TABELA 2 (HTML 2 - Reduzida / Flex: 5.50% a 18.50%)
export const TABELA_2_RATES: Record<string, Record<number, number>> = {
  "VISA_MASTER": {
    1: 5.50, 2: 6.00, 3: 7.00, 4: 8.00, 5: 8.50, 6: 9.00,
    7: 9.50, 8: 10.00, 9: 10.50, 10: 11.00, 11: 13.00,
    12: 13.00, 13: 14.00, 14: 16.00, 15: 17.00,
    16: 18.50, 17: 18.50, 18: 18.50
  },
  "BANESE/ELO": {
    1: 6.50, 2: 7.50, 3: 8.50, 4: 9.00, 5: 10.50, 6: 11.00,
    7: 11.50, 8: 11.50, 9: 12.50, 10: 13.00, 11: 13.50,
    12: 15.00, 13: 15.50, 14: 16.50, 15: 17.00,
    16: 20.00, 17: 20.00, 18: 21.00
  },
  "AMEX": {
    1: 6.00, 2: 7.00, 3: 8.00, 4: 9.00, 5: 10.00, 6: 10.00,
    7: 11.00, 8: 11.50, 9: 12.00, 10: 12.50, 11: 13.00,
    12: 14.00, 13: 15.00, 14: 16.00, 15: 17.00,
    16: 20.00, 17: 20.00, 18: 20.00
  }
};

export const DEFAULT_CARD_RATES = TABELA_1_RATES;

export interface CardFlagOption {
  id: string;
  name: string;
  key: string;
  icon: string;
  color: string;
}

export const DEFAULT_OFFICIAL_CARD_FLAGS: CardFlagOption[] = [
  { id: 'visa_master', key: 'VISA_MASTER', name: 'VISA / MASTER', icon: '💳', color: '#1a1f71' },
  { id: 'banese_elo', key: 'BANESE/ELO', name: 'BANESE / ELO', icon: '🏦', color: '#d97706' },
  { id: 'amex', key: 'AMEX', name: 'AMERICAN EXPRESS - AMEX', icon: '💎', color: '#006fcf' }
];

const LOCAL_STORAGE_RATES_T1_KEY = 'cmcred_custom_rates_t1_v3';
const LOCAL_STORAGE_RATES_T2_KEY = 'cmcred_custom_rates_t2_v3';
const LOCAL_STORAGE_FLAGS_KEY = 'cmcred_custom_flags_v3';

// Memória local em runtime
let memoryRatesT1: Record<string, Record<number, number>> | null = null;
let memoryRatesT2: Record<string, Record<number, number>> | null = null;
let memoryFlags: CardFlagOption[] | null = null;

// Ler taxas armazenadas (Cache + Inicial)
export function getCustomCardRates(tableType: RateTableType = 'tabela_1'): Record<string, Record<number, number>> {
  const isT1 = tableType === 'tabela_1';
  if (isT1 && memoryRatesT1) return memoryRatesT1;
  if (!isT1 && memoryRatesT2) return memoryRatesT2;

  const storageKey = isT1 ? LOCAL_STORAGE_RATES_T1_KEY : LOCAL_STORAGE_RATES_T2_KEY;
  const defaultRates = isT1 ? TABELA_1_RATES : TABELA_2_RATES;

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        if (isT1) memoryRatesT1 = parsed;
        else memoryRatesT2 = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler taxas customizadas do storage:', e);
  }

  const initialCopy = JSON.parse(JSON.stringify(defaultRates));
  if (isT1) memoryRatesT1 = initialCopy;
  else memoryRatesT2 = initialCopy;
  return initialCopy;
}

// Ler bandeiras armazenadas (Cache + Inicial)
export function getCustomCardFlags(): CardFlagOption[] {
  if (memoryFlags) return memoryFlags;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_FLAGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryFlags = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler bandeiras customizadas:', e);
  }
  memoryFlags = DEFAULT_OFFICIAL_CARD_FLAGS;
  return memoryFlags;
}

// =========================================================================
// MÉTODOS CRUD DIRETO NO BANCO DE DADOS (SUPABASE)
// =========================================================================

// 1. GET: Buscar todas as taxas e bandeiras do banco de dados
export async function fetchRatesFromDatabase(): Promise<{
  ratesT1: Record<string, Record<number, number>>;
  ratesT2: Record<string, Record<number, number>>;
  flags: CardFlagOption[];
}> {
  try {
    const { data, error } = await supabase
      .from('simulator_rates')
      .select('*')
      .order('id');

    if (error) {
      console.warn('Aviso ao consultar simulator_rates no banco:', error.message);
      return {
        ratesT1: getCustomCardRates('tabela_1'),
        ratesT2: getCustomCardRates('tabela_2'),
        flags: getCustomCardFlags()
      };
    }

    if (data && data.length > 0) {
      const fetchedRatesT1: Record<string, Record<number, number>> = {};
      const fetchedRatesT2: Record<string, Record<number, number>> = {};
      const fetchedFlags: CardFlagOption[] = [];

      data.forEach((row: any) => {
        const key = row.id;
        const ratesObj1: Record<number, number> = {};
        const ratesObj2: Record<number, number> = {};

        // Extração flexível e robusta de T1 e T2
        let rawT1: any = null;
        let rawT2: any = null;

        if (row.installment_rates?.t1 && typeof row.installment_rates.t1 === 'object') {
          rawT1 = row.installment_rates.t1;
        } else if (row.installment_rates_t1 && typeof row.installment_rates_t1 === 'object') {
          rawT1 = row.installment_rates_t1;
        }

        if (row.installment_rates?.t2 && typeof row.installment_rates.t2 === 'object') {
          rawT2 = row.installment_rates.t2;
        } else if (row.installment_rates_t2 && typeof row.installment_rates_t2 === 'object') {
          rawT2 = row.installment_rates_t2;
        }

        // Se o registro no banco for o formato antigo plano (ex: {"1": 5.5, ...})
        if (!rawT1 && !rawT2 && row.installment_rates && typeof row.installment_rates === 'object' && !row.installment_rates.t1) {
          const firstRate = Number(row.installment_rates[1] ?? row.installment_rates['1'] ?? 0);
          if (firstRate > 0 && firstRate <= 6.5) {
            // É a Tabela 2 (Reduzida)
            rawT2 = row.installment_rates;
            rawT1 = TABELA_1_RATES[key] || {};
          } else if (firstRate > 6.5) {
            // É a Tabela 1 (Padrão)
            rawT1 = row.installment_rates;
            rawT2 = TABELA_2_RATES[key] || {};
          }
        }

        if (!rawT1) rawT1 = TABELA_1_RATES[key] || {};
        if (!rawT2) rawT2 = TABELA_2_RATES[key] || {};

        for (let i = 1; i <= 18; i++) {
          ratesObj1[i] = Number(rawT1[i] ?? rawT1[String(i)] ?? TABELA_1_RATES[key]?.[i] ?? 0);
          ratesObj2[i] = Number(rawT2[i] ?? rawT2[String(i)] ?? TABELA_2_RATES[key]?.[i] ?? 0);
        }

        fetchedRatesT1[key] = ratesObj1;
        fetchedRatesT2[key] = ratesObj2;

        fetchedFlags.push({
          id: key.toLowerCase(),
          key: key,
          name: row.name || key,
          icon: row.icon || '💳',
          color: row.color || '#00a859'
        });
      });

      // Atualiza memória e localStorage
      memoryRatesT1 = fetchedRatesT1;
      memoryRatesT2 = fetchedRatesT2;
      memoryFlags = fetchedFlags;
      localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(fetchedRatesT1));
      localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(fetchedRatesT2));
      localStorage.setItem(LOCAL_STORAGE_FLAGS_KEY, JSON.stringify(fetchedFlags));

      window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { t1: fetchedRatesT1, t2: fetchedRatesT2 } }));
      window.dispatchEvent(new CustomEvent('bonuscred_flags_updated', { detail: fetchedFlags }));

      return { ratesT1: fetchedRatesT1, ratesT2: fetchedRatesT2, flags: fetchedFlags };
    }
  } catch (err) {
    console.error('Erro na requisição de taxas do banco:', err);
  }
  return {
    ratesT1: getCustomCardRates('tabela_1'),
    ratesT2: getCustomCardRates('tabela_2'),
    flags: getCustomCardFlags()
  };
}

// 2. POST / PUT: Salvar/Atualizar uma bandeira e suas taxas no banco de dados
export async function saveRateToDatabase(
  flagKey: string,
  name: string,
  icon: string,
  color: string,
  installmentRates: Record<number, number>,
  tableType: RateTableType = 'tabela_1'
): Promise<{ success: boolean; error?: string }> {
  try {
    const isT1 = tableType === 'tabela_1';

    // Obter as taxas atuais da outra tabela para preservar ambas juntas
    const currentRatesT1 = isT1 ? installmentRates : (getCustomCardRates('tabela_1')[flagKey] || TABELA_1_RATES[flagKey] || {});
    const currentRatesT2 = !isT1 ? installmentRates : (getCustomCardRates('tabela_2')[flagKey] || TABELA_2_RATES[flagKey] || {});

    const payload: any = {
      id: flagKey,
      name,
      icon,
      color,
      installment_rates: {
        t1: currentRatesT1,
        t2: currentRatesT2
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('simulator_rates')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Erro ao salvar taxa no Supabase:', error);
      return { success: false, error: error.message };
    }

    // Atualizar local
    if (isT1) {
      const current = getCustomCardRates('tabela_1');
      current[flagKey] = installmentRates;
      memoryRatesT1 = current;
      localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(current));
    } else {
      const current = getCustomCardRates('tabela_2');
      current[flagKey] = installmentRates;
      memoryRatesT2 = current;
      localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(current));
    }

    const currentFlags = getCustomCardFlags();
    const existingIndex = currentFlags.findIndex(f => f.key === flagKey);
    if (existingIndex >= 0) {
      currentFlags[existingIndex] = { id: flagKey.toLowerCase(), key: flagKey, name, icon, color };
    } else {
      currentFlags.push({ id: flagKey.toLowerCase(), key: flagKey, name, icon, color });
    }
    memoryFlags = currentFlags;
    localStorage.setItem(LOCAL_STORAGE_FLAGS_KEY, JSON.stringify(currentFlags));

    window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { tableType, rates: isT1 ? memoryRatesT1 : memoryRatesT2 } }));
    window.dispatchEvent(new CustomEvent('bonuscred_flags_updated', { detail: currentFlags }));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro desconhecido' };
  }
}

// 3. POST / BULK SAVE: Salvar todas as taxas e bandeiras no banco de dados
export async function saveAllRatesToDatabase(
  rates: Record<string, Record<number, number>>,
  flags: CardFlagOption[],
  tableType: RateTableType = 'tabela_1'
): Promise<{ success: boolean; error?: string }> {
  try {
    const isT1 = tableType === 'tabela_1';

    // Obter as taxas da outra tabela
    const otherRates = isT1 ? getCustomCardRates('tabela_2') : getCustomCardRates('tabela_1');

    const rows = flags.map(f => {
      const t1Rates = isT1 ? (rates[f.key] || TABELA_1_RATES[f.key] || {}) : (otherRates[f.key] || TABELA_1_RATES[f.key] || {});
      const t2Rates = !isT1 ? (rates[f.key] || TABELA_2_RATES[f.key] || {}) : (otherRates[f.key] || TABELA_2_RATES[f.key] || {});

      return {
        id: f.key,
        name: f.name,
        icon: f.icon,
        color: f.color,
        installment_rates: {
          t1: t1Rates,
          t2: t2Rates
        },
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('simulator_rates')
      .upsert(rows, { onConflict: 'id' });

    if (isT1) {
      memoryRatesT1 = rates;
      localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(rates));
    } else {
      memoryRatesT2 = rates;
      localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(rates));
    }
    memoryFlags = flags;
    localStorage.setItem(LOCAL_STORAGE_FLAGS_KEY, JSON.stringify(flags));

    window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { tableType, rates } }));
    window.dispatchEvent(new CustomEvent('bonuscred_flags_updated', { detail: flags }));

    if (error) {
      console.error('Erro ao salvar todas as taxas no Supabase:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão' };
  }
}

// 4. DELETE: Excluir uma bandeira do banco de dados
export async function deleteRateFromDatabase(flagKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('simulator_rates')
      .delete()
      .eq('id', flagKey);

    if (error) {
      return { success: false, error: error.message };
    }

    const currentRates1 = getCustomCardRates('tabela_1');
    const currentRates2 = getCustomCardRates('tabela_2');
    delete currentRates1[flagKey];
    delete currentRates2[flagKey];
    memoryRatesT1 = currentRates1;
    memoryRatesT2 = currentRates2;
    localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(currentRates1));
    localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(currentRates2));

    const currentFlags = getCustomCardFlags().filter(f => f.key !== flagKey);
    memoryFlags = currentFlags;
    localStorage.setItem(LOCAL_STORAGE_FLAGS_KEY, JSON.stringify(currentFlags));

    window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { t1: currentRates1, t2: currentRates2 } }));
    window.dispatchEvent(new CustomEvent('bonuscred_flags_updated', { detail: currentFlags }));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao excluir' };
  }
}

// 5. RESTORE DEFAULT: Restaurar taxas padrão oficiais dos HTMLs no Supabase
export async function resetAllRatesInDatabase(tableType?: RateTableType): Promise<{ success: boolean; error?: string }> {
  try {
    const defaultFlags = DEFAULT_OFFICIAL_CARD_FLAGS;

    if (tableType === 'tabela_1' || !tableType) {
      memoryRatesT1 = JSON.parse(JSON.stringify(TABELA_1_RATES));
      localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(TABELA_1_RATES));
    }
    if (tableType === 'tabela_2' || !tableType) {
      memoryRatesT2 = JSON.parse(JSON.stringify(TABELA_2_RATES));
      localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(TABELA_2_RATES));
    }

    const rows = defaultFlags.map(f => ({
      id: f.key,
      name: f.name,
      icon: f.icon,
      color: f.color,
      installment_rates: {
        t1: TABELA_1_RATES[f.key] || {},
        t2: TABELA_2_RATES[f.key] || {}
      },
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('simulator_rates')
      .upsert(rows, { onConflict: 'id' });

    memoryFlags = defaultFlags;
    localStorage.setItem(LOCAL_STORAGE_FLAGS_KEY, JSON.stringify(defaultFlags));

    window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { t1: memoryRatesT1, t2: memoryRatesT2 } }));
    window.dispatchEvent(new CustomEvent('bonuscred_flags_updated', { detail: defaultFlags }));

    if (error) {
      console.warn('Erro ao restaurar taxas no banco:', error);
      return { success: true, error: 'Salvo localmente (offline)' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao restaurar' };
  }
}

// Salvar localmente
export function saveCustomCardRates(newRates: Record<string, Record<number, number>>, tableType: RateTableType = 'tabela_1') {
  if (tableType === 'tabela_1') {
    memoryRatesT1 = newRates;
    localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(newRates));
  } else {
    memoryRatesT2 = newRates;
    localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(newRates));
  }
  window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { tableType, rates: newRates } }));
}

// Restaurar taxas padrão
export function resetCustomCardRates(tableType: RateTableType = 'tabela_1'): Record<string, Record<number, number>> {
  const defaultData = tableType === 'tabela_1' ? TABELA_1_RATES : TABELA_2_RATES;
  const defaults = JSON.parse(JSON.stringify(defaultData));
  if (tableType === 'tabela_1') {
    memoryRatesT1 = defaults;
    localStorage.setItem(LOCAL_STORAGE_RATES_T1_KEY, JSON.stringify(defaults));
  } else {
    memoryRatesT2 = defaults;
    localStorage.setItem(LOCAL_STORAGE_RATES_T2_KEY, JSON.stringify(defaults));
  }
  memoryFlags = DEFAULT_OFFICIAL_CARD_FLAGS;
  localStorage.setItem(LOCAL_STORAGE_FLAGS_KEY, JSON.stringify(DEFAULT_OFFICIAL_CARD_FLAGS));
  window.dispatchEvent(new CustomEvent('bonuscred_rates_updated', { detail: { tableType, rates: defaults } }));
  window.dispatchEvent(new CustomEvent('bonuscred_flags_updated', { detail: DEFAULT_OFFICIAL_CARD_FLAGS }));
  return defaults;
}

export function getFlagRateKey(flagIdOrName?: string): string {
  if (!flagIdOrName) return 'VISA_MASTER';
  const clean = flagIdOrName.toUpperCase();
  if (clean.includes('BANESE') || clean.includes('ELO')) return 'BANESE/ELO';
  if (clean.includes('AMEX') || clean.includes('AMERICAN')) return 'AMEX';
  if (clean === 'VISA_MASTER' || clean.includes('VISA') || clean.includes('MASTER')) return 'VISA_MASTER';
  return flagIdOrName;
}

export function getRateForFlagAndInstallment(
  flagKey: string,
  installment: number,
  tableType: RateTableType = 'tabela_1'
): number {
  const normKey = getFlagRateKey(flagKey);
  const currentRates = getCustomCardRates(tableType);
  const fallbackRates = tableType === 'tabela_1' ? TABELA_1_RATES : TABELA_2_RATES;
  const flagRates = currentRates[normKey] || currentRates['VISA_MASTER'] || fallbackRates['VISA_MASTER'];
  return flagRates?.[installment] ?? 0;
}

export interface SimulationCalculationResult {
  valorSolicitado: number; // Valor líquido do cliente
  valorJuros: number;
  valorTotal: number; // Valor total passado no cartão / pago
  parcelas: number;
  valorParcela: number;
  taxaJuros: number;
}

export function calculateLoanSimulation({
  valorDesejado,
  parcelas,
  tipoCalculo,
  bandeiraCartao,
  tableType = 'tabela_1',
  customTaxa
}: {
  valorDesejado: number;
  parcelas: number;
  tipoCalculo: 'Valor Líquido' | 'Valor Bruto';
  bandeiraCartao: string;
  tableType?: RateTableType;
  customTaxa?: number;
}): SimulationCalculationResult {
  const nParcelas = Math.min(18, Math.max(1, Number(parcelas) || 1));
  const nValorDesejado = Math.max(0, Number(valorDesejado) || 0);

  const taxaJuros = customTaxa !== undefined
    ? Number(customTaxa)
    : getRateForFlagAndInstallment(bandeiraCartao, nParcelas, tableType);

  let valorSolicitado = 0;
  let valorJuros = 0;
  let valorTotal = 0;
  let valorParcela = 0;

  if (tipoCalculo === 'Valor Líquido') {
    // Fórmula oficial do HTML:
    // valorBruto = valorDesejado / (1 + taxaJuros / 100);
    // valorJuros = valorBruto * (taxaJuros / 100);
    // valorTotal = valorBruto + valorJuros;
    // valorParcela = valorTotal / parcelas;
    const valorBruto = nValorDesejado / (1 + taxaJuros / 100);
    valorJuros = valorBruto * (taxaJuros / 100);
    valorTotal = valorBruto + valorJuros;
    valorParcela = nParcelas > 0 ? valorTotal / nParcelas : 0;
    valorSolicitado = valorBruto;
  } else {
    // Fórmula oficial do HTML:
    // valorLiquido = valorDesejado;
    // valorJuros = valorDesejado * (taxaJuros / 100);
    // valorTotal = valorDesejado + valorJuros;
    // valorParcela = valorTotal / parcelas;
    const valorLiquido = nValorDesejado;
    valorJuros = nValorDesejado * (taxaJuros / 100);
    valorTotal = nValorDesejado + valorJuros;
    valorParcela = nParcelas > 0 ? valorTotal / nParcelas : 0;
    valorSolicitado = valorLiquido;
  }

  return {
    valorSolicitado,
    valorJuros,
    valorTotal,
    parcelas: nParcelas,
    valorParcela,
    taxaJuros
  };
}

export function buildWhatsAppSimulationMessage({
  valorSolicitado,
  valorTotal,
  parcelas,
  valorParcela,
  bandeira
}: {
  valorSolicitado: number;
  valorTotal: number;
  parcelas: number;
  valorParcela: number;
  bandeira?: string;
}): string {
  const formatMoney = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  let flagDisplay = 'MASTER/VISA';
  if (bandeira) {
    const bUpper = bandeira.toUpperCase();
    if (bUpper.includes('BANESE') || bUpper.includes('ELO')) flagDisplay = 'BANESE/ELO';
    else if (bUpper.includes('AMEX') || bUpper.includes('AMERICAN')) flagDisplay = 'AMERICAN EXPRESS - AMEX';
    else if (bUpper.includes('VISA') || bUpper.includes('MASTER')) flagDisplay = 'MASTER/VISA';
    else flagDisplay = bandeira;
  }

  return `✨ SIMULADOR OFICIAL CM CRED ✨\n\n` +
    `💳 BANDEIRA: ${flagDisplay}\n` +
    `💸 VALOR LIBERADO NO PIX: R$ ${formatMoney(valorSolicitado)}\n` +
    `⏳ PRAZO: ${parcelas}x fixas\n` +
    `⚡ PARCELA: R$ ${formatMoney(valorParcela)}\n` +
    `💰 TOTAL NO CARTÃO: R$ ${formatMoney(valorTotal)}`;
}

// =========================================================================
// CÁLCULO PRECISO DE RETENÇÃO DA MAQUININHA & LUCRO REAL CM CRED
// =========================================================================

export interface MachineRetentionInfo {
  rate: number;
  amount: number;
  source: 'observation' | 'database_field' | 'machine_flag_tier' | 'machine_tier' | 'machine_flat' | 'default_table' | 'fallback';
}

export function resolveMachineFeeRate({
  machine,
  cardFlag,
  installments,
  observations,
  explicitRate,
  explicitAmount,
  grossAmount = 0
}: {
  machine?: any;
  cardFlag?: string;
  installments?: number;
  observations?: string;
  explicitRate?: number | null;
  explicitAmount?: number | null;
  grossAmount?: number;
}): MachineRetentionInfo {
  const inst = Math.min(18, Math.max(1, Number(installments) || 1));
  const flagKey = getFlagRateKey(cardFlag);

  // 1. Extração fiel da observação gravada no momento do lançamento da operação
  if (observations) {
    const retMatch = observations.match(/Retenção\s*([\d.,]+)%\s*=\s*R\$\s*([\d.,]+)/i);
    if (retMatch) {
      const rate = parseFloat(retMatch[1].replace(',', '.'));
      const amount = parseFloat(retMatch[2].replace(',', '.'));
      if (!isNaN(rate) && !isNaN(amount)) {
        return { rate, amount: Number(amount.toFixed(2)), source: 'observation' };
      }
    }
    const singleMatch = observations.match(/Retenção\s*([\d.,]+)%/i);
    if (singleMatch) {
      const rate = parseFloat(singleMatch[1].replace(',', '.'));
      if (!isNaN(rate)) {
        const amount = (explicitAmount !== undefined && explicitAmount !== null && Number(explicitAmount) > 0)
          ? Number(Number(explicitAmount).toFixed(2))
          : Number((grossAmount * (rate / 100)).toFixed(2));
        return { rate, amount, source: 'observation' };
      }
    }
  }

  // 2. Campo explícito no empréstimo (machine_fee_percentage / machine_fee_amount)
  if (explicitRate !== undefined && explicitRate !== null && Number(explicitRate) > 0) {
    const rate = Number(explicitRate);
    const amount = (explicitAmount !== undefined && explicitAmount !== null && Number(explicitAmount) > 0)
      ? Number(Number(explicitAmount).toFixed(2))
      : Number((grossAmount * (rate / 100)).toFixed(2));
    return { rate, amount, source: 'database_field' };
  }

  if (explicitAmount !== undefined && explicitAmount !== null && Number(explicitAmount) > 0) {
    const amount = Number(Number(explicitAmount).toFixed(2));
    const rate = grossAmount > 0 ? Number(((amount / grossAmount) * 100).toFixed(2)) : 0;
    return { rate, amount, source: 'database_field' };
  }

  // 3. Extrair da configuração da maquininha cadastrada no banco
  if (machine) {
    // 3a. Tabela por bandeira e parcelamento (rates_by_flag ou card_rates)
    const flagRates = machine.card_rates?.[flagKey] ||
      machine.installment_fees?.rates_by_flag?.[flagKey] ||
      machine.installment_fees?.rates_by_flag?.[cardFlag || ''] ||
      machine.installment_fees?.[flagKey];

    if (flagRates && typeof flagRates === 'object') {
      const rateVal = flagRates[inst] ?? flagRates[String(inst)] ?? flagRates[`${inst}x`];
      if (rateVal !== undefined && rateVal !== null && Number(rateVal) > 0) {
        const rate = Number(rateVal);
        return {
          rate,
          amount: Number((grossAmount * (rate / 100)).toFixed(2)),
          source: 'machine_flag_tier'
        };
      }
    }

    // 3b. Tabela direta de parcelas na máquina (1x a 18x)
    if (machine.installment_fees && typeof machine.installment_fees === 'object') {
      const feeVal = machine.installment_fees[inst] ??
        machine.installment_fees[String(inst)] ??
        machine.installment_fees[`${inst}x`];
      if (feeVal !== undefined && feeVal !== null && Number(feeVal) > 0) {
        const rate = Number(feeVal);
        return {
          rate,
          amount: Number((grossAmount * (rate / 100)).toFixed(2)),
          source: 'machine_tier'
        };
      }
    }

    // 3c. Taxa percentual geral da máquina
    if (machine.fee_percentage !== undefined && machine.fee_percentage !== null && Number(machine.fee_percentage) > 0) {
      const rate = Number(machine.fee_percentage);
      return {
        rate,
        amount: Number((grossAmount * (rate / 100)).toFixed(2)),
        source: 'machine_flat'
      };
    }
  }

  // 4. Tabela de Custo Real MDR de Maquininha POS (Stone, PagBank, Cielo, etc.)
  // Custo de MDR por parcelamento (1x a 18x) cobrado pela adquirente da máquina
  const DEFAULT_MACHINE_MDR_TIERS: Record<number, number> = {
    1: 1.20,
    2: 1.80,
    3: 2.10,
    4: 2.40,
    5: 2.70,
    6: 3.00,
    7: 3.30,
    8: 3.60,
    9: 3.90,
    10: 4.20,
    11: 4.50,
    12: 4.80,
    13: 5.10,
    14: 5.40,
    15: 5.70,
    16: 6.00,
    17: 6.20,
    18: 6.50
  };

  const costRate = DEFAULT_MACHINE_MDR_TIERS[inst] ?? (1.0 + inst * 0.3);
  return {
    rate: Number(costRate.toFixed(2)),
    amount: Number((grossAmount * (costRate / 100)).toFixed(2)),
    source: 'machine_tier'
  };
}

export interface LoanFinancialBreakdown {
  grossAmount: number;
  netAmount: number;
  operationProfit: number;
  machineFeeRate: number;
  machineFeeAmount: number;
  commissionRate: number;
  commissionAmount: number;
  companyNetProfit: number;
  installments: number;
  interestRate: number;
  cardBrand: string;
}

export function calculateLoanFinancials(loan: any): LoanFinancialBreakdown {
  const grossAmount = Number(loan.approved_amount) || Number(loan.gross_amount) || (Number(loan.requested_amount) + Number(loan.profit)) || 0;
  const netAmount = Number(loan.requested_amount) || 0;
  const installments = Math.min(18, Math.max(1, Number(loan.installments) || 1));
  const interestRate = Number(loan.interest_rate) || 0;

  // Bandeira
  let cardBrand = 'VISA / MASTER';
  if (loan.observations) {
    const flagMatch = loan.observations.match(/Bandeira:\s*([^|]+)/i);
    if (flagMatch && flagMatch[1]) cardBrand = flagMatch[1].trim();
  }
  if (!cardBrand || cardBrand === 'N/A' || cardBrand === 'Cartão de Crédito') {
    cardBrand = (loan.type && loan.type !== 'cartão') ? loan.type.toUpperCase() : 'VISA / MASTER';
  }

  // Retenção Maquininha
  const machRes = resolveMachineFeeRate({
    machine: loan.machines,
    cardFlag: cardBrand,
    installments,
    observations: loan.observations,
    explicitRate: loan.machine_fee_percentage,
    explicitAmount: loan.machine_fee_amount,
    grossAmount
  });

  const operationProfit = Number((grossAmount - netAmount).toFixed(2));
  const commissionAmount = Number(loan.consultant_commission_amount) || 0;
  const commissionRate = operationProfit > 0 ? Number(((commissionAmount / operationProfit) * 100).toFixed(2)) : 0;

  // Lucro Real da CM CRED que SOBRA na empresa:
  // Juros Brutos - Retenção da Maquininha - Comissão do Operador
  const companyNetProfit = Number(Math.max(0, operationProfit - machRes.amount - commissionAmount).toFixed(2));

  return {
    grossAmount,
    netAmount,
    operationProfit,
    machineFeeRate: machRes.rate,
    machineFeeAmount: machRes.amount,
    commissionRate,
    commissionAmount,
    companyNetProfit,
    installments,
    interestRate,
    cardBrand
  };
}

