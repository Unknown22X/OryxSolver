const cfg = window.__AUTH0_CONFIG;
const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("login");
const signupBtn = document.getElementById("signup");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function createAuth0ClientSafe() {
  if (!cfg?.domain || !cfg?.clientId || cfg.domain === "YOUR_AUTH0_DOMAIN") {
    throw new Error("Auth0 config missing. Update auth-webapp/config.js");
  }

  const redirectUri = `${window.location.origin}/callback.html`;
  return window.auth0.createAuth0Client({
    domain: cfg.domain,
    clientId: cfg.clientId,
    authorizationParams: {
      redirect_uri: redirectUri,
      ...(cfg.audience ? { audience: cfg.audience } : {}),
    },
    cacheLocation: "localstorage",
    useRefreshTokens: true,
  });
}

async function beginAuth(mode) {
  const client = await createAuth0ClientSafe();
  const extensionId = getQueryParam("ext_id") || "";
  const returnPath = getQueryParam("return_path") || "/src/sidepanel/index.html";

  setStatus("Redirecting to Auth0...");
  await client.loginWithRedirect({
    authorizationParams: {
      screen_hint: mode === "signup" ? "signup" : "login",
    },
    appState: {
      extensionId,
      returnPath,
    },
  });
}

loginBtn?.addEventListener("click", () => {
  void beginAuth("login").catch((err) => setStatus(err.message));
});

signupBtn?.addEventListener("click", () => {
  void beginAuth("signup").catch((err) => setStatus(err.message));
});

const mode = getQueryParam("mode");
if (mode === "login" || mode === "signup") {
  void beginAuth(mode).catch((err) => setStatus(err.message));
}
