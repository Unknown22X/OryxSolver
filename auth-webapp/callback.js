const cfg = window.__AUTH0_CONFIG;
const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function showDebug(data) {
  if (!debugEl) return;
  debugEl.classList.remove("hidden");
  debugEl.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
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

function toExtensionUrl(extensionId, returnPath, payload) {
  const encoded = encodeURIComponent(JSON.stringify(payload));
  return `chrome-extension://${extensionId}${returnPath}#auth0_payload=${encoded}`;
}

async function run() {
  try {
    const client = await createAuth0ClientSafe();
    const { appState } = await client.handleRedirectCallback();
    const token = await client.getTokenSilently();
    const user = await client.getUser();

    const extensionId = appState?.extensionId;
    const returnPath = appState?.returnPath || "/src/sidepanel/index.html";

    if (!extensionId) {
      setStatus("Signed in. Missing extension id for auto-return.");
      showDebug({ token, user });
      return;
    }

    setStatus("Signed in. Returning to extension...");
    const target = toExtensionUrl(extensionId, returnPath, {
      token,
      user,
      issuedAt: Date.now(),
    });
    window.location.assign(target);
  } catch (err) {
    setStatus("Auth callback failed.");
    showDebug(String(err?.message || err));
  }
}

void run();

