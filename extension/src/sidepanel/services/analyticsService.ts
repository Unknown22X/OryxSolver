import { getAccessToken } from '../auth/supabaseAuthClient';

export type AnalyticsEvent = 
  | 'app_opened'
  | 'solve_started'
  | 'solve_completed'
  | 'solve_failed'
  | 'screen_capture_started'
  | 'screen_capture_completed'
  | 'upgrade_modal_opened'
  | 'upgrade_link_clicked'
  | 'settings_opened'
  | 'history_opened';

class AnalyticsService {
  private isEnabled(): boolean {
    return localStorage.getItem('oryx_analytics') !== 'false';
  }

  async track(eventName: AnalyticsEvent, properties: Record<string, any> = {}) {
    if (!this.isEnabled()) return;

    try {
      const token = await getAccessToken();
      if (!token) return;

      // We'll use a direct Supabase call via an Edge Function or just a standard Post
      // To keep it simple, we'll assume a generic endpoint exists or use the Supabase REST API directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) return;

      await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          event_name: eventName,
          properties: properties,
          platform: 'chrome_extension'
        })
      });
    } catch (error) {
      // Analytics should never crash the main app
      console.error('Analytics Error:', error);
    }
  }
}

export const analytics = new AnalyticsService();
