import { getAccessToken, getCurrentUserId } from '../auth/supabaseAuthClient';
import { captureEvent } from './posthog';

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

    captureEvent(eventName, {
      ...properties,
      platform: 'chrome_extension',
    });

    // Fire and forget to not block UI or critical flows
    void (async () => {
      try {
        const token = await getAccessToken();
        const userId = await getCurrentUserId();
        if (!token || !userId) return;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) return;

        // Ensure URL is clean
        const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
        const fullUrl = `${baseUrl}/rest/v1/analytics_events`;

        const resp = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            user_id: userId,
            event_name: eventName,
            properties: properties,
            platform: 'chrome_extension'
          })
        });

        if (!resp.ok) {
          const body = await resp.text().catch(() => 'No body');
          console.warn(`[Analytics] POST failed (${resp.status}): ${body}`);
        }
      } catch (error) {
        // Silently log; analytics should never impact user experience
        console.warn(`[Analytics Service] Failed to track "${eventName}":`, error);
      }
    })();
  }
}

export const analytics = new AnalyticsService();
