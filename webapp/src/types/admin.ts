export type AdminRole = 'admin' | 'support' | 'read-only' | 'authenticated' | 'pending';

export interface TrendPoint {
  date: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsersToday: number;
  activeUsers7d: number;
  activeUsers30d: number;
  proUsers: number;
  premiumUsers: number;
  creditsToday: { free: number; paid: number; total: number };
  creditsMonth: { free: number; paid: number; total: number };
  errorRate: number;
  failedCount: number;
  totalToday: number;
  totalRemainingCredits: number;
  trends: {
    solvesPerDay: TrendPoint[];
    usersPerDay: TrendPoint[];
  };
  modelUsage: { model: string; count: number; percentage: number }[];
  errorLogs: { created_at: string; error_code: string; model: string }[];
}

export interface UserSubscription {
  tier: string | null;
  status: string;
}

export interface UserCreditWallet {
  granted_credits: number;
  used_credits: number;
}

export interface UserProfile {
  id: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  role: AdminRole;
  is_locked: boolean;
  created_at: string;
  subscriptions: UserSubscription[] | null;
  credit_wallets: UserCreditWallet[] | null;
}

/** A row from solve_runs — only real columns */
export interface HistoryEntry {
  id: string;
  created_at: string;
  auth_user_id: string;
  status: string;
  error_code: string | null;
  model: string | null;
  mode: string | null;
  style_mode: string | null;
  latency_ms: number | null;
  used_fallback: boolean;
  /** Joined from profiles via auth_user_id — may not always be present */
  profiles?: {
    email: string | null;
    display_name: string | null;
  } | null;
}

export interface AuditLog {
  id: string;
  admin_uid: string;
  admin_role: AdminRole;
  action_type: string;
  target_user_id: string | null;
  payload_before: Record<string, unknown>;
  payload_after: Record<string, unknown>;
  reason: string | null;
  created_at: string;
}

export interface FeedbackEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  conversation_id: string | null;
  rating: number | null;
  comment: string | null;
  metadata: Record<string, unknown>;
  profiles?: {
    email: string | null;
    display_name: string | null;
  } | null;
}

export interface AdminConfigResponse {
  api_version: string;
  ok: boolean;
  rows: {
    key: string;
    value: unknown;
  }[];
}
