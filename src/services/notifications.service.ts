import { getSupabaseClient, isMockModeEnabled, requireSupabaseClient, toBackendError } from '@/lib/supabase';
import { mapNotificationRow, NotificationRow } from '@/lib/backendTypes';
import { NotificationItem } from '@/types';

const NOTIF_STORAGE_KEY = 'campuspulse_notifications_v1';

export const NotificationService = {
  /**
   * MOCK MODE: localStorage demo notifications.
   * LIVE MODE: the user's real notification rows from the DB (RLS-scoped to
   * user_id = auth.uid()). Throws typed errors — never falls back to mock.
   */
  async getNotifications(): Promise<NotificationItem[]> {
    if (isMockModeEnabled()) {
      return this.getMockNotifications();
    }

    const supabase = requireSupabaseClient();

    // Notifications + the referenced issue (title) in one query.
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id, user_id, issue_id, type, payload, read_at, created_at,
        issues:issue_id(id, title, created_at)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('getNotifications failed:', error);
      throw toBackendError(error, 'NOTIFICATIONS_FETCH_FAILED');
    }

    const rows = (data || []) as unknown as (NotificationRow & {
      issues?: { id: string; title: string; created_at: string } | null;
    })[];

    return rows.map((row) => mapNotificationRow(row, row.issues?.title));
  },

  /** Synchronous legacy accessor (mock mode or cached) for existing callers. */
  getMockNotifications(): NotificationItem[] {
    if (process.env.NODE_ENV === 'production') return [];
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (storage) {
      const stored = storage.getItem(NOTIF_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // fallback below
        }
      }
    }
    try {
      // Dynamic require in dev only — dead-code eliminated in production builds
      const { MOCK_NOTIFICATIONS } = require('./mockData');
      return MOCK_NOTIFICATIONS || [];
    } catch {
      return [];
    }
  },

  saveNotifications(items: NotificationItem[]): void {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (storage) {
      storage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(items));
    }
  },

  /** LIVE: read_notification RPC (own only). MOCK: local mark. */
  async markAsRead(id: string): Promise<NotificationItem[]> {
    if (isMockModeEnabled()) {
      const list = this.getMockNotifications();
      const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
      this.saveNotifications(updated);
      return updated;
    }

    const supabase = requireSupabaseClient();
    const { error } = await supabase.rpc('read_notification', {
      p_notification_id: id,
    });
    if (error) {
      console.error('read_notification failed:', error);
      throw toBackendError(error, 'NOTIFICATION_READ_FAILED');
    }
    return this.getNotifications();
  },

  async markAllAsRead(): Promise<NotificationItem[]> {
    if (isMockModeEnabled()) {
      const list = this.getMockNotifications();
      const updated = list.map((n) => ({ ...n, read: true }));
      this.saveNotifications(updated);
      return updated;
    }

    const supabase = requireSupabaseClient();
    const rows = await this.getNotifications();
    const unread = rows.filter((n) => !n.read);
    for (const n of unread) {
      const { error } = await supabase.rpc('read_notification', {
        p_notification_id: n.id,
      });
      if (error) {
        console.error('read_notification (markAll) failed:', error);
        throw toBackendError(error, 'NOTIFICATION_READ_FAILED');
      }
    }
    return this.getNotifications();
  },

  /** MOCK MODE ONLY: local demo notification. Live notifications are created
   *  by the backend's notify_user() RPC helper — the browser never writes them. */
  addNotification(item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): NotificationItem | null {
    if (!isMockModeEnabled()) {
      // Live: notifications are generated strictly server-side by RPCs/triggers;
      // the client never fabricates synthetic notification records.
      return null;
    }
    const list = this.getMockNotifications();
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const updated = [newItem, ...list];
    this.saveNotifications(updated);
    return newItem;
  },
};
