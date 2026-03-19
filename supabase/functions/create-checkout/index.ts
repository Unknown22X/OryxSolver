import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';

const PLAN_VARIANTS: Record<string, string | undefined> = {
  pro: Deno.env.get('LEMON_SQUEEZY_VARIANT_PRO'),
  premium: Deno.env.get('LEMON_SQUEEZY_VARIANT_PREMIUM'),
  credits_10: Deno.env.get('LEMON_SQUEEZY_VARIANT_CREDITS_10'),
  credits_25: Deno.env.get('LEMON_SQUEEZY_VARIANT_CREDITS_25'),
  credits_75: Deno.env.get('LEMON_SQUEEZY_VARIANT_CREDITS_75'),
  credits_200: Deno.env.get('LEMON_SQUEEZY_VARIANT_CREDITS_200'),
  credits_500: Deno.env.get('LEMON_SQUEEZY_VARIANT_CREDITS_500'),
};

function normalizePlan(input: unknown): string {
  return String(input ?? '').trim().toLowerCase();
}

type CheckoutBody = {
  plan?: unknown;
};

function getCheckoutRedirectUrl(): string {
  const appUrl =
    Deno.env.get('WEBAPP_URL') ??
    Deno.env.get('VITE_WEBAPP_URL') ??
    'http://localhost:5173';
  return `${appUrl.replace(/\/$/, '')}/dashboard?checkout=success`;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/create-checkout', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  const apiKey = Deno.env.get('LEMON_SQUEEZY_API_KEY');
  const storeId = Deno.env.get('LEMON_SQUEEZY_STORE_ID');
  if (!apiKey || !storeId) {
    return jsonError(500, 'CONFIG_ERROR', 'Lemon Squeezy is not configured.');
  }

  try {
    const user = await verifySupabaseAccessToken(token);
    if (!user.emailVerified) {
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    const body = (await req.json().catch(() => ({}))) as CheckoutBody;
    const plan = normalizePlan(body?.plan);
    if (!plan || !PLAN_VARIANTS[plan]) {
      return jsonError(400, 'INVALID_PLAN', 'Invalid or unsupported plan.');
    }

    const variantId = PLAN_VARIANTS[plan];
    if (!variantId) {
      return jsonError(500, 'CONFIG_ERROR', `Variant ID missing for plan: ${plan}`);
    }

    const checkoutPayload = {
      data: {
        type: 'checkouts',
        attributes: {
          store_id: Number(storeId),
          variant_id: Number(variantId),
          checkout_data: {
            custom: {
              user_id: user.id,
              plan,
            },
            email: user.email ?? undefined,
          },
          product_options: {
            redirect_url: getCheckoutRedirectUrl(),
          },
        },
      },
    };

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[CHECKOUT] Lemon Squeezy error:', errorBody);
      return jsonError(502, 'CHECKOUT_FAILED', 'Checkout could not be created.');
    }

    const payload = await response.json();
    const checkoutUrl = payload?.data?.attributes?.url as string | undefined;
    if (!checkoutUrl) {
      return jsonError(502, 'CHECKOUT_FAILED', 'Checkout URL missing in response.');
    }

    return jsonOk({ api_version: 'v1', ok: true, checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return jsonError(500, 'CHECKOUT_FAILED', message);
  }
});
