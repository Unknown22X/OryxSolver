import posthog from 'posthog-js';

/**
 * Track an event with optional properties.
 * Use this for any significant user action (cta_clicks, page_views, etc.)
 */
export function trackEvent(name: string, properties?: Record<string, any>) {
  try {
    posthog.capture(name, properties);
  } catch (err) {
    console.warn(`[Analytics] Failed to track event ${name}:`, err);
  }
}

/**
 * Identify the user once they log in. 
 * This links their anonymous session history to their actual account ID.
 */
export function identifyUser(userId: string, traits?: Record<string, any>) {
  try {
    posthog.identify(userId, traits);
  } catch (err) {
    console.warn(`[Analytics] Failed to identify user ${userId}:`, err);
  }
}

/**
 * Call this when a user logs out to clear session data.
 */
export function resetAnalytics() {
  try {
    posthog.reset();
  } catch (err) {
    console.warn('[Analytics] Failed to reset analytics:', err);
  }
}

/**
 * Export the posthog instance for advanced use cases.
 */
export { posthog as analyticsClient };
