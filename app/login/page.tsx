'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function supabaseBrowser() {
  const g = globalThis as any;
  if (!g.__sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    g.__sb = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return g.__sb as ReturnType<typeof createClient>;
}

export default function LoginPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function doLogin() {
    setMsg('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace('/');
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doSignup() {
    setMsg('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setMsg('Account aangemaakt ✅ (check je mailbox als email-confirm aan staat).');
      setMode('login');
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doForgot() {
    setMsg('');
    setBusy(true);
    try {
      const e = forgotEmail.trim();
      if (!e) throw new Error('Vul je e-mailadres in.');

      // ✅ Stuur reset-link naar /reset-password
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : 'https://drivemapz.com/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo });
      if (error) throw error;

      setMsg('Reset-mail verzonden ✅ Check je mailbox (en spam).');
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="flex flex-col items-center gap-3 mt-8">
        <img src="/logo.svg" alt="DriveMapz" className="h-14 w-14" />
        <h1 className="text-3xl font-semibold">DriveMapz</h1>
        <div className="text-sm opacity-70">Trips • Stops • Tank • Tol • Tracking</div>
      </div>

      <section className="mt-8 rounded-2xl border p-5">
        <div className="flex gap-2 mb-4">
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${mode === 'login' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${mode === 'signup' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('signup')}
          >
            Registreren
          </button>
          <button
            className={`ml-auto rounded-lg border px-3 py-2 text-sm ${mode === 'forgot' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('forgot')}
          >
            Wachtwoord vergeten
          </button>
        </div>

        {mode !== 'forgot' ? (
          <>
            <label className="block text-sm">E-mail</label>
            <input
              className="w-full rounded-lg border px-3 py-2 mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.be"
              autoComplete="email"
            />

            <label className="block text-sm mt-4">Wachtwoord</label>
            <input
              className="w-full rounded-lg border px-3 py-2 mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            <button
              className="mt-5 w-full rounded-lg bg-black px-5 py-2 text-white disabled:opacity-60"
              disabled={busy}
              onClick={mode === 'login' ? doLogin : doSignup}
            >
              {mode === 'login' ? 'Login' : 'Account aanmaken'}
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm">E-mail</label>
            <input
              className="w-full rounded-lg border px-3 py-2 mt-1"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="jij@voorbeeld.be"
              autoComplete="email"
            />

            <button
              className="mt-5 w-full rounded-lg bg-black px-5 py-2 text-white disabled:opacity-60"
              disabled={busy}
              onClick={doForgot}
            >
              Stuur reset-mail
            </button>

            <div className="mt-3 text-xs opacity-70">
              Je krijgt een mail met een link om je wachtwoord opnieuw in te stellen.
            </div>
          </>
        )}

        {msg && <div className="mt-4 rounded-lg border px-3 py-2 text-sm">{msg}</div>}
      </section>
    </main>
  );
}
