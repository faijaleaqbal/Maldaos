import React from 'react';
import { redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AdminNav } from '@/components/layout/AdminNav';

/**
 * Server-side admin route guard.
 *
 * This is the security boundary for /admin/*. The middleware would be
 * the next layer (broader coverage of /api/*), but for /admin/* we
 * gate here at the layout level so the check is server-side and
 * RLS-authoritative. The RLS policies in the DB are the actual data
 * gate; this guard prevents the admin pages from rendering at all
 * for non-admins.
 *
 * If @supabase/ssr is not available in the runtime, the guard is
 * skipped and we fall through (the DB RLS still enforces access).
 */
async function getRoleFromSession(): Promise<{ role: string | null; configured: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { role: null, configured: false };
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options?: CookieOptions }[]) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options as CookieOptions);
            }
          } catch {
            // Server Components cannot set cookies; the auth-helpers
            // for RSC handle this via the read-only flow.
          }
        },
      },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return { role: null, configured: true };
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    return { role: (profile as any)?.role ?? null, configured: true };
  } catch {
    return { role: null, configured: true };
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, configured } = await getRoleFromSession();
  if (configured) {
    if (!role) {
      // No session, or profile missing. Send to login.
      redirect('/login?next=/admin');
    }
    if (role !== 'STAFF' && role !== 'DEPARTMENT_ADMIN' && role !== 'SUPER_ADMIN') {
      // Signed in but not an admin. Bounce to the student dashboard.
      redirect('/dashboard?denied=admin');
    }
  }
  // If Supabase is not configured at all, we let the children render
  // and rely on the per-page empty-state messaging. The DB RLS is
  // the real backstop; this is a UX gate only.
  return (
    <div className="min-h-screen bg-warm-100 flex flex-col">
      <AdminNav />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
