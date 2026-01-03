import { createClient } from "@supabase/supabase-js";

let supabaseSingleton: ReturnType<typeof createClient> | null = null;

export function supabaseBrowser() {
  if (supabaseSingleton) return supabaseSingleton;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  supabaseSingleton = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseSingleton;
}
