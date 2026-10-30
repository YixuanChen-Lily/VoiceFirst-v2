import React, { ReactNode } from 'react';
import { LogOut } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { SignInScreen } from './SignInScreen';

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center text-ink-muted font-readable">
      {children}
    </div>
  );
}

/** Shows the app only to signed-in users, with a slim bar to sign out. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isConfigured, isLoading, isSignedIn, isGuest, email, signOut } = useAuth();

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
      <div className="flex items-center justify-end gap-3 px-4 py-1.5 text-xs text-ink-muted bg-white border-b border-line font-readable">
        <span>{isGuest ? 'Guest' : email}</span>
        <button
          type="button"
          onClick={() => {
            if (
              isGuest &&
              !window.confirm(
                "Leave guest mode? Guests can't sign back in, so your proposals and files will be gone.",
              )
            ) {
              return;
            }
            signOut();
          }}
          className="inline-flex items-center gap-1 text-ink hover:text-forest-dark underline-offset-2 hover:underline"
        >
          <LogOut className="w-3.5 h-3.5" />
          {isGuest ? 'Leave guest mode' : 'Sign out'}
        </button>
      </div>
      {children}
    </>
  );
}
