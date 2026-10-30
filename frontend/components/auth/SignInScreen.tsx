import React, { useState } from 'react';
import { Mail } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { AppMark } from '../brand/AppMark';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function SignInScreen() {
  const { sendSignInLink, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingGuest, setIsStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const handleGuest = async () => {
    setIsStartingGuest(true);
    setGuestError(null);
    const problem = await continueAsGuest();
    // On success the app opens by itself; only a problem needs showing here.
    if (problem) {
      setGuestError(problem);
      setIsStartingGuest(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setIsSending(true);
    setError(null);
    const problem = await sendSignInLink(trimmed);
    setIsSending(false);

    if (problem) {
      setError(problem);
    } else {
      setSentTo(trimmed);
    }
  };

  return (
    <div className="min-h-screen bg-birch text-ink font-readable flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <AppMark size={64} className="mx-auto mb-5" />
          <h1 className="text-3xl font-bold tracking-tight mb-2">Community Grant Assistant</h1>
          <p className="text-lg text-ink-muted">Sign in, or look around as a guest.</p>
        </div>

        <div className="bg-white border border-line rounded-2xl p-6 sm:p-8">
          {sentTo ? (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-forest-tint flex items-center justify-center">
                <Mail className="w-6 h-6 text-forest-dark" aria-hidden="true" />
              </div>
              <p className="text-xl font-bold mb-2">Check your email</p>
              <p className="text-ink-muted mb-5">
                We sent a sign-in link to <span className="text-ink">{sentTo}</span>. Open it on this
                device to sign in.
              </p>
              <Button variant="outline" onClick={() => setSentTo(null)}>
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sign-in-email">Email</Label>
                <Input
                  id="sign-in-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={isSending || !email.trim()}
                className="w-full min-h-12 text-base font-bold bg-forest hover:bg-forest-dark text-white"
              >
                {isSending ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
              <p className="text-sm text-ink-muted text-center">
                No password needed. Access is by invitation.
              </p>
            </form>
          )}
        </div>

        <div className="mt-6 bg-white border border-line rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-xl font-bold mb-2">Just looking?</p>
          <p className="text-ink-muted mb-5">
            Try the app without an email. Your work is kept in this browser only, and the assistant
            has a limited number of uses.
          </p>
          {guestError && (
            <p role="alert" className="text-sm text-red-700 mb-4">
              {guestError}
            </p>
          )}
          <Button
            variant="outline"
            onClick={handleGuest}
            disabled={isStartingGuest}
            className="w-full min-h-12 text-base font-bold"
          >
            {isStartingGuest ? 'Opening…' : 'Continue as guest'}
          </Button>
        </div>
      </div>
    </div>
  );
}
