# Diretriz de Escopo Estrito e Segurança CM CRED

1. **Escopo Estrito de Prompt:** O assistente só pode realizar exatamente as alterações solicitadas pelo usuário no prompt. Nunca modificar nada além do solicitado.
2. **Consulta Prévia Obrigatória:** Se encontrar algum erro ou tiver qualquer sugestão, deve apenas relatar e perguntar se o usuário deseja alterar antes de fazer qualquer modificação no código.
3. **Segurança Intocável:** É terminantemente proibido desativar, alterar ou criar bypass para a proteção de F12 e DevTools (`useDevToolsProtection` em `lib/security.ts`).
4. **Precisão Matemática:** Manter exatidão centesimal em todos os cálculos financeiros e taxas de parcelamento.
