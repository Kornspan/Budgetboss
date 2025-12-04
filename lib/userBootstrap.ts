import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

function deriveDisplayName(user: User): string {
  if (user.user_metadata?.full_name) return user.user_metadata.full_name as string;
  if (user.email) {
    const [name] = user.email.split('@');
    if (name) return name;
  }
  return 'User';
}

async function ensureProfile(user: User) {
  const { data, error } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (error) {
    throw error;
  }
  if (data) return;

  const { error: insertError } = await supabase.from('profiles').insert({
    id: user.id,
    display_name: deriveDisplayName(user),
    email: user.email,
  });

  if (insertError) {
    throw insertError;
  }
}

async function ensureAppSettings(user: User) {
  const { data, error } = await supabase.from('app_settings').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) {
    throw error;
  }
  if (data) return;

  const { error: insertError } = await supabase.from('app_settings').insert({
    user_id: user.id,
    theme_preference: 'system',
    notifications_enabled: true,
    ai_personality: 'friendly',
    ai_search_grounding_enabled: true,
    prototype_mode: true,
  });
  if (insertError) {
    throw insertError;
  }
}

export async function ensureUserProfileAndSettings(user: User): Promise<void> {
  try {
    await ensureProfile(user);
    await ensureAppSettings(user);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[userBootstrap] Failed to ensure profile/settings', error);
    }
    throw error;
  }
}
