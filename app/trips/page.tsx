"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Trip = {
  id: string;
  title: string | null;
  created_at: string;
};

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const g = globalThis as any;
  if (!g.__sb) g.__sb = createClient(url, key);
  return g.__sb as SupabaseClient;
}

export default function TripsHome() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState<string>("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [newTitle, setNewTitle] = useState("Roadtrip Italië 2026");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 1) Auth guard + load trips
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!supabase) {
        router.replace("/login?next=/trips");
        return;
      }

      const { data: sessData } = await supabase.auth.getSession();
      if (!alive) return;

      const session = sessData.session;
      if (!session) {
        router.replace("/login?next=/trips");
        return;
      }

      setEmail(session.user.email ?? "");
      setReady(true);

      // load trips
      await refreshTrips(session.user.id);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  async function refreshTrips(userId: string) {
    if (!supabase) return;

    setMsg("");
    setBusy(true);
    try {
      // Verwacht tabel: public.trips met kolommen: id, user_id, title, created_at
      const { data, error } = await supabase
        .from("trips")
        .select("id,title,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTrips((data ?? []) as Trip[]);
    } catch (e: any) {
      setMsg(`Trips laden fout: ${e?.message ?? String(e)}`);
      setTrips([]);
    } finally {
      setBusy(false);
    }
  }

  async function createTrip() {
    if (!supabase) return;

    setMsg("");
    const title = newTitle.trim();
    if (!title) {
      setMsg("Geef een titel voor je trip.");
      return;
    }

    setBusy(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const session = sessData.session;
      if (!session) {
        router.replace("/login?next=/trips");
        return;
      }

      const userId = session.user.id;

      const { error } = await supabase.from("trips").insert({
        user_id: userId,
        title,
      });

      if (error) throw error;

      setNewTitle("");
      await refreshTrips(userId);
    } catch (e: any) {
      setMsg(`Trip maken fout: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) return <div className="p-6">Even geduld…</div>;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Trips</h1>
          <div className="mt-1 text-sm opacity-70">{email}</div>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-black hover:text-white"
        >
          Uitloggen
        </button>
      </div>

      <div className="mt-8 rounded-2xl border p-5">
        <div className="text-lg font-semibold">Nieuwe trip</div>
        <div className="mt-3 flex gap-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Bijv. Roadtrip Italië 2026"
          />
          <button
            onClick={createTrip}
            disabled={busy}
            className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
          >
            {busy ? "Even..." : "Maak"}
          </button>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-xl font-semibold">Jouw trips</div>

        {busy && trips.length === 0 ? (
          <div className="mt-3 text-sm opacity-70">Trips laden…</div>
        ) : trips.length === 0 ? (
          <div className="mt-3 text-sm opacity-70">Nog geen trips.</div>
        ) : (
          <div className="mt-4 grid gap-3">
            {trips.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/trips/${t.id}`)}
                className="text-left rounded-xl border p-4 hover:bg-gray-50"
              >
                <div className="font-semibold">{t.title ?? "(zonder titel)"}</div>
                <div className="mt-1 text-xs opacity-60">
                  {new Date(t.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {msg && <div className="mt-6 rounded-lg border px-4 py-3 text-sm">{msg}</div>}
    </main>
  );
}
