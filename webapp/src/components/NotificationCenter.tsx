import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, BellRing, Check, Info, AlertTriangle, PartyPopper, Trash2, Loader2, ExternalLink, Zap } from 'lucide-react';

interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'promo';
  link: string | null;
  is_read: boolean;
  created_at: string;
  dismissed_notifications?: { user_id: string }[];
}

export default function NotificationCenter({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch notifications that are NOT dismissed by this user
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          dismissed_notifications!left (user_id)
        `)
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filter out notifications where dismissed_notifications has an entry for THIS user
      // Note: Because of RLS on dismissed_notifications, a left join will only return
      // entries for the current user anyway.
      const filtered = (data || []).filter(n => 
        !n.dismissed_notifications || n.dismissed_notifications.length === 0
      );

      setNotifications(filtered);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }

  async function deleteNotification(id: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const target = notifications.find(n => n.id === id);
      if (!target) return;

      // Optimistically remove from UI
      setNotifications(prev => prev.filter(n => n.id !== id));

      if (target.user_id) {
        // Private notification - truly delete from DB
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', id);
        if (error) {
          // Revert on error
          loadNotifications();
          throw error;
        }
      } else {
        // Global notification - add to dismissed_notifications
        const { error } = await supabase
          .from('dismissed_notifications')
          .insert({ user_id: user.id, notification_id: id });
        if (error) {
          // Revert on error
          loadNotifications();
          throw error;
        }
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
      case 'success': return <PartyPopper size={14} className="text-emerald-500" />;
      case 'promo': return <Zap size={14} className="text-indigo-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          isOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
        }`}
      >
        {unreadCount > 0 ? (
          <>
            <BellRing size={20} className="animate-wiggle" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        ) : (
          <Bell size={20} />
        )}
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-3 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 ${
          align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
        }`}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 text-[10px] font-black">{unreadCount} unread</span>}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-500 transition-colors uppercase tracking-widest"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 size={24} className="animate-spin text-indigo-500 mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10 text-center">
                <Bell size={32} className="text-slate-200 dark:text-zinc-800 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">All caught up!</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">No notifications to show right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-5 transition-all group relative border-l-[6px] ${
                      n.is_read 
                        ? 'bg-white dark:bg-zinc-900 border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/40' 
                        : 'bg-indigo-50/60 dark:bg-indigo-500/[0.08] border-indigo-600 hover:bg-indigo-100/60 dark:hover:bg-indigo-500/15'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-md ${
                        n.type === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500' :
                        n.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-500' :
                        n.type === 'promo' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' :
                        'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      }`}>
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-[15px] font-black leading-tight ${
                            n.is_read ? 'text-slate-600 dark:text-zinc-400' : 'text-slate-950 dark:text-zinc-50'
                          }`}>
                            {n.title}
                          </p>
                          <span className={`text-[11px] font-black whitespace-nowrap pt-1 ${
                            n.is_read ? 'text-slate-500 dark:text-zinc-500' : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className={`text-sm mt-1.5 leading-relaxed ${
                          n.is_read ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-800 dark:text-zinc-200 font-medium'
                        }`}>
                          {n.message}
                        </p>
                        {n.link && (
                          <a
                            href={n.link}
                            className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-500 transition-all px-3 py-1.5 rounded-lg shadow-md hover:shadow-indigo-500/20 uppercase tracking-widest"
                          >
                            View Details <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions overlay on hover */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      {!n.is_read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors shadow-xl"
                          title="Mark as read"
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shadow-xl"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-center">
            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">
              End of notifications
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Add CSS animation for bell
const style = document.createElement('style');
style.textContent = `
  @keyframes wiggle {
    0%, 100% { transform: rotate(0deg); }
    10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
    20%, 40%, 60%, 80% { transform: rotate(10deg); }
  }
  .animate-wiggle {
    animation: wiggle 2s ease-in-out infinite;
  }
`;
document.head.appendChild(style);
