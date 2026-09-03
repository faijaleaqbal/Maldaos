import { NotificationItem } from '@/types';
import { MOCK_NOTIFICATIONS } from './mockData';

const NOTIF_STORAGE_KEY = 'campuspulse_notifications_v1';

export const NotificationService = {
  getNotifications(): NotificationItem[] {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // fallback
        }
      }
    }
    return MOCK_NOTIFICATIONS;
  },

  saveNotifications(items: NotificationItem[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(items));
    }
  },

  markAsRead(id: string): NotificationItem[] {
    const list = this.getNotifications();
    const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
    this.saveNotifications(updated);
    return updated;
  },

  markAllAsRead(): NotificationItem[] {
    const list = this.getNotifications();
    const updated = list.map((n) => ({ ...n, read: true }));
    this.saveNotifications(updated);
    return updated;
  },

  addNotification(item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): NotificationItem {
    const list = this.getNotifications();
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
