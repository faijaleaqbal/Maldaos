'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { NotificationItem } from '@/types';
import { NotificationService } from '@/services/notifications.service';
import { Bell, Check, ExternalLink, ShieldAlert, Sparkles, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await NotificationService.getNotifications();
      setNotifications(items);
      const unreadCount = items.filter((n) => !n.read).length;
      if (onUnreadCountChange) onUnreadCountChange(unreadCount);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err?.message || 'Failed to load notifications from server.');
      setNotifications([]);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  if (!isOpen) return null;

  const markAllRead = async () => {
    try {
      setLoading(true);
      const updated = await NotificationService.markAllAsRead();
      setNotifications(updated);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      const updated = await NotificationService.markAsRead(id);
      setNotifications(updated);
      const unreadCount = updated.filter((n) => !n.read).length;
      if (onUnreadCountChange) onUnreadCountChange(unreadCount);
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'CAMPUS_ALERT':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'AI_NOTE':
        return <Sparkles className="w-4 h-4 text-ai-600" />;
      case 'RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'ISSUE_ASSIGNED':
      case 'ASSIGNED':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-maroon-700" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg border border-warm-300 shadow-xl z-50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-3 bg-warm-100 border-b border-warm-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-maroon-800" />
          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Campus Dispatch Notifications
          </h4>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-mono font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={loading}
            className="text-[11px] text-maroon-800 hover:text-maroon-950 font-medium hover:underline cursor-pointer disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List Body */}
      <div className="max-h-80 overflow-y-auto divide-y divide-warm-200 min-h-[120px] flex flex-col justify-center">
        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-muted flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-maroon-700 animate-spin" />
            <span>Fetching live notifications...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-700 flex flex-col items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <p className="max-w-[240px] leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={fetchNotifications}
              className="inline-flex items-center gap-1 text-[11px] text-maroon-800 hover:underline font-semibold mt-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-warm-200">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkSingleRead(n.id)}
                className={`p-3 text-xs transition-colors hover:bg-warm-50 cursor-pointer ${
                  !n.read ? 'bg-maroon-50/40 font-medium' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-ink leading-tight">{n.title}</span>
                      <time className="text-[10px] text-ink-muted font-mono whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">{n.message}</p>
                    {n.ticketId && (
                      <Link
                        href={`/issues/${n.ticketId}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[11px] text-maroon-700 hover:text-maroon-900 font-semibold pt-0.5"
                      >
                        <span>View Ticket {n.ticketNumber}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-maroon-700 shrink-0 mt-1.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-ink-muted">
            <Bell className="w-6 h-6 text-warm-400 mx-auto mb-1.5 opacity-60" />
            <span>No notifications right now.</span>
          </div>
        )}
      </div>

      <div className="p-2 bg-warm-50 border-t border-warm-200 text-center">
        <span className="text-[10px] text-ink-muted">Malda College Operations Dispatch</span>
      </div>
    </div>
  );
};
