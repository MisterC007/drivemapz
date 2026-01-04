// app/lib/supabaseBrowser.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function supabaseBrowser(): SupabaseClient<Database> {
  const g = globalThis as any;

  if (g.__sb) return g.__sb as SupabaseClient<Database>;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  g.__sb = createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return g.__sb as SupabaseClient<Database>;
}

// compat export (als je elders 'supabaseBrowser' als value importeert)
export const supabase = supabaseBrowser;
