/**
 * Notifications service — Production
 *
 * Reads notifications from the real `public.notifications` table via
 * Supabase. Marks read with the `read_notification()` SECURITY DEFINER
 * RPC. NEVER falls back to localStorage or mock data when Supabase is
 * configured.
 */
import { NotificationItem } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

// The DB enum (issue_status.notification_type) is the authoritative
// source; we re-map to the UI's NotificationItem['type'] below.
type DbType = 'ISSUE_ASSIGNED' | 'STATUS_CHANGED' | 'COMMENT_ADDED' | 'RESOLVED' | 'REOPENED' | 'GENERAL';

interface DbNotification {
  id: string;
  user_id: string;
  issue_id: string | null;
  type: DbType;
  payload: any;
  read_at: string | null;
  created_at: string;
}

function dbToUI(row: DbNotification): NotificationItem {
  const p = (row.payload ?? {}) as Record<string, any>;
  const byName = p.by as string | undefined;
  const statusLabel = (p.status as string | undefined)?.replace('_', ' ');
  const type: NotificationItem['type'] =
    row.type === 'RESOLVED' ? 'RESOLVED' :
    row.type === 'ISSUE_ASSIGNED' ? 'ASSIGNED' :
    row.type === 'STATUS_CHANGED' ? 'STATUS_CHANGE' :
    row.type === 'COMMENT_ADDED' ? 'CAMPUS_ALERT' :
    'CAMPUS_ALERT';

  return {
    id: row.id,
    userId: row.user_id,
    title: titleFor(row.type),
    message: statusLabel
      ? `Status updated to ${statusLabel}${byName ? ` by ${byName}` : ''}`
      : type === 'CAMPUS_ALERT'
        ? `${byName ?? 'Someone'} added a comment`
        : `Department ${p.department_id ?? ''} has been notified`,
    ticketNumber: p.ticket_number,
    ticketId: row.issue_id ?? undefined,
    type,
    read: !!row.read_at,
    createdAt: row.created_at,
  };
}

function titleFor(t: DbType): string {
  switch (t) {
    case 'ISSUE_ASSIGNED': return 'Ticket assigned';
    case 'STATUS_CHANGED': return 'Status changed';
    case 'COMMENT_ADDED': return 'New comment';
    case 'RESOLVED': return 'Ticket resolved';
    case 'REOPENED': return 'Ticket reopened';
    case 'GENERAL': return 'Notification';
  }
}

export const NotificationService = {
  /**
   * Fetch notifications for the current user. The server-side RLS
   * policy ensures only the user's own notifications are visible.
   */
  async getNotifications(): Promise<NotificationItem[]> {
    if (!isSupabaseConfigured()) return [];
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, issue_id, type, payload, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error || !data) return [];
      return (data as unknown as DbNotification[]).map(dbToUI);
    } catch {
      return [];
    }
  },

  async markAsRead(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.rpc('read_notification', { p_notification_id: id });
    } catch {
      // best effort
    }
  },

  async markAllAsRead(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      // RPC `read_notification` is per-row; do a bulk update via
      // authenticated client (RLS will scope to the current user).
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .eq('user_id', uid);
    } catch {
      // best effort
    }
  },

  /**
   * Subscribe to live notification changes for the current user.
   * Returns an unsubscribe function.
   */
  subscribe(onChange: () => void): () => void {
    if (!isSupabaseConfigured()) return () => {};
    const supabase = getSupabaseClient();
    if (!supabase) return () => {};
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          () => onChange(),
        )
        .subscribe();
    } catch {
      return () => {};
    }
    return () => {
      try { if (channel) supabase.removeChannel(channel); } catch { /* */ }
    };
  },
};
