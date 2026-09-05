'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { NotificationItem } from '@/types';
import { NotificationService } from '@/services/notifications.service';
import { Bell, Check, ExternalLink, ShieldAlert, Activity, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

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

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const container = dropdownRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

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
        return <ShieldAlert className="w-4 h-4 text-rose-600" aria-hidden="true" />;
      case 'AI_NOTE':
        return <Activity className="w-4 h-4 text-maroon-700" aria-hidden="true" />;
      case 'RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />;
      case 'ISSUE_ASSIGNED':
      case 'ASSIGNED':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" aria-hidden="true" />;
      default:
        return <Bell className="w-4 h-4 text-maroon-700" aria-hidden="true" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Invisible fixed backdrop for dismissal */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dropdownRef}
        role="dialog"
        aria-label="Campus Dispatch Notifications"
        aria-modal="true"
        className="absolute right-0 mt-2 max-w-[calc(100vw-1.5rem)] w-80 sm:w-96 bg-white rounded-lg border border-warm-300 shadow-xl z-50 overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="p-3 bg-warm-100 border-b border-warm-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-maroon-800" aria-hidden="true" />
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
              className="text-[11px] text-maroon-800 hover:text-maroon-950 font-medium hover:underline cursor-pointer disabled:opacity-50 touch-manipulation min-h-[32px] px-2 py-1"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List Body */}
        <div className="max-h-80 overflow-y-auto divide-y divide-warm-200 min-h-[120px] flex flex-col justify-center">
          {loading && notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 text-maroon-700 animate-spin" aria-hidden="true" />
              <span>Fetching live notifications...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-rose-700 flex flex-col items-center gap-2" role="alert">
              <AlertCircle className="w-5 h-5 text-rose-600" aria-hidden="true" />
              <p className="max-w-[240px] leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={fetchNotifications}
                className="inline-flex items-center gap-1 text-[11px] text-maroon-800 hover:underline font-semibold mt-1 min-h-[36px] px-3 py-1.5"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-warm-200">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.title}: ${n.message}${!n.read ? ' (Unread)' : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (!n.read) handleMarkSingleRead(n.id);
                    }
                  }}
                  onClick={() => !n.read && handleMarkSingleRead(n.id)}
                  className={`p-3 text-xs transition-colors hover:bg-warm-50 cursor-pointer focus-visible:outline-none focus-visible:bg-warm-100 ${
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
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-maroon-700 shrink-0 mt-1.5" aria-hidden="true" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-ink-muted">
              <Bell className="w-6 h-6 text-warm-400 mx-auto mb-1.5 opacity-60" aria-hidden="true" />
              <span>No notifications right now.</span>
            </div>
          )}
        </div>

      <div className="p-2 bg-warm-50 border-t border-warm-200 text-center">
        <span className="text-[10px] text-ink-muted">Malda College Operations Dispatch</span>
      </div>
    </div>
    </>
  );
};
