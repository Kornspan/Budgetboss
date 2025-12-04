import { createClient } from '@supabase/supabase-js';

/**
 * Minimal placeholder for the generated Database types. We'll swap this for the
 * Supabase type generator once the SQL schema is deployed and introspected.
 * Using `any` keeps the client flexible until we introspect the real schema.
 */
type Database = any;

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL. Add it to .env.local before using the Supabase client.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY. Add it to .env.local before using the Supabase client.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helpful hint during development: if this file loads without throwing, the env vars are present.
if (import.meta.env.DEV) {
  console.debug('[supabase] Client configured with provided VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.');
}
