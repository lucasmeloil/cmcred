# 🛑 REGRAS DE ATUAÇÃO DE AGENTES DE IA (AGENTS.md) — CM CRED

## 1. RESTRIÇÃO ESTRITA AO ESCOPO DO PROMPT
- O agente deve realizar **EXCLUSIVAMENTE E RIGOROSAMENTE** o que o usuário solicitar no prompt.
- **NÃO ALTERE, NÃO REMOVA E NÃO ADICIONE** nenhum arquivo, componente ou configuração além do que foi expressamente pedido.
- Se o usuário pedir uma análise ou relatório, **faça apenas a análise e o relatório**. Não aplique alterações sem ordem explícita.
- Se o usuário pedir uma correção pontual, **modifique unicamente o ponto solicitado**.
- **Se você tiver qualquer sugestão ou encontrar algum erro, você deve APENAS FALAR E PERGUNTAR se o usuário quer ou não alterar antes de mexer em qualquer código.**

## 2. PROIBIÇÃO ABSOLUTA DE ALTERAÇÃO EM SEGURANÇA
- **O BLOQUEIO DE F12, DEVTOOLS E INSPEÇÃO DE CÓDIGO NUNCA DEVE SER DESATIVADO OU MODIFICADO.**
- O hook `useDevToolsProtection` em `lib/security.ts` deve permanecer **100% ativo** e sem qualquer tipo de exceção ou bypass (como `isLocalhost`, atalhos de desenvolvedor ou remoções).
- Nunca crie métodos de login automático de desenvolvedor (`loginAsDev`) ou atalhos que comprometam a segurança.

## 3. INTEGRIDADE DOS CÁLCULOS MATEMÁTICOS E FINANCEIROS
- Todas as fórmulas de taxas de juros, parcelas (1x a 18x), retenções de maquininhas e lucros líquidos devem manter exatidão centesimal sem divergências.
