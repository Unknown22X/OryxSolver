import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export type AppProfile = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: 'pending' | 'authenticated' | 'read-only' | 'support' | 'admin' | null;
  createdAt: string;
};

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, auth_user_id, display_name, photo_url, role, created_at')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (!active) return;

        setProfile({
          id: data?.id ?? user.id,
          authUserId: data?.auth_user_id ?? user.id,
          email: user.email ?? '',
          displayName: data?.display_name ?? null,
          photoUrl: data?.photo_url ?? null,
          role: (data?.role as AppProfile['role']) ?? null,
          createdAt: data?.created_at ?? new Date().toISOString(),
        });
      } catch (error) {
        if (!active) return;
        console.error('Failed to load profile:', error);
        setProfile({
          id: user.id,
          authUserId: user.id,
          email: user.email ?? '',
          displayName: null,
          photoUrl: null,
          role: null,
          createdAt: new Date().toISOString(),
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    const handleWindowFocus = () => {
      void loadProfile();
    };
    const handleProfileUpdate = () => {
      void loadProfile();
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('oryx-profile-updated', handleProfileUpdate);
    return () => {
      active = false;
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('oryx-profile-updated', handleProfileUpdate);
    };
  }, [user]);

  return { profile, loading };
}
