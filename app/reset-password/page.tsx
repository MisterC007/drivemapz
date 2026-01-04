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

export default function ResetPasswordPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveNewPassword() {
    setMsg('');
    setBusy(true);
    try {
      if (!pw1 || pw1.length < 8) throw new Error('Wachtwoord moet minstens 8 tekens zijn.');
      if (pw1 !== pw2) throw new Error('Wachtwoorden komen niet overeen.');

      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        throw new Error('Geen reset-sessie gevonden. Open de reset-link opnieuw vanuit je e-mail.');
      }

      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;

      setMsg('Wachtwoord aangepast ✅ Je kan nu inloggen.');
      setTimeout(() => router.replace('/login'), 800);
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
        <h1 className="text-3xl font-semibold">Wachtwoord resetten</h1>
      </div>

      <section className="mt-8 rounded-2xl border p-5">
        <label className="block text-sm">Nieuw wachtwoord</label>
        <input
          className="w-full rounded-lg border px-3 py-2 mt-1"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          type="password"
          placeholder="minstens 8 tekens"
          autoComplete="new-password"
        />

        <label className="block text-sm mt-4">Herhaal nieuw wachtwoord</label>
        <input
          className="w-full rounded-lg border px-3 py-2 mt-1"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          type="password"
          placeholder="nogmaals"
          autoComplete="new-password"
        />

        <button
          className="mt-5 w-full rounded-lg bg-black px-5 py-2 text-white disabled:opacity-60"
          disabled={busy}
          onClick={saveNewPassword}
        >
          Opslaan
        </button>

        {msg && <div className="mt-4 rounded-lg border px-3 py-2 text-sm">{msg}</div>}

        <button className="mt-4 text-sm underline opacity-80" onClick={() => router.replace('/login')}>
          Terug naar login
        </button>
      </section>
    </main>
  );
}
