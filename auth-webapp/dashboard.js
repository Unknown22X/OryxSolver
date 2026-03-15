const cfg = window.__SUPABASE_CONFIG;
const statusEl = document.getElementById("status");
const gridEl = document.getElementById("stats-grid");
const errorEl = document.getElementById("admin-error");
const logoutBtn = document.getElementById("logout");

const supabase = window.supabase.createClient(cfg.url, cfg.anonKey);

async function loadDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    window.location.href = "./auth.html";
    return;
  }

  // Check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    statusEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    return;
  }

  statusEl.textContent = "Fetching metrics...";
  
  try {
    // 1. Total Solves (from analytics_events)
    const { count: totalSolves } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'solve_completed');

    // 2. Active Users (unique user_ids in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: activeUsersData } = await supabase
      .from('analytics_events')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    const uniqueUsers = new Set(activeUsersData?.map(e => e.user_id).filter(Boolean)).size;

    // 3. Capture Success Rate
    const { count: startedCaptures } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'screen_capture_started');
    
    const { count: completedCaptures } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'screen_capture_completed');
    
    const captureRate = startedCaptures ? Math.round((completedCaptures / startedCaptures) * 100) : 0;

    // 4. Conversion (Upgrade Modal -> Link Clicked)
    const { count: modalOpens } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'upgrade_modal_opened');
    
    const { count: linkClicks } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'upgrade_link_clicked');
    
    const conversionRate = modalOpens ? Math.round((linkClicks / modalOpens) * 100) : 0;

    // Update UI
    document.getElementById('total-solves').textContent = totalSolves || 0;
    document.getElementById('active-users').textContent = uniqueUsers || 0;
    document.getElementById('capture-rate').textContent = `${captureRate}%`;
    document.getElementById('conversion-rate').textContent = `${conversionRate}%`;

    statusEl.classList.add('hidden');
    gridEl.classList.remove('hidden');

  } catch (err) {
    statusEl.textContent = `Error loading metrics: ${err.message}`;
    statusEl.className = "status error";
  }
}

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "./auth.html";
});

loadDashboard();
