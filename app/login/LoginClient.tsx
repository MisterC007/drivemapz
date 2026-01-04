'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const g = globalThis as any;
  if (!g.__sb) {
    g.__sb = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return g.__sb as SupabaseClient;
}

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/trips';

  const supabase = useMemo(() => getSupabase(), []);
  const supabaseReady = !!supabase;

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) router.replace(next);
    }

    check();
    return () => {
      alive = false;
    };
  }, [supabase, router, next]);

  async function doLogin() {
    setMsg('');
    if (!supabase) {
      setMsg('Supabase ontbreekt. Check NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const e = email.trim();
      if (!e) throw new Error('Vul je e-mailadres in.');
      if (!password) throw new Error('Vul je wachtwoord in.');

      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) throw error;

      router.replace(next);
    } catch (e: any) {
      setMsg(`Login fout: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doSignup() {
    setMsg('');
    if (!supabase) {
      setMsg('Supabase ontbreekt. Check NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const e = email.trim();
      if (!e) throw new Error('Vul je e-mailadres in.');
      if (!password) throw new Error('Vul een wachtwoord in.');

      const { error } = await supabase.auth.signUp({ email: e, password });
      if (error) throw error;

      setMsg('Account aangemaakt. Check je mailbox indien bevestiging nodig is.');
      setMode('login');
    } catch (e: any) {
      setMsg(`Registratie fout: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doForgot() {
    setMsg('');
    if (!supabase) {
      setMsg('Supabase ontbreekt. Check NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const e = forgotEmail.trim();
      if (!e) throw new Error('Vul je e-mailadres in.');

      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo });
      if (error) throw error;

      setMsg('Reset-mail verzonden. Check je mailbox (en spam).');
    } catch (e: any) {
      setMsg(`Reset fout: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="flex flex-col items-center gap-3 mt-8">
        <img
          src="/brand/drivemapz-logo.png"
          alt="DriveMapz"
          className="h-64 w-auto mb-2"
        />
        <div className="text-sm opacity-70">Trips • Stops • Fuel • Toll • Tracking</div>
      </div>

      <section className="mt-8 rounded-2xl border p-5">
        <div className="flex gap-2 mb-4">
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${mode === 'login' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('login')}
            disabled={!supabaseReady || busy}
          >
            Login
          </button>

          <button
            className={`rounded-lg border px-3 py-2 text-sm ${mode === 'signup' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('signup')}
            disabled={!supabaseReady || busy}
          >
            Registreren
          </button>

          <button
            className={`ml-auto rounded-lg border px-3 py-2 text-sm ${mode === 'forgot' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('forgot')}
            disabled={!supabaseReady || busy}
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
              disabled={!supabaseReady || busy}
            />

            <label className="block text-sm mt-4">Wachtwoord</label>
            <input
              className="w-full rounded-lg border px-3 py-2 mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={!supabaseReady || busy}
            />

            <button
              className="mt-5 w-full rounded-lg bg-black px-5 py-2 text-white disabled:opacity-60"
              disabled={!supabaseReady || busy}
              onClick={mode === 'login' ? doLogin : doSignup}
            >
              {busy ? 'Even geduld…' : mode === 'login' ? 'Login' : 'Account aanmaken'}
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
              disabled={!supabaseReady || busy}
            />

            <button
              className="mt-5 w-full rounded-lg bg-black px-5 py-2 text-white disabled:opacity-60"
              disabled={!supabaseReady || busy}
              onClick={doForgot}
            >
              {busy ? 'Even geduld…' : 'Stuur reset-mail'}
            </button>
          </>
        )}

        {msg && <div className="mt-4 rounded-lg border px-3 py-2 text-sm">{msg}</div>}
      </section>
    </main>
  );
}
