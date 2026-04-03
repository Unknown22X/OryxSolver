import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edge';
import type { User, Session } from '@supabase/supabase-js';
import { applyServiceHealthError, canPerformDependencyAction } from '../lib/serviceHealth';
import { getSessionWithRetry, signOutWithRetry, toSafeSupabaseError, updateUserWithRetry, withSupabaseAuthRetry } from '../lib/supabaseAuth';

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
        const { data: { session } } = await getSessionWithRetry({
          fallbackMessage: 'Authentication is temporarily unavailable. Please try again shortly.',
        });
        setState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      } catch (err) {
        const safeError = toSafeSupabaseError(err, 'Authentication is temporarily unavailable. Please try again shortly.');
        setState(prev => ({ ...prev, loading: false, error: safeError.message }));
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
    if (!canPerformDependencyAction('auth')) {
      const error = new Error('Authentication is temporarily unavailable. Please try again shortly.');
      applyServiceHealthError(error, 'auth');
      throw error;
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await withSupabaseAuthRetry(
        'signInWithPassword',
        () => supabase.auth.signInWithPassword({ email, password }),
        { fallbackMessage: 'Authentication is temporarily unavailable. Please try again shortly.' },
      );
      if (error) throw error;
    } catch (err) {
      const safeError = toSafeSupabaseError(err, 'Authentication is temporarily unavailable. Please try again shortly.');
      setState(prev => ({ ...prev, loading: false, error: safeError.message }));
      throw safeError;
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    options?: { legalMetadata?: Record<string, unknown> },
  ) => {
    if (!canPerformDependencyAction('auth')) {
      const error = new Error('Authentication is temporarily unavailable. Please try again shortly.');
      applyServiceHealthError(error, 'auth');
      throw error;
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await withSupabaseAuthRetry(
        'signUp',
        () =>
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/onboarding`,
              ...(options?.legalMetadata ? { data: options.legalMetadata } : {}),
            },
          }),
        { fallbackMessage: 'Authentication is temporarily unavailable. Please try again shortly.' },
      );
      if (error) throw error;
    } catch (err) {
      const safeError = toSafeSupabaseError(err, 'Authentication is temporarily unavailable. Please try again shortly.');
      setState(prev => ({ ...prev, loading: false, error: safeError.message }));
      throw safeError;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!canPerformDependencyAction('auth')) {
      const error = new Error('Authentication is temporarily unavailable. Please try again shortly.');
      applyServiceHealthError(error, 'auth');
      throw error;
    }
    setState(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await signOutWithRetry({
        fallbackMessage: 'Authentication is temporarily unavailable. Please try again shortly.',
      });
      if (error) throw error;
      setState({ user: null, session: null, loading: false, error: null });
    } catch (err) {
      const safeError = toSafeSupabaseError(err, 'Authentication is temporarily unavailable. Please try again shortly.');
      setState(prev => ({ ...prev, loading: false, error: safeError.message }));
      throw safeError;
    }
  }, []);

  const updateProfile = useCallback(async (data: { displayName?: string; photoURL?: string }) => {
    if (!state.user) throw new Error('No user logged in');
    if (!canPerformDependencyAction('auth')) {
      const error = new Error('Profile updates are temporarily unavailable. Please try again shortly.');
      applyServiceHealthError(error, 'auth');
      throw error;
    }
    
    const { error } = await updateUserWithRetry(
      {
        data,
      },
      { fallbackMessage: 'Profile updates are temporarily unavailable. Please try again shortly.' },
    );
    
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
