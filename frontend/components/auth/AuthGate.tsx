import React, { ReactNode } from 'react';
import { LogOut } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { SignInScreen } from './SignInScreen';

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center text-stone-600">
      {children}
    </div>
  );
}

/** Shows the app only to signed-in users, with a slim bar to sign out. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isConfigured, isLoading, isSignedIn, email, signOut } = useAuth();

  if (!isConfigured) {
    return <CenteredMessage>Sign-in is not configured for this site.</CenteredMessage>;
  }
  if (isLoading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (!isSignedIn) {
    return <SignInScreen />;
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3 px-4 py-1.5 text-xs text-stone-600 bg-stone-100 border-b border-stone-200">
        <span>{email}</span>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900 underline-offset-2 hover:underline"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
