import { createClient } from '@supabase/supabase-js';
import { frontendEnv } from '../src/config/env';

/**
 * Minimal placeholder for the generated Database types. We'll swap this for the
 * Supabase type generator once the SQL schema is deployed and introspected.
 * Using `any` keeps the client flexible until we introspect the real schema.
 */
type Database = any;

export const supabase = createClient<Database>(frontendEnv.supabaseUrl, frontendEnv.supabaseAnonKey);

// Helpful hint during development: if this file loads without throwing, the env vars are present.
if (import.meta.env.DEV) {
  console.debug('[supabase] Client configured with provided VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.');
}
