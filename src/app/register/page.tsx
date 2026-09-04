'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, supabaseConfigured, user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || password.length < 6) {
      setErrorMsg('Please provide name, email, and a password of at least 6 characters.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    const res = await signUp(email.trim(), password, name.trim());
    setIsLoading(false);
    if (res.success) {
      router.push('/dashboard');
    } else {
      setErrorMsg(res.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-maroon-700 text-gold-400 font-serif font-bold text-xl flex items-center justify-center mx-auto shadow-sm">
            MC
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Register for CampusPulse
          </h1>
          <p className="text-xs text-ink-muted">
            Create your Malda College incident-reporting account
          </p>
        </div>

        {!supabaseConfigured && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-1">Configuration required</strong>
              <p>
                Supabase is not configured. New accounts cannot be created until{' '}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-warm-300 bg-white p-6 sm:p-8 shadow-card space-y-5">
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Full Name *"
              placeholder="e.g. Sourav Sengupta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="College Email Address *"
              type="email"
              placeholder="e.g. s.sengupta@maldacollege.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password *"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            <p className="text-[11px] text-ink-muted">
              New accounts start with the <strong>STUDENT</strong> role. Staff and admin roles are assigned
              by a SUPER_ADMIN via the role-change RPC after account creation.
            </p>

            {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
              disabled={!supabaseConfigured}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Complete Registration & Enter
            </Button>
          </form>

          <div className="text-center text-xs text-ink-muted pt-2 border-t border-warm-200">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-maroon-800 hover:underline">
              Sign In here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
