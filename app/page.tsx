'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './lib/database.types';


type TripRow = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
};

function getSupabase(): SupabaseClient<Database> {
  const g = globalThis as any;

  if (!g.__sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    g.__sb = createClient<Database>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  return g.__sb as SupabaseClient<Database>;
}


export default function TripsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState<string>('');
  const [sessionUserId, setSessionUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [name, setName] = useState('Roadtrip Italië 2026');
  const [msg, setMsg] = useState<string>('');

  async function load() {
    setLoading(true);
    setMsg('');

    const { data: s, error: sErr } = await supabase.auth.getSession();
    if (sErr) {
      setMsg(sErr.message);
      setLoading(false);
      return;
    }
    const uid = s.session?.user?.id;
    if (!uid) {
      setSessionUserId('');
      setEmail('');
      setTrips([]);
      setLoading(false);
      return;
    }

    setSessionUserId(uid);
    setEmail(s.session?.user?.email ?? '');

    const { data, error } = await supabase
      .from('trips')
      .select('id,name,start_date,end_date,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) setMsg(error.message);
    setTrips((data as TripRow[]) ?? []);
    setLoading(false);
  }

  async function createTrip() {
    setMsg('');
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) {
      setMsg('Niet ingelogd. Ga eerst naar Login.');
      return;
    }
    const tname = name.trim();
    if (!tname) {
      setMsg('Geef een naam voor de trip.');
      return;
    }

    const { data, error } = await supabase
      .from('trips')
      .insert({ user_id: uid, name: tname })
      .select('id')
      .single();

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push(`/trips/${data.id}`);
  }

  async function logout() {
    setMsg('');
    await supabase.auth.signOut();
    await load();
  }

  useEffect(() => {
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">DriveMapz — Trips</h1>

        <div className="flex items-center gap-3">
          {sessionUserId ? (
            <>
              <div className="text-sm opacity-80">Ingelogd als: <b>{email}</b></div>
              <button
                className="rounded-lg border px-4 py-2"
                onClick={() => router.push('/settings')}
              >
                Instellingen
              </button>
              <button className="rounded-lg border px-4 py-2" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="rounded-lg border px-4 py-2"
              onClick={() => router.push('/login')}
            >
              Login
            </button>
          )}
        </div>
      </header>

      <section className="mt-8 rounded-2xl border p-5">
        <div className="text-lg font-semibold">Nieuwe trip</div>

        <div className="mt-3 flex gap-3">
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam van je trip"
          />
          <button
            className="rounded-lg bg-black px-5 py-2 text-white"
            onClick={createTrip}
            disabled={!sessionUserId}
            title={!sessionUserId ? 'Log eerst in' : ''}
          >
            Maak
          </button>
        </div>

        {msg && <div className="mt-3 rounded-lg border px-3 py-2 text-sm">{msg}</div>}
      </section>

      <section className="mt-8">
        <div className="text-lg font-semibold">Jouw trips</div>

        {loading ? (
          <div className="mt-3 opacity-70">Laden…</div>
        ) : !sessionUserId ? (
          <div className="mt-3 opacity-70">Niet ingelogd. Klik op “Login”.</div>
        ) : trips.length === 0 ? (
          <div className="mt-3 opacity-70">Nog geen trips. Maak er eentje aan.</div>
        ) : (
          <div className="mt-3 grid gap-3">
            {trips.map((t) => (
              <button
                key={t.id}
                className="rounded-xl border p-4 text-left hover:bg-black/5"
                onClick={() => router.push(`/trips/${t.id}`)}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm opacity-70">Trip ID: {t.id}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
