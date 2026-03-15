const cfg = window.__SUPABASE_CONFIG;
const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("login");
const signupBtn = document.getElementById("signup");
const googleBtn = document.getElementById("google-login");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function setStatus(text, isError = false) {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = isError ? "status error" : "status";
  }
}

// Initialize Supabase Client
const supabase = window.supabase.createClient(cfg.url, cfg.anonKey);

async function handleLogin() {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || !password) {
    setStatus("Please enter email and password.", true);
    return;
  }

  setStatus("Signing in...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setStatus(error.message, true);
  } else {
    setStatus("Sign in successful! Redirecting...");
    window.location.href = "./index.html";
  }
}

async function handleSignup() {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || !password) {
    setStatus("Please enter email and password.", true);
    return;
  }

  setStatus("Creating account...");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    setStatus(error.message, true);
  } else {
    setStatus("Account created! Check your email for verification.", false);
  }
}

async function handleGoogleLogin() {
  setStatus("Redirecting to Google...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/index.html`
    }
  });

  if (error) setStatus(error.message, true);
}

loginBtn?.addEventListener("click", handleLogin);
signupBtn?.addEventListener("click", handleSignup);
googleBtn?.addEventListener("click", handleGoogleLogin);

// Check if user is already logged in
async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    setStatus(`Logged in as ${user.email}`);
    if (loginBtn) loginBtn.disabled = true;
    if (signupBtn) signupBtn.disabled = true;
  }
}

checkUser();
