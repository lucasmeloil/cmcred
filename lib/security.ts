import DOMPurify from 'dompurify';
import { useEffect, useRef } from 'react';

// =========================================================================
// 1. CONSTANTES E CONFIGURAÇÕES DE SEGURANÇA
// =========================================================================

export const SUPER_ADMIN_EMAIL = 'caique@cmcred.com.br';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos de bloqueio temporário após 5 falhas
export const SESSION_INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos de inatividade máxima

// =========================================================================
// 2. PROTEÇÃO CONTRA BRUTE FORCE & RATE LIMITING DE LOGIN
// =========================================================================

interface LoginAttemptRecord {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const STORAGE_KEY = 'cmcred_sec_login_attempts';

function getAttemptRecord(email: string): LoginAttemptRecord {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${email.toLowerCase()}`);
    if (!raw) return { count: 0, lastAttempt: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, lastAttempt: 0 };
  }
}

function saveAttemptRecord(email: string, record: LoginAttemptRecord) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${email.toLowerCase()}`, JSON.stringify(record));
  } catch (err) {
    console.warn('Falha ao registrar tentativa de login:', err);
  }
}

/**
 * Verifica se o e-mail está bloqueado por excesso de tentativas incorretas
 */
export function checkLoginRateLimit(email: string): { allowed: boolean; remainingSeconds: number; attemptsLeft: number } {
  const cleanEmail = email.trim().toLowerCase();
  const record = getAttemptRecord(cleanEmail);
  const now = Date.now();

  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSeconds, attemptsLeft: 0 };
  }

  // Se o tempo de bloqueio já expirou, reseta o contador
  if (record.lockedUntil && record.lockedUntil <= now) {
    record.count = 0;
    delete record.lockedUntil;
    saveAttemptRecord(cleanEmail, record);
  }

  const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - record.count);
  return { allowed: true, remainingSeconds: 0, attemptsLeft };
}

/**
 * Registra uma tentativa falha de login e aciona o bloqueio se atingir o limite
 */
export function recordFailedLogin(email: string): { locked: boolean; remainingSeconds: number } {
  const cleanEmail = email.trim().toLowerCase();
  const record = getAttemptRecord(cleanEmail);
  const now = Date.now();

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    saveAttemptRecord(cleanEmail, record);
    return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }

  saveAttemptRecord(cleanEmail, record);
  return { locked: false, remainingSeconds: 0 };
}

/**
 * Limpa o histórico de tentativas após login bem-sucedido
 */
export function clearLoginAttempts(email: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${email.trim().toLowerCase()}`);
  } catch {}
}

// =========================================================================
// 3. SANITIZAÇÃO DE ENTRADAS & PROTEÇÃO CONTRA XSS / SQL INJECTION
// =========================================================================

/**
 * Sanitiza textos simples de formulários contra tags perigosas e scripts
 */
export function sanitizeInput(text: string): string {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '') // Remove caracteres < e >
    .replace(/javascript:/gi, '') // Remove URIs javascript
    .replace(/onload|onerror|onclick|onmouseover/gi, '') // Remove manipuladores de evento inline
    .trim();
}

/**
 * Sanitiza conteúdo HTML para visualização segura em impressões e relatórios
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'div', 'span', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'ul', 'li', 'hr', 'img'],
    ALLOWED_ATTR: ['href', 'style', 'class', 'src', 'alt', 'width', 'height', 'target', 'rel']
  });
}

// =========================================================================
// 4. MASCARAMENTO DE DADOS FINANCEIROS SENSÍVEIS (LGPD & SIGILO BANCÁRIO)
// =========================================================================

/**
 * Mascara CPF para exibição segura (Ex: 123.***.***-00)
 */
export function maskCpf(cpf: string): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
}

/**
 * Mascara telefone (Ex: (79) 9****-7907)
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Mascara e-mail (Ex: c***e@cmcred.com.br)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

// =========================================================================
// 5. HOOK DE AUTO-LOGOUT POR INATIVIDADE DE SESSÃO
// =========================================================================

/**
 * Hook para deslogar automaticamente após período sem interação do usuário
 */
export function useInactivityTimeout(onTimeout: () => void, timeoutMs: number = SESSION_INACTIVITY_LIMIT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onTimeout();
      }, timeoutMs);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Inicia o timer
    resetTimer();

    // Adiciona ouvintes de atividade
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [onTimeout, timeoutMs]);
}

// =========================================================================
// 6. PROTEÇÃO CONTRA INSPEÇÃO DE CÓDIGO (F12, DEVTOOLS & EXTRAÇÃO INDEVIDA)
// =========================================================================

/**
 * Hook de proteção que bloqueia atalhos comuns de inspeção (F12, Ctrl+Shift+I, etc.)
 * e protege contra extração de código e dados financeiros sensíveis na tela
 */
export function useDevToolsProtection(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloqueia F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Bloqueia Ctrl+Shift+I (Inspecionar Elemento), Ctrl+Shift+J (Console), Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Bloqueia Ctrl+U (Ver Código-Fonte)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Bloqueia Ctrl+S (Salvar Página com dados)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled]);
}
