"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "./Button";

/**
 * Gates the whole app behind a signed-in Supabase session — but only when
 * Supabase is actually configured. With no env vars set, this renders
 * children immediately and the app runs fully local (IndexedDB), exactly as
 * it always has. This is what makes cloud sync an opt-in upgrade rather
 * than a requirement.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <>{children}</>;
  return <SupabaseAuthGate>{children}</SupabaseAuthGate>;
}

function SupabaseAuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, s: Session | null) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-mist text-sm">Loading…</div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (signInError) throw signInError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the sign-in link.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 bg-paper">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.3em] text-clay font-medium mb-1 text-center">PRIVATE JOURNAL</p>
        <h1 className="text-2xl font-serif font-semibold text-ink text-center mb-8">My Travel Journal</h1>

        {sent ? (
          <div className="bg-white border border-sand rounded-2xl p-6 text-center">
            <p className="text-3xl mb-3">📬</p>
            <p className="text-sm text-ink">Check <strong>{email}</strong> for a sign-in link.</p>
            <p className="text-xs text-mist mt-2">You can close this tab — opening the link signs you in.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-sand rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-mist mb-1.5" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-base bg-paper border border-sand rounded-xl px-4 py-3 focus:border-clay"
              />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button type="submit" fullWidth disabled={sending || !email.trim()}>
              {sending ? "Sending…" : "Send sign-in link"}
            </Button>
            <p className="text-xs text-mist text-center">No password — we&apos;ll email you a link.</p>
          </form>
        )}
      </div>
    </main>
  );
}
