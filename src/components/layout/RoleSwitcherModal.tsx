'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { isDevSeedLoginAvailable } from '@/services/devSeedAccounts';
import { X, Check, GraduationCap, Wrench, Building2, Shield } from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { user, role, switchRole, mockUsers } = useAuth();

  const modalRef = React.useRef<HTMLDivElement>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);

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
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !isDevSeedLoginAvailable()) return null;

  const personas = [
    {
      role: 'STUDENT' as UserRole,
      title: 'Student Experience',
      persona: mockUsers.student.name,
      department: mockUsers.student.department,
      idTag: mockUsers.student.studentId,
      icon: GraduationCap,
      description: 'Report classroom/lab faults, track my tickets, upvote campus repairs.',
      href: '/dashboard',
    },
    {
      role: 'STAFF' as UserRole,
      title: 'Field Technician / Staff',
      persona: mockUsers.staff.name,
      department: mockUsers.staff.department,
      idTag: mockUsers.staff.staffId,
      icon: Wrench,
      description: 'Receive dispatched work orders, update progress, submit resolution proof.',
      href: '/admin/issues',
    },
    {
      role: 'DEPARTMENT_ADMIN' as UserRole,
      title: 'Department Infrastructure Admin',
      persona: mockUsers.deptAdmin.name,
      department: mockUsers.deptAdmin.department,
      idTag: mockUsers.deptAdmin.staffId,
      icon: Building2,
      description: 'Triage incoming student complaints, assign technicians, monitor department SLA.',
      href: '/admin',
    },
    {
      role: 'SUPER_ADMIN' as UserRole,
      title: 'Principal / Dean Executive Console',
      persona: mockUsers.superAdmin.name,
      department: mockUsers.superAdmin.department,
      idTag: mockUsers.superAdmin.staffId,
      icon: Shield,
      description: 'Campus-wide command center, Campus Health Score, systemic insights, institutional oversight.',
      href: '/admin',
    },
  ];

  const handleSelect = async (r: UserRole) => {
    await switchRole(r);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-switcher-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div ref={modalRef} className="w-full max-w-lg bg-white rounded-xl border border-warm-300 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-maroon-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-gold-300 uppercase tracking-wider block">
              Malda College Evaluator Tool
            </span>
            <h3 id="role-switcher-title" className="font-serif font-semibold text-lg text-white">
              Switch User Role & Persona
            </h3>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close role switcher dialog"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Persona Options */}
        <div className="p-4 sm:p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-ink-muted leading-relaxed">
            Easily experience MaldaOS from different institutional perspectives:
          </p>

          {personas.map((p) => {
            const isCurrent = role === p.role;
            const Icon = p.icon;

            return (
              <div
                key={p.role}
                role="button"
                tabIndex={0}
                aria-label={`Switch persona to ${p.title} (${p.persona})${isCurrent ? ', currently active' : ''}`}
                onClick={() => handleSelect(p.role)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(p.role);
                  }
                }}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 ${
                  isCurrent
                    ? 'border-maroon-700 bg-maroon-50/70 ring-2 ring-maroon-700/20'
                    : 'border-warm-300 hover:border-maroon-400 hover:bg-warm-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isCurrent ? 'bg-maroon-700 text-white' : 'bg-warm-200 text-maroon-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-ink">{p.title}</h4>
                        {isCurrent && (
                          <span className="text-[10px] bg-maroon-700 text-white px-1.5 py-0.5 rounded font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-maroon-900 font-medium">
                        {p.persona} <span className="text-ink-muted">({p.department})</span>
                      </p>
                    </div>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-maroon-700 shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-ink-muted mt-2 pl-11">{p.description}</p>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-warm-100 border-t border-warm-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-maroon-800 hover:underline px-3 py-1.5 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
