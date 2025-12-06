export const frontendEnv = (() => {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL. Set it in your environment (e.g., Vercel project env vars).');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY. Set it in your environment (e.g., Vercel project env vars).');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
})();
