'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

type CamperProfile = {
  user_id: string;
  vehicle_name: string | null;
  fuel_type: string | null;
  consumption_l_per_100km: number | null;
  tank_capacity_l: number | null;
};

function getSupabase() {
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

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');

  // form
  const [vehicleName, setVehicleName] = useState('Roller Team Granduca (Ducato 130)');
  const [fuelType, setFuelType] = useState<'diesel' | 'benzine' | 'lpg' | 'elektrisch'>('diesel');
  const [consumption, setConsumption] = useState<number>(14);
  const [tank, setTank] = useState<number>(90);

  async function loadProfile() {
    setLoading(true);
    setMsg('');

    const { data: s, error: sErr } = await supabase.auth.getSession();
    if (sErr) {
      setMsg(sErr.message);
      setLoading(false);
      return;
    }
    const user = s.session?.user;
    if (!user) {
      setMsg('Niet ingelogd.');
      setUid('');
      setEmail('');
      setLoading(false);
      return;
    }
    setUid(user.id);
    setEmail(user.email ?? '');

    const { data, error } = await supabase
      .from('camper_profiles')
      .select('user_id,vehicle_name,fuel_type,consumption_l_per_100km,tank_capacity_l')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    const p = data as CamperProfile | null;
    if (p) {
      setVehicleName(p.vehicle_name ?? vehicleName);
      setFuelType((p.fuel_type as any) ?? 'diesel');
      setConsumption(p.consumption_l_per_100km ?? 14);
      setTank(p.tank_capacity_l ?? 90);
    }

    setLoading(false);
  }

  async function save() {
    setMsg('');

    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user) {
      setMsg('Niet ingelogd.');
      return;
    }

    const payload: CamperProfile = {
      user_id: user.id,
      vehicle_name: vehicleName.trim() || 'Camper',
      fuel_type: fuelType,
      consumption_l_per_100km: Number(consumption),
      tank_capacity_l: Number(tank),
    };

    const { error } = await supabase.from('camper_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg('Opgeslagen ✅');
  }

  async function logout() {
    setMsg('');
    await supabase.auth.signOut();
    router.push('/login');
  }

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <button className="mb-4 text-sm underline" onClick={() => router.push('/')}>
        ← Terug
      </button>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Instellingen</h1>
          {uid && <div className="text-sm opacity-70">Ingelogd als: <b>{email}</b></div>}
        </div>

        <div className="flex gap-3">
          <button className="rounded-lg border px-4 py-2" onClick={() => router.push('/')}>
            Trips
          </button>
          <button className="rounded-lg border px-4 py-2" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border p-5">
        {loading ? (
          <div className="opacity-70">Laden…</div>
        ) : (
          <>
            <div className="text-lg font-semibold">Camper</div>

            <label className="mt-3 block text-sm">Naam</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
            />

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm">Verbruik (L/100km)</label>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  type="number"
                  step="0.1"
                  value={consumption}
                  onChange={(e) => setConsumption(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm">Tankinhoud (liter)</label>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  type="number"
                  step="1"
                  value={tank}
                  onChange={(e) => setTank(Number(e.target.value))}
                />
              </div>
            </div>

            <label className="mt-4 block text-sm">Brandstof</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as any)}
            >
              <option value="diesel">Diesel</option>
              <option value="benzine">Benzine</option>
              <option value="lpg">LPG</option>
              <option value="elektrisch">Elektrisch</option>
            </select>

            <div className="mt-5">
              <button className="rounded-lg bg-black px-5 py-2 text-white" onClick={save} disabled={!uid}>
                Opslaan
              </button>
            </div>

            {msg && <div className="mt-3 rounded-lg border px-3 py-2 text-sm">{msg}</div>}
          </>
        )}
      </section>
    </main>
  );
}
