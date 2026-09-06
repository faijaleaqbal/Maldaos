'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getSeedAccount, isDevSeedLoginAvailable } from '@/services/devSeedAccounts';
import { GraduationCap, Wrench, Building2, Shield, ArrowRight, AlertCircle } from 'lucide-react';

// Dev-only convenience: quick-persona logins never render in production.
const SHOW_DEV_PERSONAS = isDevSeedLoginAvailable();

export default function LoginPage() {
  const router = useRouter();
  const { login, switchRole } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    const res = await login(email.trim(), password);
    setIsLoading(false);

    if (res.success) {
      if (email.includes('admin') || email.includes('staff') || email.includes('super')) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      setErrorMsg(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleQuickPersona = async (targetRole: UserRole) => {
    if (!SHOW_DEV_PERSONAS) return; // unreachable in production (not rendered)
    const creds = getSeedAccount(targetRole); // throws in production as a second guard
    setEmail(creds.email);
    setPassword(creds.pass);
    setIsLoading(true);
    setErrorMsg(null);

    await switchRole(targetRole);
    setIsLoading(false);

    if (targetRole === 'STUDENT') {
      router.push('/dashboard');
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-maroon-700 text-gold-400 font-serif font-bold text-xl flex items-center justify-center mx-auto shadow-sm">
            MC
          </div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-maroon-900 block">
            Malda College Digital Access
          </span>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Sign in to MaldaOS
          </h1>
          <p className="text-xs text-ink-muted">
            Access your campus incident reporting desk or administrative operations console
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl border border-warm-300 bg-white p-6 shadow-card space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Institutional Email Address *"
              type="email"
              placeholder="your.name@maldacollege.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password *"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In with Authoritative Supabase Auth
            </Button>
          </form>

          {/* 1-Click Evaluation Persona Switchers (DEV/TEST ONLY — never rendered in production) */}
          {SHOW_DEV_PERSONAS && (
          <div className="pt-4 border-t border-warm-200">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-2 text-center">
              Quick 1-Click Seed Account Login (Dev Only)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPersona('STUDENT')}
                className="p-2.5 rounded border border-warm-300 hover:border-maroon-700 hover:bg-warm-50 text-left text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <GraduationCap className="w-3.5 h-3.5 text-maroon-700" />
                  <span>Student</span>
                </div>
                <span className="text-[10px] text-ink-muted block truncate">{getSeedAccount('STUDENT').email}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPersona('STAFF')}
                className="p-2.5 rounded border border-warm-300 hover:border-maroon-700 hover:bg-warm-50 text-left text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <Wrench className="w-3.5 h-3.5 text-maroon-700" />
                  <span>Maintenance Staff</span>
                </div>
                <span className="text-[10px] text-ink-muted block truncate">{getSeedAccount('STAFF').email}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPersona('DEPARTMENT_ADMIN')}
                className="p-2.5 rounded border border-warm-300 hover:border-maroon-700 hover:bg-warm-50 text-left text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <Building2 className="w-3.5 h-3.5 text-maroon-700" />
                  <span>Dept Admin</span>
                </div>
                <span className="text-[10px] text-ink-muted block truncate">{getSeedAccount('DEPARTMENT_ADMIN').email}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPersona('SUPER_ADMIN')}
                className="p-2.5 rounded border border-warm-300 hover:border-maroon-700 hover:bg-warm-50 text-left text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <Shield className="w-3.5 h-3.5 text-maroon-700" />
                  <span>Super Admin</span>
                </div>
                <span className="text-[10px] text-ink-muted block truncate">{getSeedAccount('SUPER_ADMIN').email}</span>
              </button>
            </div>
          </div>
          )}
        </div>

        <div className="text-center text-xs text-ink-muted">
          Don&apos;t have an active registration yet?{' '}
          <Link href="/register" className="font-semibold text-maroon-800 hover:underline">
            Register Student / Staff ID
          </Link>
        </div>
      </div>
    </div>
  );
}

