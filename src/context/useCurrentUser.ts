'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { User } from '@/types';

/**
 * Returns the current user, or null. Provides a small loading flag
 * for the brief moment after mount before the cached user is read.
 *
 * Use this instead of destructuring `user` directly from useAuth(),
 * so the rest of the app can treat user as User | null uniformly.
 */
export function useCurrentUser(): { user: User | null; ready: boolean } {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return { user, ready };
}
