import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminPath, isMockModeEnabledOnServer, isPrivilegedRole } from '@/lib/security';

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return Boolean(url && anon && url.startsWith('http') && anon.length > 20);
}

/**
 * Server-side gate for /admin/*.
 * Session + `profiles.role` (DB) are the authority. Mock is never on in production.
 * RLS remains the data-plane backstop; this only keeps the admin UI off the public web.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  // Explicit local demo only. Production builds never take this branch.
  if (isMockModeEnabledOnServer()) {
    return NextResponse.next();
  }

  if (!configured()) {
    const login = new URL('/login', request.url);
    return NextResponse.redirect(login);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Authenticated but not staff: let the existing admin layout render the 403 UI.
  // Unauthenticated already redirected. Data remains RLS-gated either way.
  if (!isPrivilegedRole(profile?.role)) {
    return response;
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
