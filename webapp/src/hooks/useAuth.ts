import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edge';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    options?: {
      legalMetadata?: Record<string, unknown>;
    },
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      } catch (err) {
        setState(prev => ({ ...prev, loading: false, error: (err as Error).message }));
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: null,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    options?: { legalMetadata?: Record<string, unknown> },
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/how-it-works`,
          ...(options?.legalMetadata ? { data: options.legalMetadata } : {}),
        },
      });
      if (error) throw error;
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setState({ user: null, session: null, loading: false, error: null });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const updateProfile = useCallback(async (data: { displayName?: string; photoURL?: string }) => {
    if (!state.user) throw new Error('No user logged in');
    
    const { error } = await supabase.auth.updateUser({
      data,
    });
    
    if (error) throw error;

    try {
      await fetchEdge('/sync-profile', { method: 'POST' });
    } catch (syncError) {
      console.error('Profile sync after update failed:', syncError);
    }
    
    setState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...data } : null,
    }));
  }, [state.user]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };
}
