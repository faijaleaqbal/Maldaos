'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AdminNav } from '@/components/layout/AdminNav';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingState fullPage message="Verifying administrative credentials..." />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-warm-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-warm-300 p-6 sm:p-8 text-center shadow-card space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-maroon-900 uppercase tracking-wider block mb-1">
              Security Protocol 403
            </span>
            <h2 className="font-serif font-bold text-xl text-ink">
              Restricted Operations Console
            </h2>
            <p className="text-xs text-ink-muted mt-2 leading-relaxed">
              You are currently signed in as <strong>{user.name}</strong> ({user.role}). Access to Malda College work orders, campus dispatch, and analytics requires authorized Staff or Department Administrator credentials.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="secondary" size="sm" className="w-full" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Student Dashboard
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="primary" size="sm" className="w-full" leftIcon={<LogIn className="w-3.5 h-3.5" />}>
                Switch Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-100 flex flex-col">
      <AdminNav />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

