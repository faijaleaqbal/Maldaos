'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListFilter, Plus, MapPin, User, Compass } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const isCurrent = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-warm-300 px-3 py-1.5 shadow-elevated safe-area-pb">
      <div className="flex items-center justify-around">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-medium transition-colors ${
            isCurrent('/dashboard') ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Dashboard</span>
        </Link>

        {/* My Issues / Campus Issues */}
        <Link
          href="/issues"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-medium transition-colors ${
            pathname === '/issues' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <ListFilter className="w-5 h-5 mb-0.5" />
          <span>Issues</span>
        </Link>

        {/* PROMINENT CENTER REPORT BUTTON */}
        <Link
          href="/report"
          className="flex flex-col items-center justify-center -mt-5 relative z-10"
          title="Report Campus Issue"
        >
          <div className="w-13 h-13 rounded-full bg-maroon-700 text-gold-300 border-4 border-white shadow-lg flex items-center justify-center hover:bg-maroon-800 active:scale-95 transition-all p-3">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-semibold text-maroon-900 mt-0.5">Report</span>
        </Link>

        {/* Map */}
        <Link
          href="/admin/map"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-medium transition-colors ${
            pathname === '/admin/map' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>Map</span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-medium transition-colors ${
            pathname === '/profile' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
};
