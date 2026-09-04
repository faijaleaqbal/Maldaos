'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, signUp, supabaseConfigured, user } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already signed in, bounce to dashboard.
  React.useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsLoading(true);
    setErrorMsg(null);
    const res = mode === 'signin'
      ? await login(email.trim(), password)
      : await signUp(email.trim(), password, fullName.trim() || email.split('@')[0]);
    setIsLoading(false);
    if (res.success) {
      router.push('/dashboard');
    } else {
      setErrorMsg(res.error || 'Authentication failed');
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
            {mode === 'signin' ? 'Sign in to CampusPulse' : 'Create your CampusPulse account'}
          </h1>
          <p className="text-xs text-ink-muted">
            {mode === 'signin'
              ? 'Access your campus incident reporting desk or administrative operations console'
              : 'Register with your institutional email; new accounts start as STUDENT'}
          </p>
        </div>

        {/* Configuration Gate */}
        {!supabaseConfigured && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-1">Configuration required</strong>
              <p>
                Supabase is not configured. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment, then reload.
                The application cannot serve live data without these.
              </p>
            </div>
          </div>
        )}

        {/* Login / Signup Form */}
        <div className="rounded-xl border border-warm-300 bg-white p-6 shadow-card space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full Name *"
                type="text"
                placeholder="e.g. Ananya Sen"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}
            <Input
              label="Institutional Email *"
              type="email"
              placeholder="e.g. yourname@malda-student.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password *"
              type="password"
              placeholder={mode === 'signup' ? 'Choose a strong password' : 'Your account password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
              disabled={!supabaseConfigured}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="pt-2 border-t border-warm-200 text-center text-xs text-ink-muted">
            {mode === 'signin' ? (
              <>
                New student?{' '}
                <button
                  type="button"
                  className="font-semibold text-maroon-800 hover:underline"
                  onClick={() => { setMode('signup'); setErrorMsg(null); }}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="font-semibold text-maroon-800 hover:underline"
                  onClick={() => { setMode('signin'); setErrorMsg(null); }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-center text-[11px] text-ink-muted flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          <span>Authentication is enforced server-side. Roles resolve from <code className="font-mono">public.profiles</code>.</span>
        </div>
      </div>
    </div>
  );
}
