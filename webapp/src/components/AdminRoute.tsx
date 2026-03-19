import { Navigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useProfile } from '../hooks/useProfile';

function AdminRouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-[0.2em]" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

export default function AdminRoute({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  const { profile, loading } = useProfile(user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <AdminRouteLoader />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
