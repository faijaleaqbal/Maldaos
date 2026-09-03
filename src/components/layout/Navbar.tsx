'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { RoleSwitcherModal } from './RoleSwitcherModal';
import { NotificationDropdown } from './NotificationDropdown';
import {
  Bell,
  PlusCircle,
  ShieldCheck,
  User,
  Users,
  Compass,
  FileSpreadsheet,
  Layers,
  Sparkles,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, role, isAdmin } = useAuth();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const isCurrent = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-warm-300">
        {/* Top Institutional Identity Banner */}
        <div className="bg-maroon-900 text-white text-[11px] px-4 py-1 flex items-center justify-between border-b border-gold-600/30">
          <div className="flex items-center gap-2">
            <span className="font-serif tracking-wider font-semibold text-gold-300">
              MALDA COLLEGE
            </span>
            <span className="text-white/60">• Estd. 1944 • NAAC Accredited 'A' Grade</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-white/70">
              Campus Operations & Incident Management
            </span>
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(true)}
              className="bg-gold-500 text-maroon-950 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-gold-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Users className="w-3 h-3" />
              <span>Persona: {user.name.split(' ')[0]} ({role})</span>
            </button>
          </div>
        </div>

        {/* Main Application Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo / Seal */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-md bg-maroon-700 border border-maroon-900 flex items-center justify-center text-gold-400 font-serif font-bold text-lg shadow-sm group-hover:bg-maroon-800 transition-colors">
                MC
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-lg text-maroon-950 tracking-tight leading-tight">
                    CampusPulse
                  </span>
                  <span className="text-[10px] font-mono font-semibold bg-gold-100 text-gold-900 px-1.5 py-0.2 rounded border border-gold-300">
                    2027
                  </span>
                </div>
                <span className="text-[10px] uppercase font-sans tracking-widest text-ink-muted">
                  Malda College Node
                </span>
              </div>
            </Link>

            {/* Admin or Student Mode Indicator */}
            {isAdmin && (
              <span className="hidden lg:inline-flex items-center gap-1 text-xs bg-maroon-50 text-maroon-900 border border-maroon-200 px-2.5 py-1 rounded font-medium ml-2">
                <ShieldCheck className="w-3.5 h-3.5 text-maroon-700" />
                Staff / Operations Mode
              </span>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isCurrent('/dashboard')
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/issues"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                pathname === '/issues'
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              Campus Issues
            </Link>

            <Link
              href="/report"
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                isCurrent('/report')
                  ? 'bg-maroon-50 text-maroon-900 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-maroon-700" />
              <span>Report Issue</span>
            </Link>

            <Link
              href="/admin/map"
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                pathname === '/admin/map'
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
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
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
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Primary Report CTA on Desktop */}
            <Link href="/report" className="hidden sm:inline-block">
              <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
                Report Issue
              </Button>
            </Link>

            {/* Notifications Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-9 h-9 rounded-md border border-warm-300 bg-white hover:bg-warm-100 flex items-center justify-center text-ink cursor-pointer relative"
                title="View Notifications"
              >
                <Bell className="w-4 h-4 text-ink-muted" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white" />
              </button>
              <NotificationDropdown
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
              />
            </div>

            {/* Profile Link / Avatar */}
            <Link
              href="/profile"
              className="flex items-center gap-2 p-1 rounded-md hover:bg-warm-100 transition-colors"
              title="Student Profile"
            >
              <div className="w-8 h-8 rounded-full bg-maroon-100 border border-maroon-300 flex items-center justify-center text-maroon-900 font-semibold text-xs overflow-hidden">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0)
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
