'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { NotificationItem } from '@/types';
import { NotificationService } from '@/services/notifications.service';
import { Bell, ExternalLink, ShieldAlert, Sparkles, CheckCircle2, Inbox } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const items = await NotificationService.getNotifications();
      setNotifications(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refresh();
      const unsub = NotificationService.subscribe(() => {
        void refresh();
      });
      return () => {
        try { unsub(); } catch { /* */ }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const markAllRead = async () => {
    await NotificationService.markAllAsRead();
    await refresh();
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'CAMPUS_ALERT':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'AI_NOTE':
        return <Sparkles className="w-4 h-4 text-ai-600" />;
      case 'RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Bell className="w-4 h-4 text-maroon-700" />;
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg border border-warm-300 shadow-xl z-50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-3 bg-warm-100 border-b border-warm-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-maroon-800" />
          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Campus Dispatch Notifications
          </h4>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="text-[11px] text-maroon-800 hover:text-maroon-950 font-medium hover:underline cursor-pointer"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-warm-200">
        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-muted">Loading…</div>
        ) : notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 text-xs transition-colors hover:bg-warm-50 ${
                !n.read ? 'bg-maroon-50/30' : ''
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
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-xs text-ink-muted flex flex-col items-center gap-2">
            <Inbox className="w-5 h-5 text-ink-muted" />
            <span>No notifications right now.</span>
          </div>
        )}
      </div>

      <div className="p-2 bg-warm-50 border-t border-warm-200 text-center">
        <span className="text-[10px] text-ink-muted">Malda College Automated Operations Broadcast</span>
      </div>
    </div>
  );
};
