'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListFilter, Plus, User, Compass } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const isCurrent = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav
      aria-label="Mobile application navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-warm-300 px-2 py-1 shadow-sm safe-area-pb"
    >
      <div className="grid grid-cols-5 items-center">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          aria-current={isCurrent('/dashboard') ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 text-[10px] font-medium transition-all duration-100 touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none rounded active:scale-95 select-none ${
            isCurrent('/dashboard') ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Dashboard</span>
        </Link>

        {/* My Issues / Campus Issues */}
        <Link
          href="/issues"
          aria-current={pathname === '/issues' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 text-[10px] font-medium transition-all duration-100 touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none rounded active:scale-95 select-none ${
            pathname === '/issues' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <ListFilter className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Issues</span>
        </Link>

        {/* Structured Report Button */}
        <Link
          href="/report"
          aria-label="Report campus issue"
          aria-current={pathname === '/report' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 text-[10px] font-medium transition-all duration-100 touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none rounded active:scale-95 select-none ${
            pathname === '/report' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
          title="Report Campus Issue"
        >
          <div className="w-6 h-6 rounded bg-maroon-700 text-gold-300 flex items-center justify-center mb-0.5 shadow-sm active:translate-y-0.5 active:scale-90 transition-transform">
            <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </div>
          <span className="text-[10px]">Report</span>
        </Link>

        {/* Map */}
        <Link
          href="/map"
          aria-current={pathname === '/map' || pathname === '/admin/map' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 text-[10px] font-medium transition-all duration-100 touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none rounded active:scale-95 select-none ${
            pathname === '/map' || pathname === '/admin/map' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Map</span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          aria-current={pathname === '/profile' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 text-[10px] font-medium transition-all duration-100 touch-manipulation focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none rounded active:scale-95 select-none ${
            pathname === '/profile' ? 'text-maroon-800 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span>Profile</span>
        </Link>

      </div>
    </nav>
  );
};
