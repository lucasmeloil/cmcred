import React, { useState, useEffect, useRef } from 'react';

export interface RateInputProps {
  value: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

export const RateInput: React.FC<RateInputProps> = ({
  value,
  readOnly = false,
  onChange,
  style,
  placeholder = '0,00'
}) => {
  const [textValue, setTextValue] = useState<string>(() => {
    return value === 0 ? '' : value.toString().replace('.', ',');
  });

  // Flag para bloquear a sincronização externa enquanto o usuário está digitando ativamente
  const isEditingRef = useRef(false);

  // Sincroniza com o valor externo quando mudar (ex: ao trocar de tabela, bandeira ou recarregar do banco)
  // Só atualiza se o usuário NÃO estiver editando ativamente o campo
  useEffect(() => {
    if (isEditingRef.current) return;

    const currentNum = parseFloat(textValue.replace(',', '.'));
    if (isNaN(currentNum) || Math.abs(currentNum - value) > 0.0001) {
      setTextValue(value === 0 ? '' : value.toString().replace('.', ','));
    }
  }, [value]);

  const handleFocus = () => {
    isEditingRef.current = true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    let raw = e.target.value;

    // Se o usuário digitou ponto (inclusive no teclado numérico), converte para vírgula
    raw = raw.replace('.', ',');

    // Remove qualquer caractere que não seja número ou vírgula
    raw = raw.replace(/[^0-9,]/g, '');

    // Se começar diretamente com vírgula, ex: ",5", converte para "0,5"
    if (raw.startsWith(',')) {
      raw = '0' + raw;
    }

    // Permite no máximo uma vírgula
    const parts = raw.split(',');
    if (parts.length > 2) {
      raw = parts[0] + ',' + parts.slice(1).join('');
    }

    setTextValue(raw);

    // Converte para float e emite para o pai SOMENTE se for um número válido.
    // Enquanto o campo está vazio ou incompleto (ex: "9,"), não emite nada
    // para não acionar o useEffect de sync e sobrescrever a digitação.
    const num = parseFloat(raw.replace(',', '.'));
    if (!isNaN(num)) {
      onChange(Math.max(0, num));
    }
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    if (readOnly) return;
    let cleaned = textValue.trim();

    // Se terminar com vírgula (ex: "1,"), remove a vírgula pendente
    if (cleaned.endsWith(',')) {
      cleaned = cleaned.slice(0, -1);
    }

    if (cleaned === '' || cleaned === ',') {
      // Campo vazio ao sair: emite 0 e exibe o placeholder
      setTextValue('');
      onChange(0);
    } else {
      const num = parseFloat(cleaned.replace(',', '.'));
      const final = isNaN(num) ? 0 : Math.max(0, num);
      // Normaliza a exibição (remove zeros à esquerda desnecessários, etc.)
      setTextValue(final === 0 ? '' : String(final).replace('.', ','));
      onChange(final);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      readOnly={readOnly}
      value={textValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      style={style}
      placeholder={placeholder || '0,00'}
    />
  );
};
