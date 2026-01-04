"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) {
        router.replace("/login?next=/trips");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      if (!data.session) {
        router.replace("/login?next=/trips");
        return;
      }

      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [supabase, router]);

  if (!ready) return <div className="p-6">Even geduld…</div>;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">Trips</h1>
      <p className="mt-2 text-sm opacity-70">Je bent ingelogd ✅</p>
    </main>
  );
}
