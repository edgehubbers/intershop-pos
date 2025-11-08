//supabase.server.ts
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env");
  }
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}
