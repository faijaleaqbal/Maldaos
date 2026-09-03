'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  UserCheck,
  Compass,
  BarChart3,
  Lightbulb,
  Sliders,
  Radio,
  Flame,
} from 'lucide-react';

export const AdminNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Command Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Issue Queue', href: '/admin/issues', icon: ClipboardList },
    { label: 'Assignments', href: '/admin/assignments', icon: UserCheck },
    { label: 'Campus Map', href: '/admin/map', icon: Compass },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Insights', href: '/admin/insights', icon: Lightbulb },
    { label: 'Settings', href: '/admin/settings', icon: Sliders },
  ];

  return (
    <div className="w-full bg-maroon-950 text-white border-b border-maroon-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between py-2 gap-3">
          {/* Section Indicator */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-gold-400">
              Campus Command Center
            </span>
            <span className="text-white/40 text-xs hidden sm:inline">| Duty Telemetry Active</span>
          </div>

          {/* Quick Sub-navigation tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 text-xs">
            {navItems.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-maroon-800 text-gold-300 font-semibold border border-gold-500/40'
                      : 'text-white/80 hover:text-white hover:bg-maroon-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};
