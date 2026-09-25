import { useEffect, useCallback, useState } from 'react';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, relativeTime } from '../utils';
import type { Workspace, Notification } from '../types';

interface Props {
  workspace: Workspace;
  onRead: () => void;
}

export function NotificationsView({ workspace, onRead }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Notification[]>(`/notifications?workspace_id=${workspace.id}`);
      setNotifications(data);
    } catch { toast.error('Failed to load activity'); }
    finally { setLoading(false); }
  }, [workspace.id]);

  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => { void load(); }, [load]);
  /* oxlint-enable react/set-state-in-effect */

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch('/notifications/mark-all-read', {
        method: 'PATCH',
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      await load(); onRead();
    } catch { toast.error('Failed to mark read'); }
    finally { setMarkingAll(false); }
  };

  const unread = notifications.filter(n => !n.read);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display text-2xl font-semibold text-[var(--ink)] tracking-tight">Activity</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Proposal updates, executed payments, system events</p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => { void markAllRead(); }} disabled={markingAll} className="btn-secondary flex items-center gap-2 text-sm">
            {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={14} />}
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[var(--muted)]" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
          <Bell size={28} className="text-[var(--subtle)] mx-auto mb-3" />
          <p className="font-medium text-[var(--ink)]">No activity yet</p>
          <p className="text-sm text-[var(--muted)] mt-1">Events from proposals, schedules, and payments will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 rounded-xl transition-colors ${n.read ? 'bg-transparent' : 'bg-[var(--surface)] border border-[var(--border)]'}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-[var(--border)]' : 'bg-[var(--accent)]'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.read ? 'text-[var(--muted)]' : 'font-medium text-[var(--ink)]'}`}>{n.title}</p>
                {n.body && <p className="text-xs text-[var(--muted)] mt-0.5 text-pretty">{n.body}</p>}
              </div>
              <p className="text-xs text-[var(--subtle)] flex-shrink-0">{relativeTime(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
