import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { ensureUserProfileAndSettings } from '../lib/userBootstrap';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  userId: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error('Failed to load session', error);
        setSession(null);
      } else {
        setSession(data.session ?? null);
        if (import.meta.env.DEV) {
          console.debug('[auth] getSession resolved', data.session?.user?.id ?? null);
        }
        if (data.session?.user) {
          ensureUserProfileAndSettings(data.session.user).catch((bootstrapError) => {
            if (import.meta.env.DEV) {
              console.error('[auth] bootstrap failed (initial session)', bootstrapError);
            }
          });
        }
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (import.meta.env.DEV) {
        console.debug('[auth] auth state change', event, nextSession?.user?.id ?? null);
      }
      setSession(nextSession);
      if (nextSession?.user) {
        ensureUserProfileAndSettings(nextSession.user).catch((error) => {
          if (import.meta.env.DEV) {
            console.error('[auth] bootstrap failed', error);
          }
        });
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      throw error;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, userId, isLoading, signIn, signUp, signOut, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
