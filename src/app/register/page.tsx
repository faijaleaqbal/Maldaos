'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentOrStaffId, setStudentOrStaffId] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;

    setIsLoading(true);
    await login(email.trim(), role);
    setIsLoading(false);

    if (role === 'STUDENT') {
      router.push('/dashboard');
    } else {
      router.push('/admin');
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
            Register for MaldaOS
          </h1>
          <p className="text-xs text-ink-muted">
            Malda College Institutional Registration for Students and Staff
          </p>
        </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Affiliation Role *"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                options={[
                  { label: 'Student', value: 'STUDENT' },
                  { label: 'Field Staff / Technician', value: 'STAFF' },
                  { label: 'Department Head / Faculty', value: 'DEPARTMENT_ADMIN' },
                ]}
              />

              <Input
                label="College ID / Roll Number *"
                placeholder="e.g. MC-2024-CS-088"
                value={studentOrStaffId}
                onChange={(e) => setStudentOrStaffId(e.target.value)}
                required
              />
            </div>

            <Select
              label="Primary Department / Facility Wing *"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              options={[
                { label: 'Computer Science & Applications', value: 'Computer Science' },
                { label: 'Physics', value: 'Physics' },
                { label: 'Chemistry', value: 'Chemistry' },
                { label: 'Mathematics', value: 'Mathematics' },
                { label: 'Electrical & Facility Maintenance Cell', value: 'Electrical' },
                { label: 'Civil Works & Plumbing', value: 'Civil Works' },
                { label: 'Bengali & Humanities', value: 'Bengali' },
                { label: 'English Literature', value: 'English' },
                { label: 'Central Library Staff', value: 'Library' },
              ]}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
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
