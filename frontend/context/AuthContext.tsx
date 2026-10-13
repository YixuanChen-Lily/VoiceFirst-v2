import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { fetchCurrentUser, setAccessTokenProvider } from '../lib/api';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  /** False when the Supabase settings are missing from this build. */
  isConfigured: boolean;
  /** True until the saved session (if any) has been read. */
  isLoading: boolean;
  email: string | null;
  isSignedIn: boolean;
  /** True when the signed-in user may add and remove library documents. */
  isAdmin: boolean;
  /** Email a one-time sign-in link. Resolves to an error message, or null on success. */
  sendSignInLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function friendlyError(message: string): string {
  if (/signups? not allowed/i.test(message)) {
    return "That email isn't registered. Ask an administrator to invite you.";
  }
  if (/rate limit|security purposes/i.test(message)) {
    return 'Too many sign-in emails were requested. Wait a few minutes and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    // Every request to the backend carries the current access token.
    setAccessTokenProvider(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      data.subscription.unsubscribe();
      setAccessTokenProvider(null);
    };
  }, []);

  // The backend decides who is an admin; ask it whenever the signed-in user changes.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    let cancelled = false;
    setIsAdmin(false);
    if (!userId) return;
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) setIsAdmin(user.is_admin);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const sendSignInLink = useCallback(async (email: string) => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        // Accounts are created by invitation, not by typing an email here.
        shouldCreateUser: false,
      },
    });
    return error ? friendlyError(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      isConfigured: Boolean(supabase),
      isLoading,
      email: session?.user.email ?? null,
      isSignedIn: Boolean(session),
      isAdmin,
      sendSignInLink,
      signOut,
    }),
    [isAdmin, isLoading, session, sendSignInLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
