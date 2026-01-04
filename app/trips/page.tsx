"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

type TripRow = {
  id: string;
  name: string;
};

export default function TripsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [newTrip, setNewTrip] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);

    const { data: s } = await supabase.auth.getSession();
    const session = s.session;

    if (!session) {
      router.replace("/login?next=%2Ftrips");
      return;
    }

    setEmail(session.user.email || "");

    // profiel -> nickname
    const { data: prof, error: profErr } = await supabase
      .from("user_profiles")
      .select("nickname")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profErr) {
      setErr(profErr.message);
    } else {
      setNickname(prof?.nickname || "");
    }

    // trips
    const { data: t, error: tErr } = await supabase
      .from("trips")
      .select("id,name")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (tErr) setErr(tErr.message);
    setTrips((t as any) || []);

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTrip() {
    setErr(null);
    const title = newTrip.trim();
    if (!title) return;

    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const session = s.session;
      if (!session) {
        router.replace("/login?next=%2Ftrips");
        return;
      }

      const { error } = await supabase.from("trips").insert({
        user_id: session.user.id,
        name: title,
      });

      if (error) {
        setErr(`Trip maken fout: ${error.message}`);
        return;
      }

      setNewTrip("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Trips</h1>
          <div className="text-sm text-neutral-700">
            {nickname ? nickname : email}
          </div>
        </div>

        <div className="flex gap-2">
          <Link className="border rounded-lg px-3 py-2" href="/settings">
            Instellingen
          </Link>
          <button className="border rounded-lg px-3 py-2" onClick={logout}>
            Uitloggen
          </button>
        </div>
      </div>

      <div className="border rounded-2xl p-4 mt-6">
        <h2 className="text-xl font-semibold mb-3">Nieuwe trip</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 border rounded-lg px-3 py-2"
            value={newTrip}
            onChange={(e) => setNewTrip(e.target.value)}
            placeholder="Roadtrip Italië 2026"
          />
          <button
            className="bg-black text-white rounded-lg px-5 py-2 disabled:opacity-60"
            onClick={createTrip}
            disabled={busy}
          >
            {busy ? "..." : "Maak"}
          </button>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-8">Jouw trips</h2>

      {err && <div className="mt-3 border rounded-lg p-2 text-sm">{err}</div>}

      {loading ? (
        <div className="mt-4 text-neutral-600">Laden...</div>
      ) : trips.length === 0 ? (
        <div className="mt-4 text-neutral-600">Nog geen trips.</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {trips.map((t) => (
            <li
              key={t.id}
              className="border rounded-lg p-3 flex items-center justify-between"
            >
              <div className="font-medium">{t.name}</div>
              <Link className="underline" href={`/trips/${t.id}`}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
