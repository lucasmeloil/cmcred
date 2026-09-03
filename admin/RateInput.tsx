import React, { useState, useEffect } from 'react';

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
    return value === 0 ? '0' : value.toString().replace('.', ',');
  });

  // Sincroniza com o valor externo quando mudar (ex: ao trocar de tabela, bandeira ou recarregar do banco)
  useEffect(() => {
    // Se o usuário estiver no meio de uma digitação e limpou o campo, não forçar "0" imediatamente
    if (textValue === '' && value === 0) return;

    const currentNum = parseFloat(textValue.replace(',', '.'));
    if (isNaN(currentNum) || Math.abs(currentNum - value) > 0.0001) {
      setTextValue(value === 0 ? '0' : value.toString().replace('.', ','));
    }
  }, [value]);

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

    // Converte para float para atualizar os cálculos e estado pai
    const num = parseFloat(raw.replace(',', '.'));
    onChange(isNaN(num) ? 0 : Math.max(0, num));
  };

  const handleBlur = () => {
    if (readOnly) return;
    let cleaned = textValue.trim();

    // Se terminar com vírgula (ex: "1,"), remove a vírgula pendente
    if (cleaned.endsWith(',')) {
      cleaned = cleaned.slice(0, -1);
    }

    if (cleaned === '' || cleaned === ',') {
      cleaned = '0';
      setTextValue('0');
      onChange(0);
    } else {
      setTextValue(cleaned);
      const num = parseFloat(cleaned.replace(',', '.'));
      onChange(isNaN(num) ? 0 : Math.max(0, num));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      readOnly={readOnly}
      value={textValue}
      onChange={handleChange}
      onBlur={handleBlur}
      style={style}
      placeholder={placeholder}
    />
  );
};
