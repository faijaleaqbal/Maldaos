'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { RoleSwitcherModal } from './RoleSwitcherModal';
import { NotificationDropdown } from './NotificationDropdown';
import { isDevSeedLoginAvailable } from '@/services/devSeedAccounts';
import {
  Bell,
  PlusCircle,
  ShieldCheck,
  User,
  Users,
  Compass,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, role, isAdmin } = useAuth();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isCurrent = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white border-b border-warm-300">
        {/* Top Institutional Identity Banner */}
        <div className="bg-maroon-900 text-white text-[11px] px-4 py-1 flex items-center justify-between border-b border-maroon-800">
          <div className="flex items-center gap-2">
            <span className="font-serif tracking-wider font-semibold text-gold-300">
              MALDA COLLEGE
            </span>
            <span className="text-white/70">• Estd. 1944 • NAAC 'A' Grade • West Bengal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-white/75 font-mono text-[10px] uppercase tracking-wider">
              MaldaOS • Campus Incident Desk
            </span>
            {isDevSeedLoginAvailable() && (
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(true)}
                className="bg-gold-500 text-maroon-950 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-gold-400 transition-all cursor-pointer flex items-center gap-1 shadow-xs active:translate-y-0.5"
              >
                <Users className="w-3 h-3" />
                <span>Persona: {user.name.split(' ')[0]} ({role})</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Application Navigation Bar */}
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo / Seal */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded bg-maroon-700 border border-maroon-900 flex items-center justify-center text-gold-400 font-serif font-bold text-base sm:text-lg shadow-sm group-hover:bg-maroon-800 transition-colors">
                MC
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="font-serif font-bold text-base sm:text-lg text-maroon-950 tracking-tight leading-tight">
                    MaldaOS
                  </span>
                  <span className="text-[10px] font-mono font-semibold bg-warm-200 text-maroon-900 px-1.5 py-0.2 rounded border border-warm-300">
                    Estd. 1944
                  </span>
                </div>
                <span className="text-[10px] uppercase font-sans tracking-wider text-ink-muted hidden min-[360px]:inline">
                  Malda College Campus Desk
                </span>
              </div>
            </Link>

            {/* Admin or Student Mode Indicator */}
            {isAdmin && (
              <span className="hidden xl:inline-flex items-center gap-1 text-xs bg-maroon-50 text-maroon-900 border border-maroon-200 px-2.5 py-1 rounded font-medium ml-2">
                <ShieldCheck className="w-3.5 h-3.5 text-maroon-700" />
                Operations Staff Mode
              </span>
            )}
          </div>


          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs xl:text-sm font-medium">
            <Link
              href="/dashboard"
              className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors ${
                isCurrent('/dashboard')
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/issues"
              className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors ${
                pathname === '/issues'
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              Campus Issues
            </Link>

            <Link
              href="/report"
              className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                isCurrent('/report')
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-maroon-700" />
              <span>Report Issue</span>
            </Link>

            <Link
              href={isAdmin ? "/admin/map" : "/map"}
              className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                pathname === '/map' || pathname === '/admin/map'
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              <Compass className="w-4 h-4 text-maroon-700" />
              <span>Campus Map</span>
            </Link>

            {/* Admin Command Center Link */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/admin') && pathname !== '/admin/map'
                    ? 'bg-maroon-900 text-white font-semibold'
                    : 'text-maroon-800 hover:bg-maroon-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Command Center</span>
              </Link>
            )}
          </nav>

          {/* Right Action Controls: Notification, Report CTA, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Primary Report CTA on Desktop */}
            <Link href="/report" className="hidden lg:inline-block">
              <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
                Report Issue
              </Button>
            </Link>

            {/* Notifications Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label={`View Notifications (${unreadCount} unread)`}
                aria-expanded={isNotifOpen}
                aria-haspopup="dialog"
                className="w-10 h-10 sm:w-9 sm:h-9 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] rounded-md border border-warm-300 bg-white hover:bg-warm-100 flex items-center justify-center text-ink cursor-pointer relative touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none shadow-xs active:translate-y-0.5 active:scale-95 transition-all"
                title="View Notifications"
              >
                <Bell className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-white" aria-hidden="true" />
                )}
              </button>
              <NotificationDropdown
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                onUnreadCountChange={setUnreadCount}
              />
            </div>

            {/* Profile Link / Avatar */}
            <Link
              href="/profile"
              className="flex items-center justify-center min-w-[44px] min-h-[44px] p-1 rounded-md hover:bg-warm-100 transition-colors touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none"
              title="Student Profile"
              aria-label={`User profile for ${user.name}`}
            >
              <div className="w-8 h-8 rounded-full bg-maroon-100 border border-maroon-300 flex items-center justify-center text-maroon-900 font-semibold text-xs overflow-hidden">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span aria-hidden="true">{user.name.charAt(0)}</span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Role Switcher Modal */}
      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />
    </>
  );
};
