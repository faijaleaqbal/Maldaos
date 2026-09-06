'use client';

import React from 'react';
import {
  X,
  ExternalLink,
  GraduationCap,
  FileBadge,
  Wallet,
  Library,
  LifeBuoy,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  getCollegeServices,
  type CollegeServiceIcon,
} from '@/lib/college-app-integration';

interface CollegeServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICONS: Record<CollegeServiceIcon, LucideIcon> = {
  'graduation-cap': GraduationCap,
  'file-badge': FileBadge,
  wallet: Wallet,
  library: Library,
  'life-buoy': LifeBuoy,
};

export const COLLEGE_SERVICES_CONTEXT_NOTE =
  'Official student records (attendance, marks, fee ledger) remain securely hosted on Malda College ERP servers. MaldaOS handles campus operations and issue resolution.';

export const CollegeServicesModal: React.FC<CollegeServicesModalProps> = ({ isOpen, onClose }) => {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const services = React.useMemo(() => getCollegeServices(), []);

  React.useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const container = modalRef.current;
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
        } else if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="college-services-title"
      aria-describedby="college-services-note"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white rounded-xl border border-warm-300 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-maroon-900 text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-mono text-gold-300 uppercase tracking-wider block">
              Malda College • Official Links
            </span>
            <h3 id="college-services-title" className="font-serif font-semibold text-lg text-white leading-tight">
              College Services
            </h3>
            <p className="text-xs text-white/75 mt-1">
              Opens the official Malda College portal in a new tab.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close college services dialog"
            className="w-9 h-9 min-w-[36px] shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Service Links */}
        <ul className="p-3 sm:p-4 space-y-2 max-h-[60vh] overflow-y-auto" aria-label="Official Malda College services">
          {services.map((service) => {
            const Icon = ICONS[service.icon];
            return (
              <li key={service.id}>
                <a
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${service.name} (opens in a new tab)`}
                  className="group flex items-start gap-3 p-3 rounded-lg border border-warm-300 bg-white hover:border-maroon-400 hover:bg-warm-50 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700"
                >
                  <div className="w-9 h-9 rounded-lg bg-maroon-50 border border-maroon-200 text-maroon-800 flex items-center justify-center shrink-0 group-hover:bg-maroon-700 group-hover:text-white group-hover:border-maroon-800 transition-colors">
                    <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-semibold text-ink">{service.name}</h4>
                      {service.badge && (
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wide bg-gold-100 text-gold-900 border border-gold-300 px-1.5 py-0.5 rounded">
                          {service.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{service.description}</p>
                    <span className="text-[10px] font-mono text-ink-faint mt-1 block truncate">
                      {service.url.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                  <ExternalLink
                    className="w-4 h-4 text-ink-faint group-hover:text-maroon-700 shrink-0 mt-0.5 transition-colors"
                    aria-hidden="true"
                  />
                </a>
              </li>
            );
          })}
        </ul>

        {/* Context Note */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div
            id="college-services-note"
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start gap-2.5"
          >
            <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-slate-700 leading-relaxed">{COLLEGE_SERVICES_CONTEXT_NOTE}</p>
          </div>
        </div>

        <div className="p-3 bg-warm-100 border-t border-warm-200 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
            External • Malda College ERP
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-maroon-800 hover:underline px-3 py-1.5 min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
