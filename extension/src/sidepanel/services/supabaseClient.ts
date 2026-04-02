import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authStorageKey = 'oryx-extension-supabase-auth';

const extensionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(key);
        const value = result?.[key];
        return typeof value === 'string' ? value : null;
      }
    } catch (error) {
      console.warn('Failed to read extension auth storage from chrome.storage.local:', error);
    }

    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: value });
        return;
      }
    } catch (error) {
      console.warn('Failed to write extension auth storage to chrome.storage.local:', error);
    }

    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore local fallback failures.
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(key);
        return;
      }
    } catch (error) {
      console.warn('Failed to remove extension auth storage from chrome.storage.local:', error);
    }

    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore local fallback failures.
    }
  },
};

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: extensionStorage,
          storageKey: authStorageKey,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;
