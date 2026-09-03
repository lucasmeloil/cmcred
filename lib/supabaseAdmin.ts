import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    storageKey: 'cmcred_service_worker_auth',
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn()
  }
});

