# Auth0 Hosted Auth Webapp (for Extension)

This folder contains a minimal hosted Auth0 flow that can hand auth results back to the extension.

## Files
- `index.html`: marketing landing page
- `pricing.html`: pricing page
- `auth.html`: sign-in / sign-up entry
- `callback.html`: Auth0 redirect handler
- `upgrade.html`: prototype pricing/upgrade page
- `payment.html`: prototype payment page
- `main.js`: starts login/signup redirect
- `callback.js`: gets token/user and redirects back to extension URL
- `payment.js`: mock checkout submit flow
- `config.js`: Auth0 client config (edit this)

## 1) Configure Auth0 (localhost)
In Auth0 Application settings:

- Allowed Callback URLs:
  - `http://localhost:3000/callback.html`
- Allowed Logout URLs:
  - `http://localhost:3000/`
- Allowed Web Origins:
  - `http://localhost:3000`

## 2) Configure this app
Edit `config.js`:
```js
window.__AUTH0_CONFIG = {
  domain: "YOUR_AUTH0_DOMAIN",
  clientId: "YOUR_AUTH0_CLIENT_ID",
  audience: "", // optional
};
```

## 3) Run locally
Serve `auth-webapp/` on port 3000.

Example:
```powershell
cd auth-webapp
python -m http.server 3000
```

## 4) Open from extension
Open hosted page with query params:
```txt
http://localhost:3000/auth.html?ext_id=YOUR_EXTENSION_ID&return_path=/src/sidepanel/index.html
```

Prototype upgrade/payment pages:
```txt
http://localhost:3000/
http://localhost:3000/pricing.html
http://localhost:3000/upgrade.html
http://localhost:3000/payment.html
```

After successful auth, callback redirects to:
```txt
chrome-extension://YOUR_EXTENSION_ID/src/sidepanel/index.html#auth0_payload=...
```

## 5) Extension side (next step)
In sidepanel, parse `location.hash` for `auth0_payload`, store token/user, then clear hash.

## Security notes
- Do not trust client-only state; backend must validate bearer tokens.
- Consider replacing hash payload handoff with a short-lived code exchange endpoint for production hardening.
- `payment.html` is intentionally a prototype UI only; replace with a real checkout provider (Polar/Stripe).
