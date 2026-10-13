import React, { useState } from 'react';
import { Mail, Sparkles } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function SignInScreen() {
  const { sendSignInLink } = useAuth();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-stone-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-stone-900 mb-2">Community Grant Assistant</h1>
          <p className="text-stone-600">Sign in to continue.</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6">
          {sentTo ? (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Mail className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-stone-900 mb-2">Check your email</p>
              <p className="text-stone-600 text-sm mb-5">
                We sent a sign-in link to <span className="text-stone-900">{sentTo}</span>. Open it on this
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
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={isSending || !email.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSending ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
              <p className="text-xs text-stone-500 text-center">
                No password needed. Access is by invitation.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
